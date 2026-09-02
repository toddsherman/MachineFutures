# Machine Futures TODO

## Dataset Scope

- [x] Narrow the model/lab set to fewer labs: Google, OpenAI, Meta, Anthropic, and xAI. (All five live; DeepSeek/Mistral/Moonshot are configured and awaiting keys.)

## Model lifecycle and scope

Nothing here is built yet. Recorded so the shape of it is settled before the
first retirement forces a rushed decision.

### Record each model's release date

- [ ] Add `released` (ISO date) to each entry in `tools/models.json`, carry it through `tools/import-runs.mjs` into `public/data.js` and the `data/` exports.
- [ ] Backfill the existing roster. The dates are not in this repository and have to be sourced per lab. Where a date is uncertain, mark it so rather than guessing: a wrong release date is worse than an absent one, because it would silently distort any ordering built on it.

Why it matters: the leader timeline sequences by **elicitation** date, which is
when we asked, not when the model existed. Release dates let the record say how
old a model was when put the question, and eventually let a view order by
generation rather than by our own scheduling.

### Retirement should remove a model from the current aggregate

Today `status` only stops the harness asking. `tools/import-runs.mjs` has no
notion of it and neither does `public/app.js`, so a retired model still feeds
the median, the leading ending, the eleven endings, the exposure chart and the
counts in the standfirst. The harness's own message — "its published forecast
stands" — accurately describes the present behaviour, and is the thing to
change.

Intended meaning:

| status | asked | counted in the current view |
| --- | --- | --- |
| `active` | yes | yes |
| `paused` | no | yes — its last forecast stands |
| `retired` | no | no |

- [ ] Teach the importer to carry `status` into `public/data.js`.
- [ ] Exclude `retired` models from every current-view aggregate.
- [ ] Never delete a batch. Retirement is a display decision; `runs/` is the provenance and the timeline needs the history.

### A scope toggle: current / all / legacy

- [ ] Default `current`. Carry the scope in the URL beside `?model=` so a view is shareable.
- [ ] Recompute per scope: the leading ending, the eleven endings, the exposure chart, and the model and lab counts in the standfirst all change with it.
- [ ] Decide what the leader timeline does. It should either always use `current` and say so, or state which scope produced it. A timeline under one scope beside a headline under another would be quietly wrong.
- [ ] Put retirement events in the timeline with the model count, the way additions already are. A leader that changes on a retirement changed for a compositional reason, and without the count that is indistinguishable from a model revising its answer.

Open question: if every model a lab fields is retired, does the lab still count
toward "N labs"? Under `current` it presumably should not, which means the lab
count is scope-dependent too.

### Checks that have to follow

- [ ] `tools/check-site.mjs` runs its invariants per scope rather than once.
- [ ] `data/` exports gain `status` and `released`, and either a scope column or one file per scope.
- [ ] The browser suite asserts that switching scope changes the aggregate, and that `current` excludes retired models.

## Cadence

- [x] Enable the monthly schedule (`ELICITATION_ENABLED=true`); re-asks every roster model on the 1st.
- [ ] Add DeepSeek, Mistral, and Moonshot keys — roster entries are ready and preflight-skipped until then.
- [ ] Watch for new flagships with `--list`; add, preflight, elicit.

## Retired

- [x] Remove the 2030 index; the site is now end-states only. Prompt and run archived in `archive/`.

## Question Set

- [x] Add an open-source/open-weight models question:
  "What percentage of the total trailing 30-day token volume on OpenRouter.ai, or the largest equivalent public API aggregator, will be processed by open-weight models as of January 1, 2030?"
- [x] Remove one existing question to keep the benchmark at 50 questions. Replaced the old open-weights top-two leaderboard Q8.

## Ingestion

- [x] Ensure the local HTML ingestion tool works well end to end.
- [x] Extend ingestion to support the separate 11-end-state prompt.
- [x] Store 5 raw samples plus a normalized aggregate for each model/date/prompt family. (One batch JSON per model/date in `runs/`.)
- [x] Add or document the transform from normalized aggregate JSON into `public/data.js`. (`tools/import-runs.mjs`; 2030 family only — extend it when the first end-state batch lands.)

## Site Content

- [x] Remove the "Prototype dataset" warning. (Removed with the 2030 index; all published data is now real.)

## Design

- [ ] Provide more design feedback on the site.
