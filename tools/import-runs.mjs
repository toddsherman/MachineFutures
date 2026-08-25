#!/usr/bin/env node
// Import raw batch files from runs/ into public/data.js.
//
// Reads every runs/*.json exported by forecast-ingest_1.html, takes the
// aggregate median per question (the plan-of-record display value), and
// rewrites the IMPORTED RUNS block in public/data.js. Imported runs replace
// all synthetic runs for their provider (data.js handles the merge).
//
// Usage: node tools/import-runs.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const runsDir = join(root, 'runs');
const dataPath = join(root, 'public', 'data.js');

// Must stay in sync with runSpecs colors in public/data.js.
const PROVIDER_COLORS = {
  OpenAI: '#63d8ad', Anthropic: '#e89866', Google: '#73a8ff',
  xAI: '#f0eddf', Meta: '#9c87ff', DeepSeek: '#49d3d3',
  Mistral: '#f2c14e', Moonshot: '#ff6fb5'
};
const QUESTION_IDS = Array.from({ length: 50 }, (_, i) => 'Q' + (i + 1));
const STATE_IDS = Array.from({ length: 11 }, (_, i) => 'S' + (i + 1));
const SHORT_LABELS = { Anthropic: 'ANT', OpenAI: 'OAI', Google: 'GDM', xAI: 'XAI', Meta: 'MET', DeepSeek: 'DSK', Mistral: 'MIS', Moonshot: 'KMI' };
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
const batches = [];
const endStateBatches = [];
const problems = [];

for (const file of files) {
  const batch = JSON.parse(readFileSync(join(runsDir, file), 'utf8'));
  if (batch.prompt_family === 'end_states') {
    const provider = batch.model?.provider;
    if (!PROVIDER_COLORS[provider]) { problems.push(`${file}: unknown provider "${provider}"`); continue; }
    const missing = STATE_IDS.filter(id => { const a = batch.aggregate?.[id]; return !a || !a.n || typeof a.median !== 'number'; });
    if (missing.length) { problems.push(`${file}: aggregate missing ${missing.join(', ')}`); continue; }
    const medians = STATE_IDS.map(id => batch.aggregate[id].median);
    const probs = renormalize(medians);
    endStateBatches.push({
      file,
      provider,
      model: stripProvider(batch.model?.name),
      date: batch.asked_on,
      promptVersion: Number((batch.question_set || '').match(/end-states-v(\d+)/)?.[1]) || null,
      knowledgeCutoff: batch.model?.self_reported_cutoff || null,
      sampleCount: batch.n_samples ?? (batch.samples || []).length,
      probabilities: Object.fromEntries(probs.map((p, i) => [i + 1, p])),
      rationales: Object.fromEntries(STATE_IDS.map((id, i) => [i + 1, String(batch.aggregate[id].rationale || '')]))
    });
    continue;
  }
  if (batch.prompt_family !== '2030') { problems.push(`${file}: unknown prompt_family "${batch.prompt_family}"`); continue; }

  const provider = batch.model?.provider;
  if (!PROVIDER_COLORS[provider]) { problems.push(`${file}: unknown provider "${provider}"`); continue; }

  const answers = {};
  const missing = [];
  for (const id of QUESTION_IDS) {
    const agg = batch.aggregate?.[id];
    if (!agg || !agg.n || typeof agg.median !== 'number') { missing.push(id); continue; }
    answers[id] = { value: agg.median, rationale: String(agg.rationale || '') };
  }
  if (missing.length) { problems.push(`${file}: aggregate missing ${missing.join(', ')}`); continue; }

  // Warn (don't block) on identical samples that slipped past the ingester.
  const sigs = new Map();
  for (const s of batch.samples || []) {
    const sig = JSON.stringify(QUESTION_IDS.map(id => [s.answers[id]?.value, s.answers[id]?.rationale]));
    if (sigs.has(sig)) console.warn(`! ${file}: sample ${s.sample} is identical to sample ${sigs.get(sig)} — the aggregate double-counts it. Rebuild this batch.`);
    else sigs.set(sig, s.sample);
  }

  batches.push({
    file,
    id: batch.run_id,
    provider,
    model: String(batch.model?.name || 'unknown').replace(/\s*\((?:OpenAI|Anthropic|Google|xAI|Meta|DeepSeek)\)\s*$/, ''),
    date: batch.asked_on,
    questionSet: batch.question_set || null,
    track: batch.track || null,
    sampleCount: batch.n_samples ?? (batch.samples || []).length,
    answers
  });
}

if (problems.length) { problems.forEach(p => console.error('✗ ' + p)); process.exit(1); }

const dupes = batches.filter((b, i) => batches.findIndex(x => x.id === b.id) !== i);
if (dupes.length) { dupes.forEach(d => console.error(`✗ duplicate run_id ${d.id} (${d.file})`)); process.exit(1); }

