import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  activeCohortOf,
  assertRosterMatchesPlan,
  checkSweep,
  normalizeSweepPlan,
  prepareSweepWork,
  resolveSweepPlan,
  verifyWorkPrompts
} from './check-sweep.mjs';
import { HORIZON_RUN_CONFIG, renderHorizonPrompt } from './horizons.mjs';

const DATE = '2026-09-10';
const toolDir = dirname(fileURLToPath(import.meta.url));
const checker = join(toolDir, 'check-sweep.mjs');
const projectRoot = join(toolDir, '..');
const STATE_NAMES = ['Terminal Silence', 'The Inheritance', 'Bootloader', 'Machine Ecology', 'The Diaspora',
  'The Merger', 'The Preserve', 'Coexistence', 'The Held Leash', 'The Lock-in', 'The Renunciation'];
const roster = [
  { key: 'alpha', model: 'model-alpha' },
  { key: 'beta', model: 'model-beta', status: 'active' },
  { key: 'old', model: 'model-old', status: 'paused' }
];
const cohort = [{ key: 'alpha', model: 'model-alpha' }, { key: 'beta', model: 'model-beta' }];

function makePlan(horizons = ['2030'], targetSamples = 2, plannedCohort = cohort, root = projectRoot) {
  return normalizeSweepPlan({
    schema_version: 2,
    run_date: DATE,
    target_samples: targetSamples,
    cohort: plannedCohort,
    horizons: horizons.map(horizon => ({ ...renderHorizonPrompt(root, horizon, DATE).identity }))
  });
}

function answers(sampleNumber) {
  return Object.fromEntries(STATE_NAMES.map((_, index) => [
    `S${index + 1}`,
    { value: index === 0 ? 100 : 0, rationale: `sample ${sampleNumber}, state ${index + 1}` }
  ]));
}

const median = values => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const round1 = value => Math.round(value * 10) / 10;

function aggregateOf(samples) {
  return Object.fromEntries(STATE_NAMES.map((name, index) => {
    const id = `S${index + 1}`;
    const values = samples.map(sample => sample.answers[id].value);
    const med = median(values);
    let best = '';
    let distance = Infinity;
    for (const sample of samples) {
      const next = Math.abs(sample.answers[id].value - med);
      if (next < distance) {
        distance = next;
        best = sample.answers[id].rationale;
      }
    }
    return [id, {
      name,
      mean: round1(values.reduce((sum, value) => sum + value, 0) / values.length),
      median: round1(med),
      min: Math.min(...values),
      max: Math.max(...values),
      n: values.length,
      unit: 'percent',
      rationale: best
    }];
  }));
}

function makeBatch(model, horizon, count, options = {}) {
  const { targetSamples = count, plan = makePlan([horizon], targetSamples), revision = null, ...overrides } = options;
  const identity = plan.horizons.find(item => item.id === horizon);
  const samples = Array.from({ length: count }, (_, index) => ({ sample: index + 1, answers: answers(index + 1) }));
  const baseRunId = `${DATE}__${model}__closed_book__${HORIZON_RUN_CONFIG[horizon].runSuffix}`;
  const batch = {
    run_id: revision ? `${baseRunId}__r${revision}` : baseRunId,
    prompt_family: 'end_states',
    horizon,
    target_year: identity.target_year,
    question_set: identity.question_set,
    track: 'closed_book',
    asked_on: DATE,
    model: { api_string: model },
    n_samples: count,
    samples,
    aggregate: aggregateOf(samples),
    harness: {
      mode: 'api',
      horizon,
      target_year: identity.target_year,
      question_set: identity.question_set,
      prompt_file: identity.prompt_file,
      prompt_sha256: identity.prompt_sha256,
      target_samples: targetSamples,
      complete: count >= targetSamples
    }
  };
  batch.integrity = {
    algorithm: 'sha256',
    n_samples: count,
    digest: createHash('sha256')
      .update(JSON.stringify(samples.map(sample => ({ sample: sample.sample, answers: sample.answers }))))
      .digest('hex')
  };
  return Object.assign(batch, overrides);
}

const record = (file, batch) => ({ file, batch });
const completeRecords = plan => plan.horizons.flatMap(identity => plan.cohort.map(entry =>
  record(`${identity.id}-${entry.key}.json`, makeBatch(entry.model, identity.id, plan.target_samples, { plan }))));

