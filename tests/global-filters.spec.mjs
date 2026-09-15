import { test, expect } from '@playwright/test';

const lab = page => page.locator('.lab-button[data-lab="Anthropic"]');
const start = async page => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?horizon=long-term');
  await expect(lab(page)).toBeVisible();
};

test('lab dropdown controls all forecasts while the full matrix stays unchanged', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await start(page);
  const matrix = await page.locator('#matrix').innerHTML();
  const roster = await page.evaluate(() => Object.entries(window.MF_TEST.activeDataset().endStateRuns)
    .filter(([, run]) => run.provider === 'Anthropic').map(([key, run]) => ({ key, ...run })));
  await lab(page).click();
  await expect(page.locator('#model-dropdown')).toBeHidden();
  await expect(page.locator('.doomer-row')).toHaveCount(roster.length);
  await expect(page.locator('#end-leader .leader-unit')).toContainText('Anthropic mean');
  await expect(page.locator('#horizon-chart-note')).toContainText('Anthropic mean');
  await lab(page).click();
  await expect(page.locator('#model-dropdown')).toBeVisible();
  await expect(page.locator('#model-dropdown button')).toHaveCount(roster.length + 1);
  await page.locator(`[data-model="${roster[0].key}"]`).click();
  await expect(page.locator('#model-dropdown')).toBeHidden();
  await expect(page.locator('.doomer-row')).toHaveCount(1);
  await expect(page.locator('.lab-button.active')).toHaveAttribute('title', `${roster[0].label} · Select again to choose a model`);
  await expect(page.locator('#end-leader .leader-unit')).toContainText(roster[0].label);
  for (const [id, value] of Object.entries(roster[0].probabilities)) {
    await expect(page.locator(`#state-${id} .state-card-meta strong`)).toHaveText(`${value.toFixed(1)}%`);
    const chartValue = await page.evaluate(id => window.MF_TEST.horizonChartData().series.find(s => s.id === Number(id)).points.find(p => p.id === 'long-term').value, id);
    expect(chartValue).toBe(value);
  }
  expect(await page.locator('#matrix').innerHTML()).toBe(matrix);
  await expect(page.locator('#pdoom-value')).toHaveText(`${(roster[0].probabilities[1] + roster[0].probabilities[2] + roster[0].probabilities[3]).toFixed(1)}%`);
  await page.locator('#state-1').click();
  await expect(page.locator('.model-answer')).toHaveCount(1);
  await page.locator('#dialog-close').click();
  await page.locator('.matrix-state[data-state="1"]').click();
  await expect(page.locator('.model-answer')).toHaveCount(await page.locator('.matrix-model').count());
  expect(errors).toEqual([]);
});

test('attached rows and dropdown fit the viewport and support keyboard dismissal', async ({ page }) => {
  await start(page);
  await lab(page).click();
  const before = await page.locator('.end-hero').boundingBox();
  await lab(page).click();
  const after = await page.locator('.end-hero').boundingBox();
  expect(after.y).toBe(before.y);
  const menu = await page.locator('#model-dropdown').boundingBox();
  expect(menu.x).toBeGreaterThanOrEqual(0);
  expect(menu.x + menu.width).toBeLessThanOrEqual(page.viewportSize().width);
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#model-dropdown button').nth(1)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(lab(page)).toBeFocused();
  await expect(page.locator('#model-dropdown')).toBeHidden();
  const positions = await page.evaluate(() => ({
    horizon: document.querySelector('#horizon-toggle').getBoundingClientRect().bottom,
    lab: document.querySelector('#lab-toggle').getBoundingClientRect().top,
    overflow: document.documentElement.scrollWidth - innerWidth
  }));
  expect(Math.abs(positions.horizon - positions.lab)).toBeLessThanOrEqual(1);
  expect(positions.overflow).toBe(0);
});

