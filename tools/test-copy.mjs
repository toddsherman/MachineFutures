// House rule: no em dashes in anything we write for readers, on the site or in
// the documentation. Three kinds of text are not ours to reword and are
// exempt: what the models wrote (rationales), the prompts they were given, and
// the taxonomy descriptions on the site, which tools/check-site.mjs holds word
// for word to those prompts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(join(root, file), 'utf8');
const load = (file, key) => { const window = {}; new Function('window', read(file))(window); return window[key]; };
const EM_DASH = '—';
const where = (file, source) => source.split('\n')
  .map((line, index) => (line.includes(EM_DASH) ? `${file}:${index + 1}: ${line.trim().slice(0, 120)}` : null))
  .filter(Boolean);

// Every string in a value, except those under keys that hold exempt text.
function strings(value, exempt, path = '') {
  if (typeof value === 'string') return [[path, value]];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => (exempt.has(key) ? [] : strings(child, exempt, `${path}/${key}`)));
}

test('hand-written site files have no em dashes', () => {
  const files = ['index.html', 'explore.html', 'front.js', 'front-copy.js', 'front.css', 'app.js', 'styles.css', 'analytics.js'];
  const found = files.flatMap(file => where(`public/${file}`, read(`public/${file}`)));
  assert.deepEqual(found, []);
});

test('generated site data has no em dashes outside model and prompt text', () => {
  // data.js: everything except rationales and the prompt-mirrored descriptions.
  const site = load('public/data.js', 'MF_DATA');
  const inSite = strings(site, new Set(['rationales', 'description'])).filter(([, value]) => value.includes(EM_DASH));
  assert.deepEqual(inSite.map(([path]) => path), []);
  // front-data.js: quotes carry model text; `dated` and `longTerm` carry the
  // prompt's descriptions.
  const front = load('public/front-data.js', 'FRONT');
  const inFront = strings(front, new Set(['text', 'dated', 'longTerm'])).filter(([, value]) => value.includes(EM_DASH));
  assert.deepEqual(inFront.map(([path]) => path), []);
  // The quote pairs are model text, but they were chosen by hand, so choose
  // ones that keep the page clean.
  const pairs = JSON.parse(read('tools/front-quotes.json'));
  assert.ok(!JSON.stringify(pairs).includes(EM_DASH), 'tools/front-quotes.json');
});

test('the documentation has no em dashes', () => {
  const docs = ['README.md', 'data/README.md', 'runs/README.md', 'archive/README.md',
    ...readdirSync(join(root, 'docs')).filter(file => file.endsWith('.md')).map(file => `docs/${file}`),
    ...readdirSync(join(root, 'docs/sweeps')).filter(file => file.endsWith('.md')).map(file => `docs/sweeps/${file}`)];
  const found = docs.flatMap(file => where(file, read(file)));
  assert.deepEqual(found, []);
});
