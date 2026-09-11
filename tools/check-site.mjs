#!/usr/bin/env node
// Invariant check for the published site data, run in CI after import.
//
// The importer guarantees its own inputs; this checks what actually ships:
// that every run is a valid allocation, that the aggregate the homepage
// headlines is one too, and that the uncertainty attached to the exposure
// chart describes the figure the chart draws.
//
// Usage: node tools/check-site.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_HORIZON, HORIZONS, HORIZON_IDS, HORIZON_RUN_CONFIG, compareRunPreference, horizonOfBatch, renderHorizonPrompt } from './horizons.mjs';
import { labBalancedMean, quantizeAllocation } from './allocations.mjs';

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
const badgeOf = iso => {
  const [year, month, day] = iso.split('-');
  return `${month}.${day}.${year.slice(2)}`;
};

// Re-read the current raw instrument solely to verify the model and lab counts
// recorded in every historical leader entry. This is deliberately independent
// of the generated public/data.js timeline it checks.
const historyBatches = readdirSync(join(root, 'runs')).filter(file => file.endsWith('.json')).flatMap(file => {
  const batch = JSON.parse(readFileSync(join(root, 'runs', file), 'utf8'));
  if (batch.prompt_family !== 'end_states' || !batch.samples?.length || !batch.model?.provider) return [];
  let horizon;
  try { horizon = horizonOfBatch(batch); } catch { return []; }
  if (batch.question_set !== HORIZON_RUN_CONFIG[horizon].questionSet) return [];
  return [{
    file,
    horizon,
    asked_on: batch.asked_on,
    runKey: batch.model?.api_string || batch.model?.name || batch.run_id,
    provider: batch.model.provider,
    samples: batch.samples
  }];
});
const replayCounts = (horizon, date) => {
  const newest = new Map();
  for (const batch of historyBatches.filter(candidate => candidate.horizon === horizon && candidate.asked_on <= date)) {
    const prior = newest.get(batch.runKey);
    if (!prior || compareRunPreference(batch, prior) < 0) newest.set(batch.runKey, batch);
  }
  const chosen = [...newest.values()];
  return { models: chosen.length, labs: new Set(chosen.map(batch => batch.provider.trim())).size };
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
  const snapshotHorizons = HORIZON_IDS.filter(horizon => horizon !== DEFAULT_HORIZON);
  const canonicalSnapshot = JSON.stringify(publicTaxonomy(statesByHorizon[snapshotHorizons[0]]));
  if (snapshotHorizons.some(horizon => JSON.stringify(publicTaxonomy(statesByHorizon[horizon])) !== canonicalSnapshot)) {
    problems.push(`${snapshotHorizons.join(', ')} snapshot taxonomies must use the same copy`);
  }
}

