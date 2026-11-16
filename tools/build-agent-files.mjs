#!/usr/bin/env node
// Builds the files the site publishes for programs rather than for people:
// AI assistants, crawlers and scripts that fetch a URL and never run the
// page's JavaScript.
//
// Reads data/forecasts.json (numbers, spreads and reasons), public/front-data.js
// (the five plain groups and plain names the front page uses) and
// public/front-copy.js (the front page's own sentences and rounding). Writes:
//
//   public/data/summary.json       the combined answer for every year, the
//                                  eleven futures and the list of models
//   public/data/forecasts.json     every model's 100 points for every year
//   public/data/models/<id>.json   one model in full, with its reasons
//   public/llms.txt                a plain-text guide to the above
//
// public/webmcp.js serves these same files to in-browser agents, so the
// tools, the files and the page cannot give different answers.
//
// Run after tools/build-front.mjs; `npm run data:rebuild` does all four steps
// in order. CI fails if the committed outputs differ from what this produces.
//
// Usage: node tools/build-agent-files.mjs
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { HORIZON_RUN_CONFIG } from './horizons.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const SITE = 'https://www.machinefutures.ai';
const REPO = 'https://github.com/toddsherman/MachineFutures';

const source = JSON.parse(await read('data/forecasts.json'));
const scope = {};
new Function('window', await read('public/front-data.js'))(scope);
new Function('window', await read('public/front-copy.js'))(scope);
const front = scope.FRONT;
const copy = scope.FRONT_COPY(front);

const HORIZONS = front.horizons;
const IDS = source.endings.map(ending => ending.id);
const text = markup => markup.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
const promptUrl = horizon => `${SITE}/${HORIZON_RUN_CONFIG[horizon].promptFile.replace(/^public\//, '')}`;
// A model id becomes a file name and a URL segment, so hold it to characters
// that are safe in both before anything is written.
const SAFE_ID = /^[a-z0-9][a-z0-9.-]*$/;
const modelUrl = id => `${SITE}/data/models/${id}.json`;

// Short values stay on one line and long ones open up, so a model reading the
// file spends its attention on figures rather than on indentation.
function tidyJson(value, indent = '') {
  const flat = JSON.stringify(value ?? null);
  if (value === null || typeof value !== 'object' || flat.length <= 140) return flat;
  const inner = `${indent}  `;
  if (Array.isArray(value)) return `[\n${value.map(item => inner + tidyJson(item, inner)).join(',\n')}\n${indent}]`;
  const fields = Object.entries(value).filter(([, item]) => item !== undefined);
  return `{\n${fields.map(([key, item]) => `${inner}${JSON.stringify(key)}: ${tidyJson(item, inner)}`).join(',\n')}\n${indent}}`;
}

const published = HORIZONS.flatMap(horizon => source.datasets[horizon].models);
const datasetDate = published.map(model => model.asked_on).sort().at(-1);
const sampleCounts = [...new Set(published.map(model => model.samples))].sort((a, b) => a - b);
const asked = sampleCounts.length === 1 ? `${sampleCounts[0]} times` : `${sampleCounts[0]} to ${sampleCounts.at(-1)} times`;
const dated = HORIZONS.filter(horizon => horizon !== 'long-term');

// The caveats travel with the numbers, in the summary and in llms.txt alike.
const howToRead = [
  'The points show where each model puts its weight. They are not calibrated odds, and they are not a prediction by this site.',
  `Every model got the same written question, with no web search and no tools, and was asked ${asked} for each year. The published figure is its middle answer, adjusted to whole numbers that add up to 100.`,
  'The combined figure counts every lab once. Models are averaged inside their lab first, then the labs are averaged, so a lab with many models does not set the result.',
  'Each model was asked once, when it was added, and is not asked again. Answers for different years are never pooled.',
  `The years are ${dated.join(', ')} and "long-term". A dated year is a snapshot of how things stand at the end of that year. "long-term" is the lasting arrangement by the year 3000.`,
];

const groupOf = id => front.groups.find(group => group.ids.includes(id)).key;
const groupPoints = values => Object.fromEntries(front.groups.map((group, index) => [group.key, values[index]]));
const wording = horizon => Object.fromEntries(source.endings_by_horizon[horizon].map(ending => [ending.id, ending]));
const datedWording = wording(dated[0]);
const longTermWording = wording('long-term');

const models = front.models.map(model => {
  if (!SAFE_ID.test(model.id)) throw new Error(`model id ${JSON.stringify(model.id)} cannot be used as a file name; give it a slug before publishing`);
  return model;
});

/* ---------- summary.json: the first file to read ---------- */
const summary = {
  name: 'Machine Futures',
  url: `${SITE}/`,
  about: 'A public record of what frontier AI models say when asked how things turn out between humans and AI. Each model splits 100 points across 11 possible futures, once for each year asked about.',
  dataset_date: datasetDate,
  how_to_read: howToRead,
  headline: `${copy.headlineText(front.defaultHorizon)} ${text(copy.dek(front.defaultHorizon))}`,
  default_horizon: front.defaultHorizon,
  horizons: HORIZONS.map(horizon => ({
    id: horizon,
    target_year: source.horizons.find(item => item.id === horizon).targetYear,
    model_count: source.datasets[horizon].aggregate.model_count,
    lab_count: source.datasets[horizon].aggregate.lab_count,
    question: promptUrl(horizon),
  })),
  groups: front.groups.map(group => ({ key: group.key, label: group.label, future_ids: group.ids })),
  futures: source.endings.map(ending => ({
    id: ending.id,
    name: ending.name,
    plain_name: front.futures.find(future => future.id === ending.id).plain,
    group: groupOf(ending.id),
    extinction_tier: ending.extinction_tier,
    definition_for_dated_years: datedWording[ending.id].description,
    definition_for_long_term: longTermWording[ending.id].description,
  })),
  // Points of 100, keyed by future id. `points` are the site's published
  // tenths; `group_points` are the whole numbers the front page shows.
  all_labs: Object.fromEntries(HORIZONS.map(horizon => [horizon, {
    points: source.datasets[horizon].aggregate.probabilities,
    group_points: groupPoints(copy.allLabs(horizon)),
  }])),
  models: models.map(model => ({
    id: model.id,
    name: model.name,
    lab: model.lab,
    asked_on: model.asked,
    horizons: HORIZONS.filter(horizon => model.h[horizon]),
    detail: modelUrl(model.id),
  })),
  files: {
    every_model_every_year: `${SITE}/data/forecasts.json`,
    one_model_in_full: `${SITE}/data/models/{id}.json`,
    guide: `${SITE}/llms.txt`,
    spreadsheets_and_raw_samples: `${REPO}/tree/main/data`,
    methodology: `${REPO}/blob/main/docs/METHODOLOGY.md`,
  },
};

