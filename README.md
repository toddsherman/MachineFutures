# Machine Futures

A responsive, data-driven site publishing what frontier AI models think about the long-run end state of humanity's relationship with AI.

Each model allocates exactly 100 percentage points across eleven mutually exclusive end states, five times, at its own default settings. The site shows the median allocation per model, the spread between models, and each model's reasoning per state.

## Public site

Only files inside `public/` are deployed by Vercel.

```bash
python3 -m http.server 4173 --directory public
```

Then open `http://localhost:4173`.

## Private authoring tool

`forecast-ingest_1.html` is an owner-only local utility for pasting model output by hand, kept for one-off runs and models without an API. It lives outside `public/` and is excluded from production deployments. (It still understands the retired 2030 format as well.)

## Plan of record

For each model on each dataset date:

- Run the 11-end-state prompt 5 times.
- Store the raw samples and a normalized aggregate per run in `runs/`.
- Use the median allocation as the value shown on the website, renormalized to integers summing to 100.
- Preserve min, max, sample count, and the rationale nearest the median so the site can show model instability and reasoning.

The authoring path is `tools/run-elicitation.mjs` (or the local ingester for manual runs) -> batch JSON in `runs/` -> `node tools/import-runs.mjs` -> git push -> Vercel deploy. The importer rewrites the IMPORTED END-STATE RUNS block in `public/data.js` with each provider's newest run and updates the dataset badge date.

Run identity always comes from the model id actually called, never the model's self-report — models are unreliable narrators about their own version. The self-report is stored as `model.self_reported_name` for interest.

The 50-question 2030 benchmark was retired in August 2026; its prompt and only real run are in `archive/`.

## Automated elicitation

`.github/workflows/elicit.yml` runs the end-state prompt against every model in `tools/models.json` — 5 samples each at provider-default settings, no tools — then validates, aggregates, writes `runs/` batches, regenerates `public/data.js`, and pushes an `elicitation/<run-id>` branch. Open a PR from that branch and merge to publish via Vercel.

The raw batches are also uploaded as a workflow artifact immediately after elicitation, before any step that could fail — a paid run is never lost to a downstream error.

Setup, in the GitHub repo settings:

1. Add API-key secrets (Settings → Secrets and variables → Actions → Secrets), one per provider you want on the board: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`, `META_API_KEY`, `DEEPSEEK_API_KEY`, `MISTRAL_API_KEY`, `MOONSHOT_API_KEY`. **Models whose key is missing are skipped**, so the keys you configure decide the roster.
2. Run the preflight before the first real run: Actions → Elicit end-state forecasts → Run workflow with **check_only** ticked. It makes one cheap call per model and reports, per provider, whether the key works and the model id resolves. Fix anything it flags in `tools/models.json`, then run for real. Locally: `node tools/run-elicitation.mjs --check`.
3. To turn on the monthly schedule (1st of each month), add a repository variable `ELICITATION_ENABLED` = `true`. Until then, trigger runs manually (optionally filtered with `models`, e.g. `anthropic,google`).

Adding a model is one entry in `tools/models.json` plus its key. Anything with an OpenAI-compatible endpoint needs no new code — set `api: "openai-compatible"` and its `baseUrl`. New *providers* also want a color and short label in `tools/import-runs.mjs` (`PROVIDER_COLORS`, `SHORT_LABELS`), or they render in the fallback color.

Methodology guarantees encoded in the harness: the prompt is read verbatim from `public/end_states.md` between the PROMPT BEGINS/ENDS delimiters; no fallback models are configured, so a refusal or invalid response is recorded as a failed sample rather than answered by a different model; sampling parameters are omitted so every provider runs at its own defaults; the exact `api_string` is recorded per run. Local dry run: `node tools/run-elicitation.mjs --mock`.

## Repository structure

- `public/` — the complete deployable website
- `public/data.js` — the end-state taxonomy and imported forecasts
- `public/end_states.md` — 11-end-state prompt and taxonomy
- `forecast-ingest_1.html` — private local ingestion utility
- `runs/` — raw sample batches + aggregates exported by the ingester (committed, never deployed)
- `tools/import-runs.mjs` — imports `runs/*.json` into `public/data.js`
- `tools/run-elicitation.mjs` — automated end-state elicitation harness (used by the workflow)
- `tools/models.json` — model roster: provider, API adapter, model id, key env var
- `.github/workflows/elicit.yml` — scheduled/manual elicitation → PR pipeline
- `archive/` — the retired 2030 benchmark prompt and its one real run
- `vercel.json` — restricts Vercel output to `public/`

