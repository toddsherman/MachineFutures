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

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'data');
mkdirSync(outDir, { recursive: true });

// data.js is a browser IIFE that hangs its payload on window; give it one.
const shim = { };
new Function('window', readFileSync(join(root, 'public', 'data.js'), 'utf8'))(shim);
const { states, endStateRuns, datasetDate } = shim.MF_DATA;

const STATE_IDS = states.map(s => s.id);
const stateById = new Map(states.map(s => [s.id, s]));
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

const runs = Object.entries(endStateRuns);

/* ---------- the published board ---------- */
write('forecasts.csv', csv(
  ['model', 'provider', 'api_model_id', 'asked_on', 'samples', 'ending_id', 'ending', 'family', 'extinction_tier',
   'probability_pct', 'samples_min_pct', 'samples_max_pct', 'middle_half_low_pct', 'middle_half_high_pct'],
  runs.flatMap(([apiId, run]) => STATE_IDS.map(id => {
    const state = stateById.get(id);
    return [run.label, run.provider, apiId, run.date, run.sampleCount, id, state.name, state.family, tierOf(state),
      run.probabilities[id], run.range?.[id]?.[0], run.range?.[id]?.[1], run.quartiles?.[id]?.[0], run.quartiles?.[id]?.[1]];
  }))
));

/* ---------- extinction-risk exposure ---------- */
write('exposure.csv', csv(
  ['model', 'provider', 'api_model_id', 'asked_on', 'samples', 'humanity_gone_pct', 'might_perish_pct', 'total_exposure_pct', 'bootstrap_standard_error'],
  runs.map(([apiId, run]) => {
    const sum = ids => ids.reduce((total, id) => total + run.probabilities[id], 0);
    return [run.label, run.provider, apiId, run.date, run.sampleCount,
      sum([1, 2, 3]), sum([4, 5]), sum([1, 2, 3, 4, 5]), run.exposurePublished?.se ?? ''];
  })
));

/* ---------- reasoning ---------- */
write('rationales.csv', csv(
  ['model', 'api_model_id', 'asked_on', 'ending_id', 'ending', 'probability_pct', 'rationale'],
  runs.flatMap(([apiId, run]) => STATE_IDS
    .filter(id => run.rationales?.[id])
    .map(id => [run.label, apiId, run.date, id, stateById.get(id).name, run.probabilities[id], run.rationales[id]]))
));

/* ---------- every raw sample ---------- */
const sampleRows = [];
for (const file of readdirSync(join(root, 'runs')).filter(f => f.endsWith('.json')).sort()) {
  const batch = JSON.parse(readFileSync(join(root, 'runs', file), 'utf8'));
  if (batch.prompt_family !== 'end_states') continue;
  for (const sample of batch.samples || []) {
    for (const id of STATE_IDS) {
      sampleRows.push([batch.run_id, batch.model?.api_string, batch.model?.name, batch.asked_on,
        sample.sample, id, stateById.get(id).name, sample.answers?.['S' + id]?.value]);
    }
  }
}
write('samples.csv', csv(
  ['run_id', 'api_model_id', 'model', 'asked_on', 'sample', 'ending_id', 'ending', 'probability_pct'],
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
  const failures = batch.harness?.failures ?? [];
  // Batches written before failures carried a kind hold validation rejections
  // only, which is what an absent kind means.
  const byKind = kind => failures.filter(f => (f.kind ?? 'permanent') === kind).length;
  const kept = (batch.samples || []).length;
  const rejected = byKind('permanent');
  const attempts = kept + rejected;
  qualityRows.push([
    batch.model?.name, batch.model?.api_string, batch.asked_on, kept, rejected,
    byKind('transient'), byKind('quota'),
    attempts ? (rejected / attempts * 100).toFixed(1) : '0.0',
    [...new Set(failures.filter(f => (f.kind ?? 'permanent') === 'permanent').map(f => f.reason))].join(' | ')
  ]);
}
write('quality.csv', csv(
  ['model', 'api_model_id', 'asked_on', 'samples_kept', 'answers_rejected',
   'transient_errors', 'quota_errors', 'reject_rate_pct', 'rejection_reasons'],
  qualityRows
));

/* ---------- the taxonomy ---------- */
write('endings.csv', csv(
  ['ending_id', 'ending', 'family', 'extinction_tier', 'description'],
  states.map(s => [s.id, s.name, s.family, tierOf(s), s.description])
));

/* ---------- everything, structured ---------- */
write('forecasts.json', JSON.stringify({
  dataset_date: datasetDate,
  generated_from: 'public/data.js and runs/',
  endings: states.map(s => ({ id: s.id, name: s.name, family: s.family, extinction_tier: tierOf(s) || null, description: s.description })),
  models: runs.map(([apiId, run]) => ({
    model: run.label, provider: run.provider, api_model_id: apiId,
    asked_on: run.date, samples: run.sampleCount, prompt_version: run.promptVersion,
    probabilities: run.probabilities, samples_range: run.range, middle_half: run.quartiles,
    extinction_exposure: run.exposurePublished, rationales: run.rationales
  }))
}, null, 2) + '\n');

console.log(`✓ data/ rebuilt from ${runs.length} published run(s) and ${sampleRows.length / STATE_IDS.length} raw sample(s)`);
