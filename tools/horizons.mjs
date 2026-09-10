// Canonical forecast-horizon metadata shared by the data pipeline.
//
// Historical end-state batches predate horizon-aware storage. Their prompt was
// explicitly anchored on the year 3000, so an absent horizon is intentionally
// interpreted as the public "long-term" view rather than rejected.
export const DEFAULT_HORIZON = 'long-term';

export const HORIZONS = Object.freeze([
  Object.freeze({ id: 'long-term', label: 'Long term', targetYear: 3000 }),
  Object.freeze({ id: '2030', label: '2030', targetYear: 2030 }),
  Object.freeze({ id: '2040', label: '2040', targetYear: 2040 })
]);

export const HORIZON_IDS = Object.freeze(HORIZONS.map(horizon => horizon.id));

export function normalizeHorizon(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_HORIZON;
  const raw = String(value).trim().toLowerCase();
  const compact = raw.replace(/[\s_-]+/g, '');
  if (compact === 'longterm' || compact === '3000' || compact === 'year3000' || compact === 'horizon3000') {
    return DEFAULT_HORIZON;
  }
  if (compact === '2030' || compact === 'year2030' || compact === 'horizon2030') return '2030';
  if (compact === '2040' || compact === 'year2040' || compact === 'horizon2040') return '2040';
  return null;
}

export function horizonOfBatch(batch) {
  const questionSetHorizon = String(batch?.question_set || '').match(/^end-states-(2030|2040)-v\d+$/)?.[1] || null;
  const hasHorizon = batch?.horizon !== undefined && batch?.horizon !== null && batch?.horizon !== '';
  const hasTargetYear = batch?.target_year !== undefined && batch?.target_year !== null && batch?.target_year !== '';

  if (!hasHorizon && !hasTargetYear) {
    if (questionSetHorizon) throw new Error(`question_set implies horizon ${questionSetHorizon}, but the batch has no horizon metadata`);
    return DEFAULT_HORIZON;
  }

  // New batches carry both fields in a deliberately strict, portable form.
  // normalizeHorizon remains permissive for CLI input, but persisted
  // provenance should never depend on aliases or string-to-number coercion.
  if (!hasHorizon) throw new Error('target_year requires an explicit horizon');
  if (!HORIZON_IDS.includes(batch.horizon)) {
    throw new Error(`unsupported horizon ${JSON.stringify(batch.horizon)}; expected an exact canonical id: ${HORIZON_IDS.join(', ')}`);
  }
  if (!hasTargetYear) throw new Error(`horizon ${batch.horizon} requires a numeric target_year`);
  if (!Number.isInteger(batch.target_year)) throw new Error(`target_year must be an integer, received ${JSON.stringify(batch.target_year)}`);

  const horizon = batch.horizon;
  const expectedYear = HORIZONS.find(item => item.id === horizon).targetYear;
  if (batch.target_year !== expectedYear) {
    throw new Error(`conflicting horizon metadata: horizon=${horizon}, target_year=${batch.target_year}`);
  }
  if (questionSetHorizon && questionSetHorizon !== horizon) {
    throw new Error(`question_set implies horizon ${questionSetHorizon}, but metadata says ${horizon}`);
  }
  if (horizon !== DEFAULT_HORIZON && questionSetHorizon !== horizon) {
    throw new Error(`horizon ${horizon} requires a matching end-states-${horizon}-vN question_set`);
  }
  if (horizon === DEFAULT_HORIZON && batch.question_set && batch.question_set !== 'end-states-v3') {
    throw new Error('horizon long-term requires question_set end-states-v3');
  }
  return horizon;
}
