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

The authoring path is model output -> local ingester -> batch JSON in `runs/` -> `node tools/import-runs.mjs` -> git push -> Vercel deploy. The importer rewrites the IMPORTED RUNS and IMPORTED END-STATE RUNS blocks in `public/data.js` from every batch in `runs/`; imported runs replace the synthetic placeholder runs (2030) or hand-entered forecasts (end states) for their provider.

## Automated elicitation

`.github/workflows/elicit.yml` runs the end-state prompt against every model in `tools/models.json` — 5 samples each at provider-default settings, no tools — then validates, aggregates, writes `runs/` batches, regenerates `public/data.js`, and opens a pull request. Merging the PR publishes via Vercel.

Setup, in the GitHub repo settings:

1. Add API-key secrets (Settings → Secrets and variables → Actions → Secrets): `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`, `DEEPSEEK_API_KEY`. Models whose key is missing are skipped, so partial rosters work.
2. Verify the `model` ids in `tools/models.json` against each provider's current docs (only Anthropic's is confirmed).
3. Enable "Allow GitHub Actions to create and approve pull requests" (Settings → Actions → General).
4. To turn on the monthly schedule (1st of each month), add a repository variable `ELICITATION_ENABLED` = `true`. Until then, trigger runs manually from the Actions tab (workflow_dispatch, with optional model filter).

Methodology guarantees encoded in the harness: the prompt is read verbatim from `public/end_states.md` between the PROMPT BEGINS/ENDS delimiters; no fallback models are configured, so a refusal or invalid response is recorded as a failed sample rather than answered by a different model; sampling parameters are omitted so every provider runs at its own defaults; the exact `api_string` is recorded per run. Local dry run: `node tools/run-elicitation.mjs --mock`.

## Repository structure

- `public/` — the complete deployable website
- `public/data.js` — questions, model runs, and long-term forecasts
- `public/end_states.md` — 11-end-state prompt and taxonomy
- `public/forecasting_prompt.md` — 50-question 2030 benchmark prompt
- `forecast-ingest_1.html` — private local ingestion utility
- `runs/` — raw sample batches + aggregates exported by the ingester (committed, never deployed)
- `tools/import-runs.mjs` — imports `runs/*.json` into `public/data.js`
- `tools/run-elicitation.mjs` — automated end-state elicitation harness (used by the workflow)
- `tools/models.json` — model roster: provider, API adapter, model id, key env var
- `.github/workflows/elicit.yml` — scheduled/manual elicitation → PR pipeline
- `vercel.json` — restricts Vercel output to `public/`

The included forecasts are explicitly marked as illustrative. Replace the generated run data in `public/data.js` with parsed model outputs before publication.
