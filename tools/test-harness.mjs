#!/usr/bin/env node
// Behaviour tests for the elicitation harness, run with --mock so they cost
// nothing. These cover the failures that lose or duplicate paid data — each
// one is a bug this repository actually shipped.
//
// Usage: node --test tools/test-harness.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const harness = join(root, 'tools', 'run-elicitation.mjs');
const DATE = '2026-01-01';
const MODEL_KEY = 'anthropic';
const rosterEntry = JSON.parse(readFileSync(join(root, 'tools', 'models.json'), 'utf8'))
  .models.find(m => m.key === MODEL_KEY);
if (!rosterEntry) throw new Error(`tools/models.json has no "${MODEL_KEY}" entry for these tests to drive`);
const slug = value => (value || 'model').toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '');
const RUN_ID = `${DATE}__${slug(rosterEntry.model)}__closed_book__end-states`;
const HORIZON_META = {
  'long-term': { targetYear: 3000, questionSet: 'end-states-v3', suffix: 'end-states', promptFile: 'public/end_states.md' },
  '2030': { targetYear: 2030, questionSet: 'end-states-2030-v1', suffix: 'end-states-2030', promptFile: 'public/end_states_2030.md' },
  '2040': { targetYear: 2040, questionSet: 'end-states-2040-v1', suffix: 'end-states-2040', promptFile: 'public/end_states_2040.md' }
};
const runIdFor = (horizon, date = DATE) => `${date}__${slug(rosterEntry.model)}__closed_book__${HORIZON_META[horizon].suffix}`;

