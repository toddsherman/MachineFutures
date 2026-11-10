#!/usr/bin/env node
// Draws public/share.png, the picture a link to the site unfurls with.
//
// The picture is the markup from tools/share-card.mjs, screenshotted in a
// real browser and stamped with the SHA-256 of that markup. It is the one
// generated file that needs a browser, so it is not part of
// `npm run data:rebuild`; tools/test-front.mjs fails when the stamp no longer
// matches the current figures, and this is the command that fixes it.
//
// Uses Playwright's Chromium when it is installed and Google Chrome when it is
// not. Draw it on a Mac where you can: the condensed display face the site
// asks for is there, and the fallback on Linux is wider.
//
// Usage: node tools/render-share.mjs    (npm run share:render)
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { shareCard, SHARE_WIDTH, SHARE_HEIGHT, SHARE_STAMP_KEY } from './share-card.mjs';

const root = new URL('../', import.meta.url);
const target = new URL('public/share.png', root);
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = bytes => {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function chunks(png) {
  if (png.length < 8 || !png.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG file');
  const list = [];
  for (let at = 8; at + 12 <= png.length;) {
    const length = png.readUInt32BE(at);
    list.push({ type: png.toString('latin1', at + 4, at + 8), data: png.subarray(at + 8, at + 8 + length), at });
    at += 12 + length;
  }
  return list;
}

// What a PNG says about itself: its size and the stamp, if it has one.
export function describePng(png) {
  const list = chunks(png);
  const header = list.find(chunk => chunk.type === 'IHDR');
  const prefix = `${SHARE_STAMP_KEY}\0`;
  const text = list.find(chunk => chunk.type === 'tEXt' && chunk.data.toString('latin1').startsWith(prefix));
  return {
    width: header?.data.readUInt32BE(0) ?? 0,
    height: header?.data.readUInt32BE(4) ?? 0,
    stamp: text ? text.data.toString('latin1').slice(prefix.length) : null,
  };
}

export function stampPng(png, stamp) {
  const end = chunks(png).find(chunk => chunk.type === 'IEND');
  if (!end) throw new Error('PNG has no IEND chunk');
  const body = Buffer.from(`tEXt${SHARE_STAMP_KEY}\0${stamp}`, 'latin1');
  const chunk = Buffer.alloc(body.length + 8);
  chunk.writeUInt32BE(body.length - 4, 0);
  body.copy(chunk, 4);
  chunk.writeUInt32BE(crc32(body), body.length + 4);
  return Buffer.concat([png.subarray(0, end.at), chunk, png.subarray(end.at)]);
}

// The stamp in the committed picture, or null when there is no picture yet.
export async function shareStamp() {
  try { return describePng(await readFile(target)).stamp; } catch { return null; }
}

export async function currentCard() {
  const scope = {};
  for (const file of ['public/front-data.js', 'public/front-copy.js']) {
    new Function('window', await readFile(new URL(file, root), 'utf8'))(scope);
  }
  return shareCard(scope.FRONT, scope.FRONT_COPY(scope.FRONT));
}

async function launch() {
  const { chromium } = await import('@playwright/test');
  try {
    return await chromium.launch();
  } catch (bundled) {
    try {
      return await chromium.launch({ channel: 'chrome' });
    } catch {
      throw new Error(`No browser to draw the picture with. Run \`npx playwright install chromium\` or install Google Chrome.\n${bundled.message.split('\n')[0]}`);
    }
  }
}

async function render() {
  const card = await currentCard();
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: SHARE_WIDTH, height: SHARE_HEIGHT }, deviceScaleFactor: 1 });
    await page.setContent(card.html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    // A longer headline must not run into the bar or off the picture.
    const fit = await page.evaluate(() => {
      const box = selector => document.querySelector(selector).getBoundingClientRect();
      return { headline: box('h1').bottom, bar: box('.bar').top, legend: box('.legend').bottom, width: document.documentElement.scrollWidth };
    });
    if (fit.bar < fit.headline + 14 || fit.legend > SHARE_HEIGHT || fit.width > SHARE_WIDTH) {
      throw new Error(`the headline no longer fits the ${SHARE_WIDTH}x${SHARE_HEIGHT} picture; shorten the type in tools/share-card.mjs (${JSON.stringify(fit)})`);
    }
    const png = stampPng(await page.screenshot({ type: 'png' }), card.hash);
    const made = describePng(png);
    if (made.width !== SHARE_WIDTH || made.height !== SHARE_HEIGHT) throw new Error(`drew ${made.width}x${made.height}, expected ${SHARE_WIDTH}x${SHARE_HEIGHT}`);
    await writeFile(target, png);
    console.log(`✓ public/share.png drawn (${Math.round(png.length / 1024)} KB) and stamped ${card.hash.slice(0, 8)}`);
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await render();
}
