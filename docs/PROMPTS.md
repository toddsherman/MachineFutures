# Prompt management

[Back to the repository overview](../README.md)

## Current prompt catalog

| Horizon | Target year | Question set | Repository file | Public copy |
| --- | ---: | --- | --- | --- |
| Long term | 3000 | `end-states-v3` | [`public/end_states.md`](../public/end_states.md) | [machinefutures.ai/end_states.md](https://www.machinefutures.ai/end_states.md) |
| 2030 | 2030 | `end-states-2030-v2` | [`public/end_states_2030.md`](../public/end_states_2030.md) | [machinefutures.ai/end_states_2030.md](https://www.machinefutures.ai/end_states_2030.md) |
| 2040 | 2040 | `end-states-2040-v2` | [`public/end_states_2040.md`](../public/end_states_2040.md) | [machinefutures.ai/end_states_2040.md](https://www.machinefutures.ai/end_states_2040.md) |
| 2050 | 2050 | `end-states-2050-v2` | [`public/end_states_2050.md`](../public/end_states_2050.md) | [machinefutures.ai/end_states_2050.md](https://www.machinefutures.ai/end_states_2050.md) |
| 2060 | 2060 | `end-states-2060-v2` | [`public/end_states_2060.md`](../public/end_states_2060.md) | [machinefutures.ai/end_states_2060.md](https://www.machinefutures.ai/end_states_2060.md) |

[`tools/horizons.mjs`](../tools/horizons.mjs) is the canonical registry connecting each horizon id to its target year, prompt file, question-set id, and raw-run filename suffix.

## Why the prompts live in `public/`

These Markdown files have two roles: they are the exact harness inputs and stable public artifacts linked from the site. Their paths are also stored in raw batches and immutable sweep plans. Moving or renaming one would therefore change a public URL and invalidate path-based provenance checks for existing work.

The harness reads only the text between `PROMPT BEGINS` and `PROMPT ENDS`. It replaces `{{RUN_DATE}}` at runtime, rejects any unresolved placeholder, and stores a SHA-256 of the rendered text with the batch.

## Editing rules

Treat a semantic prompt change as a new instrument version:

1. Edit the appropriate `public/end_states*.md` file without moving it.
2. If the elicitation meaning changes, increment that horizon's `questionSet` in [`tools/horizons.mjs`](../tools/horizons.mjs).
3. Keep the taxonomy id, name, family, and description synchronized with the corresponding website copy in [`public/data.js`](../public/data.js). Dated horizons share one non-terminal snapshot taxonomy; long term keeps its durable end-state wording.
4. Update prompt assertions and fixtures where required.
5. Run `npm run check` and `npm run test:browser`.
6. Collect a complete new sweep for every affected horizon before publishing its new version.

Do not overwrite or rewrite older raw batches. Their `question_set` and `prompt_sha256` preserve which instrument produced them, while Git history preserves the corresponding prompt text.

## Adding a horizon

Adding a horizon touches more than the visible toggle:

1. Add a prompt file and register its id, year, version, and filename suffix in [`tools/horizons.mjs`](../tools/horizons.mjs).
2. Extend workflow selection and ordered-wave coverage in [`.github/workflows/elicit.yml`](../.github/workflows/elicit.yml).
3. Add the horizon to the site's taxonomy mapping and UI ordering.
4. Extend harness, sweep, data, and browser fixtures.
5. Run mock elicitation and the complete test suite.
6. Run a full same-date sweep, import it, export downloads, and publish through a pull request.

The canonical order in `tools/horizons.mjs` is also used by frozen sweep plans and workflow waves. Do not reorder it solely to change the UI; presentation order belongs in the browser code.
