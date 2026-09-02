#!/usr/bin/env node
// Import raw batch files from runs/ into public/data.js.
//
// Reads every end-state batch in runs/ — written by tools/run-elicitation.mjs
// or exported by forecast-ingest_1.html — and rewrites the IMPORTED END-STATE
// RUNS block in public/data.js with each provider's newest run: median
// allocation per state, renormalized to integers summing to 100.
//
// Usage: node tools/import-runs.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  return renormalize(
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

// Largest-remainder renormalization: integer probabilities summing to exactly
// 100. Rounding a median up must not carry the published figure outside the
// spread it is drawn against, so remainders are offered in three passes:
// first only to states still inside the middle half of their samples, then to
// states still inside the full sample range, and only then without a bound.
// Each pass keeps the largest-remainder order.
function renormalize(values, hard, soft) {
  const total = values.reduce((a, c) => a + c, 0);
  if (!total) return values.map(() => 0);
  const scaled = values.map(v => (v / total) * 100);
  const out = scaled.map(Math.floor);
  const shortfall = 100 - out.reduce((a, c) => a + c, 0);
  const order = scaled.map((v, i) => [v - out[i], i]).sort((a, b) => b[0] - a[0]).map(([, i]) => i);
  const ceilingFrom = (bounds, i) => (Number.isFinite(bounds?.[i]?.[1]) ? bounds[i][1] : Infinity);
  const passes = [soft, hard, null];

  let given = 0;
  for (const bounds of passes) {
    if (given >= shortfall) break;
    for (const i of order) {
      if (given >= shortfall) break;
      if (bounds && out[i] + 1 > ceilingFrom(bounds, i)) continue;
      out[i] += 1;
      given += 1;
    }
  }
  return out;
}

const files = readdirSync(runsDir).filter(f => f.endsWith('.json')).sort();
const endStateBatches = [];
const rawEndStateBatches = [];
const problems = [];

for (const file of files) {
  const batch = JSON.parse(readFileSync(join(runsDir, file), 'utf8'));
  if (batch.prompt_family === 'end_states') {
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
    const medians = STATE_IDS.map(id => batch.aggregate[id].median);
    const quartiles = Object.fromEntries(STATE_IDS.map((id, i) => [i + 1, quartilesFor(batch.samples || [], id)]).filter(([, q]) => q));
    const probs = renormalize(
      medians,
      STATE_IDS.map(id => [batch.aggregate[id].min, batch.aggregate[id].max]),
      STATE_IDS.map((id, i) => quartiles[i + 1] || null)
    );
    if (probs.reduce((a, c) => a + c, 0) !== 100) { problems.push(`${file}: renormalized probabilities sum to ${probs.reduce((a, c) => a + c, 0)}, not 100`); continue; }
    rawEndStateBatches.push({ asked_on: batch.asked_on, runKey: runKeyOf(batch), samples: batch.samples || [] });
    endStateBatches.push({
      file,
      runKey: runKeyOf(batch),
      provider,
      model: stripProvider(batch.model?.name),
      date: batch.asked_on,
      promptVersion: Number((batch.question_set || '').match(/end-states-v(\d+)/)?.[1]) || null,
      knowledgeCutoff: batch.model?.self_reported_cutoff || null,
      sampleCount: batch.n_samples ?? (batch.samples || []).length,
      probabilities: Object.fromEntries(probs.map((p, i) => [i + 1, p])),
      // Spread is what tells a reader whether a gap between two models means
      // anything, so carry it through rather than publishing bare medians.
      range: Object.fromEntries(STATE_IDS.map((id, i) => [i + 1, [batch.aggregate[id].min, batch.aggregate[id].max]])),
      quartiles,
      exposure: exposureStats(batch.samples || []),
      // Keyed on the run so the bootstrap is reproducible per model.
      exposurePublished: publishedExposure(batch.samples || [], runKeyOf(batch)),
      rationales: Object.fromEntries(STATE_IDS.map((id, i) => [i + 1, String(batch.aggregate[id].rationale || '')]))
    });
    continue;
  }
  problems.push(`${file}: unsupported prompt_family "${batch.prompt_family}" (the 2030 benchmark was retired; see archive/)`);
}

if (problems.length) { problems.forEach(p => console.error('✗ ' + p)); process.exit(1); }

const indent = '    ';

