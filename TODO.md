# Machine Futures TODO

## Dataset Scope

- [x] Narrow the model/lab set to fewer labs: Google, OpenAI, Meta, Anthropic, and xAI. (All five live; DeepSeek/Mistral/Moonshot are configured and awaiting keys.)

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
