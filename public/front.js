(function () {
  const D = window.FRONT;
  // Sentences with numbers, and the arithmetic behind them, live in
  // front-copy.js so the build and the checks can read the same words.
  const C = window.FRONT_COPY(D);
  const { esc, sum, yearOf, forYear, toHundred, distance, groupVals, allLabs, modelsFor } = C;
  const H = D.horizons;
  const G = D.groups;
  const $ = selector => document.querySelector(selector);
  const PRODUCT = { Anthropic: 'Claude', OpenAI: 'ChatGPT', Google: 'Gemini', xAI: 'Grok', Meta: 'Meta AI', DeepSeek: 'DeepSeek', Mistral: 'Le Chat', Moonshot: 'Kimi' };
  const SVG = 'http://www.w3.org/2000/svg';

  const state = { year: D.defaultHorizon, lab: '', model: '', mine: [20, 20, 20, 20, 20], sort: 0, labsBy: 0, showAll: false };
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

  // What readers use, counted by the same cookieless collector that counts
  // page views. analytics.js defines window.va on the public site only, so
  // this is silent on localhost. Nothing about the reader is sent, and each
  // kind of event is capped per visit so a busy day cannot multiply the count.
  const noted = {};
  function note(name, data, limit = 1) {
    if (typeof window.va !== 'function') return;
    noted[name] = (noted[name] || 0) + 1;
    if (noted[name] <= limit) window.va('event', { name, data });
  }

  // Each model's reason for its top future is a file of its own, so the page
  // does not carry every reason for every year before anyone asks for one. It
  // is fetched when the reader gets near "What does your AI say?" or opens a
  // model's answer, whichever comes first.
  let why = window.FRONT_WHY ? 'ready' : 'idle';
  function loadWhy() {
    if (why !== 'idle') return;
    why = 'loading';
    const script = document.createElement('script');
    script.src = 'front-why.js';
    script.onload = () => { why = window.FRONT_WHY ? 'ready' : 'failed'; renderYou(); };
    script.onerror = () => { why = 'failed'; renderYou(); };
    document.head.appendChild(script);
  }

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
    $('#footer-note').textContent = C.footerNote();
  }

  function renderHero() {
    const h = state.year;
    const agg = D.aggregates[h];
    const values = allLabs(h);
    const base = allLabs(D.defaultHorizon);

    $('#kicker').textContent = C.kicker(h);
    $('#headline').innerHTML = C.headline(h);
    $('#dek').innerHTML = C.dek(h);
    $('#year-note').textContent = C.yearNote(h);

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

    $('#time-takeaway').innerHTML = C.timeTakeaway();
  }

  // ---------- Quotes ----------
  function renderQuotes() {
    const h = state.year;
    const { hi, lo } = D.quotes[h];
    $('#words-takeaway').innerHTML = C.wordsTakeaway(h);
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
    const mine = C.modelVals(model, h);
    const everyone = allLabs(h);
    const top = mine.indexOf(Math.max(...mine));
    const future = D.futures[answer.top - 1];
    // The reason is in a file of its own; show the numbers now and the words
    // as soon as they arrive.
    loadWhy();
    const reason = why === 'ready' ? { text: window.FRONT_WHY[model.id]?.[h] ?? '' } : null;
    const reasonMarkup = reason
      ? `<p class="why">&ldquo;${esc(reason.text)}&rdquo;</p>`
      : why === 'failed'
        ? '<p class="why">Its reason did not load. It is in the full explorer, linked below.</p>'
        : '<p class="why" data-loading>Loading its reason\u2026</p>';
    const link = `?year=${yearOf(h)}&model=${encodeURIComponent(model.id)}#you`;
    card.innerHTML = `
      <div>
        <p class="leader-name">${esc(model.name)}</p>
        <strong class="leader-figure">${mine[top]}%</strong>
        <span class="leader-unit">On ${esc(G[top].label)} · ${esc(yearOf(h))} · ${esc(model.lab)} · asked ${esc(model.asked)}</span>
      </div>
      <div>
        <p class="card-say">${C.cardSay(model, h)}</p>
        <div class="compare">
          <div class="compare-row"><b>${esc(model.name)}</b>${slimBar(mine)}</div>
          <div class="compare-row"><b>All labs</b>${slimBar(everyone)}</div>
        </div>
        <div class="card-top">
          <p class="label">Its single most likely future · ${answer.p[answer.top - 1]}%</p>
          <h3>${esc(future.plain)}</h3>
          ${reasonMarkup}
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
    const rows = C.ranking(h, by);
    document.querySelectorAll('#sort-toggle button').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.sort) === by)));
    $('#all-takeaway').innerHTML = C.allTakeaway(h, by);

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

  // ---------- Why they disagree ----------
  function buildCruxes() {
    $('#cruxes').innerHTML = D.cruxes.map(crux => {
      const future = D.futures[crux.future - 1];
      const span = Math.max(1, crux.high - crux.low);
      const at = value => ((value - crux.low) / span * 100).toFixed(1);
      const [first, second] = crux.quotes;
      return `
        <article class="crux">
          <div class="quote-kicker"><span>${esc(yearOf(crux.horizon))}</span>${esc(future.name)}</div>
          <h3>${esc(crux.question)}</h3>
          <p class="crux-about">${esc(future.plain)}</p>
          ${crux.quotes.map(quote => `
          <blockquote>&ldquo;${esc(quote.text)}&rdquo;<cite><b>${quote.value}%</b>${esc(quote.model)}</cite></blockquote>`).join('')}
          <div class="crux-range" role="img" aria-label="${esc(first.model)} gave it ${first.value} of 100 points and ${esc(second.model)} gave it ${second.value}. Across all ${crux.count} models the answers run from ${crux.low} to ${crux.high}.">
            <div class="crux-line">${crux.quotes.map(quote => `<i style="left:${at(quote.value)}%"></i>`).join('')}</div>
            <p><span>${crux.low}%</span><span>All ${crux.count} models</span><span>${crux.high}%</span></p>
          </div>
        </article>`;
    }).join('');
  }

  // ---------- Lab by lab ----------
  function buildLabs() {
    $('#labs-toggle').innerHTML = G.map((g, i) =>
      `<button type="button" data-labs-by="${i}" aria-pressed="false">${esc(g.short)}</button>`).join('');
  }

  function renderLabs() {
    const h = state.year;
    const by = state.labsBy;
    const rows = C.labRows(h);
    const everyone = allLabs(h)[by];
    // The axis stretches to the highest answer, so groups that get few points
    // are not squeezed into the left edge.
    const highest = Math.max(everyone, ...rows.flatMap(row => row.models.map(entry => entry.values[by])));
    const scale = Math.max(20, Math.ceil(highest / 20) * 20);
    const at = value => `${(value / scale * 100).toFixed(1)}%`;
    document.querySelectorAll('#labs-toggle button').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.labsBy) === by)));
    $('#labs-takeaway').innerHTML = C.labsTakeaway(h, by);
    $('#labs').style.setProperty('--c', G[by].color);
    $('#lab-rows').innerHTML = rows.map(row => {
      const values = row.models.map(entry => entry.values[by]);
      const count = `${row.models.length} model${row.models.length === 1 ? '' : 's'}`;
      return `
        <div class="lab-row" role="img" aria-label="${esc(row.lab)}: an average of ${row.values[by]} of 100 points on ${esc(G[by].label)} for ${esc(forYear(h))}. ${count}, from ${Math.min(...values)} to ${Math.max(...values)}.">
          <span class="rank-label"><b>${esc(row.lab)}</b><small>${esc(PRODUCT[row.lab] || row.lab)} \u00b7 ${count}</small></span>
          <span class="lab-track">
            <i class="lab-all" style="left:${at(everyone)}"></i>
            ${row.models.map(entry => `<i class="lab-dot${entry.model.id === state.model ? ' is-picked' : ''}" style="left:${at(entry.values[by])}" title="${esc(entry.model.name)}: ${entry.values[by]}"></i>`).join('')}
            <i class="lab-avg" style="left:${at(row.values[by])}" title="${esc(row.lab)} average: ${row.values[by]}"></i>
          </span>
          <span class="rank-total">${row.values[by]}%</span>
        </div>`;
    }).join('') + `
        <div class="lab-row lab-axis" aria-hidden="true">
          <span></span>
          <span class="lab-track">${[0, scale / 2, scale].map(tick => `<small style="left:${at(tick)}">${tick}</small>`).join('')}</span>
          <span></span>
        </div>`;
    $('#labs-key').innerHTML = `<span><i class="lab-dot"></i>One model</span><span><i class="lab-avg"></i>The lab\u2019s average</span><span><i class="lab-all"></i>All labs together: ${everyone}</span>`;
    $('#labs-note').textContent = C.labsNote(h);
  }

  // ---------- Asked twice ----------
  function buildSteady() {
    const R = D.reask;
    const scale = Math.max(R.moved, R.between) * 1.08;
    $('#steady-takeaway').innerHTML = C.steadyTakeaway();
    $('#steady-caption').textContent = C.steadyCaption();
    $('#steady-say').textContent = C.steadySay();
    $('#steady-gaps').innerHTML = [
      ['The same model, asked again', R.moved, 'points moved, the median'],
      ['Two different models', R.between, 'points apart, on average'],
    ].map(([label, value, unit]) => `
      <div class="gap-row">
        <div class="gap-head"><b>${label}</b><strong>${value.toFixed(1)}</strong></div>
        <div class="gap-bar"><i style="width:${(value / scale * 100).toFixed(1)}%"></i></div>
        <small>${unit}</small>
      </div>`).join('');
  }

  function renderSteady() {
    const R = D.reask;
    const host = $('#steady-chart');
    const width = Math.max(280, Math.floor(host.clientWidth));
    const height = Math.min(width, 520);
    const margin = { top: 14, right: 14, bottom: 48, left: 54 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;
    const max = Math.ceil(Math.max(...R.pairs.flatMap(pair => [pair[2], pair[3]])) / 10) * 10;
    const x = v => margin.left + v / max * plotW;
    const y = v => margin.top + (1 - v / max) * plotH;
    const gone = G[C.groupIndex('gone')];

    const svg = node('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `${R.pairs.length} answers asked for twice. Points on ${gone.label} the first time, across, against the published answer, up. The dots sit close to the line where the two are equal.` });
    svg.appendChild(node('rect', { class: 'frame', x: margin.left, y: margin.top, width: plotW, height: plotH }));
    for (let v = 0; v <= max; v += 10) {
      if (v > 0 && v < max) {
        svg.appendChild(node('line', { class: 'grid', x1: margin.left, x2: margin.left + plotW, y1: y(v), y2: y(v) }));
        svg.appendChild(node('line', { class: 'grid', x1: x(v), x2: x(v), y1: margin.top, y2: margin.top + plotH }));
      }
      svg.appendChild(node('text', { class: 'axis-text', x: margin.left - 9, y: y(v) + 4, 'text-anchor': 'end' }, v));
      svg.appendChild(node('text', { class: 'axis-text', x: x(v), y: margin.top + plotH + 18, 'text-anchor': 'middle' }, v));
    }
    svg.appendChild(node('line', { class: 'guide', x1: x(0), y1: y(0), x2: x(max), y2: y(max) }));
    svg.appendChild(node('text', { class: 'axis-text on', x: margin.left + plotW / 2, y: height - 6, 'text-anchor': 'middle' }, 'First answer'));
    svg.appendChild(node('text', { class: 'axis-text on', transform: `translate(13 ${margin.top + plotH / 2}) rotate(-90)`, 'text-anchor': 'middle' }, 'Published answer'));
    R.pairs.forEach(([modelIndex, yearIndex, first, now]) => {
      const dot = node('circle', { class: 'pair', cx: x(first).toFixed(1), cy: y(now).toFixed(1), r: 4, fill: gone.color });
      dot.appendChild(node('title', {}, `${D.models[modelIndex].name}, ${yearOf(H[yearIndex])}: ${first} then ${now}`));
      svg.appendChild(dot);
    });
    host.replaceChildren(svg);
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
      note('Sliders used', { year: yearOf(state.year) });
    });
  }

  function renderTry() {
    const h = state.year;
    state.mine.forEach((value, i) => {
      $(`#mine-${i}`).value = String(value);
      $(`#mine-out-${i}`).textContent = value;
    });
    $('#try-takeaway').textContent = C.tryTakeaway(h);
    const ranked = modelsFor(h)
      .map(model => { const values = C.modelVals(model, h); return { model, values, gap: distance(values, state.mine) }; })
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
    $('#futures-takeaway').textContent = C.futuresTakeaway(h);
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
    renderLabs();
    renderTry();
    renderFutures();
  }

  function setYear(h) {
    if (!H.includes(h) || h === state.year) return;
    state.year = h;
    renderAll();
    writeUrl();
    note('Year changed', { year: yearOf(h) }, 3);
  }

  $('#year-select').addEventListener('change', event => setYear(event.target.value));
  document.addEventListener('click', event => {
    const out = event.target.closest('a[href^="explore.html"]');
    if (out) {
      const place = out.closest('section[id], footer, header');
      note('Explorer opened', { from: place ? place.id || place.tagName.toLowerCase() : 'page' });
    }
    const year = event.target.closest('[data-year]');
    if (year) { setYear(year.dataset.year); return; }
    const sort = event.target.closest('[data-sort]');
    if (sort) { state.sort = Number(sort.dataset.sort); renderRanks(); return; }
    const labsBy = event.target.closest('[data-labs-by]');
    if (labsBy) { state.labsBy = Number(labsBy.dataset.labsBy); renderLabs(); return; }
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
      renderLabs();
      writeUrl();
      if (newest) note('AI picked', { lab: newest.lab, model: newest.id }, 3);
      return;
    }
    const model = event.target.closest('[data-model]');
    if (model) {
      state.model = model.dataset.model;
      renderYou();
      renderRanks();
      renderLabs();
      writeUrl();
      note('AI picked', { lab: state.lab, model: state.model }, 3);
      return;
    }
    const open = event.target.closest('[data-open-model]');
    if (open) {
      const target = D.models.find(m => m.id === open.dataset.openModel);
      state.model = target.id;
      state.lab = target.lab;
      renderYou();
      renderRanks();
      renderLabs();
      writeUrl();
      note('AI picked', { lab: target.lab, model: target.id }, 3);
      $('#you').scrollIntoView();
    }
  });

  readUrl();
  buildHero();
  buildRanks();
  buildCruxes();
  buildLabs();
  buildSteady();
  buildTry();
  buildFutures();
  renderAll();
  renderSteady();
  writeUrl();
  if ('ResizeObserver' in window) {
    // Both charts are drawn to the width they are given.
    [['#chart', renderChart], ['#steady-chart', renderSteady]].forEach(([selector, draw]) => {
      let last = $(selector).clientWidth;
      new ResizeObserver(() => {
        const width = $(selector).clientWidth;
        if (Math.abs(width - last) < 2) return;
        last = width;
        draw();
      }).observe($(selector));
    });
  }
  if ('IntersectionObserver' in window) {
    // Which sections a reader gets to. The first two are on screen at load,
    // so they would say nothing.
    const seen = new IntersectionObserver(entries => {
      entries.filter(entry => entry.isIntersecting).forEach(entry => {
        seen.unobserve(entry.target);
        note('Section seen', { section: entry.target.id }, 12);
      });
    }, { rootMargin: '0px 0px -35% 0px' });
    document.querySelectorAll('main section[id]').forEach(section => {
      if (section.id !== 'top' && section.id !== 'answer') seen.observe(section);
    });
    const near = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      near.disconnect();
      loadWhy();
    }, { rootMargin: '900px 0px' });
    near.observe($('#you'));
  }
})();
