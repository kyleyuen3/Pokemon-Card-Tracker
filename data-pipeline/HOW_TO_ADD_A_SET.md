# Adding a new set

You never need to open VS Code's "new project" flow again, and you never need
to edit App.jsx or the Python script. Just:

## 1. Get the new set's raw data

Ask Claude for a new set (e.g. "pull Black Bolt in the same raw CSV format").
You'll get a file back named like `black_bolt_raw.csv` with columns:

```
number,name,rarity,type,hp,price
```

## 2. Drop it into the folder

Put the file straight into `data-pipeline/sets/`. That's it -- no renaming,
no editing. The filename becomes the set's display name automatically:
`black_bolt_raw.csv` -> shows up in the app as "Black Bolt".

(Optional) If you also get a `black_bolt_ebay.csv` for a second price source,
drop that in the same folder too -- same base name, `_ebay.csv` instead of
`_raw.csv`.

## 3. Regenerate the data

Open a terminal in `data-pipeline/` and run:

```
python3 build_model_multiset.py
```

(First time only: `pip install pandas scikit-learn` if you don't have them.)

This automatically finds every `*_raw.csv` in `sets/`, rebuilds the whole
model, and writes the result straight into
`pokemon-valuations/public/cards_data.json` -- no copying files by hand.

## 4. See it

If `npm run dev` is already running in `pokemon-valuations/`, just refresh
the browser tab. If it's not running, `cd pokemon-valuations && npm run dev`.

The new set will already show up as a filter chip -- the app reads whatever
sets exist in the data file, so that part needs no code changes either.

## Optional: tune popularity for specific cards

By default every card gets a neutral popularity score of 3.0 in the fair-value
model. If you want to hand-tune specific chase cards (like we did for
Umbreon ex, Team Rocket's Mewtwo ex, etc.), add rows to
`popularity_overrides.csv`:

```
name,popularity
Some New Chase Card ex,8.5
```

This applies across all sets by card name.

## What you can't self-serve

- **Pull cost** (the "packs needed to pull this specific card" column) is only
  populated for Prismatic Evolutions right now, because that's the only set
  where a verified specific-pull-odds number was actually sourced (TCGplayer
  Authentication Center data). Adding a new set won't automatically get this
  column -- ask Claude to source real pull-rate data for it specifically if
  you want that filled in, rather than guessing.
- Same story for the eBay/PriceCharting cross-check price -- ask for that to
  be pulled per set if you want it.
