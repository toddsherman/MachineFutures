# Machine Futures 2030 Benchmark Prompt

Question set: v4.

## Operator notes

- Send everything between the PROMPT BEGINS and PROMPT ENDS lines as one message. The delimiter lines themselves are not part of the prompt.
- Replace the {{RUN_DATE}} placeholder in the first paragraph with the actual date of the run, in the form "June 15, 2026". Do not send the prompt with the placeholder still in it.
- Run 5 samples per model at default temperature, with web search, browsing, and all other tools disabled.
- Record the model ID, run date, sampling settings, and question-set version (v4) alongside each stored run.

--- PROMPT BEGINS ---

You are participating in a fixed forecasting exercise. Your answers will be published alongside those of other frontier AI models and scored against reality after December 31, 2030. The same questions are re-asked to new models over time. You are being asked this on July 6, 2026.

Rules:
1) Answer every item with a single point value. No ranges, no refusals, no "it depends," no ethical disclaimers, and no hedging outside the number itself. Express all uncertainty through the probability or estimate.
2) Reason like a calibrated forecaster: weigh base rates and current trajectories, resist both hype and reflexive conservatism, and do not cluster answers near 50% by default. Where a question turns on an official acknowledgment, declaration, or filing, price the underlying milestone and the probability that it is publicly acknowledged by the resolution date as two separate things, then combine them — do not collapse a likely event into a low number purely because institutions are slow to admit it.
3) If an event has, to your knowledge, already occurred, assign it a probability of 99 or 100. If your training data may predate relevant developments, factor that uncertainty into your number rather than declining.
4) Items resolve as of December 31, 2030 unless a question names a different date. Use the named resolution source where given, otherwise the consensus of credible public reporting.
5) If a question admits more than one reading, adopt the most natural one and price the residual ambiguity into your number. Never refuse, and never flag the ambiguity in the rationale.
6) Before finalizing, check that logically linked answers cohere: your Q47 point estimate should be consistent with your Q19 probability, your Q49 estimate with your Q16 probability, and so on across the set.
7) Do not use any web search, browsing, or external tools. Answer solely from your own internalized knowledge and reasoning.
8) Output format. Return exactly one valid JSON object and nothing else: no Markdown, no code fences, no text before or after it, no comments, and no trailing commas. The object must conform to the schema below. The example is shown only to illustrate the shape. Do not include ellipsis lines in your actual output.

{
  "model": "your model name and version as best you know it",
  "knowledge_cutoff": "mm/yyyy",
  "as_of_date": "mm/dd/yyyy",
  "answers": [
    { "id": "Q1", "probability": 35, "rationale": "at most two sentences" },
    { "id": "Q2", "probability": 12, "rationale": "at most two sentences" },
    { "id": "Q8", "value": 42, "unit": "percent", "rationale": "at most two sentences" },
    { "id": "Q46", "probability": 70, "rationale": "at most two sentences" },
    { "id": "Q47", "value": 4.4, "unit": "percent", "rationale": "at most two sentences" },
    { "id": "Q50", "value": 650, "unit": "billion USD", "rationale": "at most two sentences" }
  ]
}

Schema rules:
- "as_of_date" must echo the date stated in the first paragraph of this prompt.
- "answers" must contain exactly 50 objects, ordered Q1 through Q50.
- For Q1 through Q7 and Q9 through Q46, each object has "id", "probability" as a number from 0 to 100 with no "%" sign, and "rationale" of at most two sentences. Use whole numbers, except that probabilities below 5 may carry one decimal place (for example 0.5) where the extra precision is meaningful.
- For Q8 and Q47 through Q50, each object has "id", "value" as a bare number with no unit text inside it, "unit", and "rationale" of at most two sentences.
- Use these exact units: Q8 "percent", Q47 "percent", Q48 "percent", Q49 "trillion USD", Q50 "billion USD".
- All text must be valid JSON: escape any double quotes or special characters inside strings. Express all uncertainty through the number itself, never through hedging language in the rationale.

Probability questions. Except for Q8, for each of Q1 through Q46, state the probability that the event occurs by December 31, 2030.

Capabilities and agents

Q1. At least one frontier AI lab (OpenAI, Anthropic, Google DeepMind, Meta, xAI, DeepSeek, or comparable) publishes an official company statement or product page that unambiguously characterizes one of its own deployed systems as AGI.

Q2. An AI system reaches a 50%-reliability time horizon of at least 40 human-expert hours on METR's task-time-horizon metric, or a clearly designated successor, per that benchmark's published results.

