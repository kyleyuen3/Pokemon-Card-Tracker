"""
Turns the accumulated daily snapshots in history/*.csv.gz into the JSON the
website reads: latest price per card, 7-day/30-day % change, a short trend
sparkline, and the same fair-value regression the original pipeline used
(fit within each set's own rarity tiers).

Run this after fetch_prices.py:

    cd data-pipeline
    python3 build_dataset.py

Only cards priced today show up in the output -- a card that pokemontcg.io
has no tcgplayer price for isn't useful in a *price* tracker.

Trend fields fill in as history accumulates: on day 1 there's nothing to
diff against, so pct_change_7d/30d/sparkline are just null/short until the
daily job has run for a while. That's expected, not a bug.
"""

import json
import math
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

HERE = Path(__file__).parent
HISTORY_DIR = HERE / "history"
POPULARITY_PATH = HERE / "popularity_overrides.csv"
APP_DATA_PATH = HERE.parent / "pokemon-valuations" / "public" / "cards_data.json"
SUMMARY_CSV_PATH = HERE / "all_sets_valuations.csv"

SPARKLINE_POINTS = 10
PACK_PRICE = 5.00
# Only sets with a verified, specific-pull-odds source get a pull cost --
# everything else stays blank rather than guessed. See HOW_TO_ADD_A_SET.md.
VERIFIED_PACKS_BY_SET = {
    "Prismatic Evolutions": {
        "Double Rare": 49, "Ultra Rare": 217,
        "Special Illustration Rare": 1440, "Hyper Rare": 125,
    },
}


def log(msg):
    print(f"[build_dataset] {msg}", flush=True)


def load_history():
    """Returns a DataFrame with one row per (card_id, date), plus static
    per-card metadata carried along (it doesn't change day to day, but it's
    simplest to just keep it on every row and de-dup later)."""
    files = sorted(HISTORY_DIR.glob("*.csv.gz"))
    if not files:
        raise SystemExit(
            f"No history files found in {HISTORY_DIR}. Run fetch_prices.py at least once first."
        )
    frames = [pd.read_csv(f) for f in files]
    df = pd.concat(frames, ignore_index=True)
    df["date"] = pd.to_datetime(df["date"])
    return df


def nearest_price_on_or_before(series_by_date, target_date, tolerance_days=3):
    """series_by_date: pandas Series indexed by date, sorted ascending.
    Returns the price at the closest available date <= target_date, within
    `tolerance_days`, or None if nothing qualifies (not enough history yet,
    or a gap in the daily job bigger than the tolerance)."""
    eligible = series_by_date[series_by_date.index <= target_date]
    if eligible.empty:
        return None
    closest_date = eligible.index[-1]
    if (target_date - closest_date).days > tolerance_days:
        return None
    return eligible.iloc[-1]


def build_trend_fields(history_df):
    """Per card_id: latest price + metadata, pct change over 7/30 days, and
    a short sparkline of the most recent prices."""
    latest_date = history_df["date"].max()
    latest_rows = history_df[history_df["date"] == latest_date].drop_duplicates("card_id", keep="last")

    priced = history_df.dropna(subset=["tcgplayer_price"]).sort_values("date")
    by_card = {cid: g.set_index("date")["tcgplayer_price"] for cid, g in priced.groupby("card_id")}

    records = []
    for _, row in latest_rows.iterrows():
        card_id = row["card_id"]
        series = by_card.get(card_id)
        price = row["tcgplayer_price"]
        if pd.isna(price):
            continue  # no price today -- nothing to track for this card right now

        pct_7d = pct_30d = None
        sparkline = []
        if series is not None:
            p7 = nearest_price_on_or_before(series, latest_date - timedelta(days=7))
            if p7 and p7 > 0:
                pct_7d = round((price - p7) / p7 * 100, 1)
            p30 = nearest_price_on_or_before(series, latest_date - timedelta(days=30))
            if p30 and p30 > 0:
                pct_30d = round((price - p30) / p30 * 100, 1)
            sparkline = [round(v, 2) for v in series.tail(SPARKLINE_POINTS).tolist()]

        records.append({
            "card_id": card_id,
            "set": row["set_name"],
            "number": row["number"],
            "name": row["name"],
            "rarity": row["rarity"] if pd.notna(row["rarity"]) else "Unknown",
            "types": row["types"] if pd.notna(row["types"]) else "",
            "hp": row["hp"] if pd.notna(row["hp"]) else 0,
            "tcgplayer_price": price,
            "cardmarket_price_eur": None if pd.isna(row["cardmarket_price_eur"]) else row["cardmarket_price_eur"],
            "pct_change_7d": pct_7d,
            "pct_change_30d": pct_30d,
            "sparkline": sparkline,
        })

    return pd.DataFrame.from_records(records), latest_date


