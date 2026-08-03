# Prismatic Evolutions — Valuation Browser (React)

A sortable/filterable browser for the fair-value model built on the Prismatic Evolutions set.

## Run it locally

```
npm install
npm run dev
```

Then open the URL it prints (usually http://localhost:5173).

## Deploy to Vercel

1. Push this folder to a GitHub repo
2. Go to vercel.com → New Project → import that repo
3. Vercel auto-detects Vite + React, no config needed — click Deploy
4. You'll get a live `.vercel.app` URL

## Update the data

Regenerate `public/cards_data.json` from `build_model.py`'s output CSV whenever
you refresh prices, then just refresh the page (or redeploy).

## Structure

- `src/App.jsx` — the whole app: filters, sorting, table
- `src/index.css` — styling (rarity color chips, verdict badges, etc.)
- `public/cards_data.json` — the dataset, fetched at runtime
