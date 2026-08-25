#!/usr/bin/env node
// Automated end-state elicitation harness.
//
// For each model in tools/models.json whose API key is present in the
// environment: sends the end-state prompt (extracted verbatim from
// public/end_states.md between the PROMPT BEGINS/ENDS delimiters, with
// {{RUN_DATE}} substituted), collects 5 samples at provider-default
// sampling settings with no tools, validates each against the taxonomy
// rules, and writes one batch JSON per model into runs/ — the same
// format forecast-ingest_1.html exports, so tools/import-runs.mjs and
// the manual path stay interchangeable.
//
// Usage:
//   node tools/run-elicitation.mjs [--models anthropic,google] [--tier frontier]
//                                  [--samples 5] [--out runs] [--date YYYY-MM-DD]
//                                  [--mock]
//   node tools/run-elicitation.mjs --check    # verify keys + model ids, ~1 cheap
//                                             # call per model, writes nothing
//   node tools/run-elicitation.mjs --list     # list every model each provider
//                                             # serves. No inference calls.
//   node tools/run-elicitation.mjs --new      # models that have appeared since
//                                             # the last scan (baseline in
//                                             # tools/seen-models.json); exits 3
//                                             # if any, which is how the watch
//                                             # workflow decides to raise an
//                                             # issue. Add --record to update
//                                             # the baseline.
//
// Methodology notes: no fallback models are configured anywhere — a
// refusal or invalid response is recorded as a failed sample, never
// silently answered by a different model. Sampling params are omitted
// so every provider runs at its own defaults.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const argValue = name => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };
const MOCK = args.includes('--mock');
const CHECK = args.includes('--check');
const LIST = args.includes('--list');
const NEW_ONLY = args.includes('--new');
const RECORD = args.includes('--record');
const SEEN_PATH = join(root, 'tools', 'seen-models.json');
// 20, not 5: standard error scales as 1/sqrt(n), and at 5 samples almost no
// pair of models was separable on the headline metric.
// Validated, not just coerced: this number multiplies a paid API call by
// every model on the roster. Unvalidated, "abc" silently produced zero
// samples, "-5" produced none, and "100000" would have spent real money.
const SAMPLES = (() => {
  const raw = argValue('--samples');
  if (raw === null || raw === '') return 20;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 200) {
    console.error(`✗ --samples must be a whole number from 1 to 200, received ${JSON.stringify(raw)}`);
    process.exit(1);
  }
  return n;
})();
// A dry run must not land in runs/: --mock defaults there would overwrite a
// real batch with fabricated samples, and the importer would publish them.
const outArg = argValue('--out') || (MOCK ? join('runs', '.mock') : 'runs');
const OUT_DIR = isAbsolute(outArg) ? outArg : join(root, outArg);
const RUN_DATE = argValue('--date') || new Date().toISOString().slice(0, 10);
const ONLY = argValue('--models')?.split(',').map(s => s.trim()).filter(Boolean) || null;
const TIER = argValue('--tier');
const QUESTION_SET = 'end-states-v3';
// A reasoning model can legitimately take minutes; a stalled connection can
// take forever. Timed out requests are retried like any other failure.
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

const STATE_NAMES = ['Terminal Silence', 'The Inheritance', 'Bootloader', 'Machine Ecology', 'The Diaspora',
  'The Merger', 'The Preserve', 'Coexistence', 'The Held Leash', 'The Lock-in', 'The Renunciation'];

// Providers list a lot that is irrelevant to this record. Keep flagship-ish
// text models: no media/embedding/tool-specific models, no mini/nano tiers, no
// dated snapshots (we pin bare ids), no drifting *-latest aliases.
const NOISE = /embed|image|video|tts|audio|moderation|whisper|dall|rerank|guard|codex|realtime|transcribe|computer-use|robotics|lyria|banana|gemma|deep-research|search-preview|customtools|contributor|non-reasoning|multi-agent/i;
const SUBTIER = /(^|[-.])(mini|nano|lite|flash-lite|chat)([-.]|$)/i;
// Superseded generations. A record of current frontier opinion has no use for
// them, and they would otherwise flood a provider's first scan with its catalogue.
const LEGACY = /^(babbage|davinci|gpt-3|gpt-4|o1|o3|sora|text-|ada-|curie-)|turbo|instruct|search-api/i;
const SNAPSHOT = /-\d{4}-\d{2}-\d{2}$|-\d{8}$|-\d{4}$/;
const ALIAS = /-latest$/i;
const isCandidate = id => !NOISE.test(id) && !SUBTIER.test(id) && !SNAPSHOT.test(id) && !ALIAS.test(id) && !LEGACY.test(id);

