# Machine Futures

A responsive, data-driven site for publishing longitudinal forecasts from frontier AI models.

## Public site

Only files inside `public/` are deployed by Vercel.

```bash
python3 -m http.server 4173 --directory public
```

Then open `http://localhost:4173`.

## Private authoring tool

`forecast-ingest_1.html` is an owner-only local utility. It lives outside `public/` and is therefore excluded from production deployments. Open it locally to validate model JSON, aggregate repeated samples, and download normalized data.

## Plan of record

The 2030 benchmark and the 11 end-state taxonomy are run as separate prompts because they ask for different forecasting modes.

For each model on each dataset date:

- Run the 50-question 2030 benchmark prompt 5 times.
- Run the 11-end-state prompt 5 times.
- Store the raw samples and a normalized aggregate for each prompt family.
- Use the median aggregate as the default value shown on the website.
- Preserve min, max, sample count, and representative rationale text so the site can show model instability or spread over time.

The current authoring path is model output -> local ingester/exported JSON -> `public/data.js` -> git push -> Vercel deploy. Until an automated importer exists, update `public/data.js` from the normalized aggregate files.

## Repository structure

- `public/` — the complete deployable website
- `public/data.js` — questions, model runs, and long-term forecasts
- `public/end_states.md` — 11-end-state prompt and taxonomy
- `public/forecasting_prompt.md` — 50-question 2030 benchmark prompt
- `forecast-ingest_1.html` — private local ingestion utility
- `runs/` — raw sample batches + aggregates exported by the ingester (committed, never deployed)
- `vercel.json` — restricts Vercel output to `public/`

The included forecasts are explicitly marked as illustrative. Replace the generated run data in `public/data.js` with parsed model outputs before publication.
