# Machine Futures TODO

## Dataset Scope

- [ ] Narrow the model/lab set to fewer labs: Google, OpenAI, Meta, Anthropic, and xAI.

## Question Set

- [x] Add an open-source/open-weight models question:
  "What percentage of the total trailing 30-day token volume on OpenRouter.ai, or the largest equivalent public API aggregator, will be processed by open-weight models as of January 1, 2030?"
- [x] Remove one existing question to keep the benchmark at 50 questions. Replaced the old open-weights top-two leaderboard Q8.

## Ingestion

- [ ] Ensure the local HTML ingestion tool works well end to end.
- [x] Extend ingestion to support the separate 11-end-state prompt.
- [ ] Store 5 raw samples plus a normalized aggregate for each model/date/prompt family.
- [ ] Add or document the transform from normalized aggregate JSON into `public/data.js`.

## Site Content

- [ ] Remove the "Prototype dataset" warning.

## Design

- [ ] Provide more design feedback on the site.
