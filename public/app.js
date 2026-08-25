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

  // Filter state lives in the hash so any configuration is shareable:
  //   #end-states?model=Google
  function parseHash() {
    const raw = location.hash.slice(1);
    const splitAt = raw.indexOf('?');
    return {
      view: splitAt === -1 ? raw : raw.slice(0, splitAt),
      params: new URLSearchParams(splitAt === -1 ? '' : raw.slice(splitAt + 1))
    };
  }

  function applyHashState() {
    const { view, params } = parseHash();
    const model = params.get('model');
    activeEndForecast = model && endStateRuns[model] ? model : 'Median';
    return view;
  }

  function updateHash() {
    const view = document.documentElement.dataset.view || 'end-states';
    const params = new URLSearchParams();
    if (view === 'end-states' && activeEndForecast !== 'Median') params.set('model', activeEndForecast);
    const query = params.toString();
    history.replaceState(null, '', location.pathname + location.search + '#' + view + (query ? '?' + query : ''));
  }
  const extinctionLabels = { gone: 'Humanity is gone', risk: 'Humanity might perish' };
  const extinctionMark = state => {
    if (state.extinction === 'gone') return `<span class="extinction-mark" role="img" title="${extinctionLabels.gone}" aria-label="${extinctionLabels.gone}"><span></span></span>`;
    if (state.extinction === 'risk') return `<span class="risk-mark" role="img" title="${extinctionLabels.risk}" aria-label="${extinctionLabels.risk}">⚠︎</span>`;
    return '';
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
      shortLabel: source.shortLabel || provider.slice(0, 2),
      color: source.color || '#11120f'
    }));
  }

  function selectedEndStates() {
    if (activeEndForecast !== 'Median' && endStateRuns[activeEndForecast]) {
      return endingOrder().map(state => ({ ...state, probability: stateValue(endStateRuns[activeEndForecast], state) }));
    }
    activeEndForecast = 'Median';
    return stateMedians();
  }

  function renderEndForecastToggle(entries) {
    const options = [{ key: 'Median', label: 'Median', color: '#d9ff57' }, ...entries.map(entry => ({ key: entry.runKey, label: entry.label, color: entry.color }))];
    $('#end-forecast-toggle').innerHTML = options.map(option =>
      `<button type="button" class="end-toggle-button${option.key === activeEndForecast ? ' active' : ''}" style="--provider-color:${option.color}" data-end-forecast="${option.key}" aria-pressed="${option.key === activeEndForecast}"><i></i>${option.label}</button>`
    ).join('');
  }

  function renderEndStates() {
    const entries = longTermEntries();
    const orderedStates = endingOrder();
    renderEndForecastToggle(entries);
    const activeRun = endStateRuns[activeEndForecast];
    const activeLabel = activeRun ? `${activeRun.label || activeEndForecast} forecast` : 'Median machine forecast';
    $('#end-forecast-kicker').textContent = activeLabel;
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

    const colors = orderedStates.map(state => state.color);
    $('#model-bars').innerHTML = entries.map(entry => {
      return `<div class="model-bar-row"><div class="model-bar-label"><span class="model-swatch" style="--swatch:${entry.color}"></span><b>${entry.label}</b><small>${entry.provider}</small></div><div class="model-stack">${orderedStates.map((state, index) => {
        const value = stateValue(entry, state);
        return `<button style="width:${value}%;--state:${colors[index]}" title="${state.name}: ${value}%" aria-label="${entry.label} ${state.name}: ${value}%" data-small="${value < 5}"><span>${value}%</span></button>`;
      }).join('')}</div></div>`;
    }).join('');

    const doomerEntries = entries
      .map(entry => ({ ...entry, sums: extinctionSums(entry) }))
      .sort((a, b) => b.sums.total - a.sums.total);
    $('#doomer-ratings').innerHTML = `
      <div class="doomer-head">
        <div><p class="kicker">Doomer rating</p><h3>Extinction-risk exposure</h3></div>
        <p class="doomer-key"><span class="key-gone"><i></i>Humanity is gone (1–3)</span><span class="key-risk"><i></i>Might perish (4–5)</span></p>
      </div>
      <div class="doomer-list">
        ${doomerEntries.map(entry => `<div class="doomer-row">
          <div class="doomer-label"><span class="model-swatch" style="--swatch:${entry.color}"></span><b>${entry.label}</b><small>${entry.provider}</small></div>
          <div class="doomer-meter" aria-label="${entry.label}: ${entry.sums.gone}% humanity is gone, ${entry.sums.risk}% might perish">${
            [['gone', entry.sums.gone], ['risk', entry.sums.risk]]
              .filter(([, value]) => value > 0)
              .map(([tier, value]) => `<i class="${tier}" style="width:${value}%"><span>${value}%</span></i>`).join('')
          }</div>
        </div>`).join('')}
      </div>`;
  }

  function switchView(name) {
    const valid = ['end-states', 'method'];
    const viewName = valid.includes(name) ? name : 'end-states';
    $$('.view').forEach(view => { view.hidden = view.dataset.view !== viewName; });
    $$('[data-nav]').forEach(link => link.classList.toggle('active', link.dataset.nav === viewName));
    document.documentElement.dataset.view = viewName;
    window.scrollTo({ top: 0, behavior: 'instant' });
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
          <span class="model-swatch" style="--swatch:${entry.color}"></span>
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
      updateHash();
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
  window.addEventListener('hashchange', () => {
    const view = applyHashState();
    renderEndStates();
    switchView(view);
  });

  if (datasetDate) $('#dataset-date').textContent = datasetDate;
  const initialView = applyHashState();
  renderEndStates();
  switchView(initialView);
})();
