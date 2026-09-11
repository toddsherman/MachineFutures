#!/usr/bin/env node
// Build data/ — a self-contained, downloadable copy of everything the site
// publishes, in formats that open in a spreadsheet without any tooling.
//
// Generated, never hand-edited: it is derived from public/data.js (the
// published figures) and runs/ (the raw samples), so it cannot drift from
// what the site shows.
//
// Usage: node tools/export-data.mjs
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_HORIZON, HORIZONS, HORIZON_IDS, horizonOfBatch } from './horizons.mjs';
import { labBalancedMean, quantizeAllocation } from './allocations.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'data');
mkdirSync(outDir, { recursive: true });

// data.js is a browser IIFE that hangs its payload on window; give it one.
const shim = { };
new Function('window', readFileSync(join(root, 'public', 'data.js'), 'utf8'))(shim);
const payload = shim.MF_DATA;
const { states } = payload;
const statesByHorizon = payload.statesByHorizon || Object.fromEntries(HORIZON_IDS.map(horizon => [horizon, states]));
// Accept the pre-horizon public shape during the one-time migration, while all
// newly generated exports use the horizon-keyed schema below.
const defaultHorizon = payload.defaultHorizon || DEFAULT_HORIZON;
const horizonMetadata = payload.horizons || HORIZONS;
const datasets = payload.datasets || {
  [defaultHorizon]: {
    endStateRuns: payload.endStateRuns || {},
    datasetDate: payload.datasetDate || null,
    leaderHistory: payload.leaderHistory || []
  }
};

const STATE_IDS = states.map(s => s.id);
const statesFor = horizon => statesByHorizon[horizon] || states;
const stateByIdFor = horizon => new Map(statesFor(horizon).map(state => [state.id, state]));
const tierOf = state => state.extinction === 'gone' ? 'humanity is gone'
  : state.extinction === 'risk' ? 'humanity might perish' : '';

