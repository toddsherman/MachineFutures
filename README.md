# Machine Futures

A responsive, data-driven site publishing what frontier AI models think about the long-run end state of humanity's relationship with AI.

Each model allocates exactly 100 percentage points across eleven mutually exclusive end states, twenty times, at its own default settings. The site shows the median allocation per model, renormalized to integers summing to 100, the spread between models, and each model's reasoning per state.

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

- Run the 11-end-state prompt 20 times. (Five samples left almost no pair of models separable on extinction-risk exposure; see `tools/analyse-agreement.mjs`.)
- Store the raw samples and a normalized aggregate per run in `runs/`.
- Use the median allocation as the value shown on the website, renormalized to integers summing to 100.
- Preserve min, max, sample count, and the rationale nearest the median so the site can show model instability and reasoning.

The site's headline "median machine forecast" is the coordinate-wise median across models, renormalized the same way. Eleven allocations that each sum to 100 need not have a median that does — as published they sum to 99 — so the aggregate is normalized once and the same vector drives the legend, the bar, the cards and the leader.

Extinction-risk exposure is the sum of the five extinction-risk medians, and the error quoted beneath that chart is bootstrapped from the model's own samples so it describes that estimator rather than the mean of per-sample totals. The two disagree enough to reorder the board, which is why `exposurePublished` exists alongside `exposure`.

The authoring path is `tools/run-elicitation.mjs` (or the local ingester for manual runs) -> batch JSON in `runs/` -> `node tools/import-runs.mjs` -> `node tools/export-data.mjs` -> git push -> Vercel deploy. The importer rewrites the IMPORTED END-STATE RUNS block in `public/data.js` with each provider's newest run and updates the dataset badge date.

Run identity always comes from the model id actually called, never the model's self-report — models are unreliable narrators about their own version. The self-report is stored as `model.self_reported_name` for interest.

The 50-question 2030 benchmark was retired in August 2026; its prompt and only real run are in `archive/`.

## Automated elicitation

`.github/workflows/elicit.yml` runs the end-state prompt against every model in `tools/models.json` — 20 samples each at provider-default settings, no tools — then validates, aggregates, writes `runs/` batches, regenerates `public/data.js`, and pushes an `elicitation/<run-id>` branch. Open a PR from that branch and merge to publish via Vercel.

### Not losing the data

`runs/` is the irreplaceable half of this repository: `public/data.js` can be regenerated from it at any time, and it cannot be regenerated from anything. Elicitation costs real money, so the pipeline is built around never paying twice.

- **Every sample is checkpointed the moment it validates**, to `runs/.partial/<run-id>.jsonl`. A run that dies partway keeps everything it had already bought.
- **The batches are uploaded as an artifact even when the run fails.** The elicitation step is `continue-on-error` with an `always()` upload, because one model running out of credit used to fail the step and skip the upload, discarding every batch already collected.
- **Re-dispatch with `resume_from_run_id`** to restore a previous run's batches and checkpoints. Models that already finished are not asked again, and half-finished models resume from their checkpoint — a re-run pays for the shortfall, not the sweep.
- **Batches are never overwritten.** A second run on the same date writes `…__r2.json` beside the original. The importer prefers the newest date, breaks ties on sample count, and refuses to publish a batch that would drop a model's sample count without `--force`.
- **Writes are atomic** (temp file plus rename), so a crash mid-write cannot leave truncated JSON.
- **Every batch carries a SHA-256 digest** of its samples. `tools/verify-runs.mjs` and the importer both check it, so a batch altered after it was written is caught rather than published. Batches predating this carry a backfilled digest, which attests to their content from that point on — not to their origin.

### When a call fails

Errors are sorted into three kinds, because the right response differs:

- **transient** — timeouts, dropped sockets, 429s, 5xx. Retried up to four times with exponential backoff and jitter, honouring `Retry-After`. Timeouts and dropped sockets carry no HTTP status and were previously not retried at all.
- **quota** — the provider says the account is out of money. Recognised across providers by body text as well as status, since OpenAI returns 429 for both "slow down" and "you're broke". The model stops immediately rather than spending eighteen minutes of backoff on a call that cannot succeed.
- **permanent** — a bad model id, a refusal, an unparseable answer. The attempt fails and the next sample is tried.

The attempt budget is `ceil(samples × 1.5) + 5`, and each model has a 45-minute wall-clock budget so one sick provider cannot starve the models after it.

### Knowing you have run out of credit

Three signals, in increasing order of how hard they are to miss:

1. The job summary on the run page: a per-model table of samples collected and failures by kind, with any billing message quoted in full.
2. Exit code 4 and a `quota_exhausted` step output, distinct from an ordinary failure.
3. A GitHub issue labelled `billing`, opened automatically — one at a time, not one a month — so it reaches your inbox rather than waiting in the Actions tab.

