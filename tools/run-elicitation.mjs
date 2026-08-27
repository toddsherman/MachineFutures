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
import { readFileSync, writeFileSync, appendFileSync, renameSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
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
const FORCE = args.includes('--force');
const QUESTION_SET = 'end-states-v3';
// A reasoning model can legitimately take minutes; a stalled connection can
// take forever. Timed out requests are retried like any other failure.
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;
const HTTP_TRIES = 4;
// One provider having a bad hour must not consume the job's whole budget and
// take the models after it down with it. Raise it with --budget-minutes for
// the slow reasoning models: DeepSeek and Kimi both need well over an hour
// for twenty samples.
const MODEL_BUDGET_MS = Number(argValue('--budget-minutes') || 45) * 60 * 1000;
// Samples resume from here if a run dies partway, so a re-dispatch pays for
// the shortfall instead of the whole model again.
const PARTIAL_DIR = join(OUT_DIR, '.partial');

// Providers disagree about how they say "you are out of money", and status
// alone cannot separate it from "slow down" — OpenAI returns 429 for both.
// Getting this wrong costs 18 minutes of backoff per exhausted model and then
// reports it as an ordinary failure.
const QUOTA_SIGNS = /insufficient[_ ]quota|insufficient[_ ]credit|credit balance is too low|billing|not_?enough_?credit|exceeded your current quota|quota[_ ]exceeded|RESOURCE_EXHAUSTED|payment[_ ]required|arrears|account is not active/i;

function classify(error) {
  const status = error.status;
  const text = `${error.message || ''} ${error.body || ''}`;
  if (status === 402 || QUOTA_SIGNS.test(text)) return 'quota';
  if (status === 429 || (status >= 500 && status <= 599)) return 'transient';
  // No status means the request never completed: a timeout, a dropped socket,
  // a DNS blip. These were falling through to "permanent" and burning an
  // attempt without a single retry.
  if (status === undefined && (error.name === 'TimeoutError' || error.name === 'AbortError' || error instanceof TypeError)) return 'transient';
  return 'permanent';
}

// Honour Retry-After when the provider sends one; otherwise exponential with
// jitter, so a whole roster does not march back in lockstep.
function backoffMs(tryNumber, retryAfterMs) {
  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) return Math.min(retryAfterMs, 120000);
  const base = Math.min(15000 * 2 ** (tryNumber - 1), 120000);
  return Math.round(base * (0.5 + Math.random() * 0.5));
}

const parseRetryAfter = header => {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const at = Date.parse(header);
  return Number.isFinite(at) ? Math.max(at - Date.now(), 0) : null;
};

// Temp file plus rename: a crash mid-write must not leave truncated JSON that
// the importer then refuses, with the paid samples inside it.
function writeAtomic(file, contents) {
  const tmp = `${file}.${randomUUID()}.tmp`;
  writeFileSync(tmp, contents);
  renameSync(tmp, file);
}

// Batches are never overwritten. A rerun on the same date becomes a revision
// beside the original rather than replacing it — that path already cost one
// real 20-sample run.
function reserveBatchPath(dir, runId) {
  let file = join(dir, `${runId}.json`);
  if (!existsSync(file) || FORCE) return { file, runId };
  for (let revision = 2; revision < 100; revision++) {
    const revisedId = `${runId}__r${revision}`;
    file = join(dir, `${revisedId}.json`);
    if (!existsSync(file)) return { file, runId: revisedId };
  }
  throw new Error(`more than 99 revisions of ${runId}`);
}

