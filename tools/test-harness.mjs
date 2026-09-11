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
import { renderHorizonPrompt } from './horizons.mjs';

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
  '2030': { targetYear: 2030, questionSet: 'end-states-2030-v2', suffix: 'end-states-2030', promptFile: 'public/end_states_2030.md' },
  '2040': { targetYear: 2040, questionSet: 'end-states-2040-v2', suffix: 'end-states-2040', promptFile: 'public/end_states_2040.md' },
  '2050': { targetYear: 2050, questionSet: 'end-states-2050-v2', suffix: 'end-states-2050', promptFile: 'public/end_states_2050.md' },
  '2060': { targetYear: 2060, questionSet: 'end-states-2060-v2', suffix: 'end-states-2060', promptFile: 'public/end_states_2060.md' }
};
const runIdFor = (horizon, date = DATE) => `${date}__${slug(rosterEntry.model)}__closed_book__${HORIZON_META[horizon].suffix}`;

const run = (args, { expectFail = false, env = {} } = {}) => {
  try {
    return { ok: true, out: execFileSync('node', [harness, ...args], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env }
    }) };
  } catch (error) {
    if (!expectFail) throw new Error(`harness failed unexpectedly:\n${error.stdout}\n${error.stderr}`);
    return { ok: false, status: error.status, out: `${error.stdout}${error.stderr}` };
  }
};
const git = (cwd, ...args) => execFileSync('git', args, {
  cwd,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe']
}).trim();
const scratch = () => mkdtempSync(join(tmpdir(), 'mf-test-'));
const batchAt = dir => JSON.parse(readFileSync(join(dir, `${RUN_ID}.json`), 'utf8'));
const horizonBatchAt = (dir, horizon, date = DATE) => JSON.parse(readFileSync(join(dir, `${runIdFor(horizon, date)}.json`), 'utf8'));
const elicit = (dir, samples) => run(['--mock', '--date', DATE, '--models', MODEL_KEY, '--samples', String(samples), '--out', dir]);
const elicitHorizon = (dir, horizon, samples, date = DATE) => run([
  '--mock', '--date', date, '--models', MODEL_KEY, '--samples', String(samples), '--horizon', horizon, '--out', dir
]);
const putCurrentInstrumentInRevision = (dir, horizon, samples) => {
  elicitHorizon(dir, horizon, samples);
  const baseRunId = runIdFor(horizon);
  const basePath = join(dir, `${baseRunId}.json`);
  const revisionRunId = `${baseRunId}__r2`;
  const revisionPath = join(dir, `${revisionRunId}.json`);
  const current = JSON.parse(readFileSync(basePath, 'utf8'));
  writeFileSync(revisionPath, JSON.stringify({ ...current, run_id: revisionRunId }, null, 2) + '\n');
  const prior = {
    ...current,
    question_set: `end-states-${horizon}-v999`,
    harness: {
      ...current.harness,
      question_set: `end-states-${horizon}-v999`,
      prompt_sha256: 'f'.repeat(64)
    }
  };
  writeFileSync(basePath, JSON.stringify(prior, null, 2) + '\n');
  return { basePath, revisionPath, revisionRunId };
};

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

