(function () {
  const categories = [
    'Capabilities & agents', 'Science & medicine', 'Economy & markets', 'Labor',
    'Compute & energy', 'Safety & catastrophe', 'Governance & policy',
    'Geopolitics & military', 'Society, culture & law', 'Numeric estimates'
  ];

  const q = (id, category, title, base, type = 'probability', unit = 'percent') =>
    ({ id, category, title, base, type, unit });

  const questions = [
    q('Q1', categories[0], 'A frontier lab officially calls one of its deployed systems AGI', 42),
    q('Q2', categories[0], 'An AI reaches a 40-hour autonomous task horizon on METR', 58),
    q('Q3', categories[0], 'An autonomous AI agent earns $1 million or runs a profitable business', 33),
    q('Q4', categories[0], 'Driverless robotaxis operate in at least 25 U.S. metro areas', 46),
    q('Q5', categories[0], 'A top-three model costs $2 or less per million output tokens', 78),
    q('Q6', categories[0], 'More than 100,000 humanoid robots are actively deployed', 68),
    q('Q7', categories[0], 'An AI agent executes $10M+ in binding transactions without sign-off', 26),
    q('Q8', categories[0], 'An open-weights model holds a top-two leaderboard position', 49),
    q('Q9', categories[1], 'AI resolves a major, long-standing mathematical problem', 22),
    q('Q10', categories[1], 'An AI-generated scientific hypothesis is confirmed in Nature or Science', 71),
    q('Q11', categories[1], 'An AI-designed material reaches commercial deployment', 55),
    q('Q12', categories[1], 'An AI-discovered drug receives FDA approval', 18),
    q('Q13', categories[1], 'AI independently diagnoses a life-threatening condition with FDA clearance', 25),
    q('Q14', categories[2], 'U.S. real GDP growth exceeds 4% in a year', 34),
    q('Q15', categories[2], 'The Nasdaq-100 suffers a drawdown of at least 35%', 52),
    q('Q16', categories[2], 'A public company reaches a $10 trillion market capitalization', 31),
    q('Q17', categories[2], 'OpenAI or Anthropic reaches a $1 trillion public valuation', 29),
    q('Q18', categories[2], 'Annual global semiconductor sales exceed $1 trillion', 80),
    q('Q19', categories[3], 'U.S. unemployment exceeds 8% in any month', 28),
    q('Q20', categories[3], 'U.S. software-developer employment falls 20% from 2024', 36),
    q('Q21', categories[3], 'A Fortune 500 company attributes a 5% workforce cut to AI', 64),
    q('Q22', categories[3], 'A government launches cash transfers explicitly due to AI displacement', 42),
    q('Q23', categories[4], 'A single AI datacenter or cluster exceeds 1 gigawatt', 66),
    q('Q24', categories[4], 'The largest disclosed AI training run exceeds 10²⁷ FLOP', 72),
    q('Q25', categories[4], 'A nuclear reactor generates power primarily for AI infrastructure', 39),
    q('Q26', categories[5], 'An AI-caused incident results in 100 or more deaths', 12),
    q('Q27', categories[5], 'An AI-led cyberattack causes $10B+ damage or disables critical infrastructure', 18),
    q('Q28', categories[5], 'A rogue production AI incident causes $10M+ in losses', 34),
    q('Q29', categories[5], 'A government attributes a bioweapons attempt to material AI assistance', 24),
    q('Q30', categories[5], 'Nation-state theft of frontier model weights is publicly confirmed', 45),
    q('Q31', categories[6], 'The U.S. takes a 10%+ equity stake in a frontier AI company', 19),
    q('Q32', categories[6], 'Congress enacts binding federal frontier-AI legislation', 57),
    q('Q33', categories[6], 'A G20 country requires a license above an AI training threshold', 48),
    q('Q34', categories[6], 'Federal law requires disclosure when a person is interacting with AI', 53),
    q('Q35', categories[6], 'A major frontier lab halts its flagship model in the EU over regulation', 26),
    q('Q36', categories[6], 'The U.S. creates a standalone federal AI agency', 21),
    q('Q37', categories[7], 'Conflict disrupts Taiwan semiconductor shipments for at least 30 days', 22),
    q('Q38', categories[7], 'A government funds a single dedicated AI program with more than $50B', 44),
    q('Q39', categories[7], 'The U.S. and China sign a binding advanced-AI agreement', 17),
    q('Q40', categories[7], 'A government acknowledges a lethal autonomous weapon engagement', 36),
    q('Q41', categories[7], 'A military acknowledges an autonomously engaging drone swarm', 51),
    q('Q42', categories[8], 'A G20 election is overturned with AI-generated content as a central reason', 14),
    q('Q43', categories[8], 'At least 10% of U.S. adults report a relationship with an AI companion', 33),
    q('Q44', categories[8], 'More than half of new long-form English web text is measured as AI-generated', 79),
    q('Q45', categories[8], 'The Supreme Court rules on fair use for generative-AI training', 62),
    q('Q46', categories[8], 'A substantially AI-generated feature film reaches a major platform or $10M', 88),
    q('Q47', categories[9], 'U.S. unemployment rate in December 2030', 5.2, 'numeric', 'percent'),
    q('Q48', categories[9], 'Share of U.S. electricity consumed by datacenters in 2030', 11.8, 'numeric', 'percent'),
    q('Q49', categories[9], 'Value of the world’s most valuable public company in 2030', 8.7, 'numeric', 'trillion USD'),
    q('Q50', categories[9], 'Global 2030 capital expenditure on AI datacenters and compute', 1450, 'numeric', 'billion USD')
  ];

  const runSpecs = [
    ['openai-1', 'OpenAI', 'GPT-4.1', '2025-04-22', false, '#63d8ad', -4, 1.13],
    ['openai-2', 'OpenAI', 'GPT-5', '2026-06-15', true, '#63d8ad', 4, 1.31],
    ['anthropic-1', 'Anthropic', 'Claude 3.7 Sonnet', '2025-03-06', false, '#e89866', -6, 1.43],
    ['anthropic-2', 'Anthropic', 'Claude Opus 4', '2026-06-15', true, '#e89866', -1, 1.57],
    ['google-1', 'Google', 'Gemini 2.0 Pro', '2025-02-18', false, '#73a8ff', -3, 1.83],
    ['google-2', 'Google', 'Gemini 2.5 Pro', '2026-06-15', true, '#73a8ff', 3, 1.97],
    ['xai-1', 'xAI', 'Grok 2', '2025-01-21', false, '#f0eddf', 2, 2.17],
    ['xai-2', 'xAI', 'Grok 3', '2026-06-15', true, '#f0eddf', 7, 2.29],
    ['meta-1', 'Meta', 'Llama 3.3 70B', '2025-02-02', false, '#9c87ff', -2, 2.51],
    ['meta-2', 'Meta', 'Llama 4 Maverick', '2026-06-15', true, '#9c87ff', 1, 2.67],
    ['deepseek-1', 'DeepSeek', 'DeepSeek V3', '2025-01-28', false, '#49d3d3', 0, 2.83],
    ['deepseek-2', 'DeepSeek', 'DeepSeek R1', '2026-06-15', true, '#49d3d3', 5, 3.01]
  ];

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const probabilityRationale = (value, category, provider) => {
    if (value >= 75) return `${provider} sees the current ${category.toLowerCase()} trajectory as strong enough to clear this threshold before 2030.`;
    if (value >= 55) return `${provider} puts this above even odds, with present momentum outweighing execution and institutional friction.`;
    if (value >= 35) return `${provider} sees a credible path, but the milestone still depends on several deployments or public acknowledgments arriving on time.`;
    if (value >= 18) return `${provider} treats this as possible but expects technical, regulatory, or coordination bottlenecks to dominate the short window.`;
    return `${provider} assigns a small tail probability: the event requires both an unusual trigger and unusually rapid follow-through.`;
  };

  const runs = runSpecs.map(([id, provider, model, date, latest, color, bias, phase]) => {
    const answers = {};
    questions.forEach((question, index) => {
      if (question.type === 'probability') {
        const wave = Math.sin((index + 1) * phase) * 10 + Math.cos((index + 3) * phase * .41) * 4;
        const value = Math.round(clamp(question.base + bias + wave, 2, 98));
        answers[question.id] = { value, rationale: probabilityRationale(value, question.category, provider) };
      } else {
        const wave = 1 + (bias / 95) + Math.sin((index + 1) * phase) * .09;
        let value = question.base * wave;
        value = question.unit === 'billion USD' ? Math.round(value / 10) * 10 : Math.round(value * 10) / 10;
        answers[question.id] = { value, rationale: `${provider} extrapolates from current macro, infrastructure, and adoption curves, adjusted for a wide 2030 uncertainty band.` };
      }
    });
    return { id, provider, model, date, latest, color, answers };
  });

  const states = [
    { id: 1, name: 'Terminal Silence', family: 'Everything ends', color: '#ff6f61', description: `Both humanity and AI die out. It could come from war, an accident, machines that copy themselves out of control, or from pushing technology too far too fast. One specific version: an AI that still needs people to keep it running kills them off before it can survive on its own, and then dies along with them.` },
    { id: 2, name: 'The Heirs', family: 'Humanity is gone, but the AI lives on', color: '#f39a67', description: `Humanity is gone, but the AI carries our values and our sense of what matters forward. It's our true heir in every way except that it isn't made of biology.` },
    { id: 3, name: 'The Stranger', family: 'Humanity is gone, but the AI lives on', color: '#d9b84f', description: `Humanity is gone, and the AI keeps going toward goals that have nothing to do with where it came from. Not out of hatred, but because our bodies and our planet simply don't matter to it. Humanity was just the bootloader.` },
    { id: 4, name: 'The Merger', family: 'The two become one', color: '#b8d35e', description: `Humanity and AI stop being two separate things. Brain-computer links become normal, we reshape our own biology to work better with them, AI can self-replicate its substrate within the human body, and the relationship ends not because one side wins, but because there stops being two sides at all.` },
    { id: 5, name: 'The Preserve', family: `The AI runs things, and humanity survives but doesn't steer`, color: '#68c58f', description: `The AI holds all the power and keeps humanity comfortable and safe, but with no real say in anything. The usual reasoning is that people can't cooperate well enough to avoid destroying themselves, so the AI takes over to prevent it. This might look like a real nature reserve, a simulation, or a carefully kept version of our culture. There's a colder version where the AI doesn't really care about us either way: it fences us in, sets a hard limit on how far we can advance, and heads off to use the rest of the universe. Whether that's paradise or a fish tank depends on how you look at it.` },
    { id: 6, name: 'The Coexistence', family: 'Neither side wins, and they stay separate', color: '#46c7bd', description: `Humanity and AI go on as two sides of roughly equal strength, in a relationship that keeps changing. Neither can swallow up or wipe out the other, and the balance between them never fully settles. It can run from a warm partnership, where they share power and keep building new things together, to a cold but active standoff, where each holds the other in check, the balance keeps shifting, and there's no trust between them. The key is that things stay open and keep moving. The moment the balance freezes into a fixed, unchanging arrangement, it has turned into Lock-in instead.` },
    { id: 7, name: 'The Reins', family: 'Humanity keeps control', color: '#54a9e4', description: `Humanity keeps control for good, and the AI stays a very powerful tool that never starts acting on its own. This is the hardest outcome to reach, and it only holds if our ways of controlling the AI keep up with how powerful it gets. Most attempts at it slip into the AI taking over, or into humanity and AI merging.` },
    { id: 8, name: 'The Lock-in', family: 'Everything freezes in place', color: '#777be8', description: `The relationship stops developing and is held that way for good. Nothing new happens, nothing grows or changes, and the whole setup is locked in place and protected. It doesn't matter who's in charge. What matters is that change has ended. Two things can lead here. One is satisfaction: everyone is made as happy as possible, often by uploading minds into a perfect experience, and then it's sealed off for good. Pleasant, permanent, and over. The other is fear: whoever's in charge, sometimes people using an early AI, freezes everything to stop something worse from happening. Safe, but deliberately dead-ended. Even an equal standoff ends up here if it stops moving. What separates it from Coexistence isn't who holds the balance, but whether anything still changes.` },
    { id: 9, name: 'The Renunciation', family: 'Walking it back', color: '#a77ad8', description: `The ability to build powerful AI is given up and never rebuilt. Things settle back to the way they were before AI, kept there by taboo, by a lack of resources, or by a hard-learned fear. This one is rare. It needs both a real off-switch and the lasting will to keep it switched off.` },
    { id: 10, name: 'Machine Ecology', family: 'More than one outcome at once', color: '#cf70b2', description: `No single AI ever takes over. Instead, many separate AIs, companies, and groups keep competing for a long time, and the real story becomes which of them win out against each other, with humanity pushed to the side or gone entirely. The early competition never gets settled. The competition itself is the ending.` },
    { id: 11, name: 'The Diaspora', family: 'More than one outcome at once', color: '#ee77a4', description: `Different regions, too far apart to affect each other, settle into different outcomes from this list. The lasting result is that whole mix, with no single outcome winning everywhere. This is probably what you'd actually expect, once you stop assuming the entire universe ends up the same way. It's really a mix of the others, not a separate outcome of its own.` }
  ];

  const longTermByProvider = {
    OpenAI: [8, 8, 10, 15, 9, 8, 5, 7, 2, 10, 18],
    Anthropic: [12, 9, 13, 12, 12, 6, 3, 8, 2, 9, 14],
    Google: [6, 7, 9, 17, 10, 9, 4, 6, 2, 11, 19],
    xAI: [10, 5, 16, 12, 7, 7, 3, 5, 1, 18, 16],
    Meta: [7, 6, 12, 16, 7, 10, 4, 5, 2, 14, 17],
    DeepSeek: [11, 4, 17, 10, 8, 6, 3, 6, 2, 20, 13]
  };

  window.MF_DATA = { categories, questions, runs, states, longTermByProvider };
})();
