#!/usr/bin/env node
// Check every link the site publishes.
//
// The failure this exists for: a link can be correct and still broken for
// everyone but its author. A private repository, a page behind a login, a file
// that was renamed — all of them resolve fine in the browser of the person who
// made them and 404 for a visitor. So external links are fetched with no
// credentials, the way a stranger would.
//
// Usage: node tools/check-links.mjs [--offline]
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const OFFLINE = process.argv.includes('--offline');
const TIMEOUT_MS = 15000;

const pages = readdirSync(publicDir).filter(f => f.endsWith('.html'));
const problems = [];
const checked = { internal: 0, anchor: 0, external: 0, skipped: 0 };

for (const page of pages) {
  const html = readFileSync(join(publicDir, page), 'utf8');
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  const links = [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map(m => m[1]);
  const assets = [...html.matchAll(/<(?:script|link|img)\b[^>]*\b(?:src|href)="([^"]+)"/g)].map(m => m[1]);

  for (const href of [...links, ...assets]) {
    if (href.startsWith('data:') || href.startsWith('mailto:')) { checked.skipped += 1; continue; }

    if (href.startsWith('#')) {
      checked.anchor += 1;
      const target = href.slice(1);
      // The id may be written by the application rather than the markup, so a
      // miss is only reported when nothing in the page declares it.
      if (target && !ids.has(target)) problems.push(`${page}: "${href}" points at no id on the page`);
      continue;
    }

    if (/^https?:\/\//.test(href)) {
      if (OFFLINE) { checked.skipped += 1; continue; }
      checked.external += 1;
      try {
        // No token, no cookies: a stranger's view. GET rather than HEAD, since
        // some hosts answer HEAD differently or not at all.
        const res = await fetch(href, { redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'user-agent': 'machine-futures-link-check' } });
        if (!res.ok) {
          const hint = res.status === 404 ? ' — a private repository looks like this to a signed-out visitor' : '';
          problems.push(`${page}: ${href} returned ${res.status}${hint}`);
        }
      } catch (error) {
        problems.push(`${page}: ${href} could not be reached — ${error.message}`);
      }
      continue;
    }

    checked.internal += 1;
    const target = join(publicDir, href.split(/[?#]/)[0]);
    if (!existsSync(target)) problems.push(`${page}: "${href}" is not a file in public/`);
  }
}

if (problems.length) {
  problems.forEach(p => console.error('✗ ' + p));
  console.error(`\n${problems.length} broken link(s).`);
  process.exit(1);
}
console.log(`✓ links good — ${checked.internal} internal, ${checked.anchor} anchor, ${checked.external} external${OFFLINE ? ' (skipped, offline)' : ' (fetched signed-out)'}`);
