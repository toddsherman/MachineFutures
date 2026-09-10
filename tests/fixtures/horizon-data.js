(function () {
  const states = [
    ['Terminal Silence', 'Everything ends', '#ff6f61', 'gone'],
    ['The Inheritance', 'Humanity is gone, but the AI lives on', '#f39a67', 'gone'],
    ['Bootloader', 'Humanity is gone, but the AI lives on', '#d9b84f', 'gone'],
    ['Machine Ecology', 'No one ever wins', '#cf70b2', 'risk'],
    ['The Diaspora', 'More than one outcome at once', '#ee77a4', 'risk'],
    ['The Merger', 'The two become one', '#b8d35e'],
    ['The Preserve', 'The AI runs things', '#68c58f'],
    ['Coexistence', 'Neither side wins', '#46c7bd'],
    ['The Held Leash', 'Humanity keeps control', '#54a9e4'],
    ['The Lock-in', 'Everything freezes in place', '#777be8'],
    ['The Renunciation', 'Walking it back', '#a77ad8']
  ].map(([name, family, color, extinction], index) => ({
    id: index + 1,
    name,
    family,
    color,
    ...(extinction ? { extinction } : {}),
    description: `${name} fixture description.`
  }));

  const makeRun = (horizon, provider, label, probabilities, date) => ({
    horizon,
    provider,
    model: label,
    label,
    shortLabel: label.slice(0, 2).toUpperCase(),
    promptVersion: 1,
    sampleCount: 20,
    date,
    probabilities: Object.fromEntries(probabilities.map((value, index) => [index + 1, value])),
    range: Object.fromEntries(probabilities.map((value, index) => [index + 1, [value, value]])),
    quartiles: Object.fromEntries(probabilities.map((value, index) => [index + 1, [value, value]])),
    exposurePublished: { value: probabilities.slice(0, 5).reduce((sum, value) => sum + value, 0), se: 0.4, draws: 2000 },
    rationales: Object.fromEntries(states.map(state => [state.id, `${horizon} ${label} rationale for ${state.name}.`]))
  });

  const vectors = {
    'long-term': [5, 5, 25, 10, 10, 10, 10, 5, 10, 5, 5],
    '2030': [2, 2, 4, 4, 3, 5, 5, 15, 45, 10, 5],
    '2040': [3, 3, 8, 7, 6, 12, 12, 28, 10, 6, 5]
  };

  const dataFor = (horizon, date, models, leader) => ({
    datasetDate: date.split('-').slice(1).concat(date.slice(2, 4)).join('.'),
    endStateRuns: Object.fromEntries(models.map(([key, provider, label]) => [key, makeRun(horizon, provider, label, vectors[horizon], date)])),
    leaderHistory: [
      { date: '2026-01-01', stateId: leader, share: vectors[horizon][leader - 1], models: 1, changed: true },
      { date, stateId: leader, share: vectors[horizon][leader - 1], models: models.length, changed: false }
    ]
  });

  window.MF_DATA = {
    states,
    defaultHorizon: 'long-term',
    horizons: [
      { id: 'long-term', label: 'Long term', targetYear: 3000 },
      { id: '2030', label: '2030', targetYear: 2030 },
      { id: '2040', label: '2040', targetYear: 2040 }
    ],
    datasets: {
      'long-term': dataFor('long-term', '2026-01-02', [['alpha', 'Anthropic', 'Alpha'], ['beta', 'OpenAI', 'Beta']], 3),
      '2030': dataFor('2030', '2026-02-03', [['alpha', 'Anthropic', 'Alpha'], ['gamma', 'Google', 'Gamma']], 9),
      '2040': dataFor('2040', '2026-03-04', [['alpha', 'Anthropic', 'Alpha'], ['beta', 'OpenAI', 'Beta'], ['gamma', 'Google', 'Gamma']], 8)
    }
  };
})();
