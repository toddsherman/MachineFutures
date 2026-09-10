# Runs

Raw forecast batches written by `tools/run-elicitation.mjs`, or exported by `forecast-ingest_1.html` for models without an API — one JSON file per model, date, prompt family, and horizon. Each file holds every raw sample plus the normalized aggregate (mean/median/min/max per question, with the rationale closest to the median).

Naming: the legacy long-term family uses `YYYY-MM-DD__<model-slug>__closed_book__end-states.json`; dated snapshots add the horizon, as in `…__end-states-2030.json` and `…__end-states-2040.json`. The retired 50-question 2030 benchmark is kept separately in `archive/` and is never imported into these datasets.

This directory is committed for provenance but never deployed (`vercel.json` restricts the Vercel output to `public/`). The website reads only `public/data.js`. Regenerate it with `node tools/import-runs.mjs`, which the elicitation workflow runs automatically; `node tools/check-site.mjs` then verifies the result.

Batches are never overwritten: a second run on the same date and horizon is written as `…__r2.json` beside the first, and the importer prefers the newest date within each model and horizon, breaking ties on sample count. New batches carry explicit `horizon`, `target_year`, and `question_set` provenance plus a SHA-256 digest of their samples; legacy batches without horizon metadata are treated as long term. `node tools/verify-runs.mjs` checks every file and CI runs it on every push.

`runs/.partial/` holds per-sample checkpoints for a run in flight. It is gitignored but travels in the workflow artifact, which is what lets a re-dispatch resume instead of paying again.
