(function () {
  const { states, endStateRuns = {}, datasetDate } = window.MF_DATA;

  // Guard against taxonomy/data drift: every end-state run must cover exactly
  // the published state ids and allocate exactly 100 points.
  Object.entries(endStateRuns).forEach(([runKey, run]) => {
    const ids = Object.keys(run.probabilities).map(Number).sort((a, b) => a - b);
    const sum = ids.reduce((total, id) => total + run.probabilities[id], 0);
    const coversAllStates = ids.length === states.length && states.every(state => ids.includes(state.id));
    if (!coversAllStates || sum !== 100) console.error(`MF_DATA.endStateRuns['${runKey}']: probabilities must cover state ids 1–${states.length} and sum to 100 (got ${ids.length} states, sum ${sum}).`);
  });
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const median = values => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };

  let activeEndForecast = 'Median';

  // The selected model lives in a real query param so a link is shareable:
  //   /?model=claude-fable-5
  // The hash is left free for section anchors (#method).
  function applyUrlState() {
    let model = new URLSearchParams(location.search).get('model');
    // Links shared before the site became a single page used
    // #end-states?model=X. Honour them, then rewrite to the current form.
    const legacy = location.hash.match(/[?&]model=([^&]+)/);
    if (!model && legacy) {
      model = decodeURIComponent(legacy[1]);
      history.replaceState(null, '', location.pathname + (endStateRuns[model] ? `?model=${encodeURIComponent(model)}` : ''));
    }
    activeEndForecast = model && endStateRuns[model] ? model : 'Median';
  }

  function updateUrl() {
    const query = activeEndForecast === 'Median' ? '' : `?model=${encodeURIComponent(activeEndForecast)}`;
    history.replaceState(null, '', location.pathname + query + location.hash);
  }
  const extinctionLabels = { gone: 'Humanity is gone', risk: 'Humanity might perish' };
  // Straight from rule 3 of the taxonomy, so the marks explain themselves in
  // the same words the models were given.
  const extinctionTips = {
    gone: 'Endings 1–3. Humans died or were destroyed without continuity of individual identity.',
    risk: 'Endings 4–5. Humanity survives in some versions of the ending and perishes in others.'
  };
  const MARK_SHAPES = {
    gone: '<circle cx="11" cy="11" r="9.1"/><path d="M7.3 6.7h7.4M7.3 15.3h7.4M7.7 7l6.6 8M14.3 7l-6.6 8"/>',
    risk: '<path d="M11 3.2 20.1 18.5H1.9Z"/><path d="M11 9.1v3.9M11 15.8h.01"/>'
  };
  const extinctionMark = state => {
    const tier = state.extinction;
    if (!tier) return '';
    const label = extinctionLabels[tier];
    // No title attribute: it would double up with the tooltip below.
    return `<span class="state-mark is-${tier}" role="img" data-mark="${tier}" aria-label="${label}. ${extinctionTips[tier]}"><svg viewBox="0 0 22 22" aria-hidden="true">${MARK_SHAPES[tier]}</svg></span>`;
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

  // Largest-remainder, matching tools/import-runs.mjs. Coordinate-wise medians
  // of eleven allocations that each sum to 100 need not sum to 100 themselves
  // — as published they sum to 99 — and the bar used to divide by that 99
  // while the legend printed the raw figures, so widths and labels described
  // two different vectors. Normalise once here and everything downstream
  // (legend, bar, cards, leader, dialog) reads the same numbers.
  function normalizeTo100(values) {
    const total = values.reduce((sum, v) => sum + v, 0);
    if (!total) return values.map(() => 0);
    const scaled = values.map(v => (v / total) * 100);
    const out = scaled.map(Math.floor);
    const shortfall = 100 - out.reduce((sum, v) => sum + v, 0);
    scaled
      .map((v, i) => [v - out[i], i])
      .sort((a, b) => b[0] - a[0])
      .slice(0, shortfall)
      .forEach(([, i]) => { out[i] += 1; });
    return out;
  }

  function stateMedians() {
    const ordered = endingOrder();
    const medians = ordered.map(state => median(Object.values(endStateRuns).map(run => stateValue(run, state))));
    const normalized = normalizeTo100(medians);
    return ordered.map((state, i) => ({ ...state, probability: normalized[i] }));
  }

  function longTermEntries() {
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
    if (activeEndForecast !== 'Median' && endStateRuns[activeEndForecast]) {
      return endingOrder().map(state => ({ ...state, probability: stateValue(endStateRuns[activeEndForecast], state) }));
    }
    activeEndForecast = 'Median';
    return stateMedians();
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

  function renderEndForecastToggle(entries) {
    const options = [{ key: 'Median', label: 'Median' }, ...entries.map(entry => ({ key: entry.runKey, label: entry.label, provider: entry.provider }))];
    $('#end-forecast-toggle').innerHTML = options.map(option =>
      `<button type="button" class="end-toggle-button${option.provider ? '' : ' is-median'}${option.key === activeEndForecast ? ' active' : ''}" data-end-forecast="${esc(option.key)}" aria-pressed="${option.key === activeEndForecast}">${option.provider ? labLogo(option.provider) : ''}${esc(option.label)}</button>`
    ).join('');
  }

  // Cell intensity is the state's own hue at an alpha proportional to the
  // value, so a row reads as a gradient across models. Scaled against the
  // largest value on the board rather than 100, since nothing approaches 100.
  function renderMatrix(entries, orderedStates) {
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
      <div class="matrix-row" role="row">
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
    $('#stat-models').textContent = entries.length;
    $('#stat-labs').textContent = labs.size;
    $('#stat-samples').textContent = samples.length === 1 ? samples[0] : `${Math.min(...samples)}–${Math.max(...samples)}`;
    const methodSamples = $('#method-samples');
    if (methodSamples) methodSamples.textContent = samples.length === 1 ? samples[0] : `${Math.min(...samples)}–${Math.max(...samples)}`;
    const roster = $('#footer-roster');
    if (roster) roster.textContent = `${entries.length} models across ${labs.size} labs`;
  }

  let axisMax = 40;
  const MOTION_MS = 500;
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Count a figure from where it is to where it lands, matching the target's
  // precision so a median of 13.5 does not render as 14 mid-flight. rAF is
  // paused in a hidden tab, so a timer guarantees the value still lands, and a
  // token drops stale tweens when a selection changes mid-flight.
  const tweenTimers = new WeakMap();
  const tweenTokens = new WeakMap();
  function tweenNumber(el, to, suffix = '%') {
    const from = parseFloat(el.textContent);
    const dp = Number.isInteger(to) ? 0 : 1;
    const land = () => { el.textContent = to + suffix; };
    clearTimeout(tweenTimers.get(el));
    const token = {};
    tweenTokens.set(el, token);
    if (reduceMotion() || !Number.isFinite(from) || from === to) return land();
    const started = performance.now();
    const step = now => {
      if (tweenTokens.get(el) !== token) return;
      const t = Math.min((now - started) / MOTION_MS, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = (from + (to - from) * eased).toFixed(dp) + suffix;
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

  function renderEndStates() {
    const entries = longTermEntries();
    const orderedStates = endingOrder();
    renderHeroStats(entries);
    renderEndForecastToggle(entries);

    // The visible glyph is just the ending's number, so the name and the
    // current share go in an aria-label, refreshed per selection below.
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

    // Two models are only separable when their gap clears the sampling error.
    // Publishing the ranking without that is publishing false precision.
    // exposurePublished, not exposure: the bar shows a sum of renormalized
    // medians, and exposure.se measures the mean of per-sample totals — a
    // different estimator that ranks the models differently. Its bootstrap
    // describes the number actually drawn.
    const errors = doomerEntries.map(e => e.exposurePublished?.se).filter(Number.isFinite);
    const pooledSe = errors.length ? Math.sqrt(errors.reduce((a, c) => a + c * c, 0) / errors.length) : null;
    const threshold = pooledSe ? 2.78 * pooledSe : null;
    const samples = [...new Set(doomerEntries.map(e => e.exposure?.n).filter(Boolean))];
    const exposureStates = endingOrder().filter(state => state.extinction);

    $('#doomer-ratings').innerHTML = `
      <div class="doomer-head">
        <p class="doomer-key"><span class="key-gone"><i></i>Humanity is gone (1–3)</span><span class="key-risk"><i></i>Might perish (4–5)</span><span class="key-hint"><span class="on-hover">Hover a bar for the endings inside it</span><span class="on-tap">Tap a bar for the endings inside it</span></span></p>
      </div>
      <div class="doomer-list">
        ${doomerEntries.map(entry => {
          const total = entry.sums.total;
          const parts = exposureStates.map(state => ({ state, value: stateValue(entry, state) }));
          // The readout only exists on hover, so the same breakdown goes in the
          // bar's label — a screen reader never has a pointer to hover with.
          const spoken = parts.map(({ state, value }) => `${esc(state.name)} ${value}%`).join(', ');
          return `<div class="doomer-row">
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
            <div class="doomer-readout">${
              parts.map(({ state, value }) => `<span><i style="background:${state.color}"></i>${state.id}. ${esc(state.name)} <b>${value}%</b></span>`).join('')
            }</div>
          </div>
          <div class="doomer-total"><b>${total}%</b></div>
        </div>`;
        }).join('')}
      </div>
      ${threshold ? `<p class="doomer-note">Each model was asked ${samples.length === 1 ? samples[0] : `${Math.min(...samples)}–${Math.max(...samples)}`} times. Each published figure carries a bootstrap standard error of about ±${pooledSe.toFixed(1)} points. Two models are only distinguishable where the gap between them exceeds about ${threshold.toFixed(1)} points, so most neighbouring rows are ties.</p>` : ''}`;
  }

  function applyForecast({ animate }) {
    const activeRun = endStateRuns[activeEndForecast];
    const activeLabel = activeRun ? `${activeRun.label || activeEndForecast} forecast` : 'Median machine forecast';
    $('#end-forecast-title').textContent = activeLabel;

    const selectedStates = selectedEndStates();
    const entriesForRange = longTermEntries();
    const total = selectedStates.reduce((sum, state) => sum + state.probability, 0);
    const bar = $('#consensus-bar');
    const legend = $('#consensus-legend');
    bar.setAttribute('aria-label', `${activeRun ? activeRun.label : 'Median'} probability by end state`);
    bar.classList.toggle('is-animating', Boolean(animate) && !reduceMotion());

    selectedStates.forEach((state, index) => {
      const segment = bar.children[index];
      segment.style.width = `${(state.probability / total) * 100}%`;
      const spread = activeRun?.range?.[state.id];
      segment.title = `${state.name}: ${state.probability}%${spread ? ` (${spread[0]}–${spread[1]}% across samples)` : ''}${state.extinction ? ` · ${extinctionLabels[state.extinction]}` : ''}`;

      segment.setAttribute('aria-label', `${state.name}: ${state.probability}% — jump to this ending`);

      const value = legend.children[index].querySelector('b');
      animate ? tweenNumber(value, state.probability) : (value.textContent = `${state.probability}%`);

      const card = $(`#state-${state.id}`);

      // Band, middle half, tick and caption all describe the same thing. On the
      // median view that is the spread across models; with a model selected it
      // is that model's own samples — otherwise the caption would report a
      // range the band does not cover.
      const across = entriesForRange.map(entry => stateValue(entry, state)).sort((a, b) => a - b);
      const quantile = f => { const i = (across.length - 1) * f, lo = Math.floor(i), hi = Math.ceil(i);
                              return across[lo] + (across[hi] - across[lo]) * (i - lo); };
      const band = activeRun
        ? { lo: activeRun.range?.[state.id]?.[0], hi: activeRun.range?.[state.id]?.[1],
            q1: activeRun.quartiles?.[state.id]?.[0], q3: activeRun.quartiles?.[state.id]?.[1],
            caption: `${activeRun.range?.[state.id]?.[0]}–${activeRun.range?.[state.id]?.[1]}% across ${activeRun.sampleCount} samples`,
            detail: `${activeRun.label}: ${state.probability}% · samples ${activeRun.range?.[state.id]?.join('–')}% · middle half ${activeRun.quartiles?.[state.id]?.join('–')}%` }
        : { lo: across[0], hi: across.at(-1), q1: quantile(0.25), q3: quantile(0.75),
            caption: `${across[0]}–${across.at(-1)}% across ${across.length} models`,
            detail: `${across[0]}–${across.at(-1)}% across ${across.length} models · middle half ${quantile(0.25).toFixed(0)}–${quantile(0.75).toFixed(0)}%` };

      const pct = v => (v / axisMax) * 100;
      const origin = (v, from, to) => to === from ? '50%' : `${(((v - from) / (to - from)) * 100).toFixed(2)}%`;
      const axis = card.querySelector('.strip-axis');
      const rangeEl = card.querySelector('.strip-range');
      const iqrEl = card.querySelector('.strip-iqr');
      if (Number.isFinite(band.lo) && Number.isFinite(band.hi)) {
        rangeEl.style.left = `${pct(band.lo).toFixed(2)}%`;
        rangeEl.style.width = `${(pct(band.hi) - pct(band.lo)).toFixed(2)}%`;
        rangeEl.style.setProperty('--origin', origin(state.probability, band.lo, band.hi));
        rangeEl.hidden = false;
      } else rangeEl.hidden = true;
      if (Number.isFinite(band.q1) && Number.isFinite(band.q3)) {
        // A middle half that collapses to one figure — common, since most models
        // land on the same number — would otherwise be drawn starting at that
        // figure, leaving the tick sitting on its edge rather than within it.
        // Give it a floor and centre it on the value instead.
        const floor = axisMax * 0.012;
        const mid = (band.q1 + band.q3) / 2;
        const half = Math.max((band.q3 - band.q1) / 2, floor / 2);
        const from = Math.max(mid - half, 0);
        const to = Math.min(mid + half, axisMax);
        iqrEl.style.left = `${pct(from).toFixed(2)}%`;
        iqrEl.style.width = `${(pct(to) - pct(from)).toFixed(2)}%`;
        iqrEl.style.setProperty('--origin', origin(state.probability, from, to));
        iqrEl.hidden = false;
      } else iqrEl.hidden = true;
      axis.title = band.detail;
      card.querySelector('.range-text').textContent = band.caption;

      const tick = card.querySelector('.strip-mid');
      if (tick) {
        const at = pct(state.probability);
        tick.style.left = `${at.toFixed(2)}%`;
        tick.querySelector('span').textContent = `${state.probability}%`;
        // Near either end the centred label would hang off the card, so it
        // anchors to the tick instead.
        tick.classList.toggle('at-start', at < 9);
        tick.classList.toggle('at-end', at > 91);
      }

      const figure = card.querySelector('.state-card-meta strong');
      animate ? tweenNumber(figure, state.probability) : (figure.textContent = `${state.probability}%`);
      card.setAttribute('aria-label', `${state.name}: ${state.probability}% — see each model's reasoning`);
    });

    const leader = [...selectedStates].sort((a, b) => b.probability - a.probability)[0];
    const leaderEl = $('#end-leader');
    const paint = () => {
      leaderEl.innerHTML = `<p class="kicker">Most likely ending</p><span class="leader-number">${leader.id}</span><h2>${esc(leader.name)}${extinctionMark(leader)}</h2><strong>${leader.probability}%</strong><p>${esc(leader.description)}</p>`;
    };
    // The leader can become a different ending entirely, so it crossfades
    // rather than counting between two unrelated states.
    if (!animate || reduceMotion() || Number(leaderEl.dataset.leader) === leader.id) {
      const previous = leaderEl.querySelector('strong');
      if (animate && !reduceMotion() && previous && Number(leaderEl.dataset.leader) === leader.id) {
        tweenNumber(previous, leader.probability);
      } else paint();
    } else {
      leaderEl.classList.add('is-swapping');
      clearTimeout(leaderEl._swap);
      leaderEl._swap = setTimeout(() => { paint(); leaderEl.classList.remove('is-swapping'); }, MOTION_MS * 0.4);
    }
    leaderEl.dataset.leader = leader.id;
  }

  function openState(id) {
    const state = states.find(item => item.id === Number(id));
    if (!state) return;
    const entries = longTermEntries()
      .map(entry => ({ ...entry, value: stateValue(entry, state) }))
      .sort((a, b) => b.value - a.value);
    const consensus = median(entries.map(entry => entry.value));
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
      <div class="dialog-kicker"><span>${String(state.id).padStart(2, '0')}</span>${esc(state.family)}</div>
      <h2 id="dialog-title">${esc(state.name)}${extinctionMark(state)}</h2>
      <div class="dialog-summary">
        <div><strong>${consensus}%</strong><span>median forecast</span></div>
        <div><strong>${entries.at(-1).value}–${entries[0].value}%</strong><span>model range</span></div>
        <div><strong>${entries.length}</strong><span>models</span></div>
      </div>
      <p class="dialog-description">${esc(state.description)}</p>
      <div class="dialog-subhead"><h3>How each model sees it</h3><span>Band is the range across ${entries[0]?.sampleCount ?? 5} samples; tick is the published figure</span></div>
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
    markTip.innerHTML = `<b>${extinctionLabels[tier]}</b><span>${extinctionTips[tier]}</span>`;
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

  document.addEventListener('click', event => {
    const endForecastTarget = event.target.closest('[data-end-forecast]');
    if (endForecastTarget) {
      activeEndForecast = endForecastTarget.dataset.endForecast;
      $$('.end-toggle-button').forEach(button => {
        const on = button.dataset.endForecast === activeEndForecast;
        button.classList.toggle('active', on);
        button.setAttribute('aria-pressed', on);
      });
      applyForecast({ animate: true });
      updateUrl();
      return;
    }

    // Legend and consensus-bar segments jump to the card; the card opens detail.
    const jumpTarget = event.target.closest('[data-state-jump]');
    if (jumpTarget) {
      document.querySelector(`#state-${jumpTarget.dataset.stateJump}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Touch has no hover, so a tap holds the composition open instead. Only
    // one at a time: the readouts overhang the rows beneath them, and several
    // open at once would stack on top of each other.
    const exposureRow = event.target.closest('.doomer-row');
    if (exposureRow) {
      const wasOpen = exposureRow.classList.contains('is-open');
      $$('.doomer-row.is-open').forEach(row => row.classList.remove('is-open'));
      exposureRow.classList.toggle('is-open', !wasOpen);
      return;
    }

    const stateTarget = event.target.closest('[data-state]');
    if (stateTarget) openState(stateTarget.dataset.state);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') hideMarkTip();
    if (event.key !== 'Enter' && event.key !== ' ') return;
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
  function revealOnView(selector, { watch, threshold = 0.15, rootMargin = '0px' } = {}) {
    const targets = $$(selector);
    if (reduceMotion() || !('IntersectionObserver' in window)) return;
    targets.forEach(el => el.classList.add('will-reveal'));

    // After the reveal has had its time the classes come off, so the end state
    // never depends on a transition having run — browsers pause them in
    // background tabs.
    const settle = el => setTimeout(() => el.classList.remove('will-reveal', 'is-in'), 1600);
    const io = new IntersectionObserver((records, observer) => {
      records.forEach(record => {
        if (!record.isIntersecting) return;
        const host = record.target.closest(selector) || record.target;
        host.classList.add('is-in');
        observer.unobserve(record.target);
        settle(host);
      });
    }, { threshold, rootMargin });
    targets.forEach(el => io.observe((watch && el.querySelector(watch)) || el));

    // Long-stop for anything never observed — a viewport too short to ever hold
    // the axis whole, say. It clears the hidden state without animating, rather
    // than firing every remaining card at once.
    setTimeout(() => targets.forEach(el => {
      if (!el.classList.contains('is-in')) el.classList.remove('will-reveal');
    }), 10000);
  }

  if (datasetDate) $('#dataset-date').textContent = datasetDate;
  applyUrlState();
  renderEndStates();
  revealOnView('.state-strip', { watch: '.strip-axis', threshold: 1 });
  revealOnView('.matrix', { threshold: 0.12 });
})();