test('a complete planned cohort passes while paused and historical extras are ignored', () => {
  const plan = makePlan(['2030', '2040']);
  const records = [
    ...completeRecords(plan),
    record('old.json', makeBatch('model-old', '2030', 2, { plan })),
    record('historical.json', makeBatch('historical-extra', '2030', 2, { plan }))
  ];
  const result = checkSweep({ records, plan });
  assert.deepEqual(result.problems, []);
  assert.equal(result.cohortCount, 2);
  assert.equal(result.selected.length, 4);
});

test('a targeted subset cannot publish without every frozen model', () => {
  const plan = makePlan();
  const result = checkSweep({ records: [record('alpha.json', makeBatch('model-alpha', '2030', 2, { plan }))], plan });
  assert.ok(result.problems.includes(`[2030] model-beta: no batch on ${DATE}`));
});

test('schema-v2 requires explicit prompt and horizon provenance even for long-term', () => {
  const plan = makePlan(['long-term']);
  const records = completeRecords(plan);
  delete records[0].batch.horizon;
  delete records[0].batch.target_year;
  delete records[0].batch.harness.prompt_sha256;
  const result = checkSweep({ records, plan });
  assert.ok(result.problems.some(problem => problem.includes('horizon must be long-term')));
  assert.ok(result.problems.some(problem => problem.includes('harness prompt_sha256')));
});

test('the richest revision is selected and equal-size ties use numeric revision order', () => {
  const plan = makePlan();
  const records = [
    record('alpha.json', makeBatch('model-alpha', '2030', 1, { plan, targetSamples: 2 })),
    record('alpha__r9.json', makeBatch('model-alpha', '2030', 2, { plan, revision: 9 })),
    record('alpha__r10.json', makeBatch('model-alpha', '2030', 2, { plan, revision: 10 })),
    record('beta.json', makeBatch('model-beta', '2030', 2, { plan }))
  ];
  const result = checkSweep({ records, plan });
  assert.deepEqual(result.problems, []);
  assert.equal(result.selected.find(item => item.model === 'model-alpha').file, 'alpha__r10.json');
});

test('every revision id the harness can reserve is accepted, but out-of-range ids are not', () => {
  const plan = makePlan();
  for (const revision of [2, 9, 10, 19, 99]) {
    const result = checkSweep({
      records: [
        record(`alpha__r${revision}.json`, makeBatch('model-alpha', '2030', 2, { plan, revision })),
        record('beta.json', makeBatch('model-beta', '2030', 2, { plan }))
      ],
      plan
    });
    assert.deepEqual(result.problems, [], `revision ${revision} should be valid`);
  }
  for (const revision of [1, 100, 200]) {
    const result = checkSweep({
      records: [
        record(`alpha__r${revision}.json`, makeBatch('model-alpha', '2030', 2, { plan, revision })),
        record('beta.json', makeBatch('model-beta', '2030', 2, { plan }))
      ],
      plan
    });
    assert.ok(result.problems.some(problem => problem.includes('run_id')), `revision ${revision} should be rejected`);
  }
});

test('an oversized richer revision cannot be hidden by an exact-size sibling', () => {
  const plan = makePlan();
  const result = checkSweep({
    records: [
      record('alpha.json', makeBatch('model-alpha', '2030', 2, { plan })),
      record('alpha__r2.json', makeBatch('model-alpha', '2030', 3, { plan, targetSamples: 2, revision: 2 })),
      record('beta.json', makeBatch('model-beta', '2030', 2, { plan }))
    ],
    plan
  });
  assert.ok(result.problems.some(problem => problem.includes('alpha__r2.json has 3 sample(s), 3 valid; expected exactly 2')));
});

test('only the frozen date and horizons satisfy the gate', () => {
  const plan = makePlan();
  const wrongDate = makeBatch('model-beta', '2030', 2, { plan, asked_on: '2026-09-09' });
  const result = checkSweep({
    records: [record('alpha.json', makeBatch('model-alpha', '2030', 2, { plan })), record('beta-old.json', wrongDate)],
    plan
  });
  assert.ok(result.problems.includes(`[2030] model-beta: no batch on ${DATE}`));
});

test('invalid allocations, numbering, and integrity fail completeness', () => {
  const plan = makePlan();
  const bad = makeBatch('model-alpha', '2030', 2, { plan });
  bad.samples[1].answers.S1.value = 99;
  bad.samples[1].sample = 1;
  const result = checkSweep({
    records: [record('alpha-bad.json', bad), record('beta.json', makeBatch('model-beta', '2030', 2, { plan }))],
    plan
  });
  assert.ok(result.problems.some(problem => problem.includes('2 sample(s), 1 valid')));
  assert.ok(result.problems.some(problem => problem.includes('sample numbers are not the contiguous sequence')));
  assert.ok(result.problems.some(problem => problem.includes('integrity digest does not match')));
});

