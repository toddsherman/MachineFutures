#!/usr/bin/env node
// Builds the front page from the published exports.
//
// Reads data/forecasts.json (numbers and reasons), data/samples.csv (the raw
// samples, for the asked-twice comparison), public/data.js (the eleven
// futures' colours and extinction tiers) and tools/front-quotes.json (the
// owner-approved quote pairs). Writes:
//
//   public/front-data.js  the figures the page needs to draw itself
//   public/front-why.js   each model's reason for its top future, loaded only
//                         when a reader opens a model's answer
//   public/index.html     the default year's headline, the no-JavaScript
//                         fallback and the link-preview tags, between the
//                         BUILD markers, so the answer is in the page before
//                         any script runs
//
// Every sentence with a number comes from public/front-copy.js, the same file
// the page loads, so the pre-rendered words and the live ones cannot differ.
//
// Run after tools/export-data.mjs; `npm run data:rebuild` does all three in
// order. CI fails if the committed outputs differ from what this produces.
// The link-preview picture is the one output this cannot make: when the build
// says it is out of date, run `npm run share:render`.
//
// Usage: node tools/build-front.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { renormalizeAllocation } from './allocations.mjs';
import { shareCard } from './share-card.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const SITE = 'https://www.machinefutures.ai';
const source = JSON.parse(await read('data/forecasts.json'));
// The site's own colours for the eleven futures, read from the published file
// so the front page cannot drift from them.
const site = {};
new Function('window', await read('public/data.js'))(site);
const stateColor = Object.fromEntries(site.MF_DATA.states.map(state => [state.id, state.color]));
const stateTier = Object.fromEntries(site.MF_DATA.states.map(state => [state.id, state.extinction || null]));
const HORIZONS = ['2030', '2035', '2040', '2050', '2060', '2070', '2080', '2090', '2100', '2200', 'long-term'];
const IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const r1 = x => Math.round(x * 10) / 10;
const sum = xs => xs.reduce((s, x) => s + x, 0);
const mean = xs => sum(xs) / xs.length;
// Points that would have to move to turn one allocation into the other.
const apart = (a, b) => sum(a.map((v, i) => Math.abs(v - b[i]))) / 2;

// Five plain-language groups for the first read. The grouping is editorial:
// futures 1 to 5 follow the site's existing extinction tiers ("gone" and
// "might perish"); the rest are grouped by who ends up steering.
const GROUPS = [
  { key: 'control', ids: [9], label: 'Humans stay in control', short: 'In control', lead: 'humans staying in control', colorOf: 9 },
  { key: 'shared', ids: [8, 6], label: 'Humans and AI share power or merge', short: 'Shared or merged', lead: 'humans and AI sharing power or merging', colorOf: 8 },
  { key: 'aicharge', ids: [7], label: 'AI is in charge and humans survive', short: 'AI in charge', lead: 'AI being in charge while humans survive', colorOf: 7 },
  { key: 'frozen', ids: [10, 11], label: 'Change is frozen or AI is given up', short: 'Frozen or given up', lead: 'a frozen world or one that gives AI up', colorOf: 10 },
  { key: 'gone', ids: [1, 2, 3, 4, 5], label: 'Humanity is gone or might perish', short: 'Gone or at risk', lead: 'humanity being gone or at risk of it', colorOf: 1 },
];
const GONE = GROUPS.find(g => g.key === 'gone').ids;

// Display labels only. The prompts and their coined names are unchanged.
const PLAIN = {
  1: 'Humans and AI are both gone',
  2: 'Humanity is gone and AI carries our values on',
  3: 'Humanity is gone and AI pursues its own goals',
  4: 'Many AIs compete and humans are sidelined or gone',
  5: 'Different places end up with different outcomes',
  6: 'Humans and AI become one',
  7: 'AI runs things and humans survive without steering',
  8: 'Humans and AI share power and stay distinct',
  9: 'Humans stay in control of AI',
  10: 'Change is held in place for good',
  11: 'Powerful AI is deliberately given up',
};

const describe = h => Object.fromEntries(source.endings_by_horizon[h].map(e => [e.id, e.description]));
const futures = source.endings.map(e => ({
  id: e.id,
  name: e.name,
  plain: PLAIN[e.id],
  group: GROUPS.find(g => g.ids.includes(e.id)).key,
  color: stateColor[e.id],
  tier: stateTier[e.id],
  dated: describe('2030')[e.id],
  longTerm: describe('long-term')[e.id],
}));

