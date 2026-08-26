# Runs

Raw forecast batches written by `tools/run-elicitation.mjs`, or exported by `forecast-ingest_1.html` for models without an API — one JSON file per model, per date, per prompt family. Each file holds every raw sample plus the normalized aggregate (mean/median/min/max per question, with the rationale closest to the median).

Naming: `YYYY-MM-DD__<model-slug>__<track>.json` for the 2030 benchmark, with an `__end-states` suffix for the end-state family.

This directory is committed for provenance but never deployed (`vercel.json` restricts the Vercel output to `public/`). The website reads only `public/data.js`. Regenerate it with `node tools/import-runs.mjs`, which the elicitation workflow runs automatically; `node tools/check-site.mjs` then verifies the result.

Batches are never overwritten: a second run on the same date is written as `…__r2.json` beside the first, and the importer prefers the newest date, breaking ties on sample count. Each batch carries a SHA-256 digest of its samples; `node tools/verify-runs.mjs` checks every file and CI runs it on every push.

`runs/.partial/` holds per-sample checkpoints for a run in flight. It is gitignored but travels in the workflow artifact, which is what lets a re-dispatch resume instead of paying again.
