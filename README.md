# Machine Futures

A responsive, data-driven site publishing what frontier AI models think humanity's relationship with AI will look like in 2030, 2040, 2050, 2060, and in the long-term year-3000 state.

For each horizon, every active model allocates exactly 100 percentage points across the same eleven mutually exclusive states, twenty times, at its own default settings. The site shows the median allocation per model, renormalized to integers summing to 100, the spread between models, and each model's reasoning per state. The long-term view remains the default.

## Public site

Only files inside `public/` are deployed by Vercel.

```bash
python3 -m http.server 4173 --directory public
```

Then open `http://localhost:4173`.

## Private authoring tool

`forecast-ingest_1.html` is an owner-only local utility for pasting long-term year-3000 model output by hand, kept for one-off runs and models without an API. Dated snapshots use the automated harness so their horizon provenance cannot be mislabeled. The utility lives outside `public/` and is excluded from production deployments. (It still understands the retired 2030 format as well.)

## Plan of record

For each model, horizon, and dataset date:

- Run the 11-end-state prompt 20 times. (Five samples left almost no pair of models separable on extinction-risk exposure; see `tools/analyse-agreement.mjs`.)
- Store the raw samples and a normalized aggregate per run in `runs/`.
- Use the median allocation as the value shown on the website, renormalized to integers summing to 100.
- Preserve min, max, sample count, and the rationale nearest the median so the site can show model instability and reasoning.

The site's headline forecast for the selected horizon is the coordinate-wise median across models, renormalized the same way. Eleven allocations that each sum to 100 need not have a median that does, so the aggregate is normalized once and the same vector drives the legend, the bar, the cards and the leader.

Extinction-risk exposure is the sum of the five extinction-risk medians, and the error quoted beneath that chart is bootstrapped from the model's own samples so it describes that estimator rather than the mean of per-sample totals. The two disagree enough to reorder the board, which is why `exposurePublished` exists alongside `exposure`.

The authoring path is `tools/run-elicitation.mjs --horizon <long-term|2030|2040|2050|2060>` -> horizon-tagged batch JSON in `runs/` -> `node tools/import-runs.mjs` -> `node tools/export-data.mjs` -> git push -> Vercel deploy. The importer rewrites the IMPORTED END-STATE RUNS block in `public/data.js` with each model's newest run inside each horizon and updates that horizon's dataset badge date and leader history.

Run identity always comes from the model id actually called, never the model's self-report — models are unreliable narrators about their own version. The self-report is stored as `model.self_reported_name` for interest.

The 50-question 2030 benchmark was retired in August 2026; its prompt and only real run are in `archive/`.

## Automated elicitation

`.github/workflows/elicit.yml` runs the selected prompt against every active model in `tools/models.json` — 20 samples per model and horizon at provider-default settings, no tools — then validates, aggregates, writes `runs/` batches, regenerates `public/data.js`, and pushes an `elicitation/<run-id>` branch. For a five-horizon sweep, each model's work is split across three ordered jobs of at most two horizons each; every wave waits for the preceding one, so the same model is never called concurrently and slow models do not force the entire roster through one runner. Open a PR from the generated branch and merge to publish via Vercel.

### Not losing the data

`runs/` is the irreplaceable half of this repository: `public/data.js` can be regenerated from it at any time, and it cannot be regenerated from anything. Elicitation costs real money, so the pipeline is built around never paying twice.

- **Every sample is checkpointed the moment it validates**, to `runs/.partial/<horizon-aware-run-id>.jsonl`. A run that dies partway keeps everything it had already bought.
- **The batches are uploaded as an artifact even when the run fails.** The elicitation step is `continue-on-error` with an `always()` upload, because one model running out of credit used to fail the step and skip the upload, discarding every batch already collected.
- **Re-dispatch with `resume_from_run_id`** to restore a previous run's combined artifact, including its immutable schema-v2 `.sweep-plan.json`: original elicitation date and sample target, the exact model key/API-id cohort, and—for every horizon—the prompt file, question set, target year, and SHA-256 of the exact runtime prompt after date substitution. You may select only the failed model/horizon work subset; completed work is not asked again, and half-finished batches resume from their checkpoint. Resume inputs cannot lower the original publication threshold or alter the frozen cohort.
- **Batches are never overwritten or mixed across horizons.** A second run on the same date writes `…__r2.json` beside the original. The importer prefers the newest date within each model and horizon, breaks ties on sample count, and refuses to publish a batch that would drop a model's sample count without `--force`.
- **Writes are atomic** (temp file plus rename), so a crash mid-write cannot leave truncated JSON.
- **Every batch carries a SHA-256 digest** of its samples. `tools/verify-runs.mjs` and the importer both check it, so a batch altered after it was written is caught rather than published. Batches predating this carry a backfilled digest, which attests to their content from that point on — not to their origin.
- **Publication requires a complete same-date sweep.** `tools/check-sweep.mjs` requires exactly the original plan's sample count for every frozen cohort model in every planned horizon on the original run date. It validates prompt provenance and recomputes every aggregate statistic from the samples, then judges the richest immutable revision using the same numeric revision ordering as the importer. Paused and historical extras may remain in storage; newly added roster models do not expand an existing plan. A planned key must still be active and map to its frozen API id before a resume can call it. A failed gate still preserves and pushes raw batches, but cannot regenerate or push site data; resume its artifact until the whole sweep passes. Older schema-v1 or unmanifested artifacts are upgraded once using the current cohort and rendered prompt identities; checkpoint-only artifacts retain the established 20-sample publication floor.