const aggregates = {};
const quotes = {};
const models = new Map();
const why = {};
for (const h of HORIZONS) {
  const ds = source.datasets[h];
  aggregates[h] = {
    p: IDS.map(id => r1(Number(ds.aggregate.unrounded_lab_balanced_probabilities[id]))),
    models: ds.aggregate.model_count,
    labs: ds.aggregate.lab_count,
  };
  for (const m of ds.models) {
    const entry = models.get(m.api_model_id) ?? { id: m.api_model_id, name: m.model, lab: m.provider, asked: m.asked_on, h: {} };
    const p = IDS.map(id => Number(m.probabilities[id]));
    const top = IDS[p.indexOf(Math.max(...p))];
    entry.h[h] = { p, top };
    (why[m.api_model_id] ??= {})[h] = m.rationales[top];
    models.set(m.api_model_id, entry);
  }
  // The two ends of the range on human control, each in the model's own words.
  const byControl = [...ds.models].sort((a, b) => b.probabilities[9] - a.probabilities[9]);
  const voice = m => ({ model: m.model, lab: m.provider, value: Number(m.probabilities[9]), text: m.rationales[9] });
  quotes[h] = { hi: voice(byControl[0]), lo: voice(byControl.at(-1)) };
}
const all = [...models.values()];

// ---------- Why they disagree: the owner-approved quote pairs ----------
// A quote may be cut to whole sentences but never reworded, so each one has to
// appear word for word in the reasoning that model published.
const approved = JSON.parse(await read('tools/front-quotes.json'));
const cruxes = approved.pairs.map(pair => {
  const ds = source.datasets[pair.horizon];
  if (!ds) throw new Error(`front-quotes.json: "${pair.question}" names an unknown year ${pair.horizon}`);
  if (!IDS.includes(pair.future)) throw new Error(`front-quotes.json: "${pair.question}" names an unknown future ${pair.future}`);
  if (pair.quotes?.length !== 2) throw new Error(`front-quotes.json: "${pair.question}" needs exactly two quotes`);
  const given = ds.models.map(m => Number(m.probabilities[pair.future]));
  return {
    question: pair.question,
    horizon: pair.horizon,
    future: pair.future,
    low: Math.min(...given),
    high: Math.max(...given),
    count: given.length,
    quotes: pair.quotes.map(quote => {
      const m = ds.models.find(candidate => candidate.api_model_id === quote.model);
      if (!m) throw new Error(`front-quotes.json: "${pair.question}" quotes ${quote.model}, which has no published answer for ${pair.horizon}`);
      if (!quote.text?.trim() || !m.rationales[pair.future].includes(quote.text)) {
        throw new Error(`front-quotes.json: "${pair.question}": the quote from ${quote.model} is not word for word in its published reasoning for future ${pair.future}, ${pair.horizon}`);
      }
      return { id: m.api_model_id, model: m.model, lab: m.provider, value: Number(m.probabilities[pair.future]), text: quote.text };
    }),
  };
});

// ---------- Asked twice ----------
// Until 14 October 2026 the whole roster was asked again on a schedule, so most
// models have an earlier batch for the same year under the same prompt. Each
// published answer is paired with the earliest such batch of at least 20
// samples, summarised exactly as the importer summarises a batch: the median
// for each future, renormalized to whole numbers that sum to 100.
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.map(r => Object.fromEntries(head.map((name, i) => [name, r[i]])));
}
// One entry per raw batch, keyed by its run id, so two batches that happen to
// share a date are never mixed together.
const batches = new Map();
for (const row of parseCsv(await read('data/samples.csv'))) {
  if (!batches.has(row.run_id)) {
    batches.set(row.run_id, { run: row.run_id, h: row.horizon, id: row.api_model_id, questionSet: row.question_set, date: row.asked_on, samples: new Map() });
  }
  const { samples } = batches.get(row.run_id);
  if (!samples.has(row.sample)) samples.set(row.sample, {});
  samples.get(row.sample)[row.ending_id] = Number(row.probability_pct);
}
const batchesFor = (h, id, questionSet) => [...batches.values()].filter(b => b.h === h && b.id === id && b.questionSet === questionSet);
const median = sorted => {
  const n = sorted.length;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
};
const quartile = (sorted, f) => {
  const i = (sorted.length - 1) * f, lo = Math.floor(i), hi = Math.ceil(i);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo));
};
function publishedVector(batch) {
  const cols = IDS.map(id => [...batch.samples.values()].map(sample => sample[id]).filter(Number.isFinite).sort((a, b) => a - b));
  return renormalizeAllocation(
    cols.map(median),
    cols.map(col => [col[0], col.at(-1)]),
    cols.map(col => [quartile(col, 0.25), quartile(col, 0.75)])
  );
}
const MIN_SAMPLES = 20;
const dayOf = date => Date.parse(`${date}T00:00:00Z`) / 864e5;
const pairs = [];
const movedBy = [];
const gaps = [];
for (const [hi, h] of HORIZONS.entries()) {
  for (const m of source.datasets[h].models) {
    const now = IDS.map(id => Number(m.probabilities[id]));
    const mine = batchesFor(h, m.api_model_id, m.question_set);
    // The summary above has to be the importer's, or the comparison would be
    // between two different estimators. Hold it to every published figure.
    if (!mine.some(b => b.date === m.asked_on && apart(publishedVector(b), now) === 0)) {
      throw new Error(`${m.api_model_id} ${h}: the samples in data/samples.csv do not reproduce the published figures`);
    }
    // The earliest earlier batch; on a shared date, the fuller one.
    const earlier = mine
      .filter(b => b.date < m.asked_on && b.samples.size >= MIN_SAMPLES)
      .sort((a, b) => a.date.localeCompare(b.date) || b.samples.size - a.samples.size || a.run.localeCompare(b.run));
    if (!earlier.length) continue;
    const first = publishedVector(earlier[0]);
    const goneOf = p => sum(GONE.map(id => p[id - 1]));
    pairs.push([all.findIndex(entry => entry.id === m.api_model_id), hi, goneOf(first), goneOf(now)]);
    movedBy.push(apart(first, now));
    gaps.push(dayOf(m.asked_on) - dayOf(earlier[0].date));
  }
}
if (!pairs.length) throw new Error('no model has an earlier batch to compare against; the asked-twice section would be empty');
const between = [];
for (const h of HORIZONS) {
  const list = source.datasets[h].models.map(m => IDS.map(id => Number(m.probabilities[id])));
  for (let i = 0; i < list.length; i += 1) for (let j = i + 1; j < list.length; j += 1) between.push(apart(list[i], list[j]));
}
const reask = {
  pairs,
  moved: r1(median([...movedBy].sort((a, b) => a - b))),
  between: r1(mean(between)),
  days: [Math.min(...gaps), Math.max(...gaps)],
};

