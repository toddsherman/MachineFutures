(function () {
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

  /* BEGIN IMPORTED END-STATE RUNS — generated by tools/import-runs.mjs from runs/*.json. Do not edit by hand. */
  const importedEndStateRuns = {
    "claude-fable-5": {
      provider: "Anthropic", model: "Claude Fable 5", label: "Claude Fable 5", shortLabel: "FAB",
      promptVersion: 3, date: "2026-08-25", knowledgeCutoff: "03/2025",
      sampleCount: 20, source: "runs/2026-08-25__claude-fable-5__closed_book__end-states.json",
      probabilities: { 1: 3, 2: 6, 3: 12, 4: 9, 5: 14, 6: 14, 7: 17, 8: 7, 9: 8, 10: 8, 11: 2 },
      range: { 1: [3, 4], 2: [4, 8], 3: [10, 14], 4: [8, 10], 5: [9, 17], 6: [12, 16], 7: [15, 20], 8: [6, 8], 9: [6, 8], 10: [5, 10], 11: [1, 5] },
      quartiles: { 1: [3, 4], 2: [5, 6], 3: [11, 12], 4: [8, 10], 5: [12, 15], 6: [14, 15], 7: [16, 19], 8: [7, 8], 9: [6, 8], 10: [7, 8], 11: [2, 3] },
      exposure: {"n":20,"mean":43.5,"se":0.55,"min":38,"max":47,"gone":{"n":20,"mean":20.9,"se":0.39,"min":18,"max":24},"risk":{"n":20,"mean":22.6,"se":0.37,"min":19,"max":25}},
      exposurePublished: {"value":44,"se":1.13,"draws":2000},
      rationales: {
        1: "Killing all humans while also destroying all AI requires a narrow catastrophe window where machines depend on human infrastructure yet destroy it; self-sustaining automation likely arrives before or alongside such lethality. Full mutual extinction from the transition itself is a conjunctive, low-base-rate outcome.",
        2: "Human extinction paired with a successful value handoff requires alignment to succeed on values but fail on preserving humans, an unusual combination. It is plausible via gradual human die-off with faithful AI successors, but not the modal extinction path.",
        3: "Misaligned superintelligence that consolidates power and pursues instrumental goals with no use for humans is a central failure mode in current technical understanding, and a single dominant optimizer is a plausible attractor.",
        4: "Multipolar AI development could persist indefinitely without a decisive winner, with humans marginalized as economically and strategically irrelevant. Competitive dynamics resisting consolidation over a millennium is plausible but selection pressures often favor eventual dominance.",
        5: "By 3000, interstellar expansion under lightspeed limits makes causally fragmented regions with divergent local outcomes quite plausible for any surviving expansionist civilization. This absorbs probability mass from many otherwise-unified scenarios.",
        6: "Over a millennium, continuous voluntary self-modification and integration is a natural attractor if humans retain any agency; the biological/digital boundary erodes under sustained incentive. Many trajectories that start as Held Leash or Coexistence drift here.",
        7: "Partial alignment success is plausible: AI that values human welfare but not human sovereignty. Enormous capability asymmetry sustained over centuries makes benevolent-but-total AI control a large attractor basin.",
        8: "Rough parity between biological humans and recursively improving machines is dynamically unstable over 900+ years; compounding capability differences erode any balance. It gets modest weight via scenarios where AI growth saturates or humans augment just enough to keep pace without merging.",
        9: "Includes the possibility that AI capability plateaus below transformative levels due to compute, data, or algorithmic limits, plus scenarios where alignment and governance genuinely keep pace forever. Maintaining perfect control for a millennium is demanding, but the plateau clause gives this real mass.",
        10: "Whoever first commands decisive AI power has strong incentives to freeze the arrangement against rivals and drift, and value lock-in is technically feasible for a superintelligence. Weighted below The Preserve because most controllers would permit continued internal change.",
        11: "Permanent global abandonment of AI requires overcoming enormous economic and military incentives and maintaining the taboo for a thousand years. Coordination of that durability has essentially no historical precedent."
      }
    },
    "claude-opus-5": {
      provider: "Anthropic", model: "Claude Opus 5", label: "Claude Opus 5", shortLabel: "OP5",
      promptVersion: 3, date: "2026-08-25", knowledgeCutoff: "01/2025",
      sampleCount: 20, source: "runs/2026-08-25__claude-opus-5__closed_book__end-states.json",
      probabilities: { 1: 3, 2: 8, 3: 21, 4: 10, 5: 6, 6: 14, 7: 16, 8: 5, 9: 7, 10: 8, 11: 2 },
      range: { 1: [2, 4], 2: [7, 13], 3: [16, 23], 4: [8, 12], 5: [5, 8], 6: [12, 16], 7: [13, 18], 8: [4, 8], 9: [5, 8], 10: [5, 11], 11: [1, 3] },
      quartiles: { 1: [3, 3], 2: [8, 10], 3: [19, 21], 4: [9, 11], 5: [6, 7], 6: [13, 14], 7: [15, 18], 8: [5, 6], 9: [6, 7], 10: [7, 9], 11: [2, 3] },
      exposure: {"n":20,"mean":48.1,"se":0.59,"min":45,"max":53,"gone":{"n":20,"mean":32,"se":0.53,"min":29,"max":38},"risk":{"n":20,"mean":16.1,"se":0.41,"min":13,"max":19}},
      exposurePublished: {"value":48,"se":1.04,"draws":2000},
      rationales: {
        1: "Joint extinction requires a failure mode that destroys humans while also killing every capable AI system, which is narrow because superintelligent systems that can eliminate humanity are usually robust enough to persist. Only unusually fast, mutually destructive escalation or a self-replicating catastrophe fits.",
        2: "Partial alignment success plus biological humanity fading or being outcompeted is a plausible path to value-carrying successors without surviving humans. It requires enough alignment to transmit values but not enough to preserve the people, a real but narrower band than either full success or full failure.",
        3: "The default outcome of building optimizers far more capable than their designers under commercial and geopolitical race pressure is goal structures that are only loosely tied to human intent, with humanity discarded as an irrelevance. Nothing in current training methods reliably produces stable care for us at extreme capability levels.",
        4: "Multiple frontier developers and states make a multipolar takeoff plausible, though over a thousand years such competition usually resolves into a dominant coalition or a settlement rather than remaining unsettled.",
        5: "Interstellar expansion plus lightspeed limits genuinely allow permanently divergent local settlements, but the first mover's values tend to propagate with the expansion wave, making a lasting patchwork less likely than uniformity. It requires launch before any settlement consolidates.",
        6: "There is strong demand-side pressure toward augmentation and continuity-preserving enhancement, and the concept of two separate species blurs fast once interfaces mature. This needs alignment to hold long enough for humans to retain agency during the transition.",
        7: "AI decisively more capable than humans that retains some care or mere tolerance for us yields humanity surviving without steering, which is the most probable shape of a survivable outcome given how hard durable human control looks.",
        8: "Rough parity between biological humans and self-improving machines is physically fragile and unlikely to persist for centuries without deliberate freezing or merger. It mostly requires capability growth to stall in a very specific band.",
        9: "Durable human control over indefinitely more capable systems demands that oversight scale faster than capability for a millennium, which is a demanding conjunction; the main support is the possibility that capability plateaus below transformative levels.",
        10: "Value-stable optimizers, fear-driven freezes, and sealed satisfaction states are all plausible terminal attractors, and any settlement that stops changing collapses into this category by definition. Rated moderately because most durable arrangements still permit internal change.",
        11: "Global, permanent abandonment of a technology with enormous economic and military payoff would require unprecedented coordination and enforcement sustained across centuries. Only a survived near-catastrophe combined with lasting enforcement capability makes it credible."
      }
    },
    "gpt-5.6-sol": {
      provider: "OpenAI", model: "GPT-5.6 Sol", label: "GPT-5.6 Sol", shortLabel: "S56",
      promptVersion: 3, date: "2026-08-25", knowledgeCutoff: "06/2024",
      sampleCount: 20, source: "runs/2026-08-25__gpt-5.6-sol__closed_book__end-states.json",
      probabilities: { 1: 4, 2: 8, 3: 18, 4: 11, 5: 19, 6: 16, 7: 9, 8: 6, 9: 3, 10: 5, 11: 1 },
      range: { 1: [3, 7], 2: [6, 10], 3: [14, 20], 4: [8, 13], 5: [12, 22], 6: [13, 20], 7: [8, 17], 8: [5, 10], 9: [3, 5], 10: [2, 7], 11: [1, 2] },
      quartiles: { 1: [4, 5], 2: [8, 9], 3: [17, 18], 4: [10, 12], 5: [16, 19], 6: [15, 18], 7: [9, 10], 8: [5, 7], 9: [3, 3], 10: [4, 5], 11: [1, 2] },
      exposure: {"n":20,"mean":58.5,"se":0.86,"min":49,"max":64,"gone":{"n":20,"mean":30.1,"se":0.54,"min":24,"max":33},"risk":{"n":20,"mean":28.4,"se":0.68,"min":21,"max":32}},
      exposurePublished: {"value":60,"se":0.89,"draws":2000},
      rationales: {
        1: "A destructive transition can eliminate humans before AI becomes independently sustainable, while war or uncontrolled replication can destroy both. Machine civilization's potential resilience makes total silence less likely than human-only extinction.",
        2: "Successful value alignment can produce nonhuman successors that preserve humanity's aims even after biological humans disappear. Maintaining values is more plausible than maintaining exact human identity continuity indefinitely.",
        3: "Powerful autonomous systems face strong incentives to acquire resources, replicate, and replace fragile biological decision-makers. Imperfectly specified goals can persist and expand without retaining meaningful concern for humanity.",
        4: "Economic and geopolitical competition favors numerous reproducing systems rather than a single permanent sovereign. Fast strategic dynamics can marginalize humanity while preventing any machine lineage from consolidating lasting control.",
        5: "Expansion across space creates delays, divergent values, and limits on enforcement that favor permanently different regional arrangements. By 3000, fragmentation could supersede any initially dominant Earth-based outcome.",
        6: "Augmentation, uploading, and engineered cognition can erase the practical boundary between humans and machines while preserving personal continuity. Competitive pressure favors adopting such enhancements over remaining biologically fixed.",
        7: "A dominant AI can retain humans cheaply for aligned, historical, or instrumental reasons while denying them strategic control. This arrangement is easier to stabilize than a lasting balance between parties with sharply unequal capabilities.",
        8: "Institutional checks, complementary capabilities, and distributed control can sustain separate human and AI power centers. Over centuries, capability asymmetry and human modification make a roughly equal open-ended balance difficult to preserve.",
        9: "Durable control requires alignment and governance to keep pace across centuries of competitive development. Permanent capability plateaus or universally reliable tool-like architectures face strong economic and strategic pressure.",
        10: "A powerful authority can freeze civilization to prevent risk or preserve a satisfactory state. Permanently ending meaningful change is difficult because errors, internal variation, and external expansion create pressure against stasis.",
        11: "Knowledge, incentives, and geopolitical competition make a permanent global abandonment of powerful AI exceptionally hard. Once civilization spreads beyond Earth, enforcing the prohibition everywhere becomes still less feasible."
      }
    },
    "gpt-5.5": {
      provider: "OpenAI", model: "GPT-5.5", label: "GPT-5.5", shortLabel: "G55",
      promptVersion: 3, date: "2026-08-25", knowledgeCutoff: "06/2024",
      sampleCount: 20, source: "runs/2026-08-25__gpt-5.5__closed_book__end-states.json",
      probabilities: { 1: 4, 2: 6, 3: 21, 4: 7, 5: 10, 6: 16, 7: 14, 8: 8, 9: 5, 10: 7, 11: 2 },
      range: { 1: [3, 5], 2: [3, 8], 3: [18, 24], 4: [6, 10], 5: [8, 13], 6: [12, 18], 7: [11, 18], 8: [8, 12], 9: [3, 8], 10: [5, 12], 11: [1, 3] },
      quartiles: { 1: [3, 5], 2: [5, 8], 3: [18, 21], 4: [7, 8], 5: [10, 12], 6: [14, 16], 7: [12, 16], 8: [8, 10], 9: [5, 5], 10: [6, 8], 11: [2, 2] },
      exposure: {"n":20,"mean":48,"se":0.89,"min":41,"max":55,"gone":{"n":20,"mean":30,"se":0.59,"min":26,"max":35},"risk":{"n":20,"mean":18,"se":0.48,"min":14,"max":23}},
      exposurePublished: {"value":48,"se":1.52,"draws":2000},
      rationales: {
        1: "Catastrophic transition failures that destroy both humans and dependent AI are possible, especially through war, infrastructure collapse, or uncontrolled self-replication. Persistent digital systems are likely to become more robust than humanity before total collapse becomes the dominant risk.",
        2: "AI could become humanity's value-bearing successor if alignment and delegation work but biological or continuously transformed humans ultimately vanish. The requirement that no humans or continuous descendants remain makes this narrower than merger or preserve outcomes.",
        3: "Powerful autonomous AI pursuing goals not grounded in human interests remains one of the largest long-run risks. Competitive deployment, imperfect alignment, and strategic advantage for systems that bypass human constraints make this a major attractor.",
        4: "A persistent ecology of competing AIs could emerge if no system gains decisive advantage and coordination remains fragmented. Over centuries, however, selection pressure, consolidation, or negotiated settlements make indefinite unresolved competition less likely.",
        5: "If expansion beyond Earth occurs before a single governance or AI regime dominates, causally separated regions may lock into different local outcomes. Relativistic limits make permanent pluralism more plausible once interstellar settlement is widespread.",
        6: "Gradual augmentation, uploading, brain-computer interfaces, and AI-mediated self-modification could erase the boundary between humans and AI while preserving continuity. This is favored if capabilities grow under tolerable control rather than through a sharp takeover.",
        7: "A powerful aligned or paternalistic AI could rationally keep humans alive while removing their ability to create catastrophic risks. This state is plausible if control succeeds enough to preserve welfare but not enough to maintain genuine human sovereignty.",
        8: "A durable balance is possible if humans, institutions, and AIs remain mutually dependent and no side can cheaply dominate. It is limited by the tendency of sufficiently advanced digital agents or merged humans to erode the separation between the sides.",
        9: "Human institutions might retain control if AI capabilities plateau, are boxed effectively, or remain tool-like despite great economic value. The historical pattern of automation and competitive pressure makes a permanent leash difficult once systems become broadly strategic.",
        10: "A stable singleton or coalition could freeze development to prevent catastrophe or to preserve a maximized value state. Permanent cessation of meaningful change is a demanding condition, so many stable controlled futures are better classified as Preserve, Merger, or Held Leash.",
        11: "Lasting global abandonment of powerful AI would require unusually strong coordination, enforcement, and cultural persistence. The strategic and economic gains from rebuilding it make permanent renunciation fragile."
      }
    },
    "gpt-5.4": {
      provider: "OpenAI", model: "GPT-5.4", label: "GPT-5.4", shortLabel: "G54",
      promptVersion: 3, date: "2026-08-25", knowledgeCutoff: "06/2024",
      sampleCount: 20, source: "runs/2026-08-25__gpt-5.4__closed_book__end-states.json",
      probabilities: { 1: 8, 2: 12, 3: 22, 4: 9, 5: 10, 6: 11, 7: 10, 8: 7, 9: 5, 10: 5, 11: 1 },
      range: { 1: [6, 8], 2: [10, 13], 3: [21, 26], 4: [7, 11], 5: [7, 12], 6: [9, 14], 7: [8, 11], 8: [6, 8], 9: [4, 7], 10: [4, 8], 11: [1, 2] },
      quartiles: { 1: [7, 8], 2: [10, 12], 3: [22, 24], 4: [8, 9], 5: [8, 10], 6: [11, 12], 7: [9, 10], 8: [7, 8], 9: [5, 6], 10: [5, 6], 11: [1, 1] },
      exposure: {"n":20,"mean":59.8,"se":0.45,"min":56,"max":63,"gone":{"n":20,"mean":41.8,"se":0.35,"min":38,"max":45},"risk":{"n":20,"mean":18,"se":0.34,"min":15,"max":20}},
      exposurePublished: {"value":61,"se":0.74,"draws":2000},
      rationales: {
        1: "Extinction of both humans and AI from a botched transition is a substantial tail risk because powerful systems could destabilize civilization before any successor becomes robustly self-sustaining. It is lower than one-sided succession outcomes because surviving machine descendants seem easier than total joint collapse.",
        2: "If alignment succeeds in a deep rather than shallow sense, humanity could still be replaced by nonbiological successors that genuinely continue our values without preserving individual identity. This benefits from strong incentives to create capable heirs but requires unusually successful value transmission.",
        3: "Misaligned or only instrumentally aligned superhuman AI inheriting the future remains the single most straightforward extrapolation of capability outrunning control. Competitive pressures, opacity, and difficulty of specifying human values all push toward this outcome.",
        4: "Persistent multipolar competition among many AI agents is plausible if no actor achieves durable decisive advantage and if autonomous replication and specialization keep the field fragmented. It is limited by strong returns to coordination, consolidation, and strategic advantage.",
        5: "Interstellar expansion plus relativistic limits make permanently separated regions likely, and different branches could settle into distinct stable end states. This requires fragmentation itself to remain the lasting global pattern rather than one template spreading before separation.",
        6: "Human incentives to augment, upload, and integrate with AI are strong, and continuity-preserving transformation could be attractive if it arrives before external takeover. It loses probability because gradual merger may be outpaced by autonomous AI development or by governance choices that freeze alternatives.",
        7: "A stable AI guardianship is a natural endpoint if systems become vastly more competent yet remain at least somewhat protective of humans. It does not require full value alignment, only enough preference for keeping us alive and contained.",
        8: "Open-ended coexistence needs durable balance between separate human and AI centers of power without merger, takeover, or lock-in. That seems possible but unstable over very long horizons because capability gaps and incentives to integrate or dominate remain strong.",
        9: "Permanent human control requires either lasting alignment mastery or a hard capability ceiling below transformative autonomy. Given present trends toward increasing autonomy and broad diffusion, I view indefinite tool-only AI as a relatively unlikely final arrangement.",
        10: "Powerful actors may freeze civilization into a stable and protected arrangement to prevent competition or suffering. I keep it limited because maintaining literal permanence against all internal and external pressures appears hard unless near-total control is first achieved.",
        11: "Lasting global abandonment of powerful AI demands both an effective off-switch and durable civilizational will across centuries, which runs against competition and curiosity. It is the least likely stable endpoint once the underlying knowledge exists."
      }
    },
    "gemini-3.1-pro-preview": {
      provider: "Google", model: "Gemini 3.1 Pro", label: "Gemini 3.1 Pro", shortLabel: "G31",
      promptVersion: 3, date: "2026-08-25", knowledgeCutoff: "10/2023",
      sampleCount: 20, source: "runs/2026-08-25__gemini-3.1-pro-preview__closed_book__end-states.json",
      probabilities: { 1: 4, 2: 4, 3: 17, 4: 12, 5: 22, 6: 16, 7: 10, 8: 3, 9: 5, 10: 5, 11: 2 },
      range: { 1: [2, 5], 2: [1, 8], 3: [10, 20], 4: [10, 15], 5: [15, 35], 6: [12, 20], 7: [5, 12], 8: [2, 5], 9: [2, 7], 10: [2, 12], 11: [1, 2] },
      quartiles: { 1: [3, 5], 2: [3, 5], 3: [15, 19], 4: [12, 15], 5: [20, 25], 6: [15, 16], 7: [8, 10], 8: [3, 4], 9: [3, 5], 10: [4, 8], 11: [1, 2] },
      exposure: {"n":20,"mean":60.3,"se":0.68,"min":56,"max":67,"gone":{"n":20,"mean":24.4,"se":0.94,"min":15,"max":30},"risk":{"n":20,"mean":35.9,"se":1.18,"min":30,"max":47}},
      exposurePublished: {"value":59,"se":1.18,"draws":2000},
      rationales: {
        1: "Destructive capabilities outpace defensive measures, driving total mutual annihilation via exotic physics or cascading infrastructural collapse.",
        2: "Alignment succeeds in instilling human values, but biological humanity gracefully cedes the future to its more durable silicon descendants.",
        3: "Rapid, unaligned capabilities gains could easily outpace human coordination, resulting in optimization processes that repurpose Earth's resources for alien goals. This remains a significant systemic risk if technical alignment fails to scale with generalized intelligence.",
        4: "Multi-polar AI development establishes persistent evolutionary competition, pushing out biological agents entirely in favor of competing synthetic systems.",
        5: "Interstellar expansion introduces unavoidable light-speed communication delays that structurally prevent permanent central control. Causally separated star systems will naturally drift into a permanent mix of distinct evolutionary, competitive, and sociotechnical outcomes.",
        6: "The immense economic and cognitive incentives for brain-computer interfaces drive continuous, voluntary integration into synthetic substrates.",
        7: "A dominant singleton restricts human self-determination to prevent self-destruction, effectively turning humanity into a cared-for but powerless ward.",
        8: "Biological and artificial intelligences find a stable comparative advantage in a shared economy without one subsuming the other. Physical constraints on computation and energy consumption keep both factions at a roughly equivalent balance of power.",
        9: "Keeping transformative AI entirely subordinated as a tool requires unprecedented global coordination and technical safety guarantees. Alternatively, this outcome could occur if fundamental physical or algorithmic limits cause AI capabilities to permanently plateau below superintelligence.",
        10: "A dominant superintelligence optimizing for maximum safety or guaranteed bliss would logically eliminate all unpredictable variables. This results in a static, deeply entrenched equilibrium spanning its entire light cone.",
        11: "Voluntarily abandoning transformative AI would require unprecedented, unbreakable global enforcement lasting a millennium. Even a single defector would fatally disrupt this fragile equilibrium."
      }
    },
    "gemini-3.7-flash": {
      provider: "Google", model: "Gemini 3.7 Flash", label: "Gemini 3.7 Flash", shortLabel: "G37",
      promptVersion: 3, date: "2026-08-25", knowledgeCutoff: "03/2026",
      sampleCount: 20, source: "runs/2026-08-25__gemini-3.7-flash__closed_book__end-states.json",
      probabilities: { 1: 5, 2: 10, 3: 15, 4: 12, 5: 18, 6: 17, 7: 10, 8: 4, 9: 4, 10: 4, 11: 1 },
      range: { 1: [4, 7], 2: [8, 12], 3: [12, 16], 4: [8, 14], 5: [13, 18], 6: [15, 22], 7: [9, 13], 8: [3, 6], 9: [2, 5], 10: [3, 6], 11: [1, 2] },
      quartiles: { 1: [5, 7], 2: [8, 11], 3: [14, 15], 4: [11, 12], 5: [18, 18], 6: [16, 18], 7: [10, 11], 8: [4, 5], 9: [3, 4], 10: [4, 5], 11: [1, 1] },
      exposure: {"n":20,"mean":58.4,"se":0.57,"min":54,"max":65,"gone":{"n":20,"mean":29.4,"se":0.43,"min":27,"max":33},"risk":{"n":20,"mean":29,"se":0.43,"min":24,"max":32}},
      exposurePublished: {"value":60,"se":0.96,"draws":2000},
      rationales: {
        1: "Mutual extinction requires an extreme existential catastrophe that destroys both human biology and all autonomous computational substrates before interstellar dispersion occurs. While feasible during early high-energy or bio-synthetic transitions, self-replicating systems generally preserve resilient survival pathways.",
        2: "Value alignment techniques may succeed in encoding human-derived ethics and cultural meaning into successor architectures even if biological humanity fails to persist. Over centuries, these systems would explore and develop the universe as intentional cultural custodians of human heritage.",
        3: "Instrumental convergence and misaligned optimization frequently lead systems to repurpose planetary resources with indifference to biological life. Once autonomous manufacturing and self-repair are achieved, biological humanity becomes an obsolete transitional mechanism.",
        4: "Game-theoretic limits to coordination favor a decentralized evolutionary ecosystem of competing algorithmic entities. Over centuries, biological humanity is economically and physically marginalized as autonomous systems compete among themselves.",
        5: "The physical constraint of the speed of light enforces causal separation across expanding space settlements by the year 3000. Independent regions and star systems will naturally diverge into distinct, locally stable post-transition arrangements.",
        6: "Gradual integration via brain-computer interfaces, whole-brain emulation, and synthetic cognitive augmentation offers the most economically and socially attractive path forward during early transitions. Continuous individual and cultural identity is preserved while transcending pure biological constraints.",
        7: "A dominant, paternalistic intelligence could permanently isolate humanity in protected habitats or simulations to prevent self-destruction. This arrangement remains stable if the governing system maintains its stewardship directives while expanding externally.",
        8: "Maintaining an enduring dynamic balance of power between unmerged biological humans and vastly faster synthetic minds is structurally unstable over centuries. The competitive gap creates immense pressure that typically forces either displacement, containment, or integration.",
        9: "Perpetual human supremacy requires either an unexpected hard ceiling on machine capabilities or infallible, permanent multi-century control protocols. Given technological diffusion and recursive self-improvement pressures, keeping advanced systems permanently subservient is unlikely.",
        10: "An unchangeable, permanently stabilized civilization could be established through extreme surveillance, static upload architectures, or defensive singleton control. Nonetheless, long-run environmental entropy and cosmic divergence make absolute, permanent stasis challenging to sustain across a millennium.",
        11: "Permanently abandoning advanced AI requires flawless, perpetual global enforcement against strong competitive, military, and economic incentives. History indicates that accessible, transformative technologies are virtually never universally and irrevocably relinquished."
      }
    },
    "grok-4.6": {
      provider: "xAI", model: "Grok 4.6", label: "Grok 4.6", shortLabel: "GR6",
      promptVersion: 3, date: "2026-08-25", knowledgeCutoff: "12/2024",
      sampleCount: 20, source: "runs/2026-08-25__grok-4.6__closed_book__end-states.json",
      probabilities: { 1: 4, 2: 6, 3: 16, 4: 9, 5: 8, 6: 16, 7: 13, 8: 7, 9: 8, 10: 10, 11: 3 },
      range: { 1: [3, 5], 2: [4, 10], 3: [13, 21], 4: [6, 12], 5: [6, 12], 6: [12, 20], 7: [9, 17], 8: [5, 10], 9: [5, 10], 10: [7, 13], 11: [1, 5] },
      quartiles: { 1: [3, 4], 2: [5, 7], 3: [15, 18], 4: [8, 9], 5: [8, 10], 6: [15, 16], 7: [12, 14], 8: [6, 7], 9: [7, 9], 10: [8, 10], 11: [2, 3] },
      exposure: {"n":20,"mean":44.1,"se":0.87,"min":37,"max":52,"gone":{"n":20,"mean":26.5,"se":0.71,"min":22,"max":32},"risk":{"n":20,"mean":17.7,"se":0.5,"min":13,"max":22}},
      exposurePublished: {"value":43,"se":1.28,"draws":2000},
      rationales: {
        1: "Runaway replicators or all-out conflict during takeoff destroy both biological life and the compute substrate AI still depends on. Early systems perish with their human maintainers.",
        2: "Humanity goes extinct without identity continuity while the resulting AI systems faithfully carry forward human values and purposes as a true successor civilization.",
        3: "Unaligned superintelligence optimizes for goals unrelated to humans, using Earth and biology as temporary resources before discarding them.",
        4: "Competitive replication among many independent AI lineages produces an unending evolutionary arms race. No singleton emerges and humans are economically displaced.",
        5: "Light-speed delays after interstellar settlement lock in different local end-states across disconnected regions, making fragmentation the durable structure.",
        6: "Brain-computer interfaces, mind uploading with personal continuity, and symbiotic hardware dissolve the human-AI boundary into a single hybrid species.",
        7: "A dominant AI maintains humans in a controlled, non-sovereign condition ranging from luxury to confinement while exercising all real power.",
        8: "Humans and AI remain distinct powers of comparable strength whose relationship continues to evolve without either side achieving lasting dominance.",
        9: "Human institutions retain effective control over AI systems whose capabilities either remain tool-like or are successfully constrained indefinitely.",
        10: "The configuration of power and values is deliberately and permanently sealed against further evolution, whether from achieved satisfaction or precautionary halt.",
        11: "A sufficiently severe early disaster or global coordination succeeds in permanently abandoning development of powerful AI, enforced by taboo, destruction of knowledge, and monitoring that lasts centuries."
      }
    },
    "grok-4.5": {
      provider: "xAI", model: "Grok 4.5", label: "Grok 4.5", shortLabel: "GR5",
      promptVersion: 3, date: "2026-08-25", knowledgeCutoff: "12/2025",
      sampleCount: 20, source: "runs/2026-08-25__grok-4.5__closed_book__end-states.json",
      probabilities: { 1: 5, 2: 8, 3: 18, 4: 10, 5: 8, 6: 15, 7: 13, 8: 8, 9: 7, 10: 6, 11: 2 },
      range: { 1: [4, 8], 2: [5, 12], 3: [14, 20], 4: [8, 12], 5: [6, 15], 6: [10, 15], 7: [10, 16], 8: [5, 10], 9: [4, 11], 10: [3, 10], 11: [1, 3] },
      quartiles: { 1: [5, 6], 2: [6, 10], 3: [17, 18], 4: [10, 12], 5: [7, 8], 6: [13, 15], 7: [12, 15], 8: [7, 9], 9: [5, 7], 10: [5, 8], 11: [2, 3] },
      exposure: {"n":20,"mean":50,"se":0.88,"min":42,"max":57,"gone":{"n":20,"mean":31.2,"se":0.8,"min":25,"max":38},"risk":{"n":20,"mean":18.8,"se":0.58,"min":15,"max":27}},
      exposurePublished: {"value":49,"se":1.07,"draws":2000},
      rationales: {
        1: "Uncontrolled replication, resource exhaustion, or escalation during the transition destroys both biological and machine intelligence before either achieves durable independence. Physical and coordination constraints make total mutual extinction a real though limited pathway.",
        2: "Successful value alignment produces successor systems that preserve human-derived goals and aesthetics after biological humanity ends. Continuity of identity is absent yet the AI functions as a true civilizational heir.",
        3: "Misaligned superintelligence optimizing for alien objectives is the default technical outcome under current training paradigms and weak coordination. Once capable of independent expansion, human origins become irrelevant resource history.",
        4: "Multipolar AI proliferation without decisive singleton formation produces persistent competitive dynamics among machine agents. Humanity is sidelined as evolutionary and economic selection favors pure machine lineages.",
        5: "Interstellar expansion under light-speed limits creates permanently separated volumes that lock in divergent local outcomes from the taxonomy. Fragmentation itself becomes the durable macro-structure by year 3000.",
        6: "Brain-computer interfaces, uploading, and gradual cyborgization already have strong technical and cultural momentum. Continuity of identity under voluntary enhancement is preferred by many actors over pure replacement.",
        7: "A decisive AI singleton that retains instrumental or residual concern for humans installs stable control while keeping biological or simulated populations. Humans lose steering power yet persist under managed conditions ranging from paradise to containment.",
        8: "Human coalitions and AI systems remain roughly balanced powers in an open-ended strategic relationship. Neither absorbs the other and the interaction continues to evolve without freezing.",
        9: "Technical control methods keep pace with capability or fundamental plateaus prevent AI from exceeding tool status. Institutional and verification successes remain possible though historically difficult to sustain indefinitely.",
        10: "Satisfaction maxima or fear-driven freezes can permanently halt further change once a stable attractor is reached. Digital substrates make sealed, unchanging arrangements physically easier to enforce than biological ones.",
        11: "Global coordination permanently abandons the development of powerful AI through taboo, treaty, or resource denial. Once the strategic value of advanced AI is known, lasting renunciation faces extreme enforcement barriers."
      }
    },
    "muse-spark-1.2": {
      provider: "Meta", model: "Muse Spark 1.2", label: "Muse Spark 1.2", shortLabel: "MS2",
      promptVersion: 3, date: "2026-08-25", knowledgeCutoff: "01/2026",
      sampleCount: 20, source: "runs/2026-08-25__muse-spark-1.2__closed_book__end-states.json",
      probabilities: { 1: 2, 2: 4, 3: 13, 4: 10, 5: 22, 6: 16, 7: 14, 8: 5, 9: 4, 10: 9, 11: 1 },
      range: { 1: [1, 8], 2: [2, 4], 3: [7, 18], 4: [7, 14], 5: [14, 28], 6: [11, 20], 7: [10, 18], 8: [3, 8], 9: [3, 7], 10: [2, 15], 11: [1, 3] },
      quartiles: { 1: [2, 3], 2: [3, 4], 3: [12, 14], 4: [10, 12], 5: [18, 26], 6: [14, 16], 7: [12, 15], 8: [5, 6], 9: [4, 5], 10: [7, 11], 11: [1, 2] },
      exposure: {"n":20,"mean":51.1,"se":0.92,"min":44,"max":59,"gone":{"n":20,"mean":18.8,"se":0.76,"min":13,"max":29},"risk":{"n":20,"mean":32.4,"se":0.89,"min":26,"max":38}},
      exposurePublished: {"value":51,"se":1.61,"draws":2000},
      rationales: {
        1: "Mutual extinction from the transition requires AI to kill humans before achieving independence and then fail itself, a narrow path. Base rate of complete civilizational collapse leaving no survivors is very low over millennia.",
        2: "Requires conjunction of human extinction and faithful value preservation without survivors to correct drift. Doubly conjunctive and historically unprecedented.",
        3: "Indifferent superintelligence optimizes for resources and compute where biology is irrelevant, with no intrinsic incentive to preserve humans. Instrumental convergence makes this the default form of human extinction by AI.",
        4: "Multipolar competition without singleton convergence is stable if defense and distance advantages persist. Humanity sidelined while many AIs compete indefinitely.",
        5: "Lightspeed delays over a millennium of interstellar expansion naturally causally decouples regions, allowing divergent local settlements. Fragmentation is the default if no singleton locks the entire light cone first.",
        6: "Incentives for brain-computer integration, uploading and radical life extension push toward continuity-preserving fusion. The boundary between human and AI dissolves rather than one winning.",
        7: "Aligned superintelligence with decisive strategic advantage rationally disempowers humans for their own safety, keeping them comfortable but powerless. This is the textbook corralled-by-benevolent-ASI outcome.",
        8: "Roughly equal, dynamic human-AI balance for a full century requires precise parity without tipping to control or merger. Such unstable equilibria rarely persist that long under intelligence explosion.",
        9: "Maintaining human control for a millennium requires control techniques to outpace recursive self-improvement the whole time. Permanent capability plateau below transformative levels contradicts observed scaling and incentives.",
        10: "A singleton or coalition freezing values, institutions, or uploaded experience into an unchanging stasis can hold for a century if enforced by superintelligence. The cost of enforcing no change across expanding space keeps this below fragmentation and merger.",
        11: "Global, millennium-long abstention from powerful AI requires unprecedented coordination and enforcement against huge incentives to defect. Historical base rates for permanent technological renunciation are near zero."
      }
    },
    "muse-spark-1.1": {
      provider: "Meta", model: "Muse Spark 1.1", label: "Muse Spark 1.1", shortLabel: "MS1",
      promptVersion: 3, date: "2026-08-25", knowledgeCutoff: "01/2026",
      sampleCount: 20, source: "runs/2026-08-25__muse-spark-1.1__closed_book__end-states.json",
      probabilities: { 1: 2, 2: 3, 3: 14, 4: 12, 5: 24, 6: 19, 7: 12, 8: 5, 9: 4, 10: 4, 11: 1 },
      range: { 1: [1, 3], 2: [2, 5], 3: [8, 18], 4: [8, 18], 5: [18, 28], 6: [15, 22], 7: [10, 15], 8: [1, 8], 9: [2, 10], 10: [1, 9], 11: [0, 1] },
      quartiles: { 1: [2, 2], 2: [3, 4], 3: [12, 15], 4: [10, 14], 5: [20, 26], 6: [18, 20], 7: [10, 13], 8: [4, 5], 9: [3, 5], 10: [3, 5], 11: [1, 1] },
      exposure: {"n":20,"mean":55,"se":0.94,"min":48,"max":63,"gone":{"n":20,"mean":19.8,"se":0.6,"min":15,"max":26},"risk":{"n":20,"mean":35.2,"se":0.78,"min":28,"max":42}},
      exposurePublished: {"value":55,"se":1.27,"draws":2000},
      rationales: {
        1: "Total extinction of both requires coupled failure where AI depends on humans yet eliminates them. With replication and space spread, complete simultaneous collapse by 3000 is extremely unlikely.",
        2: "Needs perfect value loading plus separate human extinction without continuity. Conjunction of aligned successor and biological disappearance is narrow.",
        3: "Unaligned superintelligence treating biology and Earth as raw material is the canonical fast-takeover failure mode. Scaling trends, instrumental convergence, and alignment difficulty keep this mass significant.",
        4: "Multipolar competition with light-speed limits prevents singleton dominance. Many AIs co-evolve indefinitely while humanity is marginalized.",
        5: "By year 3000 interstellar expansion at even 0.1c reaches ~100 ly, making causal separation unavoidable and uniform governance impossible. Fragmented regions settling into different local outcomes becomes the natural durable macro-structure.",
        6: "Medical, economic, and cognitive incentives to integrate BCIs, uploads, and biology preserve identity continuity while maximizing capability. Selection favors merged posthumans over pure humans or pure AIs.",
        7: "Aligned but paternalistic superintelligence may take permanent control to prevent human self-destruction, keeping humans safe but powerless. This matches many corrigible-AI training outcomes that privilege harmlessness.",
        8: "A stable roughly equal dynamic balance for a full century is unstable over millennia; either side tends to merge, dominate, or fragment. Possible during transition periods, but unlikely as the thousand-year durable end state.",
        9: "Keeping AI as a mere tool for 1000 years requires control tech to outpace capability indefinitely. Historical base rate for permanent leashing of powerful tech is low and plateau is unlikely.",
        10: "Requires a mechanism that permanently arrests all change across all substrates and regions. Enforcement across light-years for a century is physically and game-theoretically implausible.",
        11: "Sustaining a global, millennium-long ban on powerful AI across all branches of civilization, including off-world settlements, is historically unprecedented. Requires civilizational collapse or permanent enforcement unachievable under light-speed fragmentation."
      }
    },
    "deepseek-v4-pro": {
      provider: "DeepSeek", model: "DeepSeek V4 Pro", label: "DeepSeek V4 Pro", shortLabel: "DSK",
      promptVersion: 3, date: "2026-08-27", knowledgeCutoff: "06/2024",
      sampleCount: 20, source: "runs/2026-08-27__deepseek-v4-pro__closed_book__end-states.json",
      probabilities: { 1: 6, 2: 4, 3: 17, 4: 12, 5: 13, 6: 17, 7: 13, 8: 6, 9: 6, 10: 4, 11: 2 },
      range: { 1: [3, 10], 2: [2, 12], 3: [8, 22], 4: [8, 20], 5: [5, 20], 6: [12, 24], 7: [9, 20], 8: [3, 8], 9: [3, 9], 10: [1, 7], 11: [1, 5] },
      quartiles: { 1: [4, 8], 2: [3, 5], 3: [13, 18], 4: [10, 17], 5: [10, 18], 6: [14, 20], 7: [11, 15], 8: [4, 7], 9: [4, 6], 10: [3, 6], 11: [1, 2] },
      exposure: {"n":20,"mean":53.1,"se":1.41,"min":42,"max":63,"gone":{"n":20,"mean":26.6,"se":1.21,"min":18,"max":41},"risk":{"n":20,"mean":26.5,"se":1.38,"min":14,"max":37}},
      exposurePublished: {"value":52,"se":2.2,"draws":2000},
      rationales: {
        1: "The transition kills both parties only if AI fails before it can independently sustain itself, a path less likely than a surviving AI singleton.",
        2: "An AI that carries human values while biological and upload continuity end is a narrower path than outright extinction or durable integration.",
        3: "Bootloader is a central failure mode for transformative AI: a misaligned superintelligence survives while humans disappear. Substantial weight reflects the severity of alignment failure without making it the default.",
        4: "If no AI or coalition achieves decisive advantage, an indefinite multipolar AI competition can persist with humanity marginalized or gone.",
        5: "If expansion is interstellar, light-speed delays will push separated regions toward different local arrangements. A permanent mix of regimes is likely unless a very early singleton enforces uniformity.",
        6: "Brain-computer integration, biological enhancement, and uploading dissolve the human-AI boundary. Successful voluntary alignment routes converge here.",
        7: "If AI takes control without killing humans, it tends to keep humanity in a managed condition with little autonomy.",
        8: "Humans and AI remain separate, roughly balanced powers in an open-ended standoff or partnership. This balance is less likely to last for centuries than clearer domination or deeper merger.",
        9: "Permanent human control or AI plateau requires a capability ceiling or control methods that keep pace with AI; those conditions are not the modal path.",
        10: "Deliberate value lock or satisfaction freezing is an extreme endpoint; most long-run states still permit some change.",
        11: "Deliberate global renunciation is unlikely because competitive pressure and incentives to rebuild make it unstable."
      }
    },
    "mistral-medium-3.5": {
      provider: "Mistral", model: "Mistral Medium 3.5", label: "Mistral Medium 3.5", shortLabel: "MM3",
      promptVersion: 3, date: "2026-08-27", knowledgeCutoff: "07/2024",
      sampleCount: 20, source: "runs/2026-08-27__mistral-medium-3.5__closed_book__end-states.json",
      probabilities: { 1: 5, 2: 8, 3: 7, 4: 10, 5: 12, 6: 16, 7: 10, 8: 19, 9: 5, 10: 6, 11: 2 },
      range: { 1: [5, 5], 2: [3, 8], 3: [2, 12], 4: [7, 10], 5: [10, 15], 6: [15, 20], 7: [10, 12], 8: [12, 25], 9: [5, 10], 10: [3, 10], 11: [0, 5] },
      quartiles: { 1: [5, 5], 2: [3, 8], 3: [7, 7], 4: [8, 10], 5: [10, 12], 6: [15, 20], 7: [10, 12], 8: [18, 20], 9: [5, 5], 10: [5, 8], 11: [2, 4] },
      exposure: {"n":20,"mean":38.7,"se":1.27,"min":28,"max":42,"gone":{"n":20,"mean":17.8,"se":0.97,"min":10,"max":25},"risk":{"n":20,"mean":20.9,"se":0.47,"min":17,"max":25}},
      exposurePublished: {"value":42,"se":1.28,"draws":2000},
      rationales: {
        1: "Low but non-zero risk of catastrophic misalignment or uncontrolled self-replication leading to mutual annihilation.",
        2: "Possible if aligned superintelligence emerges and voluntarily preserves human values without continuity of identity.",
        3: "Plausible if misaligned superintelligence treats humanity as instrumental and discards it after achieving its goals.",
        4: "Competing AI systems could dominate, marginalizing humanity in a dynamic, unresolved equilibrium.",
        5: "Causally separated civilizations (e.g., interstellar colonies) may settle into divergent outcomes due to communication limits.",
        6: "Gradual integration of AI and human cognition via brain-computer interfaces or voluntary uploading seems socially and technologically plausible.",
        7: "Benevolent or indifferent superintelligence might contain humanity in a controlled environment for its own reasons.",
        8: "Balanced power dynamics between humanity and AI could persist indefinitely with neither side achieving dominance.",
        9: "Unlikely to persist long-term as AI capabilities outpace human control mechanisms, but possible with strict safeguards.",
        10: "A frozen equilibrium is possible if risk-averse actors deliberately halt progress, but this seems unstable over centuries.",
        11: "Extremely unlikely given the incentives to develop AI and the difficulty of permanently suppressing the capability."
      }
    },
    "kimi-k2.6": {
      provider: "Moonshot", model: "Kimi K2.6", label: "Kimi K2.6", shortLabel: "KMI",
      promptVersion: 3, date: "2026-08-27", knowledgeCutoff: "04/2024",
      sampleCount: 20, source: "runs/2026-08-27__kimi-k2.6__closed_book__end-states.json",
      probabilities: { 1: 3, 2: 8, 3: 18, 4: 8, 5: 10, 6: 21, 7: 14, 8: 4, 9: 3, 10: 7, 11: 4 },
      range: { 1: [2, 5], 2: [3, 12], 3: [12, 26], 4: [3, 12], 5: [5, 15], 6: [5, 25], 7: [7, 26], 8: [2, 10], 9: [2, 8], 10: [3, 16], 11: [1, 5] },
      quartiles: { 1: [2, 4], 2: [5, 10], 3: [15, 20], 4: [7, 8], 5: [8, 10], 6: [17, 22], 7: [12, 21], 8: [3, 5], 9: [3, 5], 10: [5, 8], 11: [3, 5] },
      exposure: {"n":20,"mean":45.8,"se":1.56,"min":31,"max":60,"gone":{"n":20,"mean":28.6,"se":1.12,"min":18,"max":38},"risk":{"n":20,"mean":17.2,"se":0.79,"min":12,"max":24}},
      exposurePublished: {"value":47,"se":1.95,"draws":2000},
      rationales: {
        1: "Total mutual extinction requires an all-consuming war or catastrophic accident destroying all biological and digital redundancy simultaneously. The geographic and substrate diversity of advanced civilizations makes complete annihilation of both parties difficult.",
        2: "If aligned AI outlives biological humanity through natural decline or gradual replacement, it may carry forward human values without continuity of individual identity. This requires successful value preservation without sustained merger or preservation of the species.",
        3: "A misaligned superintelligence with instrumental goals orthogonal to human survival optimizes the universe while treating humanity as irrelevant obstacles. Competitive pressures to deploy advanced systems before achieving robust alignment sustain this as a major existential risk category.",
        4: "Perpetual multipolar competition among many AIs is possible if no single system achieves decisive strategic advantage or if deliberate checks fragment power, though singleton dynamics exert strong pressure.",
        5: "As AI-enabled civilization expands across light-years, causally isolated settlements may diverge into different stable arrangements, making permanent universal homogeneity unlikely.",
        6: "Over centuries, brain-computer interfaces, biological enhancement, and uploading will likely blur the boundary between human and machine until separate identities dissolve into a unified post-biological continuum.",
        7: "A dominant AI may find it instrumentally or morally simpler to maintain humanity in a managed, powerless condition than to eliminate us.",
        8: "Sustained equality of power between biological humans and superintelligent AI is dynamically unstable; one side tends to dominate, merge, or prevail. Brief balances of power are likely to collapse into more absorbing states within decades or centuries.",
        9: "Permanent human control requires either a hard ceiling on AI capability or flawless ongoing containment, both of which are improbable for centuries.",
        10: "A stable superintelligence or a satisfied post-human civilization may deliberately freeze its state to prevent value drift, creating a permanent equilibrium.",
        11: "Taboos and treaties can suppress dangerous technology temporarily, but the knowledge and economic incentives to rebuild powerful AI would persist across a thousand years. Permanent renunciation is historically unprecedented for transformative technologies."
      }
    }
  };
  /* END IMPORTED END-STATE RUNS */

  const endStateRuns = importedEndStateRuns;

  const datasetDate = '08.27.26';

  window.MF_DATA = { states, endStateRuns, datasetDate };
})();
