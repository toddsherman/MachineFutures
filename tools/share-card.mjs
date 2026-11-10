// The link-preview image, as a page. tools/render-share.mjs screenshots this
// markup to public/share.png and stamps the file with the SHA-256 of the
// markup. tools/build-front.mjs puts the first eight characters of the same
// hash on the image address in index.html, and tools/test-front.mjs fails when
// the stamp in the PNG is not the hash of what this returns today. A picture
// with old numbers therefore cannot ship.
import { createHash } from 'node:crypto';

export const SHARE_WIDTH = 1200;
export const SHARE_HEIGHT = 630;
export const SHARE_STAMP_KEY = 'mf-share-card-sha256';

const esc = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// `front` is the object in public/front-data.js; `copy` is FRONT_COPY(front).
export function shareCard(front, copy) {
  const h = front.defaultHorizon;
  const values = copy.allLabs(h);
  const display = '"Arial Narrow", "Avenir Next Condensed", "Helvetica Neue Condensed", "Helvetica Neue", Arial, sans-serif';
  const mono = '"SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace';
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
* { box-sizing: border-box; margin: 0; }
html, body { width: ${SHARE_WIDTH}px; height: ${SHARE_HEIGHT}px; overflow: hidden; }
body { padding: 46px 60px 0; display: flex; flex-direction: column; background: #f2efe6; color: #11120f; -webkit-font-smoothing: antialiased; }
.top { display: flex; align-items: baseline; justify-content: space-between; }
.mark { font: 900 30px/1 ${display}; letter-spacing: -.05em; text-transform: uppercase; }
.site { font: 800 16px ${mono}; letter-spacing: .06em; text-transform: uppercase; }
.kicker { margin-top: 30px; font: 800 16px ${mono}; letter-spacing: .1em; text-transform: uppercase; }
h1 { margin-top: 16px; font: 900 82px/.82 ${display}; letter-spacing: -.075em; text-transform: uppercase; }
h1 em { font-style: normal; color: transparent; -webkit-text-stroke: 2px #11120f; }
.bar { margin-top: auto; height: 96px; display: flex; border: 2px solid #11120f; }
.bar i { display: grid; place-items: center; overflow: hidden; border-right: 1px solid rgba(17, 18, 15, .4); font: 700 24px ${mono}; font-style: normal; }
.bar i:last-child { border-right: 0; }
.legend { height: 64px; display: flex; align-items: center; gap: 26px; font: 700 14px ${mono}; text-transform: uppercase; white-space: nowrap; }
.legend span { display: inline-flex; align-items: center; gap: 8px; }
.legend b { width: 13px; height: 13px; }
</style>
</head>
<body>
<div class="top"><span class="mark">Machine Futures</span><span class="site">machinefutures.ai</span></div>
<p class="kicker">${esc(copy.kicker(h))}</p>
<h1>${copy.headline(h)}</h1>
<div class="bar">${front.groups.map((g, i) => `<i style="width:${values[i]}%;background:${g.color}">${values[i] >= 4 ? values[i] : ''}</i>`).join('')}</div>
<div class="legend">${front.groups.map((g, i) => `<span><b style="background:${g.color}"></b>${esc(g.short)} ${values[i]}</span>`).join('')}</div>
</body>
</html>
`;
  return { html, hash: createHash('sha256').update(html).digest('hex'), alt: `${copy.headlineText(h)} ${front.groups.map((g, i) => `${g.label}: ${values[i]} of 100 points`).join('. ')}.` };
}
