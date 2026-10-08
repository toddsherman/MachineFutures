# October 1, 2026 full-roster sweep

The first scheduled re-ask of every active model at all eleven horizons. The [immutable plan](2026-10-01-full-sweep.json) freezes the exact 24-model cohort, prompt identities and SHA-256 hashes, the October 1 run date, and a target of 20 accepted samples per model and horizon.

- Initial collection: [36912740465](https://github.com/toddsherman/MachineFutures/actions/runs/36912740465), started by the monthly schedule on October 1.
- Targeted recovery: [37550769990](https://github.com/toddsherman/MachineFutures/actions/runs/37550769990), dispatched October 7 after the owner added credit.
- Final evidence: 264 raw batches and 5,280 accepted samples.
- Recovery scope: the Anthropic and Moonshot accounts ran out of credit during the initial collection (issue #29), and DeepSeek V4 Flash timed out at 2030. Seven models were short by 527 samples in total: Kimi K3 and Kimi K2.6 at most horizons, the four Anthropic models at 2090, 2100, and 2200, and DeepSeek V4 Flash at 2030. The recovery restored the original artifact and plan, kept every accepted sample, and collected only the shortfall. No completed batch was purchased again.
- Dates: every batch carries the sweep's October 1 run date, because the rendered prompt and its hash are tied to that date. The 527 recovered samples were collected on October 7.
- GPT-6.1 Sol is not part of this sweep. It was added on October 6, after the cohort was frozen, and keeps its October 6 record. The paused Claude Fable 5 keeps its historical long-term record.

Across the 24 re-asked models, the published allocation moved by 3.2 points on average against each model's own previous record (total variation, averaged over the ten dated horizons), with no common direction: The Held Leash rose for 14 models and fell for 10. The lab-balanced Held Leash figure for 2030 moved from 59.3 to 60.6.

The final combined artifact passed the original full-cohort sweep gate. The plan is committed here so validation does not depend on the 90-day artifact retention window. To revalidate, invoke `tools/check-sweep.mjs --plan-json` with this manifest's contents and `--runs runs`.
