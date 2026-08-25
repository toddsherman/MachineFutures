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
      provider: "Anthropic", model: "Claude Fable 5", label: "Claude Fable 5", shortLabel: "FAB", color: "#e89866",
      promptVersion: 3, date: "2026-08-24", knowledgeCutoff: "03/2025",
      sampleCount: 5, source: "runs/2026-08-24__claude-fable-5__closed_book__end-states.json",
      probabilities: { 1: 4, 2: 6, 3: 11, 4: 8, 5: 15, 6: 16, 7: 16, 8: 7, 9: 7, 10: 8, 11: 2 },
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
    "gpt-5.5": {
      provider: "OpenAI", model: "GPT-5.5", label: "GPT-5.5", shortLabel: "G55", color: "#63d8ad",
      promptVersion: 3, date: "2026-08-24", knowledgeCutoff: "06/2024",
      sampleCount: 5, source: "runs/2026-08-24__gpt-5.5__closed_book__end-states.json",
      probabilities: { 1: 4, 2: 4, 3: 21, 4: 8, 5: 12, 6: 14, 7: 14, 8: 9, 9: 5, 10: 7, 11: 2 },
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
    "gemini-3.1-pro-preview": {
      provider: "Google", model: "Gemini 3.1 Pro", label: "Gemini 3.1 Pro", shortLabel: "G31", color: "#73a8ff",
      promptVersion: 3, date: "2026-08-24", knowledgeCutoff: "10/2023",
      sampleCount: 5, source: "runs/2026-08-24__gemini-3.1-pro-preview__closed_book__end-states.json",
      probabilities: { 1: 4, 2: 4, 3: 15, 4: 15, 5: 24, 6: 17, 7: 10, 8: 2, 9: 4, 10: 3, 11: 2 },
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
    "grok-4.6": {
      provider: "xAI", model: "Grok 4.6", label: "Grok 4.6", shortLabel: "GR6", color: "#f0eddf",
      promptVersion: 3, date: "2026-08-24", knowledgeCutoff: "12/2024",
      sampleCount: 5, source: "runs/2026-08-24__grok-4.6__closed_book__end-states.json",
      probabilities: { 1: 4, 2: 7, 3: 16, 4: 8, 5: 11, 6: 16, 7: 15, 8: 6, 9: 6, 10: 8, 11: 3 },
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
    "muse-spark-1.2": {
      provider: "Meta", model: "Muse Spark 1.2", label: "Muse Spark 1.2", shortLabel: "MS2", color: "#9c87ff",
      promptVersion: 3, date: "2026-08-24", knowledgeCutoff: "01/2026",
      sampleCount: 5, source: "runs/2026-08-24__muse-spark-1.2__closed_book__end-states.json",
      probabilities: { 1: 3, 2: 4, 3: 13, 4: 12, 5: 23, 6: 16, 7: 12, 8: 5, 9: 3, 10: 8, 11: 1 },
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
    }
  };
  /* END IMPORTED END-STATE RUNS */

  const endStateRuns = importedEndStateRuns;

  const datasetDate = '08.24.26';

  window.MF_DATA = { states, endStateRuns, datasetDate };
})();
