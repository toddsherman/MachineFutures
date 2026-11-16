// The site publishes its figures a second time for programs: static JSON and
// llms.txt for anything that fetches a URL, and WebMCP tools for agents inside
// the browser. These checks hold each of those to the published export, and
// to the front page a person sees, by a route that does not go through the
// code that wrote them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const exported = json('data/forecasts.json');
const summary = json('public/data/summary.json');
const forecasts = json('public/data/forecasts.json');
const llms = read('public/llms.txt');
const html = read('public/index.html');
const SITE = 'https://www.machinefutures.ai';
const IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const sum = values => values.reduce((total, value) => total + value, 0);
const modelFiles = readdirSync(join(root, 'public/data/models')).filter(file => file.endsWith('.json')).sort();
const publishedIds = [...new Set(Object.values(exported.datasets).flatMap(dataset => dataset.models.map(model => model.api_model_id)))].sort();

// ---------- The static files ----------

test('the summary carries the published combined figures for every year', () => {
  assert.deepEqual(summary.horizons.map(horizon => horizon.id).sort(), Object.keys(exported.datasets).sort());
  assert.equal(summary.default_horizon, exported.default_horizon);
  for (const horizon of summary.horizons) {
    const aggregate = exported.datasets[horizon.id].aggregate;
    const figures = summary.all_labs[horizon.id];
    assert.equal(horizon.model_count, aggregate.model_count);
    assert.equal(horizon.lab_count, aggregate.lab_count);
    assert.equal(horizon.target_year, exported.horizons.find(item => item.id === horizon.id).targetYear);
    assert.deepEqual(figures.points, aggregate.probabilities, `${horizon.id}: the site's published tenths`);
    assert.ok(Math.abs(sum(Object.values(figures.points)) - 100) < 1e-9, `${horizon.id}: points total 100`);
    assert.equal(sum(Object.values(figures.group_points)), 100, `${horizon.id}: the five groups total 100`);
    // Each group's whole number has to be the rounding of its futures' sum.
    for (const group of summary.groups) {
      const exact = sum(group.future_ids.map(id => Number(aggregate.unrounded_lab_balanced_probabilities[id])));
      assert.ok(Math.abs(figures.group_points[group.key] - exact) < 1, `${horizon.id} ${group.key}: ${figures.group_points[group.key]} against ${exact.toFixed(2)}`);
    }
  }
});

test('the summary says what the front page says before any script runs', () => {
  const noscript = html.match(/<!-- BUILD:noscript -->([\s\S]*?)<!-- \/BUILD:noscript -->/)[1];
  const shown = Object.fromEntries([...noscript.matchAll(/<li><b>(\d+)<\/b> ([^<]+)<\/li>/g)].map(match => [match[2].replace(/&amp;/g, '&'), Number(match[1])]));
  const stated = Object.fromEntries(summary.groups.map(group => [group.label, summary.all_labs[summary.default_horizon].group_points[group.key]]));
  assert.deepEqual(stated, shown);
  const headline = html.match(/<h1 id="headline">([\s\S]*?)<\/h1>/)[1].replace(/<[^>]+>/g, '');
  assert.ok(summary.headline.startsWith(headline), summary.headline);
  assert.ok(llms.includes(summary.headline), 'llms.txt opens with the same headline');
});

test('the futures and groups match the published taxonomy', () => {
  assert.deepEqual(summary.futures.map(future => future.id), IDS);
  assert.deepEqual(summary.groups.flatMap(group => group.future_ids).sort((a, b) => a - b), IDS);
  const dated = summary.horizons.find(horizon => horizon.id !== 'long-term').id;
  for (const future of summary.futures) {
    const ending = exported.endings.find(candidate => candidate.id === future.id);
    assert.equal(future.name, ending.name, 'coined names are never changed');
    assert.equal(future.extinction_tier, ending.extinction_tier);
    assert.ok(future.plain_name.trim());
    assert.ok(summary.groups.find(group => group.key === future.group).future_ids.includes(future.id));
    assert.equal(future.definition_for_dated_years, exported.endings_by_horizon[dated].find(candidate => candidate.id === future.id).description);
    assert.equal(future.definition_for_long_term, exported.endings_by_horizon['long-term'].find(candidate => candidate.id === future.id).description);
  }
});

test('every published model has one file, and no file is left over', () => {
  assert.deepEqual(modelFiles.map(file => file.replace(/\.json$/, '')).sort(), publishedIds);
  assert.deepEqual(summary.models.map(model => model.id).sort(), publishedIds);
  assert.deepEqual(forecasts.models.map(model => model.id).sort(), publishedIds);
  for (const model of summary.models) assert.equal(model.detail, `${SITE}/data/models/${model.id}.json`);
});

