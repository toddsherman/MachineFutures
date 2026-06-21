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

## Repository structure

- `public/` — the complete deployable website
- `public/data.js` — questions, model runs, and long-term forecasts
- `forecast-ingest_1.html` — private local ingestion utility
- `vercel.json` — restricts Vercel output to `public/`

The included forecasts are explicitly marked as illustrative. Replace the generated run data in `public/data.js` with parsed model outputs before publication.