// Two models from one lab whose answers barely differ: a lab average that
// counts both leans on what is close to a single view, and the page says so.
const TWIN_LIMIT = 2;
const twins = [];
for (let i = 0; i < all.length; i += 1) {
  for (let j = i + 1; j < all.length; j += 1) {
    if (all[i].lab !== all[j].lab) continue;
    const shared = HORIZONS.filter(h => all[i].h[h] && all[j].h[h]);
    if (shared.length < 2) continue;
    const gap = mean(shared.map(h => apart(all[i].h[h].p, all[j].h[h].p)));
    if (gap < TWIN_LIMIT) twins.push({ a: all[i].id, b: all[j].id, lab: all[i].lab, apart: r1(gap) });
  }
}

const out = {
  horizons: HORIZONS,
  defaultHorizon: source.default_horizon,
  datasetDate: source.datasets[source.default_horizon].dataset_date,
  groups: GROUPS.map(({ colorOf, ...group }) => ({ ...group, color: stateColor[colorOf] })),
  futures,
  aggregates,
  quotes,
  cruxes,
  reask,
  twins,
  models: all,
  labs: [...new Set(all.map(m => m.lab))],
};
await writeFile(new URL('public/front-data.js', root), `window.FRONT = ${JSON.stringify(out)};\n`);
await writeFile(new URL('public/front-why.js', root), `window.FRONT_WHY = ${JSON.stringify(why)};\n`);

// Write the default year's headline into the page itself, so a reader without
// JavaScript, a crawler or a link preview still gets the answer. The script
// replaces it on load with the same words. A replacer function is used so that
// "$" in any text is never read as a replacement pattern.
const scope = {};
new Function('window', await read('public/front-copy.js'))(scope);
const copy = scope.FRONT_COPY(out);
const attr = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const h0 = out.defaultHorizon;
const values = copy.allLabs(h0);
const card = shareCard(out, copy);
const image = `${SITE}/share.png?v=${card.hash.slice(0, 8)}`;
const blocks = {
  meta: `
  <meta name="description" content="${attr(copy.metaDescription())}">
  <meta property="og:description" content="${attr(copy.metaDescription())}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:alt" content="${attr(card.alt)}">
  <meta name="twitter:image" content="${image}">
  `,
  hero: `
      <p class="kicker" id="kicker">${attr(copy.kicker(h0))}</p>
      <h1 id="headline">${copy.headline(h0)}</h1>
      <p class="dek" id="dek">${copy.dek(h0)}</p>
      `,
  noscript: `
        <ul class="plain-list">${out.groups.map((g, i) => `<li><b>${values[i]}</b> ${attr(g.label)}</li>`).join('')}</ul>
        <p class="caption">For ${h0}, of 100 points. The charts and the other years need JavaScript. Every number is also in the <a href="explore.html">full explorer</a>.</p>
        `,
};
const pageUrl = new URL('public/index.html', root);
let page = await readFile(pageUrl, 'utf8');
for (const [name, markup] of Object.entries(blocks)) {
  const block = new RegExp(`(<!-- BUILD:${name} -->)[\\s\\S]*?(<!-- /BUILD:${name} -->)`);
  if (!block.test(page)) throw new Error(`BUILD:${name} markers not found in public/index.html`);
  page = page.replace(block, (_, open, close) => open + markup + close);
}
await writeFile(pageUrl, page);
console.log(`✓ front page built: ${all.length} models, ${out.labs.length} labs, ${HORIZONS.length} years, ${pairs.length} answers asked twice, ${cruxes.length} quote pairs`);

// The picture cannot be drawn here (it needs a browser), so say when it is
// stale. tools/test-front.mjs makes the same comparison and fails the checks.
const { shareStamp } = await import('./render-share.mjs');
const stamp = await shareStamp();
if (stamp !== card.hash) {
  console.log('! public/share.png does not show these figures. Run `npm run share:render` and commit the picture.');
}
