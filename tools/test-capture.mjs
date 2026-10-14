import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { capturedCells } from './check-captured.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const roster = [
  { key: 'alpha', model: 'model-alpha' },
  { key: 'beta', model: 'model-beta' }
];
const batch = (model, horizon, extra = {}) => ({
  prompt_family: 'end_states',
  model: { api_string: model },
  horizon,
  target_year: horizon === 'long-term' ? 3000 : Number(horizon),
  question_set: horizon === 'long-term' ? 'end-states-v3' : `end-states-${horizon}-v2`,
  asked_on: '2026-10-13',
  samples: Array.from({ length: 20 }, (_, i) => ({ sample: i + 1 })),
  harness: { target_samples: 20, complete: true },
  ...extra
});

test('a complete batch under the current question set counts as captured', () => {
  const found = capturedCells({ roster, models: ['alpha'], horizons: ['2030', '2100'],
    batches: [{ file: 'a.json', batch: batch('model-alpha', '2030') }] });
  assert.deepEqual(found.map(c => [c.key, c.horizon]), [['alpha', '2030']]);
});

test('a short or incomplete batch does not block finishing the capture', () => {
  const short = batch('model-alpha', '2030', { samples: [{ sample: 1 }] });
  const flagged = batch('model-alpha', '2040', { harness: { target_samples: 20, complete: false } });
  const found = capturedCells({ roster, models: ['alpha'], horizons: ['2030', '2040'],
    batches: [{ file: 's.json', batch: short }, { file: 'f.json', batch: flagged }] });
  assert.equal(found.length, 0);
});

test('an answer to a superseded question set is not a capture of the current one', () => {
  const old = batch('model-alpha', '2030', { question_set: 'end-states-2030-v1' });
  assert.equal(capturedCells({ roster, models: ['alpha'], horizons: ['2030'], batches: [{ file: 'o.json', batch: old }] }).length, 0);
});

test('other models and other horizons are ignored', () => {
  const found = capturedCells({ roster, models: ['beta'], horizons: ['2050'],
    batches: [{ file: 'a.json', batch: batch('model-alpha', '2050') }, { file: 'b.json', batch: batch('model-beta', '2030') }] });
  assert.equal(found.length, 0);
});

test('unknown model keys and horizons are refused rather than silently passing', () => {
  assert.throws(() => capturedCells({ roster, models: ['gamma'], horizons: ['2030'], batches: [] }), /unknown model key/);
  assert.throws(() => capturedCells({ roster, models: ['alpha'], horizons: ['2031'], batches: [] }), /unknown horizon/);
});

test("a resume ignores batches from its own date but not an earlier capture", () => {
  const today = batch('model-alpha', '2030', { asked_on: '2026-10-14' });
  const batches = [{ file: 't.json', batch: today }];
  assert.equal(capturedCells({ roster, models: ['alpha'], horizons: ['2030'], batches, exceptDate: '2026-10-14' }).length, 0);
  batches.push({ file: 'e.json', batch: batch('model-alpha', '2030') });
  assert.equal(capturedCells({ roster, models: ['alpha'], horizons: ['2030'], batches, exceptDate: '2026-10-14' }).length, 1);
});

test('the CLI also counts batches waiting in a second runs directory, such as an unmerged branch', () => {
  const entry = JSON.parse(readFileSync(join(root, 'tools', 'models.json'), 'utf8')).models.find(m => !m.status || m.status === 'active');
  const empty = mkdtempSync(join(tmpdir(), 'mf-runs-'));
  const pending = mkdtempSync(join(tmpdir(), 'mf-pending-'));
  writeFileSync(join(pending, 'branch__pending.json'), JSON.stringify(batch(entry.model, '2030', { asked_on: '2026-10-14' })));
  const run = extra => {
    try {
      execFileSync(process.execPath, [join(root, 'tools', 'check-captured.mjs'), '--models', entry.key, '--horizons-json', '["2030"]', '--runs', empty, ...extra], { stdio: 'pipe' });
      return 0;
    } catch (error) { return error.status; }
  };
  assert.equal(run([]), 0, 'nothing captured in the first directory alone');
  assert.equal(run(['--runs', pending]), 1, 'a pending batch is a capture');
  assert.equal(run(['--runs', pending, '--except-date', '2026-10-14']), 0, "a resume of that run's date is not a re-ask");
});

test('every model already on the roster is captured, so the CLI refuses to re-ask it', () => {
  const models = JSON.parse(readFileSync(join(root, 'tools', 'models.json'), 'utf8')).models
    .filter(m => !m.status || m.status === 'active').map(m => m.key);
  let status = 0;
  try {
    execFileSync(process.execPath, [join(root, 'tools', 'check-captured.mjs'), '--models', models.join(','), '--horizons-json', '["2030"]'], { stdio: 'pipe' });
  } catch (error) { status = error.status; }
  assert.equal(status, 1);
});

test('the elicitation workflow has no schedule and requires an explicit, uncaptured model list', () => {
  const workflow = readFileSync(join(root, '.github', 'workflows', 'elicit.yml'), 'utf8');
  const triggers = workflow.slice(workflow.indexOf('\non:'), workflow.indexOf('\n  workflow_dispatch:'));
  assert.doesNotMatch(triggers, /schedule:/, 'one and done: nothing should re-ask the roster on a timer');
  assert.match(workflow, /allow_reask:/);
  assert.match(workflow, /node tools\/check-captured\.mjs/);
  assert.match(workflow, /name the model\(s\) to collect/);
  assert.match(workflow, /refs\/heads\/elicitation\/\*/, 'unmerged captures on elicitation branches must count');
  assert.match(workflow, /--except-date "\$run_date"/, 'a resume may finish its own date only');
  const gate = workflow.slice(workflow.indexOf('# One and done. Every dispatch'), workflow.indexOf('name the model(s) to collect'));
  assert.doesNotMatch(gate, /RESUME_RUN_ID/, 'the empty-models refusal must apply to resumes too');
});

test('model discovery runs daily and preflight no longer runs on a timer', () => {
  const watch = readFileSync(join(root, '.github', 'workflows', 'watch-models.yml'), 'utf8');
  assert.match(watch, /cron: '0 13 \* \* \*'/);
  const preflight = readFileSync(join(root, '.github', 'workflows', 'preflight.yml'), 'utf8');
  assert.doesNotMatch(preflight.slice(preflight.indexOf('\non:'), preflight.indexOf('\npermissions:')), /schedule:/);
});
