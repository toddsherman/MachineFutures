# September 23, 2026 GPT-6 Sol and Luna additions

The owner requested forecast runs and new site entries for GPT-6 Sol and GPT-6 Luna following their September 22 release. Collection started September 23 UTC (September 22 in Los Angeles). The [addition plan](2026-09-23-gpt-6-sol-luna.json), committed before collection, freezes the two exact API ids, all eleven horizons, prompt identities and hashes, and 20 accepted samples per model and horizon.

This targeted addition preserves all previously published model results and dates, including GPT-5.6 Sol. Both new entries belong to OpenAI and share that lab's existing weight in the aggregate.

- Authenticated inference preflight: [35804351429](https://github.com/toddsherman/MachineFutures/actions/runs/35804351429), passed for both models.
- Collection: [35804482564](https://github.com/toddsherman/MachineFutures/actions/runs/35804482564).
- Final evidence: 22 complete batches and 440 accepted samples. All twelve model/wave jobs succeeded, and the precommitted two-model addition plan passed the sweep validator.
- All previously published model records remain unchanged. Each dated horizon now has 23 models across 8 labs; long term retains the additional historical Fable 5 record, for 24 total.
- Generated files reproduce byte for byte. Data-integrity checks passed; browser verification confirmed both model selections, all eleven horizons, dates, sample counts, and rationales.

As with the Opus 5.5 addition, the monthly workflow's full-roster gate is expected to reject this targeted dispatch after preserving raw samples. Publication requires the precommitted two-model addition plan to pass the existing sweep validator, plus integrity, reproducibility, and browser checks. The scheduled full-roster gate remains unchanged. Revalidate with `tools/check-sweep.mjs --plan-json` using this manifest and `--runs runs`.
