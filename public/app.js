(function () {
  const { categories, questions, runs, states, longTermByProvider, longTermSources = {} } = window.MF_DATA;
  const latestRuns = runs.filter(run => run.latest);
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const median = values => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };
  const formatValue = (value, question) => {
    if (question.type === 'probability' || question.unit === 'percent') return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
    if (question.unit === 'trillion USD') return `$${value.toFixed(1)}T`;
    return `$${Math.round(value).toLocaleString()}B`;
  };
  const questionStats = question => {
    const values = latestRuns.map(run => run.answers[question.id].value);
    return { values, median: median(values), min: Math.min(...values), max: Math.max(...values), spread: Math.max(...values) - Math.min(...values) };
  };

  let activeCategory = 'All';
  let activeProvider = 'All';
  const providerLabels = { OpenAI: 'OpenAI', Anthropic: 'Anthropic', Google: 'Gemini', xAI: 'xAI', Meta: 'Meta', DeepSeek: 'DeepSeek' };

  function renderOrbit() {
    const target = $('#orbit-models');
    latestRuns.forEach((run, index) => {
      const angle = (-90 + index * (360 / latestRuns.length)) * Math.PI / 180;
      const radius = 45;
      const mobileRadius = 38;
      const node = document.createElement('div');
      node.className = 'orbit-model';
      node.style.setProperty('--x', `${50 + Math.cos(angle) * radius}%`);
      node.style.setProperty('--y', `${50 + Math.sin(angle) * radius}%`);
      node.style.setProperty('--mx', `${50 + Math.cos(angle) * mobileRadius}%`);
      node.style.setProperty('--my', `${50 + Math.sin(angle) * mobileRadius}%`);
      node.style.setProperty('--model-color', run.color);
      node.innerHTML = `<span>${run.provider}</span><small>${run.model}</small>`;
      target.appendChild(node);
    });
    $('#stat-models').textContent = latestRuns.length;
    $('#stat-runs').textContent = runs.length;
  }

  function miniRange(question, stats, marker = stats.median) {
    if (question.type !== 'probability') {
      const max = Math.max(...stats.values) * 1.12;
      return `<div class="mini-range numeric"><span style="left:${(stats.min / max) * 100}%"></span><b style="left:${(marker / max) * 100}%"></b><i style="width:${(stats.max / max) * 100}%"></i></div>`;
    }
    return `<div class="mini-range"><span style="left:${stats.min}%"></span><b style="left:${marker}%"></b><i style="left:${stats.min}%;width:${Math.max(stats.spread, 1)}%"></i></div>`;
  }

  function renderSignals() {
    const probabilityQuestions = questions.filter(q => q.type === 'probability');
    const ranked = probabilityQuestions.map(question => ({ question, stats: questionStats(question) }));
    const mostLikely = [...ranked].sort((a, b) => b.stats.median - a.stats.median)[0];
    const mostDivided = [...ranked].sort((a, b) => b.stats.spread - a.stats.spread)[0];
    const shifts = probabilityQuestions.map(question => {
      const deltas = latestRuns.map(run => {
        const previous = runs.filter(r => r.provider === run.provider && !r.latest).sort((a, b) => b.date.localeCompare(a.date))[0];
        return previous ? run.answers[question.id].value - previous.answers[question.id].value : 0;
      });
      return { question, delta: median(deltas), current: questionStats(question) };
    });
    const biggestShift = [...shifts].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];

    const cards = [
      { label: 'Strongest consensus', item: mostLikely, value: formatValue(mostLikely.stats.median, mostLikely.question), detail: `${mostLikely.stats.spread}-point model spread`, tone: 'acid' },
      { label: 'Biggest disagreement', item: mostDivided, value: `${mostDivided.stats.spread} pts`, detail: `${mostDivided.stats.min}% low · ${mostDivided.stats.max}% high`, tone: 'blue' },
      { label: 'Largest shift since prior models', item: { question: biggestShift.question, stats: biggestShift.current }, value: `${biggestShift.delta >= 0 ? '+' : ''}${Math.round(biggestShift.delta)} pts`, detail: `${formatValue(biggestShift.current.median, biggestShift.question)} median now`, tone: 'coral' }
    ];

    $('#signal-grid').innerHTML = cards.map((card, index) => `
      <button class="signal-card ${card.tone}" data-question="${card.item.question.id}">
        <span class="signal-index">0${index + 1}</span>
        <span class="signal-label">${card.label}</span>
        <strong>${card.value}</strong>
        <h3>${card.item.question.title}</h3>
        ${miniRange(card.item.question, card.item.stats)}
        <span class="signal-detail">${card.detail}</span>
        <span class="card-arrow">↗</span>
      </button>`).join('');
  }

  function renderCategoryFilters() {
    const options = ['All', ...categories];
    $('#category-list').innerHTML = options.map(category =>
      `<button type="button" class="category-button${category === activeCategory ? ' active' : ''}" data-category="${category}">${category}</button>`
    ).join('');
  }

  function renderProviderFilters() {
    const options = [{ key: 'All', label: 'All models', color: '#d9ff57' }, ...latestRuns.map(run => ({ key: run.provider, label: providerLabels[run.provider] || run.provider, color: run.color }))];
    $('#provider-list').innerHTML = options.map(option =>
      `<button type="button" class="category-button provider-button${option.key === activeProvider ? ' active' : ''}" style="--provider-color:${option.color}" data-provider="${option.key}"><i></i>${option.label}</button>`
    ).join('');
  }

  function renderQuestions() {
    const filtered = questions.filter(question => activeCategory === 'All' || question.category === activeCategory);
    const providerRun = activeProvider === 'All' ? null : latestRuns.find(run => run.provider === activeProvider);
    const viewLabel = providerRun ? `${providerLabels[providerRun.provider] || providerRun.provider} forecast` : 'median';
    const markerColor = providerRun ? providerRun.color : '#d9ff57';
    $('#result-count').textContent = `${filtered.length} question${filtered.length === 1 ? '' : 's'}`;
    $('#forecast-label').textContent = viewLabel;
    $('.legend').style.setProperty('--legend-color', markerColor);
    $('#empty-state').hidden = filtered.length !== 0;
    $('#question-grid').innerHTML = filtered.map(question => {
      const stats = questionStats(question);
      const displayValue = providerRun ? providerRun.answers[question.id].value : stats.median;
      return `<button class="question-card" style="--marker-color:${markerColor}" data-question="${question.id}">
        <span class="question-top"><b>${question.id}</b><i>${question.category}</i><em>↗</em></span>
        <span class="question-title">${question.title}</span>
        <span class="question-result">
          <strong>${formatValue(displayValue, question)}</strong>
          <span>${viewLabel}</span>
        </span>
        ${miniRange(question, stats, displayValue)}
        <span class="question-range">${formatValue(stats.min, question)} low <i>·</i> ${formatValue(stats.max, question)} high</span>
      </button>`;
    }).join('');
  }

  function openQuestion(id) {
    const question = questions.find(q => q.id === id);
    if (!question) return;
    const stats = questionStats(question);
    const providerRun = activeProvider === 'All' ? null : latestRuns.find(run => run.provider === activeProvider);
    const primaryValue = providerRun ? providerRun.answers[id].value : stats.median;
    const primaryLabel = providerRun ? `${providerLabels[providerRun.provider] || providerRun.provider} forecast` : 'median forecast';
    const orderedRuns = [...latestRuns].sort((a, b) => {
      if (providerRun && a.provider === providerRun.provider) return -1;
      if (providerRun && b.provider === providerRun.provider) return 1;
      return b.answers[id].value - a.answers[id].value;
    });
    const modelRows = orderedRuns.map(run => {
      const answer = run.answers[id];
      const previous = runs.filter(r => r.provider === run.provider && !r.latest).sort((a, b) => b.date.localeCompare(a.date))[0];
      const delta = previous ? answer.value - previous.answers[id].value : 0;
      return `<article class="model-answer${providerRun && run.provider === providerRun.provider ? ' selected' : ''}">
        <div class="model-answer-head">
          <span class="model-swatch" style="--swatch:${run.color}"></span>
          <div><b>${run.model}</b><small>${run.provider} · ${run.date}</small></div>
          <strong>${formatValue(answer.value, question)}</strong>
          <em class="${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '↑' : '↓'} ${formatValue(Math.abs(delta), question)}</em>
        </div>
        <p>${answer.rationale}</p>
      </article>`;
    }).join('');

    $('#dialog-content').innerHTML = `
      <div class="dialog-kicker"><span>${question.id}</span>${question.category}</div>
      <h2>${question.title}</h2>
      <div class="dialog-summary">
        <div><strong>${formatValue(primaryValue, question)}</strong><span>${primaryLabel}</span></div>
        <div><strong>${formatValue(stats.min, question)}–${formatValue(stats.max, question)}</strong><span>model range</span></div>
        <div><strong>${latestRuns.length}</strong><span>current models</span></div>
      </div>
      <div class="dialog-scale">${miniRange(question, stats)}</div>
      <div class="dialog-subhead"><h3>How each model sees it</h3><span>Change from prior run</span></div>
      <div class="model-answer-list">${modelRows}</div>
      <p class="dialog-footnote">Illustrative prototype responses. Production data will preserve the exact model wording.</p>`;
    $('#detail-dialog').showModal();
    document.body.classList.add('dialog-open');
  }

  function stateMedians() {
    return states.map((state, index) => ({ ...state, probability: median(Object.values(longTermByProvider).map(values => values[index])) }));
  }

  function renderEndStates() {
    const longTermEntries = Object.entries(longTermByProvider).map(([provider, values]) => {
      const run = latestRuns.find(item => item.provider === provider);
      return {
        provider,
        values,
        model: longTermSources[provider]?.model || run?.model || provider,
        label: longTermSources[provider]?.label || provider,
        color: run?.color || '#11120f'
      };
    });
    const medians = stateMedians();
    const total = medians.reduce((sum, state) => sum + state.probability, 0);
    const normalized = medians.map(state => ({ ...state, display: (state.probability / total) * 100 }));
    $('#consensus-bar').innerHTML = normalized.map(state => `<button style="width:${state.display}%;--state:${state.color}" title="${state.name}: ${state.probability}%" data-state="${state.id}"><span>${state.id}</span></button>`).join('');
    $('#consensus-legend').innerHTML = normalized.map(state => `<button data-state="${state.id}"><i style="--state:${state.color}"></i><span>${state.id}. ${state.name}</span><b>${state.probability}%</b></button>`).join('');

    const leader = [...medians].sort((a, b) => b.probability - a.probability)[0];
    $('#end-leader').innerHTML = `<p class="kicker">Most likely ending</p><span class="leader-number">${leader.id}</span><h2>${leader.name}</h2><strong>${leader.probability}%</strong><p>${leader.description}</p>`;

    $('#state-grid').innerHTML = medians.map(state => {
      const providerValues = longTermEntries.map(entry => ({ ...entry, value: entry.values[state.id - 1] })).sort((a, b) => b.value - a.value);
      return `<article class="state-card" id="state-${state.id}" style="--state:${state.color}">
        <div class="state-card-head"><span>${String(state.id).padStart(2, '0')}</span><i>${state.family}</i><strong>${state.probability}%</strong></div>
        <h3>${state.name}</h3><p>${state.description}</p>
        <div class="state-models">${providerValues.map(item => `<span title="${item.label}: ${item.value}%"><i style="height:${Math.max(item.value * 2.4, 4)}px"></i><small>${item.provider.slice(0, 2)}</small></span>`).join('')}</div>
        <div class="state-range"><span>${providerValues.at(-1).value}% low</span><span>${providerValues[0].value}% high</span></div>
      </article>`;
    }).join('');

    const colors = states.map(state => state.color);
    $('#model-bars').innerHTML = longTermEntries.map(entry => {
      return `<div class="model-bar-row"><div class="model-bar-label"><span class="model-swatch" style="--swatch:${entry.color}"></span><b>${entry.provider}</b><small>${entry.model}</small></div><div class="model-stack">${entry.values.map((value, index) => `<button style="width:${value}%;--state:${colors[index]}" title="${states[index].name}: ${value}%"><span>${value >= 7 ? value : ''}</span></button>`).join('')}</div></div>`;
    }).join('');
  }

  function switchView(name) {
    const valid = ['2030', 'end-states', 'method'];
    const viewName = valid.includes(name) ? name : '2030';
    $$('.view').forEach(view => { view.hidden = view.dataset.view !== viewName; });
    $$('[data-nav]').forEach(link => link.classList.toggle('active', link.dataset.nav === viewName));
    document.documentElement.dataset.view = viewName;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  document.addEventListener('click', event => {
    const questionTarget = event.target.closest('[data-question]');
    if (questionTarget) openQuestion(questionTarget.dataset.question);

    const categoryTarget = event.target.closest('[data-category]');
    if (categoryTarget) {
      activeCategory = categoryTarget.dataset.category;
      renderCategoryFilters();
      renderQuestions();
    }

    const providerTarget = event.target.closest('[data-provider]');
    if (providerTarget) {
      activeProvider = providerTarget.dataset.provider;
      renderProviderFilters();
      renderQuestions();
    }

    const stateTarget = event.target.closest('[data-state]');
    if (stateTarget) document.querySelector(`#state-${stateTarget.dataset.state}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  $('#dialog-close').addEventListener('click', () => $('#detail-dialog').close());
  $('#detail-dialog').addEventListener('click', event => {
    if (event.target !== $('#detail-dialog')) return;
    const rect = $('#detail-dialog').getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $('#detail-dialog').close();
  });
  $('#detail-dialog').addEventListener('close', () => document.body.classList.remove('dialog-open'));
  $('#prototype-note button').addEventListener('click', () => $('#prototype-note').remove());
  window.addEventListener('hashchange', () => switchView(location.hash.slice(1)));

  renderOrbit();
  renderSignals();
  renderCategoryFilters();
  renderProviderFilters();
  renderQuestions();
  renderEndStates();
  switchView(location.hash.slice(1));
})();
