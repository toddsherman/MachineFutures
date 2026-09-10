import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'public', 'analytics.js'), 'utf8');

function runOn(hostname) {
  const appended = [];
  const window = {};
  const document = {
    createElement: tagName => ({ tagName, dataset: {} }),
    head: { appendChild: element => appended.push(element) }
  };
  new Function('window', 'document', 'location', source)(window, document, { hostname });
  return { window, appended };
}

test('analytics loads the Vercel collector on public hosts', () => {
  for (const hostname of ['machinefutures.ai', 'www.machinefutures.ai', 'machine-futures-preview.vercel.app']) {
    const { window, appended } = runOn(hostname);
    assert.equal(typeof window.va, 'function');
    assert.equal(appended.length, 1);
    assert.equal(appended[0].src, '/_vercel/insights/script.js');
    assert.equal(appended[0].defer, true);
    assert.equal(appended[0].dataset.sdkn, '@vercel/analytics');
    assert.equal(appended[0].dataset.sdkv, '2.0.1');
    const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    assert.equal(packageJson.dependencies['@vercel/analytics'], `^${appended[0].dataset.sdkv}`);
  }
});

test('analytics stays off during local development', () => {
  for (const hostname of ['localhost', '127.0.0.1']) {
    const { window, appended } = runOn(hostname);
    assert.equal(window.va, undefined);
    assert.deepEqual(appended, []);
  }
});

test('both content security policies allow the first-party collector', () => {
  const html = readFileSync(join(root, 'public', 'index.html'), 'utf8');
  const config = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
  const header = config.headers[0].headers.find(item => item.key === 'Content-Security-Policy')?.value;
  assert.match(html, /<script src="analytics\.js"><\/script>/);
  assert.match(html, /connect-src 'self'/);
  assert.match(header, /connect-src 'self'/);
});