test('a complete compatible revision is not bought again when an older instrument owns the base filename', () => {
  const dir = scratch();
  const { revisionPath } = putCurrentInstrumentInRevision(dir, '2030', 3);
  const before = readFileSync(revisionPath, 'utf8');
  const second = elicitHorizon(dir, '2030', 3);
  assert.match(second.out, /not re-asking/, 'the compatible revision should be reused, not re-elicited');
  assert.equal(readFileSync(revisionPath, 'utf8'), before, 'reuse should leave the completed revision untouched');
  assert.equal(existsSync(join(dir, `${runIdFor('2030')}__r3.json`)), false, 'reuse must not create another revision');
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

test('a short compatible revision is topped up in place when an older instrument owns the base filename', () => {
  const dir = scratch();
  const { basePath, revisionPath, revisionRunId } = putCurrentInstrumentInRevision(dir, '2030', 2);
  const priorBase = readFileSync(basePath, 'utf8');
  const out = elicitHorizon(dir, '2030', 5).out;
  assert.match(out, /carrying 2 sample\(s\) forward/, 'the compatible revision should supply the paid samples');
  const batch = JSON.parse(readFileSync(revisionPath, 'utf8'));
  assert.equal(batch.run_id, revisionRunId, 'the topped-up file must retain its revision identity');
  assert.equal(batch.n_samples, 5, 'the revision should be topped up to the target');
  assert.equal(readFileSync(basePath, 'utf8'), priorBase, 'the older instrument must remain untouched');
  assert.equal(existsSync(join(dir, `${runIdFor('2030')}__r3.json`)), false, 'top-up must not create another revision');
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
  assert.equal(readdirSync(dir).filter(file => file.endsWith('.json')).length, 5);
  rmSync(dir, { recursive: true, force: true });
});

test('the harness itself rejects work that differs from the frozen plan', () => {
  const dir = scratch();
  try {
    const identity = renderHorizonPrompt(root, '2030', DATE).identity;
    const plan = {
      schema_version: 2,
      run_date: DATE,
      target_samples: 1,
      cohort: [{ key: MODEL_KEY, model: rosterEntry.model }],
      horizons: [{ ...identity }]
    };
    const good = run(['--mock', '--date', DATE, '--models', MODEL_KEY, '--samples', '1', '--horizon', '2030', '--out', dir], {
      env: { SWEEP_PLAN_JSON: JSON.stringify(plan) }
    });
    assert.equal(good.ok, true);
    rmSync(join(dir, `${runIdFor('2030')}.json`), { force: true });

    plan.horizons[0].prompt_sha256 = 'f'.repeat(64);
    const bad = run(['--mock', '--date', DATE, '--models', MODEL_KEY, '--samples', '1', '--horizon', '2030', '--out', dir], {
      expectFail: true,
      env: { SWEEP_PLAN_JSON: JSON.stringify(plan) }
    });
    assert.match(bad.out, /run does not match the immutable sweep plan.*prompt_sha256/);
    assert.equal(readdirSync(dir).filter(file => file.endsWith('.json')).length, 0,
      'a plan mismatch must fail before writing or calling a model');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
  for (const args of [['--horizon', '2070'], ['--horizon']]) {
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
  assert.match(workflow, /mapfile -t restored_dates[\s\S]*?sort -u[\s\S]*?restored_dates\[@\]/,
    'resume must reject conflicting date manifests instead of trusting the first file');
  assert.match(workflow, /--date "\$RUN_DATE"/);
  assert.match(workflow, /timeout --foreground/);
  assert.match(workflow, /if GITHUB_OUTPUT='' timeout[\s\S]*?then\s+status=0\s+else\s+status=\$\?\s+fi/,
    'the workflow must capture nonzero harness exits despite GitHub invoking bash with -e');
  assert.match(workflow, /if \[ "\$status" -eq 4 \]; then[\s\S]*?quota=true[\s\S]*?break/,
    'a captured quota exit must stop later horizons');
  assert.match(workflow, /echo "quota_exhausted=\$quota" >> "\$GITHUB_OUTPUT"[\s\S]*?exit "\$result"/,
    'failure outputs must be written before the elicitation step exits nonzero');
});

test('the workflow preserves complete prior data when resuming a model subset', () => {
  const workflow = readFileSync(join(root, '.github', 'workflows', 'elicit.yml'), 'utf8');
  const aggregate = workflow.slice(workflow.indexOf('\n  aggregate:'));
  const restore = aggregate.indexOf('name: Restore the previous combined run');
  const current = aggregate.indexOf('name: Download every first-wave model artifact');
  assert.ok(restore >= 0 && current > restore, 'aggregate must restore the prior combined artifact before current model artifacts');
  assert.match(aggregate, /name: runs-\$\{\{ inputs\.resume_from_run_id \}\}[\s\S]*?path: restored\/[\s\S]*?run-id: \$\{\{ inputs\.resume_from_run_id \}\}/);
  assert.match(aggregate, /if \[ -d restored \]; then\s+cp -R restored\/\. runs\/\s+fi\s+# Current artifacts win[\s\S]*?cp -R collected\/\. runs\//,
    'current model artifacts must overlay, not replace, the prior combined run');
});

test('the workflow preserves raw results but gates every site step on same-date sweep completeness', () => {
  const workflow = readFileSync(join(root, '.github', 'workflows', 'elicit.yml'), 'utf8');
  const aggregate = workflow.slice(workflow.indexOf('\n  aggregate:'));
  const verify = aggregate.indexOf('name: Verify raw batches');
  const sweep = aggregate.indexOf('name: Check complete requested sweep');
  const pushRaw = aggregate.indexOf('name: Push the raw batches');
  const importSite = aggregate.indexOf('name: Import every horizon into site data');
  assert.ok(verify >= 0 && sweep > verify && pushRaw > sweep && importSite > pushRaw,
    'the completeness gate must run after verification but before raw preservation and site import');
  assert.match(aggregate, /name: Check complete requested sweep\s+id: sweep\s+continue-on-error: true/);
  assert.match(aggregate, /SWEEP_PLAN_JSON: \$\{\{ needs\.plan\.outputs\.sweep_plan \}\}[\s\S]*?--plan-json "\$SWEEP_PLAN_JSON"/,
    'the publication gate must consume the full frozen plan, not recomputed scalar inputs');
  assert.match(aggregate, /name: Raise a billing alert[\s\S]*?continue-on-error: true/,
    'a GitHub billing-notification failure must never block raw preservation');
  assert.equal((aggregate.match(/steps\.sweep\.outcome == 'success'/g) || []).length, 3,
    'import, site checks, and site push must all require the sweep gate');
  assert.match(aggregate, /name: Fail after preserving incomplete results[\s\S]*?steps\.sweep\.outcome != 'success'/,
    'the aggregate job must ultimately fail when the non-blocking gate fails');
});

test('the workflow persists and reuses an immutable full-sweep plan across targeted resumes', () => {
  const workflow = readFileSync(join(root, '.github', 'workflows', 'elicit.yml'), 'utf8');
  const plan = workflow.slice(workflow.indexOf('\n  plan:'), workflow.indexOf('\n  utility:'));
  const waveOne = workflow.slice(workflow.indexOf('\n  elicit_wave_one:'), workflow.indexOf('\n  elicit_wave_two:'));
  const waveTwo = workflow.slice(workflow.indexOf('\n  elicit_wave_two:'), workflow.indexOf('\n  elicit_wave_three:'));
  const waveThree = workflow.slice(workflow.indexOf('\n  elicit_wave_three:'), workflow.indexOf('\n  aggregate:'));
  const elicit = `${waveOne}\n${waveTwo}\n${waveThree}`;
  const aggregate = workflow.slice(workflow.indexOf('\n  aggregate:'));
  assert.match(plan, /sweep_horizons: \$\{\{ steps\.plan\.outputs\.sweep_horizons \}\}/);
  assert.match(plan, /target_samples: \$\{\{ steps\.plan\.outputs\.target_samples \}\}/);
  assert.match(plan, /sweep_plan: \$\{\{ steps\.plan\.outputs\.sweep_plan \}\}/);
  assert.match(plan, /plan_args=\([\s\S]*?--resolve-plan[\s\S]*?--horizons-json "\$horizons"[\s\S]*?--samples "\$\{REQUESTED_SAMPLES:-20\}"/);
  assert.match(plan, /if \[ -n "\$\{RESUME_RUN_ID:-\}" \]; then plan_args\+=\(--restored plan-restored\); fi/);
  assert.match(plan, /\.horizons\.map\(horizon => horizon\.id\)/,
    'schema-v2 horizon identity objects must be reduced to ids for work matrices');
  assert.match(plan, /--prepare-work[\s\S]*?--plan-json "\$sweep_plan"[\s\S]*?--requested-models "\$\{REQUESTED_MODELS:-\}"/,
    'model matrix selection must come from the frozen cohort and validate prompt hashes');
  assert.match(plan, /name: Stage the immutable sweep plan[\s\S]*?name: Upload the immutable sweep plan[\s\S]*?name: sweep-plan-\$\{\{ github\.run_id \}\}/,
    'the authoritative plan must be uploaded by the plan job before paid model jobs start');
  assert.doesNotMatch(waveOne.slice(0, waveOne.indexOf('name: Elicit first horizon wave')), /\.sweep-plan\.json/,
    'first-wave model artifacts must not contain duplicate last-writer-wins plan manifests');
  assert.doesNotMatch(waveTwo.slice(0, waveTwo.indexOf('name: Elicit second horizon wave')), /\.sweep-plan\.json/,
    'second-wave model artifacts must not contain duplicate last-writer-wins plan manifests');
  assert.doesNotMatch(waveThree.slice(0, waveThree.indexOf('name: Elicit third horizon wave')), /\.sweep-plan\.json/,
    'third-wave model artifacts must not contain duplicate last-writer-wins plan manifests');
  assert.match(waveOne, /HORIZONS_JSON: \$\{\{ needs\.plan\.outputs\.wave_one_horizons \}\}/,
    'the first wave must work only on its selected horizon subset');
  assert.match(waveTwo, /HORIZONS_JSON: \$\{\{ needs\.plan\.outputs\.wave_two_horizons \}\}/,
    'the second wave must work only on its selected horizon subset');
  assert.match(waveThree, /HORIZONS_JSON: \$\{\{ needs\.plan\.outputs\.wave_three_horizons \}\}/,
    'the third wave must work only on its selected horizon subset');
  assert.match(elicit, /SWEEP_PLAN_JSON: \$\{\{ needs\.plan\.outputs\.sweep_plan \}\}[\s\S]*?node tools\/run-elicitation\.mjs/,
    'the harness must receive the frozen plan for a final pre-call binding check');
  assert.match(elicit, /SAMPLES: \$\{\{ needs\.plan\.outputs\.target_samples \}\}/,
    'elicitation must keep the original target instead of trusting the resume input');
  assert.match(aggregate, /name: Download the immutable sweep plan[\s\S]*?cp -R planned\/\. runs\/[\s\S]*?actual_plan=.*\.sweep-plan\.json/,
    'aggregate must restore and compare the one authoritative plan artifact');
  assert.doesNotMatch(aggregate, /rm -f[^\n]*\.sweep-plan/,
    'aggregate cleanup must retain the plan in the resumable artifact');
  assert.doesNotMatch(elicit, /echo "::error::\$\{\{ matrix\.model \}\}/,
    'matrix values must enter shell through env rather than expression interpolation');
});

test('the workflow publishes a workflow-free squash based on the latest default branch', () => {
  const workflow = readFileSync(join(root, '.github', 'workflows', 'elicit.yml'), 'utf8');
  const pushStart = workflow.indexOf('name: Push the raw batches');
  const importStart = workflow.indexOf('name: Import every horizon into site data');
  const push = workflow.slice(pushStart, importStart);
  assert.ok(pushStart >= 0 && importStart > pushStart);
  assert.match(push, /DEFAULT_BRANCH: \$\{\{ github\.event\.repository\.default_branch \}\}/);
  assert.match(push, /git fetch --no-tags --prune --unshallow origin/);
  assert.match(push, /merge_base=\$\(git merge-base "\$SOURCE_SHA" "\$default_ref"\)/);
  assert.match(push, /git restore --source="\$merge_base" --staged --worktree -- \.github\/workflows[\s\S]*?git commit --amend --no-edit/,
    'the ephemeral source tree must neutralize feature-branch workflow changes');
  assert.match(push, /git checkout -b "\$branch" "\$default_ref"[\s\S]*?git merge --squash --no-commit "\$publish_source_sha"/,
    'the publish branch must start at the latest default branch and squash all safe feature changes');
  assert.match(push, /git restore --source="\$default_ref" --staged --worktree -- \.github\/workflows/);
  assert.match(push, /git diff --quiet "\$default_ref" HEAD -- \.github\/workflows/,
    'the workflow tree must be checked before pushing');
  assert.match(push, /git restore --source="\$SOURCE_SHA" --worktree -- \.github\/workflows/,
    'after raw publication, local checks must see the source-version workflow without staging it');
  assert.match(push, /git diff --quiet "\$SOURCE_SHA" -- \.github\/workflows[\s\S]*?git diff --cached --quiet/,
    'the source workflow restore must be verified and remain unstaged');
});

test('a workflow-free squash preserves newer default content and non-workflow feature data', () => {
  const dir = scratch();
  try {
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'config', 'user.name', 'Harness Test');
    git(dir, 'config', 'user.email', 'harness@example.invalid');
    mkdirSync(join(dir, '.github', 'workflows'), { recursive: true });
    mkdirSync(join(dir, 'runs'), { recursive: true });
    writeFileSync(join(dir, '.github', 'workflows', 'elicit.yml'), 'base workflow\n');
    writeFileSync(join(dir, 'shared.txt'), 'base content\n');
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'base');
    git(dir, 'branch', 'feature');

    writeFileSync(join(dir, '.github', 'workflows', 'elicit.yml'), 'new default workflow\n');
    writeFileSync(join(dir, 'shared.txt'), 'new default content\n');
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'advance default');
    const defaultHead = git(dir, 'rev-parse', 'HEAD');

    git(dir, 'switch', '-q', 'feature');
    writeFileSync(join(dir, '.github', 'workflows', 'elicit.yml'), 'feature workflow\n');
    writeFileSync(join(dir, 'feature.txt'), 'keep this feature\n');
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'feature changes');
    const sourceSha = git(dir, 'rev-parse', 'HEAD');
    writeFileSync(join(dir, 'runs', 'new-batch.json'), '{"samples":[]}\n');
    git(dir, 'add', 'runs');
    git(dir, 'commit', '-q', '--allow-empty', '-m', 'stage batches');

    const mergeBase = git(dir, 'merge-base', sourceSha, 'main');
    git(dir, 'restore', `--source=${mergeBase}`, '--staged', '--worktree', '--', '.github/workflows');
    git(dir, 'commit', '-q', '--amend', '--no-edit');
    const publishSource = git(dir, 'rev-parse', 'HEAD');

    git(dir, 'checkout', '-q', '-b', 'publish', 'main');
    git(dir, 'merge', '--squash', '--no-commit', publishSource);
    git(dir, 'restore', '--source=main', '--staged', '--worktree', '--', '.github/workflows');
    git(dir, 'commit', '-q', '-m', 'publish safe changes');

    assert.equal(git(dir, 'rev-parse', 'HEAD^'), defaultHead, 'the publish commit must be based on the latest default commit');
    assert.equal(readFileSync(join(dir, '.github', 'workflows', 'elicit.yml'), 'utf8'), 'new default workflow\n');
    assert.equal(readFileSync(join(dir, 'shared.txt'), 'utf8'), 'new default content\n');
    assert.equal(readFileSync(join(dir, 'feature.txt'), 'utf8'), 'keep this feature\n');
    assert.equal(readFileSync(join(dir, 'runs', 'new-batch.json'), 'utf8'), '{"samples":[]}\n');
    git(dir, 'diff', '--quiet', 'main', 'HEAD', '--', '.github/workflows');

    // Local harness checks must inspect the source workflow that launched the
    // job, while a later site-data commit continues to retain main's workflow.
    git(dir, 'restore', `--source=${sourceSha}`, '--worktree', '--', '.github/workflows');
    assert.equal(readFileSync(join(dir, '.github', 'workflows', 'elicit.yml'), 'utf8'), 'feature workflow\n');
    git(dir, 'diff', '--cached', '--quiet');
    mkdirSync(join(dir, 'public'), { recursive: true });
    writeFileSync(join(dir, 'public', 'data.js'), 'regenerated site data\n');
    git(dir, 'add', 'public/data.js');
    git(dir, 'commit', '-q', '-m', 'publish site data only');
    assert.equal(git(dir, 'show', 'HEAD:.github/workflows/elicit.yml'), 'new default workflow');
    assert.equal(readFileSync(join(dir, '.github', 'workflows', 'elicit.yml'), 'utf8'), 'feature workflow\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the workflow default budget fits five horizons across three ordered model waves', () => {
  const workflow = readFileSync(join(root, '.github', 'workflows', 'elicit.yml'), 'utf8');
  const waveOne = workflow.slice(workflow.indexOf('\n  elicit_wave_one:'), workflow.indexOf('\n  elicit_wave_two:'));
  const waveTwo = workflow.slice(workflow.indexOf('\n  elicit_wave_two:'), workflow.indexOf('\n  elicit_wave_three:'));
  const waveThree = workflow.slice(workflow.indexOf('\n  elicit_wave_three:'), workflow.indexOf('\n  aggregate:'));
  const aggregate = workflow.slice(workflow.indexOf('\n  aggregate:'));
  assert.match(workflow, /budget_minutes:[\s\S]*?default: '100'/);
  assert.equal((workflow.match(/inputs\.budget_minutes \|\| '100'/g) || []).length, 4,
    'plan and all three model waves must use the same 100-minute default');
  assert.match(workflow, /2060\) horizons='\["2060"\]'/);
  assert.match(workflow, /all\) horizons='\["long-term","2030","2040","2050","2060"\]'/);
  assert.match(workflow, /horizons\.slice\(0, 2\)/);
  assert.match(workflow, /horizons\.slice\(2, 4\)/);
  assert.match(workflow, /horizons\.slice\(4, 6\)/);
  assert.match(workflow, /JSON\.stringify\(assigned\) !== JSON\.stringify\(horizons\)/,
    'the planner must reject any selected horizon silently dropped by the fixed wave capacity');
  assert.match(workflow, /const count = Math\.min\(horizons\.length, 2\)/,
    'the timeout guard must bound one wave rather than rejecting the five-horizon sweep');
  assert.match(workflow, /if \(\(budget \+ 5\) \* count > 315\)/);
  assert.equal((workflow.match(/\n    timeout-minutes: 330\n/g) || []).length, 3,
    'each two-horizon wave needs its own hosted-runner window');
  assert.match(waveTwo, /needs: \[plan, elicit_wave_one\][\s\S]*?if: \$\{\{ !cancelled\(\).*has_wave_two == 'true'/,
    'the second matrix must wait through first-wave failures but never start new paid calls after cancellation');
  assert.match(waveThree, /needs: \[plan, elicit_wave_one, elicit_wave_two\][\s\S]*?if: \$\{\{ !cancelled\(\).*has_wave_three == 'true'/,
    'the third matrix must wait through both earlier waves but never start new paid calls after cancellation');
  assert.match(waveTwo, /previous_status="prior-wave\/\.partial\/\.status-wave-1-\$\{MODEL_KEY\}"[\s\S]*?grep -q '\^quota=true\$'/,
    'a provider quota stop in wave one must suppress later calls for the same model');
  assert.match(waveThree, /previous_status="prior-wave\/\.partial\/\.status-wave-2-\$\{MODEL_KEY\}"[\s\S]*?grep -q '\^quota=true\$'/,
    'quota state propagated by wave two must suppress the third call for the same model');
  const revisionFilter = String.raw`__r(?:[2-9]|[1-9][0-9])\\.json$`;
  assert.equal(workflow.split(revisionFilter).length - 1, 3,
    'all three isolated workspaces must resume every valid immutable revision from r2 through r99');
  assert.match(waveOne, /\.artifact-wave-1-\$\{MODEL_KEY\}[\s\S]*?\.status-wave-1-\$\{MODEL_KEY\}[\s\S]*?model-\$\{\{ matrix\.model \}\}-wave-1-\$\{\{ github\.run_id \}\}/,
    'first-wave markers, status, and artifacts must be uniquely named');
  assert.match(waveTwo, /\.artifact-wave-2-\$\{MODEL_KEY\}[\s\S]*?\.status-wave-2-\$\{MODEL_KEY\}[\s\S]*?model-\$\{\{ matrix\.model \}\}-wave-2-\$\{\{ github\.run_id \}\}/,
    'second-wave markers, status, and artifacts must be uniquely named');
  assert.match(waveThree, /\.artifact-wave-3-\$\{MODEL_KEY\}[\s\S]*?\.status-wave-3-\$\{MODEL_KEY\}[\s\S]*?model-\$\{\{ matrix\.model \}\}-wave-3-\$\{\{ github\.run_id \}\}/,
    'third-wave markers, status, and artifacts must be uniquely named');
  assert.match(aggregate, /pattern: model-\*-wave-1-\$\{\{ github\.run_id \}\}[\s\S]*?pattern: model-\*-wave-2-\$\{\{ github\.run_id \}\}[\s\S]*?pattern: model-\*-wave-3-\$\{\{ github\.run_id \}\}/,
    'aggregation must merge all three disjoint wave artifacts');
  assert.equal((aggregate.match(/needs\.elicit_wave_three\.result == 'success'/g) || []).length, 3,
    'import, site checks, and site push must all require a successful third wave when present');
  assert.match(aggregate, /name: Fail after preserving incomplete results[\s\S]*?has_wave_three == 'true'[\s\S]*?needs\.elicit_wave_three\.result != 'success'/,
    'the aggregate job must fail after preserving an incomplete third wave');
});