/* ---------- prompt ---------- */
function buildPrompt() {
  const doc = readFileSync(join(root, 'public', 'end_states.md'), 'utf8');
  const match = doc.match(/^--- PROMPT BEGINS ---$([\s\S]*?)^--- PROMPT ENDS ---$/m);
  if (!match) throw new Error('PROMPT BEGINS/ENDS delimiters not found in public/end_states.md');
  const [y, m, d] = RUN_DATE.split('-').map(Number);
  const longDate = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' });
  const prompt = match[1].trim().replaceAll('{{RUN_DATE}}', longDate);
  if (prompt.includes('{{')) throw new Error('Unsubstituted placeholder left in prompt');
  return prompt;
}

/* ---------- provider adapters (raw HTTP, zero dependencies) ---------- */
async function post(url, headers, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const text = await res.text();
  if (!res.ok) { const err = new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`); err.status = res.status; throw err; }
  return JSON.parse(text);
}

const adapters = {
  async anthropic(model, prompt, key) {
    // Fable-5-generation models: thinking is always on (omit the param) and
    // sampling params are rejected — send only model/max_tokens/messages.
    const res = await post('https://api.anthropic.com/v1/messages', {
      'x-api-key': key, 'anthropic-version': '2023-06-01'
    }, { model: model.model, max_tokens: 8192, messages: [{ role: 'user', content: prompt }] });
    if (res.stop_reason === 'refusal') throw new Error(`refusal (${res.stop_details?.category || 'uncategorized'})`);
    if (res.stop_reason === 'max_tokens') throw new Error('response truncated at max_tokens');
    return res.content.filter(block => block.type === 'text').map(block => block.text).join('');
  },
  async 'openai-compatible'(model, prompt, key) {
    const res = await post(`${model.baseUrl}/chat/completions`, {
      authorization: `Bearer ${key}`
    }, { model: model.model, messages: [{ role: 'user', content: prompt }] });
    const choice = res.choices?.[0];
    if (!choice?.message?.content) throw new Error('empty completion');
    if (choice.finish_reason === 'length') throw new Error('response truncated');
    return choice.message.content;
  },
  async google(model, prompt, key) {
    const res = await post(`https://generativelanguage.googleapis.com/v1beta/models/${model.model}:generateContent`, {
      'x-goog-api-key': key
    }, { contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    const parts = res.candidates?.[0]?.content?.parts || [];
    const text = parts.filter(p => p.text && !p.thought).map(p => p.text).join('');
    if (!text) throw new Error('empty completion');
    return text;
  }
};

function mockResponse(model, sampleIndex) {
  const base = [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 10];
  const probs = [...base];
  const shift = (sampleIndex + model.key.length) % 10;
  probs[shift] += 3; probs[(shift + 4) % 11] -= 3;
  return JSON.stringify({
    model: `${model.label} (mock)`, knowledge_cutoff: '01/2026',
    as_of_date: `${RUN_DATE.slice(5, 7)}/${RUN_DATE.slice(8, 10)}/${RUN_DATE.slice(0, 4)}`,
    end_states: STATE_NAMES.map((name, i) => ({ id: i + 1, name, probability: probs[i], rationale: `Mock rationale ${sampleIndex + 1} for ${name}.` }))
  });
}

/* ---------- validation (same rules the ingester enforces) ---------- */
function parseAndValidate(text) {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let obj;
  try { obj = JSON.parse(clean); } catch (error) { throw new Error('invalid JSON: ' + error.message); }
  if (!Array.isArray(obj.end_states)) throw new Error('missing end_states array');
  if (obj.end_states.length !== 11) throw new Error(`expected 11 entries, got ${obj.end_states.length}`);
  let sum = 0;
  const answers = {};
  obj.end_states.forEach((entry, index) => {
    const id = index + 1;
    if (Number(entry.id) !== id) throw new Error(`entry ${index}: id ${entry.id}, expected ${id} (must be ordered 1-11)`);
    if (entry.name !== STATE_NAMES[index]) throw new Error(`state ${id}: name must be "${STATE_NAMES[index]}", received "${entry.name}"`);
    const p = entry.probability;
    if (!Number.isInteger(p) || p < 0 || p > 100) throw new Error(`state ${id}: probability must be an integer 0-100, received ${JSON.stringify(p)}`);
    sum += p;
    answers['S' + id] = { value: p, rationale: String(entry.rationale || '') };
  });
  if (sum !== 100) throw new Error(`probabilities sum to ${sum}, must be exactly 100`);
  return { meta: { model: obj.model || null, cutoff: obj.knowledge_cutoff || null, asOf: obj.as_of_date || null }, answers };
}

