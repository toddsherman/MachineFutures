#!/usr/bin/env node
// Builds the front page's data from the published exports.
//
// Reads data/forecasts.json (numbers and reasons) and public/data.js (the
// eleven futures' colours and extinction tiers). Writes public/front-data.js,
// and the default year's headline into public/index.html between the BUILD
// markers so the answer is in the page before any script runs.
//
// Run after tools/export-data.mjs; `npm run data:rebuild` does all three in
// order. CI fails if the committed outputs differ from what this produces.
//
// Usage: node tools/build-front.mjs
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const source = JSON.parse(await readFile(new URL('data/forecasts.json', root), 'utf8'));
// The site's own colours for the eleven futures, read from the published file
// so the front page cannot drift from them.
const site = {};
new Function('window', await readFile(new URL('public/data.js', root), 'utf8'))(site);
const stateColor = Object.fromEntries(site.MF_DATA.states.map(state => [state.id, state.color]));
const stateTier = Object.fromEntries(site.MF_DATA.states.map(state => [state.id, state.extinction || null]));
const HORIZONS = ['2030', '2035', '2040', '2050', '2060', '2070', '2080', '2090', '2100', '2200', 'long-term'];
const IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const r1 = x => Math.round(x * 10) / 10;

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
    entry.h[h] = { p, top, why: m.rationales[top] };
    models.set(m.api_model_id, entry);
  }
  // The two ends of the range on human control, each in the model's own words.
  const byControl = [...ds.models].sort((a, b) => b.probabilities[9] - a.probabilities[9]);
  const voice = m => ({ model: m.model, lab: m.provider, value: Number(m.probabilities[9]), text: m.rationales[9] });
  quotes[h] = { hi: voice(byControl[0]), lo: voice(byControl.at(-1)) };
}

const all = [...models.values()];
const out = {
  horizons: HORIZONS,
  defaultHorizon: source.default_horizon,
  datasetDate: source.datasets[source.default_horizon].dataset_date,
  groups: GROUPS.map(({ colorOf, ...group }) => ({ ...group, color: stateColor[colorOf] })),
  futures,
  aggregates,
  quotes,
  models: all,
  labs: [...new Set(all.map(m => m.lab))],
};
await writeFile(new URL('public/front-data.js', root), `window.FRONT = ${JSON.stringify(out)};\n`);
// Write the default year's headline into the page itself, so a reader without
// JavaScript, a crawler or a link preview still gets the answer. The script
// replaces it on load. A replacer function is used so that "$" in any text is
// never read as a replacement pattern.
const sum = xs => xs.reduce((s, x) => s + x, 0);
function toHundred(values) {
  const total = sum(values);
  const scaled = values.map(v => v / total * 100);
  const whole = scaled.map(Math.floor);
  const order = scaled.map((v, i) => [v - whole[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0, short = 100 - sum(whole); k < short; k += 1) whole[order[k][1]] += 1;
  return whole;
}
const esc = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const h0 = out.defaultHorizon;
const values = toHundred(out.groups.map(g => sum(g.ids.map(id => aggregates[h0].p[id - 1]))));
const ranked = values.map((v, i) => i).sort((a, b) => values[b] - values[a]);
const [top, second] = ranked;
const hero = `
      <p class="kicker" id="kicker">We asked ${aggregates[h0].models} AI models from ${aggregates[h0].labs} labs how things turn out between humans and AI</p>
      <h1 id="headline">${values[top] >= 50
    ? `For ${h0}, AI models put most of their points on <em>${esc(out.groups[top].lead)}.</em>`
    : `For ${h0}, AI models put more points on <em>${esc(out.groups[top].lead)}</em> than on any other outcome.`}</h1>
      <p class="dek" id="dek">Counting each lab once, that is <b>${values[top]} of 100 points</b>. The runner-up is ${esc(out.groups[second].lead)}, with <b>${values[second]}</b>.</p>
      `;
const noscript = `
        <ul class="plain-list">${out.groups.map((g, i) => `<li><b>${values[i]}</b> ${esc(g.label)}</li>`).join('')}</ul>
        <p class="caption">For ${h0}, of 100 points. The charts and the other years need JavaScript. Every number is also in the <a href="explore.html">full explorer</a>.</p>
        `;
const pageUrl = new URL('public/index.html', root);
let page = await readFile(pageUrl, 'utf8');
for (const [name, markup] of [['hero', hero], ['noscript', noscript]]) {
  const block = new RegExp(`(<!-- BUILD:${name} -->)[\\s\\S]*?(<!-- /BUILD:${name} -->)`);
  if (!block.test(page)) throw new Error(`BUILD:${name} markers not found in public/index.html`);
  page = page.replace(block, (_, open, close) => open + markup + close);
}
await writeFile(pageUrl, page);
console.log(`✓ front page built: ${all.length} models, ${out.labs.length} labs, ${HORIZONS.length} years`);
