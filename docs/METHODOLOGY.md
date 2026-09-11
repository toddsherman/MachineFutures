# Methodology

[Back to the repository overview](../README.md)

## Instrument

Every model receives one of five versioned prompts and the same taxonomy of eleven mutually exclusive states. It must assign whole-number percentages totaling exactly 100. Zero is explicitly allowed for any state.

The dated horizons describe the arrangement actually visible at the end of 2030, 2040, 2050, or 2060. They do not imply that an arrangement is permanent. The long-term view asks for the durable arrangement by the year 3000. Values from different horizons or prompt versions are never pooled.

The current instruments and their question-set ids are cataloged in [Prompt management](PROMPTS.md).

There are no fallback models. A refusal or invalid answer is recorded against the model that was actually called; another model never answers in its place.

## Sampling and published values

For each model, horizon, and dataset date:

1. The model answers the prompt twenty times at its own default settings, without tools or browsing.
2. Invalid allocations are rejected and retried; rejected attempts are counted in that invocation's run-quality metadata.
3. Each valid sample and rationale is preserved in the raw batch.
4. The median for each of the eleven states is calculated across the model's samples.
5. Those eleven medians are renormalized to whole numbers summing to 100.
6. The full range, middle half, and rationale from the sample nearest the median are retained.

The site's headline forecast repeats the same operation across models: it takes the coordinate-wise median of the published model vectors and renormalizes the result to 100. Coordinate-wise medians do not necessarily sum to 100 before this final normalization.

Five samples left almost no pair of models separable on extinction-risk exposure, which is why the target is twenty. [`tools/analyse-agreement.mjs`](../tools/analyse-agreement.mjs) contains that analysis.

## Extinction-risk exposure

Extinction-risk exposure is the sum of the published medians for states 1 through 5:

- States 1–3: humanity is gone.
- States 4–5: humanity might perish in at least part of the scenario.

The uncertainty shown under the chart is bootstrapped from a model's own samples. It estimates the variability of the published sum of renormalized medians, rather than substituting the mean of each sample's subtotal. The two measures can differ enough to reorder models, so raw-run aggregates retain both `exposure` and `exposurePublished`.

## Provenance

The model id actually called is the run identity. A model's self-reported name is stored only as `model.self_reported_name`; it is not trusted as identification.

Modern horizon-aware batches record their horizon, target year, question-set id, exact prompt path, rendered-prompt SHA-256, model id, date, samples, failures from the represented invocation, and a digest over the samples. Historical batches that predate this metadata are explicitly interpreted as long term.

Raw batches in [`runs/`](../runs/) are the canonical forecast evidence. Their generated forecast block in [`public/data.js`](../public/data.js) is reproducible while the file's hand-authored taxonomy and horizon copy remain source material. Everything in [`data/`](../data/) is then regenerated from `public/data.js` and the raw runs. CI checks both transformations.

## Interpretation

These results record what models express under a fixed elicitation procedure. They are not calibrated probabilities, expert consensus, or a leaderboard. Small gaps between models should not be treated as meaningful unless they clear the sampling uncertainty. Changes over time can reflect a model release, a model's revised answers, or a change in the roster; the leader timeline carries model counts to make compositional changes visible.