### When a call fails

Errors are sorted into three kinds, because the right response differs:

- **transient** — timeouts, dropped sockets, 429s, 5xx. Retried up to four times with exponential backoff and jitter, honouring `Retry-After`. Timeouts and dropped sockets carry no HTTP status and were previously not retried at all.
- **quota** — the provider says the account is out of money. Recognised across providers by body text as well as status, since OpenAI returns 429 for both "slow down" and "you're broke". The model stops immediately rather than spending eighteen minutes of backoff on a call that cannot succeed.
- **permanent** — a bad model id, a refusal, an unparseable answer. The attempt fails and the next sample is tried.

The attempt budget is `ceil(samples × 1.5) + 5`, and each model has a 100-minute wall-clock budget per horizon by default. Each model runs in its own isolated job in each ordered wave, so a slow provider cannot starve the rest of the roster.

### Knowing you have run out of credit

Three signals, in increasing order of how hard they are to miss:

1. The job summary on the run page: a per-model table of samples collected and failures by kind, with any billing message quoted in full.
2. Exit code 4 and a `quota_exhausted` step output, distinct from an ordinary failure.
3. A GitHub issue labelled `billing`, opened automatically — one at a time, not one a month — so it reaches your inbox rather than waiting in the Actions tab.

`.github/workflows/preflight.yml` also runs `--check` on the 25th of each month, a week before the paid sweep, and opens a `preflight` issue if any model is not callable. One cheap call per model, so a lapsed card is found before the run that needs it.

### Ongoing cadence

**Monthly, automatically.** The schedule runs on the 1st at 14:00 UTC, re-asking every active model for all five horizons: long term, 2030, 2040, 2050, and 2060. This produces five isolated longitudinal series using the same taxonomy and each horizon's versioned prompt. Gated on the repository variable `ELICITATION_ENABLED`; set it to anything other than `true` to pause.

**When a lab ships a new model**, three steps:

1. `--list` to see what the provider now serves (Actions → Run workflow → tick **list_models**, or `node tools/run-elicitation.mjs --list`). Models already on the roster are marked, so anything new stands out. Being *listed* does not mean it is callable — `gemini-2.5-pro` appears in Google's list but rejects inference on new accounts.
2. Add it to `tools/models.json` and preflight (**check_only**, or `--check`). One cheap call per model confirms the key is accepted and the id resolves.
3. Run a complete all-active sweep for the horizons you want to publish. A model-only dispatch is useful for collecting or testing the new entry, but its raw batch remains unpublished until the same-date artifact contains every active model; resume that artifact with the remaining model keys to complete it.

A model whose `keyEnv` is missing is skipped, so an unkeyed provider never breaks a run. That silence is the one hazard: a secret stored under the wrong name looks identical to a lab you chose not to key. The workflows therefore accept two aliases created by hand — `MINSTRAL_API_KEY` for Mistral and `KIMI_API_KEY` for Moonshot — alongside the canonical names. Rename the secrets and the aliases become dead weight worth deleting.

### The roster

Each lab fields two models — its current flagship and a second current model, usually the flagship it replaced — so the board answers one question consistently: does a lab's newer model see a different ending than its predecessor? Google is the exception; no older Pro is callable on new accounts, so its second entry is the newest Flash, a tier comparison rather than a generational one.

Runs are keyed by api model id, never by provider, which is what lets two models from the same lab sit side by side. Same-lab models share the lab's hue, darkened by roster position.