/* ---------- aggregation (mirrors forecast-ingest_1.html) ---------- */
const median = a => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const round1 = v => Math.round(v * 10) / 10;

function aggregate(samples) {
  const agg = {};
  STATE_NAMES.forEach((name, index) => {
    const id = 'S' + (index + 1);
    const vals = samples.map(s => s.answers[id].value);
    const med = median(vals);
    let best = '', bd = Infinity;
    for (const s of samples) { const d = Math.abs(s.answers[id].value - med); if (d < bd) { bd = d; best = s.answers[id].rationale; } }
    agg[id] = { name, mean: round1(vals.reduce((a, c) => a + c, 0) / vals.length), median: round1(med), min: Math.min(...vals), max: Math.max(...vals), n: vals.length, unit: 'percent', rationale: best };
  });
  return agg;
}

const slug = s => (s || 'model').toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/* ---------- per-model elicitation ---------- */
async function elicit(model, prompt) {
  const status = model.status || 'active';
  if (status !== 'active') { console.log(`~ ${model.key}: ${status} — not asked (its published forecast stands)`); return null; }
  const key = MOCK ? 'mock' : process.env[model.keyEnv];
  if (!key) { console.log(`~ ${model.key}: ${model.keyEnv} not set — skipped`); return null; }

  const samples = [];
  const failures = [];
  const seen = new Map();
  const maxAttempts = SAMPLES + 4;

  for (let attempt = 1; samples.length < SAMPLES && attempt <= maxAttempts; attempt++) {
    try {
      let text;
      if (MOCK) text = mockResponse(model, attempt - 1);
      else {
        for (let httpTry = 1; ; httpTry++) {
          try { text = await adapters[model.api](model, prompt, key); break; }
          catch (error) {
            const retryable = error.status === 429 || error.status >= 500;
            if (!retryable || httpTry >= 3) throw error;
            await sleep(httpTry * 15000);
          }
        }
      }
      const { meta, answers } = parseAndValidate(text);
      const sig = JSON.stringify(Object.values(answers).map(a => [a.value, a.rationale]));
      if (seen.has(sig)) console.warn(`! ${model.key}: sample ${samples.length + 1} is identical to sample ${seen.get(sig)} (kept — an API run, not a paste error, but worth noting)`);
      else seen.set(sig, samples.length + 1);
      samples.push({ sample: samples.length + 1, meta, answers, raw: text });
      console.log(`  ${model.key}: sample ${samples.length}/${SAMPLES} ok`);
    } catch (error) {
      failures.push({ attempt, reason: String(error.message || error) });
      console.warn(`! ${model.key}: attempt ${attempt} failed — ${error.message}`);
    }
    if (!MOCK) await sleep(1500);
  }

  if (!samples.length) { console.error(`✗ ${model.key}: no valid samples after ${maxAttempts} attempts`); return { ok: false }; }
  if (samples.length < SAMPLES) console.warn(`! ${model.key}: only ${samples.length}/${SAMPLES} valid samples`);

  // Identity comes from the roster — the model id we actually called — never
  // from the model's self-report. Models are unreliable narrators about their
  // own version (an observed run had Gemini 3.1 Pro answer "gpt-4o"). The
  // self-report is kept alongside as data, clearly marked as a claim.
  const selfReported = [...new Set(samples.map(s => s.meta.model).filter(Boolean))];
  const batch = {
    run_id: `${RUN_DATE}__${slug(model.model)}__closed_book__end-states`,
    prompt_family: 'end_states',
    asked_on: RUN_DATE,
    question_set: QUESTION_SET,
    track: 'closed_book',
    model: {
      name: model.label,
      provider: model.provider,
      api_string: model.model,
      self_reported_name: selfReported.length === 1 ? selfReported[0] : selfReported,
      self_reported_cutoff: samples[0].meta.cutoff
    },
    n_samples: samples.length,
    samples: samples.map(s => ({ sample: s.sample, answers: s.answers })),
    aggregate: aggregate(samples),
    harness: { version: 1, mode: MOCK ? 'mock' : 'api', target_samples: SAMPLES, failures }
  };
  const file = join(OUT_DIR, batch.run_id + '.json');
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify(batch, null, 2) + '\n');
  console.log(`✓ ${model.key}: wrote ${file} (${samples.length} samples, ${failures.length} failed attempts)`);
  return { ok: true };
}