`.github/workflows/preflight.yml` also runs `--check` on the 25th of each month, a week before the paid sweep, and opens a `preflight` issue if any model is not callable. One cheap call per model, so a lapsed card is found before the run that needs it.

### Ongoing cadence

**Monthly, automatically.** The schedule runs on the 1st at 14:00 UTC, re-asking every model on the roster. This is the longitudinal series: the same question, the same prompt version, the same models over time. Gated on the repository variable `ELICITATION_ENABLED`; set it to anything other than `true` to pause.

**When a lab ships a new model**, three steps:

1. `--list` to see what the provider now serves (Actions → Run workflow → tick **list_models**, or `node tools/run-elicitation.mjs --list`). Models already on the roster are marked, so anything new stands out. Being *listed* does not mean it is callable — `gemini-2.5-pro` appears in Google's list but rejects inference on new accounts.
2. Add it to `tools/models.json` and preflight (**check_only**, or `--check`). One cheap call per model confirms the key is accepted and the id resolves.
3. Elicit just the new entry: Run workflow with `models: <its key>`. Existing models keep their earlier run and date until the next monthly sweep.

A model whose `keyEnv` is missing is skipped, so an unkeyed provider never breaks a run. That silence is the one hazard: a secret stored under the wrong name looks identical to a lab you chose not to key. The workflows therefore accept two aliases created by hand — `MINSTRAL_API_KEY` for Mistral and `KIMI_API_KEY` for Moonshot — alongside the canonical names. Rename the secrets and the aliases become dead weight worth deleting.

### The roster

Each lab fields two models — its current flagship and a second current model, usually the flagship it replaced — so the board answers one question consistently: does a lab's newer model see a different ending than its predecessor? Google is the exception; no older Pro is callable on new accounts, so its second entry is the newest Flash, a tier comparison rather than a generational one.

Runs are keyed by api model id, never by provider, which is what lets two models from the same lab sit side by side. Same-lab models share the lab's hue, darkened by roster position.

Adding a model is one entry in `tools/models.json` plus its key. Anything with an OpenAI-compatible endpoint needs no new code — set `api: "openai-compatible"` and its `baseUrl`. A new *provider* also wants a lab mark in `LAB_LOGOS` in `public/app.js` and a short label in `SHORT_LABELS` in `tools/import-runs.mjs`; models fall back to the first two letters of the provider name without them.

### Methodology guarantees encoded in the harness

- The prompt is read verbatim from `public/end_states.md` between the PROMPT BEGINS/ENDS delimiters.
- No fallback models are configured: a refusal or invalid response is recorded as a failed sample, never answered by a different model.
- Sampling parameters are omitted, so every provider runs at its own defaults.
- Run identity is the model id actually called. Models are unreliable narrators about their own version — one run had Gemini 3.1 Pro answer `gpt-4o` — so the self-report is stored as `model.self_reported_name` and never used as identity.

Local dry run: `node tools/run-elicitation.mjs --mock`. Mock batches are written to `runs/.mock/` (gitignored) so a dry run can never overwrite a paid one.

## Repository structure

- `public/` — the complete deployable website
- `public/data.js` — the end-state taxonomy and imported forecasts
- `public/end_states.md` — 11-end-state prompt and taxonomy
- `forecast-ingest_1.html` — private local ingestion utility
- `runs/` — raw sample batches + aggregates exported by the ingester (committed, never deployed)
- `tools/import-runs.mjs` — imports `runs/*.json` into `public/data.js`
- `tools/run-elicitation.mjs` — automated end-state elicitation harness (used by the workflow)
- `tools/models.json` — model roster: provider, API adapter, model id, key env var
- `data/` — generated, downloadable copy of everything published (CSV + JSON)
- `tools/export-data.mjs` — rebuilds `data/` from `public/data.js` and `runs/`
- `tools/check-site.mjs` — invariant check on `public/data.js`, run in CI after import
- `tools/verify-runs.mjs` — integrity check on the raw batches in `runs/` (`--backfill-integrity` to add digests to older files)
- `tools/test-classify.mjs` — asserts the harness sorts provider errors into transient / quota / permanent correctly
- `.github/workflows/ci.yml` — parses the app, verifies `runs/`, and checks that `public/data.js` is reproducible from it
- `.github/workflows/preflight.yml` — monthly key-and-model canary ahead of the paid sweep
- `.github/workflows/elicit.yml` — scheduled/manual elicitation → PR pipeline
- `archive/` — the retired 2030 benchmark prompt and its one real run
- `vercel.json` — restricts Vercel output to `public/`

