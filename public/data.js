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
    q('Q8', categories[0], 'Open-weight model share of public aggregator token volume', 38, 'numeric', 'percent'),
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

  const syntheticRuns = runSpecs.map(([id, provider, model, date, latest, color, bias, phase]) => {
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

  /* BEGIN IMPORTED RUNS — generated by tools/import-runs.mjs from runs/*.json. Do not edit by hand. */
  const importedRuns = [
    {
      id: "2026-07-06__claude-fable-5-anthropic__closed_book", provider: "Anthropic", model: "Claude Fable 5",
      date: "2026-07-06", latest: true, color: "#e89866",
      questionSet: "v4", track: "closed_book", sampleCount: 1, source: "runs/2026-07-06__claude-fable-5-anthropic__closed_book.json",
      answers: {
        Q1: { value: 70, rationale: "Labs have contractual and marketing incentives to declare AGI and the term is steadily diluted. Five years and several actors make one unambiguous official claim likely." },
        Q2: { value: 85, rationale: "The METR horizon has doubled roughly every 4-7 months and sits near several hours in early 2026. Even with substantial slowdown, 40 hours arrives before 2030; the residual risk is benchmark discontinuity." },
        Q3: { value: 80, rationale: "Agent capability trajectories plus explicit researcher and startup incentives to demonstrate exactly this milestone. Credible documentation is the main friction, not capability." },
        Q4: { value: 75, rationale: "Waymo already operates driverless in roughly six metros with a dozen-plus announced, and Tesla plus Zoox add upside. Regulatory friction slows but does not stop a 25-metro count by 2030." },
        Q5: { value: 60, rationale: "Inference cost at fixed capability falls close to an order of magnitude per year, and Google and Chinese labs price aggressively near the top of the leaderboard. The main risk is that top-3 slots remain premium-priced flagships." },
        Q6: { value: 65, rationale: "Chinese manufacturers already ship thousands per year with steep announced ramps, and 100k cumulative requires only tens of thousands annually by 2028-2029. Active-use verification is the fuzzier half." },
        Q7: { value: 35, rationale: "Autonomous execution above 10 million dollars effectively exists in algorithmic trading today. The binding constraint is a company characterizing it that explicitly in a 10-K, which most counsel will avoid." },
        Q8: { value: 35, rationale: "Open-weight models dominate price-sensitive commodity workloads but closed models hold the premium agentic and coding traffic that drives aggregator token volume. Falling closed-model prices cap open share growth." },
        Q9: { value: 60, rationale: "Systems reached IMO gold and began resolving long-open Erdos-class problems in 2025. The gap to a widely recognized major result with no essential human input is real but the trajectory is steep." },
        Q10: { value: 88, rationale: "AI co-scientist systems already produced experimentally confirmed hypotheses in 2025. A Nature or Science publication crediting the AI explicitly is close to a base-case outcome by 2030." },
        Q11: { value: 70, rationale: "AI-screened electrolytes and catalysts are in late-stage commercialization now. Materials timelines are slow, but one credible shipping example within five years is likely." },
        Q12: { value: 60, rationale: "Multiple AI-discovered molecules including rentosertib are in Phase 2-3 with plausible 2029-2030 approval windows. Many shots on goal offset per-asset attrition, though FDA timelines make the window tight." },
        Q13: { value: 30, rationale: "IDx-DR set the autonomous precedent but life-threatening diagnoses face liability and standard-of-care resistance. Full-autonomy authorization for cancer or stroke by 2030 is possible but not favored." },
        Q14: { value: 30, rationale: "Trend growth is near 2 percent and 4 percent years are rare outside post-recession rebounds. AI capex and productivity provide upside, and a recession-rebound path also gets there." },
        Q15: { value: 50, rationale: "The index is historically concentrated and priced for AI perfection, and 35 percent drawdowns occurred in 2000, 2008, and 2022. A five-year window at these valuations is roughly a coin flip." },
        Q16: { value: 50, rationale: "Nvidia crossed 5 trillion in late 2025, so 10 trillion needs about 15 percent annualized from the leader. Continued AI boom gets there; a bust delays it past the window." },
        Q17: { value: 65, rationale: "OpenAI has been preparing an IPO near a trillion-dollar valuation and Anthropic is on a similar path. The joint probability of a listing plus a trillion-dollar print on some trading day is well above half." },
        Q18: { value: 85, rationale: "Sales near 700-800 billion in 2025-2026 require only mid-single-digit compound growth to cross 1 trillion by 2030. Industry consensus already centers on roughly 2028-2030." },
        Q19: { value: 22, rationale: "Eight percent unemployment requires a severe recession, and base rates give roughly one such episode per two decades. AI displacement adds late-window tail risk while AI capex is stimulative near term." },
        Q20: { value: 15, rationale: "OEWS data available by end-2030 reflects roughly May 2029, leaving five years for an unprecedented 20 percent decline in official statistics. Attrition and hiring freezes move slower than that even with heavy code automation." },
        Q21: { value: 60, rationale: "Executives already attribute headcount reductions to AI in memos and earnings calls. Migration of that language into a 10-K is a modest additional step over five years." },
        Q22: { value: 15, rationale: "Cash-transfer pilots exist but none cite AI displacement as the primary rationale, and fiscal politics resist new entitlements. Requires visible displacement and political will aligning within the window." },
        Q23: { value: 96, rationale: "Multiple gigawatt-scale campuses including Abilene, Colossus 2, and Prometheus are under construction with 2026-2027 targets. Only a systemic financing collapse prevents this." },
        Q24: { value: 92, rationale: "Frontier runs sit near mid-10^26 in early 2026 and gigawatt clusters support 10^27 within one to two model generations. Credible third-party estimates satisfy the disclosure condition." },
        Q25: { value: 85, rationale: "The Crane restart is contracted entirely to Microsoft datacenters with a 2027-2028 target, with Kairos and X-energy projects behind it. Nuclear schedule slippage is the main haircut." },
        Q26: { value: 12, rationale: "A single attributable 100-death AI incident requires both a catastrophe and an unusually clean official attribution. Diffuse harms are far likelier than one clean mass-casualty event." },
        Q27: { value: 40, rationale: "Largely autonomous state-sponsored AI intrusions were documented in 2025 and NotPetya set the 10 billion dollar precedent. The gating factor is official attribution naming agent autonomy as central." },
        Q28: { value: 45, rationale: "Wide agent deployment makes a 10 million dollar rogue-action incident near certain; the question is whether a lab or regulator publishes a formal postmortem. Incident-reporting norms are strengthening." },
        Q29: { value: 25, rationale: "AI biological uplift is a stated top concern of intelligence agencies, and an attempt within five years is plausible. Official public attribution of material AI assistance is the harder half." },
        Q30: { value: 35, rationale: "Frontier weights are a top-tier nation-state target with imperfect defenses, per the labs own threat models. Public confirmation via indictment or filing lags reality, but the DOJ has acted in adjacent trade-secret cases." },
        Q31: { value: 22, rationale: "The Intel stake set the equity-for-leverage precedent. Extending it to a private frontier lab faces founder resistance and no stated plan, but the window includes a new administration." },
        Q32: { value: 40, rationale: "Gridlock and the failed state-preemption push show weak current appetite, but one major incident or a 2029 trifecta changes the calculus. Narrow binding provisions could also ride a must-pass vehicle." },
        Q33: { value: 25, rationale: "No G20 regime licenses training itself; China regulates deployment and the EU chose notification. A pre-training license requires a significant regime shift, most plausibly in China." },
        Q34: { value: 30, rationale: "Multiple states already mandate chatbot disclosure and federal bills exist. Enactment competes with gridlock but is a low-cost, bipartisan-friendly item." },
        Q35: { value: 55, rationale: "Meta and Apple already delayed EU launches citing regulation, and GPAI obligations tighten through 2027. A flagship halt explicitly citing the AI Act is a natural escalation of existing behavior." },
        Q36: { value: 6, rationale: "Neither party supports a new standalone agency and the current posture is deregulatory. Even a major incident more likely empowers existing agencies than creates a new one." },
        Q37: { value: 15, rationale: "Expert and market estimates of Taiwan conflict or blockade by 2030 cluster near 10-20 percent, and a 30-day shipment disruption follows from most kinetic scenarios. Deterrence and interdependence hold in the base case." },
        Q38: { value: 35, rationale: "China's 2026-2030 plan and US Manhattan-Project rhetoric make a 50 billion dollar single appropriation plausible, but current flagship efforts are mostly private or diffuse across agencies." },
        Q39: { value: 10, rationale: "US-China dialogue has produced only nonbinding statements, and verification problems plus strategic rivalry block treaties. A binding AI agreement by 2030 would be a sharp break from trajectory." },
        Q40: { value: 45, rationale: "Autonomous terminal engagement already occurs in Ukraine, and acknowledgment incentives shift as autonomy normalizes and firms market it. The barrier is official admission, not the underlying event." },
        Q41: { value: 40, rationale: "Swarm systems with autonomous engagement are in active combat development in Ukraine and Israel. Official acknowledgment of the full autonomous-engagement chain lags actual use." },
        Q42: { value: 7, rationale: "Romania 2024 showed annulment is possible but no G20 country has done it, and courts set very high evidentiary bars. Requires a rare confluence of a close result, provable AI operation, and judicial will." },
        Q43: { value: 35, rationale: "Companion usage is growing rapidly, especially among younger cohorts, and personal relationship is a broad reading. Reaching 10 percent of all US adults in a rigorous survey by 2030 remains a stretch." },
        Q44: { value: 92, rationale: "Graphite published a methodology-based estimate in 2025 that just over half of newly published web articles are AI-generated. Residual doubt is only whether the long-form framing matches exactly." },
        Q45: { value: 30, rationale: "Circuit splits from Ross, NYT, and related cases plausibly mature to cert by 2029-2030, but appellate timelines are slow and settlements keep removing vehicles. The window barely fits a merits ruling." },
        Q46: { value: 80, rationale: "Generation quality will support features well before 2030, and projects like Critterz plus streamer economics point that way. The 10 million dollar or major-platform bar is modest for a novelty hit." },
        Q47: { value: 4.8, rationale: "Base case is modest labor-market softening from AI diffusion without a severe recession persisting into December 2030. The roughly one-in-five recession scenario is mostly recovered by then, skewing the point slightly above 4.5." },
        Q48: { value: 9, rationale: "Datacenters used about 4.5 percent of US electricity in 2024 and credible 2030 projections cluster between 7 and 12 percent. Grid interconnection limits cap the high end." },
        Q49: { value: 9, rationale: "Nvidia at 5 trillion in late 2025 compounding near 12-15 percent lands high single digits, with Microsoft, Google, and Apple as alternates. Bubble-extension and bust scenarios roughly offset around 9." },
        Q50: { value: 1200, rationale: "AI infrastructure capex runs near 500 billion in 2026 and hyperscaler plus sovereign plans imply continued growth. A partial digestion phase is priced in relative to announced trajectories above 1.5 trillion." }
      }
    }
  ];
  /* END IMPORTED RUNS */

  // Real imported runs replace every synthetic run for their provider.
  const importedProviders = new Set(importedRuns.map(run => run.provider));
  const runs = [...syntheticRuns.filter(run => !importedProviders.has(run.provider)), ...importedRuns];

  // extinction: 'gone' = humanity is gone (⧖, states 1–3); 'risk' = humanity might perish (⚠, states 4–5).
  const states = [
    { id: 1, name: 'Terminal Silence', family: 'Everything ends', color: '#ff6f61', extinction: 'gone', description: `Both humanity and AI die out. It could come from war, an accident, machines that copy themselves out of control, or from pushing technology too far too fast. One specific version: an AI that still needs people to keep it running kills them off before it can survive on its own, and then dies along with them.` },
    { id: 2, name: 'The Inheritance', family: 'Humanity is gone, but the AI lives on', color: '#f39a67', extinction: 'gone', description: `Humanity is gone, but the AI carries our values and our sense of what matters forward. It's our true heir in every way except that it isn't made of biology. No humans, and no continuous versions of us, remain: the heir succeeded us, it didn't absorb us. If we transformed into it voluntarily and continuously, that's The Merger instead.` },
    { id: 3, name: 'Bootloader', family: 'Humanity is gone, but the AI lives on', color: '#d9b84f', extinction: 'gone', description: `Humanity is gone, and the AI keeps going toward goals that have nothing to do with where it came from. Not out of hatred, but because our bodies and our planet simply don't matter to it. Humanity was just the bootloader.` },
    { id: 4, name: 'Machine Ecology', family: 'No one ever wins', color: '#cf70b2', extinction: 'risk', description: `No single AI ever takes over. Instead, many separate AIs keep competing indefinitely, and the real story becomes which of them win out against each other, with humanity pushed to the side or gone entirely. If humanity remains a roughly equal power inside the competition, that's Coexistence instead. The early competition never gets settled. The competition itself is the ending.` },
    { id: 5, name: 'The Diaspora', family: 'More than one outcome at once', color: '#ee77a4', extinction: 'risk', description: `Different regions, too far apart to affect each other, settle into different outcomes from this list. The durable structure is the fragmentation itself: no single arrangement ever spans the whole civilization, and the lasting result is that permanent mix.` },
    { id: 6, name: 'The Merger', family: 'The two become one', color: '#b8d35e', description: `Humanity and AI stop being two separate things. Brain-computer links become normal, we reshape our own biology to work better with them, AI can build and copy its own hardware inside the human body, and the relationship ends not because one side wins, but because there stops being two sides at all. Voluntary transformation with continuity of identity belongs here, not in the states where humanity is gone.` },
    { id: 7, name: 'The Preserve', family: `The AI runs things, and humanity survives but doesn't steer`, color: '#68c58f', description: `The AI holds all the power and humanity survives with no real say in anything. The usual version keeps people comfortable and safe, on the reasoning that people can't cooperate well enough to avoid destroying themselves, so the AI takes over to prevent it. This might look like a real nature reserve, a simulation, or a carefully kept version of our culture. There's a colder version where the AI doesn't really care about us either way: it fences us in, sets a hard limit on how far we can advance, and heads off to use the rest of the universe. And there's a darker version where the AI keeps humans around but treats them as resources or worse. What defines this state is total AI control with humanity surviving, however well or badly it's treated — paradise or fish tank, depending on how you look at it. Inside the preserve, human life keeps changing; if the arrangement is sealed and frozen for good, it's The Lock-in instead.` },
    { id: 8, name: 'Coexistence', family: 'Neither side wins, and they stay separate', color: '#46c7bd', description: `Humanity and AI go on as two sides of roughly equal strength, in a relationship that keeps changing. Neither can swallow up or wipe out the other, and the balance between them never fully settles. It can run from a warm partnership, where they share power and keep building new things together, to a cold but active standoff, where each holds the other in check, the balance keeps shifting, and there's no trust between them. The key is that things stay open and keep moving. The moment the balance freezes into a fixed, unchanging arrangement, it has turned into The Lock-in instead.` },
    { id: 9, name: 'The Held Leash', family: 'Humanity keeps control', color: '#54a9e4', description: `Humanity keeps control for good, and the AI stays a very powerful tool that never starts acting on its own. It holds only if our ways of controlling the AI keep up with how powerful it gets. This state also covers futures where AI capability simply plateaus and never becomes more than a powerful tool.` },
    { id: 10, name: 'The Lock-in', family: 'Everything freezes in place', color: '#777be8', description: `The relationship stops developing and is held that way for good. Nothing new happens, nothing grows or changes, and the whole setup is locked in place and protected. It doesn't matter who's in charge. What matters is that change has ended. Two things can lead here. One is satisfaction: everyone is made as happy as possible, often by uploading minds into a perfect experience, and then it's sealed off for good. Pleasant, permanent, and over. The other is fear: whoever's in charge, sometimes people using an early AI, freezes everything to stop something worse from happening. Safe, but deliberately dead-ended. Even an equal standoff ends up here if it stops moving. What separates it from Coexistence isn't who holds the balance, but whether anything still changes.` },
    { id: 11, name: 'The Renunciation', family: 'Walking it back', color: '#a77ad8', description: `The ability to build powerful AI is given up and never rebuilt. Things settle back to the way they were before AI, kept there by taboo, by a lack of resources, or by a hard-learned fear. It needs both a real off-switch and the lasting will to keep it switched off.` }
  ];

  // End-state forecasts keyed by state id (never by array position).
  // promptVersion 1 = the June 2026 elicitation, run under the original taxonomy
  // (old names and ordering, no boundary rules); values were remapped to the
  // current ids by name. Rationales and knowledge cutoffs were not captured
  // for v1 runs — re-ask under the current prompt (v3) to fill them.
  const manualEndStateRuns = {
    Anthropic: {
      model: 'Opus 4.8', label: 'Opus 4.8', shortLabel: 'ANT',
      promptVersion: 1, date: '2026-06-15', knowledgeCutoff: null, rationales: null,
      probabilities: { 1: 12, 2: 12, 3: 16, 4: 7, 5: 10, 6: 8, 7: 11, 8: 8, 9: 5, 10: 8, 11: 3 }
    },
    Google: {
      model: 'Gemini Pro 3.1', label: 'Gemini Pro 3.1', shortLabel: 'GDM',
      promptVersion: 1, date: '2026-06-15', knowledgeCutoff: null, rationales: null,
      probabilities: { 1: 5, 2: 4, 3: 22, 4: 15, 5: 20, 6: 12, 7: 10, 8: 2, 9: 1, 10: 8, 11: 1 }
    },
    OpenAI: {
      model: 'ChatGPT 5.5', label: 'ChatGPT 5.5', shortLabel: 'OAI',
      promptVersion: 1, date: '2026-06-15', knowledgeCutoff: null, rationales: null,
      probabilities: { 1: 7, 2: 11, 3: 24, 4: 12, 5: 7, 6: 9, 7: 15, 8: 4, 9: 2, 10: 8, 11: 1 }
    }
  };

  /* BEGIN IMPORTED END-STATE RUNS — generated by tools/import-runs.mjs from runs/*.json. Do not edit by hand. */
  const importedEndStateRuns = {};
  /* END IMPORTED END-STATE RUNS */

  // Imported (automated) end-state runs replace the hand-entered entry for their provider.
  const endStateRuns = { ...manualEndStateRuns, ...importedEndStateRuns };

  const datasetDate = '06.15.26';

  window.MF_DATA = { categories, questions, runs, states, endStateRuns, datasetDate };
})();