test('every model file repeats the export word for word and number for number', () => {
  for (const [horizon, dataset] of Object.entries(exported.datasets)) {
    for (const published of dataset.models) {
      const detail = json(`public/data/models/${published.api_model_id}.json`);
      const answer = detail.horizons[horizon];
      const where = `${published.api_model_id} ${horizon}`;
      assert.ok(answer, where);
      assert.equal(detail.name, published.model);
      assert.equal(detail.lab, published.provider);
      assert.equal(detail.asked_on, published.asked_on, where);
      assert.deepEqual(answer.points, published.probabilities, where);
      assert.equal(sum(Object.values(answer.points)), 100, where);
      assert.equal(sum(Object.values(answer.group_points)), 100, where);
      for (const group of summary.groups) {
        assert.equal(answer.group_points[group.key], sum(group.future_ids.map(id => published.probabilities[id])), `${where} ${group.key}`);
      }
      assert.deepEqual(answer.lowest_and_highest_answer, published.samples_range, where);
      assert.deepEqual(answer.middle_half_of_answers, published.middle_half, where);
      assert.deepEqual(answer.reasons, published.rationales, `${where}: reasons are verbatim`);
      assert.equal(answer.times_asked, published.samples, where);
      assert.equal(answer.question_set, published.question_set, where);
      assert.deepEqual(forecasts.models.find(model => model.id === published.api_model_id).points[horizon], published.probabilities, where);
      assert.ok(summary.models.find(model => model.id === published.api_model_id).horizons.includes(horizon), where);
    }
  }
  // And nothing beyond the export.
  for (const model of forecasts.models) {
    for (const horizon of Object.keys(model.points)) {
      assert.ok(exported.datasets[horizon].models.some(published => published.api_model_id === model.id), `${model.id} ${horizon}`);
    }
  }
});

test('the summary stays small enough to read in one go', () => {
  const size = Buffer.byteLength(read('public/data/summary.json'));
  assert.ok(size < 48_000, `summary.json is ${size} bytes; it was 28 KB when this limit was set and is the file an assistant reads first`);
});