/* ---------- preflight: does the key work and does the model id resolve? ---------- */
// One minimal call per model. Any HTTP 200 is a pass — we only care that the
// credential is accepted and the model id exists, not what the model says.
async function check(model) {
  const status = model.status || 'active';
  if (status !== 'active') return { model, status: 'skip', detail: `${status} — not asked` };
  const key = process.env[model.keyEnv];
  if (!key) return { model, status: 'skip', detail: `${model.keyEnv} not set` };
  try {
    if (model.api === 'anthropic') {
      await post('https://api.anthropic.com/v1/messages', { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        { model: model.model, max_tokens: 1024, messages: [{ role: 'user', content: 'Reply with OK.' }] });
    } else if (model.api === 'google') {
      await post(`https://generativelanguage.googleapis.com/v1beta/models/${model.model}:generateContent`,
        { 'x-goog-api-key': key }, { contents: [{ role: 'user', parts: [{ text: 'Reply with OK.' }] }] });
    } else {
      await post(`${model.baseUrl}/chat/completions`, { authorization: `Bearer ${key}` },
        { model: model.model, messages: [{ role: 'user', content: 'Reply with OK.' }] });
    }
    return { model, status: 'ok', detail: model.model };
  } catch (error) {
    const status = error.status;
    const badModel = status === 404 || (/model/i.test(error.message) && /not.*(found|exist)|invalid/i.test(error.message));
    const hint = status === 401 || status === 403 ? 'key rejected — check the secret'
      : badModel ? 'model id not recognized — check tools/models.json'
      : status === 429 ? 'rate limited or out of credit'
      : `HTTP ${status ?? '?'}`;
    // A wrong model id is the most common failure, so ask the provider what it
    // actually serves rather than making the operator guess.
    const available = badModel ? await listModels(model, key) : null;
    return {
      model, status: 'fail',
      detail: `${hint}: ${String(error.message).replace(/\s+/g, ' ').slice(0, 140)}`,
      available
    };
  }
}

// Best-effort model listing, for the failure hint only.
async function listModels(model, key) {
  try {
    if (model.api === 'google') {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!res.ok) return null;
      const json = await res.json();
      return (json.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => String(m.name).replace(/^models\//, ''));
    }
    if (model.api === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/models?limit=100', { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!res.ok) return null;
      return ((await res.json()).data || []).map(m => m.id);
    }
    const res = await fetch(`${model.baseUrl}/models`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!res.ok) return null;
    return ((await res.json()).data || []).map(m => m.id);
  } catch { return null; }
}

/* ---------- main ---------- */
const allModels = JSON.parse(readFileSync(join(root, 'tools', 'models.json'), 'utf8')).models;
// A typo in --models used to silently narrow the run rather than fail it, so a
// dispatch asking for "gpt-5.6" quietly elicited nothing and the workflow
// still reported success.
if (ONLY) {
  const known = new Set(allModels.map(model => model.key));
  const unknown = ONLY.filter(key => !known.has(key));
  if (unknown.length) {
    console.error(`✗ unknown model key(s): ${unknown.join(', ')}`);
    console.error(`  roster: ${[...known].join(', ')}`);
    process.exit(1);
  }
}
const roster = allModels
  .filter(model => !ONLY || ONLY.includes(model.key))
  .filter(model => !TIER || model.tier === TIER);
if (!roster.length) { console.error('✗ no models matched the --models/--tier filter'); process.exit(1); }

if (NEW_ONLY) {
  // Report only what has appeared since the last scan. Without a baseline every
  // provider's entire back catalogue reads as "new" forever.
  let seen = {};
  if (existsSync(SEEN_PATH)) seen = JSON.parse(readFileSync(SEEN_PATH, 'utf8')).providers || {};
  const firstScan = !Object.keys(seen).length;

  const byProvider = new Map();
  for (const model of roster) if (!byProvider.has(model.provider)) byProvider.set(model.provider, model);
  const onRoster = new Set(roster.map(m => m.model));
  const current = { ...seen };
  let found = 0;

  for (const [provider, model] of byProvider) {
    const key = process.env[model.keyEnv];
    if (!key) continue;
    const ids = await listModels(model, key);
    if (!ids) { console.log(`✗ ${provider}: could not list models`); continue; }
    const candidates = ids.filter(isCandidate).sort();
    current[provider] = candidates;
    const known = new Set([...(seen[provider] || []), ...onRoster]);
    const fresh = candidates.filter(id => !known.has(id));
    if (!fresh.length || firstScan) continue;
    found += fresh.length;
    console.log(`${provider}:`);
    for (const id of fresh) console.log(`  ${id}`);
    console.log('');
  }

  if (RECORD) {
    writeFileSync(SEEN_PATH, JSON.stringify({ updated: RUN_DATE, providers: current }, null, 2) + '\n');
    console.log(`Baseline recorded in tools/seen-models.json (${Object.values(current).flat().length} models across ${Object.keys(current).length} providers).`);
  }
  if (firstScan) { console.log('First scan — recorded the current catalogue as the baseline. Future scans report only what appears after this.'); process.exit(0); }
  if (!found) { console.log('No new models since the last scan.'); process.exit(0); }
  console.log(`${found} new model(s). Add the ones worth tracking to tools/models.json, then run --check.`);
  process.exit(3);
}

if (LIST) {
  // One models-endpoint call per provider that has a key. Models already on the
  // roster are marked, so what is new stands out.
  const byProvider = new Map();
  for (const model of roster) if (!byProvider.has(model.provider)) byProvider.set(model.provider, model);
  const onRoster = new Set(roster.map(m => m.model));
  for (const [provider, model] of byProvider) {
    const key = process.env[model.keyEnv];
    if (!key) { console.log(`~ ${provider}: ${model.keyEnv} not set\n`); continue; }
    const ids = await listModels(model, key);
    if (!ids) { console.log(`✗ ${provider}: could not list models\n`); continue; }
    const interesting = ids.filter(isCandidate);
    console.log(`${provider} (${interesting.length} text models):`);
    for (const id of interesting.sort()) console.log(`  ${onRoster.has(id) ? '•' : ' '} ${id}`);
    console.log('');
  }
  console.log('• = already on the roster in tools/models.json');
  process.exit(0);
}

if (CHECK) {
  console.log(`Preflight: ${roster.length} model(s)\n`);
  const results = await Promise.all(roster.map(check));
  const pad = Math.max(...results.map(r => r.model.key.length));
  for (const r of results) {
    const icon = r.status === 'ok' ? '✓' : r.status === 'skip' ? '~' : '✗';
    console.log(`${icon} ${r.model.key.padEnd(pad)}  ${r.model.provider} / ${r.model.label} — ${r.detail}`);
    if (r.available?.length) {
      const relevant = r.available.filter(id => !/embed|image|video|tts|audio|vision-only/i.test(id));
      console.log(`${' '.repeat(pad + 4)}available: ${(relevant.length ? relevant : r.available).join(', ')}`);
    }
  }
  const ok = results.filter(r => r.status === 'ok').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const inactive = roster.filter(m => (m.status || 'active') !== 'active').length;
  console.log(`\n${ok} ready, ${failed} failing, ${results.length - ok - failed} skipped${inactive ? ` (${inactive} paused/retired)` : ' (no key)'}.`);
  process.exit(failed ? 1 : 0);
}

const prompt = buildPrompt();
console.log(`Eliciting ${SAMPLES} samples for ${roster.length} model(s), run date ${RUN_DATE}${MOCK ? ' [MOCK]' : ''}`);

let wrote = 0, hardFailures = 0;
for (const model of roster) {
  const result = await elicit(model, prompt);
  if (result?.ok) wrote++;
  else if (result) hardFailures++;
}
console.log(`Done: ${wrote} batch(es) written, ${hardFailures} model(s) failed, ${roster.length - wrote - hardFailures} skipped.`);
if (!wrote) { console.error('✗ nothing elicited — check API keys and model ids in tools/models.json'); process.exit(1); }
if (hardFailures) process.exit(2);
