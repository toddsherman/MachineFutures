(function () {
  const payload = window.MF_DATA || {};
  const { states: baseStates = [], statesByHorizon = {} } = payload;
  // Forecasts now share one taxonomy but belong to distinct horizons. Keep the
  // legacy shape readable so a partially regenerated checkout still opens on
  // the existing long-term board rather than failing before the controls paint.
  const configuredHorizons = Array.isArray(payload.horizons) && payload.horizons.length
    ? payload.horizons
    : [{ id: 'long-term', label: 'Long term', targetYear: 3000 }];
  const datasets = payload.datasets || {
    'long-term': {
      endStateRuns: payload.endStateRuns || {},
      datasetDate: payload.datasetDate,
      leaderHistory: payload.leaderHistory || []
    }
  };
  const fallbackHorizon = datasets[payload.defaultHorizon]
    ? payload.defaultHorizon
    : (datasets['long-term'] ? 'long-term' : Object.keys(datasets)[0]);
  // A horizon becomes selectable only when it has something to show. This
  // keeps staged prompts and pipeline changes from exposing a control that
  // would collapse every data section—and the reader's viewport—on selection.
  const hasForecasts = horizon => Object.keys(datasets[horizon]?.endStateRuns || {}).length > 0;
  const horizonOptions = configuredHorizons
    .filter(option => option.id === fallbackHorizon || hasForecasts(option.id))
    .sort((left, right) => {
      if (left.id === right.id) return 0;
      if (left.id === 'long-term') return 1;
      if (right.id === 'long-term') return -1;
      return Number(left.targetYear) - Number(right.targetYear);
    });
  const isSelectableHorizon = horizon => horizonOptions.some(option => option.id === horizon);

  let activeHorizon = fallbackHorizon || 'long-term';
  let states = baseStates;
  let endStateRuns = {};
  let datasetDate = '';
  let leaderHistory = [];
  const activeDataset = () => datasets[activeHorizon] || { endStateRuns: {}, datasetDate: '', leaderHistory: [] };
  const horizonMeta = () => horizonOptions.find(option => option.id === activeHorizon)
    || { id: activeHorizon, label: activeHorizon, targetYear: activeHorizon };
  const isSnapshot = () => activeHorizon !== 'long-term';
  const stateTerm = plural => isSnapshot()
    ? (plural ? 'structural states' : 'structural state')
    : (plural ? 'end states' : 'end state');
  const outcomeTerm = plural => isSnapshot()
    ? (plural ? 'states' : 'state')
    : (plural ? 'endings' : 'ending');
  function useDataset(horizon) {
    activeHorizon = isSelectableHorizon(horizon) ? horizon : (fallbackHorizon || 'long-term');
    states = Array.isArray(statesByHorizon[activeHorizon])
      ? statesByHorizon[activeHorizon]
      : baseStates;
    const dataset = activeDataset();
    endStateRuns = dataset.endStateRuns || {};
    datasetDate = dataset.datasetDate || '';
    leaderHistory = dataset.leaderHistory || [];
  }
  useDataset(activeHorizon);

  // Guard against taxonomy/data drift: every end-state run must cover exactly
  // the published state ids and allocate exactly 100 points.
  Object.entries(datasets).forEach(([horizon, dataset]) => {
    Object.entries(dataset.endStateRuns || {}).forEach(([runKey, run]) => {
      const ids = Object.keys(run.probabilities || {}).map(Number).sort((a, b) => a - b);
      const sum = ids.reduce((total, id) => total + run.probabilities[id], 0);
      const coversAllStates = baseStates.length > 0 && ids.length === baseStates.length && baseStates.every(state => ids.includes(state.id));
      if (!coversAllStates || sum !== 100) console.error(`MF_DATA.datasets['${horizon}'].endStateRuns['${runKey}']: probabilities must cover state ids 1–${baseStates.length} and sum to 100 (got ${ids.length} states, sum ${sum}).`);
    });
  });
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  const AGGREGATE_KEY = 'Aggregate';
  const aggregatePercent = value => `${Number(value).toFixed(1)}%`;

  let activeEndForecast = AGGREGATE_KEY;

  // Horizon and selected model live in real query params so a link is shareable:
  //   /?horizon=2030&model=claude-fable-5
  // The hash is left free for section anchors (#method).
  function applyUrlState() {
    const params = new URLSearchParams(location.search);
    const requestedHorizon = params.get('horizon');
    const invalidHorizon = requestedHorizon && !isSelectableHorizon(requestedHorizon);
    useDataset(requestedHorizon && isSelectableHorizon(requestedHorizon) ? requestedHorizon : fallbackHorizon);
    let model = params.get('model');
    // Links shared before the site became a single page used
    // #end-states?model=X. Honour them, then rewrite to the current form.
    const legacy = location.hash.match(/[?&]model=([^&]+)/);
    if (!model && legacy) {
      model = decodeURIComponent(legacy[1]);
    }
    // The aggregate has never needed a query parameter. Treat the old internal
    // selector key as that default so previously shared URLs still open cleanly.
    const requestedAggregate = model === 'Median' || model === AGGREGATE_KEY;
    if (requestedAggregate) model = null;
    const invalidModel = model && !endStateRuns[model];
    activeEndForecast = model && endStateRuns[model] ? model : AGGREGATE_KEY;
    if (legacy || invalidHorizon || invalidModel || requestedAggregate) updateUrl();
  }

  function updateUrl() {
    const url = new URL(location.href);
    if (activeHorizon === fallbackHorizon) url.searchParams.delete('horizon');
    else url.searchParams.set('horizon', activeHorizon);
    if (activeEndForecast === AGGREGATE_KEY) url.searchParams.delete('model');
    else url.searchParams.set('model', activeEndForecast);
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  const extinctionLabels = { gone: 'Humanity is gone', risk: 'Humanity might perish' };
  // Straight from rule 3 of the taxonomy, so the marks explain themselves in
  // the same words the models were given.
  const extinctionTip = tier => {
    if (isSnapshot()) {
      return tier === 'gone'
        ? 'States 1–3. Humans died or were destroyed without continuity of individual identity.'
        : 'States 4–5. Humanity survives in some versions and perishes in others.';
    }
    return tier === 'gone'
      ? 'Endings 1–3. Humans died or were destroyed without continuity of individual identity.'
      : 'Endings 4–5. Humanity survives in some versions of the ending and perishes in others.';
  };
  const MARK_SHAPES = {
    risk: '<path d="M11 3.2 20.1 18.5H1.9Z"/><path d="M11 9.1v3.9M11 15.8h.01"/>'
  };
  // U+2620 carries U+FE0E, the text-presentation selector. Without it iOS and
  // Android both substitute a colour emoji, which would put back on the page
  // the one thing these marks deliberately do not use: hue.
  const MARK_GLYPHS = { gone: '\u2620\uFE0E' };
  const extinctionMark = state => {
    const tier = state.extinction;
    if (!tier) return '';
    const label = extinctionLabels[tier];
    // No title attribute: it would double up with the tooltip below.
    const body = MARK_GLYPHS[tier]
      ? MARK_GLYPHS[tier]
      : `<svg viewBox="0 0 22 22" aria-hidden="true">${MARK_SHAPES[tier]}</svg>`;
    const glyph = MARK_GLYPHS[tier] ? ' is-glyph' : '';
    return `<span class="state-mark is-${tier}${glyph}" role="img" data-mark="${tier}" aria-label="${label}. ${extinctionTip(tier)}">${body}</span>`;
  };

  // Rationales are model-authored: they arrive from a provider API, pass
  // through the importer verbatim, and land in innerHTML. Anything rendered
  // from a run has to be escaped, in attributes as well as in text.
  const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ESCAPES[c]);

  const stateValue = (run, state) => run.probabilities[state.id];
  const endingOrder = () => [...states].sort((a, b) => a.id - b.id);
  const extinctionSums = run => {
    const sums = { gone: 0, risk: 0 };
    states.forEach(state => { if (state.extinction) sums[state.extinction] += stateValue(run, state); });
    return { ...sums, total: sums.gone + sums.risk };
  };

  // Quantise a complete allocation with largest remainder. The lab-balanced
  // arithmetic mean already sums to 100 before floating-point noise; working
  // in tenths keeps the accepted display precision while guaranteeing that the
  // eleven published values still add to exactly 100.0.
  function quantizeTo100(values, digits = 1) {
    const total = values.reduce((sum, v) => sum + v, 0);
    if (!total) return values.map(() => 0);
    const units = 10 ** digits;
    const scaled = values.map(v => (v / total) * 100 * units);
    const out = scaled.map(Math.floor);
    const shortfall = 100 * units - out.reduce((sum, v) => sum + v, 0);
    const order = scaled.map((v, i) => [v - out[i], i]).sort((a, b) => b[0] - a[0]).map(([, i]) => i);
    for (let i = 0; i < shortfall; i += 1) out[order[i % order.length]] += 1;
    return out.map(value => Number((value / units).toFixed(digits)));
  }

  function runsByLab(runList) {
    const groups = new Map();
    runList.forEach((run, index) => {
      const provider = String(run.provider || '').trim();
      // Missing provider metadata must not accidentally give unrelated models
      // one shared vote. Treat each such run as its own lab until it is fixed.
      const key = provider || `__model_${index}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(run);
    });
    return [...groups.values()];
  }

  // Each lab gets one equal vote: first average model vectors within a lab,
  // then average those lab vectors. Per-model figures remain the medians of
  // their repeated samples; this is only the cross-model board aggregate.
  function aggregateOf(runList, orderedStates = endingOrder()) {
    if (!runList.length) return [];
    const labVectors = runsByLab(runList).map(labRuns =>
      orderedStates.map(state => mean(labRuns.map(run => stateValue(run, state))))
    );
    const raw = orderedStates.map((state, index) => mean(labVectors.map(vector => vector[index])));
    return quantizeTo100(raw);
  }

  function stateAggregate() {
    const aggregate = aggregateOf(Object.values(endStateRuns));
    if (!aggregate.length) return [];
    return endingOrder().map((state, i) => ({ ...state, probability: aggregate[i] }));
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const horizonChartActive = new Set(baseStates.map(state => state.id));
  let horizonChartLayout = null;
  let horizonChartDataCache = null;
  let horizonChartObserver = null;
  let horizonChartPinned = false;

  function svgNode(tag, attributes = {}, text = '') {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attributes).forEach(([name, value]) => {
      if (value !== null && value !== undefined) node.setAttribute(name, String(value));
    });
    if (text) node.textContent = text;
    return node;
  }

  function endpointSlope(hThis, hNext, deltaThis, deltaNext) {
    let slope = ((2 * hThis + hNext) * deltaThis - hThis * deltaNext) / (hThis + hNext);
    if (Math.sign(slope) !== Math.sign(deltaThis)) slope = 0;
    else if (Math.sign(deltaThis) !== Math.sign(deltaNext) && Math.abs(slope) > Math.abs(3 * deltaThis)) {
      slope = 3 * deltaThis;
    }
    return slope;
  }

  function shapePreservingModel(points, finalSlope) {
    const xs = points.map(point => point.year);
    const ys = points.map(point => point.value);
    const widths = xs.slice(0, -1).map((value, index) => xs[index + 1] - value);
    const deltas = widths.map((width, index) => (ys[index + 1] - ys[index]) / width);
    const slopes = new Array(points.length).fill(0);
    slopes[0] = endpointSlope(widths[0], widths[1], deltas[0], deltas[1]);
    for (let index = 1; index < points.length - 1; index += 1) {
      if (deltas[index - 1] === 0 || deltas[index] === 0 || Math.sign(deltas[index - 1]) !== Math.sign(deltas[index])) {
        slopes[index] = 0;
        continue;
      }
      const weightOne = 2 * widths[index] + widths[index - 1];
      const weightTwo = widths[index] + 2 * widths[index - 1];
      slopes[index] = (weightOne + weightTwo) /
        (weightOne / deltas[index - 1] + weightTwo / deltas[index]);
    }
    slopes[slopes.length - 1] = finalSlope;

    return year => {
      let index = 0;
      while (index < xs.length - 2 && year > xs[index + 1]) index += 1;
      const width = widths[index];
      const t = (year - xs[index]) / width;
      const t2 = t * t;
      const t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[index] +
        (t3 - 2 * t2 + t) * width * slopes[index] +
        (-2 * t3 + 3 * t2) * ys[index + 1] +
        (t3 - t2) * width * slopes[index + 1];
    };
  }

  function c4TailModel(points) {
    const previous = points.at(-3);
    const start = points.at(-2);
    const end = points.at(-1);
    const duration = end.year - start.year;
    const incomingSlope = (start.value - previous.value) / (start.year - previous.year);
    const change = end.value - start.value;
    if (Math.abs(change) < Number.EPSILON) return () => start.value;
    const reversesAtStart = incomingSlope && Math.sign(incomingSlope) !== Math.sign(change);
    const slopeRatio = (reversesAtStart ? 0 : incomingSlope) * duration / change;

    return year => {
      const t = Math.max(0, Math.min(1, (year - start.year) / duration));
      let progress;
      if (slopeRatio > 1) {
        progress = 1 - Math.pow(1 - t, slopeRatio);
      } else {
        const power = slopeRatio < 0 ? 1 - slopeRatio : 2;
        const blend = (slopeRatio - 1) / (power - 1);
        progress = blend * (1 - Math.pow(1 - t, power)) + (1 - blend) * t;
      }
      return start.value + change * progress;
    };
  }

  function sampleHorizonCurve(points) {
    if (points.length < 3) return points;
    const earlyPoints = points.slice(0, -1);
    const previous = earlyPoints.at(-2);
    const lastEarly = earlyPoints.at(-1);
    const incomingSlope = (lastEarly.value - previous.value) / (lastEarly.year - previous.year);
    const tailChange = points.at(-1).value - lastEarly.value;
    // A direction reversal is a turning point. Flatten the shared tangent so
    // the connector does not invent a probability beyond either observation.
    const reversesAtTail = incomingSlope && tailChange && Math.sign(incomingSlope) !== Math.sign(tailChange);
    const finalEarlySlope = reversesAtTail ? 0 : incomingSlope;
    const earlyValue = shapePreservingModel(earlyPoints, finalEarlySlope);
    const tailValue = c4TailModel(points);
    const firstYear = points[0].year;
    const tailYear = points.at(-2).year;
    const lastYear = points.at(-1).year;
    const early = Array.from({ length: 91 }, (_, index) => {
      const year = firstYear + (tailYear - firstYear) * index / 90;
      return { year, value: earlyValue(year) };
    });
    const tail = Array.from({ length: 481 }, (_, index) => {
      const normalized = index / 480;
      const year = tailYear + (lastYear - tailYear) * normalized * normalized;
      return { year, value: tailValue(year) };
    });
    return early.concat(tail.slice(1));
  }

  function horizonChartData() {
    const orderedStates = [...baseStates].sort((left, right) => left.id - right.id);
    const horizons = horizonOptions.map(option => ({
      id: option.id,
      label: option.label,
      year: Number(option.targetYear)
    })).filter(option => Number.isFinite(option.year));
    const vectors = horizons.map(option => aggregateOf(
      Object.values(datasets[option.id]?.endStateRuns || {}),
      orderedStates
    ));
    const series = orderedStates.map((state, stateIndex) => ({
      ...state,
      points: horizons.map((horizon, horizonIndex) => ({
        ...horizon,
        value: vectors[horizonIndex]?.[stateIndex]
      }))
    })).filter(item => item.points.every(point => Number.isFinite(point.value)));
    series.forEach(item => { item.curve = sampleHorizonCurve(item.points); });
    return { horizons, series };
  }

  function horizonChartTickVisibility(selectedId) {
    if (!horizonChartLayout?.compact) return new Set(horizonChartDataCache.horizons.map(item => item.id));
    const first = horizonChartDataCache.horizons[0]?.id;
    const last = horizonChartDataCache.horizons.at(-1)?.id;
    const lastDated = horizonChartDataCache.horizons.at(-2)?.id;
    const middleSelection = selectedId !== first && selectedId !== lastDated && selectedId !== last;
    return new Set([first, middleSelection ? selectedId : lastDated, last].filter(Boolean));
  }

  function updateHorizonChartSelection() {
    if (!horizonChartLayout || !horizonChartDataCache) return;
    const selected = horizonChartDataCache.horizons.find(item => item.id === activeHorizon)
      || horizonChartDataCache.horizons.at(-1);
    if (!selected) return;
    const guide = $('#horizon-chart-svg .horizon-chart-guide');
    if (guide) {
      const x = horizonChartLayout.x(selected.year);
      guide.setAttribute('x1', x);
      guide.setAttribute('x2', x);
      guide.dataset.horizon = selected.id;
    }
    const visibleTicks = horizonChartTickVisibility(selected.id);
    $$('#horizon-chart-svg .horizon-chart-tick[data-horizon]').forEach(tick => {
      const on = tick.dataset.horizon === selected.id;
      tick.classList.toggle('is-selected', on);
      tick.style.display = visibleTicks.has(tick.dataset.horizon) ? '' : 'none';
    });
    const description = $('#horizon-chart-svg-desc');
    if (description) {
      description.textContent = `Eleven solid scenario-coloured curves connect lab-balanced mean probabilities for 2030, 2040, 2050, 2060, and 3000 on a log elapsed-time axis. ${selected.year} is selected on the page and marked by a vertical dashed guide. Curves are visual connectors, not intermediate forecasts.`;
    }
  }

  function updateHorizonChartVisibility() {
    if (!horizonChartDataCache) return;
    $$('#horizon-chart-svg [data-state]').forEach(node => {
      node.style.display = horizonChartActive.has(Number(node.dataset.state)) ? '' : 'none';
    });
    $$('#horizon-chart-legend .horizon-chart-legend-button[data-state]').forEach(button => {
      const on = horizonChartActive.has(Number(button.dataset.state));
      button.setAttribute('aria-pressed', String(on));
      button.setAttribute('aria-label', `${on ? 'Hide' : 'Show'} ${button.dataset.stateName}`);
    });
  }

  function hideHorizonChartTooltip() {
    const tooltip = $('#horizon-chart-tooltip');
    if (tooltip) tooltip.hidden = true;
    const hoverGuide = $('#horizon-chart-svg .horizon-chart-hover-guide');
    if (hoverGuide) hoverGuide.setAttribute('visibility', 'hidden');
    $$('#horizon-chart-svg .horizon-chart-hover-point').forEach(node => node.remove());
  }

  function showHorizonChartTooltip(event) {
    if (!horizonChartLayout || !horizonChartDataCache || !horizonChartActive.size) return;
    const svg = $('#horizon-chart-svg');
    const tooltip = $('#horizon-chart-tooltip');
    const bounds = svg.getBoundingClientRect();
    const svgX = (event.clientX - bounds.left) * horizonChartLayout.width / bounds.width;
    const nearest = horizonChartDataCache.horizons.reduce((best, horizon) =>
      Math.abs(horizonChartLayout.x(horizon.year) - svgX) < Math.abs(horizonChartLayout.x(best.year) - svgX)
        ? horizon : best
    );
    const horizonIndex = horizonChartDataCache.horizons.indexOf(nearest);
    const x = horizonChartLayout.x(nearest.year);
    const hoverGuide = svg.querySelector('.horizon-chart-hover-guide');
    hoverGuide.setAttribute('x1', x);
    hoverGuide.setAttribute('x2', x);
    hoverGuide.setAttribute('visibility', 'visible');
    $$('#horizon-chart-svg .horizon-chart-hover-point').forEach(node => node.remove());
    const markerLayer = svg.querySelector('.horizon-chart-hover-layer');
    const rows = horizonChartDataCache.series
      .filter(series => horizonChartActive.has(series.id))
      .map(series => ({ series, value: series.points[horizonIndex].value }))
      .sort((left, right) => right.value - left.value);
    rows.forEach(({ series, value }) => markerLayer.appendChild(svgNode('circle', {
      class: 'horizon-chart-hover-point',
      cx: x,
      cy: horizonChartLayout.y(value),
      r: 3,
      fill: series.color,
      'aria-hidden': 'true'
    })));
    tooltip.innerHTML = `<strong>${nearest.year}${nearest.id === 'long-term' ? ' · Long term' : ''}</strong>${rows.map(({ series, value }) => `
      <span class="horizon-chart-tooltip-row"><i style="--state:${series.color}"></i><span>${series.id}. ${esc(series.name)}</span><b>${aggregatePercent(value)}</b></span>`).join('')}`;
    tooltip.hidden = false;
    const plotBounds = tooltip.parentElement.getBoundingClientRect();
    const tooltipBounds = tooltip.getBoundingClientRect();
    let left = event.clientX - plotBounds.left + 14;
    let top = event.clientY - plotBounds.top + 14;
    if (left + tooltipBounds.width > plotBounds.width - 4) left -= tooltipBounds.width + 28;
    left = Math.max(4, Math.min(left, plotBounds.width - tooltipBounds.width - 4));
    top = Math.max(4, Math.min(top, plotBounds.height - tooltipBounds.height - 4));
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  }

  function renderHorizonChartLegend(series) {
    const legend = $('#horizon-chart-legend');
    legend.innerHTML = '';
    series.forEach(state => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'horizon-chart-legend-button';
      button.dataset.state = String(state.id);
      button.dataset.stateName = state.name;
      button.style.setProperty('--state', state.color);
      button.setAttribute('aria-pressed', String(horizonChartActive.has(state.id)));
      button.setAttribute('aria-label', `Hide ${state.name}`);
      button.innerHTML = `<span class="horizon-chart-legend-line" aria-hidden="true"></span><span>${state.id}. ${esc(state.name)}</span>`;
      button.addEventListener('click', () => {
        if (horizonChartActive.has(state.id)) horizonChartActive.delete(state.id);
        else horizonChartActive.add(state.id);
        horizonChartPinned = false;
        hideHorizonChartTooltip();
        updateHorizonChartVisibility();
      });
      legend.appendChild(button);
    });
  }

  function renderHorizonChartTable(data) {
    const table = $('#horizon-chart-table');
    table.innerHTML = `<table><caption>Lab-balanced mean scenario probabilities by forecast horizon.</caption><thead><tr><th>Scenario</th>${data.horizons.map(horizon => `<th>${horizon.year}</th>`).join('')}</tr></thead><tbody>${data.series.map(series => `<tr><th>${series.id}. ${esc(series.name)}</th>${series.points.map(point => `<td>${aggregatePercent(point.value)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function drawHorizonChart() {
    const host = $('#horizon-chart');
    const svg = $('#horizon-chart-svg');
    if (!host || !svg) return;
    const data = horizonChartData();
    horizonChartDataCache = data;
    const section = $('.horizon-chart-section');
    if (data.horizons.length < 3 || data.series.length !== baseStates.length) {
      section.hidden = true;
      return;
    }
    section.hidden = false;
    const measured = Math.max(320, Math.floor(svg.parentElement.getBoundingClientRect().width || 736));
    const compact = measured < 520;
    const height = compact ? 460 : 520;
    const margin = { top: 18, right: compact ? 13 : 18, bottom: compact ? 70 : 62, left: compact ? 54 : 66 };
    const plotLeft = margin.left + 5;
    const plotRight = measured - margin.right - 5;
    const plotTop = margin.top + 5;
    const plotBottom = height - margin.bottom - 5;
    const years = data.horizons.map(horizon => horizon.year);
    const firstYear = Math.min(...years);
    const logElapsed = year => Math.log1p((year - firstYear) / 10);
    const logMin = logElapsed(firstYear);
    const logMax = logElapsed(Math.max(...years));
    const x = year => plotLeft + (logElapsed(year) - logMin) / (logMax - logMin) * (plotRight - plotLeft);
    const allValues = data.series.flatMap(series => series.curve.map(point => point.value));
    const maximum = Math.max(...allValues);
    const yMax = Math.ceil((maximum * 1.04) / 5) * 5;
    const y = value => plotBottom - value / yMax * (plotBottom - plotTop);
    horizonChartLayout = { width: measured, height, compact, x, y, plotLeft, plotRight, plotTop, plotBottom };

    svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${measured} ${height}`);
    svg.appendChild(svgNode('title', { id: 'horizon-chart-svg-title' }, 'Mean scenario probabilities by horizon'));
    svg.appendChild(svgNode('desc', { id: 'horizon-chart-svg-desc' }));
    svg.appendChild(svgNode('rect', {
      class: 'horizon-chart-frame',
      x: margin.left,
      y: margin.top,
      width: measured - margin.left - margin.right,
      height: height - margin.top - margin.bottom
    }));

    const yTicks = Array.from({ length: Math.floor(yMax / 10) + 1 }, (_, index) => index * 10);
    yTicks.forEach(value => {
      const at = y(value);
      svg.appendChild(svgNode('line', { class: 'horizon-chart-grid', x1: margin.left, x2: measured - margin.right, y1: at, y2: at }));
      svg.appendChild(svgNode('text', { class: 'horizon-chart-label', x: margin.left - 9, y: at + 4, 'text-anchor': 'end' }, `${value}%`));
    });
    data.horizons.forEach(horizon => {
      const at = x(horizon.year);
      svg.appendChild(svgNode('line', { class: 'horizon-chart-axis', x1: at, x2: at, y1: plotBottom, y2: plotBottom + 5 }));
      svg.appendChild(svgNode('text', {
        class: 'horizon-chart-tick',
        'data-horizon': horizon.id,
        x: at,
        y: plotBottom + 20,
        'text-anchor': horizon === data.horizons[0] ? 'start' : horizon === data.horizons.at(-1) ? 'end' : 'middle'
      }, horizon.year));
    });
    svg.appendChild(svgNode('text', {
      class: 'horizon-chart-axis-title',
      x: (margin.left + measured - margin.right) / 2,
      y: height - 9,
      'text-anchor': 'middle'
    }, compact ? 'Forecast year · log scale' : 'Forecast year · log elapsed time after 2030 · 3000 is long term'));
    svg.appendChild(svgNode('text', {
      class: 'horizon-chart-axis-title',
      x: -(margin.top + (height - margin.top - margin.bottom) / 2),
      y: 14,
      transform: 'rotate(-90)',
      'text-anchor': 'middle'
    }, 'Lab-balanced mean probability (%)'));

    svg.appendChild(svgNode('line', {
      class: 'horizon-chart-guide',
      'data-horizon': activeHorizon,
      x1: 0,
      x2: 0,
      y1: plotTop,
      y2: plotBottom,
      'stroke-dasharray': '1 5',
      'aria-hidden': 'true'
    }));
    data.series.forEach(series => {
      const path = series.curve.map((point, index) => `${index ? 'L' : 'M'}${x(point.year).toFixed(2)},${y(point.value).toFixed(2)}`).join(' ');
      svg.appendChild(svgNode('path', {
        class: 'horizon-chart-series',
        'data-state': series.id,
        d: path,
        stroke: series.color,
        'aria-hidden': 'true'
      }));
      series.points.forEach(point => svg.appendChild(svgNode('circle', {
        class: 'horizon-chart-point',
        'data-state': series.id,
        'data-horizon': point.id,
        cx: x(point.year),
        cy: y(point.value),
        r: 1.8,
        fill: series.color,
        'aria-hidden': 'true'
      })));
    });
    svg.appendChild(svgNode('line', {
      class: 'horizon-chart-hover-guide',
      x1: 0,
      x2: 0,
      y1: plotTop,
      y2: plotBottom,
      visibility: 'hidden',
      'aria-hidden': 'true'
    }));
    svg.appendChild(svgNode('g', { class: 'horizon-chart-hover-layer', 'aria-hidden': 'true' }));
    const overlay = svgNode('rect', {
      class: 'horizon-chart-hit',
      x: plotLeft,
      y: plotTop,
      width: plotRight - plotLeft,
      height: plotBottom - plotTop,
      'aria-hidden': 'true'
    });
    overlay.addEventListener('pointermove', event => {
      if (!horizonChartPinned || event.pointerType === 'mouse') showHorizonChartTooltip(event);
    });
    overlay.addEventListener('pointerleave', () => {
      if (!horizonChartPinned) hideHorizonChartTooltip();
    });
    overlay.addEventListener('click', event => {
      horizonChartPinned = !horizonChartPinned;
      showHorizonChartTooltip(event);
    });
    svg.appendChild(overlay);

    renderHorizonChartLegend(data.series);
    renderHorizonChartTable(data);
    updateHorizonChartSelection();
    updateHorizonChartVisibility();
  }

  function renderHorizonChart() {
    drawHorizonChart();
    if (horizonChartObserver || !('ResizeObserver' in window)) return;
    horizonChartObserver = new ResizeObserver(records => {
      const width = Math.floor(records[0].contentRect.width);
      if (!horizonChartLayout || Math.abs(width - horizonChartLayout.width) >= 2) drawHorizonChart();
    });
    horizonChartObserver.observe($('#horizon-chart-svg').parentElement);
  }

  // The panel settles on its answer rather than simply having it: the name
  // riffles through the other ten endings and blurs, decelerating onto the one
  // that won, while the figure counts up to meet it.
  //
  // The DOM holds the final text before any of this starts, and a timer forces
  // it again at the end. Nothing here is load-bearing — a paused tab, a missed
  // frame or reduced motion all leave the answer on screen, which is the whole
  // requirement for an effect wrapped around a fact.
  let leaderSettled = false;
  let settleCancelled = false;
  function settleLeader(panel, leader) {
    if (leaderSettled || reduceMotion() || !('IntersectionObserver' in window)) return;
    leaderSettled = true;
    const nameEl = panel.querySelector('.leader-name');
    const figureEl = panel.querySelector('strong');
    if (!nameEl || !figureEl) return;

    const others = endingOrder().map(state => state.name).filter(name => name !== leader.name);
    const SPIN_MS = 1150;
    const land = () => {
      nameEl.textContent = leader.name;
      figureEl.textContent = aggregatePercent(leader.probability);
      nameEl.classList.remove('is-settling');
      figureEl.classList.remove('is-settling');
      nameEl.style.removeProperty('--blur');
      figureEl.style.removeProperty('--blur');
    };

    const run = () => {
      nameEl.classList.add('is-settling');
      figureEl.classList.add('is-settling');
      // Belt and braces against a tab that stops painting mid-spin.
      const failsafe = setTimeout(land, SPIN_MS + 400);
      const started = performance.now();
      const frame = now => {
        const t = Math.min((now - started) / SPIN_MS, 1);
        if (t >= 1) { clearTimeout(failsafe); land(); return; }
        const eased = 1 - Math.pow(1 - t, 3);          // fast, then slowing
        const blur = ((1 - eased) * 7).toFixed(2);
        nameEl.style.setProperty('--blur', `${blur}px`);
        figureEl.style.setProperty('--blur', `${blur}px`);
        nameEl.textContent = others[Math.floor(eased * others.length * 2.6) % others.length];
        figureEl.textContent = aggregatePercent(Math.max(1, leader.probability * (0.35 + eased * 0.65) + (1 - eased) * 9));
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver((records, observer) => {
      if (!records.some(r => r.isIntersecting)) return;
      observer.disconnect();
      if (settleCancelled) return;
      run();
    }, { threshold: 0.15 });
    io.observe(panel);
    // If it is never scrolled to, nothing needs to happen: the answer is
    // already the text on screen.
  }

  // The board's leader over time, replayed from the runs. Dates are when a
  // model was asked, not when it shipped: nothing here can say what a model
  // would have answered before it was put the question.
  const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const shortDate = iso => {
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${SHORT_MONTHS[m - 1]}`;
  };

  function leaderTimelineMarkup() {
    if (leaderHistory.length < 2) return '';
    const cohort = entry => `${entry.models} models${Number.isFinite(entry.labs) ? ` · ${entry.labs} labs` : ''}`;
    const cohortInSentence = entry => `${entry.models} models${Number.isFinite(entry.labs) ? ` across ${entry.labs} labs` : ''}`;
    const rows = leaderHistory.map(entry => {
      const state = states.find(candidate => candidate.id === entry.stateId);
      return `<li${entry.changed ? ' class="is-change"' : ''}>
          <span class="tl-date">${esc(shortDate(entry.date))}</span>
          <span class="tl-name" style="--state:${state?.color}">${esc(state?.name)}${state ? extinctionMark(state) : ''}</span>
          <span class="tl-share">${aggregatePercent(entry.share)}</span>
          <span class="tl-models">${esc(cohort(entry))}</span>
        </li>`;
    }).join('');
    const changes = leaderHistory.filter(e => e.changed);
    const last = changes.at(-1);
    // Say what moved it. A leader changes when the board gains models far more
    // often than because a model revised its own answer, and the two read
    // identically unless the count is on the page.
    const note = changes.length > 1 && last
      ? `It changed on ${esc(shortDate(last.date))}, when the board went from ${esc(cohortInSentence(leaderHistory[leaderHistory.indexOf(last) - 1]))} to ${esc(cohortInSentence(last))}.`
      : 'It has led on every date the board has been asked.';
    return `<div class="leader-timeline">
      <h3>How this has moved</h3>
      <ol>${rows}</ol>
      <p>${note}</p>
    </div>`;
  }

  // How many models put this ending at the top of their own allocation, and
  // how many put it second. A rank, not a share: it shows how broadly models
  // support the lab-balanced result.
  function supportFor(stateId) {
    const runList = Object.values(endStateRuns);
    const rankIn = run => {
      const value = run.probabilities[stateId];
      return 1 + endingOrder().filter(other => run.probabilities[other.id] > value).length;
    };
    const ranks = runList.map(rankIn);
    const rows = runList.map(run => {
      const band = run.range?.[stateId];
      return {
        label: run.label, provider: run.provider, value: run.probabilities[stateId],
        // How far that model's own samples moved. Infinity for a run with no
        // recorded spread, so it never wins a tie-break it cannot justify.
        spread: band ? band[1] - band[0] : Infinity
      };
    });
    const values = rows.map(r => r.value);
    // Two models often land on the same figure. The tie goes to whichever said
    // it most consistently — the narrower sample range — rather than to
    // whichever the roster happens to list first.
    const pick = value => rows.filter(r => r.value === value).sort((a, b) => a.spread - b.spread)[0];
    return {
      first: ranks.filter(r => r === 1).length,
      second: ranks.filter(r => r === 2).length,
      top: pick(Math.max(...values)), bottom: pick(Math.min(...values))
    };
  }

  function forecastEntries() {
    return Object.entries(endStateRuns).map(([runKey, source]) => ({
      runKey,
      provider: source.provider || runKey,
      probabilities: source.probabilities,
      rationales: source.rationales,
      promptVersion: source.promptVersion,
      sampleCount: source.sampleCount,
      range: source.range,
      exposure: source.exposure,
      exposurePublished: source.exposurePublished,
      date: source.date,
      model: source.model || source.provider || runKey,
      label: source.label || source.model || source.provider || runKey,
      shortLabel: source.shortLabel || (source.provider || runKey).slice(0, 2).toUpperCase()
    }));
  }

  function selectedEndStates() {
    if (activeEndForecast !== AGGREGATE_KEY && endStateRuns[activeEndForecast]) {
      return endingOrder().map(state => ({ ...state, probability: stateValue(endStateRuns[activeEndForecast], state) }));
    }
    activeEndForecast = AGGREGATE_KEY;
    return stateAggregate();
  }

  // Lab marks, monochrome, so model identity is carried by shape rather than
  // colour — colour belongs to the endings. Geometry is the official mark from
  // each lab's icon (simple-icons; xAI from lobehub), normalised to a 24x24 box
  // and inheriting currentColor. Only path data is embedded, never third-party
  // markup. Trademarks belong to their owners; used here to identify each lab's
  // models in a comparison.
  const LAB_LOGOS = {
    Anthropic: '<path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z"/>',
    OpenAI: '<path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>',
    Google: '<path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>',
    xAI: '<path fill-rule=\"evenodd\" d="M6.469 8.776L16.512 23h-4.464L2.005 8.776H6.47zm-.004 7.9l2.233 3.164L6.467 23H2l4.465-6.324zM22 2.582V23h-3.659V7.764L22 2.582zM22 1l-9.952 14.095-2.233-3.163L17.533 1H22z"/>',
    Meta: '<path d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z"/>',
    DeepSeek: '<path d="M23.748 4.651c-.254-.124-.364.113-.512.233-.051.04-.094.09-.137.137-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.155-.708-.311-.955-.65-.172-.24-.219-.509-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.094.172.187.129.323-.082.28-.18.553-.266.833-.055.179-.137.218-.328.14a5.5 5.5 0 0 1-1.737-1.179c-.857-.828-1.631-1.743-2.597-2.46a12 12 0 0 0-.689-.47c-.985-.957.13-1.743.387-1.836.27-.098.094-.433-.778-.428-.872.003-1.67.295-2.687.685a3 3 0 0 1-.465.136 9.6 9.6 0 0 0-2.883-.101c-1.885.21-3.39 1.1-4.497 2.622C.082 8.776-.231 10.854.152 13.02c.403 2.284 1.568 4.175 3.36 5.653 1.857 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.132-.284 4.994-1.86.47.234.962.328 1.78.398.629.058 1.235-.031 1.705-.129.735-.155.684-.836.418-.961-2.155-1.004-1.682-.595-2.112-.926 1.095-1.295 2.768-3.598 3.284-6.733.05-.346.115-.834.108-1.114-.004-.171.035-.238.23-.257a4.2 4.2 0 0 0 1.545-.475c1.397-.763 1.96-2.016 2.093-3.517.02-.23-.004-.467-.247-.588M11.58 18.168c-2.088-1.642-3.101-2.183-3.52-2.16-.39.024-.32.472-.234.763.09.288.207.487.371.74.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.168-1.361-.801-2.5-1.86-3.301-3.306-.775-1.393-1.225-2.888-1.299-4.482-.02-.385.094-.522.477-.592a4.7 4.7 0 0 1 1.53-.038c2.131.311 3.946 1.264 5.467 2.774.868.86 1.525 1.887 2.202 2.89.72 1.066 1.494 2.082 2.48 2.915.348.291.626.513.892.677-.802.09-2.14.109-3.055-.615zm1.001-6.44a.306.306 0 0 1 .415-.287.3.3 0 0 1 .113.074.3.3 0 0 1 .086.214c0 .17-.136.307-.308.307a.303.303 0 0 1-.306-.307m3.11 1.596c-.2.081-.4.151-.591.16a1.25 1.25 0 0 1-.798-.254c-.274-.23-.47-.358-.551-.758a1.7 1.7 0 0 1 .015-.588c.07-.327-.007-.537-.238-.727-.188-.156-.426-.199-.689-.199a.6.6 0 0 1-.254-.078.253.253 0 0 1-.114-.358 1 1 0 0 1 .192-.21c.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.392.451.462.576.685.915.176.264.336.536.446.848.066.194-.02.353-.25.45"/>',
    Mistral: '<path d="M17.143 3.429v3.428h-3.429v3.429h-3.428V6.857H6.857V3.43H3.43v13.714H0v3.428h10.286v-3.428H6.857v-3.429h3.429v3.429h3.429v-3.429h3.428v3.429h-3.428v3.428H24v-3.428h-3.43V3.429z"/>',
    Moonshot: '<path d="m1.053 16.91 9.538 2.55a21 20.981 0 0 0 .06 2.031l5.956 1.592a12 11.99 0 0 1-15.554-6.172m-1.02-5.79 11.352 3.035a21 20.981 0 0 0-.469 2.01l10.817 2.89a12 11.99 0 0 1-1.845 2.004L.658 15.918a12 11.99 0 0 1-.625-4.796m1.593-5.146L13.573 9.17a21 20.981 0 0 0-1.01 1.874l11.297 3.02a21 20.981 0 0 1-.67 2.362l-11.55-3.087L.125 10.26a12 11.99 0 0 1 1.499-4.285ZM6.067 1.58l11.285 3.016a21 20.981 0 0 0-1.688 1.719l7.824 2.091a21 20.981 0 0 1 .513 2.664L2.107 5.218a12 11.99 0 0 1 3.96-3.638M21.68 4.866 7.222 1.003A12 11.99 0 0 1 21.68 4.866"/>',
  };
  const labLogo = (provider, cls = '') =>
    `<span class="lab-logo ${cls}" role="img" aria-label="${esc(provider)}">${LAB_LOGOS[provider]
      ? `<svg viewBox="0 0 24 24" aria-hidden="true">${LAB_LOGOS[provider]}</svg>`
      : `<b>${esc(provider.slice(0, 2))}</b>`}</span>`;

  const promptForHorizon = {
    'long-term': 'end_states.md',
    '2030': 'end_states_2030.md',
    '2040': 'end_states_2040.md',
    '2050': 'end_states_2050.md',
    '2060': 'end_states_2060.md'
  };

  function renderHorizonContext() {
    const active = horizonMeta();
    const toggle = $('#horizon-toggle');
    if (toggle) {
      // These controls are the one part of the changing view that should stay
      // physically put. Build them once so a click does not discard the
      // focused element, then only update their selected state.
      if (!toggle.children.length) {
        toggle.innerHTML = horizonOptions.map(option =>
          `<button type="button" class="horizon-button" data-horizon="${esc(option.id)}" aria-pressed="false">${esc(option.label)}</button>`
        ).join('');
      }
      [...toggle.querySelectorAll('.horizon-button[data-horizon]')].forEach(button => {
        const on = button.dataset.horizon === activeHorizon;
        button.classList.toggle('active', on);
        button.setAttribute('aria-pressed', String(on));
      });
    }

    const note = $('#horizon-note');
    if (note) {
      note.textContent = active.id === 'long-term'
        ? `Durable arrangement by the year ${active.targetYear || 3000}`
        : `Snapshot at the end of ${active.targetYear || active.label}; it need not yet be durable.`;
    }

    const promptLink = $('#method-prompt-link');
    if (promptLink) {
      promptLink.href = promptForHorizon[active.id] || promptForHorizon['long-term'];
      promptLink.innerHTML = `Read the ${active.id === 'long-term' ? 'long-term' : esc(active.label)} prompt <span aria-hidden="true">↗</span>`;
    }

    const ending = outcomeTerm(false);
    const endings = outcomeTerm(true);
    $('#end-forecast-toggle')?.setAttribute('aria-label', `Select ${stateTerm(false)} forecast view`);
    const forecastNote = $('#forecast-note');
    if (forecastNote) forecastNote.textContent = `Select a model to see its allocation. Tap any segment to jump to that ${ending}.`;
    const statesTitle = $('#states-title');
    if (statesTitle) statesTitle.innerHTML = `Eleven <em>${esc(endings)}</em>`;
    const statesNote = $('#states-note');
    if (statesNote) statesNote.textContent = `Select any ${ending} to read every model's reasoning for its number.`;
    const matrixNote = $('#matrix-note');
    if (matrixNote) matrixNote.textContent = `Every model's number for every ${ending}, grouped by lab. Read one column for a single model's theory of the future, or one row to see where the labs disagree.`;
    const exposureNote = $('#exposure-note');
    if (exposureNote) exposureNote.textContent = `Each model's total across the ${endings} where humanity is gone (1–3) or might perish (4–5).`;
    updateHorizonChartSelection();
  }

  function renderEndForecastToggle(entries) {
    const options = [{ key: AGGREGATE_KEY, label: 'Lab-balanced mean' }, ...entries.map(entry => ({ key: entry.runKey, label: entry.label, provider: entry.provider }))];
    $('#end-forecast-toggle').innerHTML = options.map(option =>
      `<button type="button" class="end-toggle-button${option.provider ? '' : ' is-aggregate'}${option.key === activeEndForecast ? ' active' : ''}" data-end-forecast="${esc(option.key)}" aria-pressed="${option.key === activeEndForecast}">${option.provider ? labLogo(option.provider) : ''}${esc(option.label)}</button>`
    ).join('');
  }

  // Cell intensity is the state's own hue at an alpha proportional to the
  // value, so a row reads as a gradient across models. Scaled against the
  // largest value on the board rather than 100, since nothing approaches 100.
  function renderMatrix(entries, orderedStates) {
    $('#matrix').setAttribute('role', 'table');
    $('#matrix').setAttribute('aria-label', `${horizonMeta().label} probability by ${stateTerm(false)} and model`);
    const peak = Math.max(...orderedStates.flatMap(state => entries.map(entry => stateValue(entry, state))), 1);
    const labs = [];
    entries.forEach(entry => {
      const last = labs.at(-1);
      if (last && last.provider === entry.provider) last.models.push(entry);
      else labs.push({ provider: entry.provider, models: [entry] });
    });

    const head = `
      <div class="matrix-row matrix-head" role="row">
        <div class="matrix-corner" role="columnheader"></div>
        ${labs.map(lab => `<div class="matrix-lab" style="--span:${lab.models.length}" role="columnheader" aria-colspan="${lab.models.length}" title="${esc(lab.provider)}">${labLogo(lab.provider)}</div>`).join('')}
      </div>
      <div class="matrix-row matrix-subhead" role="row">
        <div class="matrix-corner" role="columnheader"></div>
        ${entries.map((entry, col) => `<div class="matrix-model" role="columnheader" title="${esc(entry.label)}" style="--c:${col}"><span>${esc(entry.shortLabel)}</span></div>`).join('')}
      </div>`;

    const rows = orderedStates.map((state, row) => `
      <div class="matrix-row" role="row" data-state="${state.id}">
        <div class="matrix-rowheader" role="rowheader">
          <button class="matrix-state" type="button" data-state="${state.id}" style="--state:${state.color}" aria-label="${esc(state.name)} — see each model's reasoning">
            <i></i><span class="matrix-state-name">${state.id}. ${esc(state.name)}</span>${extinctionMark(state)}
          </button>
        </div>
        ${entries.map((entry, col) => {
          const value = stateValue(entry, state);
          const spread = entry.range?.[state.id];
          return `<div class="matrix-cell" role="cell" title="${esc(entry.label)} · ${esc(state.name)}: ${value}%${spread ? ` (${spread[0]}–${spread[1]}% across ${entry.sampleCount} samples)` : ''}" style="--state:${state.color};--fill:${Math.max(value / peak, 0.04).toFixed(3)};--r:${row};--c:${col}"><span>${value}</span></div>`;
        }).join('')}
      </div>`).join('');

    $('#matrix').style.setProperty('--cols', entries.length);
    $('#matrix').innerHTML = head + rows;
  }

  function renderHeroStats(entries) {
    const labs = new Set(entries.map(entry => entry.provider));
    const samples = [...new Set(entries.map(entry => entry.sampleCount).filter(Boolean))];
    const summary = $('#forecast-summary');
    if (summary) {
      summary.innerHTML = entries.length
        ? `We asked <b id="dek-models">${entries.length}</b> of the leading AI models from <b id="dek-labs">${labs.size}</b> labs to assign 100 percentage points across 11 mutually exclusive ${esc(stateTerm(true))} for humanity&rsquo;s relationship with AI.`
        : `${esc(horizonMeta().label)} forecasts are being collected. They will use the same 11-state taxonomy and 100-point allocation as every other horizon.`;
    }
    const methodSamples = $('#method-samples');
    if (methodSamples) methodSamples.textContent = !samples.length ? '—' : samples.length === 1 ? samples[0] : `${Math.min(...samples)}–${Math.max(...samples)}`;
    const errors = entries.map(entry => entry.exposurePublished?.se).filter(Number.isFinite);
    const threshold = $('#method-threshold');
    if (threshold && errors.length) {
      const pooled = Math.sqrt(errors.reduce((sum, se) => sum + se * se, 0) / errors.length);
      threshold.textContent = (2.78 * pooled).toFixed(1);
    } else if (threshold) threshold.textContent = '—';

    const roster = $('#footer-roster');
    if (roster) roster.textContent = `${entries.length} models across ${labs.size} labs`;
    const date = $('#dataset-date');
    if (date) date.textContent = datasetDate || 'Awaiting data';
  }

  let axisMax = 40;
  const MOTION_MS = 500;
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Count a figure from where it is to where it lands, matching the target's
  // requested precision so a lab-balanced 13.5 does not render as 14
  // mid-flight. rAF is
  // paused in a hidden tab, so a timer guarantees the value still lands, and a
  // token drops stale tweens when a selection changes mid-flight.
  const tweenTimers = new WeakMap();
  const tweenTokens = new WeakMap();
  function tweenNumber(el, to, suffix = '%', digits = Number.isInteger(to) ? 0 : 1) {
    const from = parseFloat(el.textContent);
    const land = () => { el.textContent = Number(to).toFixed(digits) + suffix; };
    clearTimeout(tweenTimers.get(el));
    const token = {};
    tweenTokens.set(el, token);
    if (reduceMotion() || !Number.isFinite(from) || from === to) return land();
    const started = performance.now();
    const step = now => {
      if (tweenTokens.get(el) !== token) return;
      const t = Math.min((now - started) / MOTION_MS, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = (from + (to - from) * eased).toFixed(digits) + suffix;
      if (t < 1) requestAnimationFrame(step); else land();
    };
    requestAnimationFrame(step);
    tweenTimers.set(el, setTimeout(() => { if (tweenTokens.get(el) === token) land(); }, MOTION_MS + 80));
  }

  // Structure is built once. Selecting a model then rewrites values in place —
  // rebuilding the markup would restart every element at its final state and
  // there would be nothing for a transition to animate between.
  // px per percentage point in the card chips. Chosen so the largest value or
  // sample maximum on the board still fits the 46px track.
  const SCALE = 1.6;

  const emptyMessage = () => `${horizonMeta().label} forecasts are being collected.`;

  function renderEmptyDataset() {
    const horizon = horizonMeta();
    const heading = horizon.id === 'long-term'
      ? 'Most likely <em>ending</em>'
      : `Most likely in <em>${esc(horizon.targetYear || horizon.label)}</em>`;
    activeEndForecast = AGGREGATE_KEY;
    axisMax = 40;
    renderEndForecastToggle([]);
    $('#end-forecast-title').innerHTML = `${esc(horizonMeta().label)} <em>forecast</em>`;
    $('#consensus-bar').classList.remove('is-animating');
    $('#consensus-bar').classList.add('is-empty');
    $('#consensus-bar').removeAttribute('aria-label');
    $('#consensus-bar').innerHTML = `<p class="data-empty" role="status">${esc(emptyMessage())}</p>`;
    $('#consensus-legend').innerHTML = '';
    $('#state-grid').innerHTML = `<p class="data-empty" role="status">${esc(emptyMessage())}</p>`;
    const matrix = $('#matrix');
    matrix.removeAttribute('role');
    matrix.removeAttribute('aria-label');
    matrix.innerHTML = `<p class="data-empty" role="status">${esc(emptyMessage())}</p>`;
    $('#doomer-ratings').innerHTML = `<p class="data-empty" role="status">${esc(emptyMessage())}</p>`;
    $('#end-leader').removeAttribute('data-leader');
    $('#end-leader').removeAttribute('data-leader-value');
    $('#end-leader').removeAttribute('data-rendered-horizon');
    $('#end-leader').innerHTML = `<h2 class="leader-title" id="leader-title">${heading}</h2><p class="data-empty" role="status">${esc(emptyMessage())}</p>`;
  }

  function renderEndStates() {
    const entries = forecastEntries();
    const orderedStates = endingOrder();
    renderHorizonContext();
    renderHeroStats(entries);
    if (!entries.length) {
      renderEmptyDataset();
      return;
    }
    renderEndForecastToggle(entries);

    // The visible glyph is just the ending's number, so the name and the
    // current share go in an aria-label, refreshed per selection below.
    $('#consensus-bar').classList.remove('is-empty');
    $('#consensus-bar').innerHTML = orderedStates.map(state =>
      `<button type="button" style="--state:${state.color}" data-state-jump="${state.id}"><span>${state.id}</span></button>`).join('');
    $('#consensus-legend').innerHTML = orderedStates.map(state =>
      `<button data-state-jump="${state.id}"><i style="--state:${state.color}"></i><span>${state.id}. ${esc(state.name)}${extinctionMark(state)}</span><b></b></button>`).join('');

    // Fixed for every ending: zero to the highest figure any one sample from
    // any model produced, so a position means the same thing on every card.
    axisMax = Math.max(...orderedStates.flatMap(state =>
      entries.map(entry => entry.range?.[state.id]?.[1] ?? stateValue(entry, state))));

    $('#state-grid').innerHTML = orderedStates.map(state => {
      const providerValues = entries.map(entry => ({ ...entry, value: stateValue(entry, state) })).sort((a, b) => b.value - a.value);
      return `<article class="state-card" id="state-${state.id}" style="--state:${state.color}" data-state="${state.id}" tabindex="0" role="button">
        <div class="state-card-head"><span>${String(state.id).padStart(2, '0')}</span><h3>${esc(state.name)}</h3><div class="state-card-meta"><strong></strong>${extinctionMark(state)}</div></div>
        <p>${esc(state.description)}</p>
        <div class="state-strip">
          <div class="strip-axis">
            ${[10, 20, 30, 40, 50].filter(t => t < axisMax - 2).map(t => `<u style="left:${((t / axisMax) * 100).toFixed(2)}%"></u>`).join('')}
            <i class="strip-range"></i>
            <i class="strip-iqr"></i>
            <b class="strip-mid"><span></span></b>
          </div>
          <div class="strip-scale">
            <span>0%</span>
            ${[10, 20, 30, 40, 50].filter(t => t < axisMax - 2).map(t => `<span style="left:${((t / axisMax) * 100).toFixed(2)}%">${t}</span>`).join('')}
            <span class="strip-end">${axisMax}%</span>
          </div>
        </div>
        <div class="state-range"><span class="range-text"></span><em class="state-more">Why ↗</em></div>
      </article>`;
    }).join('');

    renderMatrix(entries, orderedStates);
    renderDoomer(entries);
    applyForecast({ animate: false });
  }

  function renderDoomer(entries) {
    const doomerEntries = entries
      .map(entry => ({ ...entry, sums: extinctionSums(entry) }))
      .sort((a, b) => b.sums.total - a.sums.total);

    const exposureStates = endingOrder().filter(state => state.extinction);

    $('#doomer-ratings').innerHTML = `
      <div class="doomer-head">
        <p class="doomer-key"><span class="key-gone"><i></i>Humanity is gone (1–3)</span><span class="key-risk"><i></i>Might perish (4–5)</span><span class="key-hint"><span class="on-hover">Hover a bar for the ${outcomeTerm(true)} inside it</span><span class="on-tap">Tap a bar for the ${outcomeTerm(true)} inside it</span></span></p>
      </div>
      <div class="doomer-list">
        ${doomerEntries.map((entry, index) => {
          const total = entry.sums.total;
          const parts = exposureStates.map(state => ({ state, value: stateValue(entry, state) }));
          // The visual breakdown is collapsed by default, so the same values
          // go in the interactive row's name for non-visual readers.
          const spoken = parts.map(({ state, value }) => `${esc(state.name)} ${value}%`).join(', ');
          const readoutId = `doomer-readout-${index}`;
          return `<div class="doomer-row" data-run-key="${esc(entry.runKey)}" style="--r:${index}" role="button" tabindex="0" aria-expanded="false" aria-controls="${readoutId}" aria-label="${esc(entry.label)}: ${entry.sums.gone}% humanity is gone, ${entry.sums.risk}% might perish. ${spoken}. Activate to show or hide the five ${outcomeTerm(false)} values.">
          <div class="doomer-label">${labLogo(entry.provider, 'in-row')}<b>${esc(entry.label)}</b><small>${esc(entry.provider)}</small></div>
          <div class="doomer-meter">
            <div class="doomer-bar" role="img" aria-label="${esc(entry.label)}: ${entry.sums.gone}% humanity is gone, ${entry.sums.risk}% might perish. ${spoken}">
              <div class="doomer-stack">${
                parts.filter(({ value }) => value > 0)
                  .map(({ state, value }) => `<i style="width:${value}%;background:${state.color}" title="${state.id}. ${esc(state.name)}: ${value}%"></i>`).join('')
              }</div>
              <div class="doomer-tiers">${
                [['gone', entry.sums.gone], ['risk', entry.sums.risk]]
                  .filter(([, value]) => value > 0)
                  .map(([tier, value]) => `<i class="${tier}" style="width:${value}%"><span>${value}%</span></i>`).join('')
              }</div>
            </div>
            <div class="doomer-readout" id="${readoutId}">${
              parts.map(({ state, value }) => `<span><i style="background:${state.color}"></i>${state.id}. ${esc(state.name)} <b>${value}%</b></span>`).join('')
            }</div>
          </div>
          <div class="doomer-total"><b>${total}%</b></div>
        </div>`;
        }).join('')}
      </div>
`;
    requestAnimationFrame(fitDoomerTierLabels);
  }

  // A percentage belongs inside a tier only when its complete text fits.
  // Recheck after every horizon render and viewport change because the same
  // value has very different room on a phone and a desktop.
  function fitDoomerTierLabels() {
    $$('.doomer-tiers > i').forEach(tier => {
      const label = tier.querySelector('span');
      if (!label) return;
      const needed = label.getBoundingClientRect().width + 2;
      tier.classList.toggle('is-label-hidden', needed > tier.clientWidth);
    });
  }

  function setExposureOpen(row, open) {
    row.classList.toggle('is-open', open);
    row.setAttribute('aria-expanded', String(open));
  }

  function toggleExposureRow(row) {
    const open = row.getAttribute('aria-expanded') !== 'true';
    $$('.doomer-row.is-open').forEach(other => setExposureOpen(other, false));
    setExposureOpen(row, open);
  }

  function applyForecast({ animate }) {
    const activeRun = endStateRuns[activeEndForecast];
    const showingAggregate = !activeRun;
    const horizon = horizonMeta();
    const horizonLabel = horizon.id === 'long-term' ? 'Long-term' : horizon.label;
    const activeLabel = activeRun
      ? `${activeRun.label || activeEndForecast} · ${horizonLabel} forecast`
      : `${horizonLabel} lab-balanced mean`;
    const words = activeLabel.split(' ');
    const trailing = words.pop();
    $('#end-forecast-title').innerHTML = words.length
      ? `${esc(words.join(' '))} <em>${esc(trailing)}</em>`
      : `<em>${esc(trailing)}</em>`;

    const selectedStates = selectedEndStates();
    const entriesForRange = forecastEntries();
    const total = selectedStates.reduce((sum, state) => sum + state.probability, 0);
    const bar = $('#consensus-bar');
    const legend = $('#consensus-legend');
    bar.setAttribute('aria-label', `${activeRun ? activeRun.label : 'Lab-balanced mean'} probability by ${stateTerm(false)} for ${horizon.label}`);
    bar.classList.toggle('is-animating', Boolean(animate) && !reduceMotion());

    // The selector governs this one chart. The bar and its legend follow it.
    selectedStates.forEach((state, index) => {
      const segment = bar.children[index];
      segment.style.width = `${(state.probability / total) * 100}%`;
      const spread = activeRun?.range?.[state.id];
      const displayed = showingAggregate ? aggregatePercent(state.probability) : `${state.probability}%`;
      segment.title = `${state.name}: ${displayed}${spread ? ` (${spread[0]}–${spread[1]}% across samples)` : ''}${state.extinction ? ` · ${extinctionLabels[state.extinction]}` : ''}`;
      segment.setAttribute('aria-label', `${state.name}: ${displayed} — jump to this ${outcomeTerm(false)}`);

      const value = legend.children[index].querySelector('b');
      animate ? tweenNumber(value, state.probability, '%', showingAggregate ? 1 : undefined) : (value.textContent = displayed);
    });

    // The ending cards do not. They are the board's account of each ending —
    // the lab-balanced mean and the spread between models — and a selection
    // made in the chart above should not quietly rewrite eleven other panels.
    stateAggregate().forEach(state => {
      const card = $(`#state-${state.id}`);
      if (!card) return;

      // Band, middle half, tick and caption all describe the same thing: the
      // spread across models.
      const across = entriesForRange.map(entry => stateValue(entry, state)).sort((a, b) => a - b);
      const quantile = f => { const i = (across.length - 1) * f, lo = Math.floor(i), hi = Math.ceil(i);
                              return across[lo] + (across[hi] - across[lo]) * (i - lo); };
      const band = { lo: across[0], hi: across.at(-1), q1: quantile(0.25), q3: quantile(0.75),
        caption: `${across[0]}–${across.at(-1)}% across ${across.length} models`,
        detail: `${across[0]}–${across.at(-1)}% across ${across.length} models · middle half ${quantile(0.25).toFixed(0)}–${quantile(0.75).toFixed(0)}%` };

      const pct = v => (v / axisMax) * 100;
      const origin = (v, from, to) => to === from ? '50%' : `${(((v - from) / (to - from)) * 100).toFixed(2)}%`;
      const axis = card.querySelector('.strip-axis');
      const rangeEl = card.querySelector('.strip-range');
      const iqrEl = card.querySelector('.strip-iqr');
      // A band whose ends coincide draws at zero width and disappears, which
      // reads as a broken chart rather than as the thing it means: every
      // sample landed on the same figure. Both bands take the same minimum,
      // centred on the value, so the tick sits within its band rather than on
      // the edge of a band that is not there.
      const floor = axisMax * 0.012;
      const placeBand = (el, lo, hi) => {
        if (!Number.isFinite(lo) || !Number.isFinite(hi)) { el.hidden = true; return; }
        const mid = (lo + hi) / 2;
        const half = Math.max((hi - lo) / 2, floor / 2);
        const from = Math.max(mid - half, 0);
        const to = Math.min(mid + half, axisMax);
        el.style.left = `${pct(from).toFixed(2)}%`;
        el.style.width = `${(pct(to) - pct(from)).toFixed(2)}%`;
        el.style.setProperty('--origin', origin(state.probability, from, to));
        el.hidden = false;
      };
      placeBand(rangeEl, band.lo, band.hi);
      placeBand(iqrEl, band.q1, band.q3);
      axis.title = band.detail;
      card.querySelector('.range-text').textContent = band.caption;

      const tick = card.querySelector('.strip-mid');
      if (tick) {
        const at = pct(state.probability);
        tick.style.left = `${at.toFixed(2)}%`;
        tick.querySelector('span').textContent = aggregatePercent(state.probability);
        // Near either end the centred label would hang off the card, so it
        // anchors to the tick instead.
        tick.classList.toggle('at-start', at < 9);
        tick.classList.toggle('at-end', at > 91);
      }

      const figure = card.querySelector('.state-card-meta strong');
      animate ? tweenNumber(figure, state.probability, '%', 1) : (figure.textContent = aggregatePercent(state.probability));
      card.setAttribute('aria-label', `${state.name}: ${aggregatePercent(state.probability)} — see each model's reasoning`);
    });

    // Always the lab-balanced mean, never the selected model: this panel states
    // the board's answer, and tying it to the selector would turn one model's
    // opinion into the headline as the reader browsed.
    const leader = [...stateAggregate()].sort((a, b) => b.probability - a.probability)[0];
    const leaderEl = $('#end-leader');
    const paint = () => {
      const support = supportFor(leader.id);
      const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
      const heading = horizon.id === 'long-term'
        ? 'Most likely <em>ending</em>'
        : `Most likely in <em>${esc(horizon.targetYear || horizon.label)}</em>`;
      const modelCount = Object.keys(endStateRuns).length;
      const labCount = runsByLab(Object.values(endStateRuns)).length;
      leaderEl.innerHTML = `<h2 class="leader-title" id="leader-title">${heading}</h2><div class="leader-answer"><p class="leader-name">${esc(leader.name)}</p><strong>${aggregatePercent(leader.probability)}</strong><span class="leader-unit">Lab-balanced mean across ${plural(labCount, 'lab')} (${plural(modelCount, 'model')}) &middot; ${esc(horizon.label)} &middot; of 100 points</span>${leaderTimelineMarkup()}</div><div class="leader-detail"><p class="leader-description">${esc(leader.description)}</p><p class="leader-method">${plural(support.first, 'model')} picked this as their highest-weighted prediction, and ${support.second} more had it as their second. ${esc(support.top.label)} from ${esc(support.top.provider)} put the most weight on it, at ${support.top.value}%; ${esc(support.bottom.label)} from ${esc(support.bottom.provider)} the least, at ${support.bottom.value}%.</p></div>`;
    };
    // Selecting a model no longer moves this panel, so there is nothing to
    // animate: without this it would re-tween the same figure on every click.
    if (leaderEl.dataset.renderedHorizon === activeHorizon && Number(leaderEl.dataset.leader) === leader.id && leaderEl.dataset.leaderValue === String(leader.probability)) return;
    leaderEl.dataset.leaderValue = String(leader.probability);
    leaderEl.dataset.renderedHorizon = activeHorizon;
    const announce = () => settleLeader(leaderEl, leader);
    // The leader can become a different ending entirely, so it crossfades
    // rather than counting between two unrelated states.
    if (!animate || reduceMotion() || Number(leaderEl.dataset.leader) === leader.id) {
      const previous = leaderEl.querySelector('strong');
      if (animate && !reduceMotion() && previous && Number(leaderEl.dataset.leader) === leader.id) {
        tweenNumber(previous, leader.probability, '%', 1);
      } else paint();
    } else {
      leaderEl.classList.add('is-swapping');
      clearTimeout(leaderEl._swap);
      leaderEl._swap = setTimeout(() => { paint(); leaderEl.classList.remove('is-swapping'); }, MOTION_MS * 0.4);
    }
    leaderEl.dataset.leader = leader.id;
    announce();
  }

  function openState(id) {
    const state = states.find(item => item.id === Number(id));
    if (!state) return;
    const horizon = horizonMeta();
    const entries = forecastEntries()
      .map(entry => ({ ...entry, value: stateValue(entry, state) }))
      .sort((a, b) => b.value - a.value);
    const consensus = stateAggregate().find(candidate => candidate.id === state.id)?.probability ?? 0;
    // Same ruler as the cards, so a position carries over from the page.
    const pos = v => (v / axisMax) * 100;
    const ticks = [10, 20, 30, 40, 50].filter(t => t < axisMax - 2);
    const gridlines = ticks.map(t => `<u style="left:${pos(t)}%"></u>`).join('');
    const rows = entries.map(entry => `
      <article class="model-answer">
        <div class="model-answer-head">
          ${labLogo(entry.provider, 'in-row')}
          <div><b>${esc(entry.label)}</b><small>${esc(entry.provider)} · ${esc(entry.date || '')}</small></div>
          <strong>${entry.value}%</strong>
        </div>
        <div class="answer-plot">
          <div class="answer-track">
            ${gridlines}
            ${entry.range?.[state.id] ? `<i class="strip-range" style="left:${pos(entry.range[state.id][0]).toFixed(2)}%;width:${(pos(entry.range[state.id][1]) - pos(entry.range[state.id][0])).toFixed(2)}%"></i>` : ''}
            <b class="strip-mid" style="left:${pos(entry.value).toFixed(2)}%"></b>
          </div>
          <div class="answer-axis">
            <span>0%</span>
            ${ticks.map(t => `<span style="left:${pos(t)}%">${t}</span>`).join('')}
            <span class="strip-end">${axisMax}%</span>
          </div>
          <span class="answer-range">${entry.range?.[state.id] ? `${entry.range[state.id][0]}–${entry.range[state.id][1]}%` : '—'}</span>
        </div>
        ${entry.rationales?.[state.id] ? `<p>${esc(entry.rationales[state.id])}</p>` : ''}
      </article>`).join('');

    $('#dialog-content').style.setProperty('--state', state.color);
    $('#dialog-content').innerHTML = `
      <div class="dialog-kicker"><span>${String(state.id).padStart(2, '0')}</span>${esc(state.family)} &middot; ${esc(horizon.label)}</div>
      <h2 id="dialog-title">${esc(state.name)}${extinctionMark(state)}</h2>
      <div class="dialog-summary">
        <div><strong>${aggregatePercent(consensus)}</strong><span>${esc(horizon.label)} lab-balanced mean</span></div>
        <div><strong>${entries.at(-1).value}–${entries[0].value}%</strong><span>model range</span></div>
        <div><strong>${entries.length}</strong><span>models</span></div>
      </div>
      <p class="dialog-description">${esc(state.description)}</p>
      <div class="dialog-subhead"><h3>How each model sees it</h3><span>${esc(horizon.label)} · band is the range across ${entries[0]?.sampleCount ?? 5} samples; tick is the published figure</span></div>
      <div class="model-answer-list">${rows}</div>`;
    $('#detail-dialog').showModal();
    document.body.classList.add('dialog-open');
  }

  // Shape is the only thing telling the two marks apart now, so the naming has
  // to be reachable on hover. One floating element rather than a CSS tooltip:
  // the marks sit inside the matrix's horizontal scroll container, which would
  // clip a pseudo-element.
  const markTip = document.createElement('div');
  markTip.className = 'mark-tip';
  markTip.setAttribute('aria-hidden', 'true');
  let markTipFor = null;

  const hideMarkTip = () => {
    markTipFor = null;
    markTip.classList.remove('is-on');
  };

  function showMarkTip(mark) {
    const tier = mark.dataset.mark;
    if (!tier || markTipFor === mark) return;
    markTipFor = mark;
    markTip.innerHTML = `<b>${extinctionLabels[tier]}</b><span>${extinctionTip(tier)}</span>`;
    // A modal dialog paints in the top layer, above anything parented to the
    // body — so inside one, the tooltip has to live in the dialog.
    const host = mark.closest('dialog[open]') || document.body;
    if (markTip.parentNode !== host) host.appendChild(markTip);
    // Measure from a corner: a left already near the viewport edge would
    // squeeze the box and give the wrong width to centre against.
    markTip.style.left = '0px';
    markTip.style.top = '0px';
    const anchorBox = mark.getBoundingClientRect();
    const box = markTip.getBoundingClientRect();
    const margin = 10;
    const left = Math.min(Math.max(anchorBox.left + anchorBox.width / 2 - box.width / 2, margin), window.innerWidth - box.width - margin);
    const above = anchorBox.top - box.height - 8;
    markTip.style.left = `${Math.round(left)}px`;
    markTip.style.top = `${Math.round(above < margin ? anchorBox.bottom + 8 : above)}px`;
    markTip.classList.add('is-on');
  }

  document.addEventListener('pointerover', event => {
    const mark = event.target.closest?.('.state-mark[data-mark]');
    if (mark) showMarkTip(mark);
    else if (markTipFor) hideMarkTip();
  });

  // Keyboard parity without adding a tab stop per mark: the mark shows its
  // tooltip when the control wrapping it takes focus.
  document.addEventListener('focusin', event => {
    const mark = event.target.closest?.('button, .state-card')?.querySelector('.state-mark[data-mark]');
    if (mark) showMarkTip(mark);
    else hideMarkTip();
  });

  window.addEventListener('scroll', hideMarkTip, true);

  function selectForecast(key) {
    activeEndForecast = key;
    $$('.end-toggle-button').forEach(button => {
      const on = button.dataset.endForecast === activeEndForecast;
      button.classList.toggle('active', on);
      button.setAttribute('aria-pressed', on);
    });
    applyForecast({ animate: true });
  }

  // A horizon can change the height of every dynamic section above the
  // reader. Holding scrollY would therefore move the thing they were reading.
  // Instead, remember a semantic block near the reader's visual focus and
  // compensate for its new document position before the next paint.
  let viewportRestoreToken = 0;
  let viewportStyleSnapshot = null;
  let viewportRestorePosition = null;

  function captureViewportPosition() {
    const root = document.documentElement;
    const maxScroll = Math.max(0, root.scrollHeight - innerHeight);
    if (scrollY <= 1.5) return { edge: 'top' };
    if (maxScroll - scrollY <= 1.5) return { edge: 'bottom' };

    const dock = $('.horizon-toggle-dock');
    const contentTop = dock?.getBoundingClientRect().bottom || 0;
    // The middle of the unobscured viewport best represents what the reader
    // is looking at. Anchoring only the first line below the sticky controls
    // can still move a card that occupies the rest of the screen.
    const readingLine = Math.min(innerHeight - 1, contentTop + (innerHeight - contentTop) / 2);

    const anchors = [];
    const add = (element, resolve, priority = 0) => {
      if (!element) return;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.bottom <= contentTop || rect.top >= innerHeight) return;
      anchors.push({
        top: rect.top,
        bottom: rect.bottom,
        priority,
        // Rectangles are half-open here, so a line exactly between two cards
        // belongs to the one beginning there, not the row that just ended.
        distance: readingLine < rect.top ? rect.top - readingLine : readingLine >= rect.bottom ? readingLine - rect.bottom : 0,
        resolve
      });
    };

    $$('.state-card[data-state]').forEach(card => {
      const id = card.dataset.state;
      add(card, () => $$('.state-card[data-state]').find(candidate => candidate.dataset.state === id));
    });
    $$('.matrix-row[data-state]').forEach(row => {
      const id = row.dataset.state;
      add(row, () => $$('.matrix-row[data-state]').find(candidate => candidate.dataset.state === id));
    });
    $$('.doomer-row').forEach((row, index) => {
      const key = row.dataset.runKey;
      const wasOpen = row.classList.contains('is-open');
      add(row, () => {
        const rows = $$('.doomer-row');
        const positionRow = rows.length ? rows[Math.min(index, rows.length - 1)] : null;
        // Exposure is a ranking, so a collapsed model is not a stable visual
        // anchor: let models change rank inside a stationary chart. An open
        // model is the exception because the reader explicitly revealed it.
        // If a horizon has fewer models, clamp a vanished final rank to the
        // new final rank instead of falling through to a broad section anchor.
        return (wasOpen && rows.find(candidate => candidate.dataset.runKey === key)) || positionRow;
      });
    });
    $$('.method-list > li').forEach((item, index) => add(item, () => $$('.method-list > li')[index]));
    $$('.section-heading').forEach((heading, index) => add(heading, () => $$('.section-heading')[index]));

    [
      '.horizon-picker-copy', '.horizon-picker-rule',
      '.end-hero h1', '#forecast-summary', '.leader-title', '.leader-name',
      '.leader-unit', '.leader-timeline', '.leader-description', '.leader-method',
      '#end-forecast-title', '#forecast-note', '#end-forecast-toggle',
      '#consensus-bar', '#consensus-legend', '.doomer-key', '#horizon-chart-title',
      '#horizon-chart-legend', '#horizon-chart-svg', '.horizon-chart-caption',
      '.method-hero', '.footer-mark', '.footer-note'
    ].forEach(selector => add($(selector), () => $(selector)));

    // Broad sections are fallbacks for whitespace between the smaller blocks.
    [
      '.end-hero', '.end-leader-section', '.end-intro',
      '.states-section', '.matrix-section', '.model-mix', '.horizon-chart-section', '#method', '.site-footer'
    ].forEach(selector => add($(selector), () => $(selector), 2));

    anchors.sort((a, b) => {
      const aCrosses = a.distance === 0;
      const bCrosses = b.distance === 0;
      // Prefer real readable blocks even when the focus line lands in nearby
      // whitespace. A section-sized fallback would otherwise win merely
      // because it surrounds everything, while the visible row still moved.
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (aCrosses !== bCrosses) return aCrosses ? -1 : 1;
      if (a.distance !== b.distance) return a.distance - b.distance;
      return Math.abs(a.top - readingLine) - Math.abs(b.top - readingLine);
    });
    return { anchors };
  }

  function holdViewport(position) {
    const root = document.documentElement;
    if (!viewportStyleSnapshot) {
      viewportStyleSnapshot = {
        scrollBehavior: root.style.scrollBehavior,
        overflowAnchor: root.style.overflowAnchor
      };
      // Treat consecutive selections before the next settled paint as one
      // interaction. Keeping their first anchor avoids accumulating WebKit's
      // per-scroll device-pixel rounding when a reader taps rapidly.
      viewportRestorePosition = position;
    }
    root.style.scrollBehavior = 'auto';
    root.style.overflowAnchor = 'none';
    viewportRestoreToken += 1;
    return { token: viewportRestoreToken, position: viewportRestorePosition };
  }

  function restoreViewportPosition(position) {
    if (position.edge === 'top') {
      scrollTo(0, 0);
      return;
    }
    if (position.edge === 'bottom') {
      scrollTo(0, Math.max(0, document.documentElement.scrollHeight - innerHeight));
      return;
    }
    let anchor;
    let replacement;
    position.anchors.some(candidate => {
      const resolved = candidate.resolve();
      if (!resolved) return false;
      anchor = candidate;
      replacement = resolved;
      return true;
    });
    if (!anchor || !replacement) return;
    const delta = replacement.getBoundingClientRect().top - anchor.top;
    if (Math.abs(delta) > 0.01) scrollTo(0, scrollY + delta);
  }

  function releaseViewport(token) {
    if (token !== viewportRestoreToken || !viewportStyleSnapshot) return;
    const root = document.documentElement;
    root.style.scrollBehavior = viewportStyleSnapshot.scrollBehavior;
    root.style.overflowAnchor = viewportStyleSnapshot.overflowAnchor;
    viewportStyleSnapshot = null;
    viewportRestorePosition = null;
  }

  function selectHorizon(key) {
    if (!isSelectableHorizon(key) || key === activeHorizon) return;
    stopSweep();
    hideMarkTip();
    horizonChartPinned = false;
    hideHorizonChartTooltip();
    const dialog = $('#detail-dialog');
    if (dialog.open) dialog.close();
    const leaderEl = $('#end-leader');
    clearTimeout(leaderEl._swap);
    leaderEl.classList.remove('is-swapping');
    const openExposureKey = $('.doomer-row.is-open')?.dataset.runKey;

    const viewportHold = holdViewport(captureViewportPosition());
    const viewportToken = viewportHold.token;
    const viewportPosition = viewportHold.position;

    useDataset(key);
    if (activeEndForecast !== AGGREGATE_KEY && !endStateRuns[activeEndForecast]) activeEndForecast = AGGREGATE_KEY;
    leaderSettled = false;
    settleCancelled = false;
    renderEndStates();
    if (openExposureKey) {
      const openExposure = $$('.doomer-row[data-run-key]').find(row => row.dataset.runKey === openExposureKey);
      if (openExposure) setExposureOpen(openExposure, true);
    }
    restoreViewportPosition(viewportPosition);
    updateUrl();
    revealOnView('.state-strip', { watch: '.strip-axis', threshold: 1 });
    revealOnView('.matrix', { threshold: 0.12 });
    revealOnView('.doomer-list', { threshold: 0.15, delay: 500 });
    requestAnimationFrame(() => {
      if (viewportToken !== viewportRestoreToken) return;
      $$('.horizon-button[data-horizon]').find(button => button.dataset.horizon === activeHorizon)?.focus({ preventScroll: true });
      restoreViewportPosition(viewportPosition);
      requestAnimationFrame(() => {
        if (viewportToken !== viewportRestoreToken) return;
        restoreViewportPosition(viewportPosition);
        releaseViewport(viewportToken);
      });
    });
  }

  // On reaching the forecast, the board plays itself once: every model in turn,
  // half a second each, ending back on the lab-balanced mean. Seventeen allocations in
  // nine seconds says more about how far apart the models are than any single
  // one of them does.
  let sweepTimer = null;
  let sweepCancelled = false;
  function stopSweep() {
    sweepCancelled = true;
    if (!sweepTimer) return;
    clearInterval(sweepTimer);
    sweepTimer = null;
  }

  function sweepForecasts(panel) {
    // Not if motion is unwelcome, and not if the reader asked for one model by
    // URL — that is a request for that model, not for a tour.
    if (reduceMotion() || !('IntersectionObserver' in window)) return;
    if (activeEndForecast !== AGGREGATE_KEY) return;
    const order = Object.keys(endStateRuns);
    if (!order.length) return;

    const io = new IntersectionObserver((records, observer) => {
      if (!records.some(r => r.isIntersecting)) return;
      observer.disconnect();
      if (sweepCancelled) return;
      let step = 0;
      sweepTimer = setInterval(() => {
        if (step < order.length) selectForecast(order[step++]);
        else { stopSweep(); selectForecast(AGGREGATE_KEY); }
      }, 500);
    }, { threshold: 0.35 });
    io.observe(panel);
  }

  document.addEventListener('click', event => {
    const horizonTarget = event.target.closest('.horizon-button[data-horizon]');
    if (horizonTarget) {
      selectHorizon(horizonTarget.dataset.horizon);
      return;
    }

    const endForecastTarget = event.target.closest('[data-end-forecast]');
    if (endForecastTarget) {
      stopSweep();
      selectForecast(endForecastTarget.dataset.endForecast);
      updateUrl();
      return;
    }

    // Legend and consensus-bar segments jump to the card; the card opens detail.
    const jumpTarget = event.target.closest('[data-state-jump]');
    if (jumpTarget) {
      document.querySelector(`#state-${jumpTarget.dataset.stateJump}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Touch has no hover, so a tap holds the composition open instead. Keep
    // only one disclosure open at a time so the long ranking stays scannable.
    const exposureRow = event.target.closest('.doomer-row');
    if (exposureRow) {
      toggleExposureRow(exposureRow);
      return;
    }

    const stateTarget = event.target.closest('[data-state]');
    if (stateTarget) openState(stateTarget.dataset.state);
  });

  document.addEventListener('pointerdown', stopSweep, { once: true });

  document.addEventListener('keydown', event => {
    stopSweep();
    if (event.key === 'Escape') {
      hideMarkTip();
      horizonChartPinned = false;
      hideHorizonChartTooltip();
    }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const exposureRow = event.target.closest?.('.doomer-row');
    if (exposureRow) {
      event.preventDefault();
      toggleExposureRow(exposureRow);
      return;
    }
    const card = event.target.closest?.('.state-card[data-state]');
    if (!card) return;
    event.preventDefault();
    openState(card.dataset.state);
  });

  $('#dialog-close').addEventListener('click', () => $('#detail-dialog').close());
  $('#detail-dialog').addEventListener('click', event => {
    if (event.target !== $('#detail-dialog')) return;
    const rect = $('#detail-dialog').getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $('#detail-dialog').close();
  });
  $('#detail-dialog').addEventListener('close', () => document.body.classList.remove('dialog-open'));
  // Both reveals run when the section first comes into view, so the sweep is
  // seen rather than finished before the reader arrives.
  // Content is visible by default; the hidden starting state is added here, so
  // a failure to observe leaves the data on screen rather than blank. A timer
  // backs that up: observers do not fire in a background tab, and a reader
  // returning to one should not find an empty page.
  // `watch` is the element whose visibility decides the moment; it can be a
  // child of the thing being revealed. Bands wait until their axis is wholly on
  // screen, so a card animates when it can actually be read rather than as soon
  // as its first pixels appear.
  function revealOnView(selector, { watch, threshold = 0.15, rootMargin = '0px', delay = 0 } = {}) {
    const targets = $$(selector);
    if (reduceMotion() || !('IntersectionObserver' in window)) return;
    targets.forEach(el => el.classList.add('will-reveal'));

    // After the reveal has had its time the classes come off, so the end state
    // never depends on a transition having run — browsers pause them in
    // background tabs.
    const settle = el => setTimeout(() => el.classList.remove('will-reveal', 'is-in'), delay + 1600);
    const io = new IntersectionObserver((records, observer) => {
      records.forEach(record => {
        if (!record.isIntersecting) return;
        const host = record.target.closest(selector) || record.target;
        observer.unobserve(record.target);
        if (delay) setTimeout(() => host.classList.add('is-in'), delay);
        else host.classList.add('is-in');
        settle(host);
      });
    }, { threshold, rootMargin });
    targets.forEach(el => io.observe((watch && el.querySelector(watch)) || el));

    // The animation waits for the whole axis to be on screen. A short viewport,
    // a zoomed page, or a scroll that never quite frames a card can miss that
    // threshold — and because the hidden state is opt-in, missing it leaves the
    // chart blank rather than unanimated. This second observer gives up on the
    // animation and shows the element once it has simply been on screen.
    const rescue = new IntersectionObserver(records => {
      records.forEach(record => {
        if (!record.isIntersecting) return;
        const host = record.target.closest(selector) || record.target;
        rescue.unobserve(record.target);
        setTimeout(() => {
          if (!host.classList.contains('is-in')) host.classList.remove('will-reveal');
        }, delay + 1500);
      });
    }, { threshold: 0 });
    targets.forEach(el => rescue.observe(el));

    // No long-stop on a page-load timer. One used to clear every element after
    // four seconds whether or not the reader had reached it, which truncated
    // whatever was animating and stopped everything further down animating at
    // all. An element nobody has scrolled to needs no rescue; the observer
    // above deals with it the moment somebody does.
  }

  applyUrlState();
  renderEndStates();
  renderHorizonChart();
  window.MF_TEST = {
    quantizeTo100, aggregateOf, stateAggregate, extinctionSums, esc, stopSweep,
    activeDataset, activeHorizon: () => activeHorizon, selectHorizon, horizonChartData,
    disableLeaderSettle: () => { leaderSettled = true; settleCancelled = true; },
    replayLeader: () => {
      const leader = stateAggregate().slice().sort((a, b) => b.probability - a.probability)[0];
      if (!leader) return;
      leaderSettled = false;
      settleCancelled = false;
      settleLeader($('#end-leader'), leader);
    }
  };

  sweepForecasts($('.end-consensus'));

  revealOnView('.state-strip', { watch: '.strip-axis', threshold: 1 });
  revealOnView('.matrix', { threshold: 0.12 });
  revealOnView('.doomer-list', { threshold: 0.15, delay: 500 });

  let doomerLabelFrame;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(doomerLabelFrame);
    doomerLabelFrame = requestAnimationFrame(fitDoomerTierLabels);
  });
})();
