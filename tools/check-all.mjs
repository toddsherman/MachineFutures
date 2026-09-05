#!/usr/bin/env node
// Run every non-browser check and report all of them.
//
// These used to be an && chain, so the first failure hid the state of
// everything after it — when check-site broke, nobody knew whether the links
// or the harness tests were fine, and one terse line was easy to misread as a
// pass. This runs them all and ends on an unambiguous verdict.
//
// Usage: node tools/check-all.mjs
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const checks = [
  ['raw batches', ['tools/verify-runs.mjs']],
  ['published data', ['tools/check-site.mjs']],
  ['published links', ['tools/check-links.mjs']],
  ['application parses', ['--check', 'public/app.js']],
  ['data parses', ['--check', 'public/data.js']],
  ['unit and harness tests', ['--test', 'tools/test-classify.mjs', 'tools/test-harness.mjs']]
];

const results = [];
for (const [name, args] of checks) {
  const run = spawnSync('node', args, { cwd: root, encoding: 'utf8' });
  const ok = run.status === 0;
  results.push({ name, ok, output: `${run.stdout ?? ''}${run.stderr ?? ''}`.trimEnd() });
  process.stdout.write(`${ok ? '✓' : '✗'} ${name}\n`);
}

const failed = results.filter(r => !r.ok);
for (const r of failed) {
  console.error(`\n─── ${r.name} ───\n${r.output}`);
}

console.log('');
if (failed.length) {
  console.error(`✗ ${failed.length} of ${results.length} checks failed: ${failed.map(r => r.name).join(', ')}`);
  process.exit(1);
}
console.log(`✓ all ${results.length} checks passed`);