// RFC 4180: quote everything with a separator, quote, or newline in it, and
// double any embedded quotes. Rationales are prose and contain all three.
const cell = value => {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const csv = (header, rows) => [header, ...rows].map(r => r.map(cell).join(',')).join('\n') + '\n';
const write = (name, contents) => {
  writeFileSync(join(outDir, name), contents);
  console.log(`  data/${name} — ${contents.split('\n').length - 1} lines`);
};

const horizonIds = [...new Set([...horizonMetadata.map(item => item.id), ...Object.keys(datasets)])];
const runs = horizonIds.flatMap(horizon =>
  Object.entries(datasets[horizon]?.endStateRuns || {}).map(([apiId, run]) => ({ horizon, apiId, run })));

const stableNumber = value => Math.round(value * 1e12) / 1e12;
const meanVector = vectors => vectors[0].map((_, index) =>
  vectors.reduce((sum, vector) => sum + vector[index], 0) / vectors.length);
const aggregateFor = horizon => {
  const horizonRuns = runs.filter(row => row.horizon === horizon);
  if (!horizonRuns.length) return null;
  const rows = horizonRuns.map(({ run }) => ({
    lab: run.provider,
    values: STATE_IDS.map(id => run.probabilities[id])
  }));
  const labMean = labBalancedMean(rows);
  const equalModelMean = meanVector(rows.map(row => row.values));
  const displayed = quantizeAllocation(labMean);
  return {
    method_id: 'lab-balanced-arithmetic-mean',
    method_name: 'Lab-balanced arithmetic mean',
    lab_count: new Set(rows.map(row => row.lab.trim())).size,
    model_count: rows.length,
    probabilities: Object.fromEntries(STATE_IDS.map((id, index) => [id, displayed[index]])),
    unrounded_lab_balanced_probabilities: Object.fromEntries(STATE_IDS.map((id, index) => [id, stableNumber(labMean[index])])),
    equal_model_mean_probabilities: Object.fromEntries(STATE_IDS.map((id, index) => [id, stableNumber(equalModelMean[index])]))
  };
};
const aggregates = Object.fromEntries(horizonIds.map(horizon => [horizon, aggregateFor(horizon)]));

/* ---------- the combined forecast ---------- */
write('aggregates.csv', csv(
  ['horizon', 'dataset_date', 'aggregate_method_id', 'aggregate_method', 'lab_count', 'model_count', 'ending_id', 'ending',
   'display_probability_pct', 'unrounded_lab_balanced_mean_pct', 'equal_model_mean_pct'],
  horizonIds.flatMap(horizon => {
    const aggregate = aggregates[horizon];
    if (!aggregate) return [];
    const horizonRuns = runs.filter(row => row.horizon === horizon);
    const datasetDate = horizonRuns.map(({ run }) => run.date).filter(Boolean).sort().at(-1) || '';
    const stateById = stateByIdFor(horizon);
    return STATE_IDS.map(id => [horizon, datasetDate, aggregate.method_id, aggregate.method_name,
      aggregate.lab_count, aggregate.model_count, id, stateById.get(id).name, aggregate.probabilities[id].toFixed(1),
      aggregate.unrounded_lab_balanced_probabilities[id], aggregate.equal_model_mean_probabilities[id]]);
  })
));

/* ---------- the published board ---------- */
write('forecasts.csv', csv(
  ['horizon', 'model', 'provider', 'api_model_id', 'asked_on', 'samples', 'question_set', 'prompt_sha256', 'ending_id', 'ending', 'family', 'extinction_tier',
   'probability_pct', 'samples_min_pct', 'samples_max_pct', 'middle_half_low_pct', 'middle_half_high_pct'],
  runs.flatMap(({ horizon, apiId, run }) => STATE_IDS.map(id => {
    const state = stateByIdFor(horizon).get(id);
    return [horizon, run.label, run.provider, apiId, run.date, run.sampleCount, run.questionSet, run.promptSha256, id, state.name, state.family, tierOf(state),
      run.probabilities[id], run.range?.[id]?.[0], run.range?.[id]?.[1], run.quartiles?.[id]?.[0], run.quartiles?.[id]?.[1]];
  }))
));

/* ---------- extinction-risk exposure ---------- */
write('exposure.csv', csv(
  ['horizon', 'model', 'provider', 'api_model_id', 'asked_on', 'samples', 'question_set', 'prompt_sha256', 'humanity_gone_pct', 'might_perish_pct', 'total_exposure_pct', 'bootstrap_standard_error'],
  runs.map(({ horizon, apiId, run }) => {
    const sum = ids => ids.reduce((total, id) => total + run.probabilities[id], 0);
    return [horizon, run.label, run.provider, apiId, run.date, run.sampleCount, run.questionSet, run.promptSha256,
      sum([1, 2, 3]), sum([4, 5]), sum([1, 2, 3, 4, 5]), run.exposurePublished?.se ?? ''];
  })
));

/* ---------- reasoning ---------- */
write('rationales.csv', csv(
  ['horizon', 'model', 'api_model_id', 'asked_on', 'question_set', 'prompt_sha256', 'ending_id', 'ending', 'probability_pct', 'rationale'],
  runs.flatMap(({ horizon, apiId, run }) => STATE_IDS
    .filter(id => run.rationales?.[id])
    .map(id => [horizon, run.label, apiId, run.date, run.questionSet, run.promptSha256, id, stateByIdFor(horizon).get(id).name, run.probabilities[id], run.rationales[id]]))
));

/* ---------- every raw sample ---------- */
const sampleRows = [];
for (const file of readdirSync(join(root, 'runs')).filter(f => f.endsWith('.json')).sort()) {
  const batch = JSON.parse(readFileSync(join(root, 'runs', file), 'utf8'));
  if (batch.prompt_family !== 'end_states') continue;
  const horizon = horizonOfBatch(batch);
  const stateById = stateByIdFor(horizon);
  for (const sample of batch.samples || []) {
    for (const id of STATE_IDS) {
      sampleRows.push([horizon, batch.run_id, batch.model?.api_string, batch.model?.name, batch.asked_on, batch.question_set, batch.harness?.prompt_sha256,
        sample.sample, id, stateById.get(id).name, sample.answers?.['S' + id]?.value]);
    }
  }
}
write('samples.csv', csv(
  ['horizon', 'run_id', 'api_model_id', 'model', 'asked_on', 'question_set', 'prompt_sha256', 'sample', 'ending_id', 'ending', 'probability_pct'],
  sampleRows
));

/* ---------- answers the harness refused ---------- */
// Every batch records the attempts that were thrown away. Published nowhere
// until now, which meant a model quietly failing the schema on a fifth of its
// attempts looked identical to one that never missed.
const qualityRows = [];
for (const file of readdirSync(join(root, 'runs')).filter(f => f.endsWith('.json')).sort()) {
  const batch = JSON.parse(readFileSync(join(root, 'runs', file), 'utf8'));
  if (batch.prompt_family !== 'end_states') continue;
  const horizon = horizonOfBatch(batch);
  const failures = batch.harness?.failures ?? [];
  // Batches written before failures carried a kind hold validation rejections
  // only, which is what an absent kind means.
  const byKind = kind => failures.filter(f => (f.kind ?? 'permanent') === kind).length;
  const kept = (batch.samples || []).length;
  const rejected = byKind('permanent');
  const attempts = kept + rejected;
  qualityRows.push([
    horizon, batch.model?.name, batch.model?.api_string, batch.asked_on, batch.question_set, batch.harness?.prompt_sha256, kept, rejected,
    byKind('transient'), byKind('quota'),
    attempts ? (rejected / attempts * 100).toFixed(1) : '0.0',
    [...new Set(failures.filter(f => (f.kind ?? 'permanent') === 'permanent').map(f => f.reason))].join(' | ')
  ]);
}
write('quality.csv', csv(
  ['horizon', 'model', 'api_model_id', 'asked_on', 'question_set', 'prompt_sha256', 'samples_kept', 'answers_rejected',
   'transient_errors', 'quota_errors', 'reject_rate_pct', 'rejection_reasons'],
  qualityRows
));

/* ---------- the taxonomy ---------- */
write('endings.csv', csv(
  ['horizon', 'ending_id', 'ending', 'family', 'extinction_tier', 'description'],
  HORIZON_IDS.flatMap(horizon => statesFor(horizon).map(s => [horizon, s.id, s.name, s.family, tierOf(s), s.description]))
));

/* ---------- everything, structured ---------- */
write('forecasts.json', JSON.stringify({
  default_horizon: defaultHorizon,
  horizons: horizonMetadata,
  generated_from: 'public/data.js and runs/',
  endings: states.map(s => ({ id: s.id, name: s.name, family: s.family, extinction_tier: tierOf(s) || null, description: s.description })),
  endings_by_horizon: Object.fromEntries(HORIZON_IDS.map(horizon => [horizon,
    statesFor(horizon).map(s => ({ id: s.id, name: s.name, family: s.family, extinction_tier: tierOf(s) || null, description: s.description }))
  ])),
  datasets: Object.fromEntries(HORIZON_IDS.map(horizon => [horizon, {
    dataset_date: datasets[horizon]?.datasetDate || null,
    aggregate: aggregates[horizon] || null,
    models: runs.filter(run => run.horizon === horizon).map(({ apiId, run }) => ({
      model: run.label, provider: run.provider, api_model_id: apiId,
      asked_on: run.date, samples: run.sampleCount, question_set: run.questionSet,
      prompt_sha256: run.promptSha256, prompt_version: run.promptVersion,
      probabilities: run.probabilities, samples_range: run.range, middle_half: run.quartiles,
      extinction_exposure: run.exposurePublished, rationales: run.rationales
    }))
  }]))
}, null, 2) + '\n');

console.log(`✓ data/ rebuilt from ${runs.length} published run(s) across ${horizonIds.length} horizon(s) and ${sampleRows.length / STATE_IDS.length} raw sample(s)`);
