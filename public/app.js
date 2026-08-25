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
  const MARK_SHAPES = {
    gone: '<circle cx="11" cy="11" r="9.1"/><path d="M7.3 6.7h7.4M7.3 15.3h7.4M7.7 7l6.6 8M14.3 7l-6.6 8"/>',
    risk: '<path d="M11 3.2 20.1 18.5H1.9Z"/><path d="M11 9.1v3.9M11 15.8h.01"/>'
  };
  const extinctionMark = state => {
    const tier = state.extinction;
    if (!tier) return '';
    const label = extinctionLabels[tier];
    return `<span class="state-mark is-${tier}" role="img" title="${label}" aria-label="${label}"><svg viewBox="0 0 22 22" aria-hidden="true">${MARK_SHAPES[tier]}</svg></span>`;
  };

  const stateValue = (run, state) => run.probabilities[state.id];
  const endingOrder = () => [...states].sort((a, b) => a.id - b.id);
  const extinctionSums = run => {
    const sums = { gone: 0, risk: 0 };
    states.forEach(state => { if (state.extinction) sums[state.extinction] += stateValue(run, state); });
    return { ...sums, total: sums.gone + sums.risk };
  };

  function stateMedians() {
    return endingOrder().map(state => ({ ...state, probability: median(Object.values(endStateRuns).map(run => stateValue(run, state))) }));
  }

  function longTermEntries() {
    return Object.entries(endStateRuns).map(([runKey, source]) => ({
      runKey,
      provider: source.provider || runKey,
      probabilities: source.probabilities,
      rationales: source.rationales,
      promptVersion: source.promptVersion,
      sampleCount: source.sampleCount,
      date: source.date,
      model: source.model || provider,
      label: source.label || provider,
      shortLabel: source.shortLabel || provider.slice(0, 2)
    }));
  }

  function selectedEndStates() {
    if (activeEndForecast !== 'Median' && endStateRuns[activeEndForecast]) {
      return endingOrder().map(state => ({ ...state, probability: stateValue(endStateRuns[activeEndForecast], state) }));
    }
    activeEndForecast = 'Median';
    return stateMedians();
  }

  // Lab marks, drawn as simplified monochrome glyphs so model identity is
  // carried by shape rather than colour — colour belongs to the endings.
  // These are approximations: drop official SVG paths in here to replace them.
  const LAB_LOGOS = {
    Anthropic: '<path d="M8.4 3.5 3 20.5h3.5l1.1-3.6h5.3l1.1 3.6H17.5L12.1 3.5Zm.1 10.4 1.8-5.8 1.8 5.8Z"/>',
    OpenAI: '<path d="M12 2.6 20.1 7v10L12 21.4 3.9 17V7Zm0 2.7L6.2 8.5v7L12 18.7l5.8-3.2v-7Zm0 3.1a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2Z"/>',
    Google: '<path d="M12 3a9 9 0 1 0 8.8 10.9h-8.4v-3.3h11.2q.2 1 .2 2A10.1 10.1 0 1 1 12 3Z"/>',
    xAI: '<path d="M3.6 3.4h4.2l12.6 17.2h-4.2Zm16.3 0h-3.6l-4 5.4 1.9 2.6ZM3.9 20.6h3.6l4.2-5.7-1.8-2.6Z"/>',
    Meta: '<path d="M4.6 7.3C6 5.3 8.4 5 10 6.3c1.1.9 1.9 2.3 2.9 4.2 1-1.9 1.8-3.3 2.9-4.2 1.6-1.3 4-1 5.4 1 1.6 2.3 1.6 6.1 0 8.4-1.4 2-3.8 2.3-5.4 1-1.1-.9-1.9-2.3-2.9-4.2-1 1.9-1.8 3.3-2.9 4.2-1.6 1.3-4 1-5.4-1-1.6-2.3-1.6-6.1 0-8.4Zm2.1 1.5c-.9 1.4-.9 4 0 5.4.6.9 1.6 1 2.4.4.7-.6 1.4-1.7 2.3-3.1-.9-1.4-1.6-2.5-2.3-3.1-.8-.6-1.8-.5-2.4.4Zm10.6 0c-.6-.9-1.6-1-2.4-.4-.7.6-1.4 1.7-2.3 3.1.9 1.4 1.6 2.5 2.3 3.1.8.6 1.8.5 2.4-.4.9-1.4.9-4 0-5.4Z"/>',
    DeepSeek: '<path d="M2.6 12.6c2.6.4 4.4-.4 5.6-1.8-.6-1.7-.3-3.5.9-5 .3 1.7 1.2 2.9 2.5 3.6 1.8 1 3.4.7 5.1.2 1.5-.4 3-.9 4.7-.2-.5 1.3-1.5 2-2.6 2.4.6 3.5-1.6 6.6-5.3 7.6-4.2 1.1-8.6-1-10.9-6.8Zm11.9-.7a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"/>',
    Mistral: '<path d="M3 4h3.6v3.6H3Zm3.6 3.6h3.6v3.6H6.6Zm3.6 3.6h3.6v3.6h-3.6Zm3.6-3.6h3.6v3.6h-3.6ZM17.4 4H21v3.6h-3.6ZM3 11.2h3.6v3.6H3Zm14.4 0H21v3.6h-3.6ZM3 14.8h3.6V20H3Zm14.4 0H21V20h-3.6Z"/>',
    Moonshot: '<path d="M13.6 2.6a9.4 9.4 0 1 0 7.8 14.6A9.4 9.4 0 0 1 13.6 2.6Z"/>'
  };
  const labLogo = (provider, cls = '') =>
    `<span class="lab-logo ${cls}" role="img" aria-label="${provider}">${LAB_LOGOS[provider]
      ? `<svg viewBox="0 0 24 24" aria-hidden="true">${LAB_LOGOS[provider]}</svg>`
      : `<b>${provider.slice(0, 2)}</b>`}</span>`;

  function renderEndForecastToggle(entries) {
    const options = [{ key: 'Median', label: 'Median' }, ...entries.map(entry => ({ key: entry.runKey, label: entry.label, provider: entry.provider }))];
    $('#end-forecast-toggle').innerHTML = options.map(option =>
      `<button type="button" class="end-toggle-button${option.provider ? '' : ' is-median'}${option.key === activeEndForecast ? ' active' : ''}" data-end-forecast="${option.key}" aria-pressed="${option.key === activeEndForecast}">${option.provider ? labLogo(option.provider) : ''}${option.label}</button>`
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
        ${labs.map(lab => `<div class="matrix-lab" style="--span:${lab.models.length}" role="columnheader" title="${lab.provider}">${labLogo(lab.provider)}</div>`).join('')}
      </div>
      <div class="matrix-row matrix-subhead" role="row">
        <div class="matrix-corner" role="columnheader"></div>
        ${entries.map(entry => `<div class="matrix-model" role="columnheader" title="${entry.label}"><span>${entry.shortLabel}</span></div>`).join('')}
      </div>`;

    const rows = orderedStates.map(state => `
      <div class="matrix-row" role="row">
        <button class="matrix-state" role="rowheader" data-state="${state.id}" style="--state:${state.color}">
          <i></i><span class="matrix-state-name">${state.id}. ${state.name}</span>${extinctionMark(state)}
        </button>
        ${entries.map(entry => {
          const value = stateValue(entry, state);
          return `<div class="matrix-cell" role="cell" title="${entry.label} · ${state.name}: ${value}%" style="--state:${state.color};--fill:${Math.max(value / peak, 0.04).toFixed(3)}"><span>${value}</span></div>`;
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
    const roster = $('#footer-roster');
    if (roster) roster.textContent = `${entries.length} models across ${labs.size} labs`;
  }

  function renderEndStates() {
    const entries = longTermEntries();
    const orderedStates = endingOrder();
    renderHeroStats(entries);
    renderEndForecastToggle(entries);
    const activeRun = endStateRuns[activeEndForecast];
    const activeLabel = activeRun ? `${activeRun.label || activeEndForecast} forecast` : 'Median machine forecast';
    $('#end-forecast-title').textContent = activeLabel;
    const selectedStates = selectedEndStates();
    const total = selectedStates.reduce((sum, state) => sum + state.probability, 0);
    const normalized = selectedStates.map(state => ({ ...state, display: (state.probability / total) * 100 }));
    $('#consensus-bar').setAttribute('aria-label', `${activeRun ? activeRun.label : 'Median'} probability by end state`);
    $('#consensus-bar').innerHTML = normalized.map(state => `<button style="width:${state.display}%;--state:${state.color}" title="${state.name}: ${state.probability}%${state.extinction ? ` · ${extinctionLabels[state.extinction]}` : ''}" data-state-jump="${state.id}"><span>${state.id}</span></button>`).join('');
    $('#consensus-legend').innerHTML = normalized.map(state => `<button data-state-jump="${state.id}"><i style="--state:${state.color}"></i><span>${state.id}. ${state.name}${extinctionMark(state)}</span><b>${state.probability}%</b></button>`).join('');

    const leader = [...selectedStates].sort((a, b) => b.probability - a.probability)[0];
    $('#end-leader').innerHTML = `<p class="kicker">Most likely ending</p><span class="leader-number">${leader.id}</span><h2>${leader.name}${extinctionMark(leader)}</h2><strong>${leader.probability}%</strong><p>${leader.description}</p>`;

    $('#state-grid').innerHTML = selectedStates.map(state => {
      const providerValues = entries.map(entry => ({ ...entry, value: stateValue(entry, state) })).sort((a, b) => b.value - a.value);
      return `<article class="state-card" id="state-${state.id}" style="--state:${state.color}" data-state="${state.id}" tabindex="0" role="button" aria-label="${state.name}: ${state.probability}% — see each model's reasoning">
        <div class="state-card-head"><span>${String(state.id).padStart(2, '0')}</span><h3>${state.name}</h3><div class="state-card-meta"><strong>${state.probability}%</strong>${extinctionMark(state)}</div></div>
        <p>${state.description}</p>
        <div class="state-models">${providerValues.map(item => `<span title="${item.label}: ${item.value}%"><strong>${item.value}%</strong><i style="height:${Math.max(item.value * 1.8, 4)}px"></i><small>${item.shortLabel}</small></span>`).join('')}</div>
        <div class="state-range"><span>${providerValues.at(-1).value}% low</span><span>${providerValues[0].value}% high</span><em class="state-more">Why ↗</em></div>
      </article>`;
    }).join('');

    renderMatrix(entries, orderedStates);

    const doomerEntries = entries
      .map(entry => ({ ...entry, sums: extinctionSums(entry) }))
      .sort((a, b) => b.sums.total - a.sums.total);
    $('#doomer-ratings').innerHTML = `
      <div class="doomer-head">
        <p class="doomer-key"><span class="key-gone"><i></i>Humanity is gone (1–3)</span><span class="key-risk"><i></i>Might perish (4–5)</span></p>
      </div>
      <div class="doomer-list">
        ${doomerEntries.map(entry => `<div class="doomer-row">
          <div class="doomer-label">${labLogo(entry.provider, 'in-row')}<b>${entry.label}</b><small>${entry.provider}</small></div>
          <div class="doomer-meter" aria-label="${entry.label}: ${entry.sums.gone}% humanity is gone, ${entry.sums.risk}% might perish">${
            [['gone', entry.sums.gone], ['risk', entry.sums.risk]]
              .filter(([, value]) => value > 0)
              .map(([tier, value]) => `<i class="${tier}" style="width:${value}%"><span>${value}%</span></i>`).join('')
          }</div>
        </div>`).join('')}
      </div>`;
  }

  // Each run carries a rationale per state; the dialog is where they surface.
  function openState(id) {
    const state = states.find(item => item.id === Number(id));
    if (!state) return;
    const entries = longTermEntries()
      .map(entry => ({ ...entry, value: stateValue(entry, state) }))
      .sort((a, b) => b.value - a.value);
    const consensus = median(entries.map(entry => entry.value));
    const rows = entries.map(entry => `
      <article class="model-answer">
        <div class="model-answer-head">
          ${labLogo(entry.provider, 'in-row')}
          <div><b>${entry.label}</b><small>${entry.provider} · ${entry.date || ''}</small></div>
          <strong>${entry.value}%</strong>
        </div>
        ${entry.rationales?.[state.id] ? `<p>${entry.rationales[state.id]}</p>` : ''}
      </article>`).join('');

    $('#dialog-content').innerHTML = `
      <div class="dialog-kicker"><span>${String(state.id).padStart(2, '0')}</span>${state.family}</div>
      <h2>${state.name}${extinctionMark(state)}</h2>
      <div class="dialog-summary">
        <div><strong>${consensus}%</strong><span>median forecast</span></div>
        <div><strong>${entries.at(-1).value}–${entries[0].value}%</strong><span>model range</span></div>
        <div><strong>${entries.length}</strong><span>models</span></div>
      </div>
      <p class="dialog-description">${state.description}</p>
      <div class="dialog-subhead"><h3>How each model sees it</h3><span>Median of ${entries[0]?.sampleCount ?? 5} samples</span></div>
      <div class="model-answer-list">${rows}</div>`;
    $('#detail-dialog').showModal();
    document.body.classList.add('dialog-open');
  }

  document.addEventListener('click', event => {
    const endForecastTarget = event.target.closest('[data-end-forecast]');
    if (endForecastTarget) {
      activeEndForecast = endForecastTarget.dataset.endForecast;
      renderEndStates();
      updateUrl();
      return;
    }

    // Legend and consensus-bar segments jump to the card; the card opens detail.
    const jumpTarget = event.target.closest('[data-state-jump]');
    if (jumpTarget) {
      document.querySelector(`#state-${jumpTarget.dataset.stateJump}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const stateTarget = event.target.closest('[data-state]');
    if (stateTarget) openState(stateTarget.dataset.state);
  });

  document.addEventListener('keydown', event => {
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
  if (datasetDate) $('#dataset-date').textContent = datasetDate;
  applyUrlState();
  renderEndStates();
})();