// The site first averages model vectors within each lab, then gives every lab
// equal weight. Run the same assertion independently for each horizon.
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
    if (typeof run.provider !== 'string' || !run.provider.trim()) problems.push(`${runPrefix}: provider/lab is missing`);
    else if (run.provider !== run.provider.trim()) problems.push(`${runPrefix}: provider/lab has surrounding whitespace`);
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

  const rows = entries.map(([, run]) => ({
    lab: run.provider,
    values: STATE_IDS.map(id => run.probabilities[id])
  }));
  const rawAggregate = labBalancedMean(rows);
  const total = rawAggregate.reduce((acc, value) => acc + value, 0);
  const out = quantizeAllocation(rawAggregate);
  const labs = new Set(rows.map(row => row.lab.trim())).size;
  if (Math.abs(total - 100) > 1e-9) problems.push(`${prefix} raw lab-balanced mean sums to ${total}, not 100`);
  const aggregateTenths = out.reduce((acc, value) => acc + Math.round(value * 10), 0);
  if (aggregateTenths !== 1000) problems.push(`${prefix} headline aggregate quantizes to ${aggregateTenths / 10}, not 100.0`);
  if (out.some(value => Math.abs(value * 10 - Math.round(value * 10)) > 1e-9)) {
    problems.push(`${prefix} headline aggregate is not expressed in tenths`);
  }

  if (entries.length >= 2 && !timeline.length) problems.push(`${prefix} leaderHistory is empty despite ${entries.length} published models`);
  if (timeline.length) {
    const dates = timeline.map(entry => entry.date);
    if (dates.some((date, index) => index && date <= dates[index - 1])) problems.push(`${prefix} leaderHistory dates are not in ascending order`);
    const counts = timeline.map(entry => entry.models);
    if (counts.some((count, index) => index && count < counts[index - 1])) problems.push(`${prefix} leaderHistory model count goes backwards`);
    const labCounts = timeline.map(entry => entry.labs);
    if (labCounts.some((count, index) => index && count < labCounts[index - 1])) problems.push(`${prefix} leaderHistory lab count goes backwards`);
    timeline.forEach((entry, index) => {
      const replayed = replayCounts(horizon, entry.date);
      if (!STATE_IDS.includes(entry.stateId)) problems.push(`${prefix} leaderHistory ${entry.date} names ending ${entry.stateId}, which is not in the taxonomy`);
      if (!Number.isFinite(entry.share) || entry.share < 0 || entry.share > 100 || Math.abs(entry.share * 10 - Math.round(entry.share * 10)) > 1e-9) {
        problems.push(`${prefix} leaderHistory ${entry.date} has invalid one-decimal share ${entry.share}`);
      }
      if (!Number.isInteger(entry.labs) || entry.labs < 1 || entry.labs > labs) problems.push(`${prefix} leaderHistory ${entry.date} has invalid lab count ${entry.labs}`);
      if (!Number.isInteger(entry.models) || entry.models < 2 || entry.models > entries.length) problems.push(`${prefix} leaderHistory ${entry.date} has invalid model count ${entry.models}`);
      if (entry.labs !== replayed.labs) problems.push(`${prefix} leaderHistory ${entry.date} records ${entry.labs} labs but raw-run replay has ${replayed.labs}`);
      if (entry.models !== replayed.models) problems.push(`${prefix} leaderHistory ${entry.date} records ${entry.models} models but raw-run replay has ${replayed.models}`);
      const differs = index === 0 || timeline[index - 1].stateId !== entry.stateId;
      if (entry.changed !== differs) problems.push(`${prefix} leaderHistory ${entry.date} is flagged changed=${entry.changed} but differs=${differs}`);
    });
    const latest = timeline.at(-1);
    const leaderIndex = out.indexOf(Math.max(...out));
    if (latest.stateId !== leaderIndex + 1) problems.push(`${prefix} leaderHistory ends on ending ${latest.stateId} but the aggregate leads with ${leaderIndex + 1}`);
    if (latest.share !== out[leaderIndex]) problems.push(`${prefix} leaderHistory ends at ${latest.share}% but the aggregate leader is ${out[leaderIndex]}%`);
    if (latest.labs !== labs) problems.push(`${prefix} leaderHistory ends with ${latest.labs} labs but ${labs} are published`);
    if (latest.models !== entries.length) problems.push(`${prefix} leaderHistory ends with ${latest.models} models but ${entries.length} are published`);
    if (newestDate && latest.date !== newestDate) problems.push(`${prefix} leaderHistory ends on ${latest.date}, not newest run date ${newestDate}`);
  }

  return { runs: entries.length, labs, timeline: timeline.length, total, aggregate: out };
}

const summaries = HORIZON_IDS.map(horizon => [horizon, validateDataset(horizon, datasets?.[horizon])]);
if (problems.length) { problems.forEach(p => console.error('✗ ' + p)); process.exit(1); }
const totalRuns = summaries.reduce((sum, [, summary]) => sum + summary.runs, 0);
const totalTimeline = summaries.reduce((sum, [, summary]) => sum + summary.timeline, 0);
console.log(`✓ ${totalRuns} runs valid across ${HORIZON_IDS.length} horizons, ${totalTimeline} timeline entries — datasets are isolated and every published allocation sums to 100`);
for (const [horizon, summary] of summaries) {
  if (!summary.runs) console.log(`  ${horizon}: empty, ready for initial collection`);
  else console.log(`  ${horizon}: ${summary.runs} models across ${summary.labs} labs; raw lab-balanced mean sums to ${summary.total.toFixed(6)}, published as ${summary.aggregate.join(', ')}`);
}
