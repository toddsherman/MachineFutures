# Machine Futures

A responsive, data-driven prototype for publishing longitudinal forecasts from frontier AI models.

## Run locally

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Files

- `index.html` — public dashboard structure
- `styles.css` — responsive visual system
- `data.js` — questions, model runs, and long-term forecasts
- `app.js` — filtering, aggregation, details, and navigation
- `forecast-ingest_1.html` — existing internal batch ingestion utility
- `forecasting_prompt_v2.md` — 2030 benchmark prompt

The included forecasts are explicitly marked as illustrative. Replace the generated run data in `data.js` with parsed model outputs before publication.
