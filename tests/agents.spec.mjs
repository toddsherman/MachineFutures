// What the site publishes for AI agents: llms.txt, static JSON, and WebMCP
// tools for agents inside the browser. The unit checks hold the files to the
// data; these hold what a real engine has to get right, under the site's own
// content security policy: the files are served, the tools register, and an
// agent asking a tool gets the number a person reads in the headline.
import { test, expect } from '@playwright/test';

// A recording stand-in for document.modelContext, installed before the page's
// scripts run, as a browser with WebMCP would have it.
const withWebMCP = page => page.addInitScript(() => {
  const tools = [];
  Object.defineProperty(Document.prototype, 'modelContext', {
    configurable: true,
    get: () => ({ registerTool: async tool => { tools.push(tool); } })
  });
  window.__tools = tools;
});
const watch = page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
};

test('the guide and the data are served as files, with no script needed', async ({ request }) => {
  const guide = await request.get('/llms.txt');
  expect(guide.ok()).toBe(true);
  expect(await guide.text()).toMatch(/^# Machine Futures\n/);
  const summary = await (await request.get('/data/summary.json')).json();
  expect(summary.horizons).toHaveLength(11);
  const forecasts = await (await request.get('/data/forecasts.json')).json();
  expect(forecasts.models.length).toBe(summary.models.length);
  const first = await (await request.get(new URL(summary.models[0].detail).pathname)).json();
  expect(first.id).toBe(summary.models[0].id);
});

for (const path of ['/', '/explore.html']) {
  test(`${path} offers read-only tools to an in-browser agent`, async ({ page }) => {
    const errors = watch(page);
    await withWebMCP(page);
    await page.goto(path);
    await expect.poll(() => page.evaluate(() => window.__tools.length)).toBe(5);
    const tools = await page.evaluate(() => window.__tools.map(tool => ({ name: tool.name, readOnly: tool.annotations.readOnlyHint })));
    expect(tools.map(tool => tool.name)).toEqual(['get_overview', 'get_combined_forecast', 'get_model_forecast', 'compare_models', 'get_future_definitions']);
    expect(tools.every(tool => tool.readOnly)).toBe(true);
    const overview = await page.evaluate(() => window.__tools.find(tool => tool.name === 'get_overview').execute({}));
    expect(overview.models.length).toBeGreaterThan(30);
    expect(errors).toEqual([]);
  });
}

test('an agent asking for the combined answer gets the headline figure', async ({ page }) => {
  const errors = watch(page);
  await withWebMCP(page);
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__tools.length)).toBe(5);
  const combined = await page.evaluate(() => window.__tools.find(tool => tool.name === 'get_combined_forecast').execute({}));
  const stated = Number((await page.locator('#dek').textContent()).match(/that is (\d+) of 100 points/)[1]);
  expect(Math.max(...combined.groups.map(group => group.points))).toBe(stated);
  // The model card on the page and the tool describe the same answer.
  const answer = await page.evaluate(() => window.__tools.find(tool => tool.name === 'get_model_forecast').execute({ model: 'claude-fable-5-2', year: '2030' }));
  expect(answer.futures.reduce((total, future) => total + future.points, 0)).toBe(100);
  expect(answer.futures.every(future => future.reason.length > 0)).toBe(true);
  expect(errors).toEqual([]);
});

test('a browser without WebMCP loads the page as before and fetches no data files', async ({ page }) => {
  const errors = watch(page);
  const requested = [];
  page.on('request', request => requested.push(new URL(request.url()).pathname));
  // Hide the API even in an engine that has it, so this keeps describing the
  // browsers without WebMCP after the test browsers gain it.
  await page.addInitScript(() => {
    for (const home of [Document.prototype, Navigator.prototype]) {
      Object.defineProperty(home, 'modelContext', { configurable: true, get: () => undefined });
    }
  });
  await page.goto('/');
  await expect(page.locator('.state-card')).toHaveCount(11);
  await page.waitForLoadState('networkidle');
  expect(requested.filter(path => path.startsWith('/data/'))).toEqual([]);
  expect(errors).toEqual([]);
});