test('aggregate statistics are recomputed rather than trusted', () => {
  const plan = makePlan();
  const bad = makeBatch('model-alpha', '2030', 2, { plan });
  bad.aggregate.S1.median = 17;
  bad.aggregate.S2.n = 99;
  bad.aggregate.S3.rationale = 'not from a nearest sample';
  const result = checkSweep({
    records: [record('alpha.json', bad), record('beta.json', makeBatch('model-beta', '2030', 2, { plan }))],
    plan
  });
  assert.ok(result.problems.some(problem => problem.includes('aggregate S1.median')));
  assert.ok(result.problems.some(problem => problem.includes('aggregate S2.n')));
  assert.ok(result.problems.some(problem => problem.includes('aggregate S3.rationale')));
});

test('wrong prompt file, hash, question set, or API mode cannot publish', () => {
  const plan = makePlan();
  const bad = makeBatch('model-alpha', '2030', 2, { plan });
  bad.harness.mode = 'mock';
  bad.harness.prompt_file = 'public/end_states_2040.md';
  bad.harness.prompt_sha256 = 'f'.repeat(64);
  bad.harness.question_set = 'end-states-2040-v1';
  const result = checkSweep({
    records: [record('alpha.json', bad), record('beta.json', makeBatch('model-beta', '2030', 2, { plan }))],
    plan
  });
  assert.ok(result.problems.some(problem => problem.includes('harness mode must be api')));
  assert.ok(result.problems.some(problem => problem.includes('harness prompt_file')));
  assert.ok(result.problems.some(problem => problem.includes('harness prompt_sha256')));
  assert.ok(result.problems.some(problem => problem.includes('harness question_set')));
});

test('a stored schema-v2 plan is preserved across a lowered one-horizon resume', () => {
  const storedPlan = makePlan(['2030', '2040'], 20);
  const resolved = resolveSweepPlan({
    requestedHorizons: ['2030'],
    runDate: DATE,
    requestedTargetSamples: 10,
    storedPlan,
    roster: [...roster, { key: 'new-model', model: 'model-new' }]
  });
  assert.deepEqual(resolved.plan, storedPlan);
  assert.ok(resolved.notes.some(note => note.includes('preserving original target 20')));
  assert.ok(resolved.notes.some(note => note.includes('publication still requires original horizons 2030, 2040')));

  const records = completeRecords(storedPlan);
  records.find(item => item.file === '2040-beta.json').batch = makeBatch('model-beta', '2040', 19, { plan: storedPlan, targetSamples: 20 });
  const result = checkSweep({ records, plan: resolved.plan });
  assert.ok(result.problems.some(problem => problem.includes('[2040] model-beta')));
});

test('a schema-v1 manifest upgrades once with the current cohort and prompts', () => {
  const storedPlan = { schema_version: 1, run_date: DATE, horizons: ['2030', '2040'], target_samples: 20 };
  const resolved = resolveSweepPlan({
    requestedHorizons: ['2030'],
    runDate: DATE,
    requestedTargetSamples: 10,
    storedPlan,
    roster
  });
  assert.equal(resolved.plan.schema_version, 2);
  assert.deepEqual(resolved.plan.cohort, cohort);
  assert.deepEqual(resolved.plan.horizons.map(item => item.id), ['2030', '2040']);
  assert.equal(resolved.plan.target_samples, 20);
  assert.deepEqual(resolved.plan.horizons, makePlan(['2030', '2040'], 20).horizons);
});

test('schema-v1 migration cannot expand its immutable horizon scope from stray evidence', () => {
  const original = { schema_version: 1, run_date: DATE, horizons: ['2030'], target_samples: 20 };
  assert.throws(() => resolveSweepPlan({
    requestedHorizons: ['2040'],
    runDate: DATE,
    requestedTargetSamples: 20,
    storedPlan: original,
    roster,
    records: [record('stray.json', makeBatch('model-alpha', '2040', 20, { plan: makePlan(['2040'], 20) }))]
  }), /outside the original sweep/);
});