test('equal lab weights do not change when an identical same-lab model is added', async ({ page }) => {
  await start(page);
  const result = await page.evaluate(() => {
    const model = (provider, first) => ({ provider, probabilities: Object.fromEntries(Array.from({ length: 11 }, (_, i) => [i + 1, i === 0 ? first : i === 1 ? 100 - first : 0])) });
    const a = model('A', 80), b = model('B', 20);
    const summarize = rows => window.MF_TEST.aggregateOf(rows);
    return { base: summarize([a, b]), duplicated: summarize([a, a, a, b]), lab: summarize([a, a]) };
  });
  expect(result.base).toEqual([50, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  expect(result.duplicated).toEqual(result.base);
  expect(result.lab.slice(0, 2)).toEqual([80, 20]);
});

test('lab and model URLs survive reload and changing horizons', async ({ page }) => {
  await start(page);
  await lab(page).click();
  await page.reload();
  await expect(lab(page)).toHaveAttribute('aria-pressed', 'true');
  await lab(page).click();
  const key = await page.locator('#model-dropdown button').nth(1).getAttribute('data-model');
  await page.locator('#model-dropdown button').nth(1).click();
  await page.locator('.horizon-button[data-horizon="2030"]').click();
  expect(new URL(page.url()).searchParams.get('model')).toBe(key);
  await page.reload();
  await expect(page.locator('.doomer-row')).toHaveCount(1);
  await page.locator('.lab-button[data-lab=""]').click();
  expect(new URL(page.url()).searchParams.get('model')).toBeNull();
  expect(new URL(page.url()).searchParams.get('lab')).toBeNull();
  await expect(page.locator('#end-forecast-toggle')).toHaveCount(0);
  await page.locator('#consensus-bar').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await expect(page.locator('.lab-button[data-lab=""]')).toHaveAttribute('aria-pressed', 'true');
});

test('each model has matching headline, cards, bar, and horizon values', async ({ page }) => {
  await start(page);
  const failures = await page.evaluate(() => {
    const bad = [];
    for (const [key, run] of Object.entries(window.MF_TEST.activeDataset().endStateRuns)) {
      window.MF_TEST.selectForecast(key);
      const leader = Number(document.querySelector('#end-leader').dataset.leader);
      if (run.probabilities[leader] !== Math.max(...Object.values(run.probabilities))) bad.push(`${key}: leader`);
      for (const [id, value] of Object.entries(run.probabilities)) {
        const figure = document.querySelector(`#state-${id} .state-card-meta strong`);
        const bar = document.querySelector(`#consensus-bar [data-state-jump="${id}"]`);
        if (parseFloat(figure.textContent) !== value || Math.abs(parseFloat(bar.style.width) - value) > .001) bad.push(`${key}: state ${id}`);
      }
    }
    return bad;
  });
  expect(failures).toEqual([]);
});

test('a missing model horizon is unavailable instead of substituting another forecast', async ({ page }) => {
  await start(page);
  const key = await page.evaluate(() => {
    const key = Object.keys(window.MF_TEST.activeDataset().endStateRuns)[0];
    delete window.MF_DATA.datasets['2030'].endStateRuns[key];
    window.MF_TEST.selectForecast(key);
    return key;
  });
  expect(await page.evaluate(() => window.MF_TEST.horizonChartData().horizons.map(h => h.id))).not.toContain('2030');
  expect(new URL(page.url()).searchParams.get('model')).toBe(key);
});

test('lab and model selections preserve the reading position throughout the page', async ({ page, browserName }) => {
  await start(page);
  const anchors = ['.leader-name', '#pdoom-value', '#state-9', '.matrix-row[data-state="7"]', '.doomer-row', '.horizon-chart-plot', '.method-list > li'];
  const tolerance = browserName === 'webkit' ? 2 : 1.5;
  const nextPaint = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  for (const selector of anchors) {
    for (const provider of ['Anthropic', 'OpenAI', '']) {
      const before = await page.evaluate(selector => {
        document.documentElement.style.scrollBehavior = 'auto';
        const element = document.querySelector(selector);
        const dock = document.querySelector('.horizon-toggle-dock').getBoundingClientRect();
        const top = dock.height + (innerHeight - dock.height - element.getBoundingClientRect().height) / 2;
        window.scrollBy(0, element.getBoundingClientRect().top - Math.max(dock.height + 20, top));
        return element.getBoundingClientRect().top;
      }, selector);
      await page.locator(`.lab-button[data-lab="${provider}"]`).click();
      await nextPaint();
      const after = await page.locator(selector).first().evaluate(el => el.getBoundingClientRect().top);
      expect(Math.abs(after - before), `${selector} shifted selecting ${provider || 'all labs'}`).toBeLessThanOrEqual(tolerance);
    }
  }
  await lab(page).click();
  await nextPaint();
  const before = await page.locator('#pdoom-value').evaluate(el => {
    const dock = document.querySelector('.horizon-toggle-dock');
    window.scrollBy(0, el.getBoundingClientRect().top - dock.offsetHeight - 100);
    return el.getBoundingClientRect().top;
  });
  await lab(page).click();
  await page.locator('#model-dropdown button').nth(1).click();
  await nextPaint();
  expect(Math.abs(await page.locator('#pdoom-value').evaluate(el => el.getBoundingClientRect().top) - before)).toBeLessThanOrEqual(tolerance);
  expect(await page.evaluate(() => document.documentElement.style.overflowAnchor)).toBe('');
});


test('the landing page defaults to 2030 and keeps explicit horizon links', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.horizon-button')).toHaveText(['2030', '2035', '2040', '2050', '2060', '2070', '2080', '2090', '2100', '2200', 'Long term']);
  await expect(page.locator('.horizon-button[aria-pressed="true"]')).toHaveAttribute('data-horizon', '2030');
  await expect(page.locator('#pdoom-unit')).toContainText('2030');
  await page.locator('.horizon-button[data-horizon="long-term"]').click();
  await expect(page).toHaveURL(/horizon=long-term/);
  await page.reload();
  await expect(page.locator('.horizon-button[aria-pressed="true"]')).toHaveAttribute('data-horizon', 'long-term');
  await page.locator('.horizon-button[data-horizon="2030"]').click();
  expect(new URL(page.url()).searchParams.has('horizon')).toBe(false);
});

test('eleven horizons remain reachable without overflowing and update the chart', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/data.js*', async route => {
    const response = await route.fetch();
    const source = await response.text();
    // Test-only populated copies exercise future-horizon layout before paid runs finish.
    await route.fulfill({ response, body: source + `
      for (const year of ['2035','2070','2080','2090','2100','2200']) {
        window.MF_DATA.datasets[year] = structuredClone(window.MF_DATA.datasets['2060']);
      }
    ` });
  });
  await page.goto('/');
  const years = ['2030','2035','2040','2050','2060','2070','2080','2090','2100','2200','long-term'];
  await expect(page.locator('.horizon-button')).toHaveCount(years.length);
  for (const year of years) {
    await page.locator(`.horizon-button[data-horizon="${year}"]`).click();
    await expect(page.locator('.horizon-button[aria-pressed="true"]')).toHaveAttribute('data-horizon', year);
    await expect(page.locator(`.horizon-chart-tick[data-horizon="${year}"]`)).toBeVisible();
    const bounds = await page.evaluate(() => ({ width: innerWidth, page: document.documentElement.scrollWidth,
      ticks: [...document.querySelectorAll('.horizon-chart-tick')].filter(n => getComputedStyle(n).display !== 'none').map(n => {
        const box = n.getBoundingClientRect(); return {left:box.left,right:box.right};
      }).sort((a,b)=>a.left-b.left) }));
    expect(bounds.page).toBeLessThanOrEqual(bounds.width + 1);
    for (let i=1;i<bounds.ticks.length;i++) expect(bounds.ticks[i].left).toBeGreaterThanOrEqual(bounds.ticks[i-1].right);
  }
  await expect(page.locator('.horizon-chart-point')).toHaveCount(121);
});
