// The front page: the plain answer, one year control, and a way into the
// explorer. These hold the few behaviours a reader depends on.
import { test, expect } from '@playwright/test';

const open = async (page, url = '/') => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url);
  await expect(page.locator('.state-card')).toHaveCount(11);
  return errors;
};
const fits = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

test('the front page states the answer and its five figures total 100', async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator('#headline')).toContainText('For 2030, AI models put');
  await expect(page.locator('#hero-bar > i')).toHaveCount(5);
  const figures = await page.locator('#hero-rows .row-val').allTextContents();
  expect(figures.map(Number).reduce((total, value) => total + value, 0)).toBe(100);
  expect(await fits(page)).toBe(true);
  expect(errors).toEqual([]);
});

test('choosing a year moves the whole page and the link', async ({ page }) => {
  const errors = await open(page);
  await page.locator('.horizon-button[data-year="2100"]').click();
  await expect(page.locator('#headline')).toContainText('For 2100');
  await expect(page.locator('.horizon-button[data-year="2100"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#year-select')).toHaveValue('2100');
  await expect(page).toHaveURL(/year=2100/);
  await expect(page.locator('#futures-takeaway')).toContainText('2100');
  expect(await fits(page)).toBe(true);
  expect(errors).toEqual([]);
});

test('an explorer link shared before the front page existed still opens on its year', async ({ page }) => {
  const errors = await open(page, '/?horizon=long-term');
  await expect(page.locator('#headline')).toContainText('the year 3000');
  await expect(page).toHaveURL(/year=3000/);
  await expect(page).not.toHaveURL(/horizon=/);
  expect(errors).toEqual([]);
});

test('picking an assistant shows its answer and links into the explorer', async ({ page }) => {
  const errors = await open(page);
  await page.locator('#lab-chips [data-lab="Anthropic"]').click();
  await expect(page.locator('#model-card .leader-name')).toBeVisible();
  await expect(page).toHaveURL(/model=/);
  const explorer = page.locator('#model-card .card-links a').nth(1);
  await expect(explorer).toHaveAttribute('href', /^explore\.html\?model=/);
  await expect(page.locator('.rank-row.is-picked')).toHaveCount(1);
  expect(await fits(page)).toBe(true);
  expect(errors).toEqual([]);
});

test('the explorer links back to the front page', async ({ page }) => {
  await page.goto('/explore.html');
  await expect(page.locator('.footer-home')).toHaveAttribute('href', './');
});

test('the headline written into the page is the one the script shows', async ({ page, request }) => {
  const source = await (await request.get('/')).text();
  const written = source.match(/<h1 id="headline">([\s\S]*?)<\/h1>/)[1].replace(/<[^>]+>/g, '');
  const errors = await open(page);
  expect(await page.locator('#headline').textContent()).toBe(written);
  expect(errors).toEqual([]);
});

test('a model\u2019s reason is fetched when its answer opens, and the explorer data never is', async ({ page }) => {
  const requested = [];
  page.on('request', request => requested.push(new URL(request.url()).pathname));
  const errors = await open(page);
  await page.locator('#lab-chips [data-lab="Google"]').click();
  await expect(page.locator('#model-card .why')).toContainText('\u201c');
  await expect(page.locator('#model-card .why[data-loading]')).toHaveCount(0);
  expect(requested).toContain('/front-why.js');
  expect(requested).not.toContain('/data.js');
  expect(errors).toEqual([]);
});

