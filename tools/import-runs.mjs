#!/usr/bin/env node
// Import raw batch files from runs/ into public/data.js.
//
// Reads every end-state batch in runs/ — written by tools/run-elicitation.mjs
// or exported by forecast-ingest_1.html — and rewrites the IMPORTED END-STATE
// RUNS block in public/data.js with each model's newest run in each horizon:
// median allocation per state, renormalized to integers summing to 100.
//
// Usage: node tools/import-runs.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_HORIZON, HORIZONS, HORIZON_IDS, HORIZON_RUN_CONFIG, compareRunPreference, horizonOfBatch } from './horizons.mjs';
import { renormalizeAllocation } from './allocations.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const runsDir = join(root, 'runs');
const FORCE = process.argv.includes('--force');
const dataPath = join(root, 'public', 'data.js');

// The roster is the source of display identity and ordering. Batches whose
// model id is not in it (hand-ingested, or a retired entry) still import.
const roster = JSON.parse(readFileSync(join(root, 'tools', 'models.json'), 'utf8')).models;
const rosterByModel = new Map(roster.map((m, order) => [m.model, { ...m, order }]));
const STATE_IDS = Array.from({ length: 11 }, (_, i) => 'S' + (i + 1));
const SHORT_LABELS = { Anthropic: 'ANT', OpenAI: 'OAI', Google: 'GDM', xAI: 'XAI', Meta: 'MET', DeepSeek: 'DSK', Mistral: 'MIS', Moonshot: 'KMI' };
// Extinction-risk exposure per sample, so its standard error can be published
// alongside the figure. States 1-5 are the extinction-risk tiers — a fixed
// property of the taxonomy, stated in rule 3 of public/end_states.md.
const GONE_IDS = ['S1', 'S2', 'S3'];
const RISK_IDS = ['S4', 'S5'];
const EXPOSURE_IDS = [...GONE_IDS, ...RISK_IDS];

// Quartiles of a model's own samples, so its middle half can be drawn the same
// way the middle half across models is.
const quartile = (sorted, f) => {
  const i = (sorted.length - 1) * f, lo = Math.floor(i), hi = Math.ceil(i);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo));
};
const quartilesFor = (samples, id) => {
  const vals = samples.map(s => s.answers?.[id]?.value).filter(Number.isFinite).sort((a, b) => a - b);
  return vals.length ? [quartile(vals, 0.25), quartile(vals, 0.75)] : null;
};