// Latest run per provider = max date (ties: last file wins).
const latestByProvider = {};
for (const b of batches) {
  if (!latestByProvider[b.provider] || b.date >= latestByProvider[b.provider].date) latestByProvider[b.provider] = b;
}

const indent = '    ';
const emit = b => {
  const answerLines = QUESTION_IDS.map(id =>
    `${indent}    ${id}: { value: ${JSON.stringify(b.answers[id].value)}, rationale: ${JSON.stringify(b.answers[id].rationale)} }`
  ).join(',\n');
  return `${indent}{
${indent}  id: ${JSON.stringify(b.id)}, provider: ${JSON.stringify(b.provider)}, model: ${JSON.stringify(b.model)},
${indent}  date: ${JSON.stringify(b.date)}, latest: ${b === latestByProvider[b.provider]}, color: ${JSON.stringify(PROVIDER_COLORS[b.provider])},
${indent}  questionSet: ${JSON.stringify(b.questionSet)}, track: ${JSON.stringify(b.track)}, sampleCount: ${b.sampleCount}, source: ${JSON.stringify('runs/' + b.file)},
${indent}  answers: {
${answerLines}
${indent}  }
${indent}}`;
};

const block = batches.length
  ? `const importedRuns = [\n${batches.map(emit).join(',\n')}\n  ];`
  : 'const importedRuns = [];';

// End-state runs: one entry per provider, newest asked_on wins.
const endStateByProvider = {};
for (const b of endStateBatches) {
  if (!endStateByProvider[b.provider] || b.date >= endStateByProvider[b.provider].date) endStateByProvider[b.provider] = b;
}
const emitEndState = b => `${indent}${b.provider}: {
${indent}  model: ${JSON.stringify(b.model)}, label: ${JSON.stringify(b.model)}, shortLabel: ${JSON.stringify(SHORT_LABELS[b.provider] || b.provider.slice(0, 3).toUpperCase())}, color: ${JSON.stringify(PROVIDER_COLORS[b.provider])},
${indent}  promptVersion: ${JSON.stringify(b.promptVersion)}, date: ${JSON.stringify(b.date)}, knowledgeCutoff: ${JSON.stringify(b.knowledgeCutoff)},
${indent}  sampleCount: ${b.sampleCount}, source: ${JSON.stringify('runs/' + b.file)},
${indent}  probabilities: { ${Object.entries(b.probabilities).map(([id, p]) => `${id}: ${p}`).join(', ')} },
${indent}  rationales: {
${Object.entries(b.rationales).map(([id, r]) => `${indent}    ${id}: ${JSON.stringify(r)}`).join(',\n')}
${indent}  }
${indent}}`;
const endStateEntries = Object.values(endStateByProvider);
const endStateBlock = endStateEntries.length
  ? `const importedEndStateRuns = {\n${endStateEntries.map(emitEndState).join(',\n')}\n  };`
  : 'const importedEndStateRuns = {};';

// Keep the header badge in step with the newest run rather than hand-editing it.
const allDates = [...batches, ...endStateEntries].map(b => b.date).filter(Boolean).sort();
const newest = allDates.at(-1);

let data = readFileSync(dataPath, 'utf8');
if (newest) {
  const [y, m, d] = newest.split('-');
  const badge = `${m}.${d}.${y.slice(2)}`;
  const before = data;
  data = data.replace(/const datasetDate = '[^']*';/, `const datasetDate = '${badge}';`);
  if (data === before) console.warn('! could not update datasetDate in public/data.js');
}
const marker = /(\/\* BEGIN IMPORTED RUNS[\s\S]*?\*\/\n)[\s\S]*?(\n\s*\/\* END IMPORTED RUNS \*\/)/;
if (!marker.test(data)) { console.error('✗ IMPORTED RUNS markers not found in public/data.js'); process.exit(1); }
data = data.replace(marker, `$1  ${block}$2`);
const endStateMarker = /(\/\* BEGIN IMPORTED END-STATE RUNS[\s\S]*?\*\/\n)[\s\S]*?(\n\s*\/\* END IMPORTED END-STATE RUNS \*\/)/;
if (!endStateMarker.test(data)) { console.error('✗ IMPORTED END-STATE RUNS markers not found in public/data.js'); process.exit(1); }
data = data.replace(endStateMarker, `$1  ${endStateBlock}$2`);
writeFileSync(dataPath, data);

console.log(`✓ Imported ${batches.length} 2030 run(s) and ${endStateEntries.length} end-state run(s) into public/data.js:`);
batches.forEach(b => console.log(`  [2030] ${b.id} — ${b.provider} / ${b.model}, ${b.sampleCount} samples${b === latestByProvider[b.provider] ? ' (latest)' : ''}`));
endStateEntries.forEach(b => {
  const sum = Object.values(b.probabilities).reduce((a, c) => a + c, 0);
  console.log(`  [end-states] ${b.provider} / ${b.model} — ${b.date}, ${b.sampleCount} samples, prompt v${b.promptVersion}, sum ${sum}`);
});
