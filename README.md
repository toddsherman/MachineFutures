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

### Ongoing cadence

**Monthly, automatically.** The schedule runs on the 1st at 14:00 UTC, re-asking every model on the roster. This is the longitudinal series: the same question, the same prompt version, the same models over time. Gated on the repository variable `ELICITATION_ENABLED`; set it to anything other than `true` to pause.

**When a lab ships a new model**, three steps:

1. `--list` to see what the provider now serves (Actions → Run workflow → tick **list_models**, or `node tools/run-elicitation.mjs --list`). Models already on the roster are marked, so anything new stands out. Being *listed* does not mean it is callable — `gemini-2.5-pro` appears in Google's list but rejects inference on new accounts.
2. Add it to `tools/models.json` and preflight (**check_only**, or `--check`). One cheap call per model confirms the key is accepted and the id resolves.
3. Elicit just the new entry: Run workflow with `models: <its key>`. Existing models keep their earlier run and date until the next monthly sweep.

A model whose `keyEnv` is missing is skipped, so an unkeyed provider never breaks a run.

### The roster

Each lab fields two models — its current flagship and a second current model, usually the flagship it replaced — so the board answers one question consistently: does a lab's newer model see a different ending than its predecessor? Google is the exception; no older Pro is callable on new accounts, so its second entry is the newest Flash, a tier comparison rather than a generational one.

Runs are keyed by api model id, never by provider, which is what lets two models from the same lab sit side by side. Same-lab models share the lab's hue, darkened by roster position.

Adding a model is one entry in `tools/models.json` plus its key. Anything with an OpenAI-compatible endpoint needs no new code — set `api: "openai-compatible"` and its `baseUrl`. A new *provider* also wants a colour in `tools/import-runs.mjs` (`PROVIDER_COLORS`).

### Methodology guarantees encoded in the harness

- The prompt is read verbatim from `public/end_states.md` between the PROMPT BEGINS/ENDS delimiters.
- No fallback models are configured: a refusal or invalid response is recorded as a failed sample, never answered by a different model.
- Sampling parameters are omitted, so every provider runs at its own defaults.
- Run identity is the model id actually called. Models are unreliable narrators about their own version — one run had Gemini 3.1 Pro answer `gpt-4o` — so the self-report is stored as `model.self_reported_name` and never used as identity.

Local dry run: `node tools/run-elicitation.mjs --mock`.

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

