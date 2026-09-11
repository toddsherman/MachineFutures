# Machine Futures

[Machine Futures](https://www.machinefutures.ai/) is a public record of what frontier AI models forecast about humanity's relationship with AI in 2030, 2040, 2050, 2060, and the long-term year-3000 state.

Every active model allocates exactly 100 percentage points across the same eleven mutually exclusive states, twenty times, at its default settings. The site publishes each model's median allocation, its sampling spread, and the reasoning nearest that median. The site's cross-model probability aggregate uses a lab-balanced arithmetic mean: published model allocations are averaged within each provider/lab, then the lab means are averaged equally. The downloads retain an equal-model mean only as a secondary comparison.

## Data flow

```text
public/end_states*.md + tools/models.json
                    │
                    ▼
         tools/run-elicitation.mjs → runs/*.json
                                         │
                                         ▼
                              tools/import-runs.mjs
                                         │
                                         ▼
                            generated forecast block ─┐
 hand-authored taxonomy + horizon copy ───────────────┤
                                                     ▼
                                           public/data.js

                         public/data.js + runs/*.json
                                         │
                                         ▼
                              tools/export-data.mjs
                                         │
                                         ▼
                                 data/*.csv + JSON
```

`runs/` is the irreplaceable source for the forecasts. The forecast block in `public/data.js` is rebuilt from those batches while preserving the hand-authored taxonomy and horizon copy already in that file. The downloadable datasets are then rebuilt from both inputs. Do not edit generated portions or exports by hand.

## Repository map

| Location | Purpose | Status | Deployed |
| --- | --- | --- | --- |
| [`public/end_states*.md`](public/) | Five versioned elicitation prompts and their taxonomy | Hand-authored source; paths are stable provenance | Yes |
| [`tools/horizons.mjs`](tools/horizons.mjs) | Horizon ids, target years, prompt paths, and question-set versions | Canonical configuration | No |
| [`tools/models.json`](tools/models.json) | Model roster, API ids, providers, and lifecycle status | Canonical configuration | No |
| [`runs/`](runs/) | Raw samples, rationales, recorded failures, within-run sampling summaries, and integrity digests | Canonical forecast evidence; completed batches are preserved | No |
| [`public/data.js`](public/data.js) | Taxonomy copy plus the generated forecast payload used by the browser | Mixed hand-authored/generated runtime file | Yes |
| [`data/`](data/) | Combined CSV and JSON downloads, each keyed by horizon | Generated from `public/data.js` and `runs/` | No |
| [`tools/`](tools/) | Elicitation, import, export, validation, and analysis | Hand-authored code | No |
| [`docs/`](docs/) | Methodology, prompt management, operations, and roadmap | Maintainer documentation | No |
| [`.github/workflows/`](.github/workflows/) | CI, monthly elicitation, preflight, and model discovery | Automation | No |
| [`archive/`](archive/) | Retired instruments and their historical data | Frozen provenance | No |

Large machine-produced files are marked as generated in [`.gitattributes`](.gitattributes), so GitHub collapses routine data refreshes by default without removing the underlying evidence from review.

## Forecast horizons and prompts

The dated views — 2030, 2040, 2050, and 2060 — ask for the arrangement visible at year end without requiring permanence. The long-term view asks for a durable arrangement by the year 3000 and remains the site's default.

See [Prompt management](docs/PROMPTS.md) for the canonical ids, question-set versions, repository files, and stable public copies. Prompt files intentionally stay in `public/` because their exact paths and hashes are part of run provenance and immutable sweep plans.

## Work locally

Requires Node.js 22 or later.

```bash
npm ci
npm run check
npm run serve
```

Open `http://localhost:4173`. For browser layout and interaction coverage, install Playwright's browsers once and run:

```bash
npx playwright install chromium webkit
npm run test:browser
```

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run check` | Run all non-browser integrity, data, link, and harness checks |
| `npm run verify:runs` | Verify every raw batch and its SHA-256 sample digest |
| `npm run data:import` | Rebuild the site's generated forecast block from raw runs |
| `npm run data:export` | Rebuild downloadable CSV and JSON files |
| `npm run data:rebuild` | Run import and export in the required order |
| `npm run test:browser` | Test layout and behavior in Chromium and WebKit |
| `node tools/run-elicitation.mjs --mock --horizon 2030` | Exercise the harness without making paid calls or touching real runs |

[`tools/manual-ingest.html`](tools/manual-ingest.html) is an owner-only local utility for one-off long-term responses from models without an API. It also retains archival support for the retired 50-question 2030 benchmark. Current dated horizons use the automated harness so their provenance cannot be mislabeled.

## Publishing

The monthly workflow writes new raw batches, validates a complete same-date sweep, rebuilds the generated outputs, and pushes an `elicitation/<run-id>` branch. Open and review a pull request from that branch, then merge it to publish through Vercel. Failed or incomplete elicitation branches are retained because they can contain paid samples not yet present on `main`.

See [Operations](docs/OPERATIONS.md) for schedules, recovery, model and horizon changes, and the publication checklist.

## Documentation

- [Methodology](docs/METHODOLOGY.md) — sampling, per-model summaries, lab-balanced aggregation, exposure, and interpretation
- [Prompt management](docs/PROMPTS.md) — prompt catalog, path stability, and versioning rules
- [Operations](docs/OPERATIONS.md) — automation, recovery, roster changes, testing, and publishing
- [Data dictionary](data/README.md) — generated CSV and JSON schemas
- [Raw-run format](runs/README.md) — batch naming, integrity, and provenance
- [Roadmap](docs/ROADMAP.md) — active work only
- [Archive](archive/README.md) — retired instruments and data
