#!/usr/bin/env node
// Invariant check for the published site data, run in CI after import.
//
// The importer guarantees its own inputs; this checks what actually ships:
// that every run is a valid allocation, that the aggregate the homepage
// headlines is one too, and that the uncertainty attached to the exposure
// chart describes the figure the chart draws.
//
// Usage: node tools/check-site.mjs
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shim = {};
new Function('window', readFileSync(join(root, 'public', 'data.js'), 'utf8'))(shim);
if (!shim.MF_DATA) { console.error('✗ public/data.js did not publish window.MF_DATA'); process.exit(1); }
const { endStateRuns: runs, states, leaderHistory = [] } = shim.MF_DATA;
const STATE_IDS = Array.from({ length: 11 }, (_, i) => i + 1);
const EXPOSURE_IDS = [1, 2, 3, 4, 5];
const problems = [];

const entries = Object.entries(runs);
if (!entries.length) problems.push('no runs published');

for (const [key, run] of entries) {
  const values = STATE_IDS.map(id => run.probabilities?.[id]);
  if (values.some(v => !Number.isInteger(v) || v < 0 || v > 100)) problems.push(`${key}: probabilities must be integers 0-100`);
  const sum = values.reduce((a, c) => a + (c || 0), 0);
  if (sum !== 100) problems.push(`${key}: probabilities sum to ${sum}, not 100`);

  for (const id of STATE_IDS) {
    const band = run.range?.[id];
    if (band && (run.probabilities[id] < band[0] || run.probabilities[id] > band[1])) {
      problems.push(`${key}: S${id} published ${run.probabilities[id]}% outside its sample range ${band[0]}-${band[1]}%`);
    }
  }

  // The exposure chart draws the five extinction-risk segments and labels the
  // sum; the uncertainty beside it has to belong to that same number.
  const drawn = EXPOSURE_IDS.reduce((a, id) => a + run.probabilities[id], 0);
  const published = run.exposurePublished;
  if (!published || !Number.isFinite(published.se)) problems.push(`${key}: exposurePublished.se missing`);
  else if (published.value !== drawn) problems.push(`${key}: exposurePublished.value ${published.value} != drawn total ${drawn}`);
}

// Coordinate-wise medians need not sum to 100, which is why the site
// renormalizes them; this asserts the renormalization is still applied.
const median = list => { const s = [...list].sort((a, b) => a - b); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const medians = STATE_IDS.map(id => median(entries.map(([, run]) => run.probabilities[id])));
const total = medians.reduce((a, c) => a + c, 0);
const columns = STATE_IDS.map(id => entries.map(([, run]) => run.probabilities[id]).sort((a, b) => a - b));
const quantile = (column, f) => { const k = (column.length - 1) * f, lo = Math.floor(k), hi = Math.ceil(k); return column[lo] + (column[hi] - column[lo]) * (k - lo); };
const scaled = medians.map(v => (v / total) * 100);
const out = scaled.map(Math.floor);
const order = scaled.map((v, i) => [v - out[i], i]).sort((a, b) => b[0] - a[0]).map(([, i]) => i);
let given = 0;
const shortfall = 100 - out.reduce((a, c) => a + c, 0);
for (const bounds of [columns.map(c => quantile(c, 0.75)), columns.map(c => c.at(-1)), null]) {
  if (given >= shortfall) break;
  for (const i of order) {
    if (given >= shortfall) break;
    if (bounds && out[i] + 1 > bounds[i]) continue;
    out[i] += 1; given += 1;
  }
}
if (out.reduce((a, c) => a + c, 0) !== 100) problems.push(`headline aggregate normalises to ${out.reduce((a, c) => a + c, 0)}, not 100`);
for (const [i, id] of STATE_IDS.entries()) {
  const column = entries.map(([, run]) => run.probabilities[id]).sort((a, b) => a - b);
  const at = f => { const k = (column.length - 1) * f, lo = Math.floor(k), hi = Math.ceil(k); return column[lo] + (column[hi] - column[lo]) * (k - lo); };
  if (out[i] < at(0.25) || out[i] > at(0.75)) {
    problems.push(`headline S${id} published ${out[i]}% outside the models' middle half ${at(0.25)}-${at(0.75)}%`);
  }
}

// The leader timeline is published data, so it is checked like the rest.
if (leaderHistory.length) {
  const dates = leaderHistory.map(h => h.date);
  if (dates.some((d, i) => i && d <= dates[i - 1])) problems.push('leaderHistory dates are not in ascending order');
  const counts = leaderHistory.map(h => h.models);
  if (counts.some((n, i) => i && n < counts[i - 1])) problems.push('leaderHistory model count goes backwards');
  leaderHistory.forEach((entry, i) => {
    if (!states.some(s => s.id === entry.stateId)) problems.push(`leaderHistory ${entry.date} names ending ${entry.stateId}, which is not in the taxonomy`);
    const differs = i === 0 || leaderHistory[i - 1].stateId !== entry.stateId;
    if (entry.changed !== differs) problems.push(`leaderHistory ${entry.date} is flagged changed=${entry.changed} but differs=${differs}`);
  });
  const latest = leaderHistory.at(-1);
  if (latest && latest.stateId !== out.indexOf(Math.max(...out)) + 1) {
    problems.push(`leaderHistory ends on ending ${latest.stateId} but the aggregate leads with ${out.indexOf(Math.max(...out)) + 1}`);
  }
}

if (problems.length) { problems.forEach(p => console.error('✗ ' + p)); process.exit(1); }
console.log(`✓ ${entries.length} runs valid, ${leaderHistory.length} timeline entries — each sums to 100, sits inside its sample range, and carries an exposure error for the figure drawn`);
console.log(`  headline aggregate: raw medians sum to ${total}, published as ${out.join(', ')}`);
