#!/usr/bin/env node
// How much do these forecasts actually differ?
//
// Every run is a distribution over the same 11 mutually exclusive endings, so
// the natural comparisons are distances between distributions. Two are used:
//   Total variation  ½Σ|p−q|  — the share of probability mass that would have
//                               to move for one model to become another.
//   Jensen–Shannon   symmetric, bounded; √JSD is a true metric.
//
// The load-bearing question is not "do models differ" but "do they differ by
// more than a single model differs from itself across samples". Five samples
// per model give a noise floor to compare against.
//
// Usage: node tools/analyse-agreement.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const IDS = Array.from({ length: 11 }, (_, i) => 'S' + (i + 1));
const roster = JSON.parse(readFileSync(join(root, 'tools', 'models.json'), 'utf8')).models;
const labelOf = new Map(roster.map(m => [m.model, m.label]));

const runs = readdirSync(join(root, 'runs')).filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(readFileSync(join(root, 'runs', f), 'utf8')))
  .filter(b => b.prompt_family === 'end_states')
  .map(b => ({
    id: b.model.api_string,
    label: labelOf.get(b.model.api_string) || b.model.name,
    provider: b.model.provider,
    date: b.asked_on,
    samples: b.samples.map(s => IDS.map(id => s.answers[id].value / 100))
  }));

// runs/ accumulates history, so cross-model comparisons must use one run per
// model — the newest — or a model gets compared against its own past self.
const history = new Map();
for (const r of runs) {
  const list = history.get(r.id) || [];
  list.push(r);
  history.set(r.id, list.sort((a, b) => a.date.localeCompare(b.date)));
}
const latest = [...history.values()].map(list => list.at(-1));

const norm = v => { const t = v.reduce((a, c) => a + c, 0); return v.map(x => x / t); };
const mean = vs => norm(vs[0].map((_, i) => vs.reduce((a, v) => a + v[i], 0) / vs.length));
const tv = (p, q) => p.reduce((a, _, i) => a + Math.abs(p[i] - q[i]), 0) / 2;
const kl = (p, q) => p.reduce((a, _, i) => p[i] ? a + p[i] * Math.log2(p[i] / q[i]) : a, 0);
const jsd = (p, q) => { const m = p.map((x, i) => (x + q[i]) / 2); return (kl(p, m) + kl(q, m)) / 2; };
const entropy = p => -p.reduce((a, x) => x ? a + x * Math.log2(x) : a, 0);
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const fmt = n => n.toFixed(3);

// --- 1. Self-consistency: how far apart are a model's own five samples? ---
const self = latest.map(r => {
  const d = [];
  for (let i = 0; i < r.samples.length; i++)
    for (let j = i + 1; j < r.samples.length; j++) d.push(tv(r.samples[i], r.samples[j]));
  return { ...r, centre: mean(r.samples), selfTV: avg(d), selfMax: Math.max(...d), entropy: entropy(mean(r.samples)) };
}).sort((a, b) => a.selfTV - b.selfTV);

console.log('SELF-CONSISTENCY — mean pairwise total variation between a model\'s own 5 samples');
console.log('(0 = identical every time; higher = the model does not hold a stable view)\n');
for (const r of self) console.log(`  ${fmt(r.selfTV)}  worst ${fmt(r.selfMax)}   ${r.label.padEnd(17)} ${r.provider}`);
const noiseFloor = avg(self.map(r => r.selfTV));
console.log(`\n  noise floor (mean self-distance across all models): ${fmt(noiseFloor)}`);

// --- 2. Between models ---
const pairs = [];
for (let i = 0; i < self.length; i++)
  for (let j = i + 1; j < self.length; j++)
    pairs.push({ a: self[i], b: self[j], tv: tv(self[i].centre, self[j].centre), jsd: jsd(self[i].centre, self[j].centre),
                 sameLab: self[i].provider === self[j].provider });

const between = avg(pairs.map(p => p.tv));
console.log(`\nBETWEEN MODELS — mean total variation between different models: ${fmt(between)}`);
console.log(`  signal-to-noise (between ÷ within): ${(between / noiseFloor).toFixed(2)}×`);

// --- 3. Does a lab family cluster? ---
const withinLab = pairs.filter(p => p.sameLab).map(p => p.tv);
const crossLab = pairs.filter(p => !p.sameLab).map(p => p.tv);
console.log(`\nLAB FAMILIES`);
console.log(`  same lab   n=${withinLab.length}  mean TV ${fmt(avg(withinLab))}`);
console.log(`  cross lab  n=${crossLab.length}  mean TV ${fmt(avg(crossLab))}`);

// Permutation test: shuffle lab labels, how often is the gap this large by chance?
const labels = self.map(r => r.provider);
let asBig = 0, TRIALS = 20000;
const observed = avg(crossLab) - avg(withinLab);
for (let t = 0; t < TRIALS; t++) {
  const shuffled = [...labels];
  for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
  const w = [], c = [];
  let k = 0;
  for (let i = 0; i < self.length; i++) for (let j = i + 1; j < self.length; j++, k++)
    (shuffled[i] === shuffled[j] ? w : c).push(pairs[k].tv);
  if (w.length && c.length && (avg(c) - avg(w)) >= observed) asBig++;
}
console.log(`  gap ${fmt(observed)};  permutation p = ${(asBig / TRIALS).toFixed(4)} (${TRIALS} shuffles)`);

