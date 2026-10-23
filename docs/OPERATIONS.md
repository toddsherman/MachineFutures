# Operations

[Back to the repository overview](../README.md)

## One and done

Each model is asked once, at every horizon, when it is added to the roster, and is not asked again. Nothing paid runs on a timer. The daily catalogue scan is what keeps the site current: a new release is reported within a day, and its forecast is captured when it is added.

The elicitation workflow enforces this before any paid call:

- Every dispatch must name its models, a resume included. An empty `models` field is refused rather than treated as the whole roster.
- [`tools/check-captured.mjs`](../tools/check-captured.mjs) refuses a model that already has a complete batch for a requested horizon under that horizon's current question set. Batches still waiting on `elicitation/*` branches count, so a capture that has not been merged yet cannot be bought twice.
- A short or incomplete batch does not count. Finish an interrupted capture with `resume_from_run_id`, or dispatch only the horizons still to collect; the refusal lists them.
- A `resume_from_run_id` dispatch ignores batches from its own date, which it reuses or finishes rather than buying again. A capture of the same model on any other date still blocks it.
- A semantic prompt revision gets a new question-set version, and an answer to the superseded version is not a capture of the new one, so the check lets the affected models be asked under the new version.
- `allow_reask` overrides the check. Use it only for a deliberate re-ask under the same question set, such as a test-retest study.

Batches from the earlier full-roster sweeps, the last on October 1, 2026, remain in `runs/` and are unaffected.

A dispatch runs the workflow file from the branch it is dispatched on. Dispatch from `main`, or from a branch cut from it after October 14, 2026. Older branches, including the retained `elicitation/*` branches, carry the earlier workflow, where an empty `models` field means the whole roster.

## Automation schedule

| Workflow | Schedule | Purpose |
| --- | --- | --- |
| [`watch-models.yml`](../.github/workflows/watch-models.yml) | Daily, 13:00 UTC | Compare provider catalogues with the roster and comment on one tracking issue when new models appear |
| [`preflight.yml`](../.github/workflows/preflight.yml) | On demand | Make one inexpensive call per active model to catch missing credit, expired keys, and provider-withdrawn model ids |
| [`elicit.yml`](../.github/workflows/elicit.yml) | On demand | Collect the named models, preflight them with `check_only`, or list provider catalogues with `list_models` |
| [`ci.yml`](../.github/workflows/ci.yml) | Every push and pull request | Verify raw evidence, reproduce published data, and run browser behavior and layout tests |

The `ELICITATION_ENABLED` repository variable no longer gates anything and can be deleted.

The scan reports every id a provider newly serves. Not every one is a new model: aliases, dated snapshots, and non-chat models (embeddings, speech, image) also appear. Add only distinct chat models that a lab presents as a release.

## Publication path

The normal path for a new model is:

```text
roster entry in tools/models.json
  → check_only preflight
  → frozen addition plan in docs/sweeps/, committed before collection
  → elicit workflow with models: <key> and horizons: all
  → horizon-tagged batches on an elicitation/<run-id> branch
  → addition plan validated against those batches
  → npm run data:rebuild
  → operator opens and reviews a pull request
  → merge to main
  → Vercel production deployment
```

The workflow's own publication gate still checks the full active roster, so it rejects a model-only dispatch and the run ends red even when every requested batch is complete. That is expected until the gate learns about addition plans (see the [roadmap](ROADMAP.md)). The precommitted addition plan, validated with the same sweep validator, is the publication gate for an addition.

Before merging an addition, confirm:

- Every planned model and horizon reached the frozen sample target.
- Every published model has the intended provider/lab grouping, and the aggregate's lab and model counts match the cohort.
- `npm run check` passes.
- `npm run data:rebuild` leaves no unexpected diff beyond the intended generated outputs.
- The pull request contains raw batches as well as the site and download exports.
- Prompt and question-set provenance match the immutable sweep plan.

Merged pull-request branches are deleted automatically. Failed or incomplete elicitation branches should remain until their paid samples have been resumed into a complete sweep or otherwise reconciled with `main`.

For an eleven-horizon sweep, each model runs in six globally ordered waves of at most two horizons. A wave waits for the previous wave, so the same model is never called concurrently and one slow provider does not force the whole roster through a single runner.

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

| Status | Can be collected | Existing forecast retained |
| --- | --- | --- |
| omitted or `active` | Yes, once | Yes |
| `paused` | No | Yes |
| `retired` | No | Yes, until the planned scope feature explicitly changes current-view inclusion |

Because nothing is re-asked, a status no longer controls spending. It matters for which models count as the current cohort. Keep paused and retired entries in the roster so historical runs retain labels and display order.

To add a model:

1. Confirm it is a distinct release, not an alias or snapshot of a model already on the roster. `node tools/run-elicitation.mjs --list` or the workflow's `list_models` option shows each provider's catalogue.
2. Add the exact model id and provider configuration to `tools/models.json`, next to its lab's other models.
3. Push the branch and dispatch the elicitation workflow on it with `check_only`, or run `node tools/run-elicitation.mjs --check --models <key>` locally. Record the passing preflight in the roster's `_verified` note.
4. If it introduces a provider, add its lab mark in `LAB_LOGOS` in [`public/app.js`](../public/app.js) and short label in [`tools/import-runs.mjs`](../tools/import-runs.mjs).
5. Freeze the addition plan before collection: `node tools/check-sweep.mjs --resolve-plan --horizons-json <all eleven> --date <today> --samples 20`, filtered to the new model keys, saved as `docs/sweeps/<date>-<name>.json` and committed.
6. Dispatch the elicitation workflow on the same branch with `models: <key>`, `horizons: all`, and `samples: 20`. The one-and-done check refuses the dispatch if the model has already been captured.
7. When collection finishes, check out the new model's batches from the `elicitation/<run-id>` branch, validate them with `node tools/check-sweep.mjs --plan-json "$(cat <plan>)" --runs runs`, and run `npm run data:rebuild`. Confirm every existing model's record is unchanged.
8. Run `npm run check` and `npm run test:browser`, write a provenance note beside the plan (see [`docs/sweeps/`](sweeps/) for examples), and open a pull request.

The harness skips calls whose provider key is missing. A planned active model with no reusable batch still fails the complete-sweep publication gate. The workflow accepts the historical aliases `MINSTRAL_API_KEY` and `KIMI_API_KEY`; prefer the canonical `MISTRAL_API_KEY` and `MOONSHOT_API_KEY` names.

## Prompt and horizon changes

Follow [Prompt management](PROMPTS.md). A semantic prompt revision requires a new question-set version and a new complete sweep for the affected horizon. That is the one planned exception to one and done. The capture check counts only answers to the current question set, so the affected models can be dispatched without `allow_reask`. An added horizon also requires workflow, data, and UI coverage; changing only the prompt file or toggle is incomplete.

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

## September 2026 horizon expansion

The `new-horizons` workflow selection collects 2035, 2070, 2080, 2090, 2100, and 2200 only, with the active roster and 20 samples per model and horizon. It uses three ordered waves, retaining the original five datasets. New prompts preserve the v2 dated snapshot instrument with only the target year changed. Publish the six horizons together after the immutable sweep gate passes. Keep failed branches and resume artifacts until all paid samples are reconciled.
