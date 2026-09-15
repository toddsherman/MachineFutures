// Canonical forecast-horizon metadata shared by the data pipeline.
//
// Historical end-state batches predate horizon-aware storage. Their prompt was
// explicitly anchored on the year 3000, so an absent horizon is intentionally
// interpreted as the public "long-term" view rather than rejected.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULT_HORIZON = 'long-term';
// The landing view is independent of the legacy horizon for historical runs.
export const DEFAULT_VIEW_HORIZON = '2030';

export const HORIZONS = Object.freeze([
  Object.freeze({ id: 'long-term', label: 'Long term', targetYear: 3000 }),
  Object.freeze({ id: '2030', label: '2030', targetYear: 2030 }),
  Object.freeze({ id: '2040', label: '2040', targetYear: 2040 }),
  Object.freeze({ id: '2050', label: '2050', targetYear: 2050 }),
  Object.freeze({ id: '2060', label: '2060', targetYear: 2060 }),
  Object.freeze({ id: '2035', label: '2035', targetYear: 2035 }),
  Object.freeze({ id: '2070', label: '2070', targetYear: 2070 }),
  Object.freeze({ id: '2080', label: '2080', targetYear: 2080 }),
  Object.freeze({ id: '2090', label: '2090', targetYear: 2090 }),
  Object.freeze({ id: '2100', label: '2100', targetYear: 2100 }),
  Object.freeze({ id: '2200', label: '2200', targetYear: 2200 })
]);

export const HORIZON_IDS = Object.freeze(HORIZONS.map(horizon => horizon.id));

export const HORIZON_RUN_CONFIG = Object.freeze({
  'long-term': Object.freeze({ promptFile: 'public/end_states.md', questionSet: 'end-states-v3', runSuffix: 'end-states' }),
  '2030': Object.freeze({ promptFile: 'public/end_states_2030.md', questionSet: 'end-states-2030-v2', runSuffix: 'end-states-2030' }),
  '2040': Object.freeze({ promptFile: 'public/end_states_2040.md', questionSet: 'end-states-2040-v2', runSuffix: 'end-states-2040' }),
  '2050': Object.freeze({ promptFile: 'public/end_states_2050.md', questionSet: 'end-states-2050-v2', runSuffix: 'end-states-2050' }),
  '2060': Object.freeze({ promptFile: 'public/end_states_2060.md', questionSet: 'end-states-2060-v2', runSuffix: 'end-states-2060' }),
  '2035': Object.freeze({ promptFile: 'public/end_states_2035.md', questionSet: 'end-states-2035-v2', runSuffix: 'end-states-2035' }),
  '2070': Object.freeze({ promptFile: 'public/end_states_2070.md', questionSet: 'end-states-2070-v2', runSuffix: 'end-states-2070' }),
  '2080': Object.freeze({ promptFile: 'public/end_states_2080.md', questionSet: 'end-states-2080-v2', runSuffix: 'end-states-2080' }),
  '2090': Object.freeze({ promptFile: 'public/end_states_2090.md', questionSet: 'end-states-2090-v2', runSuffix: 'end-states-2090' }),
  '2100': Object.freeze({ promptFile: 'public/end_states_2100.md', questionSet: 'end-states-2100-v2', runSuffix: 'end-states-2100' }),
  '2200': Object.freeze({ promptFile: 'public/end_states_2200.md', questionSet: 'end-states-2200-v2', runSuffix: 'end-states-2200' })
});

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export function renderHorizonPrompt(projectRoot, horizon, runDate) {
  const config = HORIZON_RUN_CONFIG[horizon];
  if (!config) throw new Error(`unsupported horizon ${JSON.stringify(horizon)}; expected ${HORIZON_IDS.join(', ')}`);
  const matchDate = String(runDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsedDate = new Date(`${runDate}T00:00:00Z`);
  if (!matchDate || Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== runDate) {
    throw new Error(`invalid prompt run date ${JSON.stringify(runDate)}`);
  }

  const doc = readFileSync(join(projectRoot, config.promptFile), 'utf8');
  const delimited = doc.match(/^--- PROMPT BEGINS ---$([\s\S]*?)^--- PROMPT ENDS ---$/m);
  if (!delimited) throw new Error(`PROMPT BEGINS/ENDS delimiters not found in ${config.promptFile}`);
  const [, year, month, day] = matchDate;
  const longDate = `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}`;
  const prompt = delimited[1].trim().replaceAll('{{RUN_DATE}}', longDate);
  if (prompt.includes('{{')) throw new Error(`unsubstituted placeholder left in ${config.promptFile}`);
  return {
    prompt,
    identity: Object.freeze({
      id: horizon,
      target_year: HORIZONS.find(candidate => candidate.id === horizon).targetYear,
      prompt_file: config.promptFile,
      question_set: config.questionSet,
      prompt_sha256: createHash('sha256').update(prompt).digest('hex')
    })
  };
}

export function runRevision(value) {
  const match = String(value || '').match(/__r([1-9][0-9]*)(?:\.json)?$/);
  return match ? Number(match[1]) : 1;
}

// Newest date, then richest sample set, then highest immutable revision. Both
// the publication gate and importer use this ordering so they cannot validate
// one same-day sibling and publish another.
export function compareRunPreference(left, right) {
  const dateOf = item => String(item?.date ?? item?.asked_on ?? item?.batch?.asked_on ?? '');
  const samplesOf = item => Number(item?.sampleCount ?? item?.samples?.length
    ?? item?.batch?.samples?.length ?? item?.n_samples ?? item?.batch?.n_samples ?? 0);
  const identityOf = item => item?.file ?? item?.run_id ?? item?.batch?.run_id ?? '';
  return dateOf(right).localeCompare(dateOf(left))
    || samplesOf(right) - samplesOf(left)
    || runRevision(identityOf(right)) - runRevision(identityOf(left))
    || String(identityOf(right)).localeCompare(String(identityOf(left)));
}

export function normalizeHorizon(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_HORIZON;
  const raw = String(value).trim().toLowerCase();
  const compact = raw.replace(/[\s_-]+/g, '');
  if (compact === 'longterm' || compact === '3000' || compact === 'year3000' || compact === 'horizon3000') {
    return DEFAULT_HORIZON;
  }
  return HORIZON_IDS.find(id => id !== DEFAULT_HORIZON && [id, `year${id}`, `horizon${id}`].includes(compact)) || null;
}

export function horizonOfBatch(batch) {
  const questionSetHorizon = String(batch?.question_set || '').match(/^end-states-(\d{4})-v\d+$/)?.[1] || null;
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
