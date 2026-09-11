#!/usr/bin/env node
// Immutable publication contract and completeness gate for one elicitation sweep.
//
// A schema-v2 plan freezes the exact model cohort and rendered prompt identity
// before any paid call. A resume may target a smaller work subset, but neither
// the subset nor a later roster/prompt edit can silently redefine publication.
//
// Usage:
//   node tools/check-sweep.mjs --resolve-plan \
//     --horizons-json '["2030","2040","2050","2060"]' --date 2026-09-10 --samples 20
//   node tools/check-sweep.mjs --prepare-work \
//     --plan-json "$SWEEP_PLAN_JSON" --horizons-json '["2030"]' \
//     --requested-models 'anthropic,openai'
//   node tools/check-sweep.mjs --plan-json "$SWEEP_PLAN_JSON" [--runs runs]
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HORIZONS,
  HORIZON_IDS,
  HORIZON_RUN_CONFIG,
  compareRunPreference,
  horizonOfBatch,
  renderHorizonPrompt
} from './horizons.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATE_NAMES = ['Terminal Silence', 'The Inheritance', 'Bootloader', 'Machine Ecology', 'The Diaspora',
  'The Merger', 'The Preserve', 'Coexistence', 'The Held Leash', 'The Lock-in', 'The Renunciation'];
const STATE_IDS = STATE_NAMES.map((_, index) => `S${index + 1}`);
const LEGACY_SAMPLE_TARGET = 20;
const slug = value => String(value || 'model').toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '');
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const batchSampleCount = batch => Array.isArray(batch?.samples) ? batch.samples.length : 0;
const digestOf = samples => createHash('sha256')
  .update(JSON.stringify(samples.map(sample => ({ sample: sample.sample, answers: sample.answers }))))
  .digest('hex');
const round1 = value => Math.round(value * 10) / 10;
const median = values => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

