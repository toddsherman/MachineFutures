// Every sentence on the front page that carries a number is written here,
// from the data. The page, the headline that tools/build-front.mjs writes
// into index.html, the share image and tools/test-front.mjs all call these
// same functions, so the words cannot drift from the figures or each other.
//
// Loaded by the page before front.js, and by the tools under Node, where the
// caller supplies `window`.
(function () {
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  // Model names and rationales are not ours, so everything that reaches
  // innerHTML is escaped.
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ESC[c]);
  const sum = values => values.reduce((total, value) => total + value, 0);
  const yearOf = h => (h === 'long-term' ? '3000' : h);
  const forYear = h => (h === 'long-term' ? 'the year 3000' : h);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Whole numbers that still add to exactly the target (largest remainder).
  function toHundred(values, target = 100) {
    const total = sum(values);
    if (!total) return values.map(() => 0);
    const scaled = values.map(v => v / total * target);
    const out = scaled.map(Math.floor);
    const order = scaled.map((v, i) => [v - out[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    for (let k = 0, short = target - sum(out); k < short; k += 1) out[order[k % order.length][1]] += 1;
    return out;
  }
  // Points that would have to move to turn one split into the other.
  const distance = (a, b) => sum(a.map((v, i) => Math.abs(v - b[i]))) / 2;

  window.FRONT_COPY = function (D) {
    const H = D.horizons;
    const G = D.groups;
    const groupIndex = key => G.findIndex(g => g.key === key);
    const groupVals = p => G.map(g => sum(g.ids.map(id => p[id - 1])));
    const allLabs = h => toHundred(groupVals(D.aggregates[h].p));
    const modelsFor = h => D.models.filter(m => m.h[h]);
    const modelVals = (model, h) => toHundred(groupVals(model.h[h].p));

    // ---------- Headline ----------
    function leaders(h) {
      const values = allLabs(h);
      const ranked = values.map((v, i) => i).sort((a, b) => values[b] - values[a]);
      return { values, top: ranked[0], second: ranked[1] };
    }
    // [before, emphasised, after], so the same words serve HTML and plain text.
    function headlineParts(h) {
      const { values, top } = leaders(h);
      return values[top] >= 50
        ? [`For ${forYear(h)}, AI models put most of their points on `, `${G[top].lead}.`, '']
        : [`For ${forYear(h)}, AI models put more points on `, G[top].lead, ' than on any other outcome.'];
    }
    const headline = h => { const [before, em, after] = headlineParts(h); return `${esc(before)}<em>${esc(em)}</em>${esc(after)}`; };
    const headlineText = h => headlineParts(h).join('');
    const kicker = h => `We asked ${D.aggregates[h].models} AI models from ${D.aggregates[h].labs} labs how things turn out between humans and AI`;
    function dek(h) {
      const { values, top, second } = leaders(h);
      return `Counting each lab once, that is <b>${values[top]} of 100 points</b>. The runner-up is ${esc(G[second].lead)}, with <b>${values[second]}</b>.`;
    }
    const yearNote = h => (h === 'long-term'
      ? 'The lasting arrangement by the year 3000.'
      : `A snapshot of how things stand at the end of ${h}. It does not have to last.`);
    // One plain sentence for search results and link previews.
    function metaDescription(h = D.defaultHorizon) {
      const { values, top } = leaders(h);
      const who = `${D.aggregates[h].models} AI models from ${D.aggregates[h].labs} labs`;
      const lead = values[top] >= 50
        ? `For ${forYear(h)}, ${who} put ${values[top]} of 100 points on ${G[top].lead}.`
        : `For ${forYear(h)}, ${who} put more points on ${G[top].lead} than on any other outcome: ${values[top]} of 100.`;
      return `${lead} See all ${H.length} years we asked about, and what your AI said.`;
    }

    // ---------- Over time ----------
    function timeTakeaway() {
      const ci = groupIndex('control'), gi = groupIndex('gone');
      const control = H.map(h => groupVals(D.aggregates[h].p)[ci]);
      const gone = H.map(h => groupVals(D.aggregates[h].p)[gi]);
      const cross = control.findIndex((v, i) => gone[i] > v);
      const whole = H.map(h => allLabs(h));
      const last = H.length - 1;
      return cross > 0
        ? `Humans staying in control gets more points than humanity being gone or at risk in every year through <b>${yearOf(H[cross - 1])}</b>. From <b>${yearOf(H[cross])}</b> on it is the other way round: ${whole[cross][gi]} against ${whole[cross][ci]}. For ${forYear(H[last])} it is ${whole[last][gi]} against ${whole[last][ci]}.`
        : `Humans staying in control goes from ${whole[0][ci]} points for ${forYear(H[0])} to ${whole[last][ci]} for ${forYear(H[last])}.`;
    }

    // ---------- In their own words ----------
    function wordsTakeaway(h) {
      const { hi, lo } = D.quotes[h];
      return `Every model has to explain each number. On humans staying in control for ${esc(forYear(h))}, the answers run from <b>${lo.value}</b> to <b>${hi.value}</b> of 100. These are the two ends.`;
    }

    // ---------- Your AI ----------
    function cardSay(model, h) {
      const mine = modelVals(model, h);
      const everyone = allLabs(h);
      const top = mine.indexOf(Math.max(...mine));
      return `For ${esc(forYear(h))}, ${esc(model.name)} puts <b>${mine[top]} of 100 points</b> on ${esc(G[top].lead)}. All labs together put <b>${everyone[top]}</b> there.`;
    }

    // ---------- Every AI, side by side ----------
    function ranking(h, by) {
      return modelsFor(h)
        .map(model => ({ model, values: modelVals(model, h) }))
        .sort((a, b) => b.values[by] - a.values[by] || a.model.name.localeCompare(b.model.name));
    }
    function allTakeaway(h, by) {
      const rows = ranking(h, by);
      const high = rows[0], low = rows.at(-1);
      return `For ${esc(forYear(h))}, points on ${esc(G[by].lead)} run from <b>${low.values[by]}</b> (${esc(low.model.name)}) to <b>${high.values[by]}</b> (${esc(high.model.name)}). All labs together: <b>${allLabs(h)[by]}</b>. Select a model to open its answer.`;
    }

    // ---------- Lab by lab ----------
    // A lab's figure is the average of its models, the same first step the
    // all-labs figure takes before weighting every lab equally.
    function labRows(h) {
      return D.labs.map(lab => {
        const models = modelsFor(h).filter(model => model.lab === lab);
        if (!models.length) return null;
        const mean = G.map((_, gi) => sum(models.map(model => groupVals(model.h[h].p)[gi])) / models.length);
        return { lab, mean, values: toHundred(mean), models: models.map(model => ({ model, values: modelVals(model, h) })) };
      }).filter(Boolean);
    }
    function labsTakeaway(h, by) {
      const rows = labRows(h);
      const ranked = [...rows].sort((a, b) => b.mean[by] - a.mean[by]);
      const high = ranked[0], low = ranked.at(-1);
      const everyone = allLabs(h)[by];
      if (high.values[by] === low.values[by]) {
        return `For ${esc(forYear(h))}, every lab’s models average <b>${high.values[by]}</b> of 100 points on ${esc(G[by].lead)}.`;
      }
      return `For ${esc(forYear(h))}, ${esc(high.lab)}’s models put the most on ${esc(G[by].lead)}, an average of <b>${high.values[by]}</b> of 100 points. ${esc(low.lab)}’s put the least, <b>${low.values[by]}</b>. All labs together: <b>${everyone}</b>.`;
    }
    function labsNote(h) {
      const rows = labRows(h);
      const counts = rows.map(row => row.models.length);
      const few = Math.min(...counts), many = Math.max(...counts);
      const span = few === many ? `Every lab has ${few} models here` : `Labs have from ${few} to ${many} models here`;
      const here = new Set(modelsFor(h).map(model => model.id));
      const twins = (D.twins || []).filter(twin => here.has(twin.a) && here.has(twin.b)).map(twin => {
        const name = id => D.models.find(model => model.id === id).name;
        return ` ${name(twin.a)} and ${name(twin.b)} gave almost the same answers (${twin.apart.toFixed(1)} points apart on average), so ${twin.lab}’s average leans on one view.`;
      });
      return `Each dot is one model and the bar is its lab’s average. ${span}, so a small gap between two lab averages means little.${twins.join('')}`;
    }

    // ---------- Eleven futures, try it ----------
    const tryTakeaway = h => `This is the same job the models were given, in five groups instead of eleven. Move any slider for ${forYear(h)}; the others adjust so you always total 100.`;
    const futuresTakeaway = h => `The five groups are made of these eleven. Figures are the share of 100 points for ${forYear(h)}, counting each lab once.`;

    // ---------- Asked twice ----------
    function steadyTakeaway() {
      const R = D.reask;
      return `Before we switched to asking each model once, ${R.pairs.length} answers were asked for twice, ${R.days[0]} to ${R.days[1]} days apart. To turn the first answer into the second, a model would have to move a median of <b>${R.moved.toFixed(1)}</b> of its 100 points. To turn one model’s answer into another’s takes <b>${R.between.toFixed(1)}</b> on average.`;
    }
    function steadyCaption() {
      const gone = G[groupIndex('gone')];
      return `Each dot is one model for one year: its points on “${gone.label}” the first time it was asked, against the answer published here. Dots on the line did not move. The question was word for word the same both times.`;
    }

    // Only claim what the two figures support.
    function steadySay() {
      const R = D.reask;
      const verdict = R.between >= R.moved * 2
        ? 'Asked again, it says nearly the same thing, and the gap between two models is far wider than the wobble within one.'
        : 'Asked again, it says something close to the same thing.';
      return `A steady answer is not a correct one. What this shows is that a model\u2019s numbers are not a roll of the dice. ${verdict}`;
    }

    // ---------- Footer ----------
    function footerNote() {
      const pretty = D.datasetDate.match(/^(\d\d)\.(\d\d)\.(\d\d)$/);
      const date = pretty ? `${Number(pretty[2])} ${MONTHS[Number(pretty[1]) - 1]} 20${pretty[3]}` : D.datasetDate;
      return `${date} dataset · ${D.models.length} models across ${D.labs.length} labs`;
    }

    return {
      esc, sum, yearOf, forYear, toHundred, distance,
      groupIndex, groupVals, allLabs, modelsFor, modelVals, leaders, ranking, labRows,
      kicker, headline, headlineText, dek, yearNote, metaDescription,
      timeTakeaway, wordsTakeaway, cardSay, allTakeaway, labsTakeaway, labsNote,
      tryTakeaway, futuresTakeaway, steadyTakeaway, steadyCaption, steadySay, footerNote
    };
  };
})();