// One entry per model (not per provider), newest asked_on wins. Keying by the
// api model id is what lets two models from the same lab sit side by side.
const endStateByModel = {};
const byModel = new Map();
for (const b of endStateBatches) {
  if (!byModel.has(b.runKey)) byModel.set(b.runKey, []);
  byModel.get(b.runKey).push(b);
}
for (const [runKey, batches] of byModel) {
  // Newest date wins, but a tie goes to the batch with more samples: a rerun
  // on the same day used to replace a twenty-sample run with a three-sample
  // one purely because it was read second.
  const ranked = [...batches].sort((a, b) => b.date.localeCompare(a.date) || b.sampleCount - a.sampleCount);
  const chosen = ranked[0];
  const richest = [...batches].sort((a, b) => b.sampleCount - a.sampleCount)[0];
  if (chosen.sampleCount < richest.sampleCount && !FORCE) {
    problems.push(`${chosen.file}: publishing it would drop ${runKey} from ${richest.sampleCount} samples (${richest.file}) to ${chosen.sampleCount}. Re-run the model, or pass --force to publish the smaller batch anyway.`);
    continue;
  }
  if (chosen.sampleCount < richest.sampleCount) {
    console.warn(`! ${runKey}: forced downgrade ${richest.sampleCount} → ${chosen.sampleCount} samples`);
  }
  endStateByModel[runKey] = chosen;
}
if (problems.length) { problems.forEach(p => console.error('✗ ' + p)); process.exit(1); }
const emitEndState = b => `${indent}${JSON.stringify(b.runKey)}: {
${indent}  provider: ${JSON.stringify(b.provider)}, model: ${JSON.stringify(b.displayLabel)}, label: ${JSON.stringify(b.displayLabel)}, shortLabel: ${JSON.stringify(b.short)},
${indent}  promptVersion: ${JSON.stringify(b.promptVersion)}, date: ${JSON.stringify(b.date)}, knowledgeCutoff: ${JSON.stringify(b.knowledgeCutoff)},
${indent}  sampleCount: ${b.sampleCount}, source: ${JSON.stringify('runs/' + b.file)},
${indent}  probabilities: { ${Object.entries(b.probabilities).map(([id, p]) => `${id}: ${p}`).join(', ')} },
${indent}  range: { ${Object.entries(b.range).map(([id, r]) => `${id}: [${r[0]}, ${r[1]}]`).join(', ')} },
${indent}  quartiles: { ${Object.entries(b.quartiles).map(([id, q]) => `${id}: [${q[0]}, ${q[1]}]`).join(', ')} },
${indent}  exposure: ${JSON.stringify(b.exposure)},
${indent}  exposurePublished: ${JSON.stringify(b.exposurePublished)},
${indent}  rationales: {
${Object.entries(b.rationales).map(([id, r]) => `${indent}    ${id}: ${JSON.stringify(r)}`).join(',\n')}
${indent}  }
${indent}}`;
const endStateEntries = Object.values(endStateByModel).sort((a, b) => {
  const ra = rosterByModel.get(a.runKey)?.order ?? Infinity;
  const rb = rosterByModel.get(b.runKey)?.order ?? Infinity;
  return ra - rb || a.runKey.localeCompare(b.runKey);
});
for (const b of endStateEntries) {
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
      if (!newest[batch.runKey] || batch.asked_on >= newest[batch.runKey].asked_on) newest[batch.runKey] = batch;
    }
    const published = Object.values(newest).map(b => publishedVector(b.samples)).filter(Boolean);
    if (published.length < 2) continue;
    const columns = STATE_IDS.map((_, i) => published.map(v => v[i]).sort((a, b) => a - b));
    // renormalize takes (values, hard, soft); only the upper bound of each
    // pair is read.
    const board = renormalize(columns.map(median), columns.map(c => [c[0], c.at(-1)]), columns.map(c => [quartile(c, 0.25), quartile(c, 0.75)]));
    const top = board.indexOf(Math.max(...board));
    const previous = timeline.at(-1);
    timeline.push({ date, stateId: top + 1, share: board[top], models: published.length,
                    changed: !previous || previous.stateId !== top + 1 });
  }
  return timeline;
}

const endStateBlock = endStateEntries.length
  ? `const importedEndStateRuns = {\n${endStateEntries.map(emitEndState).join(',\n')}\n  };`
  : 'const importedEndStateRuns = {};';

// Keep the header badge in step with the newest run rather than hand-editing it.
const allDates = endStateEntries.map(b => b.date).filter(Boolean).sort();
const newest = allDates.at(-1);

let data = readFileSync(dataPath, 'utf8');
if (newest) {
  const [y, m, d] = newest.split('-');
  const badge = `${m}.${d}.${y.slice(2)}`;
  const datePattern = /const datasetDate = '[^']*';/;
  if (!datePattern.test(data)) console.warn('! datasetDate not found in public/data.js');
  else data = data.replace(datePattern, `const datasetDate = '${badge}';`);
}
const endStateMarker = /(\/\* BEGIN IMPORTED END-STATE RUNS[\s\S]*?\*\/\n)[\s\S]*?(\n\s*\/\* END IMPORTED END-STATE RUNS \*\/)/;
if (!endStateMarker.test(data)) { console.error('✗ IMPORTED END-STATE RUNS markers not found in public/data.js'); process.exit(1); }
const timeline = leaderTimeline(rawEndStateBatches);
data = data.replace(endStateMarker, `$1  ${endStateBlock}

  const leaderHistory = ${JSON.stringify(timeline)};$2`);
writeFileSync(dataPath, data);

console.log(`✓ Imported ${endStateEntries.length} end-state run(s) into public/data.js:`);
endStateEntries.forEach(b => {
  const sum = Object.values(b.probabilities).reduce((a, c) => a + c, 0);
  console.log(`  ${b.provider} / ${b.displayLabel} [${b.runKey}] — ${b.date}, ${b.sampleCount} samples, prompt v${b.promptVersion}, sum ${sum}`);
});
