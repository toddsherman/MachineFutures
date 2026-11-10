// The front page restates the published numbers in five plain groups, in
// sentences, and in a picture. These checks hold every one of those
// restatements to the data it came from, by a route that does not go through
// the code that produced it wherever that is possible.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renormalizeAllocation } from './allocations.mjs';
import { horizonOfBatch } from './horizons.mjs';
import { shareCard, SHARE_WIDTH, SHARE_HEIGHT } from './share-card.mjs';
import { describePng } from './render-share.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(join(root, file), 'utf8');
const load = (file, key) => { const window = {}; new Function('window', read(file))(window); return window[key]; };
const front = load('public/front-data.js', 'FRONT');
const reasons = load('public/front-why.js', 'FRONT_WHY');
const copy = load('public/front-copy.js', 'FRONT_COPY')(front);
const site = load('public/data.js', 'MF_DATA');
const exported = JSON.parse(read('data/forecasts.json'));
const html = read('public/index.html');
const sum = values => values.reduce((total, value) => total + value, 0);
const IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const vector = model => IDS.map(id => Number(model.probabilities[id]));
const apart = (a, b) => sum(a.map((v, i) => Math.abs(v - b[i]))) / 2;
const text = markup => markup.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
const block = name => html.match(new RegExp(`<!-- BUILD:${name} -->([\\s\\S]*?)<!-- /BUILD:${name} -->`))?.[1] ?? '';

