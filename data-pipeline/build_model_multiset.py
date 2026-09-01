"""
LEGACY / MANUAL PATH -- superseded by fetch_prices.py + build_dataset.py.

This script rebuilds the fair-value model from hand-authored CSVs you drop
into sets/ (one manual pull per set, no history). It's kept around for
reference and for the "hand-tune one specific set" workflow described in
HOW_TO_ADD_A_SET.md, but the site now gets its data from the automated daily
pipeline instead -- see README.md. Running this script will overwrite
public/cards_data.json with a snapshot that has no price history, so the
next daily automated run will look like a fresh start for trend purposes.

Auto-discovers every set in sets/ and rebuilds the fair-value model across
all of them, writing the result straight into the app's data file.

TO ADD A NEW SET:
  1. Drop a file named  <set_slug>_raw.csv  into sets/
     (e.g. "black_bolt_raw.csv" -> becomes "Black Bolt" in the app)
     Columns required: number,name,rarity,type,hp,price
  2. (optional) Drop a matching  <set_slug>_ebay.csv  into sets/ for a second
     price source on that set. Columns: number,ebay_price
  3. (optional) Add rows to popularity_overrides.csv for any character you
     want to hand-tune (column: name,popularity). Unlisted cards default to
     a neutral popularity of 3.0.
  4. Run:  python3 build_model_multiset.py
     This regenerates ../pokemon-valuations/public/cards_data.json directly
     -- just refresh the browser tab, no copying files around.

No other files need to be touched to add a set.
"""

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

HERE = Path(__file__).parent
SETS_DIR = HERE / "sets"
APP_DATA_PATH = HERE.parent / "pokemon-valuations" / "public" / "cards_data.json"
SUMMARY_CSV_PATH = HERE / "all_sets_valuations.csv"

def slug_to_title(slug: str) -> str:
    return slug.replace("_", " ").title()

# ---- Discover and load every set ----
raw_files = sorted(SETS_DIR.glob("*_raw.csv"))
if not raw_files:
    raise SystemExit(f"No *_raw.csv files found in {SETS_DIR}")

frames = []
ebay_frames = {}
for raw_path in raw_files:
    slug = raw_path.name[: -len("_raw.csv")]
    set_name = slug_to_title(slug)
    df_set = pd.read_csv(raw_path)
    df_set["set"] = set_name
    frames.append(df_set)

    ebay_path = SETS_DIR / f"{slug}_ebay.csv"
    if ebay_path.exists():
        ebay_frames[set_name] = pd.read_csv(ebay_path)

df = pd.concat(frames, ignore_index=True)
df.rename(columns={"price": "tcgplayer_price"}, inplace=True)

# ---- Merge in eBay/PriceCharting cross-check, per set (numbers restart per set) ----
df["ebay_price"] = np.nan
for set_name, ebay_df in ebay_frames.items():
    mask = df["set"] == set_name
    merged = df.loc[mask, ["number"]].merge(ebay_df, on="number", how="left")
    df.loc[mask, "ebay_price"] = merged["ebay_price"].values

df["price"] = df[["tcgplayer_price", "ebay_price"]].mean(axis=1, skipna=True)
df["source_disagreement_pct"] = (
    (df["tcgplayer_price"] - df["ebay_price"]).abs() / df["price"]
) * 100

# ---- Feature engineering ----
df["is_ex"] = df["name"].str.contains(" ex", case=False).astype(int)

pop_path = HERE / "popularity_overrides.csv"
popularity = {}
if pop_path.exists():
    pop_df = pd.read_csv(pop_path)
    popularity = dict(zip(pop_df["name"], pop_df["popularity"]))
df["popularity"] = df["name"].map(popularity).fillna(3.0)

df["log_price"] = np.log(df["price"])

# ---- Fair-value regression, fit WITHIN each (set, rarity) group ----
results = []
for (set_name, rarity), group in df.groupby(["set", "rarity"]):
    group = group.copy()
    if len(group) < 4:
        group["predicted_price"] = group["price"].mean()
        group["residual_log"] = np.log(group["price"]) - np.log(group["predicted_price"])
        results.append(group)
        continue

    X = group[["hp", "popularity", "is_ex"]].copy()
    y = group["log_price"]
    model = LinearRegression()
    model.fit(X, y)
    pred_log = model.predict(X)
    group["predicted_price"] = np.exp(pred_log)
    group["residual_log"] = group["log_price"] - pred_log
    results.append(group)

out = pd.concat(results).sort_values("residual_log")
out["verdict"] = np.where(out["residual_log"] > 0.35, "OVERVALUED",
                    np.where(out["residual_log"] < -0.35, "UNDERVALUED", "fair"))

# ---- Pull cost: only computed where a verified specific-pull-odds source
# exists. Currently that's Prismatic Evolutions only -- new sets get blank
# pull costs until real pull-rate data is sourced for them (don't guess). ----
PACK_PRICE = 5.00
verified_packs_by_set = {
    "Prismatic Evolutions": {
        "Double Rare": 49, "Ultra Rare": 217,
        "Special Illustration Rare": 1440, "Hyper Rare": 125,
    },
}
def lookup_pull_packs(row):
    table = verified_packs_by_set.get(row["set"], {})
    return table.get(row["rarity"])

out["pull_cost"] = out.apply(lookup_pull_packs, axis=1)
out["pull_cost"] = out["pull_cost"].astype(float) * PACK_PRICE
valid_pull = out["pull_cost"].dropna()
if len(valid_pull) > 1:
    lo, hi = valid_pull.min(), valid_pull.max()
    out["pull_score"] = 1 + 9 * (out["pull_cost"] - lo) / (hi - lo)

out = out[["set","number","name","rarity","hp","is_ex","popularity","tcgplayer_price",
           "ebay_price","source_disagreement_pct","price",
           "predicted_price","residual_log","verdict","pull_cost","pull_score"]]
out = out.round({"predicted_price": 2, "residual_log": 3, "source_disagreement_pct": 1,
                  "pull_cost": 2, "pull_score": 2})

out.to_csv(SUMMARY_CSV_PATH, index=False)

# ---- Write straight into the app's data file ----
records = out.to_dict(orient="records")
clean = [{k: (None if isinstance(v, float) and math.isnan(v) else v) for k, v in r.items()} for r in records]
APP_DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
with open(APP_DATA_PATH, "w") as f:
    json.dump(clean, f)

print(f"Sets found: {sorted(df['set'].unique())}")
print(f"Total cards: {len(out)}")
print(f"Wrote {APP_DATA_PATH}")
print(f"Wrote {SUMMARY_CSV_PATH}")