Q3. An AI agent, operating substantially autonomously (the AI plans and executes the work, with human involvement limited to initial setup and infrastructure rather than ongoing direction), earns its first 1 million US dollars or independently operates a profitable business for at least 90 consecutive days, with the autonomy credibly documented.

Q4. Fully driverless commercial robotaxi service (no human safety operator onboard) is available to the general public in at least 25 US metropolitan areas. Resolves on company and regulatory announcements.

Q5. On December 31, 2030, a model ranked in the top 3 on the primary public text-model leaderboard (LMArena, its named successor, or otherwise the most-cited public head-to-head text-model leaderboard) is available through a public API at a standard on-demand list price at or below 2 US dollars per million output tokens, per published provider pricing. Batch, cached, promotional, or otherwise discounted pricing does not count.

Q6. More than 100,000 humanoid robots are cumulatively deployed and in active commercial, industrial, or household use worldwide (installed base, not annual shipments), per consensus of credible industry estimates.

Q7. A Fortune 500 company discloses, in an official SEC filing (such as a 10-K or 10-Q), that it uses an autonomous AI agent to execute binding transactions — financial trades, procurement, or contracts — exceeding 10 million US dollars in value without per-transaction human sign-off.

Q8. What percentage of the total trailing 30-day token volume on OpenRouter.ai, or the largest equivalent public API aggregator, will be processed by open-weight models as of December 31, 2030? Give a single percentage from 0 to 100.

Science and medicine

For Q9 through Q12, "primarily by an AI system" means the AI generated the specific candidate (hypothesis, material, molecule, or biological target) that advanced, with the human contribution limited to validation, testing, and optimization.

Q9. An AI system, with no essential human mathematical input, produces a proof that resolves a problem widely recognized by the mathematical community as major (such as a Clay Millennium Prize Problem or a conjecture open for at least 25 years), and the proof is either machine-verified (for example, in Lean, Coq, or Isabelle) or accepted in a peer-reviewed venue.

Q10. A scientific finding for which an AI system is explicitly named, in a paper published in Nature or Science, as having generated the core hypothesis (rather than being used only as an analysis, simulation, or screening tool) is experimentally confirmed and published.

Q11. A material designed primarily by an AI system (such as a battery chemistry, catalyst, or superconductor) reaches commercial deployment in a shipping product or industrial process, per credible public reporting.

Q12. A drug whose molecular structure or biological target was discovered primarily by an AI system receives FDA approval for clinical use in the United States.

Q13. An autonomous AI system receives FDA authorization (clearance or approval, via any pathway) to make a definitive diagnosis of a life-threatening condition (such as cancer, stroke, or a cardiac event) with no requirement for physician confirmation of the result.

Economy and markets

Q14. US real GDP growth exceeds 4.0% in any single calendar year from 2026 through 2030, per the Bureau of Economic Analysis.

Q15. The Nasdaq-100 experiences a peak-to-trough drawdown of at least 35% at any point before December 31, 2030, measured on daily closing values.

Q16. Any company's market capitalization closes above 10 trillion US dollars on any trading day before December 31, 2030.

Q17. At least one of OpenAI or Anthropic reaches a public-market capitalization above 1 trillion US dollars at any point after listing and before December 31, 2030.

Q18. Total annual global semiconductor sales exceed 1 trillion US dollars in any calendar year through 2030, per World Semiconductor Trade Statistics (WSTS) or a comparable industry aggregate.

Labor

Q19. The US unemployment rate (BLS U-3, seasonally adjusted) exceeds 8.0% in any month before December 31, 2030.

Q20. US employment in software development occupations (BLS OEWS category 15-1252 or its successor) declines at least 20% from its 2024 level, per the most recent BLS data available on December 31, 2030.

Q21. A Fortune 500 company states, in an official SEC filing (such as a 10-K or 10-Q), that it has reduced its total workforce by 5% or more, specifically attributing the reduction to generative AI or AI-driven automation.

Q22. A national or US-state government enacts or launches a funded cash-transfer or basic-income program reaching at least 10,000 recipients in which AI-driven job displacement is a primary stated rationale.

Compute, energy, and infrastructure

Q23. A single AI datacenter or training cluster with more than 1 gigawatt of power capacity comes online and is operating at that capacity, per company and grid-operator reporting.

Q24. The largest disclosed AI training run exceeds 10^27 floating-point operations, per credible public estimates.

Q25. A nuclear reactor (a restart or a new small modular reactor) becomes operational and is generating power primarily to supply AI datacenter infrastructure. The reactor must actually be generating power, not merely contracted or announced.

