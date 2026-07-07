# Runs

Raw forecast batches exported by `forecast-ingest_1.html` — one JSON file per model, per date, per prompt family. Each file holds every raw sample plus the normalized aggregate (mean/median/min/max per question, with the rationale closest to the median).

Naming: `YYYY-MM-DD__<model-slug>__<track>.json` for the 2030 benchmark, with an `__end-states` suffix for the end-state family.

This directory is committed for provenance but never deployed (`vercel.json` restricts the Vercel output to `public/`). The website reads only `public/data.js`; updating it from these files is currently a manual step.