test('an unmanifested legacy artifact derives same-date union and highest target', () => {
  const plan = makePlan(['2030', '2040'], 20);
  const records = [
    record('alpha-2030.json', makeBatch('model-alpha', '2030', 20, { plan, targetSamples: 20 })),
    record('alpha-2040.json', makeBatch('model-alpha', '2040', 10, { plan, targetSamples: 20 }))
  ];
  const resolved = resolveSweepPlan({
    requestedHorizons: ['2030'],
    runDate: DATE,
    requestedTargetSamples: 10,
    roster,
    records,
    legacyArtifact: true
  });
  assert.deepEqual(resolved.plan.horizons.map(item => item.id), ['2030', '2040']);
  assert.equal(resolved.plan.target_samples, 20);
});

test('checkpoint-only legacy artifacts floor their publication target at twenty', () => {
  const resolved = resolveSweepPlan({
    requestedHorizons: ['2030'],
    runDate: DATE,
    requestedTargetSamples: 3,
    roster,
    checkpointHorizons: ['2040'],
    legacyArtifact: true
  });
  assert.equal(resolved.plan.target_samples, 20);
  assert.deepEqual(resolved.plan.horizons.map(item => item.id), ['2030', '2040']);
});

test('frozen cohort mappings must remain runnable, while newly active outsiders are allowed', () => {
  const plan = makePlan();
  assert.doesNotThrow(() => assertRosterMatchesPlan(plan, [...roster, { key: 'gamma', model: 'model-gamma' }]));
  assert.throws(() => assertRosterMatchesPlan(plan, roster.map(entry => entry.key === 'alpha' ? { ...entry, model: 'changed' } : entry)), /changed API model id/);
  assert.throws(() => assertRosterMatchesPlan(plan, roster.map(entry => entry.key === 'alpha' ? { ...entry, status: 'paused' } : entry)), /no longer active/);
  assert.throws(() => assertRosterMatchesPlan(plan, roster.filter(entry => entry.key !== 'alpha')), /is missing/);
});

test('duplicate roster keys, API ids, slugs, and requested keys fail before matrix expansion', () => {
  const plan = makePlan();
  assert.throws(() => activeCohortOf([...roster, { key: 'alpha', model: 'other' }]), /duplicate key/);
  assert.throws(() => activeCohortOf([...roster, { key: 'gamma', model: 'model-alpha' }]), /duplicate API model id/);
  assert.throws(() => activeCohortOf([{ key: 'alpha', model: 'model/a' }, { key: 'beta', model: 'model-a' }]), /colliding run-id slug/);
  assert.throws(() => prepareSweepWork({ plan, roster, requestedHorizons: ['2030'], requestedModels: 'alpha,alpha' }), /duplicate key/);
});

test('matrix selection comes from frozen order and cannot include outsiders', () => {
  const plan = makePlan();
  assert.deepEqual(prepareSweepWork({ plan, roster, requestedHorizons: ['2030'], requestedModels: 'beta,alpha' }), ['alpha', 'beta']);
  assert.throws(() => prepareSweepWork({ plan, roster: [...roster, { key: 'gamma', model: 'model-gamma' }], requestedHorizons: ['2030'], requestedModels: 'gamma' }), /outside the frozen sweep cohort/);
});