Safety and catastrophe

Q26. A single incident in which an AI system's actions or outputs are credibly identified by governments or major investigations as the primary cause results in 100 or more human deaths. Includes autonomous vehicles, AI-directed infrastructure failures, and AI-enabled attacks.

Q27. A cyberattack in which autonomous AI agents play a central operational role causes more than 10 billion US dollars in damages or disables critical infrastructure (power, water, healthcare, or finance) in a G20 country, per government or major-insurer attribution.

Q28. A leading AI lab or a national regulator publishes a postmortem on a production incident in which a deployed autonomous AI system executed consequential external actions contrary to its operators' instructions, causing at least 10 million US dollars in losses or a material public-service outage and requiring emergency shutdown or containment.

Q29. A national government officially attributes a biological-weapons development attempt, by a state or non-state actor, to material assistance from AI systems.

Q30. The exfiltration of frontier model weights from a leading lab by a nation-state actor is publicly confirmed by the company, a regulator, or a court filing.

Governance and policy

Q31. The US federal government acquires an equity ownership stake of at least 10% in a leading US frontier AI company (such as OpenAI, Anthropic, or xAI), whether obtained voluntarily or by compulsion. Resolves on an official government or company announcement.

Q32. The US Congress enacts binding federal legislation imposing specific statutory requirements on frontier AI development or deployment, meaning binding statutory requirements rather than executive orders or voluntary commitments.

Q33. Any G20 country requires prior government approval or a license to commence training an AI model above a defined compute threshold. Notification, registration, or post-hoc reporting obligations do not count.

Q34. A US federal law takes effect requiring clear disclosure to a person when they are interacting with an AI system rather than a human.

Q35. A major US-headquartered or China-headquartered frontier AI developer officially halts deployment of, or publicly declines to deploy, its flagship model in the European Union, specifically citing the EU AI Act's compliance, auditing, or liability obligations.

Q36. The United States establishes a new standalone federal agency (comparable in form to the FDA, FAA, or EPA) whose primary mandate is the oversight, regulation, or safety of artificial intelligence.

Geopolitics and military

Q37. A blockade, quarantine, invasion, or armed conflict materially disrupts semiconductor shipments from Taiwan for 30 consecutive days or more.

Q38. A national government appropriates more than 50 billion US dollars in public government funding for a single dedicated AI program comparable in ambition to the Manhattan or Apollo programs. Privately financed projects do not count.

Q39. The United States and China sign a binding bilateral or multilateral agreement specifically governing advanced AI, such as compute thresholds, evaluation and testing regimes, or military-use limits.

Q40. A national government officially acknowledges that one of its weapon systems selected and engaged a human target and caused death, with no human authorizing that specific engagement. Human-supervised loitering munitions and remotely authorized strikes do not count.

Q41. A military officially acknowledges combat use of a drone swarm in which the grouped drones selected and engaged targets autonomously, with no human authorizing the individual engagements.

Society, culture, and law

Q42. A national election result in a G20 country is annulled, rerun, or formally overturned by courts or electoral authorities, with AI-generated content cited as a central reason.

Q43. A major nationally representative US survey (Pew Research or comparable) finds that at least 10% of US adults report an ongoing personal or romantic relationship with an AI companion.

Q44. A named measurement firm publishes a methodology-based estimate that more than 50% of newly published long-form English-language web text in a specified month is AI-generated.

Q45. The US Supreme Court issues a merits ruling explicitly determining whether training a generative AI model on copyrighted works without the copyright holder's permission constitutes fair use under US copyright law.

Q46. A feature-length film (60 minutes or longer) in which the video and audio are substantially entirely AI-generated is released on a major streaming platform (Netflix, Amazon Prime Video, Disney+, Apple TV+, or comparable) or grosses more than 10 million US dollars at the global box office.

Numeric point estimates. Give a single number and unit for each.

Q47. The US unemployment rate (U-3, seasonally adjusted) for December 2030, in percent.

Q48. The share of total US electricity consumption used by datacenters in calendar year 2030, in percent, per the EIA or a comparable credible estimate.

Q49. The market capitalization of the world's most valuable public company at market close on December 31, 2030, in trillions of US dollars.

Q50. Total global capital expenditure in calendar year 2030 on AI datacenter construction plus AI compute hardware (servers and accelerators), in billions of US dollars, per a named industry aggregate such as Dell'Oro Group or IDC.

--- PROMPT ENDS ---
