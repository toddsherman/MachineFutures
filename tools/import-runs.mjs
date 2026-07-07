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
  xAI: '#f0eddf', Meta: '#9c87ff', DeepSeek: '#49d3d3'
};
const QUESTION_IDS = Array.from({ length: 50 }, (_, i) => 'Q' + (i + 1));

const files = readdirSync(runsDir).filter(f => f.endsWith('.json')).sort();
const batches = [];
const problems = [];

for (const file of files) {
  const batch = JSON.parse(readFileSync(join(runsDir, file), 'utf8'));
  if (batch.prompt_family === 'end_states') {
    console.log(`~ ${file}: end-state batches are not imported yet (endStateRuns in data.js is still maintained by hand) — skipped.`);
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

const data = readFileSync(dataPath, 'utf8');
const marker = /(\/\* BEGIN IMPORTED RUNS[\s\S]*?\*\/\n)[\s\S]*?(\n\s*\/\* END IMPORTED RUNS \*\/)/;
if (!marker.test(data)) { console.error('✗ IMPORTED RUNS markers not found in public/data.js'); process.exit(1); }
writeFileSync(dataPath, data.replace(marker, `$1  ${block}$2`));

console.log(`✓ Imported ${batches.length} run(s) into public/data.js:`);
batches.forEach(b => console.log(`  ${b.id} — ${b.provider} / ${b.model}, ${b.sampleCount} samples${b === latestByProvider[b.provider] ? ' (latest)' : ''}`));
