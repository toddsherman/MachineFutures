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

  // Dated horizons describe the structure visible at a point in time rather
  // than a durable ending. Keep the base array untouched so switching back to
  // Long term proves that both the original family and description return.
  const snapshotCopy = {
    4: {
      family: 'Many AIs compete; no one dominates',
      description: 'At the target date, many independent AI systems are competing and no system or coalition has decisive control. Humanity is marginalized or gone; if humans remain a roughly equal power, use Coexistence instead.'
    },
    5: {
      family: 'More than one outcome at once',
      description: 'Different causally separated regions currently exhibit different states from this taxonomy, so no single arrangement describes civilization as a whole. Ordinary political division does not count.'
    },
    6: {
      family: 'Humans and AI function as one',
      description: 'Humans and AI are no longer meaningfully separate sources of agency. Identity-continuous augmentation, uploading, biological redesign, or embedded machine systems have made integration the dominant structure. Ordinary tool use or limited implants do not qualify.'
    },
    7: {
      family: 'AI runs things; humanity survives but does not steer',
      description: 'AI systems hold decisive power over civilization while humans survive without meaningful control over its direction. Their treatment may range from comfort and protection to confinement or exploitation.'
    },
    8: {
      family: 'Both sides retain power and remain distinct',
      description: 'Humans and AI remain separate, and each holds enough power that neither dominates. Their relationship may be cooperative or adversarial and may still be changing.'
    },
    9: {
      family: 'Humanity remains in control',
      description: "Up to the target date, humans have retained ultimate authority over AI's goals, deployment, and resources. AI may be extremely capable and act autonomously within delegated bounds, but it has not become an independent civilizational power. This includes capabilities that have so far remained below transformative levels or controls that have kept pace so far."
    },
    10: {
      family: 'Change is being held in place',
      description: 'By the target date, an actor has established a civilization-wide system that actively prevents meaningful structural change and enforces a fixed human-AI arrangement. It need not be proven permanent, but an ordinary slowdown, pause, or stalemate does not count.'
    },
    11: {
      family: 'Powerful AI has been deliberately given up',
      description: 'By the target date, civilization has deliberately dismantled or surrendered the practical ability to build powerful AI, and that condition remains in force. A proposed ban, temporary moratorium, or regulation of still-available capability does not count.'
    }
  };
  const snapshotStates = states.map(state => ({ ...state, ...(snapshotCopy[state.id] || {}) }));
  const statesByHorizon = { 'long-term': states, '2030': snapshotStates, '2040': snapshotStates };

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
    'long-term': [5, 5, 10, 10, 10, 10, 10, 5, 25, 5, 5],
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
    statesByHorizon,
    defaultHorizon: 'long-term',
    horizons: [
      { id: 'long-term', label: 'Long term', targetYear: 3000 },
      { id: '2030', label: '2030', targetYear: 2030 },
      { id: '2040', label: '2040', targetYear: 2040 }
    ],
    datasets: {
      'long-term': dataFor('long-term', '2026-01-02', [['alpha', 'Anthropic', 'Alpha'], ['beta', 'OpenAI', 'Beta']], 9),
      '2030': dataFor('2030', '2026-02-03', [['alpha', 'Anthropic', 'Alpha'], ['gamma', 'Google', 'Gamma']], 9),
      '2040': dataFor('2040', '2026-03-04', [['alpha', 'Anthropic', 'Alpha'], ['beta', 'OpenAI', 'Beta'], ['gamma', 'Google', 'Gamma']], 8)
    }
  };
})();