/* ---------- forecasts.json: every model, every year, numbers only ---------- */
const byModel = horizon => Object.fromEntries(source.datasets[horizon].models.map(model => [model.api_model_id, model]));
const record = Object.fromEntries(HORIZONS.map(horizon => [horizon, byModel(horizon)]));
const forecasts = {
  about: 'How each model split its 100 points for each year. Points are keyed by future id and each split adds up to 100. Read summary.json first for what the futures mean and how to read the numbers.',
  summary: `${SITE}/data/summary.json`,
  dataset_date: datasetDate,
  futures: Object.fromEntries(source.endings.map(ending => [ending.id, ending.name])),
  horizons: HORIZONS,
  models: models.map(model => ({
    id: model.id,
    name: model.name,
    lab: model.lab,
    points: Object.fromEntries(HORIZONS.filter(horizon => model.h[horizon]).map(horizon => [horizon, record[horizon][model.id].probabilities])),
  })),
};

/* ---------- models/<id>.json: one model in full ---------- */
const detail = model => ({
  id: model.id,
  name: model.name,
  lab: model.lab,
  asked_on: model.asked,
  about: `How ${model.name} split 100 points across 11 possible futures for each year it was asked about, with the spread across its answers and the reason it gave for each number. Reasons are the model's own words, published as given. Read summary.json first for what the futures mean and how to read the numbers.`,
  summary: `${SITE}/data/summary.json`,
  futures: Object.fromEntries(source.endings.map(ending => [ending.id, ending.name])),
  horizons: Object.fromEntries(HORIZONS.filter(horizon => model.h[horizon]).map(horizon => {
    const answer = record[horizon][model.id];
    return [horizon, {
      question: promptUrl(horizon),
      question_set: answer.question_set,
      prompt_sha256: answer.prompt_sha256,
      times_asked: answer.samples,
      points: answer.probabilities,
      group_points: groupPoints(copy.modelVals(model, horizon)),
      lowest_and_highest_answer: answer.samples_range,
      middle_half_of_answers: answer.middle_half,
      reasons: answer.rationales,
    }];
  })),
});

/* ---------- llms.txt: a plain-text guide ---------- */
const example = models[0];
const llms = `# Machine Futures

> ${summary.about}

${summary.headline} That is ${source.datasets[front.defaultHorizon].aggregate.model_count} models from ${source.datasets[front.defaultHorizon].aggregate.lab_count} labs, in the dataset of ${datasetDate}.

Before quoting a number:

${howToRead.map(line => `- ${line}`).join('\n')}

## Data

- [Summary](${SITE}/data/summary.json): Start here. The combined answer for every year, the 11 futures and what they mean, the five plain groups the front page uses, and the list of models.
- [Every model, every year](${SITE}/data/forecasts.json): How each model split its 100 points for each year. Numbers only.
- [One model in full](${modelUrl(example.id)}): This one is ${example.name}. There is a file like it for every model at \`/data/models/{id}.json\`, with the ids listed in the summary. It adds the spread across the model's answers and the reason it gave for every number.

## Pages

- [Front page](${SITE}/): The answer in plain words, with charts. The charts need JavaScript. The files above do not.
- [Explorer](${SITE}/explore.html): Every model, every future and every reason, side by side.

In browsers that support WebMCP, both pages also offer the same data as read-only tools.

## The questions

- [Question for ${front.defaultHorizon}](${promptUrl(front.defaultHorizon)}): The exact wording every model was given. The other dated years are at \`/end_states_{year}.md\`.
- [Question for the long term](${promptUrl('long-term')}): The wording for the year 3000.

## Optional

- [Methodology](${REPO}/blob/main/docs/METHODOLOGY.md): How the answers are collected, summarised and combined.
- [Spreadsheet downloads](${REPO}/tree/main/data): CSV files, including every raw answer.
- [Raw batches](${REPO}/tree/main/runs): The untouched record of each time a model was asked.
`;

const dataDir = new URL('public/data/', root);
const modelsDir = new URL('models/', dataDir);
// Rebuilt from nothing, so a model that leaves the record leaves no file.
await rm(modelsDir, { recursive: true, force: true });
await mkdir(modelsDir, { recursive: true });
const writeJson = (url, value) => writeFile(url, `${tidyJson(value)}\n`);
await writeJson(new URL('summary.json', dataDir), summary);
await writeJson(new URL('forecasts.json', dataDir), forecasts);
for (const model of models) await writeJson(new URL(`${model.id}.json`, modelsDir), detail(model));
await writeFile(new URL('public/llms.txt', root), llms);

console.log(`✓ agent files built: summary, forecasts, ${models.length} model files and llms.txt for the ${datasetDate} dataset`);