function validateDate(value, label = 'date') {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)
      || Number.isNaN(parsed.valueOf())
      || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} must be a real YYYY-MM-DD date; received ${JSON.stringify(value)}`);
  }
  return value;
}

function validateHorizons(value, label = 'horizons') {
  if (!Array.isArray(value) || !value.length || value.some(horizon => !HORIZON_IDS.includes(horizon))) {
    throw new Error(`${label} must be a non-empty array drawn from ${HORIZON_IDS.join(', ')}`);
  }
  if (new Set(value).size !== value.length) throw new Error(`${label} contains duplicate horizons`);
  return HORIZON_IDS.filter(horizon => value.includes(horizon));
}

function validateTargetSamples(value, label = 'samples') {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) {
    throw new Error(`${label} must be a whole number from 1 to 200; received ${JSON.stringify(value)}`);
  }
  return parsed;
}

function validateRoster(roster) {
  if (!Array.isArray(roster) || !roster.length) throw new Error('tools/models.json must contain a non-empty models array');
  const keys = new Set();
  const modelIds = new Set();
  const modelSlugs = new Set();
  for (const [index, model] of roster.entries()) {
    if (!model || typeof model !== 'object') throw new Error(`roster entry ${index + 1} must be an object`);
    if (typeof model.key !== 'string' || !model.key.trim()) throw new Error(`roster entry ${index + 1} has no key`);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(model.key) || model.key === '.' || model.key === '..') {
      throw new Error(`roster entry ${index + 1} has unsafe key ${JSON.stringify(model.key)}`);
    }
    if (typeof model.model !== 'string' || !model.model.trim()) throw new Error(`roster entry ${model.key} has no API model id`);
    if (keys.has(model.key)) throw new Error(`roster contains duplicate key ${JSON.stringify(model.key)}`);
    if (modelIds.has(model.model)) throw new Error(`roster contains duplicate API model id ${JSON.stringify(model.model)}`);
    const modelSlug = slug(model.model);
    if (!modelSlug || modelSlugs.has(modelSlug)) throw new Error(`roster contains colliding run-id slug ${JSON.stringify(modelSlug)} for ${model.model}`);
    keys.add(model.key);
    modelIds.add(model.model);
    modelSlugs.add(modelSlug);
  }
  return roster;
}

export function activeCohortOf(roster) {
  const active = validateRoster(roster)
    .filter(model => (model.status || 'active') === 'active')
    .map(model => ({ key: model.key, model: model.model }));
  if (!active.length) throw new Error('the roster has no active models');
  return active;
}

function normalizeCohort(cohort, label = 'stored sweep cohort') {
  if (!Array.isArray(cohort) || !cohort.length) throw new Error(`${label} must be a non-empty array`);
  const keys = new Set();
  const ids = new Set();
  const slugs = new Set();
  return cohort.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`${label} entry ${index + 1} must be an object`);
    if (typeof entry.key !== 'string' || !entry.key.trim()) throw new Error(`${label} entry ${index + 1} has no key`);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(entry.key) || entry.key === '.' || entry.key === '..') {
      throw new Error(`${label} entry ${index + 1} has unsafe key ${JSON.stringify(entry.key)}`);
    }
    if (typeof entry.model !== 'string' || !entry.model.trim()) throw new Error(`${label} entry ${entry.key} has no API model id`);
    if (keys.has(entry.key)) throw new Error(`${label} contains duplicate key ${JSON.stringify(entry.key)}`);
    if (ids.has(entry.model)) throw new Error(`${label} contains duplicate API model id ${JSON.stringify(entry.model)}`);
    const modelSlug = slug(entry.model);
    if (!modelSlug || slugs.has(modelSlug)) throw new Error(`${label} contains colliding run-id slug ${JSON.stringify(modelSlug)} for ${entry.model}`);
    keys.add(entry.key);
    ids.add(entry.model);
    slugs.add(modelSlug);
    return { key: entry.key, model: entry.model };
  });
}

function normalizePromptIdentity(identity, label = 'stored sweep horizon') {
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) throw new Error(`${label} must be an object`);
  if (!HORIZON_IDS.includes(identity.id)) throw new Error(`${label}.id must be one of ${HORIZON_IDS.join(', ')}`);
  const expectedYear = HORIZONS.find(horizon => horizon.id === identity.id).targetYear;
  if (identity.target_year !== expectedYear) throw new Error(`${label}.target_year must be ${expectedYear} for ${identity.id}`);
  const config = HORIZON_RUN_CONFIG[identity.id];
  if (identity.prompt_file !== config.promptFile) throw new Error(`${label}.prompt_file must be ${config.promptFile} for ${identity.id}`);
  if (identity.question_set !== config.questionSet) throw new Error(`${label}.question_set must be ${config.questionSet} for ${identity.id}`);
  if (!/^[a-f0-9]{64}$/.test(identity.prompt_sha256 || '')) throw new Error(`${label}.prompt_sha256 must be a lowercase SHA-256 digest`);
  return {
    id: identity.id,
    target_year: identity.target_year,
    prompt_file: identity.prompt_file,
    question_set: identity.question_set,
    prompt_sha256: identity.prompt_sha256
  };
}

function normalizeLegacyPlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) throw new Error('stored .sweep-plan.json must be an object');
  if (plan.schema_version !== 1) throw new Error(`stored .sweep-plan.json has unsupported schema_version ${JSON.stringify(plan.schema_version)}`);
  return {
    schema_version: 1,
    run_date: validateDate(plan.run_date, 'stored sweep run_date'),
    horizons: validateHorizons(plan.horizons, 'stored sweep horizons'),
    target_samples: validateTargetSamples(plan.target_samples, 'stored sweep target_samples')
  };
}

export function normalizeSweepPlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) throw new Error('stored .sweep-plan.json must be an object');
  if (plan.schema_version !== 2) throw new Error(`stored .sweep-plan.json has unsupported schema_version ${JSON.stringify(plan.schema_version)}`);
  const horizons = Array.isArray(plan.horizons)
    ? plan.horizons.map((identity, index) => normalizePromptIdentity(identity, `stored sweep horizons[${index}]`))
    : null;
  if (!horizons?.length) throw new Error('stored sweep horizons must be a non-empty array');
  const ids = horizons.map(identity => identity.id);
  if (new Set(ids).size !== ids.length) throw new Error('stored sweep horizons contains duplicate horizons');
  const canonicalIds = HORIZON_IDS.filter(id => ids.includes(id));
  if (JSON.stringify(ids) !== JSON.stringify(canonicalIds)) throw new Error('stored sweep horizons must be in canonical order');
  return {
    schema_version: 2,
    run_date: validateDate(plan.run_date, 'stored sweep run_date'),
    target_samples: validateTargetSamples(plan.target_samples, 'stored sweep target_samples'),
    cohort: normalizeCohort(plan.cohort),
    horizons
  };
}

function promptIdentities(projectRoot, horizons, runDate) {
  return horizons.map(horizon => ({ ...renderHorizonPrompt(projectRoot, horizon, runDate).identity }));
}

export function assertRosterMatchesPlan(planValue, roster) {
  const plan = normalizeSweepPlan(planValue);
  validateRoster(roster);
  const currentByKey = new Map(roster.map(entry => [entry.key, entry]));
  const problems = [];
  for (const planned of plan.cohort) {
    const current = currentByKey.get(planned.key);
    if (!current) problems.push(`${planned.key} (${planned.model}) is missing`);
    else if ((current.status || 'active') !== 'active') problems.push(`${planned.key} (${planned.model}) is no longer active`);
    else if (current.model !== planned.model) problems.push(`${planned.key} changed API model id from ${planned.model} to ${current.model}`);
  }
  if (problems.length) throw new Error(`current roster does not match the frozen sweep cohort: ${problems.join('; ')}`);
  return plan.cohort;
}

export function verifyWorkPrompts(planValue, projectRoot, requestedHorizons) {
  const plan = normalizeSweepPlan(planValue);
  const requested = validateHorizons(requestedHorizons, 'requested work horizons');
  const plannedById = new Map(plan.horizons.map(identity => [identity.id, identity]));
  const outside = requested.filter(horizon => !plannedById.has(horizon));
  if (outside.length) throw new Error(`requested work horizon(s) outside the original sweep: ${outside.join(', ')}`);
  for (const horizon of requested) {
    const stored = plannedById.get(horizon);
    const current = renderHorizonPrompt(projectRoot, horizon, plan.run_date).identity;
    for (const field of ['target_year', 'prompt_file', 'question_set', 'prompt_sha256']) {
      if (current[field] !== stored[field]) {
        throw new Error(`runtime prompt identity for ${horizon} changed at ${field}: plan has ${JSON.stringify(stored[field])}, current runtime has ${JSON.stringify(current[field])}`);
      }
    }
  }
  return requested;
}

function parseRequestedModels(value) {
  if (value === undefined || value === null || value === '') return [];
  const keys = String(value).split(',').map(key => key.trim()).filter(Boolean);
  if (!keys.length) return [];
  const seen = new Set();
  for (const key of keys) {
    if (seen.has(key)) throw new Error(`requested models contains duplicate key ${JSON.stringify(key)}`);
    seen.add(key);
  }
  return keys;
}

export function prepareSweepWork({ plan: planValue, roster, projectRoot = root, requestedHorizons, requestedModels = '' }) {
  const plan = normalizeSweepPlan(planValue);
  assertRosterMatchesPlan(plan, roster);
  verifyWorkPrompts(plan, projectRoot, requestedHorizons);
  const requestedKeys = parseRequestedModels(requestedModels);
  if (!requestedKeys.length) return plan.cohort.map(entry => entry.key);
  const plannedKeys = new Set(plan.cohort.map(entry => entry.key));
  const unknown = requestedKeys.filter(key => !plannedKeys.has(key));
  if (unknown.length) throw new Error(`requested model key(s) outside the frozen sweep cohort: ${unknown.join(', ')}`);
  const requestedSet = new Set(requestedKeys);
  return plan.cohort.filter(entry => requestedSet.has(entry.key)).map(entry => entry.key);
}

// Resolve the immutable publication contract separately from the subset of
// work selected for this dispatch. Schema-v1 and pre-plan artifacts are
// upgraded using the current cohort/prompts exactly once; schema-v2 values are
// then validated and preserved rather than recomputed.
export function resolveSweepPlan({
  requestedHorizons,
  runDate,
  requestedTargetSamples,
  roster,
  projectRoot = root,
  storedPlan = null,
  records = [],
  checkpointHorizons = [],
  legacyArtifact = false
}) {
  const requested = validateHorizons(requestedHorizons, 'requested horizons');
  const date = validateDate(runDate, 'requested run date');
  const requestedSamples = validateTargetSamples(requestedTargetSamples, 'requested samples');
  const notes = [];
  let legacyPlan = null;

  if (storedPlan?.schema_version === 2) {
    const plan = normalizeSweepPlan(storedPlan);
    if (plan.run_date !== date) throw new Error(`stored sweep date ${plan.run_date} does not match restored elicitation date ${date}`);
    const plannedIds = plan.horizons.map(horizon => horizon.id);
    const outsidePlan = requested.filter(horizon => !plannedIds.includes(horizon));
    if (outsidePlan.length) throw new Error(`resume requested horizon(s) outside the original sweep: ${outsidePlan.join(', ')}`);
    assertRosterMatchesPlan(plan, roster);
    if (requestedSamples !== plan.target_samples) notes.push(`resume requested ${requestedSamples} samples; preserving original target ${plan.target_samples}`);
    if (requested.length !== plannedIds.length) notes.push(`working on ${requested.join(', ')}; publication still requires original horizons ${plannedIds.join(', ')}`);
    return { plan, notes };
  }
  if (storedPlan) {
    legacyPlan = normalizeLegacyPlan(storedPlan);
    if (legacyPlan.run_date !== date) throw new Error(`stored sweep date ${legacyPlan.run_date} does not match restored elicitation date ${date}`);
    const outsidePlan = requested.filter(horizon => !legacyPlan.horizons.includes(horizon));
    if (outsidePlan.length) throw new Error(`resume requested horizon(s) outside the original sweep: ${outsidePlan.join(', ')}`);
    notes.push('upgraded schema-v1 sweep plan to immutable schema v2 with the current cohort and prompt identities');
  }

  const discovered = new Set(legacyPlan?.horizons || requested);
  const recordedTargets = legacyPlan ? [legacyPlan.target_samples] : [];
  if (!legacyPlan) {
    for (const { batch, file } of records) {
      if (batch?.prompt_family !== 'end_states' || batch.asked_on !== date) continue;
      let horizon;
      try { horizon = horizonOfBatch(batch); }
      catch (error) { throw new Error(`${file}: ${error.message}`); }
      discovered.add(horizon);
      if (batch.harness?.target_samples !== undefined) recordedTargets.push(validateTargetSamples(batch.harness.target_samples, `${file} harness.target_samples`));
      else if (batch.n_samples !== undefined) recordedTargets.push(validateTargetSamples(batch.n_samples, `${file} n_samples`));
    }
    for (const horizon of checkpointHorizons) {
      if (!HORIZON_IDS.includes(horizon)) throw new Error(`checkpoint has unsupported horizon ${JSON.stringify(horizon)}`);
      discovered.add(horizon);
    }
  }

  const discoveredHorizons = HORIZON_IDS.filter(horizon => discovered.has(horizon));
  const outsidePlan = requested.filter(horizon => !discoveredHorizons.includes(horizon));
  if (outsidePlan.length) throw new Error(`resume requested horizon(s) outside the original sweep: ${outsidePlan.join(', ')}`);
  const checkpointOnlyFloor = legacyArtifact && checkpointHorizons.length > 0 && recordedTargets.length === 0 ? LEGACY_SAMPLE_TARGET : 0;
  const targetSamples = Math.max(requestedSamples, checkpointOnlyFloor, ...recordedTargets);
  const plan = normalizeSweepPlan({
    schema_version: 2,
    run_date: date,
    target_samples: targetSamples,
    cohort: activeCohortOf(roster),
    horizons: promptIdentities(projectRoot, discoveredHorizons, date)
  });
  if (discoveredHorizons.length !== requested.length) notes.push(`legacy artifact expands publication gate to same-date horizons ${discoveredHorizons.join(', ')}`);
  if (targetSamples !== requestedSamples) notes.push(`legacy artifact records or implies a ${targetSamples}-sample target; refusing requested reduction to ${requestedSamples}`);
  return { plan, notes };
}

function validateAggregate(batch, samples) {
  const problems = [];
  if (!batch.aggregate || typeof batch.aggregate !== 'object' || Array.isArray(batch.aggregate)) return ['aggregate must be an object'];
  for (const [index, id] of STATE_IDS.entries()) {
    const entry = batch.aggregate[id];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      problems.push(`aggregate ${id} is missing`);
      continue;
    }
    const values = samples.map(sample => sample.answers?.[id]?.value);
    if (values.some(value => !Number.isInteger(value))) continue;
    const expectedMedian = round1(median(values));
    const expected = {
      name: STATE_NAMES[index],
      mean: round1(values.reduce((sum, value) => sum + value, 0) / values.length),
      median: expectedMedian,
      min: Math.min(...values),
      max: Math.max(...values),
      n: values.length,
      unit: 'percent'
    };
    for (const field of ['name', 'mean', 'median', 'min', 'max', 'n', 'unit']) {
      if (entry[field] !== expected[field]) problems.push(`aggregate ${id}.${field} is ${JSON.stringify(entry[field])}, expected ${JSON.stringify(expected[field])}`);
    }
    const distances = values.map(value => Math.abs(value - expectedMedian));
    const nearestDistance = Math.min(...distances);
    const nearestRationales = new Set(samples
      .filter((_, sampleIndex) => distances[sampleIndex] === nearestDistance)
      .map(sample => sample.answers?.[id]?.rationale));
    if (typeof entry.rationale !== 'string' || !nearestRationales.has(entry.rationale)) problems.push(`aggregate ${id}.rationale does not match a nearest-median sample rationale`);
  }
  return problems;
}

function validateSelectedBatch(batch, { horizonPlan, modelPlan, runDate, targetSamples }) {
  const problems = [];
  const samples = Array.isArray(batch.samples) ? batch.samples : [];
  const invalid = [];
  const horizon = horizonPlan.id;
  const baseRunId = `${runDate}__${slug(modelPlan.model)}__closed_book__${HORIZON_RUN_CONFIG[horizon].runSuffix}`;
  // Keep this in lockstep with reserveBatchPath: base or __r2 through __r99.
  const runIdPattern = new RegExp(`^${escapeRegex(baseRunId)}(?:__r(?:[2-9]|[1-9][0-9]))?$`);
  if (!runIdPattern.test(String(batch.run_id || ''))) problems.push(`run_id ${JSON.stringify(batch.run_id)} does not match ${baseRunId}[__rN]`);
  if (batch.track !== 'closed_book') problems.push(`track must be closed_book, received ${JSON.stringify(batch.track)}`);
  if (batch.horizon !== horizon) problems.push(`horizon must be ${horizon}, received ${JSON.stringify(batch.horizon)}`);
  if (batch.target_year !== horizonPlan.target_year) problems.push(`target_year must be ${horizonPlan.target_year}, received ${JSON.stringify(batch.target_year)}`);
  if (batch.question_set !== horizonPlan.question_set) problems.push(`question_set must be ${horizonPlan.question_set}, received ${JSON.stringify(batch.question_set)}`);
  if (batch.model?.api_string !== modelPlan.model) problems.push(`model api_string must be ${modelPlan.model}, received ${JSON.stringify(batch.model?.api_string)}`);
  if (batch.harness?.mode !== 'api') problems.push(`harness mode must be api, received ${JSON.stringify(batch.harness?.mode)}`);
  if (batch.harness?.target_samples !== targetSamples) problems.push(`harness target_samples is ${JSON.stringify(batch.harness?.target_samples)}, expected ${targetSamples}`);
  if (batch.harness?.complete !== true) problems.push(`harness complete must be true, received ${JSON.stringify(batch.harness?.complete)}`);
  for (const [field, expected] of Object.entries({
    horizon,
    target_year: horizonPlan.target_year,
    question_set: horizonPlan.question_set,
    prompt_file: horizonPlan.prompt_file,
    prompt_sha256: horizonPlan.prompt_sha256
  })) {
    if (batch.harness?.[field] !== expected) problems.push(`harness ${field} is ${JSON.stringify(batch.harness?.[field])}, expected ${JSON.stringify(expected)}`);
  }

  samples.forEach((sample, index) => {
    const values = STATE_IDS.map(id => sample.answers?.[id]?.value);
    const badAllocation = values.some(value => !Number.isInteger(value) || value < 0 || value > 100)
      || values.reduce((sum, value) => sum + (Number.isInteger(value) ? value : 0), 0) !== 100;
    const badRationale = STATE_IDS.some(id => typeof sample.answers?.[id]?.rationale !== 'string');
    if (badAllocation || badRationale) invalid.push(index + 1);
  });
  const validCount = samples.length - invalid.length;
  if (samples.length !== targetSamples || validCount !== targetSamples) problems.push(`has ${samples.length} sample(s), ${validCount} valid; expected exactly ${targetSamples}`);
  if (invalid.length) problems.push(`invalid allocation or rationale at sample position(s) ${invalid.join(', ')}`);
  const sampleNumbers = samples.map(sample => sample.sample);
  const expectedNumbers = Array.from({ length: samples.length }, (_, index) => index + 1);
  if (JSON.stringify(sampleNumbers) !== JSON.stringify(expectedNumbers)) problems.push('sample numbers are not the contiguous sequence 1..n');
  if (batch.n_samples !== samples.length) problems.push(`declares n_samples ${JSON.stringify(batch.n_samples)} but holds ${samples.length}`);
  if (batch.integrity?.algorithm !== 'sha256' || !/^[a-f0-9]{64}$/.test(batch.integrity?.digest || '')) problems.push('sha256 integrity metadata is missing or malformed');
  else if (batch.integrity.digest !== digestOf(samples)) problems.push('integrity digest does not match its samples');
  if (batch.integrity?.n_samples !== samples.length) problems.push(`integrity declares ${JSON.stringify(batch.integrity?.n_samples)} samples but holds ${samples.length}`);
  if (samples.length && invalid.length === 0) problems.push(...validateAggregate(batch, samples));
  return problems;
}

export function checkSweep({ records, plan: planValue }) {
  const plan = normalizeSweepPlan(planValue);
  const problems = [];
  const selected = [];
  const plannedModelIds = new Set(plan.cohort.map(model => model.model));
  const eligible = [];
  for (const record of records) {
    const { batch, file } = record;
    if (batch?.prompt_family !== 'end_states') continue;
    let horizon;
    try { horizon = horizonOfBatch(batch); }
    catch (error) {
      if (batch?.asked_on === plan.run_date && plannedModelIds.has(batch?.model?.api_string)) problems.push(`${file}: ${error.message}`);
      continue;
    }
    eligible.push({ ...record, horizon });
  }

  for (const horizonPlan of plan.horizons) {
    for (const modelPlan of plan.cohort) {
      const candidates = eligible
        .filter(record => record.horizon === horizonPlan.id
          && record.batch.asked_on === plan.run_date
          && record.batch.model?.api_string === modelPlan.model)
        .sort(compareRunPreference);
      if (!candidates.length) {
        problems.push(`[${horizonPlan.id}] ${modelPlan.model}: no batch on ${plan.run_date}`);
        continue;
      }
      const richest = candidates[0];
      selected.push({ horizon: horizonPlan.id, key: modelPlan.key, model: modelPlan.model, file: richest.file, samples: batchSampleCount(richest.batch) });
      for (const problem of validateSelectedBatch(richest.batch, {
        horizonPlan,
        modelPlan,
        runDate: plan.run_date,
        targetSamples: plan.target_samples
      })) problems.push(`[${horizonPlan.id}] ${modelPlan.model}: ${richest.file} ${problem}`);
    }
  }
  return { cohortCount: plan.cohort.length, problems, selected };
}

function argumentValue(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function parseJson(value, label) {
  try { return JSON.parse(value); }
  catch (error) { throw new Error(`${label} is not valid JSON: ${error.message}`); }
}

function loadRoster() {
  const parsed = JSON.parse(readFileSync(join(root, 'tools', 'models.json'), 'utf8'));
  return validateRoster(parsed.models);
}

function loadRecords(runsDir) {
  const records = [];
  const problems = [];
  for (const file of readdirSync(runsDir).filter(name => name.endsWith('.json')).sort()) {
    try { records.push({ file, batch: JSON.parse(readFileSync(join(runsDir, file), 'utf8')) }); }
    catch (error) { problems.push(`${file}: unreadable JSON - ${error.message}`); }
  }
  return { records, problems };
}

function walkFiles(directory, relative = '') {
  const files = [];
  for (const entry of readdirSync(join(directory, relative), { withFileTypes: true })) {
    if (entry.name === '.mock') continue;
    const child = join(relative, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(directory, child));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

function loadPlanEvidence(restoredDir, runDate) {
  if (!existsSync(restoredDir)) throw new Error(`restored artifact directory not found: ${restoredDir}`);
  const paths = walkFiles(restoredDir);
  const planPaths = paths.filter(path => path.endsWith('.sweep-plan.json'));
  const plans = planPaths.map(path => {
    const value = JSON.parse(readFileSync(join(restoredDir, path), 'utf8'));
    return value.schema_version === 2 ? normalizeSweepPlan(value) : normalizeLegacyPlan(value);
  });
  const distinctPlans = [...new Set(plans.map(plan => JSON.stringify(plan)))];
  if (distinctPlans.length > 1) throw new Error('restored artifact contains conflicting .sweep-plan.json files');
  if (plans[0]) return { storedPlan: plans[0], records: [], checkpointHorizons: [], legacyArtifact: plans[0].schema_version === 1 };

  const records = [];
  for (const path of paths.filter(path => path.endsWith('.json') && !path.endsWith('.sweep-plan.json'))) {
    try { records.push({ file: path, batch: JSON.parse(readFileSync(join(restoredDir, path), 'utf8')) }); }
    catch (error) { throw new Error(`${path}: unreadable JSON - ${error.message}`); }
  }
  const checkpointHorizons = [];
  for (const path of paths.filter(path => path.endsWith('.jsonl') && path.split('/').at(-1).startsWith(`${runDate}__`))) {
    const lines = readFileSync(join(restoredDir, path), 'utf8').split('\n').filter(Boolean);
    for (const [index, line] of lines.entries()) {
      let sample;
      try { sample = JSON.parse(line); }
      catch {
        console.error(`· ${path} line ${index + 1}: ignoring unreadable checkpoint tail while deriving legacy plan`);
        continue;
      }
      try { checkpointHorizons.push(horizonOfBatch(sample)); }
      catch { console.error(`· ${path} line ${index + 1}: ignoring checkpoint with invalid horizon metadata while deriving legacy plan`); }
    }
  }
  return { storedPlan: null, records, checkpointHorizons, legacyArtifact: true };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const args = process.argv.slice(2);
    const roster = loadRoster();
    if (args.includes('--resolve-plan')) {
      const horizonJson = argumentValue(args, '--horizons-json');
      const runDate = argumentValue(args, '--date');
      const samplesRaw = argumentValue(args, '--samples');
      if (!horizonJson || !runDate || !samplesRaw) throw new Error('resolve requires --horizons-json <json> --date <YYYY-MM-DD> --samples <n>');
      const restoredArg = argumentValue(args, '--restored');
      const evidence = restoredArg
        ? loadPlanEvidence(resolve(restoredArg), runDate)
        : { storedPlan: null, records: [], checkpointHorizons: [], legacyArtifact: false };
      const resolvedPlan = resolveSweepPlan({
        requestedHorizons: parseJson(horizonJson, '--horizons-json'),
        runDate,
        requestedTargetSamples: samplesRaw,
        roster,
        ...evidence
      });
      resolvedPlan.notes.forEach(note => console.error(`· ${note}`));
      console.log(JSON.stringify(resolvedPlan.plan));
      process.exit(0);
    }
    const planJson = argumentValue(args, '--plan-json');
    if (!planJson) throw new Error('required argument: --plan-json <json>');
    const plan = normalizeSweepPlan(parseJson(planJson, '--plan-json'));
    if (args.includes('--prepare-work')) {
      const horizonJson = argumentValue(args, '--horizons-json');
      if (!horizonJson) throw new Error('prepare-work requires --horizons-json <json>');
      const models = prepareSweepWork({
        plan,
        roster,
        requestedHorizons: parseJson(horizonJson, '--horizons-json'),
        requestedModels: argumentValue(args, '--requested-models') || ''
      });
      console.log(JSON.stringify(models));
      process.exit(0);
    }
    const runsDir = resolve(argumentValue(args, '--runs') || join(root, 'runs'));
    if (!existsSync(runsDir)) throw new Error(`runs directory not found: ${runsDir}`);
    const loaded = loadRecords(runsDir);
    const result = checkSweep({ records: loaded.records, plan });
    const problems = [...loaded.problems, ...result.problems];
    if (problems.length) {
      problems.forEach(problem => console.error(`✗ ${problem}`));
      console.error(`✗ sweep incomplete for ${plan.run_date}: ${problems.length} problem(s); raw batches remain safe to preserve and resume`);
      process.exitCode = 1;
    } else {
      console.log(`✓ complete sweep for ${plan.run_date}: ${result.cohortCount} planned models x ${plan.horizons.length} horizon(s) x ${plan.target_samples} samples`);
    }
  } catch (error) {
    console.error(`✗ ${error.message}`);
    process.exitCode = 2;
  }
}
