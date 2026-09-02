"""
Pulls today's market price for every Pokemon card, for every official set,
from the free pokemontcg.io API, and appends the result as one row-per-card
snapshot to data-pipeline/history/<date>.csv.gz.

This is the "automatic daily tracking" half of the pipeline. It's meant to be
run once a day by .github/workflows/daily_price_update.yml, but you can also
run it by hand:

    cd data-pipeline
    pip install -r requirements.txt
    python3 fetch_prices.py

Optional: set POKEMONTCG_API_KEY (free signup at https://pokemontcg.io) as an
environment variable / GitHub Actions secret for higher, more reliable rate
limits. The script works without one -- the full card database is well under
the API's no-key daily quota -- it's just slower and more likely to need a
retry.

After this runs, run build_dataset.py to turn the accumulated history into
the JSON the website actually reads.
"""

import csv
import gzip
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

API_BASE = "https://api.pokemontcg.io/v2/cards"
PAGE_SIZE = 250
REQUEST_TIMEOUT = 30
SLEEP_BETWEEN_PAGES = 1.2  # seconds -- stays well under the API's per-minute limit
MAX_RETRIES = 5

HERE = Path(__file__).parent
HISTORY_DIR = HERE / "history"

# Prefer variants roughly in "most standard printing first" order. Whichever
# variant actually has a market/mid/low value wins.
TCG_VARIANT_PRIORITY = [
    "holofoil", "normal", "reverseHolofoil",
    "1stEditionHolofoil", "1stEditionNormal",
    "unlimitedHolofoil", "unlimited",
]


def log(msg):
    print(f"[fetch_prices] {msg}", flush=True)


def make_session():
    session = requests.Session()
    api_key = os.environ.get("POKEMONTCG_API_KEY")
    if api_key:
        session.headers["X-Api-Key"] = api_key
    session.headers["User-Agent"] = "pokemon-card-tracker/1.0 (personal price tracker)"
    return session


def fetch_page(session, page, use_select=True):
    params = {"page": page, "pageSize": PAGE_SIZE, "orderBy": "id"}
    if use_select:
        params["select"] = "id,name,number,rarity,hp,types,set,tcgplayer,cardmarket"

    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = session.get(API_BASE, params=params, timeout=REQUEST_TIMEOUT)
        except requests.RequestException as e:
            last_error = e
            time.sleep(2 ** attempt)
            continue

        if resp.status_code == 200:
            return resp.json()

        if resp.status_code == 400 and use_select:
            # In case the API version in use doesn't support `select` -- retry once without it.
            log("select= param rejected by API, retrying without it")
            return fetch_page(session, page, use_select=False)

        if resp.status_code in (429, 500, 502, 503, 504):
            wait = 2 ** attempt
            log(f"page {page}: HTTP {resp.status_code}, retrying in {wait}s (attempt {attempt}/{MAX_RETRIES})")
            time.sleep(wait)
            last_error = RuntimeError(f"HTTP {resp.status_code}: {resp.text[:300]}")
            continue

        # Any other error is not worth retrying.
        raise RuntimeError(f"page {page}: unexpected HTTP {resp.status_code}: {resp.text[:300]}")

    raise RuntimeError(f"page {page}: giving up after {MAX_RETRIES} attempts ({last_error})")


def extract_tcg_price(card):
    tcgplayer = card.get("tcgplayer") or {}
    prices = tcgplayer.get("prices") or {}

    for variant in TCG_VARIANT_PRIORITY:
        v = prices.get(variant)
        if not v:
            continue
        for field in ("market", "mid", "low"):
            if v.get(field) is not None:
                return v[field]

    # Fall back to whatever variant exists, in case a new/unlisted one shows up.
    for v in prices.values():
        for field in ("market", "mid", "low"):
            if v and v.get(field) is not None:
                return v[field]
    return None


def extract_cardmarket_price(card):
    cardmarket = card.get("cardmarket") or {}
    prices = cardmarket.get("prices") or {}
    # cardmarket prices are EUR -- kept as a separate informational field,
    # never averaged with the USD tcgplayer price.
    return prices.get("trendPrice") or prices.get("averageSellPrice")


def parse_hp(card):
    raw = card.get("hp")
    if raw is None:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def card_to_row(card, snapshot_date):
    set_info = card.get("set") or {}
    types = card.get("types") or []
    return {
        "date": snapshot_date,
        "card_id": card.get("id"),
        "set_id": set_info.get("id"),
        "set_name": set_info.get("name"),
        "number": card.get("number"),
        "name": card.get("name"),
        "rarity": card.get("rarity") or "Unknown",
        "types": "/".join(types) if types else "",
        "hp": parse_hp(card),
        "tcgplayer_price": extract_tcg_price(card),
        "cardmarket_price_eur": extract_cardmarket_price(card),
    }


def fetch_all_cards(session, max_pages=None):
    rows = []
    page = 1
    while True:
        if max_pages and page > max_pages:
            log(f"stopping early at max_pages={max_pages} (testing mode)")
            break

        payload = fetch_page(session, page)
        data = payload.get("data", [])
        if not data:
            break

        snapshot_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        for card in data:
            if card.get("supertype") not in (None, "Pokémon", "Pokemon"):
                continue  # skip Trainer/Energy cards -- this tracker is Pokemon-card prices
            rows.append(card_to_row(card, snapshot_date))

        total = payload.get("totalCount")
        log(f"page {page}: +{len(data)} cards ({len(rows)} Pokemon cards so far"
            + (f" of ~{total} total cards" if total else "") + ")")

        if len(data) < PAGE_SIZE:
            break
        page += 1
        time.sleep(SLEEP_BETWEEN_PAGES)

    return rows


def write_snapshot(rows, snapshot_date):
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    out_path = HISTORY_DIR / f"{snapshot_date}.csv.gz"
    fieldnames = ["date", "card_id", "set_id", "set_name", "number", "name",
                  "rarity", "types", "hp", "tcgplayer_price", "cardmarket_price_eur"]
    with gzip.open(out_path, "wt", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    return out_path


def main():
    max_pages = None
    if "--max-pages" in sys.argv:
        idx = sys.argv.index("--max-pages")
        max_pages = int(sys.argv[idx + 1])

    session = make_session()
    if not os.environ.get("POKEMONTCG_API_KEY"):
        log("no POKEMONTCG_API_KEY set -- running unauthenticated (fine, just slower/lower quota)")

    log("fetching all Pokemon cards from pokemontcg.io ...")
    rows = fetch_all_cards(session, max_pages=max_pages)
    if not rows:
        raise SystemExit("fetched zero cards -- refusing to write an empty snapshot")

    with_price = sum(1 for r in rows if r["tcgplayer_price"] is not None)
    snapshot_date = rows[0]["date"]
    out_path = write_snapshot(rows, snapshot_date)
    log(f"wrote {len(rows)} cards ({with_price} with a tcgplayer price) -> {out_path}")


if __name__ == "__main__":
    main()