def apply_fair_value_model(df):
    df = df.copy()
    df["is_ex"] = df["name"].str.contains(" ex", case=False, regex=False).astype(int)

    popularity = {}
    if POPULARITY_PATH.exists():
        pop_df = pd.read_csv(POPULARITY_PATH)
        popularity = dict(zip(pop_df["name"], pop_df["popularity"]))
    df["popularity"] = df["name"].map(popularity).fillna(3.0)

    df["price"] = df["tcgplayer_price"]
    df = df[df["price"] > 0].copy()
    df["log_price"] = np.log(df["price"])

    results = []
    for (_set, _rarity), group in df.groupby(["set", "rarity"]):
        group = group.copy()
        if len(group) < 4:
            group["predicted_price"] = group["price"].mean()
            group["residual_log"] = np.log(group["price"]) - np.log(group["predicted_price"])
            results.append(group)
            continue

        X = group[["hp", "popularity", "is_ex"]].fillna(0)
        y = group["log_price"]
        model = LinearRegression()
        model.fit(X, y)
        pred_log = model.predict(X)
        group["predicted_price"] = np.exp(pred_log)
        group["residual_log"] = group["log_price"] - pred_log
        results.append(group)

    out = pd.concat(results).sort_values("residual_log")
    out["verdict"] = np.where(
        out["residual_log"] > 0.35, "OVERVALUED",
        np.where(out["residual_log"] < -0.35, "UNDERVALUED", "fair"),
    )

    def lookup_pull_packs(row):
        table = VERIFIED_PACKS_BY_SET.get(row["set"], {})
        return table.get(row["rarity"])

    out["pull_cost"] = out.apply(lookup_pull_packs, axis=1)
    out["pull_cost"] = out["pull_cost"].astype(float) * PACK_PRICE
    valid_pull = out["pull_cost"].dropna()
    out["pull_score"] = None
    if len(valid_pull) > 1:
        lo, hi = valid_pull.min(), valid_pull.max()
        out["pull_score"] = 1 + 9 * (out["pull_cost"] - lo) / (hi - lo)

    return out


def main():
    history_df = load_history()
    trend_df, latest_date = build_trend_fields(history_df)
    log(f"latest snapshot date: {latest_date.date()} -- {len(trend_df)} priced cards")

    out = apply_fair_value_model(trend_df)

    columns = ["set", "number", "name", "rarity", "types", "hp", "is_ex", "popularity",
               "tcgplayer_price", "cardmarket_price_eur", "price", "predicted_price",
               "residual_log", "verdict", "pull_cost", "pull_score",
               "pct_change_7d", "pct_change_30d", "sparkline"]
    out = out[columns]
    out_rounded = out.copy()
    for col in ["predicted_price", "residual_log", "pull_cost", "pull_score", "tcgplayer_price"]:
        out_rounded[col] = out_rounded[col].astype(float).round(2)

    # CSV can't hold list cells sensibly -- drop sparkline from the flat summary export.
    out_rounded.drop(columns=["sparkline"]).to_csv(SUMMARY_CSV_PATH, index=False)

    records = out_rounded.to_dict(orient="records")
    clean = [
        {k: (None if isinstance(v, float) and math.isnan(v) else v) for k, v in r.items()}
        for r in records
    ]
    APP_DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(APP_DATA_PATH, "w") as f:
        json.dump({
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "latest_price_date": str(latest_date.date()),
            "cards": clean,
        }, f)

    log(f"sets found: {sorted(out['set'].unique())[:10]}{'...' if out['set'].nunique() > 10 else ''}")
    log(f"total sets: {out['set'].nunique()}, total cards: {len(out)}")
    log(f"wrote {APP_DATA_PATH}")
    log(f"wrote {SUMMARY_CSV_PATH}")


if __name__ == "__main__":
    main()