Adding a model is one entry in `tools/models.json` plus its key. Anything with an OpenAI-compatible endpoint needs no new code — set `api: "openai-compatible"` and its `baseUrl`. A new *provider* also wants a lab mark in `LAB_LOGOS` in `public/app.js` and a short label in `SHORT_LABELS` in `tools/import-runs.mjs`; models fall back to the first two letters of the provider name without them.

### Methodology guarantees encoded in the harness

- The selected prompt is read verbatim from `public/end_states.md`, `public/end_states_2030.md`, `public/end_states_2040.md`, `public/end_states_2050.md`, or `public/end_states_2060.md` between the PROMPT BEGINS/ENDS delimiters. The dated horizons use the same taxonomy but ask what is actually in place at year-end without a durability requirement.
- No fallback models are configured: a refusal or invalid response is recorded as a failed sample, never answered by a different model.
- Sampling parameters are omitted, so every provider runs at its own defaults.
- Run identity is the model id actually called. Models are unreliable narrators about their own version — one run had Gemini 3.1 Pro answer `gpt-4o` — so the self-report is stored as `model.self_reported_name` and never used as identity.

Local dry run: `node tools/run-elicitation.mjs --mock --horizon 2030`. Mock batches are written to `runs/.mock/` (gitignored) so a dry run can never overwrite a paid one.

## Tests

`npm run check` runs everything that needs no browser: the raw batches, the published data, the error classifier, and the harness. `npm run test:browser` runs the layout suite.

Three tiers, because the failures come in three kinds:

- **Data** — `verify-runs` and `check-site` assert that every sample is a valid allocation, every digest matches, and no published figure sits outside the spread it is drawn against.
- **Harness** — `test-harness` covers the failures that lose or duplicate paid data: a dry run must not touch a real batch, a rerun must not shrink one, a short batch must be topped up rather than re-bought, and a damaged file must be set aside rather than overwritten. Every one of those is a bug this repository shipped.
- **Layout** — `tests/site.spec.mjs` in Chromium and WebKit at three widths. This tier exists because a whole class of defect is invisible without a real engine: a band that draws at zero width, a `flex-basis` that becomes a height once the heading stacks, a media query that loses to a more specific selector, a heading that overflows only in the font iOS actually falls back to. The CI runner has none of the condensed faces the design asks for, so it renders the pessimistic fallback — which is the case that clipped headings on a phone.

The suite is checked by reintroducing each fixed bug and confirming it fails; a test that has never failed proves nothing.

## Repository structure

- `public/` — the complete deployable website
- `public/data.js` — the end-state taxonomy and imported forecasts
- `public/end_states.md` — long-term year-3000 prompt and taxonomy
- `public/end_states_2030.md`, `public/end_states_2040.md`, `public/end_states_2050.md`, `public/end_states_2060.md` — year-end snapshot prompts using the same taxonomy
- `forecast-ingest_1.html` — private local ingestion utility
- `runs/` — raw sample batches + aggregates exported by the ingester (committed, never deployed)
- `tools/import-runs.mjs` — imports `runs/*.json` into `public/data.js`
- `tools/run-elicitation.mjs` — automated end-state elicitation harness (used by the workflow)
- `tools/models.json` — model roster: provider, API adapter, model id, key env var
- `data/` — generated, downloadable copy of everything published (CSV + JSON)
- `tools/export-data.mjs` — rebuilds `data/` from `public/data.js` and `runs/`
- `tools/check-site.mjs` — invariant check on `public/data.js`, run in CI after import
- `tools/verify-runs.mjs` — integrity check on the raw batches in `runs/` (`--backfill-integrity` to add digests to older files)
- `tools/check-sweep.mjs` — immutable same-date, frozen-cohort completeness gate used before generated site data may publish
- `tools/check-links.mjs` — fetches every published link signed-out, so a page that only works for its author fails CI
- `tools/test-classify.mjs` — asserts the harness sorts provider errors into transient / quota / permanent correctly
- `tools/test-harness.mjs` — behaviour tests for the elicitation harness, run against `--mock` so they cost nothing
- `tests/site.spec.mjs` — layout and behaviour tests in a real browser
- `.github/workflows/ci.yml` — parses the app, verifies `runs/`, and checks that `public/data.js` is reproducible from it
- `.github/workflows/preflight.yml` — monthly key-and-model canary ahead of the paid sweep
- `.github/workflows/elicit.yml` — scheduled/manual elicitation → PR pipeline
- `archive/` — the retired 2030 benchmark prompt and its one real run
- `vercel.json` — restricts Vercel output to `public/`
