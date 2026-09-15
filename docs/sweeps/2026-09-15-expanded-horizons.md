# September 15, 2026 horizon expansion

The [immutable plan](2026-09-15-expanded-horizons.json) freezes the exact 20-model cohort, prompt identities and SHA-256 hashes, original run date, and target of 20 accepted samples for each of six new horizons: 2035, 2070, 2080, 2090, 2100, and 2200.

- Initial collection: [34973806094](https://github.com/toddsherman/MachineFutures/actions/runs/34973806094).
- Targeted recovery: [35031435321](https://github.com/toddsherman/MachineFutures/actions/runs/35031435321).
- Final evidence: 120 raw batches and 2,400 accepted samples, using the existing v2 dated snapshot instrument with only its target year changed.
- Recovery scope: Kimi K2.6 at 2070 retained its first 15 accepted samples and collected the missing five after provider timeouts. No completed batch was purchased again.
- Existing published datasets for 2030, 2040, 2050, 2060, and Long term are unchanged. Raw evidence remains under `runs/`; site and downloadable outputs are generated from it.

The final combined artifact passed the original full-cohort sweep gate. The plan is committed here so validation does not depend on the 90-day artifact retention window. To revalidate, invoke `tools/check-sweep.mjs --plan-json` with this manifest's contents and `--runs runs`.