// Deterministic PRNG, seeded per model, so re-running the importer reproduces
// public/data.js byte for byte rather than jittering the bootstrap each time.
const mulberry32 = seed => () => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const seedFrom = text => {
  let h = 2166136261;
  for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

const median = sorted => {
  const n = sorted.length;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
};
const columnsOf = samples => STATE_IDS.map(id =>
  samples.map(s => s.answers?.[id]?.value).filter(Number.isFinite).sort((a, b) => a - b));

// The figure the site publishes for a state is the coordinate-wise median of
// that model's samples, renormalized. Anything claiming to be its uncertainty
// has to describe that estimator.
function publishedVector(samples) {
  const cols = columnsOf(samples);
  if (cols.some(col => !col.length)) return null;
  return renormalizeAllocation(
    cols.map(median),
    cols.map(col => [col[0], col.at(-1)]),
    cols.map(col => [quartile(col, 0.25), quartile(col, 0.75)])
  );
}

// Bootstrap rather than a closed form: the published total is a sum of five
// renormalized medians, which has no tidy standard error. Resampling the run's
// own samples measures the spread of the number actually shown. The mean of
// per-sample totals was standing in for this, and the two disagree enough to
// reorder the board — 61 vs 59.8 for one model, 59 vs 60.3 for another.
function publishedExposure(samples, seedKey, draws = 2000) {
  if (samples.length < 2) return null;
  const vector = publishedVector(samples);
  if (!vector) return null;
  const exposureAt = vec => EXPOSURE_IDS.reduce((sum, id) => sum + vec[STATE_IDS.indexOf(id)], 0);
  const random = mulberry32(seedFrom(seedKey));
  const totals = [];
  for (let draw = 0; draw < draws; draw++) {
    const resample = Array.from({ length: samples.length }, () => samples[Math.floor(random() * samples.length)]);
    const vec = publishedVector(resample);
    if (vec) totals.push(exposureAt(vec));
  }
  if (totals.length < 2) return null;
  const mean = totals.reduce((a, c) => a + c, 0) / totals.length;
  const sd = Math.sqrt(totals.reduce((a, c) => a + (c - mean) ** 2, 0) / (totals.length - 1));
  return {
    value: exposureAt(vector),
    se: Math.round((sd) * 100) / 100,
    draws: totals.length
  };
}

const summarise = totals => {
  if (!totals.length) return null;
  const mean = totals.reduce((a, c) => a + c, 0) / totals.length;
  const sd = Math.sqrt(totals.reduce((a, c) => a + (c - mean) ** 2, 0) / totals.length);
  return {
    n: totals.length,
    mean: Math.round(mean * 10) / 10,
    se: Math.round((sd / Math.sqrt(totals.length)) * 100) / 100,
    min: Math.min(...totals),
    max: Math.max(...totals)
  };
};

// Each tier is summed per sample and summarised on its own. The two errors do
// not add to the total's: the tiers are parts of one allocation and move
// against each other, so the total is measured directly rather than combined.
function exposureStats(samples) {
  const sum = (sample, ids) => ids.reduce((total, id) => total + (sample.answers?.[id]?.value ?? 0), 0);
  const total = summarise(samples.map(s => sum(s, EXPOSURE_IDS)).filter(Number.isFinite));
  if (!total) return null;
  return {
    ...total,
    gone: summarise(samples.map(s => sum(s, GONE_IDS)).filter(Number.isFinite)),
    risk: summarise(samples.map(s => sum(s, RISK_IDS)).filter(Number.isFinite))
  };
}

const runKeyOf = batch => batch.model?.api_string || batch.model?.name || batch.run_id;
const stripProvider = name => String(name || 'unknown').replace(/\s*\((?:OpenAI|Anthropic|Google|xAI|Meta|DeepSeek|mock)\)\s*$/, '');

const files = readdirSync(runsDir).filter(f => f.endsWith('.json')).sort();
const endStateBatches = [];
const rawEndStateBatches = [];
const outdatedBatches = [];
const problems = [];

for (const file of files) {
  const batch = JSON.parse(readFileSync(join(runsDir, file), 'utf8'));
  if (batch.prompt_family === 'end_states') {
    let horizon;
    try { horizon = horizonOfBatch(batch); }
    catch (error) { problems.push(`${file}: ${error.message}`); continue; }
    const provider = batch.model?.provider;
    if (!provider) { problems.push(`${file}: batch has no model.provider`); continue; }
    const missing = STATE_IDS.filter(id => { const a = batch.aggregate?.[id]; return !a || !a.n || typeof a.median !== 'number'; });
    if (missing.length) { problems.push(`${file}: aggregate missing ${missing.join(', ')}`); continue; }
    const outOfRange = STATE_IDS.filter(id => {
      const a = batch.aggregate[id];
      return !(a.median >= 0 && a.median <= 100) || !(a.min >= 0) || !(a.max <= 100) || a.min > a.median || a.median > a.max;
    });
    if (outOfRange.length) { problems.push(`${file}: median/min/max outside 0-100 or out of order for ${outOfRange.join(', ')}`); continue; }
    const sampleList = batch.samples || [];
    if (!sampleList.length) { problems.push(`${file}: no samples`); continue; }
    // Batches written by harness v2 carry a digest. A mismatch means the file
    // was truncated or edited after it was written, and it must not be published.
    if (batch.integrity?.digest) {
      const digest = createHash('sha256')
        .update(JSON.stringify(sampleList.map(s => ({ sample: s.sample, answers: s.answers }))))
        .digest('hex');
      if (digest !== batch.integrity.digest) { problems.push(`${file}: integrity digest mismatch — the samples changed after the batch was written`); continue; }
      if (batch.integrity.n_samples !== sampleList.length) { problems.push(`${file}: declares ${batch.integrity.n_samples} samples, holds ${sampleList.length}`); continue; }
    }
    const badSample = sampleList.findIndex(sample => {
      const values = STATE_IDS.map(id => sample.answers?.[id]?.value);
      if (values.some(v => !Number.isInteger(v) || v < 0 || v > 100)) return true;
      return values.reduce((a, c) => a + c, 0) !== 100;
    });
    if (badSample !== -1) { problems.push(`${file}: sample ${badSample} is not eleven integers summing to 100`); continue; }
    const questionSet = batch.question_set || null;
    const currentQuestionSet = HORIZON_RUN_CONFIG[horizon].questionSet;
    // Raw v1 snapshot runs remain in runs/ as provenance, but they measured a
    // materially different instrument. Never blend them into a v2 board or
    // replay them as if the dated taxonomy had not changed.
    if (questionSet !== currentQuestionSet) {
      outdatedBatches.push({ file, horizon, questionSet, currentQuestionSet });
      continue;
    }
    const medians = STATE_IDS.map(id => batch.aggregate[id].median);
    const quartiles = Object.fromEntries(STATE_IDS.map((id, i) => [i + 1, quartilesFor(batch.samples || [], id)]).filter(([, q]) => q));
    const probs = renormalizeAllocation(
      medians,
      STATE_IDS.map(id => [batch.aggregate[id].min, batch.aggregate[id].max]),
      STATE_IDS.map((id, i) => quartiles[i + 1] || null)
    );
    if (probs.reduce((a, c) => a + c, 0) !== 100) { problems.push(`${file}: renormalized probabilities sum to ${probs.reduce((a, c) => a + c, 0)}, not 100`); continue; }
    rawEndStateBatches.push({
      file, run_id: batch.run_id, asked_on: batch.asked_on, runKey: runKeyOf(batch), horizon,
      questionSet, promptSha256: batch.harness?.prompt_sha256 || null, samples: batch.samples || []
    });
    endStateBatches.push({
      file,
      runKey: runKeyOf(batch),
      horizon,
      provider,
      model: stripProvider(batch.model?.name),
      date: batch.asked_on,
      questionSet,
      promptSha256: batch.harness?.prompt_sha256 || null,
      promptVersion: Number((batch.question_set || '').match(/end-states(?:-\d{4})?-v(\d+)/)?.[1]) || null,
      knowledgeCutoff: batch.model?.self_reported_cutoff || null,
      sampleCount: sampleList.length,
      probabilities: Object.fromEntries(probs.map((p, i) => [i + 1, p])),
      // Spread is what tells a reader whether a gap between two models means
      // anything, so carry it through rather than publishing bare medians.
      range: Object.fromEntries(STATE_IDS.map((id, i) => [i + 1, [batch.aggregate[id].min, batch.aggregate[id].max]])),
      quartiles,
      exposure: exposureStats(batch.samples || []),
      // Keyed on the run so the bootstrap is reproducible per model.
      // Preserve the historical long-term bootstrap exactly; short horizons
      // add their id so equal model ids remain independently reproducible.
      exposurePublished: publishedExposure(batch.samples || [], horizon === DEFAULT_HORIZON ? runKeyOf(batch) : `${horizon}:${runKeyOf(batch)}`),
      rationales: Object.fromEntries(STATE_IDS.map((id, i) => [i + 1, String(batch.aggregate[id].rationale || '')]))
    });
    continue;
  }
  problems.push(`${file}: unsupported prompt_family "${batch.prompt_family}" (the 2030 benchmark was retired; see archive/)`);
}

if (problems.length) { problems.forEach(p => console.error('✗ ' + p)); process.exit(1); }

const indent = '    ';

// One entry per model and horizon (not per provider), newest asked_on wins.
// Horizon is part of the identity: without it a same-day 2030 batch can replace
// the long-term forecast for the same API model id.
const endStateByHorizon = Object.fromEntries(HORIZON_IDS.map(horizon => [horizon, {}]));
const byModel = new Map();
for (const b of endStateBatches) {
  const identity = `${b.horizon}\0${b.runKey}`;
  if (!byModel.has(identity)) byModel.set(identity, []);
  byModel.get(identity).push(b);
}
for (const [, batches] of byModel) {
  // Newest date wins, but a tie goes to the batch with more samples: a rerun
  // on the same day used to replace a twenty-sample run with a three-sample
  // one purely because it was read second.
  const ranked = [...batches].sort(compareRunPreference);
  const chosen = ranked[0];
  const richest = [...batches].sort((a, b) => b.sampleCount - a.sampleCount)[0];
  if (chosen.sampleCount < richest.sampleCount && !FORCE) {
    problems.push(`${chosen.file}: publishing it would drop ${chosen.horizon}/${chosen.runKey} from ${richest.sampleCount} samples (${richest.file}) to ${chosen.sampleCount}. Re-run the model, or pass --force to publish the smaller batch anyway.`);
    continue;
  }
  if (chosen.sampleCount < richest.sampleCount) {
    console.warn(`! ${chosen.horizon}/${chosen.runKey}: forced downgrade ${richest.sampleCount} → ${chosen.sampleCount} samples`);
  }
  endStateByHorizon[chosen.horizon][chosen.runKey] = chosen;
}
if (problems.length) { problems.forEach(p => console.error('✗ ' + p)); process.exit(1); }
const emitEndState = (b, pad = indent) => `${pad}${JSON.stringify(b.runKey)}: {
${pad}  provider: ${JSON.stringify(b.provider)}, model: ${JSON.stringify(b.displayLabel)}, label: ${JSON.stringify(b.displayLabel)}, shortLabel: ${JSON.stringify(b.short)},
${pad}  horizon: ${JSON.stringify(b.horizon)}, questionSet: ${JSON.stringify(b.questionSet)}, promptSha256: ${JSON.stringify(b.promptSha256)}, promptVersion: ${JSON.stringify(b.promptVersion)}, date: ${JSON.stringify(b.date)}, knowledgeCutoff: ${JSON.stringify(b.knowledgeCutoff)},
${pad}  sampleCount: ${b.sampleCount}, source: ${JSON.stringify('runs/' + b.file)},
${pad}  probabilities: { ${Object.entries(b.probabilities).map(([id, p]) => `${id}: ${p}`).join(', ')} },
${pad}  range: { ${Object.entries(b.range).map(([id, r]) => `${id}: [${r[0]}, ${r[1]}]`).join(', ')} },
${pad}  quartiles: { ${Object.entries(b.quartiles).map(([id, q]) => `${id}: [${q[0]}, ${q[1]}]`).join(', ')} },
${pad}  exposure: ${JSON.stringify(b.exposure)},
${pad}  exposurePublished: ${JSON.stringify(b.exposurePublished)},
${pad}  rationales: {
${Object.entries(b.rationales).map(([id, r]) => `${pad}    ${id}: ${JSON.stringify(r)}`).join(',\n')}
${pad}  }
${pad}}`;
const sortEntries = entries => entries.sort((a, b) => {
  const ra = rosterByModel.get(a.runKey)?.order ?? Infinity;
  const rb = rosterByModel.get(b.runKey)?.order ?? Infinity;
  return ra - rb || a.runKey.localeCompare(b.runKey);
});
const entriesByHorizon = Object.fromEntries(HORIZON_IDS.map(horizon => [horizon, sortEntries(Object.values(endStateByHorizon[horizon]))]));
for (const b of Object.values(entriesByHorizon).flat()) {
  const entry = rosterByModel.get(b.runKey);
  b.displayLabel = entry?.label || b.model;
  b.short = entry?.shortLabel || SHORT_LABELS[b.provider] || b.provider.slice(0, 3).toUpperCase();
}
// How the board's leading ending has moved. Reconstructed by replaying the
// batches date by date: on each date, take each model's newest run as of then
// and aggregate exactly as the site does. The model count travels with each
// entry because it is usually the explanation — the board's answer changes
// when the board changes, not because a model revised its own.
function leaderTimeline(batches) {
  const dates = [...new Set(batches.map(b => b.asked_on).filter(Boolean))].sort();
  const timeline = [];
  for (const date of dates) {
    const newest = {};
    for (const batch of batches.filter(b => b.asked_on <= date)) {
      const prior = newest[batch.runKey];
      if (!prior || compareRunPreference(batch, prior) < 0) newest[batch.runKey] = batch;
    }
    const published = Object.values(newest).map(b => publishedVector(b.samples)).filter(Boolean);
    if (published.length < 2) continue;
    const columns = STATE_IDS.map((_, i) => published.map(v => v[i]).sort((a, b) => a - b));
    const board = renormalizeAllocation(columns.map(median), columns.map(c => [c[0], c.at(-1)]), columns.map(c => [quartile(c, 0.25), quartile(c, 0.75)]));
    const top = board.indexOf(Math.max(...board));
    const previous = timeline.at(-1);
    timeline.push({ date, stateId: top + 1, share: board[top], models: published.length,
                    changed: !previous || previous.stateId !== top + 1 });
  }
  return timeline;
}

const datasets = Object.fromEntries(HORIZON_IDS.map(horizon => {
  const entries = entriesByHorizon[horizon];
  const dates = entries.map(entry => entry.date).filter(Boolean).sort();
  return [horizon, {
    entries,
    datasetDate: dates.length ? dates.at(-1) : null,
    leaderHistory: leaderTimeline(rawEndStateBatches.filter(batch => batch.horizon === horizon))
  }];
}));

const badgeOf = iso => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  return `${m}.${d}.${y.slice(2)}`;
};
const emitDataset = (horizon, dataset) => `${indent}${JSON.stringify(horizon)}: {
${indent}  endStateRuns: {${dataset.entries.length ? `\n${dataset.entries.map(entry => emitEndState(entry, `${indent}    `)).join(',\n')}\n${indent}  ` : ''}},
${indent}  datasetDate: ${JSON.stringify(badgeOf(dataset.datasetDate))},
${indent}  leaderHistory: ${JSON.stringify(dataset.leaderHistory)}
${indent}}`;
const generatedBlock = `const defaultHorizon = ${JSON.stringify(DEFAULT_HORIZON)};
  const horizons = ${JSON.stringify(HORIZONS)};
  const datasets = {
${HORIZON_IDS.map(horizon => emitDataset(horizon, datasets[horizon])).join(',\n')}
  };`;