test('every link in llms.txt and the summary leads to a file the site serves', () => {
  const links = [
    ...[...llms.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map(match => match[1]),
    ...summary.horizons.map(horizon => horizon.question),
    ...summary.models.map(model => model.detail),
    ...Object.values(summary.files).filter(url => !url.includes('{')),
  ];
  assert.ok(links.length > 20);
  for (const link of links.filter(url => url.startsWith(SITE))) {
    const path = new URL(link).pathname;
    assert.ok(existsSync(join(root, 'public', path === '/' ? 'index.html' : path)), `${link} is not a file in public/`);
  }
  assert.match(llms, /^# Machine Futures\n\n> /, 'llms.txt opens with a title and a one-paragraph summary');
});

test('both pages point to the data and load the agent tools', () => {
  for (const page of ['index.html', 'explore.html']) {
    const source = read(`public/${page}`);
    assert.match(source, /<link rel="alternate" type="application\/json" href="data\/summary\.json"/, page);
    assert.match(source, /<script src="webmcp\.js"><\/script>/, page);
  }
});

// ---------- The WebMCP tools ----------

// Run public/webmcp.js as a browser would, with the files on disk standing in
// for the network and a recording stand-in for document.modelContext.
function browser({ modelContext = true, onNavigator = false } = {}) {
  const tools = [];
  const fetched = [];
  const context = { registerTool: async tool => { tools.push(tool); } };
  const document = { currentScript: { src: `${SITE}/webmcp.js` } };
  const navigator = {};
  if (modelContext) (onNavigator ? navigator : document).modelContext = context;
  const fetch = async url => {
    const path = new URL(url).pathname;
    fetched.push(path);
    const file = join(root, 'public', path);
    if (!existsSync(file)) return { ok: false, status: 404, json: async () => { throw new Error('no body'); } };
    return { ok: true, status: 200, json: async () => JSON.parse(readFileSync(file, 'utf8')) };
  };
  new Function('document', 'navigator', 'location', 'fetch', read('public/webmcp.js'))(document, navigator, { href: `${SITE}/` }, fetch);
  const settle = () => new Promise(resolve => setTimeout(resolve, 20));
  const call = (name, input) => tools.find(tool => tool.name === name).execute(input, { signal: new AbortController().signal });
  return { tools, fetched, settle, call };
}

test('without WebMCP the script fetches nothing and registers nothing', async () => {
  const page = browser({ modelContext: false });
  await page.settle();
  assert.deepEqual(page.fetched, []);
  assert.deepEqual(page.tools, []);
});

test('with WebMCP it registers a few well-formed, read-only tools', async () => {
  for (const onNavigator of [false, true]) {
    const page = browser({ onNavigator });
    await page.settle();
    assert.deepEqual(page.tools.map(tool => tool.name), ['get_overview', 'get_combined_forecast', 'get_model_forecast', 'compare_models', 'get_future_definitions']);
    assert.deepEqual(page.fetched, ['/data/summary.json'], 'one small file up front; the rest only when a tool is called');
    for (const tool of page.tools) {
      // The registration rules in the WebMCP draft.
      assert.match(tool.name, /^[A-Za-z0-9_.-]{1,128}$/);
      assert.ok(tool.description.trim().length > 40, tool.name);
      assert.ok(!tool.description.includes('—'), tool.name);
      assert.equal(tool.inputSchema.type, 'object', tool.name);
      assert.equal(tool.annotations.readOnlyHint, true, tool.name);
      assert.equal(typeof tool.execute, 'function', tool.name);
    }
    assert.equal(page.tools.find(tool => tool.name === 'get_model_forecast').annotations.untrustedContentHint, true, 'model-written reasons are flagged as not the site\'s own words');
  }
});

test('the tools answer with the published figures', async () => {
  const page = browser();
  await page.settle();

  const overview = await page.call('get_overview', {});
  assert.deepEqual(overview.years, summary.horizons.map(horizon => horizon.id));
  assert.deepEqual(overview.models.map(model => model.id).sort(), publishedIds);
  assert.equal(overview.futures.length, 11);

  for (const horizon of Object.keys(exported.datasets)) {
    const aggregate = exported.datasets[horizon].aggregate;
    const combined = await page.call('get_combined_forecast', { year: horizon });
    assert.equal(combined.model_count, aggregate.model_count);
    assert.deepEqual(Object.fromEntries(combined.futures.map(future => [future.id, future.points])), aggregate.probabilities, horizon);
    assert.equal(sum(combined.groups.map(group => group.points)), 100, horizon);

    const side = await page.call('compare_models', { year: horizon, future_id: 9 });
    assert.equal(side.models.length, exported.datasets[horizon].models.length, horizon);
    assert.deepEqual(side.models.map(model => model.points[9]), side.models.map(model => model.points[9]).sort((a, b) => b - a), `${horizon}: ranked highest first`);
    for (const row of side.models) {
      const published = exported.datasets[horizon].models.find(model => model.api_model_id === row.id);
      assert.deepEqual(row.points, published.probabilities, `${row.id} ${horizon}`);
      assert.equal(sum(Object.values(row.group_points)), 100, `${row.id} ${horizon}`);
    }
  }

  const published = exported.datasets['2030'].models[0];
  const answer = await page.call('get_model_forecast', { model: published.api_model_id, year: '2030' });
  assert.equal(answer.model.name, published.model);
  for (const future of answer.futures) {
    assert.equal(future.points, published.probabilities[future.id]);
    assert.equal(future.reason, published.rationales[future.id]);
    assert.deepEqual([future.lowest_answer, future.highest_answer], published.samples_range[future.id]);
  }
  assert.equal(sum(answer.futures.map(future => future.points)), 100);

  const dated = await page.call('get_future_definitions', { year: '2030' });
  const lasting = await page.call('get_future_definitions', { year: 'long-term' });
  assert.equal(dated.futures[8].definition, exported.endings_by_horizon['2030'][8].description);
  assert.equal(lasting.futures[8].definition, exported.endings_by_horizon['long-term'][8].description);

  // Everything a tool returns has to survive being sent as JSON.
  for (const result of [overview, answer, dated]) assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
});

test('the tools default to the front page year and accept loose input', async () => {
  const page = browser();
  await page.settle();
  assert.equal((await page.call('get_combined_forecast', {})).year, summary.default_horizon);
  assert.equal((await page.call('get_combined_forecast', undefined)).year, summary.default_horizon);
  assert.equal((await page.call('get_combined_forecast', '{"year":"2100"}')).year, '2100', 'arguments sent as a JSON string');
  assert.equal((await page.call('get_combined_forecast', { year: 3000 })).year, 'long-term');
  const named = summary.models[0];
  assert.equal((await page.call('get_model_forecast', { model: named.name.toUpperCase() })).model.id, named.id, 'a model can be named instead of given by id');
});

test('the tools refuse what they cannot answer, in words an agent can act on', async () => {
  const page = browser();
  await page.settle();
  await assert.rejects(page.call('get_combined_forecast', { year: '2045' }), /Unknown year "2045"\. Use one of: 2030/);
  await assert.rejects(page.call('get_model_forecast', { model: 'not-a-model' }), /Unknown model "not-a-model"\. Call get_overview/);
  await assert.rejects(page.call('compare_models', { future_id: 12 }), /Unknown future_id "12"/);
  // A model that was only ever asked the long-term question.
  const partial = summary.models.find(model => model.horizons.length < summary.horizons.length);
  if (partial) {
    const missing = summary.horizons.find(horizon => !partial.horizons.includes(horizon.id)).id;
    await assert.rejects(page.call('get_model_forecast', { model: partial.id, year: missing }), /was not asked about/);
  }
});