test('lab by lab shows every lab and follows the group that is chosen', async ({ page }) => {
  const errors = await open(page);
  const labs = await page.evaluate(() => window.FRONT.labs.length);
  await expect(page.locator('#lab-rows .lab-row:not(.lab-axis)')).toHaveCount(labs);
  await expect(page.locator('#labs-takeaway')).toContainText('humans staying in control');
  await page.locator('#labs-toggle [data-labs-by="4"]').click();
  await expect(page.locator('#labs-toggle [data-labs-by="4"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#labs-takeaway')).toContainText('humanity being gone or at risk of it');
  // Every dot and average sits on its own track, whatever the scale.
  const inside = await page.evaluate(() => [...document.querySelectorAll('#lab-rows .lab-dot, #lab-rows .lab-avg')].every(mark => {
    const track = mark.parentElement.getBoundingClientRect();
    const box = mark.getBoundingClientRect();
    return box.left >= track.left - 8 && box.right <= track.right + 8;
  }));
  expect(inside).toBe(true);
  await page.locator('#lab-chips [data-lab="Mistral"]').click();
  await expect(page.locator('#lab-rows .lab-dot.is-picked')).toHaveCount(1);
  expect(await fits(page)).toBe(true);
  expect(errors).toEqual([]);
});

test('the disagreement cards and the asked-twice chart are drawn from the data', async ({ page }) => {
  const errors = await open(page);
  const counts = await page.evaluate(() => ({ cruxes: window.FRONT.cruxes.length, pairs: window.FRONT.reask.pairs.length }));
  await expect(page.locator('#cruxes .crux')).toHaveCount(counts.cruxes);
  await expect(page.locator('#cruxes blockquote')).toHaveCount(counts.cruxes * 2);
  await expect(page.locator('#steady-chart circle.pair')).toHaveCount(counts.pairs);
  await expect(page.locator('#steady-gaps .gap-row')).toHaveCount(2);
  await expect(page.locator('#steady-takeaway')).toContainText('asked for twice');
  // The chart is drawn to the width it is given, so it never spills.
  const chart = await page.locator('#steady-chart svg').boundingBox();
  const host = await page.locator('#steady-chart').boundingBox();
  expect(chart.width).toBeLessThanOrEqual(host.width + 1);
  expect(await fits(page)).toBe(true);
  expect(errors).toEqual([]);
});

test('link previews point at the share picture, and the picture is served', async ({ page, request }) => {
  await open(page);
  const image = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(image).toMatch(/^https:\/\/www\.machinefutures\.ai\/share\.png\?v=[0-9a-f]{8}$/);
  expect(await page.locator('meta[name="twitter:card"]').getAttribute('content')).toBe('summary_large_image');
  const picture = await request.get('/share.png');
  expect(picture.status()).toBe(200);
  expect(picture.headers()['content-type']).toContain('image/png');
});

test('what readers use is counted without anything about the reader, and capped', async ({ page }) => {
  // The public site defines window.va; stand in for it here and collect.
  await page.addInitScript(() => { window.sent = []; window.va = (...args) => window.sent.push(args); });
  const errors = await open(page);
  await page.locator('#lab-chips [data-lab="Google"]').click();
  for (const year of ['2050', '2100', '2200', 'long-term']) await page.locator(`.horizon-button[data-year="${year}"]`).click();
  // Read to the end; the observer reports on its own schedule.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.sent.some(([, event]) => event.name === 'Section seen' && event.data.section === 'trust'))).toBe(true);
  const sent = await page.evaluate(() => window.sent);
  expect(sent.every(([kind]) => kind === 'event')).toBe(true);
  const named = name => sent.filter(([, event]) => event.name === name).map(([, event]) => event.data);
  expect(named('AI picked')).toHaveLength(1);
  expect(named('AI picked')[0].lab).toBe('Google');
  expect(named('Year changed').map(data => data.year)).toEqual(['2050', '2100', '2200']);
  expect(named('Section seen').map(data => data.section)).toContain('trust');
  // Only short labels from the page itself: nothing typed, nothing about the reader.
  const allowed = { 'AI picked': ['lab', 'model'], 'Year changed': ['year'], 'Section seen': ['section'], 'Explorer opened': ['from'] };
  for (const [, event] of sent) expect(Object.keys(event.data).sort()).toEqual(allowed[event.name]);
  expect(errors).toEqual([]);
});
