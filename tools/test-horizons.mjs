import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_HORIZON,
  HORIZONS,
  HORIZON_IDS,
  compareRunPreference,
  horizonOfBatch,
  normalizeHorizon,
  renderHorizonPrompt,
  runRevision
} from './horizons.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('horizon registry has stable public ids and default', () => {
  assert.equal(DEFAULT_HORIZON, 'long-term');
  assert.deepEqual(HORIZON_IDS, ['long-term', '2030', '2040']);
  assert.deepEqual(HORIZONS.map(({ id, targetYear }) => [id, targetYear]), [
    ['long-term', 3000], ['2030', 2030], ['2040', 2040]
  ]);
});

test('legacy batches without horizon metadata remain long-term', () => {
  assert.equal(horizonOfBatch({ question_set: 'end-states-v3' }), 'long-term');
  assert.equal(normalizeHorizon('3000'), 'long-term');
  assert.equal(normalizeHorizon('long_term'), 'long-term');
});

test('dated batches require mutually consistent horizon provenance', () => {
  assert.equal(horizonOfBatch({ horizon: '2030', target_year: 2030, question_set: 'end-states-2030-v1' }), '2030');
  assert.equal(horizonOfBatch({ horizon: '2040', target_year: 2040, question_set: 'end-states-2040-v2' }), '2040');
  assert.throws(
    () => horizonOfBatch({ horizon: '2030', target_year: 2040, question_set: 'end-states-2030-v1' }),
    /conflicting horizon metadata/
  );
  assert.throws(
    () => horizonOfBatch({ question_set: 'end-states-2030-v1' }),
    /batch has no horizon metadata/
  );
  assert.throws(
    () => horizonOfBatch({ horizon: '2030', target_year: 2030, question_set: 'end-states-2040-v1' }),
    /question_set implies horizon 2040/
  );
  assert.throws(
    () => horizonOfBatch({ horizon: '2030', target_year: 2030, question_set: 'end-states-v3' }),
    /requires a matching end-states-2030-vN question_set/
  );
});

test('persisted horizon metadata is exact and complete', () => {
  assert.equal(horizonOfBatch({ horizon: 'long-term', target_year: 3000, question_set: 'end-states-v3' }), 'long-term');
  assert.throws(
    () => horizonOfBatch({ horizon: 'year 2030', target_year: 2030, question_set: 'end-states-2030-v1' }),
    /exact canonical id/
  );
  assert.throws(
    () => horizonOfBatch({ horizon: '2030', target_year: '2030', question_set: 'end-states-2030-v1' }),
    /must be an integer/
  );
  assert.throws(
    () => horizonOfBatch({ horizon: '2030', question_set: 'end-states-2030-v1' }),
    /numeric target_year/
  );
  assert.throws(
    () => horizonOfBatch({ target_year: 2030, question_set: 'end-states-2030-v1' }),
    /requires an explicit horizon/
  );
});

test('unknown horizons are rejected', () => {
  assert.equal(normalizeHorizon('2050'), null);
  assert.throws(() => horizonOfBatch({ horizon: '2050', target_year: 2050 }), /unsupported horizon/);
});

test('runtime prompt identity hashes the exact date-substituted prompt', () => {
  const first = renderHorizonPrompt(root, '2030', '2026-09-10');
  const second = renderHorizonPrompt(root, '2030', '2026-09-11');
  assert.match(first.prompt, /September 10, 2026/);
  assert.doesNotMatch(first.prompt, /\{\{RUN_DATE\}\}/);
  assert.match(first.identity.prompt_sha256, /^[a-f0-9]{64}$/);
  assert.notEqual(first.identity.prompt_sha256, second.identity.prompt_sha256);
});

test('run preference orders numeric revisions rather than lexical filenames', () => {
  assert.equal(runRevision('batch__r9.json'), 9);
  assert.equal(runRevision('batch__r10.json'), 10);
  const ranked = [
    { file: 'batch__r9.json', date: '2026-09-10', sampleCount: 20 },
    { file: 'batch__r10.json', date: '2026-09-10', sampleCount: 20 }
  ].sort(compareRunPreference);
  assert.equal(ranked[0].file, 'batch__r10.json');
});