// Lets the importer and tools/verify-runs.mjs detect a batch that was
// truncated, hand-edited, or corrupted after it was written.
const integrityOf = samples => ({
  algorithm: 'sha256',
  n_samples: samples.length,
  digest: createHash('sha256')
    .update(JSON.stringify(samples.map(s => ({ sample: s.sample, answers: s.answers }))))
    .digest('hex')
});

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
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`);
    err.status = res.status;
    err.body = text.slice(0, 2000);
    err.retryAfterMs = parseRetryAfter(res.headers.get('retry-after'));
    throw err;
  }
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
const signatureOf = answers => JSON.stringify(Object.values(answers).map(a => [a.value, a.rationale]));

// JSONL, appended one line per validated sample: a partial file is still
// readable if the process dies mid-run, which a single JSON array would not be.
function appendSample(path, sample) {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(sample) + '\n');
}

function resumeSamples(path, model) {
  if (!existsSync(path)) return [];
  const kept = [];
  const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
  for (const [index, line] of lines.entries()) {
    try {
      const sample = JSON.parse(line);
      // A checkpoint is only worth resuming if it still validates: a half
      // written final line, or a file from an older prompt version, is not.
      const values = STATE_NAMES.map((_, i) => sample.answers?.['S' + (i + 1)]?.value);
      if (values.some(v => !Number.isInteger(v)) || values.reduce((a, c) => a + c, 0) !== 100) throw new Error('not a valid allocation');
      kept.push({ ...sample, sample: kept.length + 1 });
    } catch (error) {
      console.warn(`! ${model.key}: discarding checkpoint line ${index + 1} — ${error.message}`);
    }
  }
  return kept;
}

/* ---------- per-model elicitation ---------- */
async function elicit(model, prompt) {
  const status = model.status || 'active';
  if (status !== 'active') { console.log(`~ ${model.key}: ${status} — not asked (its published forecast stands)`); return null; }
  const key = MOCK ? 'mock' : process.env[model.keyEnv];
  if (!key) { console.log(`~ ${model.key}: ${model.keyEnv} not set — skipped`); return null; }

  const runId = `${RUN_DATE}__${slug(model.model)}__closed_book__end-states`;
  const partialPath = join(PARTIAL_DIR, `${runId}.jsonl`);

  // A re-dispatch after a partial failure restores the previous run's batches,
  // so a model that already finished must not be bought a second time — and a
  // model that finished short is carried forward rather than re-bought. The
  // checkpoint is deleted once a batch is written, so a short batch has no
  // checkpoint left and its own samples are the only thing to resume from.
  const existingPath = join(OUT_DIR, `${runId}.json`);
  let carried = [];
  let toppingUp = false;
  if (!FORCE && existsSync(existingPath)) {
    try {
      const existing = JSON.parse(readFileSync(existingPath, 'utf8'));
      const have = (existing.samples || []).length;
      if (have >= SAMPLES) {
        console.log(`= ${model.key}: complete batch already on disk (${have} samples) — not re-asking`);
        return { ok: true, reused: true, key: model.key, label: model.label, samples: have, target: SAMPLES, quota: null, failures: [] };
      }
      if (have) {
        const reported = Array.isArray(existing.model?.self_reported_name)
          ? existing.model.self_reported_name[0]
          : existing.model?.self_reported_name;
        carried = existing.samples.map((sample, index) => ({
          ...sample,
          sample: index + 1,
          meta: sample.meta || { model: reported ?? null, cutoff: existing.model?.self_reported_cutoff ?? null, asOf: existing.asked_on ?? null }
        }));
        toppingUp = true;
        console.log(`  ${model.key}: carrying ${have} sample(s) forward from the existing batch — buying ${SAMPLES - have} more`);
      }
    } catch {
      console.warn(`! ${model.key}: existing batch at ${existingPath} is unreadable — writing a revision beside it`);
    }
  }

  // Resume: samples already paid for on an earlier attempt at this run are
  // read back, and only the shortfall is asked for.
  const samples = carried.length ? carried : resumeSamples(partialPath, model);
  const failures = [];
  const seen = new Map();
  samples.forEach(s => seen.set(signatureOf(s.answers), s.sample));
  if (samples.length) console.log(`  ${model.key}: resuming with ${samples.length} sample(s) already on disk`);
  if (samples.length >= SAMPLES) console.log(`  ${model.key}: already complete from a previous attempt`);

  // Proportional, not SAMPLES + 4: at 20 samples that left only four spare
  // attempts, so a model failing one call in five quietly returned a short run.
  const maxAttempts = Math.ceil(SAMPLES * 1.5) + 5;
  const startedAt = Date.now();
  let quotaExhausted = null;

  for (let attempt = 1; samples.length < SAMPLES && attempt <= maxAttempts; attempt++) {
    if (!MOCK && Date.now() - startedAt > MODEL_BUDGET_MS) {
      console.warn(`! ${model.key}: ${Math.round(MODEL_BUDGET_MS / 60000)} minute budget reached with ${samples.length}/${SAMPLES} samples — moving on`);
      break;
    }
    try {
      let text;
      if (MOCK) text = mockResponse(model, attempt - 1);
      else {
        for (let httpTry = 1; ; httpTry++) {
          try { text = await adapters[model.api](model, prompt, key); break; }
          catch (error) {
            const kind = classify(error);
            if (kind !== 'transient' || httpTry >= HTTP_TRIES) throw error;
            const wait = backoffMs(httpTry, error.retryAfterMs);
            console.warn(`! ${model.key}: ${error.message.slice(0, 120)} — retrying in ${Math.round(wait / 1000)}s (${httpTry}/${HTTP_TRIES - 1})`);
            await sleep(wait);
          }
        }
      }
      const { meta, answers } = parseAndValidate(text);
      const sig = signatureOf(answers);
      if (seen.has(sig)) console.warn(`! ${model.key}: sample ${samples.length + 1} is identical to sample ${seen.get(sig)} (kept — an API run, not a paste error, but worth noting)`);
      else seen.set(sig, samples.length + 1);
      const sample = { sample: samples.length + 1, meta, answers };
      samples.push(sample);
      // Checkpoint before anything else can fail. Everything above this line
      // has already been paid for.
      appendSample(partialPath, sample);
      console.log(`  ${model.key}: sample ${samples.length}/${SAMPLES} ok`);
    } catch (error) {
      const kind = classify(error);
      failures.push({ attempt, kind, reason: String(error.message || error).slice(0, 500) });
      console.warn(`! ${model.key}: attempt ${attempt} failed (${kind}) — ${error.message}`);
      if (kind === 'quota') {
        // Asking again cannot succeed, and each further attempt costs minutes
        // of backoff that the models after this one need.
        quotaExhausted = String(error.message || error).slice(0, 300);
        console.error(`✗ ${model.key}: out of quota or credit — stopping this model`);
        break;
      }
    }
    if (!MOCK) await sleep(1500);
  }

  if (!samples.length) {
    console.error(`✗ ${model.key}: no valid samples${quotaExhausted ? ' — quota exhausted' : ` after ${maxAttempts} attempts`}`);
    return { ok: false, key: model.key, label: model.label, samples: 0, target: SAMPLES, quota: quotaExhausted, failures };
  }
  if (samples.length < SAMPLES) console.warn(`! ${model.key}: only ${samples.length}/${SAMPLES} valid samples`);

  // Identity comes from the roster — the model id we actually called — never
  // from the model's self-report. Models are unreliable narrators about their
  // own version (an observed run had Gemini 3.1 Pro answer "gpt-4o"). The
  // self-report is kept alongside as data, clearly marked as a claim.
  const selfReported = [...new Set(samples.map(s => s.meta?.model).filter(Boolean))];
  const batch = {
    run_id: runId,
    prompt_family: 'end_states',
    asked_on: RUN_DATE,
    question_set: QUESTION_SET,
    track: 'closed_book',
    model: {
      name: model.label,
      provider: model.provider,
      api_string: model.model,
      self_reported_name: selfReported.length === 1 ? selfReported[0] : selfReported,
      self_reported_cutoff: samples.find(s => s.meta?.cutoff)?.meta.cutoff ?? null
    },
    n_samples: samples.length,
    samples: samples.map(s => ({ sample: s.sample, answers: s.answers })),
    aggregate: aggregate(samples),
    integrity: integrityOf(samples),
    harness: { version: 2, mode: MOCK ? 'mock' : 'api', target_samples: SAMPLES, complete: samples.length >= SAMPLES, quota_exhausted: Boolean(quotaExhausted), failures }
  };
  mkdirSync(OUT_DIR, { recursive: true });
  // A top-up is a strict superset of the batch it grew from, so it replaces
  // that file rather than landing beside it as a revision.
  const reserved = toppingUp ? { file: existingPath, runId: batch.run_id } : reserveBatchPath(OUT_DIR, batch.run_id);
  if (reserved.runId !== batch.run_id) {
    console.warn(`! ${model.key}: ${batch.run_id}.json exists — writing revision ${reserved.runId} rather than replacing it`);
    batch.run_id = reserved.runId;
  }
  writeAtomic(reserved.file, JSON.stringify(batch, null, 2) + '\n');
  // Only now is the checkpoint redundant.
  rmSync(partialPath, { force: true });
  console.log(`✓ ${model.key}: wrote ${reserved.file} (${samples.length} samples, ${failures.length} failed attempts)`);
  return { ok: true, key: model.key, label: model.label, samples: samples.length, target: SAMPLES, quota: quotaExhausted, failures };
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

const results = [];
for (const model of roster) {
  const result = await elicit(model, prompt);
  if (result) results.push(result);
}
const wrote = results.filter(r => r.ok && !r.reused).length;
const reused = results.filter(r => r.reused).length;
const hardFailures = results.filter(r => !r.ok).length;
const quotaHit = results.filter(r => r.quota);
const short = results.filter(r => r.ok && r.samples < r.target);

console.log(`Done: ${wrote} batch(es) written${reused ? `, ${reused} reused from a previous run` : ''}, ${hardFailures} model(s) failed, ${roster.length - wrote - reused - hardFailures} skipped.`);
for (const r of short) console.warn(`! ${r.key}: short run — ${r.samples}/${r.target} samples`);
for (const r of quotaHit) console.error(`✗ ${r.key}: QUOTA/CREDIT — ${r.quota}`);

// A run that ends red in the Actions tab says nothing about why. The job
// summary is the first thing shown on the run page, so the state of every
// model — and any exhausted account — is legible without opening logs.
if (process.env.GITHUB_STEP_SUMMARY) {
  const countBy = (r, kind) => r.failures.filter(f => f.kind === kind).length;
  const rows = results.map(r => {
    const status = r.quota ? '💳 quota/credit' : !r.ok ? '❌ failed' : r.samples < r.target ? '⚠️ short' : '✅ complete';
    return `| ${r.label} (\`${r.key}\`) | ${status} | ${r.samples}/${r.target} | ${countBy(r, 'transient')} | ${countBy(r, 'quota')} | ${countBy(r, 'permanent')} |`;
  });
  const lines = [
    `## Elicitation ${RUN_DATE}`,
    '',
    `${wrote} batch(es) written · ${hardFailures} model(s) failed · target ${SAMPLES} samples each`,
    '',
    '| Model | Status | Samples | Transient | Quota | Permanent |',
    '| --- | --- | ---: | ---: | ---: | ---: |',
    ...rows
  ];
  if (quotaHit.length) {
    lines.push('', '### Out of quota or credit', '',
      'These providers rejected calls for billing reasons. Top up or raise the limit, then re-run — samples already collected are resumed from the checkpoint rather than paid for twice.', '',
      ...quotaHit.map(r => `- **${r.label}** (\`${r.key}\`): ${r.quota}`));
  }
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
}

// Step outputs, so the workflow can branch on *why* the run failed rather
// than parsing logs or guessing from an exit code.
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, [
    `quota_exhausted=${quotaHit.length ? 'true' : 'false'}`,
    `quota_models=${quotaHit.map(r => r.label).join(', ')}`,
    `batches_written=${wrote}`,
    `models_failed=${hardFailures}`,
    `short_runs=${short.length}`
  ].join('\n') + '\n');
}

if (!wrote && !reused) {
  console.error(quotaHit.length
    ? `✗ nothing elicited — ${quotaHit.length} model(s) out of quota or credit; top up and re-run (collected samples resume from the checkpoint)`
    : '✗ nothing elicited — check API keys and model ids in tools/models.json');
  process.exit(quotaHit.length ? 4 : 1);
}
// Exit 4 is distinct so the workflow can raise a billing alert specifically,
// rather than reporting "a model failed" for something only money fixes.
if (quotaHit.length) process.exit(4);
if (hardFailures) process.exit(2);
