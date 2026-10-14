# October 13, 2026 Gemini 4 Argon, Grok 4.7 and Muse Wonder 1.0 additions

The owner requested forecast runs and new site entries for three models: Gemini 4 Argon, which first appeared in Google's catalogue on October 13; Grok 4.7, which the weekly catalogue scan first reported on September 21; and Muse Wonder 1.0, which reached Meta's API on October 12. The [addition plan](2026-10-13-gemini-4-argon-grok-4-7-muse-wonder.json), committed before collection, freezes the three exact API ids (`gemini-4-argon`, `grok-4.7`, `muse-wonder-1.0`), all eleven horizons, prompt identities and hashes, the October 13 run date, and 20 accepted samples per model and horizon.

This targeted addition preserves all previously published model results and dates. Each model belongs to a lab already on the board (Google, xAI, Meta) and shares that lab's existing weight in the lab-balanced aggregate.

- Authenticated inference preflight: [38455822910](https://github.com/toddsherman/MachineFutures/actions/runs/38455822910), passed for all three. An earlier preflight, [38455695258](https://github.com/toddsherman/MachineFutures/actions/runs/38455695258), received one HTTP 500 from Google for `gemini-4-argon`; the retry passed.
- Collection: [38455939028](https://github.com/toddsherman/MachineFutures/actions/runs/38455939028). All eighteen model/wave jobs succeeded.
- Final evidence: 33 complete raw batches and 660 accepted samples. The precommitted three-model plan passed the sweep validator.
- All previously published model records remain unchanged. Each dated horizon now has 30 models across 8 labs; long term retains the additional historical Fable 5 record, for 31 total.
- Generated files reproduce byte for byte. Data-integrity checks and the Chromium/WebKit browser suite passed; a browser check confirmed all three model selections, all eleven horizons, dates, sample counts, and rationales.

As with the earlier individual additions, the monthly workflow's full-roster gate is expected to reject this targeted dispatch after preserving raw samples. Publication requires the precommitted three-model addition plan to pass the existing sweep validator, plus integrity, reproducibility, and browser checks. The scheduled full-roster gate remains unchanged. Revalidate with `tools/check-sweep.mjs --plan-json` using this manifest and `--runs runs`.
