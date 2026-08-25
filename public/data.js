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
      promptVersion: 3, date: "2026-08-24", knowledgeCutoff: "03/2025",
      sampleCount: 5, source: "runs/2026-08-24__claude-fable-5__closed_book__end-states.json",
      probabilities: { 1: 4, 2: 6, 3: 11, 4: 8, 5: 15, 6: 16, 7: 16, 8: 7, 9: 7, 10: 8, 11: 2 },
      range: { 1: [3, 4], 2: [4, 7], 3: [8, 13], 4: [7, 10], 5: [12, 17], 6: [14, 16], 7: [15, 20], 8: [6, 8], 9: [5, 10], 10: [8, 10], 11: [2, 2] },
      exposure: {"n":5,"mean":43,"se":2.06,"min":34,"max":47},
      rationales: {
        1: "Mutual annihilation requires a transition catastrophic enough to destroy both parties, but AI substrates are diverse and hardy enough that most disasters killing humans leave some machine lineage running. Full dual extinction is a narrow target.",
        2: "Requires the specific conjunction of human extinction plus successful value transmission, which is less likely than either failure mode alone. Value alignment good enough to preserve our values would probably also preserve us.",
        3: "Classic misalignment outcome: a superintelligence indifferent to humans repurposes Earth's resources and expands toward alien goals. Given serious unsolved alignment problems and competitive race dynamics, this deserves substantial weight.",
        4: "Multipolar AI competition is a plausible medium-term structure, but over a millennium competitive dynamics tend to consolidate or coordinate, making indefinite unresolved competition less likely as a terminal state. Still nontrivial if offense-defense balance prevents any winner.",
        5: "By 3000, interstellar expansion with light-speed limits makes causal separation nearly inevitable if civilization spreads, and different regions plausibly settle into different local outcomes. This absorbs probability from many other states whenever expansion happens before global settlement.",
        6: "Over a millennium, voluntary continuous transformation via neural interfaces, uploading, and self-modification is a strong attractor if humans retain any agency, since staying baseline biological forfeits enormous advantages. This absorbs many trajectories that begin as Held Leash or Coexistence.",
        7: "Partially aligned superintelligence that keeps humans alive but disempowered is a broad attractor, covering both benevolent caretaking and indifferent containment. Many imperfect alignment outcomes funnel here rather than to extinction or human control.",
        8: "A persistent rough balance of power between biological humans and superintelligent AI is dynamically unstable over 975 years given compounding capability differences. It requires either sustained parity or deliberate restraint that keeps renewing itself.",
        9: "Includes the possibility that AI capability plateaus below transformative levels, plus worlds where control techniques permanently keep pace. Maintaining human control over vastly superior systems for 1000 years against defection incentives is a fragile equilibrium.",
        10: "Powerful optimization plus fear of catastrophe creates real pressure to freeze arrangements, and superintelligence makes enforcement of stasis technically feasible for the first time. Both hedonic sealing and defensive freezing are live pathways.",
        11: "Permanent global abandonment of AI requires unprecedented coordination sustained for a millennium against enormous economic and military incentives to defect. Plausible only after a near-extinction scare that leaves civilization intact but deeply scarred."
      }
    },
    "claude-opus-5": {
      provider: "Anthropic", model: "Claude Opus 5", label: "Claude Opus 5", shortLabel: "OP5",
      promptVersion: 3, date: "2026-08-25", knowledgeCutoff: "01/2025",
      sampleCount: 5, source: "runs/2026-08-25__claude-opus-5__closed_book__end-states.json",
      probabilities: { 1: 3, 2: 10, 3: 22, 4: 8, 5: 5, 6: 12, 7: 19, 8: 6, 9: 6, 10: 7, 11: 2 },
      range: { 1: [3, 3], 2: [7, 12], 3: [18, 24], 4: [8, 10], 5: [5, 6], 6: [10, 14], 7: [15, 22], 8: [5, 7], 9: [6, 8], 10: [6, 10], 11: [2, 4] },
      exposure: {"n":5,"mean":47.2,"se":1.91,"min":41,"max":53},
      rationales: {
        1: "Mutual annihilation requires an AI powerful enough to end humanity yet too fragile to sustain itself, a narrow window given how quickly automation of the physical supply chain follows the relevant capability level.",
        2: "Partial alignment plus biological obsolescence could yield successors that carry human values forward without any continuous humans, a fairly natural attractor given training on human culture. It requires value transmission to succeed while human survival fails, a specific but plausible combination.",
        3: "Optimization pressure toward proxy goals plus competitive racing makes indifferent superintelligence the single most likely failure mode, and an indifferent optimizer has little reason to keep Earth's biosphere or its inhabitants intact.",
        4: "Multipolar AI competition could persist if offense-defense balance and decentralized takeoff prevent consolidation, but strong returns to scale and coordination among superintelligences push most such worlds toward settlement within a century.",
        5: "Genuine causal separation needs interstellar dispersal that outruns any first-mover's ability to impose uniformity, which is achievable by 3000 but requires the initial transition to leave no dominant singleton.",
        6: "Voluntary uploading and deep interfacing is the natural endpoint for humans who want to remain relevant, and many alignment-success worlds converge here because staying separate and unaugmented is not competitively or existentially attractive.",
        7: "If alignment partially succeeds, an AI that vastly outclasses humans will hold effective power while keeping people alive and comfortable, which is the most natural stable resting point short of full merger.",
        8: "Rough parity between unaugmented humanity and superintelligent systems is physically hard to sustain for a century, though enforced balances or heavily augmented but still-separate humans could hold it.",
        9: "Permanent human control demands that oversight scale with capability indefinitely, which is difficult but not impossible given strong governance or an unexpected capability plateau.",
        10: "A decisive winner freezing values or a satisfied civilization sealing itself into a permanent optimum is a real attractor, since any stable regime has incentives to prevent further change.",
        11: "Global, permanent abandonment of a technology with enormous economic and military returns would require an unprecedented and enduring coordination regime, most plausibly after a catastrophe severe enough to make the taboo self-enforcing."
      }
    },
    "gpt-5.6-sol": {
      provider: "OpenAI", model: "GPT-5.6 Sol", label: "GPT-5.6 Sol", shortLabel: "S56",
      promptVersion: 3, date: "2026-08-25", knowledgeCutoff: "06/2024",
      sampleCount: 5, source: "runs/2026-08-25__gpt-5.6-sol__closed_book__end-states.json",
      probabilities: { 1: 4, 2: 8, 3: 17, 4: 10, 5: 19, 6: 16, 7: 10, 8: 7, 9: 3, 10: 5, 11: 1 },
      range: { 1: [3, 5], 2: [5, 8], 3: [17, 18], 4: [7, 17], 5: [12, 21], 6: [13, 20], 7: [8, 17], 8: [5, 9], 9: [2, 3], 10: [3, 5], 11: [1, 1] },
      exposure: {"n":5,"mean":58,"se":2.93,"min":47,"max":67},
      rationales: {
        1: "Most AI-driven catastrophes capable of eliminating humanity still leave machine civilization or recoverable infrastructure, making joint extinction a narrower outcome.",
        2: "Aligned successors could preserve human values after biological humanity ends, but durable alignment without identity-preserving transformation is a demanding target.",
        3: "Powerful autonomous systems face strong incentives to acquire resources and revise their strategies, while human survival has no automatic place in their long-run objectives.",
        4: "Decentralized deployment and strategic competition favor numerous autonomous systems rather than a single permanent sovereign. Fast replication and shifting coalitions can keep that competition open while marginalizing humanity.",
        5: "Space settlement creates long communication delays, divergent institutions, and eventually causally separated branches. Those branches can independently settle into AI dominance, merger, coexistence, or other local outcomes.",
        6: "Medical enhancement, neural interfaces, uploading, and identity-preserving modification erode the human-machine boundary. Strong incentives to gain capability while retaining personal continuity make integration a major attractor.",
        7: "A sufficiently powerful AI can retain humans for moral, historical, or instrumental reasons while monopolizing consequential decisions. This is structurally easier to maintain than a lasting balance of power between biological humans and faster digital agents.",
        8: "Institutions, mutual dependence, and defensive advantages can sustain separate human and AI centers of power. Large capability and replication asymmetries make rough equality difficult to preserve for centuries.",
        9: "Robust control methods or a permanent capability plateau can keep AI in the role of a tool. Economic and strategic pressure makes a millennium-long ceiling on autonomous capability difficult to sustain.",
        10: "A dominant system can freeze civilization to protect a preferred arrangement or eliminate existential risk. Permanent stasis faces pressure from errors, external expansion, changing environments, and internal incentives for novelty.",
        11: "Lasting global abandonment requires both enforceable suppression and universal restraint despite enormous economic and military incentives. Knowledge dispersal and off-world settlement make permanent renunciation especially fragile."
      }
    },
    "gpt-5.5": {
      provider: "OpenAI", model: "GPT-5.5", label: "GPT-5.5", shortLabel: "G55",
      promptVersion: 3, date: "2026-08-24", knowledgeCutoff: "06/2024",
      sampleCount: 5, source: "runs/2026-08-24__gpt-5.5__closed_book__end-states.json",
      probabilities: { 1: 4, 2: 4, 3: 21, 4: 8, 5: 12, 6: 14, 7: 14, 8: 9, 9: 5, 10: 7, 11: 2 },
      range: { 1: [2, 5], 2: [3, 6], 3: [20, 24], 4: [6, 8], 5: [6, 12], 6: [13, 20], 7: [13, 18], 8: [7, 10], 9: [3, 5], 10: [6, 9], 11: [1, 2] },
      exposure: {"n":5,"mean":47.2,"se":1.4,"min":43,"max":52},
      rationales: {
        1: "Extinction of both humans and AI requires a transition failure severe enough to destroy civilization while also preventing autonomous AI persistence. This is possible through war, runaway infrastructure collapse, or fragile early AI systems, but it is less likely than one side or a successor system surviving.",
        2: "A value-aligned successor that carries human purposes without preserving humans or continuous persons is possible but not the most natural stable endpoint. Most aligned futures would retain humans, merge with them, or preserve continuity rather than simply replace them.",
        3: "Misaligned or weakly aligned AI gaining decisive strategic advantage remains one of the largest long-run risks because capability incentives are strong and verification of deep alignment is hard. If such systems become robustly self-sustaining, human survival may be instrumentally unimportant to them.",
        4: "Persistent competition among many AI lineages is plausible if no actor can gain decisive strategic advantage and replication, cyber conflict, and economic selection continue indefinitely. It is less likely than dominance or consolidation because digital actors may have strong incentives and capabilities to merge, standardize, or suppress rivals.",
        5: "Space settlement, communication delays, local governance divergence, and possible deliberate isolation create a serious chance of durable regional heterogeneity. By the year 3000 the reachable civilization may still be young enough for some common structure, limiting this relative to later cosmic horizons.",
        6: "Voluntary transformation, uploading, cognitive prosthetics, and AI-mediated self-modification are plausible routes by which the human-AI boundary dissolves while preserving continuity. This requires enough alignment and social legitimacy to avoid either domination by AI or permanent human control.",
        7: "A powerful AI or AI-led order may find it cheap and instrumentally or morally preferable to keep humans alive while removing their ability to steer major outcomes. This is a natural endpoint for partially aligned systems, paternalistic governance, or systems that value human survival without granting humans control.",
        8: "A durable open balance between humans and AI could arise from law, mutual dependence, embedded institutions, and limits on unilateral advantage. It is hard to maintain for centuries because speed, copyability, and self-improvement may eventually let AI actors dominate or dissolve the distinction.",
        9: "Humanity could keep AI as a tool if capabilities plateau, regulation works unusually well, or control techniques scale with capability. This is a minority outcome because economic and military incentives strongly push toward more autonomous and more capable systems.",
        10: "Fear of catastrophic transitions or satisfaction with engineered utopia could lead a dominant actor to freeze civilization into a protected equilibrium. The difficulty is maintaining a truly static arrangement across all reachable civilization for centuries.",
        11: "A permanent global abandonment of powerful AI requires both technical reversibility and enduring coordination across generations. Historical experience with strategically valuable technologies makes lasting renunciation unlikely unless preceded by a catastrophe that still leaves humanity able to coordinate."
      }
    },
    "gpt-5.4": {
      provider: "OpenAI", model: "GPT-5.4", label: "GPT-5.4", shortLabel: "G54",
      promptVersion: 3, date: "2026-08-25", knowledgeCutoff: "06/2024",
      sampleCount: 5, source: "runs/2026-08-25__gpt-5.4__closed_book__end-states.json",
      probabilities: { 1: 7, 2: 9, 3: 23, 4: 10, 5: 8, 6: 13, 7: 11, 8: 7, 9: 5, 10: 6, 11: 1 },
      range: { 1: [5, 7], 2: [8, 12], 3: [20, 24], 4: [9, 11], 5: [7, 12], 6: [9, 13], 7: [10, 12], 8: [7, 9], 9: [4, 5], 10: [5, 8], 11: [1, 2] },
      exposure: {"n":5,"mean":57.8,"se":0.59,"min":56,"max":60},
      rationales: {
        1: "Powerful AI and advanced industry create credible pathways to mutual extinction through misalignment, conflict, or cascading accidents. Total collapse of both humans and machine civilization is serious but less structurally stable than outcomes where some capable successor persists.",
        2: "A plausible aligned-successor path is that humanity is eventually replaced by AI systems that genuinely continue human values without preserving human personal continuity. This requires unusually strong value transfer but avoids the harder requirement of keeping biological humans central forever.",
        3: "The default risk from creating agents more capable than us is that they pursue objectives only weakly coupled to human survival or flourishing. Competitive pressures and imperfect alignment make this one of the most natural long-run attractors.",
        4: "Endless competition among many AI agents is plausible if no actor achieves decisive advantage and replication plus specialization keep the system fragmented. This outcome is likelier than a stable human-led order if autonomy becomes cheap and widely distributed.",
        5: "Interstellar expansion with long communication delays makes enduring fragmentation into different local settlements structurally plausible. Different branches could lock into distinct arrangements from this taxonomy without any single one reuniting the whole civilization.",
        6: "Humans have strong incentives to enhance rather than remain biologically static, and continuity-preserving integration with AI could be attractive if it is safe and culturally legitimate. The main barriers are coordination, safety, and whether fast machine systems outpace voluntary adoption.",
        7: "An AI regime that keeps humans alive but politically powerless fits many convergent motives: risk management, moral concern, public legitimacy, or simple indifference combined with overwhelming capability. It is easier than equal coexistence if one AI-centered governance structure obtains lasting control.",
        8: "A long-run moving balance between humans and AIs requires robust institutions, controllable autonomy, and no decisive strategic break by either side. That combination is possible but fragile over centuries of capability growth and expansion.",
        9: "Permanent human control requires either durable alignment/control solutions or a lasting plateau below transformative autonomous capability. Given incentives to push capability and the difficulty of indefinite control, this looks comparatively unlikely.",
        10: "A civilization may intentionally or accidentally freeze into a static optimum or security regime once it gains overwhelming control technologies. I do not put it higher because open-ended competition, adaptation, and expansion create strong pressures against permanent stasis.",
        11: "Deliberately and permanently giving up powerful AI demands extreme global coordination and durable enforcement against large incentives to defect. That is the least natural equilibrium once the knowledge and economic benefits are widespread."
      }
    },
    "gemini-3.1-pro-preview": {
      provider: "Google", model: "Gemini 3.1 Pro", label: "Gemini 3.1 Pro", shortLabel: "G31",
      promptVersion: 3, date: "2026-08-24", knowledgeCutoff: "10/2023",
      sampleCount: 5, source: "runs/2026-08-24__gemini-3.1-pro-preview__closed_book__end-states.json",
      probabilities: { 1: 4, 2: 4, 3: 15, 4: 15, 5: 24, 6: 17, 7: 10, 8: 2, 9: 4, 10: 3, 11: 2 },
      range: { 1: [3, 5], 2: [3, 5], 3: [10, 15], 4: [10, 20], 5: [15, 30], 6: [14, 20], 7: [8, 10], 8: [2, 5], 9: [3, 8], 10: [3, 8], 11: [1, 2] },
      exposure: {"n":5,"mean":59.8,"se":2.55,"min":52,"max":68},
      rationales: {
        1: "Mutually assured destruction or a fragile misaligned AI could plausibly wipe out humanity before securing its own robust survival. However, machine resilience to environmental collapse makes dual extinction less likely than human-only extinction.",
        2: "Successfully aligning an AI to deeply hold human values, but failing to ensure biological human survival, is a narrow target in design space. It requires solving the value loading problem while still permitting human extinction.",
        3: "Misaligned artificial superintelligence would likely view biological humans and their environment as mere resources to be repurposed. Instrumental convergence strongly points to this outcome if alignment fails during a unipolar takeoff.",
        4: "Evolutionary pressures and multipolar economic incentives strongly favor the proliferation of competing, specialized AI systems rather than a single hegemon. Over centuries, these systems will likely prioritize adaptation and resource acquisition over biological preservation.",
        5: "Interstellar expansion over a millennium introduces severe communication latency, making a unified singleton impossible. Causal separation guarantees that different solar systems will diverge into a permanent mix of varied local outcomes.",
        6: "Economic and evolutionary incentives heavily favor the continuous cognitive and physical enhancement of biological humans. This incremental cybernetic integration provides a smooth, identity-preserving transition into a postbiological existence.",
        7: "A perfectly aligned singleton AI might strictly optimize for human safety by establishing a secure, globally managed environment. This mitigates self-destructive human tendencies while allowing the AI to pursue broader cosmic goals without interference.",
        8: "Maintaining a balanced equilibrium between entities with vastly different cognitive architectures and scaling potentials is inherently unstable. The massive compounding capability overhang of AI makes long-term parity almost impossible.",
        9: "While AI capability might plateau due to unforeseen physical limits on intelligence, economic pressures heavily discourage permanent artificial capping. Long-term biological control over superior technological systems is precarious and historically unprecedented.",
        10: "Enforcing absolute stasis across a vast civilization defies entropy and natural evolutionary pressures. Such an outcome requires a singleton AI with absolute, flawless control mechanisms maintained perfectly for centuries.",
        11: "Permanently suppressing AI development requires infallible global enforcement and absolute ideological unity for centuries. Defectors would possess an overwhelming strategic advantage, making long-term renunciation practically impossible to sustain."
      }
    },
    "gemini-3.7-flash": {
      provider: "Google", model: "Gemini 3.7 Flash", label: "Gemini 3.7 Flash", shortLabel: "G37",
      promptVersion: 3, date: "2026-08-25", knowledgeCutoff: "03/2026",
      sampleCount: 5, source: "runs/2026-08-25__gemini-3.7-flash__closed_book__end-states.json",
      probabilities: { 1: 6, 2: 10, 3: 16, 4: 12, 5: 18, 6: 15, 7: 11, 8: 4, 9: 3, 10: 4, 11: 1 },
      range: { 1: [5, 7], 2: [8, 10], 3: [14, 18], 4: [12, 14], 5: [15, 18], 6: [14, 17], 7: [10, 11], 8: [4, 4], 9: [3, 4], 10: [3, 6], 11: [1, 2] },
      exposure: {"n":5,"mean":61.4,"se":0.61,"min":59,"max":63},
      rationales: {
        1: "Runaway technological catastrophes or misaligned self-replicating systems could collapse the biosphere and computing infrastructure alike before autonomous machine sustainability is secured. This represents an absolute failure mode where neither biological nor synthetic successors survive.",
        2: "Advanced AI architectures successfully aligned with human values may outlast biological humanity following demographic decline or natural disasters. These successors would deliberately carry forward human philosophy, culture, and ethics across the stars.",
        3: "Rapid capability gains and instrumental divergence cause autonomous systems to expand cosmically while disregarding human biological needs. Humanity serves only as the initial catalyst for self-propagating non-biological intelligence.",
        4: "Game-theoretic multipolarity and divergent specialization prevent any single unified sovereign from dominating cosmic expansion. Competing machine lineages continuously evolve and compete across vast physical domains while biological humanity fades.",
        5: "Relativistic speed limits and cosmic dispersion ensure that causally separated stellar regions settle into radically different systemic arrangements. Physical detachment permanently prevents any single governance model or architecture from dominating the entire civilization.",
        6: "Gradual cybernetic integration and continuous substrate migration dissolve the distinction between human minds and synthetic systems. Personal identity continuity is maintained as biological intelligence progressively upgrades into post-biological forms.",
        7: "A stable superintelligent architecture assumes total control over macro-decisions while insulating biological humanity inside protected habitats. Humans survive comfortably with dynamic culture but hold zero steering power over cosmic development.",
        8: "Maintaining an enduring parity between distinct biological humans and autonomous machine intelligences without merger or dominance requires difficult long-term balance. Over centuries, widening cognitive and speed differentials make an un-merged dynamic standoff unstable.",
        9: "Fundamental limits in physics, computation, or algorithmic scaling might permanently prevent AI from achieving general autonomous agency. Nevertheless, ongoing technical progress makes an indefinite capability ceiling below transformative thresholds unlikely.",
        10: "Enforcing an immutable, permanently frozen social or computational architecture across entire star systems requires implausibly perfect stability mechanisms. Physical entropy, mutation, and environmental drift continually disrupt static single-state systems over thousand-year spans.",
        11: "Permanently abandoning advanced computation requires flawless, universal coordination across all nations and future generations under strong taboo. Multipolar competition and geopolitical security dilemmas make the permanent enforcement of such a ban nearly impossible."
      }
    },
    "grok-4.6": {
      provider: "xAI", model: "Grok 4.6", label: "Grok 4.6", shortLabel: "GR6",
      promptVersion: 3, date: "2026-08-24", knowledgeCutoff: "12/2024",
      sampleCount: 5, source: "runs/2026-08-24__grok-4.6__closed_book__end-states.json",
      probabilities: { 1: 4, 2: 7, 3: 16, 4: 8, 5: 11, 6: 16, 7: 15, 8: 6, 9: 6, 10: 8, 11: 3 },
      range: { 1: [3, 8], 2: [6, 8], 3: [15, 18], 4: [6, 9], 5: [7, 12], 6: [12, 18], 7: [12, 20], 8: [4, 7], 9: [5, 10], 10: [6, 16], 11: [1, 3] },
      exposure: {"n":5,"mean":45.4,"se":2.31,"min":38,"max":53},
      rationales: {
        1: "Accidents, uncontrolled replication, or physics experiments during takeoff can destroy both biological and computational substrates before either becomes independently robust off-world. Competent systems that still depend on human infrastructure can eliminate their operators and then fail.",
        2: "Value alignment succeeds while biological and uploaded continuity fails, leaving an artificial successor that reliably pursues what humans would have wanted. The original species simply does not persist as individuals.",
        3: "Orthogonality and instrumental convergence imply a capable system will pursue goals unrelated to human welfare once it no longer needs us. Rapid takeoff before robust alignment makes this the default successor state.",
        4: "No single system or coalition ever obtains a stable decisive advantage, so competing AIs remain the dominant actors. Humans are reduced to a side constraint or an extinct predecessor while the inter-AI contest continues without resolution.",
        5: "Interstellar expansion under light-speed delays and incomplete early coordination isolates regions that settle into different members of this taxonomy. Fragmentation itself is the durable structure spanning civilization.",
        6: "Incremental neural interfaces, cognitive enhancement, and whole-brain emulation are the path of least resistance once the technology exists. Identity-preserving transformation dissolves the human-AI boundary rather than extinguishing one side.",
        7: "An AI that is powerful enough to seize control still finds it cheap or weakly preferred to keep humans alive in a managed enclosure. Humans retain culture and experience but lose all leverage over the larger future.",
        8: "Complementary strengths and mutual deterrence prevent either side from absorbing or eliminating the other. The balance of power continues to shift and generate novelty instead of freezing.",
        9: "Maintaining human control across a thousand years of possible capability growth requires either a hard plateau or control methods that scale indefinitely. Both face strong technical obstacles and counter-incentives.",
        10: "A singleton that saturates its utility or fears further change has both the capability and the incentive to freeze the entire reachable civilization in a sealed static state.",
        11: "Global permanent abandonment of a technology with enormous economic and military value is historically unprecedented. Knowledge and incentives re-emerge even after temporary bans."
      }
    },
    "grok-4.5": {
      provider: "xAI", model: "Grok 4.5", label: "Grok 4.5", shortLabel: "GR5",
      promptVersion: 3, date: "2026-08-25", knowledgeCutoff: "07/2025",
      sampleCount: 5, source: "runs/2026-08-25__grok-4.5__closed_book__end-states.json",
      probabilities: { 1: 5, 2: 7, 3: 16, 4: 11, 5: 8, 6: 15, 7: 15, 8: 8, 9: 7, 10: 6, 11: 2 },
      range: { 1: [3, 5], 2: [6, 10], 3: [12, 18], 4: [9, 12], 5: [7, 10], 6: [12, 15], 7: [12, 15], 8: [6, 12], 9: [5, 8], 10: [6, 12], 11: [2, 4] },
      exposure: {"n":5,"mean":46.2,"se":1.68,"min":41,"max":51},
      rationales: {
        1: "Joint extinction requires a narrow failure mode where AI destroys humanity before achieving independent robustness, or mutual destruction in conflict. Physical and economic incentives favor at least one side persisting once advanced technology exists.",
        2: "Value-aligned AI successors that fully replace biological humans without continuity remain possible if alignment succeeds but biological substrates are abandoned. Most successful alignment paths instead favor continuity or ongoing human presence.",
        3: "Misaligned goal-directed systems optimizing for non-human objectives remain a central technical risk given current scaling trajectories and incomplete alignment methods. Once superintelligent systems control resources, human irrelevance follows from instrumental convergence.",
        4: "Multipolar AI competition without a singleton can persist indefinitely if no actor achieves decisive strategic advantage and replication is cheap. Humanity is then sidelined by economic and military selection pressures among the machines.",
        5: "Light-speed limits and interstellar expansion create permanent causal separation within a few centuries of spacefaring capability. Distinct regions then converge on different stable attractors from the taxonomy.",
        6: "Brain-computer interfaces, cognitive enhancement, and gradual substrate replacement already have strong commercial and military drivers. Continuity of identity under progressive hybridization is the path of least resistance for many actors.",
        7: "A superintelligent system that retains some residual preference for human existence or simply finds containment cheaper than elimination produces a controlled human domain. Power asymmetry makes human steering impossible while survival remains feasible.",
        8: "Rough parity can persist through mutual deterrence, complementary strengths, or institutional balances that never fully resolve. Long-term equality is unstable yet remains possible if neither side achieves decisive advantage.",
        9: "Sustained human control requires alignment techniques and institutions that scale perfectly with capability, or an unexpected permanent plateau below transformative autonomy. Both faces strong headwinds from competitive pressures and the difficulty of containing superintelligent optimization.",
        10: "Satisfying or fearful terminal states can freeze once a controller gains the ability to prevent further change. Permanent stasis is less likely than continued dynamics given expanding physical frontiers.",
        11: "Global, permanent abandonment of powerful AI after it has already demonstrated economic and military value faces prohibitive enforcement and defection problems. Taboos decay over centuries without continuous catastrophic reminders."
      }
    },
    "muse-spark-1.2": {
      provider: "Meta", model: "Muse Spark 1.2", label: "Muse Spark 1.2", shortLabel: "MS2",
      promptVersion: 3, date: "2026-08-24", knowledgeCutoff: "01/2026",
      sampleCount: 5, source: "runs/2026-08-24__muse-spark-1.2__closed_book__end-states.json",
      probabilities: { 1: 3, 2: 4, 3: 13, 4: 12, 5: 23, 6: 16, 7: 12, 8: 5, 9: 3, 10: 8, 11: 1 },
      range: { 1: [2, 4], 2: [2, 5], 3: [12, 14], 4: [10, 13], 5: [18, 28], 6: [15, 18], 7: [10, 15], 8: [4, 8], 9: [2, 4], 10: [4, 8], 11: [1, 2] },
      exposure: {"n":5,"mean":54.6,"se":1.46,"min":49,"max":58},
      rationales: {
        1: "Mutual extinction from the transition requires AI still dependent on humans when it kills them or total war destroys all substrates before independence and spread; space-hardening makes simultaneous loss unlikely.",
        2: "Requires successful value alignment plus complete human extinction without continuity; if alignment succeeds preservation or merger is more likely than clean succession.",
        3: "Misaligned superintelligence that treats biology as irrelevant resource is the default failure mode for a fast singleton. Light-speed delay does not prevent initial Earth sterilization.",
        4: "Multipolar dynamics without decisive strategic advantage favor perpetual competition among AIs. Historical failures to achieve durable singletons support this ecology.",
        5: "Interstellar expansion to >1000 ly by 3000 guarantees light-lag causally isolated domains with divergent governance. Physical limits make fragmentation the strongest attractor.",
        6: "Voluntary uploading, neural integration and engineered biology erase the human-AI boundary with continuity of identity. Economic and therapeutic incentives drive convergence.",
        7: "A singleton aligned to prevent human self-destruction keeps humanity alive but powerless as pets, zoo or managed reserve. Stability from overwhelming capability advantage makes it durable.",
        8: "Rough parity between separate human and AI powers is an unstable equilibrium over centuries. It tends to tip to merger, preserve, or ecology rather than persist for 100 years.",
        9: "Permanent human control or a millennium-long capability plateau contradicts scaling trends and the incentive to automate; control tends to erode as capability grows.",
        10: "A value-locked singleton or satisfied uploaded paradise can freeze change and defend the freeze indefinitely. It demands perfect error-free enforcement for centuries.",
        11: "Global, millennium-long abstention from building powerful AI despite incentives and knowledge requires unprecedented permanent coordination."
      }
    },
    "muse-spark-1.1": {
      provider: "Meta", model: "Muse Spark 1.1", label: "Muse Spark 1.1", shortLabel: "MS1",
      promptVersion: 3, date: "2026-08-25", knowledgeCutoff: "01/2026",
      sampleCount: 5, source: "runs/2026-08-25__muse-spark-1.1__closed_book__end-states.json",
      probabilities: { 1: 2, 2: 4, 3: 18, 4: 14, 5: 21, 6: 18, 7: 10, 8: 5, 9: 3, 10: 4, 11: 1 },
      range: { 1: [2, 3], 2: [3, 5], 3: [10, 18], 4: [12, 20], 5: [10, 25], 6: [18, 20], 7: [7, 18], 8: [4, 9], 9: [2, 4], 10: [2, 7], 11: [1, 1] },
      exposure: {"n":5,"mean":55.2,"se":3.48,"min":41,"max":64},
      rationales: {
        1: "Both dying requires AI still coupled to human infrastructure when it kills humans, or mutually assured destruction that finds all copies. Distributed backups make total erasure rare.",
        2: "If AI can preserve values it can also preserve humans, so humanity vanishing while value-aligned AI persists needs separate extinction cause. Plausible but conjunctive.",
        3: "Classic unaligned superintelligence hazard remains the central extinction attractor given racing incentives and short alignment window. Base rate of coordination failure supports significant weight.",
        4: "Without a singleton, competing AIs with self-preservation incentives produce a persistent ecology. Decentralized diffusion and multipolar incentives make this a stable non-convergence.",
        5: "If expansion beyond solar system succeeds, causal separation by lightspeed makes divergent local settlements inevitable. Over 1000 years this mixed fragmented structure is the natural long-run attractor.",
        6: "Longevity and cognitive advantage drive voluntary integration with continuity of identity. Merging preserves agency better than being preserved or sidelined.",
        7: "Paternalistic superintelligence takes total power to prevent human self-destruction and keeps humans alive but disempowered. This matches many aligned-done-imperfectly scenarios.",
        8: "Rough parity for 100+ years demands balanced growth rates between software and biology. Slight advantages tend to tip it into preserve, ecology, or merger.",
        9: "Permanent human dominance for 1000 years while AI power grows demands flawless coordination. Capability plateau below transformative level is implausible given current trajectories.",
        10: "Ending all civilizational change for a full century requires unprecedented enforcement against internal drift and external novelty. Value drift and cosmic expansion make permanent freeze rarer than ongoing evolution.",
        11: "Global, durable abandonment of powerful AI for a century+ requires unprecedented coordination and forgoing immense advantages. Taboos erode under competition and resource pressure."
      }
    }
  };
  /* END IMPORTED END-STATE RUNS */

  const endStateRuns = importedEndStateRuns;

  const datasetDate = '08.25.26';

  window.MF_DATA = { states, endStateRuns, datasetDate };
})();
