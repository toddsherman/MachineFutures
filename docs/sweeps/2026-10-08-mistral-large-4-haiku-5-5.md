# October 8, 2026 Mistral Large 4 and Haiku 5.5 additions

The owner requested forecast runs and new site entries for Mistral Large 4 and Claude Haiku 5.5. The [addition plan](2026-10-08-mistral-large-4-haiku-5-5.json), committed before collection, freezes the two exact API ids (`mistral-large-4`, `claude-haiku-5-5`), all eleven horizons, prompt identities and hashes, the October 8 run date, and 20 accepted samples per model and horizon.

This targeted addition preserves all previously published model results and dates. Mistral Large 4 belongs to Mistral and Claude Haiku 5.5 to Anthropic; each shares its lab's existing weight in the lab-balanced aggregate.

- Authenticated inference preflight: [37729560568](https://github.com/toddsherman/MachineFutures/actions/runs/37729560568), passed for both models. Repeated after the harness fix below, with the added readable-reply check: [37747431497](https://github.com/toddsherman/MachineFutures/actions/runs/37747431497), passed for both.
- Initial collection: [37729615401](https://github.com/toddsherman/MachineFutures/actions/runs/37729615401), cancelled by the operator. Haiku 5.5 completed four horizons. Mistral Large 4 produced no samples: it returns its chat message as a list of typed parts, and the OpenAI-compatible adapter assumed a single string, so every attempt failed in the parser. The adapter was fixed on this branch before any Mistral Large 4 sample was accepted.
- First recovery: [37747513100](https://github.com/toddsherman/MachineFutures/actions/runs/37747513100). Haiku 5.5 completed all eleven horizons. Mistral Large 4 completed seven and fell short at 2080, 2090, 2100, and 2200 when provider latency pushed most calls past the five-minute request limit. The limit was raised to ten minutes on this branch.
- Second recovery: [37864865662](https://github.com/toddsherman/MachineFutures/actions/runs/37864865662), Mistral Large 4 only. It collected the 29 missing samples with no timeouts.
- Final evidence: 22 complete batches and 440 accepted samples. Each recovery restored the previous artifact and the immutable plan; no completed batch was purchased again, and partial batches continued from their checkpoints. The precommitted two-model plan passed the sweep validator.
- Dates: every batch carries the plan's October 8 run date. Mistral Large 4's last 29 samples were collected on October 9.
- All previously published model records remain unchanged. Each dated horizon now has 27 models across 8 labs; long term retains the additional historical Fable 5 record, for 28 total.
- Generated files reproduce byte for byte. Data-integrity checks and the Chromium/WebKit browser suite passed; a browser check confirmed both model selections, all eleven horizons, dates, sample counts, and rationales.

The two harness changes affect how replies are read and how long the harness waits for one. They do not change the prompt, the request parameters, or the acceptance rules, so they do not affect comparability with earlier batches.

As with the earlier individual additions, the monthly workflow's full-roster gate is expected to reject this targeted dispatch after preserving raw samples. Publication requires the precommitted two-model addition plan to pass the existing sweep validator, plus integrity, reproducibility, and browser checks. The scheduled full-roster gate remains unchanged. Revalidate with `tools/check-sweep.mjs --plan-json` using this manifest and `--runs runs`.
