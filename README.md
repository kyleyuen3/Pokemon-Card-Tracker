# Pokemon Card Valuation Project

## What's in here

- **pokemon-valuations/** — the actual website. Open this folder in VS Code.
  Run `npm install` then `npm run dev` inside it to view the app.

- **data-pipeline/** — fetches prices and builds the data the website uses.
  Not part of the site itself; this is what actually tracks the market.

## Prices update automatically, every day

A GitHub Actions workflow (`.github/workflows/daily_price_update.yml`) runs
once a day, for every official Pokemon set:

1. `fetch_prices.py` pulls the current TCGplayer market price (and Cardmarket
   EUR trend price where available) for every card from the free
   [pokemontcg.io](https://pokemontcg.io) API, and appends it as a new dated
   snapshot in `data-pipeline/history/` — this is the actual price *history*.
2. `build_dataset.py` turns that accumulated history into
   `pokemon-valuations/public/cards_data.json`: today's price, 7-day/30-day
   % change, a short trend sparkline, and the same fair-value regression the
   original pipeline used.
3. The workflow commits the updated data straight back to the repo.

If the site is deployed on Vercel with this GitHub repo connected, that daily
commit alone triggers a redeploy — no manual step needed. Nothing runs on
your own machine.

**One-time setup after this lands on `main`:** open the repo's Actions tab →
"Daily Pokemon card price update" → **Run workflow** once, so there's data
to look at instead of waiting for the next scheduled run. After that it just
runs on its own, daily.

**Optional:** add a `POKEMONTCG_API_KEY` repo secret (free signup at
pokemontcg.io) for a higher, more reliable rate limit. Not required — the
full card catalog fits well within the no-key daily quota.

Trend fields (7d/30d change, sparkline) fill in gradually as daily history
accumulates — on day one there's nothing to compare against yet.

## To run the website locally

```
cd pokemon-valuations
npm install
npm run dev
```

Then open the localhost URL it prints.

## To run the data pipeline by hand

```
cd data-pipeline
pip install -r requirements.txt
python3 fetch_prices.py    # pulls today's prices, appends to history/
python3 build_dataset.py   # rebuilds pokemon-valuations/public/cards_data.json
```

Refresh the browser tab (or restart `npm run dev` if it's not already
running) to see the update.

## Hand-tuning specific cards

`data-pipeline/popularity_overrides.csv` still works exactly as before — add
a `name,popularity` row for any chase card you want to hand-tune in the
fair-value model. See `data-pipeline/HOW_TO_ADD_A_SET.md` for the older,
fully-manual CSV workflow (only still useful for sourcing things the API
doesn't have, like verified pull-odds).
