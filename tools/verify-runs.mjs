#!/usr/bin/env node
// Integrity check for the raw batches in runs/ — the irreplaceable half of
// this repository. public/data.js can always be regenerated from these files;
// these files cannot be regenerated from anything.
//
// Runs on every push, not only after elicitation, so corruption or a bad
// hand-edit is caught when it lands rather than at the next monthly sweep.
//
// Usage: node tools/verify-runs.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const runsDir = join(root, 'runs');
const STATE_IDS = Array.from({ length: 11 }, (_, i) => 'S' + (i + 1));
const problems = [];
const notes = [];
// One-time migration for batches written before harness v2. The digest attests
// to what the file holds now, not to its origin — it makes later corruption
// detectable, it does not certify the past.
const BACKFILL = process.argv.includes('--backfill-integrity');

if (!existsSync(runsDir)) { console.error('✗ runs/ not found'); process.exit(1); }
const files = readdirSync(runsDir).filter(f => f.endsWith('.json')).sort();
if (!files.length) { console.error('✗ runs/ holds no batches'); process.exit(1); }

let samplesSeen = 0;
for (const file of files) {
  const fail = message => problems.push(`${file}: ${message}`);
  let batch;
  try { batch = JSON.parse(readFileSync(join(runsDir, file), 'utf8')); }
  catch (error) { fail(`unreadable JSON — ${error.message}`); continue; }

  if (!batch.model?.api_string) fail('no model.api_string, so the batch has no identity');
  if (!batch.asked_on) fail('no asked_on date');
  const samples = batch.samples || [];
  if (!samples.length) { fail('no samples'); continue; }

  samples.forEach((sample, index) => {
    const values = STATE_IDS.map(id => sample.answers?.[id]?.value);
    if (values.some(v => !Number.isInteger(v) || v < 0 || v > 100)) fail(`sample ${index + 1} is not eleven integers 0-100`);
    else if (values.reduce((a, c) => a + c, 0) !== 100) fail(`sample ${index + 1} sums to ${values.reduce((a, c) => a + c, 0)}, not 100`);
  });
  samplesSeen += samples.length;

  if (batch.n_samples !== undefined && batch.n_samples !== samples.length) {
    fail(`declares n_samples ${batch.n_samples} but holds ${samples.length}`);
  }

  if (batch.integrity?.digest) {
    const digest = createHash('sha256')
      .update(JSON.stringify(samples.map(s => ({ sample: s.sample, answers: s.answers }))))
      .digest('hex');
    if (digest !== batch.integrity.digest) fail('integrity digest mismatch — samples changed after the batch was written');
    if (batch.integrity.n_samples !== samples.length) fail(`integrity declares ${batch.integrity.n_samples} samples, holds ${samples.length}`);
  } else if (BACKFILL) {
    batch.integrity = {
      algorithm: 'sha256',
      n_samples: samples.length,
      digest: createHash('sha256').update(JSON.stringify(samples.map(s => ({ sample: s.sample, answers: s.answers })))).digest('hex'),
      backfilled: true
    };
    writeFileSync(join(runsDir, file), JSON.stringify(batch, null, 2) + '\n');
    notes.push(`${file}: integrity digest backfilled`);
  } else {
    // Batches predating harness v2 have no digest. They are still valid; they
    // simply cannot be checked this way.
    notes.push(`${file}: no integrity digest (written before harness v2)`);
  }

  const rejected = (batch.harness?.failures ?? []).filter(f => (f.kind ?? 'permanent') === 'permanent').length;
  if (rejected) {
    const rate = (rejected / (samples.length + rejected) * 100).toFixed(0);
    notes.push(`${file}: ${rejected} answer(s) rejected as invalid, ${rate}% of attempts`);
  }

  if (batch.harness && batch.harness.complete === false) {
    notes.push(`${file}: short run — ${samples.length}/${batch.harness.target_samples} samples${batch.harness.quota_exhausted ? ', quota exhausted' : ''}`);
  }
}

// Two batches claiming the same identity and date is how a rerun silently
// replaced a good run; as separate revision files they are both kept, and the
// importer picks the richer one.
const byIdentity = new Map();
for (const file of files) {
  try {
    const batch = JSON.parse(readFileSync(join(runsDir, file), 'utf8'));
    const identity = `${batch.model?.api_string}@${batch.asked_on}`;
    if (!byIdentity.has(identity)) byIdentity.set(identity, []);
    byIdentity.get(identity).push({ file, n: (batch.samples || []).length });
  } catch { /* already reported above */ }
}
for (const [identity, entries] of byIdentity) {
  if (entries.length > 1) notes.push(`${identity}: ${entries.length} revisions — ${entries.map(e => `${e.file} (${e.n})`).join(', ')}`);
}

notes.forEach(n => console.log('· ' + n));
if (problems.length) { problems.forEach(p => console.error('✗ ' + p)); process.exit(1); }
console.log(`✓ ${files.length} batches, ${samplesSeen} samples — every sample is a valid allocation and every digest matches`);