// --- 4. Closest and furthest pairs ---
const sorted = [...pairs].sort((a, b) => a.tv - b.tv);
console.log('\nCLOSEST PAIRS');
for (const p of sorted.slice(0, 4)) console.log(`  ${fmt(p.tv)}  ${p.a.label} ↔ ${p.b.label}${p.sameLab ? '   (same lab)' : ''}`);
console.log('FURTHEST PAIRS');
for (const p of sorted.slice(-4).reverse()) console.log(`  ${fmt(p.tv)}  ${p.a.label} ↔ ${p.b.label}${p.sameLab ? '   (same lab)' : ''}`);

// --- 5. Which endings carry the disagreement? ---
const states = JSON.parse(readFileSync(join(root, 'tools', 'state-names.json'), 'utf8'));
console.log('\nDISAGREEMENT BY ENDING — spread across models vs spread within models');
const perState = IDS.map((_, i) => {
  const across = self.map(r => r.centre[i] * 100);
  const m = avg(across);
  const sd = Math.sqrt(avg(across.map(v => (v - m) ** 2)));
  const withinSd = avg(self.map(r => { const vals = r.samples.map(s => s[i] * 100); const mu = avg(vals); return Math.sqrt(avg(vals.map(v => (v - mu) ** 2))); }));
  return { name: states[i], mean: m, sd, withinSd, ratio: sd / (withinSd || 0.01) };
}).sort((a, b) => b.ratio - a.ratio);
for (const s of perState) console.log(`  ${s.name.padEnd(18)} mean ${s.mean.toFixed(1).padStart(5)}%  across-model SD ${s.sd.toFixed(2).padStart(5)}  within-model SD ${s.withinSd.toFixed(2)}  ratio ${s.ratio.toFixed(1)}×`);

// --- 6. Commitment ---
console.log('\nCOMMITMENT — Shannon entropy of each model\'s allocation (max 3.46 bits = perfectly flat)');
for (const r of [...self].sort((a, b) => a.entropy - b.entropy)) console.log(`  ${r.entropy.toFixed(3)} bits  ${r.label.padEnd(17)} ${r.provider}`);

// --- 7. Is the exposure ranking distinguishable from sampling noise? ---
// Extinction-risk exposure is the site's headline number, so the question is
// how far apart two models must be before the gap means anything.
console.log('\nEXTINCTION-RISK EXPOSURE — per-model spread across its own samples');
const exposure = self.map(r => {
  const per = r.samples.map(s => (s[0] + s[1] + s[2] + s[3] + s[4]) * 100);
  const mu = avg(per);
  const sd = Math.sqrt(avg(per.map(v => (v - mu) ** 2)));
  return { label: r.label, provider: r.provider, mu, sd, se: sd / Math.sqrt(per.length), lo: Math.min(...per), hi: Math.max(...per) };
}).sort((a, b) => b.mu - a.mu);
for (const e of exposure)
  console.log(`  ${e.mu.toFixed(1).padStart(5)}%  ±${e.se.toFixed(1)} se   range ${e.lo.toFixed(0)}–${e.hi.toFixed(0)}%   ${e.label.padEnd(17)} ${e.provider}`);
const pooledSe = Math.sqrt(avg(exposure.map(e => e.se ** 2)));
console.log(`\n  pooled standard error: ±${pooledSe.toFixed(2)} points`);
console.log(`  two models are distinguishable at ~95% only if they differ by more than ${(2.78 * pooledSe).toFixed(1)} points`);
const gaps = [];
for (let i = 0; i < exposure.length - 1; i++) gaps.push({ a: exposure[i], b: exposure[i + 1], d: exposure[i].mu - exposure[i + 1].mu });
const indistinct = gaps.filter(g => g.d < 2.78 * pooledSe);
console.log(`  adjacent pairs in the ranking that are NOT separable: ${indistinct.length} of ${gaps.length}`);
for (const g of indistinct) console.log(`    ${g.a.label} (${g.a.mu.toFixed(1)}%) vs ${g.b.label} (${g.b.mu.toFixed(1)}%) — gap ${g.d.toFixed(1)}`);


// --- 8. Test-retest: same model, asked again on a later date ---
const repeated = [...history.values()].filter(list => list.length > 1);
if (repeated.length) {
  console.log('\nTEST-RETEST — the same model id, re-asked on a later date');
  console.log('(distance between run means; compare against the within-run noise floor above)\n');
  const drifts = [];
  for (const list of repeated) {
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1], b = list[i];
      const d = tv(mean(a.samples), mean(b.samples));
      drifts.push(d);
      console.log(`  ${fmt(d)}   ${a.label.padEnd(17)} ${a.date} (n=${a.samples.length}) → ${b.date} (n=${b.samples.length})`);
    }
  }
  console.log(`\n  mean run-to-run drift: ${fmt(avg(drifts))}`);
  console.log(`  within-run noise floor: ${fmt(noiseFloor)}`);
  console.log(`  ratio: ${(avg(drifts) / noiseFloor).toFixed(2)}× — under 1 means a run's aggregate is more`);
  console.log('  reproducible than any single sample, which is what averaging is for.');
} else {
  console.log('\nTEST-RETEST — needs a second run of the same model id; none yet.');
}
