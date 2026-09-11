# Operations

[Back to the repository overview](../README.md)

## Automation schedule

| Workflow | Schedule | Purpose |
| --- | --- | --- |
| [`preflight.yml`](../.github/workflows/preflight.yml) | 25th of each month, 13:00 UTC | Make one inexpensive call per active model to catch missing credit, expired keys, and provider-withdrawn model ids before the paid sweep |
| [`elicit.yml`](../.github/workflows/elicit.yml) | 1st of each month, 14:00 UTC | Re-ask every active model for all five horizons, validate the sweep, rebuild outputs, and push an elicitation branch |
| [`watch-models.yml`](../.github/workflows/watch-models.yml) | Mondays, 13:00 UTC | Compare provider catalogs with the roster and update one tracking issue when new models appear |
| [`ci.yml`](../.github/workflows/ci.yml) | Every push and pull request | Verify raw evidence, reproduce published data, and run browser behavior and layout tests |

Scheduled elicitation runs only when the repository variable `ELICITATION_ENABLED` is exactly `true`.

## Publication path

The normal path is:

```text
elicit workflow
  → horizon-tagged batches in runs/
  → complete same-date sweep gate
  → npm run data:rebuild
  → elicitation/<run-id> branch
  → operator opens and reviews a pull request
  → merge to main
  → Vercel production deployment
```

Before merging a data refresh, confirm:

- Every planned active model and horizon reached the frozen sample target.
- Every published model has the intended provider/lab grouping, and the aggregate's lab and model counts match the cohort.
- `npm run check` passes.
- `npm run data:rebuild` leaves no unexpected diff beyond the intended generated outputs.
- The pull request contains raw batches as well as the site and download exports.
- Prompt and question-set provenance match the immutable sweep plan.

Merged pull-request branches are deleted automatically. Failed or incomplete elicitation branches should remain until their paid samples have been resumed into a complete sweep or otherwise reconciled with `main`.

For a five-horizon sweep, each model runs in three globally ordered waves of at most two horizons. A wave waits for the previous wave, so the same model is never called concurrently and one slow provider does not force the whole roster through a single runner.

## Protecting paid samples

`runs/` is the irreplaceable half of the repository. The workflow uses several safeguards:

- Each valid sample is immediately checkpointed to `runs/.partial/<horizon-aware-run-id>.jsonl`.
- Batches and checkpoints upload as an artifact even when elicitation fails.
- Writes use a temporary file plus rename, preventing truncated batches.
- A compatible incomplete batch may be extended in place so already-paid samples are retained. Completed or incompatible same-date batches are never overwritten; another run writes an immutable `__r2`, `__r3`, and so on.
- Every finalized batch carries a SHA-256 digest over its samples.
- The importer refuses to replace a richer batch with a smaller one unless explicitly forced.
- Publication requires the complete same-date cohort and exact prompt provenance stored in the sweep plan.

Artifacts are retained for 90 days. The generated branch is therefore a second durable copy and should not be deleted merely because its sweep was incomplete.

## Resuming an incomplete sweep

Re-dispatch the elicitation workflow with `resume_from_run_id` set to the original GitHub Actions run id. The workflow restores the combined artifact and its immutable schema-v2 sweep plan, including:

- Original elicitation date and sample target
- Frozen model keys and exact API ids
- Planned horizons
- Prompt paths, question-set ids, target years, and rendered-prompt hashes

You may select only the failed model/horizon subset. Completed batches are not bought again, and partial batches continue from their checkpoints. Resume inputs cannot reduce the original publication threshold or change the frozen cohort.

## Failure classes

The harness distinguishes failures because their remedies differ:

- `transient`: timeouts, dropped sockets, rate limits, and provider 5xx responses. Attempted up to four times with exponential backoff and jitter, respecting `Retry-After`.
- `quota`: the provider says the account lacks credit. Stops that model promptly and opens one GitHub issue labeled `billing` if none is already open.
- `permanent`: bad model ids, refusals, or unparseable answers. Records the failure and advances to the next attempt.

The attempt budget is `ceil(samples × 1.5) + 5`. The default wall-clock budget is 100 minutes per model and horizon.

Quota exhaustion appears in three places: the per-model job summary, exit code 4 with the `quota_exhausted` output, and the open `billing` issue.

## Model roster

[`tools/models.json`](../tools/models.json) is the canonical roster. A roster entry is keyed by the exact provider API model id; never use a drifting alias such as a provider's `latest` name.

The provider/lab assignment is methodologically significant: it determines the first stage of the lab-balanced site aggregate. Adding another model from an existing lab changes that lab's internal mean but does not give the lab more total weight; adding a newly represented lab changes the equally weighted lab cohort. Review this field as carefully as the model id.

Lifecycle status means:

| Status | Elicited | Existing forecast retained |
| --- | --- | --- |
| omitted or `active` | Yes | Yes |
| `paused` | No | Yes |
| `retired` | No | Yes, until the planned scope feature explicitly changes current-view inclusion |

Keep paused and retired entries in the roster so historical runs retain labels and display order.

To add a model:

1. Run `node tools/run-elicitation.mjs --list` or use the workflow's `list_models` option.
2. Add the exact model id and provider configuration to `tools/models.json`.
3. Run `node tools/run-elicitation.mjs --check --models <key>` or use `check_only` in Actions.
4. If it introduces a provider, add its lab mark in `LAB_LOGOS` in [`public/app.js`](../public/app.js) and short label in [`tools/import-runs.mjs`](../tools/import-runs.mjs).
5. Complete a same-date sweep for the intended horizons. A model-only dispatch can collect data, but it cannot publish until the rest of the active cohort completes that sweep.

The harness skips calls whose provider key is missing. A planned active model with no reusable batch still fails the complete-sweep publication gate. The workflow accepts the historical aliases `MINSTRAL_API_KEY` and `KIMI_API_KEY`; prefer the canonical `MISTRAL_API_KEY` and `MOONSHOT_API_KEY` names.

## Prompt and horizon changes

Follow [Prompt management](PROMPTS.md). A semantic prompt revision requires a new question-set version and a new complete sweep for the affected horizon. An added horizon also requires workflow, data, and UI coverage; changing only the prompt file or toggle is incomplete.

## Manual and mock runs

Use a mock run to exercise the harness without provider calls:

```bash
node tools/run-elicitation.mjs --mock --horizon 2030
```

Mock output lands in the gitignored `runs/.mock/` directory and cannot overwrite paid batches.

[`tools/manual-ingest.html`](../tools/manual-ingest.html) handles one-off long-term responses for models without an API and retains archival support for the retired 50-question 2030 format. Current dated horizon snapshots intentionally use only the automated harness because it records horizon provenance.

## Verification

`npm run check` runs the non-browser suite, including raw-batch integrity, published-data invariants, error classification, links, sweep behavior, and harness recovery cases.

`npm run test:browser` exercises behavior and layout in Chromium and WebKit at multiple widths. Run both before merging changes to prompts, generated data, or the site.
