#!/usr/bin/env node
// Invariant check for the published site data, run in CI after import.
//
// The importer guarantees its own inputs; this checks what actually ships:
// that every run is a valid allocation, that the aggregate the homepage
// headlines is one too, and that the uncertainty attached to the exposure
// chart describes the figure the chart draws.
//
// Usage: node tools/check-site.mjs
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_HORIZON, HORIZONS, HORIZON_IDS, HORIZON_RUN_CONFIG, renderHorizonPrompt } from './horizons.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const roster = JSON.parse(readFileSync(join(root, 'tools', 'models.json'), 'utf8')).models;
const activeModelIds = roster.filter(model => (model.status || 'active') === 'active').map(model => model.model);
const shim = {};
new Function('window', readFileSync(join(root, 'public', 'data.js'), 'utf8'))(shim);
if (!shim.MF_DATA) { console.error('✗ public/data.js did not publish window.MF_DATA'); process.exit(1); }
const { defaultHorizon, horizons, datasets, states, statesByHorizon } = shim.MF_DATA;
const STATE_IDS = Array.from({ length: 11 }, (_, i) => i + 1);
const EXPOSURE_IDS = [1, 2, 3, 4, 5];
const problems = [];
const median = list => { const s = [...list].sort((a, b) => a - b); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const quantile = (column, f) => { const k = (column.length - 1) * f, lo = Math.floor(k), hi = Math.ceil(k); return column[lo] + (column[hi] - column[lo]) * (k - lo); };
const badgeOf = iso => {
  const [year, month, day] = iso.split('-');
  return `${month}.${day}.${year.slice(2)}`;
};

if (defaultHorizon !== DEFAULT_HORIZON) problems.push(`defaultHorizon must be ${DEFAULT_HORIZON}, received ${JSON.stringify(defaultHorizon)}`);
if (!Array.isArray(horizons)) problems.push('horizons metadata must be an array');
if (!datasets || typeof datasets !== 'object' || Array.isArray(datasets)) problems.push('datasets must be an object');

const metadataIds = Array.isArray(horizons) ? horizons.map(horizon => horizon?.id) : [];
if (new Set(metadataIds).size !== metadataIds.length) problems.push('horizons metadata contains duplicate ids');
if (JSON.stringify(metadataIds) !== JSON.stringify(HORIZON_IDS)) {
  problems.push(`horizons metadata ids must be ${HORIZON_IDS.join(', ')} in display order`);
}
for (const expected of HORIZONS) {
  const actual = Array.isArray(horizons) ? horizons.find(horizon => horizon?.id === expected.id) : null;
  if (!actual) continue;
  if (actual.label !== expected.label) problems.push(`${expected.id}: horizon label must be ${JSON.stringify(expected.label)}`);
  if (actual.targetYear !== expected.targetYear) problems.push(`${expected.id}: targetYear must be ${expected.targetYear}`);
}
const datasetIds = datasets && typeof datasets === 'object' ? Object.keys(datasets) : [];
for (const id of HORIZON_IDS) if (!datasetIds.includes(id)) problems.push(`datasets is missing horizon ${id}`);
for (const id of datasetIds) if (!HORIZON_IDS.includes(id)) problems.push(`datasets contains unsupported horizon ${id}`);

const stateIds = Array.isArray(states) ? states.map(state => state?.id) : [];
if (JSON.stringify(stateIds) !== JSON.stringify(STATE_IDS)) problems.push('states must contain canonical ids 1 through 11 in order');

const publicTaxonomy = list => (list || []).map(({ id, name, family, description }) => ({ id, name, family, description }));
const promptTaxonomy = horizon => {
  const file = HORIZON_RUN_CONFIG[horizon].promptFile;
  const source = readFileSync(join(root, file), 'utf8');
  const prompt = source.match(/^--- PROMPT BEGINS ---$([\s\S]*?)^--- PROMPT ENDS ---$/m)?.[1] || '';
  return [...prompt.matchAll(/^### (\d+)\. (.+?)(?: [⧖⚠])?\n\n\*\*Family:\*\* (.+)\n\n([\s\S]*?)(?=\n\n### |\s*$)/gm)]
    .map(match => ({ id: Number(match[1]), name: match[2], family: match[3], description: match[4].trim() }));
};

if (!statesByHorizon || typeof statesByHorizon !== 'object' || Array.isArray(statesByHorizon)) {
  problems.push('statesByHorizon must be an object');
} else {
  const taxonomyIds = Object.keys(statesByHorizon);
  for (const id of HORIZON_IDS) if (!taxonomyIds.includes(id)) problems.push(`statesByHorizon is missing horizon ${id}`);
  for (const id of taxonomyIds) if (!HORIZON_IDS.includes(id)) problems.push(`statesByHorizon contains unsupported horizon ${id}`);
  if (statesByHorizon[DEFAULT_HORIZON] !== states) problems.push('statesByHorizon long-term must preserve the base states array');
  for (const horizon of HORIZON_IDS) {
    const taxonomy = statesByHorizon[horizon];
    if (!Array.isArray(taxonomy) || JSON.stringify(taxonomy.map(state => state?.id)) !== JSON.stringify(STATE_IDS)) {
      problems.push(`statesByHorizon ${horizon} must contain canonical ids 1 through 11 in order`);
      continue;
    }
    taxonomy.forEach((state, index) => {
      const base = states[index];
      for (const field of ['id', 'name', 'color', 'extinction']) {
        if (state[field] !== base[field]) problems.push(`statesByHorizon ${horizon} changes invariant ${field} for S${index + 1}`);
      }
      if (!String(state.family || '').trim()) problems.push(`statesByHorizon ${horizon} S${index + 1} has no family`);
      if (!String(state.description || '').trim()) problems.push(`statesByHorizon ${horizon} S${index + 1} has no description`);
    });
    const inPrompt = promptTaxonomy(horizon);
    if (JSON.stringify(publicTaxonomy(taxonomy)) !== JSON.stringify(inPrompt)) {
      problems.push(`statesByHorizon ${horizon} does not match the taxonomy in ${HORIZON_RUN_CONFIG[horizon].promptFile}`);
    }
  }
  if (JSON.stringify(publicTaxonomy(statesByHorizon['2030'])) !== JSON.stringify(publicTaxonomy(statesByHorizon['2040']))) {
    problems.push('2030 and 2040 snapshot taxonomies must use the same copy');
  }
}

// Coordinate-wise medians need not sum to 100, which is why the site
// renormalizes them. Run the same assertion independently for each horizon.
function validateDataset(horizon, dataset) {
  const prefix = `[${horizon}]`;
  if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset)) {
    problems.push(`${prefix} dataset must be an object`);
    return { runs: 0, timeline: 0, total: null, aggregate: null };
  }

  const runs = dataset.endStateRuns;
  const leaderHistory = dataset.leaderHistory;
  if (!runs || typeof runs !== 'object' || Array.isArray(runs)) problems.push(`${prefix} endStateRuns must be an object`);
  if (!Array.isArray(leaderHistory)) problems.push(`${prefix} leaderHistory must be an array`);
  const entries = runs && typeof runs === 'object' && !Array.isArray(runs) ? Object.entries(runs) : [];
  const timeline = Array.isArray(leaderHistory) ? leaderHistory : [];

  // Empty future horizons are valid before their first paid collection. Once a
  // run lands, the ordinary dataset-date and aggregate invariants become strict.
  if (!entries.length) {
    if (horizon === defaultHorizon) problems.push(`${prefix} default dataset has no runs`);
    if (dataset.datasetDate !== null) problems.push(`${prefix} empty datasetDate must be null`);
    if (timeline.length) problems.push(`${prefix} empty dataset must not have leader history`);
    return { runs: 0, timeline: timeline.length, total: null, aggregate: null };
  }

  // A partially collected horizon must never look like a complete board. Empty
  // future placeholders are allowed above; once the first batch is published,
  // every currently active roster model is required. Historical paused or
  // retired extras remain valid provenance and are not removed from old views.
  const publishedModelIds = new Set(entries.map(([key]) => key));
  const missingActive = activeModelIds.filter(id => !publishedModelIds.has(id));
  if (missingActive.length) problems.push(`${prefix} populated dataset is missing ${missingActive.length} active model(s): ${missingActive.join(', ')}`);

  const newestDate = entries.map(([, run]) => run.date).filter(Boolean).sort().at(-1);
  if (!newestDate) problems.push(`${prefix} published runs have no dates`);
  else if (dataset.datasetDate !== badgeOf(newestDate)) problems.push(`${prefix} datasetDate ${JSON.stringify(dataset.datasetDate)} does not match newest run ${newestDate}`);

  for (const [key, run] of entries) {
    const runPrefix = `${prefix} ${key}`;
    if (run.horizon !== horizon) problems.push(`${runPrefix}: horizon is ${JSON.stringify(run.horizon)}`);
    if (run.questionSet !== HORIZON_RUN_CONFIG[horizon].questionSet) {
      problems.push(`${runPrefix}: questionSet is ${JSON.stringify(run.questionSet)}, expected ${HORIZON_RUN_CONFIG[horizon].questionSet}`);
    }
    if (horizon !== DEFAULT_HORIZON && !/^[a-f0-9]{64}$/.test(run.promptSha256 || '')) {
      problems.push(`${runPrefix}: current snapshot run has no promptSha256`);
    }
    if (run.promptSha256) {
      try {
        const expectedPromptHash = renderHorizonPrompt(root, horizon, run.date).identity.prompt_sha256;
        if (run.promptSha256 !== expectedPromptHash) problems.push(`${runPrefix}: promptSha256 does not match the current dated prompt`);
      } catch (error) {
        problems.push(`${runPrefix}: cannot verify promptSha256 (${error.message})`);
      }
    }
    const values = STATE_IDS.map(id => run.probabilities?.[id]);
    if (values.some(value => !Number.isInteger(value) || value < 0 || value > 100)) problems.push(`${runPrefix}: probabilities must be integers 0-100`);
    const sum = values.reduce((acc, value) => acc + (value || 0), 0);
    if (sum !== 100) problems.push(`${runPrefix}: probabilities sum to ${sum}, not 100`);

    for (const id of STATE_IDS) {
      const band = run.range?.[id];
      if (band && (run.probabilities[id] < band[0] || run.probabilities[id] > band[1])) {
        problems.push(`${runPrefix}: S${id} published ${run.probabilities[id]}% outside its sample range ${band[0]}-${band[1]}%`);
      }
    }

    // The exposure chart draws the five extinction-risk segments and labels the
    // sum; the uncertainty beside it has to belong to that same number.
    const drawn = EXPOSURE_IDS.reduce((acc, id) => acc + run.probabilities[id], 0);
    const published = run.exposurePublished;
    if (!published || !Number.isFinite(published.se)) problems.push(`${runPrefix}: exposurePublished.se missing`);
    else if (published.value !== drawn) problems.push(`${runPrefix}: exposurePublished.value ${published.value} != drawn total ${drawn}`);
  }

  const medians = STATE_IDS.map(id => median(entries.map(([, run]) => run.probabilities[id])));
  const total = medians.reduce((acc, value) => acc + value, 0);
  const columns = STATE_IDS.map(id => entries.map(([, run]) => run.probabilities[id]).sort((a, b) => a - b));
  const scaled = medians.map(value => (value / total) * 100);
  const out = scaled.map(Math.floor);
  const order = scaled.map((value, index) => [value - out[index], index]).sort((a, b) => b[0] - a[0]).map(([, index]) => index);
  let given = 0;
  const shortfall = 100 - out.reduce((acc, value) => acc + value, 0);
  for (const bounds of [columns.map(column => quantile(column, 0.75)), columns.map(column => column.at(-1)), null]) {
    if (given >= shortfall) break;
    for (const index of order) {
      if (given >= shortfall) break;
      if (bounds && out[index] + 1 > bounds[index]) continue;
      out[index] += 1; given += 1;
    }
  }
  const aggregateSum = out.reduce((acc, value) => acc + value, 0);
  if (aggregateSum !== 100) problems.push(`${prefix} headline aggregate normalises to ${aggregateSum}, not 100`);
  for (const [index, id] of STATE_IDS.entries()) {
    const column = columns[index];
    const low = quantile(column, 0.25), high = quantile(column, 0.75);
    if (out[index] < low || out[index] > high) {
      problems.push(`${prefix} headline S${id} published ${out[index]}% outside the models' middle half ${low}-${high}%`);
    }
  }

  if (entries.length >= 2 && !timeline.length) problems.push(`${prefix} leaderHistory is empty despite ${entries.length} published models`);
  if (timeline.length) {
    const dates = timeline.map(entry => entry.date);
    if (dates.some((date, index) => index && date <= dates[index - 1])) problems.push(`${prefix} leaderHistory dates are not in ascending order`);
    const counts = timeline.map(entry => entry.models);
    if (counts.some((count, index) => index && count < counts[index - 1])) problems.push(`${prefix} leaderHistory model count goes backwards`);
    timeline.forEach((entry, index) => {
      if (!STATE_IDS.includes(entry.stateId)) problems.push(`${prefix} leaderHistory ${entry.date} names ending ${entry.stateId}, which is not in the taxonomy`);
      if (!Number.isInteger(entry.share) || entry.share < 0 || entry.share > 100) problems.push(`${prefix} leaderHistory ${entry.date} has invalid share ${entry.share}`);
      if (!Number.isInteger(entry.models) || entry.models < 2 || entry.models > entries.length) problems.push(`${prefix} leaderHistory ${entry.date} has invalid model count ${entry.models}`);
      const differs = index === 0 || timeline[index - 1].stateId !== entry.stateId;
      if (entry.changed !== differs) problems.push(`${prefix} leaderHistory ${entry.date} is flagged changed=${entry.changed} but differs=${differs}`);
    });
    const latest = timeline.at(-1);
    const leaderIndex = out.indexOf(Math.max(...out));
    if (latest.stateId !== leaderIndex + 1) problems.push(`${prefix} leaderHistory ends on ending ${latest.stateId} but the aggregate leads with ${leaderIndex + 1}`);
    if (latest.share !== out[leaderIndex]) problems.push(`${prefix} leaderHistory ends at ${latest.share}% but the aggregate leader is ${out[leaderIndex]}%`);
    if (latest.models !== entries.length) problems.push(`${prefix} leaderHistory ends with ${latest.models} models but ${entries.length} are published`);
    if (newestDate && latest.date !== newestDate) problems.push(`${prefix} leaderHistory ends on ${latest.date}, not newest run date ${newestDate}`);
  }

  return { runs: entries.length, timeline: timeline.length, total, aggregate: out };
}

const summaries = HORIZON_IDS.map(horizon => [horizon, validateDataset(horizon, datasets?.[horizon])]);
if (problems.length) { problems.forEach(p => console.error('✗ ' + p)); process.exit(1); }
const totalRuns = summaries.reduce((sum, [, summary]) => sum + summary.runs, 0);
const totalTimeline = summaries.reduce((sum, [, summary]) => sum + summary.timeline, 0);
console.log(`✓ ${totalRuns} runs valid across ${HORIZON_IDS.length} horizons, ${totalTimeline} timeline entries — datasets are isolated and every published allocation sums to 100`);
for (const [horizon, summary] of summaries) {
  if (!summary.runs) console.log(`  ${horizon}: empty, ready for initial collection`);
  else console.log(`  ${horizon}: ${summary.runs} runs; raw medians sum to ${summary.total}, published as ${summary.aggregate.join(', ')}`);
}