let data = readFileSync(dataPath, 'utf8');
const endStateMarker = /(\/\* BEGIN IMPORTED END-STATE RUNS[\s\S]*?\*\/\n)[\s\S]*?(\n\s*\/\* END IMPORTED END-STATE RUNS \*\/)/;
if (!endStateMarker.test(data)) { console.error('✗ IMPORTED END-STATE RUNS markers not found in public/data.js'); process.exit(1); }
data = data.replace(endStateMarker, `$1  ${generatedBlock}$2`);

// Migrate the old generated footer once. Subsequent imports only need to
// refresh the declaration above, but accepting both shapes keeps generation
// reproducible across the schema transition.
data = data.replace(/\n\s*const endStateRuns = importedEndStateRuns;\s*\n\s*const datasetDate = '[^']*';\s*\n/, '\n');
const assignment = /window\.MF_DATA\s*=\s*\{[^;]*\};/;
if (!assignment.test(data)) { console.error('✗ window.MF_DATA assignment not found in public/data.js'); process.exit(1); }
data = data.replace(assignment, 'window.MF_DATA = { states, statesByHorizon, defaultHorizon, horizons, datasets };');
writeFileSync(dataPath, data);

const endStateEntries = Object.values(entriesByHorizon).flat();
console.log(`✓ Imported ${endStateEntries.length} end-state run(s) across ${HORIZON_IDS.length} horizon(s) into public/data.js:`);
endStateEntries.forEach(b => {
  const sum = Object.values(b.probabilities).reduce((a, c) => a + c, 0);
  console.log(`  ${b.horizon}: ${b.provider} / ${b.displayLabel} [${b.runKey}] — ${b.date}, ${b.sampleCount} samples, prompt v${b.promptVersion}, sum ${sum}`);
});
if (outdatedBatches.length) {
  console.log(`  Preserved ${outdatedBatches.length} superseded raw batch(es) without publishing them.`);
}