test('the five groups cover each of the eleven futures exactly once', () => {
  const ids = front.groups.flatMap(group => group.ids).sort((a, b) => a - b);
  assert.deepEqual(ids, IDS);
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
      assert.deepEqual(entry.h[horizon].p, vector(model));
      assert.equal(sum(entry.h[horizon].p), 100);
      assert.equal(reasons[entry.id][horizon], model.rationales[entry.h[horizon].top], 'the quoted reason is verbatim');
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

test('the page opens on a small file and leaves the reasons until they are wanted', () => {
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(scripts, ['analytics.js', 'front-data.js', 'front-copy.js', 'front.js']);
  assert.ok(!scripts.includes('data.js'), 'the explorer payload is not loaded by the front page');
  assert.match(read('public/front.js'), /script\.src = 'front-why\.js'/, 'the reasons are fetched by the script, on demand');
  assert.ok(front.models.every(model => Object.values(model.h).every(answer => !('why' in answer))), 'no reason rides in the main data file');
  const size = statSync(join(root, 'public/front-data.js')).size;
  assert.ok(size < 80_000, `front-data.js is ${size} bytes; it was 43 KB when this limit was set and is meant to stay small`);
});

// ---------- The words ----------

test('every sentence renders for every year and every choice, with no holes', () => {
  const holes = /undefined|NaN|null|\[object|Infinity/;
  const check = (name, value) => {
    assert.equal(typeof value, 'string', name);
    assert.ok(value.trim().length > 20, `${name} is not empty`);
    assert.ok(!holes.test(value), `${name}: ${value}`);
    assert.ok(!value.includes('—'), `${name} has an em dash`);
  };
  check('timeTakeaway', copy.timeTakeaway());
  check('steadyTakeaway', copy.steadyTakeaway());
  check('steadyCaption', copy.steadyCaption());
  check('steadySay', copy.steadySay());
  check('footerNote', copy.footerNote());
  for (const h of front.horizons) {
    for (const name of ['kicker', 'headline', 'headlineText', 'dek', 'yearNote', 'metaDescription', 'wordsTakeaway', 'tryTakeaway', 'futuresTakeaway', 'labsNote']) {
      check(`${name} ${h}`, copy[name](h));
    }
    front.groups.forEach((group, by) => {
      check(`allTakeaway ${h} ${group.key}`, copy.allTakeaway(h, by));
      check(`labsTakeaway ${h} ${group.key}`, copy.labsTakeaway(h, by));
    });
    for (const model of copy.modelsFor(h)) check(`cardSay ${model.id} ${h}`, copy.cardSay(model, h));
  }
});

test('the headline names the group the published figures put first, with its figure', () => {
  for (const h of front.horizons) {
    // Straight from the export, without the page's helpers.
    const published = exported.datasets[h].aggregate.unrounded_lab_balanced_probabilities;
    const totals = front.groups.map(group => sum(group.ids.map(id => Number(published[id]))));
    const top = totals.indexOf(Math.max(...totals));
    const headline = copy.headlineText(h);
    assert.ok(headline.includes(front.groups[top].lead), `${h}: ${headline}`);
    assert.equal(headline.includes('most of their points'), totals[top] >= 50, `${h}: "most" only when the leader has at least half`);
    const stated = Number(text(copy.dek(h)).match(/that is (\d+) of 100 points/)[1]);
    assert.ok(Math.abs(stated - totals[top]) < 1, `${h}: the dek says ${stated}, the export says ${totals[top].toFixed(2)}`);
    assert.equal(sum(copy.allLabs(h)), 100, `${h}: the five figures total 100`);
  }
});

test('the page carries the default headline and its link-preview words before any script runs', () => {
  const h = front.defaultHorizon;
  const hero = block('hero');
  assert.ok(hero.includes(`<h1 id="headline">${copy.headline(h)}</h1>`), 'the written headline is the scripted one');
  assert.ok(hero.includes(`<p class="dek" id="dek">${copy.dek(h)}</p>`), 'the written dek is the scripted one');
  assert.ok(hero.includes(`id="kicker">${copy.kicker(h)}</p>`), 'the written kicker is the scripted one');
  const figures = [...block('noscript').matchAll(/<li><b>(\d+)<\/b>/g)].map(match => Number(match[1]));
  assert.deepEqual(figures, copy.allLabs(h));
  const meta = block('meta');
  const described = meta.match(/<meta name="description" content="([^"]*)">/)?.[1];
  assert.equal(described, copy.metaDescription());
  assert.ok(meta.includes(`<meta property="og:description" content="${copy.metaDescription()}">`));
  assert.match(html, /href="explore\.html"/);
});

test('what the page says about how the models were asked is true of the data', () => {
  const counts = new Set(Object.values(exported.datasets).flatMap(dataset => dataset.models.map(model => model.samples)));
  assert.deepEqual([...counts], [20], 'every published model was asked 20 times, as the page says');
  assert.match(html, /We ask 20 times/);
  assert.match(html, /asked 20 times/);
  assert.equal(exported.endings.length, 11);
  assert.match(html, /the same 11 possible futures/);
});

// ---------- The picture ----------

// The elicitation workflow cannot redraw the picture (it has no browser), so it
// sets MF_SHARE_IMAGE=defer and leaves this to CI on the pull request.
test('the link-preview picture shows today’s figures', { skip: process.env.MF_SHARE_IMAGE === 'defer' ? 'deferred to the pull request' : false }, () => {
  const card = shareCard(front, copy);
  assert.equal(card.hash, createHash('sha256').update(card.html).digest('hex'));
  const png = describePng(readFileSync(join(root, 'public/share.png')));
  assert.equal(png.width, SHARE_WIDTH);
  assert.equal(png.height, SHARE_HEIGHT);
  assert.equal(png.stamp, card.hash, 'public/share.png was drawn from other figures. Run `npm run share:render` and commit the picture.');
  const address = `https://www.machinefutures.ai/share.png?v=${card.hash.slice(0, 8)}`;
  assert.ok(block('meta').includes(`<meta property="og:image" content="${address}">`), 'the page points at this version of the picture');
  assert.ok(block('meta').includes(`<meta name="twitter:image" content="${address}">`));
  assert.ok(card.html.includes(copy.headline(front.defaultHorizon)), 'the picture carries the page headline');
});

// ---------- Why they disagree ----------

test('every quote in a disagreement card is word for word, with its real number', () => {
  const approved = JSON.parse(read('tools/front-quotes.json'));
  assert.equal(front.cruxes.length, approved.pairs.length);
  front.cruxes.forEach((crux, index) => {
    const published = exported.datasets[crux.horizon];
    const given = published.models.map(model => Number(model.probabilities[crux.future]));
    assert.equal(crux.question, approved.pairs[index].question);
    assert.equal(crux.low, Math.min(...given));
    assert.equal(crux.high, Math.max(...given));
    assert.equal(crux.count, given.length);
    assert.equal(crux.quotes.length, 2);
    for (const quote of crux.quotes) {
      const model = published.models.find(candidate => candidate.api_model_id === quote.id);
      assert.ok(model.rationales[crux.future].includes(quote.text), `${quote.model}: quoted word for word`);
      assert.equal(quote.value, Number(model.probabilities[crux.future]));
      assert.equal(quote.model, model.model);
    }
    assert.notEqual(crux.quotes[0].value, crux.quotes[1].value, 'a disagreement needs two different numbers');
  });
});

// ---------- Lab by lab ----------

test('a lab’s figure is the plain average of its models', () => {
  for (const h of front.horizons) {
    const published = exported.datasets[h];
    const rows = copy.labRows(h);
    assert.deepEqual(rows.map(row => row.lab).sort(), [...new Set(published.models.map(model => model.provider))].sort());
    for (const row of rows) {
      const members = published.models.filter(model => model.provider === row.lab);
      assert.equal(row.models.length, members.length);
      front.groups.forEach((group, by) => {
        const average = sum(members.map(model => sum(group.ids.map(id => Number(model.probabilities[id]))))) / members.length;
        assert.ok(Math.abs(row.mean[by] - average) < 1e-9);
        assert.ok(Math.abs(row.values[by] - average) < 1, `${h} ${row.lab} ${group.key}`);
      });
      assert.equal(sum(row.values), 100);
    }
    front.groups.forEach((group, by) => {
      const ranked = [...rows].sort((a, b) => b.mean[by] - a.mean[by]);
      const said = text(copy.labsTakeaway(h, by));
      if (ranked[0].values[by] !== ranked.at(-1).values[by]) {
        assert.ok(said.includes(`${ranked[0].lab}’s models put the most`), `${h} ${group.key}: ${said}`);
        assert.ok(said.includes(`${ranked.at(-1).lab}’s put the least`), `${h} ${group.key}: ${said}`);
      }
    });
  }
});

test('near-identical models from one lab are found by the stated rule', () => {
  const expected = [];
  for (let i = 0; i < front.models.length; i += 1) {
    for (let j = i + 1; j < front.models.length; j += 1) {
      const a = front.models[i], b = front.models[j];
      if (a.lab !== b.lab) continue;
      const shared = front.horizons.filter(h => a.h[h] && b.h[h]);
      if (shared.length < 2) continue;
      const gap = sum(shared.map(h => apart(a.h[h].p, b.h[h].p))) / shared.length;
      if (gap < 2) expected.push(`${a.id}|${b.id}`);
    }
  }
  assert.deepEqual(front.twins.map(twin => `${twin.a}|${twin.b}`), expected);
});

// ---------- Asked twice ----------

test('the asked-twice figures can be rebuilt from the raw batches', () => {
  // The build reads data/samples.csv. This reads runs/ instead and summarises
  // each batch the way the importer does, from the batch's own aggregate.
  const quartile = (sorted, f) => {
    const i = (sorted.length - 1) * f, lo = Math.floor(i), hi = Math.ceil(i);
    return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo));
  };
  const states = IDS.map(id => `S${id}`);
  const runs = readdirSync(join(root, 'runs')).filter(file => file.endsWith('.json')).map(file => {
    const batch = JSON.parse(read(join('runs', file)));
    return { file, batch, h: horizonOfBatch(batch), id: batch.model?.api_string, questionSet: batch.question_set, date: batch.asked_on, n: (batch.samples || []).length };
  });
  const summarise = ({ batch }) => renormalizeAllocation(
    states.map(id => batch.aggregate[id].median),
    states.map(id => [batch.aggregate[id].min, batch.aggregate[id].max]),
    states.map(id => {
      const values = batch.samples.map(sample => sample.answers?.[id]?.value).filter(Number.isFinite).sort((a, b) => a - b);
      return values.length ? [quartile(values, 0.25), quartile(values, 0.75)] : null;
    })
  );
  const gone = front.groups.find(group => group.key === 'gone').ids;
  const goneOf = p => sum(gone.map(id => p[id - 1]));
  const expected = [];
  const moved = [];
  const days = [];
  front.horizons.forEach((h, hi) => {
    for (const model of exported.datasets[h].models) {
      const earlier = runs
        .filter(run => run.h === h && run.id === model.api_model_id && run.questionSet === model.question_set && run.date < model.asked_on && run.n >= 20)
        .sort((a, b) => a.date.localeCompare(b.date) || b.n - a.n || a.file.localeCompare(b.file));
      if (!earlier.length) continue;
      const first = summarise(earlier[0]);
      expected.push([front.models.findIndex(entry => entry.id === model.api_model_id), hi, goneOf(first), goneOf(vector(model))]);
      moved.push(apart(first, vector(model)));
      days.push((Date.parse(`${model.asked_on}T00:00:00Z`) - Date.parse(`${earlier[0].date}T00:00:00Z`)) / 864e5);
    }
  });
  assert.ok(expected.length > 0, 'there are answers that were asked for twice');
  assert.deepEqual(front.reask.pairs, expected);
  moved.sort((a, b) => a - b);
  const middle = moved.length % 2 ? moved[(moved.length - 1) / 2] : (moved[moved.length / 2 - 1] + moved[moved.length / 2]) / 2;
  assert.equal(front.reask.moved, Math.round(middle * 10) / 10);
  assert.deepEqual(front.reask.days, [Math.min(...days), Math.max(...days)]);

  const between = [];
  for (const h of front.horizons) {
    const list = exported.datasets[h].models.map(vector);
    for (let i = 0; i < list.length; i += 1) for (let j = i + 1; j < list.length; j += 1) between.push(apart(list[i], list[j]));
  }
  assert.equal(front.reask.between, Math.round(sum(between) / between.length * 10) / 10);
  const said = text(copy.steadyTakeaway());
  assert.ok(said.includes(`${expected.length} answers were asked for twice`), said);
  assert.ok(said.includes(front.reask.moved.toFixed(1)) && said.includes(front.reask.between.toFixed(1)), said);
});

// ---------- Safety ----------

test('model-authored text only reaches the page through the escaper', () => {
  const script = read('public/front.js');
  for (const field of ['voice.text', 'reason.text', 'quote.text']) {
    const uses = script.split(field).length - 1;
    const escaped = script.split(`esc(${field})`).length - 1;
    assert.ok(uses > 0 && uses === escaped, `${field} is always escaped`);
  }
});
