(function () {
  const D = window.FRONT;
  const H = D.horizons;
  const G = D.groups;
  const $ = selector => document.querySelector(selector);
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  // Rationales are model-authored, so everything that reaches innerHTML is escaped.
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ESC[c]);
  const sum = values => values.reduce((total, value) => total + value, 0);
  const yearOf = h => (h === 'long-term' ? '3000' : h);
  const forYear = h => (h === 'long-term' ? 'the year 3000' : h);
  const PRODUCT = { Anthropic: 'Claude', OpenAI: 'ChatGPT', Google: 'Gemini', xAI: 'Grok', Meta: 'Meta AI', DeepSeek: 'DeepSeek', Mistral: 'Le Chat', Moonshot: 'Kimi' };
  const SVG = 'http://www.w3.org/2000/svg';

  const groupVals = p => G.map(g => sum(g.ids.map(id => p[id - 1])));
  // Whole numbers that still add to exactly 100 (largest remainder).
  function toHundred(values, target = 100) {
    const total = sum(values);
    if (!total) return values.map(() => 0);
    const scaled = values.map(v => v / total * target);
    const out = scaled.map(Math.floor);
    const order = scaled.map((v, i) => [v - out[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    for (let k = 0, short = target - sum(out); k < short; k += 1) out[order[k % order.length][1]] += 1;
    return out;
  }
  const distance = (a, b) => sum(a.map((v, i) => Math.abs(v - b[i]))) / 2;
  const allLabs = h => toHundred(groupVals(D.aggregates[h].p));
  const modelsFor = h => D.models.filter(m => m.h[h]);

  const state = { year: D.defaultHorizon, lab: '', model: '', mine: [20, 20, 20, 20, 20], sort: 0, showAll: false };
  const RANKS_SHOWN = 10;
  const explorerUrl = (h, modelId) => {
    const params = new URLSearchParams();
    if (h !== D.defaultHorizon) params.set('horizon', h);
    if (modelId) params.set('model', modelId);
    const query = params.toString();
    return `explore.html${query ? `?${query}` : ''}`;
  };

  function readUrl() {
    const params = new URLSearchParams(location.search);
    // Links shared before this page existed used the explorer's ?horizon=.
    const year = params.get('year') || params.get('horizon');
    const horizon = year === '3000' ? 'long-term' : year;
    if (H.includes(horizon)) state.year = horizon;
    const model = D.models.find(m => m.id === params.get('model'));
    if (model) { state.model = model.id; state.lab = model.lab; }
  }
  function writeUrl() {
    const url = new URL(location.href);
    if (state.year === D.defaultHorizon) url.searchParams.delete('year');
    else url.searchParams.set('year', yearOf(state.year));
    url.searchParams.delete('horizon');
    url.searchParams.delete('lab');
    if (state.model) url.searchParams.set('model', state.model);
    else url.searchParams.delete('model');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    // A shared link should say what it shows.
    const model = D.models.find(m => m.id === state.model);
    document.title = model
      ? `${model.name} on ${forYear(state.year)} · Machine Futures`
      : `${yearOf(state.year)}: what AI models say about the future of AI · Machine Futures`;
  }

  // A segment shows its number only when there is room for it.
  const barMarkup = values => G.map((g, i) =>
    `<i style="--c:${g.color};width:${values[i]}%">${values[i] >= 5 ? `<span>${values[i]}</span>` : ''}</i>`).join('');
  const barLabel = values => G.map((g, i) => `${g.label} ${values[i]}`).join(', ');
  const slimBar = values => `<div class="stacked-bar slim" role="img" aria-label="${esc(barLabel(values))}">${barMarkup(values)}</div>`;

  // The site's two extinction marks: a skull for "gone", a warning for "might perish".
  const MARK = {
    gone: '<span class="state-mark" role="img" aria-label="Humanity is gone" title="Humanity is gone">☠︎</span>',
    risk: '<span class="state-mark" role="img" aria-label="Humanity might perish" title="Humanity might perish"><svg viewBox="0 0 22 22" aria-hidden="true"><path d="M11 3.2 20.1 18.5H1.9Z"/><path d="M11 9.1v3.9M11 15.8h.01"/></svg></span>'
  };

  // ---------- Hero and answer ----------
  function buildHero() {
    $('#year-select').innerHTML = H.map(h => `<option value="${h}">${yearOf(h)}</option>`).join('');
    $('#year-toggle').innerHTML = H.map(h =>
      `<button type="button" class="horizon-button" data-year="${h}" aria-pressed="false"><span>${yearOf(h)}</span></button>`).join('');
    $('#hero-bar').innerHTML = barMarkup(G.map(() => 20));
    $('#chart-legend').innerHTML = G.map(g => `<span><i style="--c:${g.color}"></i>${esc(g.label)}</span>`).join('');
    $('#hero-rows').innerHTML = G.map(g => `
      <details class="row" data-group="${g.key}" style="--c:${g.color}">
        <summary>
          <span class="sw"></span>
          <span class="row-name"><b>${esc(g.label)}</b><small>${g.ids.map(id => esc(D.futures[id - 1].name)).join(' · ')}</small></span>
          <span class="row-delta"></span>
          <span class="row-val"></span>
        </summary>
        <div class="row-inside">${g.ids.map(id => { const f = D.futures[id - 1]; return `
          <div class="inside-item" style="--c:${f.color}"><i></i><span>${id}. ${esc(f.plain)} <small>· ${esc(f.name)}</small></span><b data-future="${id}"></b></div>`; }).join('')}
        </div>
      </details>`).join('');
    const pretty = D.datasetDate.match(/^(\d\d)\.(\d\d)\.(\d\d)$/);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const date = pretty ? `${Number(pretty[2])} ${months[Number(pretty[1]) - 1]} 20${pretty[3]}` : D.datasetDate;
    $('#footer-note').textContent = `${date} dataset · ${D.models.length} models across ${D.labs.length} labs`;
  }

  function renderHero() {
    const h = state.year;
    const agg = D.aggregates[h];
    const values = allLabs(h);
    const base = allLabs(D.defaultHorizon);
    const ranked = values.map((v, i) => i).sort((a, b) => values[b] - values[a]);
    const top = ranked[0], second = ranked[1];

    $('#kicker').textContent = `We asked ${agg.models} AI models from ${agg.labs} labs how things turn out between humans and AI`;
    $('#headline').innerHTML = values[top] >= 50
      ? `For ${esc(forYear(h))}, AI models put most of their points on <em>${esc(G[top].lead)}.</em>`
      : `For ${esc(forYear(h))}, AI models put more points on <em>${esc(G[top].lead)}</em> than on any other outcome.`;
    $('#dek').innerHTML = `Counting each lab once, that is <b>${values[top]} of 100 points</b>. The runner-up is ${esc(G[second].lead)}, with <b>${values[second]}</b>.`;
    $('#year-note').textContent = h === 'long-term'
      ? 'The lasting arrangement by the year 3000.'
      : `A snapshot of how things stand at the end of ${h}. It does not have to last.`;

    $('#year-select').value = h;
    document.querySelectorAll('#year-toggle .horizon-button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.year === h)));

    const bar = $('#hero-bar');
    // Update in place so the segments slide to their new widths.
    [...bar.children].forEach((segment, i) => {
      segment.style.width = `${values[i]}%`;
      segment.innerHTML = values[i] >= 5 ? `<span>${values[i]}</span>` : '';
    });
    bar.setAttribute('aria-label', `For ${forYear(h)}: ${barLabel(values)}`);

    document.querySelectorAll('#hero-rows .row').forEach((row, i) => {
      row.querySelector('.row-val').textContent = values[i];
      const change = values[i] - base[i];
      row.querySelector('.row-delta').textContent = h === D.defaultHorizon ? 'of 100 points'
        : change === 0 ? 'same as 2030' : `${change > 0 ? 'up' : 'down'} ${Math.abs(change)} from 2030`;
      row.querySelectorAll('[data-future]').forEach(cell => { cell.textContent = `${agg.p[Number(cell.dataset.future) - 1].toFixed(1)}%`; });
    });
  }

  // ---------- Chart ----------
  function node(tag, attributes = {}, text) {
    const n = document.createElementNS(SVG, tag);
    Object.entries(attributes).forEach(([name, value]) => n.setAttribute(name, String(value)));
    if (text != null) n.textContent = text;
    return n;
  }

  function renderChart() {
    const host = $('#chart');
    const width = Math.max(300, Math.floor(host.clientWidth));
    const narrow = width < 620;
    const height = narrow ? 320 : 460;
    const margin = { top: 18, right: narrow ? 13 : 18, bottom: 40, left: 46 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;
    const inset = 12;
    const series = G.map((g, gi) => ({ ...g, index: gi, points: H.map(h => groupVals(D.aggregates[h].p)[gi]) }));
    const yMax = Math.ceil(Math.max(...series.flatMap(s => s.points)) * 1.04 / 10) * 10;
    const x = i => margin.left + inset + (i / (H.length - 1)) * (plotW - inset * 2);
    const y = v => margin.top + (1 - v / yMax) * plotH;
    const selected = H.indexOf(state.year);

    const svg = node('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `Points given to each of the five groups, by year asked about. ${forYear(state.year)} is selected.` });
    svg.appendChild(node('rect', { class: 'frame', x: margin.left, y: margin.top, width: plotW, height: plotH }));
    for (let v = 0; v <= yMax; v += 10) {
      if (v > 0 && v < yMax) svg.appendChild(node('line', { class: 'grid', x1: margin.left, x2: width - margin.right, y1: y(v), y2: y(v) }));
      svg.appendChild(node('text', { class: 'axis-text', x: margin.left - 9, y: y(v) + 4, 'text-anchor': 'end' }, v));
    }
    const shown = narrow ? [0, 3, 8, 10].filter(i => Math.abs(i - selected) >= 2).concat(selected) : H.map((_, i) => i);
    shown.forEach(i => svg.appendChild(node('text', {
      class: `axis-text${i === selected ? ' on' : ''}`, x: x(i), y: margin.top + plotH + 20, 'text-anchor': 'middle'
    }, yearOf(H[i]))));
    svg.appendChild(node('line', { class: 'guide', x1: x(selected), x2: x(selected), y1: margin.top, y2: margin.top + plotH }));

    series.forEach(s => {
      const d = s.points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
      svg.appendChild(node('path', { class: 'series', d, stroke: s.color }));
      s.points.forEach((v, i) => svg.appendChild(node('circle', { cx: x(i), cy: y(v), r: i === selected ? 4.5 : 2, fill: s.color })));
    });

    // Values at the selected year use the headline's rounding and are nudged apart.
    const shownValues = allLabs(state.year);
    const side = selected > H.length - 4 ? -1 : 1;
    const labels = series.map(s => ({ s, at: y(s.points[selected]) })).sort((a, b) => a.at - b.at);
    for (let i = 1; i < labels.length; i += 1) labels[i].at = Math.max(labels[i].at, labels[i - 1].at + 14);
    const overflow = labels.at(-1).at - (margin.top + plotH - 4);
    if (overflow > 0) labels.forEach(label => { label.at -= overflow; });
    for (let i = labels.length - 2; i >= 0; i -= 1) labels[i].at = Math.min(labels[i].at, labels[i + 1].at - 14);
    labels.forEach(({ s, at }) => svg.appendChild(node('text', {
      class: 'end-val', x: x(selected) + side * 10, y: at + 4, 'text-anchor': side > 0 ? 'start' : 'end', fill: '#11120f'
    }, shownValues[s.index])));

    const step = (plotW - inset * 2) / (H.length - 1);
    H.forEach((h, i) => {
      const hit = node('rect', { class: 'hit', x: x(i) - step / 2, y: margin.top, width: step, height: plotH, tabindex: 0, role: 'button', 'aria-label': `Show ${forYear(h)}` });
      hit.addEventListener('click', () => setYear(h));
      hit.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setYear(h); } });
      svg.appendChild(hit);
    });
    host.replaceChildren(svg);

    const control = series[0].points, gone = series[4].points;
    const cross = control.findIndex((v, i) => gone[i] > v);
    const whole = H.map(h => allLabs(h));
    const last = H.length - 1;
    $('#time-takeaway').innerHTML = cross > 0
      ? `Humans staying in control gets more points than humanity being gone or at risk in every year through <b>${yearOf(H[cross - 1])}</b>. From <b>${yearOf(H[cross])}</b> on it is the other way round: ${whole[cross][4]} against ${whole[cross][0]}. For the year 3000 it is ${whole[last][4]} against ${whole[last][0]}.`
      : `Humans staying in control goes from ${whole[0][0]} points for 2030 to ${whole[last][0]} for the year 3000.`;
  }

  // ---------- Quotes ----------
  function renderQuotes() {
    const h = state.year;
    const { hi, lo } = D.quotes[h];
    $('#words-takeaway').innerHTML = `Every model has to explain each number. On humans staying in control for ${esc(forYear(h))}, the answers run from <b>${lo.value}</b> to <b>${hi.value}</b> of 100. These are the two ends.`;
    const figure = (voice, tag) => `
      <figure class="quote">
        <div class="quote-kicker"><span>${voice.value}%</span>${tag} · ${esc(yearOf(h))}</div>
        <blockquote>&ldquo;${esc(voice.text)}&rdquo;</blockquote>
        <figcaption><b>${esc(voice.model)}</b><small>${esc(voice.lab)}</small></figcaption>
      </figure>`;
    $('#quotes').innerHTML = figure(hi, 'Most on human control') + figure(lo, 'Least on human control');
  }

  // ---------- Your AI ----------
  function renderYou() {
    const h = state.year;
    $('#lab-chips').innerHTML = D.labs.map(lab =>
      `<button type="button" data-lab="${esc(lab)}" aria-pressed="${lab === state.lab}" title="${esc(lab)}">${esc(PRODUCT[lab] || lab)}</button>`).join('');
    const models = D.models.filter(m => m.lab === state.lab);
    $('#model-chips').innerHTML = models.map(m =>
      `<button type="button" data-model="${esc(m.id)}" aria-pressed="${m.id === state.model}">${esc(m.name)}</button>`).join('');

    const card = $('#model-card');
    const model = D.models.find(m => m.id === state.model);
    if (!model) {
      card.innerHTML = '<p class="card-empty">Pick an assistant above to see how it answered.</p>';
      return;
    }
    const answer = model.h[h];
    if (!answer) {
      card.innerHTML = `<div><p class="leader-name">${esc(model.name)}</p><span class="leader-unit">${esc(model.lab)} · not asked about ${esc(yearOf(h))}</span></div>
        <p class="card-say">${esc(model.name)} was not asked about ${esc(forYear(h))}. It was asked about ${Object.keys(model.h).map(forYear).map(esc).join(', ')}.</p>`;
      return;
    }
    const mine = toHundred(groupVals(answer.p));
    const everyone = allLabs(h);
    const top = mine.indexOf(Math.max(...mine));
    const future = D.futures[answer.top - 1];
    const link = `?year=${yearOf(h)}&model=${encodeURIComponent(model.id)}#you`;
    card.innerHTML = `
      <div>
        <p class="leader-name">${esc(model.name)}</p>
        <strong class="leader-figure">${mine[top]}%</strong>
        <span class="leader-unit">On ${esc(G[top].label)} · ${esc(yearOf(h))} · ${esc(model.lab)} · asked ${esc(model.asked)}</span>
      </div>
      <div>
        <p class="card-say">For ${esc(forYear(h))}, ${esc(model.name)} puts <b>${mine[top]} of 100 points</b> on ${esc(G[top].lead)}. All labs together put <b>${everyone[top]}</b> there.</p>
        <div class="compare">
          <div class="compare-row"><b>${esc(model.name)}</b>${slimBar(mine)}</div>
          <div class="compare-row"><b>All labs</b>${slimBar(everyone)}</div>
        </div>
        <div class="card-top">
          <p class="label">Its single most likely future · ${answer.p[answer.top - 1]}%</p>
          <h3>${esc(future.plain)}</h3>
          <p class="why">&ldquo;${esc(answer.why)}&rdquo;</p>
        </div>
        <p class="card-links">
          <a class="text-link" href="${link}">Link to this answer <span aria-hidden="true">↗</span></a>
          <a class="text-link" href="${explorerUrl(h, model.id)}">All eleven numbers and reasons <span aria-hidden="true">↗</span></a>
        </p>
      </div>`;
  }

  // ---------- Every AI, side by side ----------
  function buildRanks() {
    $('#sort-toggle').innerHTML = G.map((g, i) =>
      `<button type="button" data-sort="${i}" aria-pressed="false">${esc(g.short)}</button>`).join('');
  }

  function renderRanks() {
    const h = state.year;
    const by = state.sort;
    const everyone = allLabs(h);
    const rows = modelsFor(h)
      .map(model => ({ model, values: toHundred(groupVals(model.h[h].p)) }))
      .sort((a, b) => b.values[by] - a.values[by] || a.model.name.localeCompare(b.model.name));
    document.querySelectorAll('#sort-toggle button').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.sort) === by)));
    const high = rows[0], low = rows.at(-1);
    $('#all-takeaway').innerHTML = `For ${esc(forYear(h))}, points on ${esc(G[by].lead)} run from <b>${low.values[by]}</b> (${esc(low.model.name)}) to <b>${high.values[by]}</b> (${esc(high.model.name)}). All labs together: <b>${everyone[by]}</b>. Select a model to open its answer.`;

    // The picked model always stays visible, even when the list is cut short.
    const visible = state.showAll ? rows : rows.filter((row, i) => i < RANKS_SHOWN || row.model.id === state.model);
    const rowMarkup = (name, sub, values, attributes, cls = '') => `
      <button type="button" class="rank-row ${cls}" ${attributes}>
        <span class="rank-label"><b>${esc(name)}</b><small>${esc(sub)}</small></span>
        ${slimBar(values)}
        <span class="rank-total">${values[by]}%</span>
      </button>`;
    $('#ranks').innerHTML =
      `<div class="rank-row is-all"><span class="rank-label"><b>All labs</b><small>Each lab counted once</small></span>${slimBar(everyone)}<span class="rank-total">${everyone[by]}%</span></div>`
      + visible.map(row => rowMarkup(row.model.name, row.model.lab, row.values,
        `data-open-model="${esc(row.model.id)}" aria-label="${esc(row.model.name)}: ${row.values[by]} of 100 on ${esc(G[by].label)}. Open its answer."`,
        row.model.id === state.model ? 'is-picked' : '')).join('');
    const more = $('#ranks-more');
    more.hidden = rows.length <= RANKS_SHOWN;
    more.textContent = state.showAll ? 'Show fewer' : `Show all ${rows.length} models`;
    more.setAttribute('aria-expanded', String(state.showAll));
    $('#explorer-link').href = explorerUrl(h);
  }

  // ---------- Try it ----------
  function buildTry() {
    $('#sliders').innerHTML = G.map((g, i) => `
      <div class="slider-row" style="--c:${g.color}">
        <span class="sw"></span>
        <label for="mine-${i}">${esc(g.label)}</label>
        <output id="mine-out-${i}" for="mine-${i}"></output>
        <input type="range" id="mine-${i}" min="0" max="100" step="1" data-mine="${i}">
      </div>`).join('');
    $('#sliders').addEventListener('input', event => {
      const index = Number(event.target.dataset.mine);
      if (!Number.isInteger(index)) return;
      const value = Number(event.target.value);
      const others = state.mine.map((v, i) => (i === index ? 0 : v));
      // The rest keep their proportions so the total is always 100.
      const shares = sum(others) ? others : others.map((v, i) => (i === index ? 0 : 1));
      const rebalanced = toHundred(shares, 100 - value);
      state.mine = rebalanced.map((v, i) => (i === index ? value : v));
      renderTry();
    });
  }

  function renderTry() {
    const h = state.year;
    state.mine.forEach((value, i) => {
      $(`#mine-${i}`).value = String(value);
      $(`#mine-out-${i}`).textContent = value;
    });
    $('#try-takeaway').textContent = `This is the same job the models were given, in five groups instead of eleven. Move any slider for ${forYear(h)}; the others adjust so you always total 100.`;
    const ranked = modelsFor(h)
      .map(model => { const values = toHundred(groupVals(model.h[h].p)); return { model, values, gap: distance(values, state.mine) }; })
      .sort((a, b) => a.gap - b.gap);
    const closest = ranked[0], furthest = ranked.at(-1);
    const everyone = distance(allLabs(h), state.mine);
    $('#match').innerHTML = `
      <div class="quote-kicker"><span>${Math.round(closest.gap)} apart</span>Closest to you · ${esc(yearOf(h))}</div>
      <h3>${esc(closest.model.name)}</h3>
      <p>${esc(closest.model.lab)}. You would have to move ${Math.round(closest.gap)} of your 100 points to match it. All labs together are ${Math.round(everyone)} points from you. Furthest from you is ${esc(furthest.model.name)}, ${Math.round(furthest.gap)} points away.</p>
      <div class="compare">
        <div class="compare-row"><b>You</b>${slimBar(state.mine)}</div>
        <div class="compare-row"><b>${esc(closest.model.name)}</b>${slimBar(closest.values)}</div>
      </div>
      <button type="button" data-open-model="${esc(closest.model.id)}">See its answer</button>`;
  }

  // ---------- Eleven futures ----------
  function buildFutures() {
    $('#future-list').innerHTML = G.flatMap(g => g.ids.map(id => {
      const f = D.futures[id - 1];
      return `
        <article class="state-card" data-future="${id}" style="--c:${f.color}">
          <div class="state-card-head">
            <span class="state-num">${String(id).padStart(2, '0')}</span>
            <div class="state-card-meta"><strong></strong>${f.tier ? MARK[f.tier] : ''}</div>
            <h3>${esc(f.plain)}</h3>
          </div>
          <p class="state-coined">${esc(f.name)} · ${esc(g.label)}</p>
          <details class="desc-wrap"><summary>What this means</summary><p class="desc"></p></details>
          <div class="state-foot">
            <div class="meter"><i></i></div>
            <p class="state-range"></p>
          </div>
        </article>`;
    })).join('');
    // Descriptions are always open on wide screens; on a phone they fold away
    // so eleven cards do not become eleven screens.
    const wide = matchMedia('(min-width: 601px)');
    const sync = () => document.querySelectorAll('.desc-wrap').forEach(wrap => { wrap.open = wide.matches; });
    sync();
    wide.addEventListener('change', sync);
  }

  function renderFutures() {
    const h = state.year;
    const agg = D.aggregates[h];
    const models = modelsFor(h);
    const everything = models.flatMap(m => m.h[h].p);
    const axis = Math.max(...everything);
    $('#futures-takeaway').textContent = `The five groups are made of these eleven. Figures are the share of 100 points for ${forYear(h)}, counting each lab once.`;
    const who = list => (list.length > 2 ? `${list[0]} +${list.length - 1}` : list.join(', '));
    document.querySelectorAll('.state-card').forEach(card => {
      const id = Number(card.dataset.future);
      const f = D.futures[id - 1];
      const value = agg.p[id - 1];
      card.querySelector('.state-card-meta strong').textContent = `${value.toFixed(1)}%`;
      card.querySelector('.meter i').style.width = `${(value / axis * 100).toFixed(1)}%`;
      card.querySelector('.desc').textContent = h === 'long-term' ? f.longTerm : f.dated;
      const values = models.map(m => m.h[h].p[id - 1]);
      const low = Math.min(...values), high = Math.max(...values);
      const named = target => who(models.filter(m => m.h[h].p[id - 1] === target).map(m => m.name));
      card.querySelector('.state-range').textContent = low === high
        ? `${low}% from all ${models.length} models`
        : `${low}–${high}% across ${models.length} models · most: ${named(high)}`;
    });
  }

  // ---------- Wiring ----------
  function renderAll() {
    renderHero();
    renderChart();
    renderQuotes();
    renderYou();
    renderRanks();
    renderTry();
    renderFutures();
  }

  function setYear(h) {
    if (!H.includes(h) || h === state.year) return;
    state.year = h;
    renderAll();
    writeUrl();
  }

  $('#year-select').addEventListener('change', event => setYear(event.target.value));
  document.addEventListener('click', event => {
    const year = event.target.closest('[data-year]');
    if (year) { setYear(year.dataset.year); return; }
    const sort = event.target.closest('[data-sort]');
    if (sort) { state.sort = Number(sort.dataset.sort); renderRanks(); return; }
    if (event.target.closest('#ranks-more')) { state.showAll = !state.showAll; renderRanks(); return; }
    const lab = event.target.closest('[data-lab]');
    if (lab) {
      state.lab = lab.dataset.lab;
      // Open on the lab's most recently asked model that has an answer for this year.
      const candidates = D.models.filter(m => m.lab === state.lab && m.h[state.year]);
      const newest = candidates.reduce((best, m) => (!best || m.asked >= best.asked ? m : best), null);
      state.model = newest ? newest.id : '';
      renderYou();
      renderRanks();
      writeUrl();
      return;
    }
    const model = event.target.closest('[data-model]');
    if (model) {
      state.model = model.dataset.model;
      renderYou();
      renderRanks();
      writeUrl();
      return;
    }
    const open = event.target.closest('[data-open-model]');
    if (open) {
      const target = D.models.find(m => m.id === open.dataset.openModel);
      state.model = target.id;
      state.lab = target.lab;
      renderYou();
      renderRanks();
      writeUrl();
      $('#you').scrollIntoView();
    }
  });

  readUrl();
  buildHero();
  buildRanks();
  buildTry();
  buildFutures();
  renderAll();
  writeUrl();
  if ('ResizeObserver' in window) {
    let last = $('#chart').clientWidth;
    new ResizeObserver(() => {
      const width = $('#chart').clientWidth;
      if (Math.abs(width - last) < 2) return;
      last = width;
      renderChart();
    }).observe($('#chart'));
  }
})();
