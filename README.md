# Pokemon Card Valuation Project

## What's in here

- **pokemon-valuations/** — the actual website. Open this folder in VS Code.
  Run `npm install` then `npm run dev` inside it to view the app.

- **data-pipeline/** — the Python script and source CSVs that produced the
  data the website uses. Not part of the site itself; this is what you'd
  edit/rerun if you want to refresh prices or add another set later.

## To run the website

```
cd pokemon-valuations
npm install
npm run dev
```

Then open the localhost URL it prints.

## To update the data later

1. Edit or add CSVs in `data-pipeline/`
2. Run `python3 build_model_multiset.py` inside `data-pipeline/` (needs
   `pip install pandas scikit-learn`)
3. Copy the resulting `all_sets_valuations.csv` output into JSON and drop it
   into `pokemon-valuations/public/cards_data.json`
4. Refresh the browser tab (or restart `npm run dev` if it's not already running)