test('a requested prompt edit fails before paid work', () => {
  const directory = mkdtempSync(join(tmpdir(), 'mf-prompt-plan-'));
  try {
    mkdirSync(join(directory, 'public'));
    copyFileSync(join(projectRoot, 'public', 'end_states_2030.md'), join(directory, 'public', 'end_states_2030.md'));
    const plan = makePlan(['2030'], 2, cohort, directory);
    assert.doesNotThrow(() => verifyWorkPrompts(plan, directory, ['2030']));
    const original = readFileSync(join(directory, 'public', 'end_states_2030.md'), 'utf8');
    writeFileSync(join(directory, 'public', 'end_states_2030.md'), original.replace('Return exactly one', 'Return precisely one'));
    assert.throws(() => verifyWorkPrompts(plan, directory, ['2030']), /prompt_sha256/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('plan validation rejects internally mismatched prompt configuration', () => {
  const plan = makePlan();
  plan.horizons[0].prompt_file = 'public/end_states_2040.md';
  assert.throws(() => normalizeSweepPlan(plan), /prompt_file must be public\/end_states_2030.md/);
});

test('the plan CLI emits compact schema-v2 JSON with all twenty active models', () => {
  const output = execFileSync('node', [checker, '--resolve-plan', '--horizons-json', '["2040","2030"]', '--date', DATE, '--samples', '20'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  assert.equal(output.trim().includes('\n'), false);
  const plan = JSON.parse(output);
  assert.equal(plan.schema_version, 2);
  assert.equal(plan.cohort.length, 20);
  assert.deepEqual(plan.horizons.map(item => item.id), ['2030', '2040']);
  assert.deepEqual(plan.horizons, makePlan(['2030', '2040'], 20, plan.cohort).horizons);
  for (const bad of ['not-json', '[]', '["2030","2030"]', '["2050"]']) {
    assert.throws(() => execFileSync('node', [checker, '--resolve-plan', '--horizons-json', bad, '--date', DATE, '--samples', '20'], { stdio: ['ignore', 'pipe', 'pipe'] }));
  }
});

test('the checker CLI accepts a complete frozen cohort and rejects one short batch', () => {
  const directory = mkdtempSync(join(tmpdir(), 'mf-sweep-test-'));
  try {
    const liveRoster = JSON.parse(readFileSync(join(projectRoot, 'tools', 'models.json'), 'utf8')).models;
    const liveCohort = activeCohortOf(liveRoster);
    const plan = makePlan(['2030'], 2, liveCohort);
    for (const [index, entry] of liveCohort.entries()) writeFileSync(join(directory, `${index}.json`), JSON.stringify(makeBatch(entry.model, '2030', 2, { plan })));
    const args = [checker, '--runs', directory, '--plan-json', JSON.stringify(plan)];
    const output = execFileSync('node', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    assert.match(output, new RegExp(`complete sweep.*${liveCohort.length} planned models`));
    writeFileSync(join(directory, '0.json'), JSON.stringify(makeBatch(liveCohort[0].model, '2030', 1, { plan, targetSamples: 2 })));
    assert.throws(() => execFileSync('node', args, { stdio: ['ignore', 'pipe', 'pipe'] }));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('the plan CLI preserves a stored schema-v2 manifest verbatim', () => {
  const directory = mkdtempSync(join(tmpdir(), 'mf-plan-test-'));
  try {
    mkdirSync(join(directory, '.partial'));
    const liveRoster = JSON.parse(readFileSync(join(projectRoot, 'tools', 'models.json'), 'utf8')).models;
    const stored = makePlan(['2030', '2040'], 20, activeCohortOf(liveRoster));
    writeFileSync(join(directory, '.partial', '.sweep-plan.json'), JSON.stringify(stored));
    writeFileSync(join(directory, '.partial', `${DATE}__interrupted__closed_book__end-states-2030.jsonl`), '{truncated');
    const output = execFileSync('node', [checker, '--resolve-plan', '--restored', directory,
      '--horizons-json', '["2030"]', '--date', DATE, '--samples', '10'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    assert.deepEqual(JSON.parse(output), stored);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('the plan CLI upgrades schema-v1 and checkpoint-only artifacts', () => {
  const schemaOneDir = mkdtempSync(join(tmpdir(), 'mf-v1-plan-'));
  const checkpointDir = mkdtempSync(join(tmpdir(), 'mf-checkpoint-plan-'));
  try {
    mkdirSync(join(schemaOneDir, '.partial'));
    writeFileSync(join(schemaOneDir, '.partial', '.sweep-plan.json'), JSON.stringify({
      schema_version: 1, run_date: DATE, horizons: ['2030', '2040'], target_samples: 20
    }));
    const upgraded = JSON.parse(execFileSync('node', [checker, '--resolve-plan', '--restored', schemaOneDir,
      '--horizons-json', '["2030"]', '--date', DATE, '--samples', '10'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
    assert.equal(upgraded.schema_version, 2);
    assert.equal(upgraded.cohort.length, 20);
    assert.equal(upgraded.target_samples, 20);

    mkdirSync(join(checkpointDir, '.partial'));
    const sample = makeBatch('model-alpha', '2040', 1).samples[0];
    Object.assign(sample, { horizon: '2040', target_year: 2040, question_set: 'end-states-2040-v1' });
    writeFileSync(join(checkpointDir, '.partial', `${DATE}__model-alpha__closed_book__end-states-2040.jsonl`), `${JSON.stringify(sample)}\n{truncated`);
    const checkpointPlan = JSON.parse(execFileSync('node', [checker, '--resolve-plan', '--restored', checkpointDir,
      '--horizons-json', '["2030"]', '--date', DATE, '--samples', '3'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
    assert.deepEqual(checkpointPlan.horizons.map(item => item.id), ['2030', '2040']);
    assert.equal(checkpointPlan.target_samples, 20);
  } finally {
    rmSync(schemaOneDir, { recursive: true, force: true });
    rmSync(checkpointDir, { recursive: true, force: true });
  }
});
