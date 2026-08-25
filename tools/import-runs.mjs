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

// One color per provider; imported runs carry it into public/data.js.
const PROVIDER_COLORS = {
  OpenAI: '#63d8ad', Anthropic: '#e89866', Google: '#73a8ff',
  xAI: '#f0eddf', Meta: '#9c87ff', DeepSeek: '#49d3d3',
  Mistral: '#f2c14e', Moonshot: '#ff6fb5'
};
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
  problems.push(`${file}: unsupported prompt_family "${batch.prompt_family}" (the 2030 benchmark was retired; see archive/)`);
}

if (problems.length) { problems.forEach(p => console.error('✗ ' + p)); process.exit(1); }

const indent = '    ';

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
  console.log(`  ${b.provider} / ${b.model} — ${b.date}, ${b.sampleCount} samples, prompt v${b.promptVersion}, sum ${sum}`);
});
