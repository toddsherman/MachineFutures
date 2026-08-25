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
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const runsDir = join(root, 'runs');
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
const EXPOSURE_IDS = ['S1', 'S2', 'S3', 'S4', 'S5'];
function exposureStats(samples) {
  const totals = samples
    .map(s => EXPOSURE_IDS.reduce((sum, id) => sum + (s.answers?.[id]?.value ?? 0), 0))
    .filter(Number.isFinite);
  if (!totals.length) return null;
  const mean = totals.reduce((a, c) => a + c, 0) / totals.length;
  const variance = totals.reduce((a, c) => a + (c - mean) ** 2, 0) / totals.length;
  const sd = Math.sqrt(variance);
  return {
    n: totals.length,
    mean: Math.round(mean * 10) / 10,
    se: Math.round((sd / Math.sqrt(totals.length)) * 100) / 100,
    min: Math.min(...totals),
    max: Math.max(...totals)
  };
}

const runKeyOf = batch => batch.model?.api_string || batch.model?.name || batch.run_id;
const stripProvider = name => String(name || 'unknown').replace(/\s*\((?:OpenAI|Anthropic|Google|xAI|Meta|DeepSeek|mock)\)\s*$/, '');

// Largest-remainder renormalization: integer probabilities summing to exactly 100.
function renormalize(values) {
  const total = values.reduce((a, c) => a + c, 0);
  if (!total) return values.map(() => 0);
  const scaled = values.map(v => (v / total) * 100);
  const floored = scaled.map(Math.floor);
  let shortfall = 100 - floored.reduce((a, c) => a + c, 0);
  const order = scaled.map((v, i) => [v - floored[i], i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < shortfall; k++) floored[order[k % order.length][1]] += 1;
  return floored;
}

const files = readdirSync(runsDir).filter(f => f.endsWith('.json')).sort();
const endStateBatches = [];
const problems = [];

for (const file of files) {
  const batch = JSON.parse(readFileSync(join(runsDir, file), 'utf8'));
  if (batch.prompt_family === 'end_states') {
    const provider = batch.model?.provider;
    if (!provider) { problems.push(`${file}: batch has no model.provider`); continue; }
    const missing = STATE_IDS.filter(id => { const a = batch.aggregate?.[id]; return !a || !a.n || typeof a.median !== 'number'; });
    if (missing.length) { problems.push(`${file}: aggregate missing ${missing.join(', ')}`); continue; }
    const medians = STATE_IDS.map(id => batch.aggregate[id].median);
    const probs = renormalize(medians);
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
      exposure: exposureStats(batch.samples || []),
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
for (const b of endStateBatches) {
  if (!endStateByModel[b.runKey] || b.date >= endStateByModel[b.runKey].date) endStateByModel[b.runKey] = b;
}
const emitEndState = b => `${indent}${JSON.stringify(b.runKey)}: {
${indent}  provider: ${JSON.stringify(b.provider)}, model: ${JSON.stringify(b.displayLabel)}, label: ${JSON.stringify(b.displayLabel)}, shortLabel: ${JSON.stringify(b.short)},
${indent}  promptVersion: ${JSON.stringify(b.promptVersion)}, date: ${JSON.stringify(b.date)}, knowledgeCutoff: ${JSON.stringify(b.knowledgeCutoff)},
${indent}  sampleCount: ${b.sampleCount}, source: ${JSON.stringify('runs/' + b.file)},
${indent}  probabilities: { ${Object.entries(b.probabilities).map(([id, p]) => `${id}: ${p}`).join(', ')} },
${indent}  range: { ${Object.entries(b.range).map(([id, r]) => `${id}: [${r[0]}, ${r[1]}]`).join(', ')} },
${indent}  exposure: ${JSON.stringify(b.exposure)},
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
data = data.replace(endStateMarker, `$1  ${endStateBlock}$2`);
writeFileSync(dataPath, data);

console.log(`✓ Imported ${endStateEntries.length} end-state run(s) into public/data.js:`);
endStateEntries.forEach(b => {
  const sum = Object.values(b.probabilities).reduce((a, c) => a + c, 0);
  console.log(`  ${b.provider} / ${b.displayLabel} [${b.runKey}] — ${b.date}, ${b.sampleCount} samples, prompt v${b.promptVersion}, sum ${sum}`);
});
