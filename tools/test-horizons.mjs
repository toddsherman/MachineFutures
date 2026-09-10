import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_HORIZON, HORIZONS, HORIZON_IDS, horizonOfBatch, normalizeHorizon } from './horizons.mjs';

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
