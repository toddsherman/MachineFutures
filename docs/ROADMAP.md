# Roadmap

[Back to the repository overview](../README.md)

This file tracks active design and data-model decisions only. Completed work remains visible in Git history and merged pull requests rather than accumulating here as stale checkboxes.

## Model lifecycle and scope

- [ ] Add an ISO `released` date to each roster entry, source it per lab, and carry it into the published payload and exports. Do not guess uncertain dates.
- [ ] Define current-view behavior so `active` and `paused` models count while `retired` models remain in history but no longer affect current aggregates.
- [ ] Add a shareable `current` / `all` / `legacy` scope control.
- [ ] Recompute the headline, ending medians, exposure ranking, and model/lab counts for the selected scope.
- [ ] Decide whether the leader timeline is always current-scope or changes with the selected scope, and label that behavior explicitly.
- [ ] Record retirement events and model counts in the leader timeline so compositional changes are explicit.
- [ ] Decide whether a lab with no current models remains in the lab total.
- [ ] Extend site, export, and browser checks to cover every scope.

## Repository and data architecture

- [ ] Choose explicit code and data licenses. The current attribution language is not a substitute for a license.
- [ ] Separate the hand-authored taxonomy from the generated forecast block currently sharing `public/data.js`, so GitHub can classify the generated payload independently.
- [ ] Revisit date/horizon subdirectories for `runs/` before the flat directory becomes unwieldy. This requires a tested migration because import, export, verification, artifact recovery, and stored source paths currently assume `runs/*.json`.

## Product

- [ ] Continue reviewing the site's visual design and explanation as the longitudinal dataset grows.
