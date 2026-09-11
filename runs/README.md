# Runs

Raw forecast batches written by [`tools/run-elicitation.mjs`](../tools/run-elicitation.mjs), or long-term batches exported by [`tools/manual-ingest.html`](../tools/manual-ingest.html) for models without an API — one JSON file per model, date, prompt family, and horizon. Dated snapshots always use the automated harness so their horizon provenance is explicit. Each file holds every raw sample plus the normalized aggregate (mean/median/min/max per question, with the rationale closest to the median).

Naming: the legacy long-term family uses `YYYY-MM-DD__<model-slug>__closed_book__end-states.json`; dated snapshots add the horizon, as in `…__end-states-2030.json`, `…__end-states-2040.json`, `…__end-states-2050.json`, and `…__end-states-2060.json`. The retired 50-question 2030 benchmark is kept separately in `archive/` and is never imported into these datasets.

This directory is committed for provenance but never deployed ([`vercel.json`](../vercel.json) restricts the Vercel output to `public/`). The website reads only [`public/data.js`](../public/data.js). Regenerate it with `npm run data:import`, which the elicitation workflow runs automatically; `node tools/check-site.mjs` then verifies the result.

A compatible incomplete batch may be extended in place so already-paid samples are retained. Completed or incompatible same-date batches are never overwritten: another run is written as `…__r2.json` beside the first. The importer prefers the newest date within each model and horizon, breaking ties on sample count. New batches carry explicit `horizon`, `target_year`, and `question_set` provenance plus a SHA-256 digest of their samples; legacy batches without horizon metadata are treated as long term. `node tools/verify-runs.mjs` checks every file and CI runs it on every push.

`runs/.partial/` holds per-sample checkpoints for a run in flight. It is gitignored but travels in the workflow artifact, which is what lets a re-dispatch resume instead of paying again.

See [Operations](../docs/OPERATIONS.md) for recovery and publication, or the [data dictionary](../data/README.md) for the generated tables built from these batches.
