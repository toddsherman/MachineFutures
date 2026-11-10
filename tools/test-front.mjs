// The front page restates the published numbers in five plain groups. These
// checks hold that restatement to the data it came from.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(join(root, file), 'utf8');
const load = (file, key) => { const window = {}; new Function('window', read(file))(window); return window[key]; };
const front = load('public/front-data.js', 'FRONT');
const site = load('public/data.js', 'MF_DATA');
const exported = JSON.parse(read('data/forecasts.json'));
const sum = values => values.reduce((total, value) => total + value, 0);

test('the five groups cover each of the eleven futures exactly once', () => {
  const ids = front.groups.flatMap(group => group.ids).sort((a, b) => a - b);
  assert.deepEqual(ids, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  for (const future of front.futures) {
    assert.ok(front.groups.find(group => group.key === future.group).ids.includes(future.id), `future ${future.id} is in its group`);
    assert.ok(future.plain.trim(), `future ${future.id} has a plain name`);
  }
});

test('the extinction groups follow the site tiers', () => {
  const tiered = site.states.filter(state => state.extinction).map(state => state.id).sort((a, b) => a - b);
  assert.deepEqual(front.groups.find(group => group.key === 'gone').ids, tiered);
  for (const future of front.futures) {
    const state = site.states.find(candidate => candidate.id === future.id);
    assert.equal(future.color, state.color);
    assert.equal(future.tier, state.extinction || null);
    assert.equal(future.name, state.name, 'coined names are never changed');
  }
});

test('every year carries the published figures', () => {
  assert.deepEqual(front.horizons.slice().sort(), Object.keys(exported.datasets).sort());
  for (const horizon of front.horizons) {
    const published = exported.datasets[horizon];
    const aggregate = front.aggregates[horizon];
    assert.equal(aggregate.models, published.aggregate.model_count);
    assert.equal(aggregate.labs, published.aggregate.lab_count);
    aggregate.p.forEach((value, index) => {
      const source = Number(published.aggregate.unrounded_lab_balanced_probabilities[index + 1]);
      assert.ok(Math.abs(value - source) <= 0.05 + 1e-9, `${horizon} future ${index + 1}: ${value} against ${source}`);
    });
    assert.ok(Math.abs(sum(aggregate.p) - 100) <= 0.6, `${horizon} all-labs figures sum to about 100`);
    for (const model of published.models) {
      const entry = front.models.find(candidate => candidate.id === model.api_model_id);
      assert.ok(entry?.h[horizon], `${model.api_model_id} has ${horizon}`);
      assert.deepEqual(entry.h[horizon].p, Array.from({ length: 11 }, (_, index) => Number(model.probabilities[index + 1])));
      assert.equal(sum(entry.h[horizon].p), 100);
      assert.equal(entry.h[horizon].why, model.rationales[entry.h[horizon].top], 'the quoted reason is verbatim');
    }
    for (const voice of [front.quotes[horizon].hi, front.quotes[horizon].lo]) {
      const model = published.models.find(candidate => candidate.model === voice.model);
      assert.equal(voice.text, model.rationales[9], 'quotes are verbatim');
      assert.equal(voice.value, Number(model.probabilities[9]));
    }
  }
});

test('model ids match the explorer, so links between the two pages resolve', () => {
  const runKeys = new Set(Object.values(site.datasets).flatMap(dataset => Object.keys(dataset.endStateRuns)));
  for (const model of front.models) assert.ok(runKeys.has(model.id), model.id);
});

test('the page carries the default headline before any script runs', () => {
  const html = read('public/index.html');
  const hero = html.match(/<!-- BUILD:hero -->([\s\S]*?)<!-- \/BUILD:hero -->/)?.[1] ?? '';
  assert.match(hero, new RegExp(`<h1 id="headline">For ${front.defaultHorizon}, AI models put`));
  assert.match(hero, /of 100 points/);
  const fallback = html.match(/<!-- BUILD:noscript -->([\s\S]*?)<!-- \/BUILD:noscript -->/)?.[1] ?? '';
  const figures = [...fallback.matchAll(/<li><b>(\d+)<\/b>/g)].map(match => Number(match[1]));
  assert.equal(figures.length, front.groups.length);
  assert.equal(sum(figures), 100);
  assert.match(html, /href="explore\.html"/);
});

test('model-authored text only reaches the page through the escaper', () => {
  const script = read('public/front.js');
  for (const field of ['voice.text', 'answer.why']) {
    const uses = script.split(field).length - 1;
    const escaped = script.split(`esc(${field})`).length - 1;
    assert.ok(uses > 0 && uses === escaped, `${field} is always escaped`);
  }
});
