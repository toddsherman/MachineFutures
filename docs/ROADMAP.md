# Roadmap

[Back to the repository overview](../README.md)

This file tracks active design and data-model decisions only. Completed work remains visible in Git history and merged pull requests rather than accumulating here as stale checkboxes.

## One-and-done collection

Since October 14, 2026, each model is asked once, at every horizon, when it is added, and is not asked again. The monthly full-roster sweep and its preflight no longer run, and the catalogue scan runs daily. See [Operations](OPERATIONS.md#one-and-done).

- [ ] Make a targeted addition first-class in `elicit.yml`: freeze the plan for the requested models only, upload it as the run's sweep plan, and let a complete addition pass the publication gate, so a successful collection ends green and publishes its own branch instead of failing the full-roster gate by design.
- [ ] Once that lands, retire the manual steps it replaces (hand-frozen plan, local batch checkout and validation) from the addition procedure.
- [ ] Let the daily scan open a draft addition pull request (roster entry plus `check_only` preflight) for an id that looks like a new chat model, filtering aliases, dated snapshots, and non-chat models. The owner still approves the paid collection.
- [ ] Record capture lag, the days from a model's release to its collection, alongside the `released` date below, and show it in the model details.
- [ ] Revisit model ids that vanish from a provider's catalogue while still callable (DeepSeek V4 Flash as of October 13, 2026). Nothing is re-asked, so this matters only for a resume or a deliberate re-ask.

## Model lifecycle and scope

- [ ] Add an ISO `released` date to each roster entry, source it per lab, and carry it into the published payload and exports. Do not guess uncertain dates.
- [ ] Define current-view behavior so `active` and `paused` models count while `retired` models remain in history but no longer affect current aggregates. With nothing re-asked, these statuses no longer control spending; they decide only current-view inclusion.
- [ ] Add a shareable `current` / `all` / `legacy` scope control.
- [ ] Recompute the headline, ending aggregates, exposure ranking, and model/lab counts for the selected scope.
- [ ] Decide whether the leader timeline is always current-scope or changes with the selected scope, and label that behavior explicitly.
- [ ] Record retirement events and lab/model counts in the leader timeline so compositional changes are explicit.
- [ ] Decide whether a lab with no current models remains in the lab total.
- [ ] Extend site, export, and browser checks to cover every scope.

## Repository and data architecture

- [ ] Choose explicit code and data licenses. The current attribution language is not a substitute for a license.
- [ ] Separate the hand-authored taxonomy from the generated forecast block currently sharing `public/data.js`, so GitHub can classify the generated payload independently.
- [ ] Revisit date/horizon subdirectories for `runs/` before the flat directory becomes unwieldy. This requires a tested migration because import, export, verification, artifact recovery, and stored source paths currently assume `runs/*.json`.

## Product

- [ ] Continue reviewing the site's visual design and explanation as the longitudinal dataset grows.
