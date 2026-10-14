#!/usr/bin/env node
// One and done: each model is collected once, at every horizon, when it is
// added to the roster. This gate refuses to spend money asking a model again
// for a horizon it has already answered under the current question set.
//
// Usage:
//   node tools/check-captured.mjs --models <key,key> --horizons-json '["2030","2040"]'
//     [--runs runs] [--runs pending-runs] [--except-date 2026-10-14]
//
// --runs may repeat, so batches on unmerged elicitation branches count too.
// --except-date ignores batches asked on that date: a resume finishes its own
// run's batches rather than buying them again.
//
// Exit codes: 0 nothing requested is captured yet; 1 at least one requested
// model/horizon is already captured; 2 bad arguments or an unknown model key.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HORIZON_IDS, HORIZON_RUN_CONFIG, horizonOfBatch } from './horizons.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// A batch counts as a capture only when it is complete for the current
// question set. A short batch can still be finished by resuming its run, and
// an answer to a superseded prompt version is not an answer to this one.
export function capturedCells({ roster, models, horizons, batches, exceptDate }) {
  const byKey = new Map(roster.map(entry => [entry.key, entry]));
  const unknown = models.filter(key => !byKey.has(key));
  if (unknown.length) throw new Error(`unknown model key(s): ${unknown.join(', ')}`);
  const badHorizons = horizons.filter(id => !HORIZON_IDS.includes(id));
  if (badHorizons.length) throw new Error(`unknown horizon(s): ${badHorizons.join(', ')}`);

  const wanted = new Map(models.map(key => [byKey.get(key).model, key]));
  const found = [];
  for (const { file, batch } of batches) {
    if (batch?.prompt_family !== 'end_states') continue;
    if (exceptDate && batch.asked_on === exceptDate) continue;
    const key = wanted.get(batch.model?.api_string);
    if (!key) continue;
    let horizon;
    try { horizon = horizonOfBatch(batch); } catch { continue; }
    if (!horizons.includes(horizon)) continue;
    if (batch.question_set !== HORIZON_RUN_CONFIG[horizon].questionSet) continue;
    const samples = Array.isArray(batch.samples) ? batch.samples.length : 0;
    const target = batch.harness?.target_samples ?? 20;
    if (batch.harness?.complete === false || samples < target) continue;
    found.push({ key, model: batch.model.api_string, horizon, asked_on: batch.asked_on, file });
  }
  return found.sort((a, b) => a.key.localeCompare(b.key) || HORIZON_IDS.indexOf(a.horizon) - HORIZON_IDS.indexOf(b.horizon));
}

export function readBatches(runsDir) {
  return readdirSync(runsDir)
    .filter(name => name.endsWith('.json'))
    .map(name => ({ file: name, batch: JSON.parse(readFileSync(join(runsDir, name), 'utf8')) }));
}

function argumentValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function argumentValues(args, name) {
  return args.flatMap((arg, index) => arg === name && index + 1 < args.length ? [args[index + 1]] : []);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  try {
    const models = String(argumentValue(args, '--models') || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!models.length) throw new Error('required argument: --models <key,key>');
    const horizons = JSON.parse(argumentValue(args, '--horizons-json') || 'null');
    if (!Array.isArray(horizons) || !horizons.length) throw new Error("required argument: --horizons-json '[\"2030\", ...]'");
    const runsDirs = (argumentValues(args, '--runs').length ? argumentValues(args, '--runs') : ['runs']).map(dir => resolve(root, dir));
    for (const dir of runsDirs) if (!existsSync(dir)) throw new Error(`runs directory not found: ${dir}`);
    const exceptDate = argumentValue(args, '--except-date');
    if (exceptDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(exceptDate)) throw new Error(`--except-date must be YYYY-MM-DD; received ${JSON.stringify(exceptDate)}`);
    const roster = JSON.parse(readFileSync(join(root, 'tools', 'models.json'), 'utf8')).models;
    const batches = runsDirs.flatMap(readBatches);
    const found = capturedCells({ roster, models, horizons, batches, exceptDate });
    if (!found.length) {
      console.log(`✓ not yet captured${exceptDate ? ` outside this run's date, ${exceptDate}` : ''}: ${models.join(', ')} at ${horizons.length} horizon(s)`);
      process.exit(0);
    }
    console.error('✗ already captured; one and done means these are not asked again:');
    for (const cell of found) console.error(`  ${cell.key} (${cell.model}) at ${cell.horizon}, asked ${cell.asked_on}: ${cell.file}`);
    const missing = models.flatMap(key => {
      const left = horizons.filter(h => !found.some(cell => cell.key === key && cell.horizon === h));
      return left.length ? [`  ${key}: ${left.join(', ')}`] : [];
    });
    if (missing.length) {
      console.error('Still to collect:');
      for (const line of missing) console.error(line);
      console.error('Finish an interrupted capture with resume_from_run_id, or dispatch only the horizons still to collect.');
    }
    console.error('allow_reask buys every requested horizon again at a new date; use it only for a deliberate re-ask.');
    process.exit(1);
  } catch (error) {
    console.error(`✗ ${error.message}`);
    process.exit(2);
  }
}