const run = (args, { expectFail = false } = {}) => {
  try {
    return { ok: true, out: execFileSync('node', [harness, ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (error) {
    if (!expectFail) throw new Error(`harness failed unexpectedly:\n${error.stdout}\n${error.stderr}`);
    return { ok: false, status: error.status, out: `${error.stdout}${error.stderr}` };
  }
};
const scratch = () => mkdtempSync(join(tmpdir(), 'mf-test-'));
const batchAt = dir => JSON.parse(readFileSync(join(dir, `${RUN_ID}.json`), 'utf8'));
const horizonBatchAt = (dir, horizon, date = DATE) => JSON.parse(readFileSync(join(dir, `${runIdFor(horizon, date)}.json`), 'utf8'));
const elicit = (dir, samples) => run(['--mock', '--date', DATE, '--models', MODEL_KEY, '--samples', String(samples), '--out', dir]);
const elicitHorizon = (dir, horizon, samples, date = DATE) => run([
  '--mock', '--date', date, '--models', MODEL_KEY, '--samples', String(samples), '--horizon', horizon, '--out', dir
]);

test('a dry run never touches a real batch', () => {
  // --mock defaulted to runs/ once and overwrote a paid twenty-sample batch
  // with three fabricated ones.
  const snapshot = () => Object.fromEntries(readdirSync(join(root, 'runs'))
    .filter(f => f.endsWith('.json'))
    .map(f => [f, readFileSync(join(root, 'runs', f), 'utf8').length]));
  const before = snapshot();
  run(['--mock', '--date', DATE, '--models', MODEL_KEY, '--samples', '2']);
  assert.deepEqual(snapshot(), before, '--mock added or replaced a batch in runs/');
  assert.ok(existsSync(join(root, 'runs', '.mock', `${RUN_ID}.json`)), 'mock output should land in runs/.mock');
  rmSync(join(root, 'runs', '.mock'), { recursive: true, force: true });
});

test('a rerun never shrinks an existing batch', () => {
  // Asking for fewer than are already on disk must leave the richer batch
  // alone rather than replacing it with the smaller one.
  const dir = scratch();
  elicit(dir, 4);
  const before = readFileSync(join(dir, `${RUN_ID}.json`), 'utf8');
  elicit(dir, 2);
  assert.equal(readFileSync(join(dir, `${RUN_ID}.json`), 'utf8'), before, 'the four-sample batch was replaced by a smaller one');
  rmSync(dir, { recursive: true, force: true });
});

test('an unreadable batch is set aside, not overwritten', () => {
  const dir = scratch();
  elicit(dir, 2);
  writeFileSync(join(dir, `${RUN_ID}.json`), '{ truncated mid-write');
  elicit(dir, 2);
  assert.ok(existsSync(join(dir, `${RUN_ID}__r2.json`)), 'the new batch should land beside the damaged file');
  assert.equal(readFileSync(join(dir, `${RUN_ID}.json`), 'utf8'), '{ truncated mid-write', 'the damaged file should be preserved for inspection');
  rmSync(dir, { recursive: true, force: true });
});

test('a complete batch is not bought again', () => {
  const dir = scratch();
  elicit(dir, 3);
  const second = elicit(dir, 3);
  assert.match(second.out, /not re-asking/, 'a complete batch should be reused, not re-elicited');
  assert.equal(readdirSync(dir).filter(f => f.endsWith('.json')).length, 1, 'reuse should not write a second file');
  rmSync(dir, { recursive: true, force: true });
});

test('a short batch is topped up, buying only the shortfall', () => {
  const dir = scratch();
  elicit(dir, 2);
  const out = elicit(dir, 5).out;
  assert.match(out, /carrying 2 sample\(s\) forward/, 'existing samples should be carried forward');
  const batch = batchAt(dir);
  assert.equal(batch.n_samples, 5, 'the topped-up batch should hold the full target');
  assert.deepEqual(batch.samples.map(s => s.sample), [1, 2, 3, 4, 5], 'samples should be renumbered contiguously');
  assert.equal(readdirSync(dir).filter(f => f.endsWith('.json')).length, 1, 'a top-up should replace, not sit beside');
  rmSync(dir, { recursive: true, force: true });
});

test('a topped-up batch keeps its identity metadata', () => {
  // A written batch stores only {sample, answers}; carrying those forward once
  // crashed on the missing per-sample meta.
  const dir = scratch();
  elicit(dir, 2);
  elicit(dir, 4);
  const batch = batchAt(dir);
  assert.ok(batch.model.api_string, 'api_string missing after a top-up');
  assert.ok(batch.model.self_reported_name, 'self-report lost in the top-up');
  assert.equal(batch.integrity.n_samples, batch.samples.length, 'integrity count disagrees with the samples');
  rmSync(dir, { recursive: true, force: true });
});

test('the integrity digest covers the samples', () => {
  const dir = scratch();
  elicit(dir, 3);
  const batch = batchAt(dir);
  const digest = samples => createHash('sha256')
    .update(JSON.stringify(samples.map(x => ({ sample: x.sample, answers: x.answers })))).digest('hex');
  assert.equal(digest(batch.samples), batch.integrity.digest, 'the recorded digest should match the samples');
  const tampered = JSON.parse(JSON.stringify(batch.samples));
  tampered[0].answers.S3.value += 1;
  tampered[0].answers.S6.value -= 1;             // still a valid allocation
  assert.notEqual(digest(tampered), batch.integrity.digest, 'a one-point edit must change the digest');
  rmSync(dir, { recursive: true, force: true });
});

test('--samples refuses values that would waste or skip a run', () => {
  for (const bad of ['abc', '-5', '0', '2.5', '100000']) {
    const r = run(['--mock', '--models', MODEL_KEY, '--samples', bad], { expectFail: true });
    assert.equal(r.ok, false, `--samples ${bad} should have been rejected`);
    assert.match(r.out, /whole number from 1 to 200/);
  }
});

test('an unknown model key fails the run instead of eliciting nothing', () => {
  const r = run(['--mock', '--models', 'definitely-not-a-roster-key'], { expectFail: true });
  assert.equal(r.ok, false);
  assert.match(r.out, /unknown model key/);
});

test('each horizon has a collision-safe run id and trusted instrument metadata', () => {
  const dir = scratch();
  for (const [horizon, expected] of Object.entries(HORIZON_META)) {
    elicitHorizon(dir, horizon, 2);
    const batch = horizonBatchAt(dir, horizon);
    assert.equal(batch.run_id, runIdFor(horizon));
    assert.equal(batch.horizon, horizon);
    assert.equal(batch.target_year, expected.targetYear);
    assert.equal(batch.question_set, expected.questionSet);
    assert.equal(batch.harness.horizon, horizon);
    assert.equal(batch.harness.target_year, expected.targetYear);
    assert.equal(batch.harness.question_set, expected.questionSet);
    assert.equal(batch.harness.prompt_file, expected.promptFile);
    assert.match(batch.harness.prompt_sha256, /^[a-f0-9]{64}$/);
  }
  assert.equal(readdirSync(dir).filter(file => file.endsWith('.json')).length, 3);
  rmSync(dir, { recursive: true, force: true });
});

test('topping up one horizon never reuses or changes another horizon', () => {
  const dir = scratch();
  elicitHorizon(dir, '2030', 2);
  elicitHorizon(dir, '2040', 3);
  const before2040 = readFileSync(join(dir, `${runIdFor('2040')}.json`), 'utf8');
  const toppedUp = elicitHorizon(dir, '2030', 4);
  assert.match(toppedUp.out, /carrying 2 sample\(s\) forward/);
  assert.equal(horizonBatchAt(dir, '2030').n_samples, 4);
  assert.equal(readFileSync(join(dir, `${runIdFor('2040')}.json`), 'utf8'), before2040);
  rmSync(dir, { recursive: true, force: true });
});

test('--horizon rejects unknown or missing values before a run can spend money', () => {
  for (const args of [['--horizon', '2050'], ['--horizon']]) {
    const r = run(['--mock', '--models', MODEL_KEY, '--samples', '1', ...args], { expectFail: true });
    assert.equal(r.ok, false);
    assert.match(r.out, /--horizon/);
  }
});

test('--date rejects invalid or missing values before filenames are constructed', () => {
  for (const args of [['--date', '2030-02-30'], ['--date', '../2030-01-01'], ['--date']]) {
    const r = run(['--mock', '--models', MODEL_KEY, '--samples', '1', ...args], { expectFail: true });
    assert.equal(r.ok, false);
    assert.match(r.out, /--date/);
  }
});

test('the workflow restores and passes the original elicitation date on resume', () => {
  const workflow = readFileSync(join(root, '.github', 'workflows', 'elicit.yml'), 'utf8');
  assert.match(workflow, /name: Restore the original elicitation date/);
  assert.match(workflow, /-name '\.elicitation-date'/);
  assert.match(workflow, /--date "\$RUN_DATE"/);
  assert.match(workflow, /timeout --foreground/);
  assert.match(workflow, /if GITHUB_OUTPUT='' timeout[\s\S]*?then\s+status=0\s+else\s+status=\$\?\s+fi/,
    'the workflow must capture nonzero harness exits despite GitHub invoking bash with -e');
  assert.match(workflow, /if \[ "\$status" -eq 4 \]; then[\s\S]*?quota=true[\s\S]*?break/,
    'a captured quota exit must stop later horizons');
  assert.match(workflow, /echo "quota_exhausted=\$quota" >> "\$GITHUB_OUTPUT"[\s\S]*?exit "\$result"/,
    'failure outputs must be written before the elicitation step exits nonzero');
});
