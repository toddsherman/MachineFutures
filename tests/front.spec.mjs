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
