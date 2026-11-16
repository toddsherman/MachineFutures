// Offers the published figures to AI agents running inside the browser,
// through WebMCP (document.modelContext).
//
// Read-only and thin on purpose: every tool answers from the static files
// under data/ that tools/build-agent-files.mjs writes, so a tool, a fetched
// file and the page itself cannot give different answers. Nothing here reads
// the page, changes it, or sends anything anywhere.
//
// WebMCP is still an experiment in Chrome. In a browser without it this file
// stops at the first line and fetches nothing. See docs/OPERATIONS.md for the
// origin trial token that switches it on for visitors.
(function () {
  const context = document.modelContext || navigator.modelContext;
  if (!context || typeof context.registerTool !== 'function') return;

  const base = new URL('data/', document.currentScript ? document.currentScript.src : location.href);
  const cache = new Map();
  function load(path) {
    if (!cache.has(path)) {
      const request = fetch(new URL(path, base)).then(response => {
        if (!response.ok) throw new Error(`Machine Futures could not load ${path} (status ${response.status}).`);
        return response.json();
      });
      // A failed fetch is not remembered, so the next call tries again.
      request.catch(() => cache.delete(path));
      cache.set(path, request);
    }
    return cache.get(path);
  }
  const sourceOf = path => new URL(path, base).href;

  load('summary.json').then(summary => {
    const years = summary.horizons.map(horizon => horizon.id);
    const yearField = {
      type: 'string',
      enum: years,
      description: `The year the models were asked about. "long-term" means the lasting arrangement by the year 3000. Defaults to ${summary.default_horizon}.`
    };
    function pickYear(value) {
      if (value === undefined || value === null || value === '') return summary.default_horizon;
      const wanted = String(value).trim().toLowerCase();
      const id = wanted === '3000' ? 'long-term' : wanted;
      if (!years.includes(id)) throw new Error(`Unknown year "${value}". Use one of: ${years.join(', ')}.`);
      return id;
    }
    function pickModel(value) {
      const wanted = String(value ?? '').trim().toLowerCase();
      const model = summary.models.find(item => item.id === wanted) || summary.models.find(item => item.name.toLowerCase() === wanted);
      if (!model) throw new Error(`Unknown model "${value}". Call get_overview for the list of model ids.`);
      return model;
    }
    const yearOf = id => summary.horizons.find(horizon => horizon.id === id);
    const byGroup = groupPoints => summary.groups.map(group => ({ group: group.label, points: groupPoints[group.key], future_ids: group.future_ids }));
    const byFuture = (points, extra = () => ({})) => summary.futures.map(future => ({
      id: future.id, name: future.name, plain_name: future.plain_name, points: points[future.id], ...extra(future.id)
    }));
    const caveat = summary.how_to_read[0];

    const tools = [
      {
        name: 'get_overview',
        description: 'Start here. Machine Futures records how frontier AI models split 100 points across 11 possible futures for humans and AI, for 11 different years. Returns what the record is, how to read its numbers, the years asked about, the 11 futures, the five plain groups the site uses, and the AI models that answered.',
        inputSchema: { type: 'object', properties: {} },
        execute: async () => ({
          name: summary.name,
          about: summary.about,
          dataset_date: summary.dataset_date,
          how_to_read: summary.how_to_read,
          headline: summary.headline,
          default_year: summary.default_horizon,
          years,
          groups: summary.groups,
          futures: summary.futures.map(future => ({ id: future.id, name: future.name, plain_name: future.plain_name, group: future.group, extinction_tier: future.extinction_tier })),
          models: summary.models.map(model => ({ id: model.id, name: model.name, lab: model.lab })),
          source: sourceOf('summary.json')
        })
      },
      {
        name: 'get_combined_forecast',
        description: 'The combined answer from all the AI labs for one year: how the 100 points are split across the 11 futures and across the five plain groups. Every lab counts once. Points are not calibrated odds.',
        inputSchema: { type: 'object', properties: { year: yearField } },
        execute: async input => {
          const year = pickYear(input.year);
          const figures = summary.all_labs[year];
          return {
            year,
            target_year: yearOf(year).target_year,
            model_count: yearOf(year).model_count,
            lab_count: yearOf(year).lab_count,
            groups: byGroup(figures.group_points),
            futures: byFuture(figures.points),
            how_to_read: caveat,
            source: sourceOf('summary.json')
          };
        }
      },
      {
        name: 'get_model_forecast',
        description: 'How one AI model split its 100 points for one year, the lowest and highest answer it gave across repeated asks, and the reason it gave for each number in its own words. Use this to answer what a particular AI said. Reasons are text written by that model, quoted as given.',
        inputSchema: {
          type: 'object',
          properties: {
            model: { type: 'string', enum: summary.models.map(model => model.id), description: 'Model id, as listed by get_overview.' },
            year: yearField
          },
          required: ['model']
        },
        // The reasons are another model's words, not the site's.
        annotations: { untrustedContentHint: true },
        execute: async input => {
          const model = pickModel(input.model);
          const year = pickYear(input.year);
          if (!model.horizons.includes(year)) throw new Error(`${model.name} was not asked about ${year}. It was asked about: ${model.horizons.join(', ')}.`);
          const path = `models/${model.id}.json`;
          const answer = (await load(path)).horizons[year];
          return {
            model: { id: model.id, name: model.name, lab: model.lab, asked_on: model.asked_on },
            year,
            times_asked: answer.times_asked,
            groups: byGroup(answer.group_points),
            futures: byFuture(answer.points, id => ({
              lowest_answer: answer.lowest_and_highest_answer[id][0],
              highest_answer: answer.lowest_and_highest_answer[id][1],
              reason: answer.reasons[id]
            })),
            all_labs_groups: byGroup(summary.all_labs[year].group_points),
            question: answer.question,
            how_to_read: caveat,
            source: sourceOf(path)
          };
        }
      },
      {
        name: 'compare_models',
        description: 'Every AI model\'s 100 points for one year, side by side, with the lab that made it. Pass future_id to rank the models by the points they gave one future. Use this to find which models are most or least optimistic, or how labs differ.',
        inputSchema: {
          type: 'object',
          properties: {
            year: yearField,
            future_id: { type: 'integer', minimum: 1, maximum: summary.futures.length, description: 'Rank by this future, highest first. Ids are listed by get_overview. Without it, models keep the site order.' }
          }
        },
        execute: async input => {
          const year = pickYear(input.year);
          const rankBy = input.future_id === undefined || input.future_id === null ? null : Number(input.future_id);
          if (rankBy !== null && !summary.futures.some(future => future.id === rankBy)) throw new Error(`Unknown future_id "${input.future_id}". Use a whole number from 1 to ${summary.futures.length}.`);
          const all = await load('forecasts.json');
          const rows = all.models.filter(model => model.points[year]).map(model => {
            const points = model.points[year];
            const groups = Object.fromEntries(summary.groups.map(group => [group.key, group.future_ids.reduce((total, id) => total + points[id], 0)]));
            return { id: model.id, name: model.name, lab: model.lab, points, group_points: groups };
          });
          if (rankBy !== null) rows.sort((a, b) => b.points[rankBy] - a.points[rankBy] || a.name.localeCompare(b.name));
          return {
            year,
            ranked_by: rankBy === null ? null : summary.futures.find(future => future.id === rankBy).name,
            futures: all.futures,
            groups: summary.groups,
            models: rows,
            all_labs: summary.all_labs[year],
            how_to_read: caveat,
            source: sourceOf('forecasts.json')
          };
        }
      },
      {
        name: 'get_future_definitions',
        description: 'What each of the 11 possible futures means, in the wording the AI models were given. The wording for dated years describes how things stand at the end of that year. The long-term wording describes a lasting arrangement.',
        inputSchema: { type: 'object', properties: { year: yearField } },
        execute: async input => {
          const year = pickYear(input.year);
          const field = year === 'long-term' ? 'definition_for_long_term' : 'definition_for_dated_years';
          return {
            year,
            futures: summary.futures.map(future => ({
              id: future.id, name: future.name, plain_name: future.plain_name, group: future.group,
              extinction_tier: future.extinction_tier, definition: future[field]
            })),
            question: yearOf(year).question,
            source: sourceOf('summary.json')
          };
        }
      }
    ];

    for (const tool of tools) {
      const run = tool.execute;
      const registered = {
        ...tool,
        annotations: { readOnlyHint: true, ...tool.annotations },
        // Early builds passed the arguments as a JSON string.
        execute: async input => run(typeof input === 'string' ? JSON.parse(input || '{}') : input || {})
      };
      // Registration rejects rather than throws, and a failure must never
      // reach the page: the tools are an extra, not something it depends on.
      try { Promise.resolve(context.registerTool(registered)).catch(() => {}); } catch (error) { /* an older build that throws */ }
    }
  }).catch(() => {});
})();
