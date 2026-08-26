// Pull classify() and its regex straight out of the harness so the test
// exercises the shipped code, not a copy.
import { readFileSync } from 'node:fs';
const src = readFileSync('tools/run-elicitation.mjs', 'utf8');
const grab = re => src.match(re)[0];
const classify = eval(`${grab(/const QUOTA_SIGNS = [^\n]+/)}\n${grab(/function classify\(error\) \{[\s\S]*?\n\}/)}\nclassify`);

const err = (message, status, body, name) => Object.assign(new Error(message), { status, body, name: name || 'Error' });
const cases = [
  ['OpenAI insufficient_quota',      err('HTTP 429', 429, '{"error":{"code":"insufficient_quota","message":"You exceeded your current quota"}}'), 'quota'],
  ['Anthropic low credit',           err('HTTP 400', 400, '{"error":{"message":"Your credit balance is too low to access the API"}}'), 'quota'],
  ['Google RESOURCE_EXHAUSTED',      err('HTTP 429', 429, '{"error":{"status":"RESOURCE_EXHAUSTED"}}'), 'quota'],
  ['402 Payment Required',           err('HTTP 402', 402, ''), 'quota'],
  ['plain rate limit',               err('HTTP 429', 429, '{"error":{"message":"Rate limit reached, retry shortly"}}'), 'transient'],
  ['502 bad gateway',                err('HTTP 502', 502, 'upstream'), 'transient'],
  ['503 overloaded',                 err('HTTP 503', 503, 'overloaded_error'), 'transient'],
  ['request timeout',                err('signal timed out', undefined, undefined, 'TimeoutError'), 'transient'],
  ['socket dropped',                 Object.assign(new TypeError('fetch failed'), {}), 'transient'],
  ['400 bad model id',               err('HTTP 400', 400, '{"error":{"message":"model not found"}}'), 'permanent'],
  ['401 bad key',                    err('HTTP 401', 401, '{"error":{"message":"invalid api key"}}'), 'permanent'],
  ['refusal',                        err('refusal (violence)', undefined, undefined), 'permanent'],
  ['unparseable answer',             err('missing end_states array'), 'permanent'],
];
let bad = 0;
for (const [label, error, expected] of cases) {
  const got = classify(error);
  const ok = got === expected;
  if (!ok) bad++;
  console.log(`${ok ? '✓' : '✗'} ${label.padEnd(28)} → ${got}${ok ? '' : `  (expected ${expected})`}`);
}
console.log(bad ? `\n${bad} misclassified` : '\nall classifications correct');
process.exit(bad ? 1 : 0);
