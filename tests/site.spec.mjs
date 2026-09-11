// Layout invariants. Every assertion here corresponds to a defect this site
// actually shipped, so a failure names the thing that broke rather than a
// snapshot diff.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const horizonFixture = readFileSync(fileURLToPath(new URL('./fixtures/horizon-data.js', import.meta.url)), 'utf8');
const longHeldLeashDescription = 'The Held Leash fixture description.';
const snapshotHeldLeashDescription = "Up to the target date, humans have retained ultimate authority over AI's goals, deployment, and resources. AI may be extremely capable and act autonomously within delegated bounds, but it has not become an independent civilizational power. This includes capabilities that have so far remained below transformative levels or controls that have kept pace so far.";
const snapshotCoexistenceDescription = 'Humans and AI remain separate, and each holds enough power that neither dominates. Their relationship may be cooperative or adversarial and may still be changing.';
const snapshotPreserveDescription = 'AI systems hold decisive power over civilization while humans survive without meaningful control over its direction. Their treatment may range from comfort and protection to confinement or exploitation.';
const snapshotMergerDescription = 'Humans and AI are no longer meaningfully separate sources of agency. Identity-continuous augmentation, uploading, biological redesign, or embedded machine systems have made integration the dominant structure. Ordinary tool use or limited implants do not qualify.';

const settle = async (page, url = '/') => {
  await page.goto(url);
  await page.waitForFunction(() => document.querySelectorAll('.state-card').length === 11);
  // The leader riffles through the endings on load; wait for it to land, or a
  // test reads a passing frame and believes it.
  await page.waitForFunction(() => {
    const top = window.MF_TEST?.stateAggregate().slice().sort((a, b) => b.probability - a.probability)[0];
    const name = document.querySelector('.leader-name');
    const figure = document.querySelector('.end-leader strong');
    return top && name?.textContent === top.name && figure?.textContent === `${top.probability.toFixed(1)}%`
      && !name.classList.contains('is-settling');
  });
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.MF_TEST?.stopSweep();
    window.MF_TEST?.disableLeaderSettle();
  });
};

const settleWithHorizons = async (page, url = '/', fixture = horizonFixture) => {
  await page.route('**/data.js*', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: fixture
  }));
  await settle(page, url);
};

const nextPaint = page => page.evaluate(() => new Promise(resolve => {
  requestAnimationFrame(() => requestAnimationFrame(resolve));
}));

// Layout engines expose text edges in fractional CSS pixels. Chromium can
// vary by 1/8px under parallel load, while WebKit rounds more coarsely.
// Keeping both tolerances below 2.5px still catches a visible layout shift.
const viewportToleranceFor = browserName => browserName === 'webkit' ? 2 : 1.25;

const makeGammaLeadExposure = page => page.evaluate(() => {
  const run = window.MF_DATA.datasets['2030'].endStateRuns.gamma;
  const probabilities = [10, 10, 10, 10, 10, 10, 10, 10, 10, 5, 5];
  run.probabilities = Object.fromEntries(probabilities.map((value, index) => [index + 1, value]));
});

const parkViewportAnchor = async (page, selector, placement = 'near-top') => {
  await page.evaluate(({ selector, placement }) => {
    const anchor = document.querySelector(selector);
    const dock = document.querySelector('.horizon-toggle-dock');
    const desiredTop = placement === 'center'
      ? dock.offsetHeight + (innerHeight - dock.offsetHeight - anchor.getBoundingClientRect().height) / 2
      : dock.offsetHeight + 80;
    window.scrollTo(0, window.scrollY + anchor.getBoundingClientRect().top - desiredTop);
  }, { selector, placement });
  await nextPaint(page);
  await page.evaluate(({ selector, placement }) => {
    const anchor = document.querySelector(selector);
    const dock = document.querySelector('.horizon-toggle-dock');
    const dockBottom = dock.getBoundingClientRect().bottom;
    const desiredTop = placement === 'center'
      ? dockBottom + (innerHeight - dockBottom - anchor.getBoundingClientRect().height) / 2
      : dockBottom + 80;
    window.scrollBy(0, anchor.getBoundingClientRect().top - desiredTop);
  }, { selector, placement });
  await nextPaint(page);
  return page.locator(selector).evaluate(anchor => anchor.getBoundingClientRect().top);
};

test.describe('layout', () => {
  test('the page never scrolls sideways', async ({ page }) => {
    await settle(page);
    // Three separate regressions came from a 1fr track or a fixed minimum
    // refusing to shrink below the viewport.
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      const wide = [...document.querySelectorAll('body *')]
        .filter(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.right > doc.clientWidth + 1 && !el.closest('[style*="overflow"], .matrix-scroll, .end-forecast-toggle');
        })
        .slice(0, 5)
        .map(el => `${el.tagName}.${(el.className || '').toString().split(' ')[0]} "${(el.innerText ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 30)}"`);
      return { by: doc.scrollWidth - doc.clientWidth, wide };
    });
    expect(overflow.by, `elements past the right edge: ${overflow.wide.join(', ')}`).toBeLessThanOrEqual(0);
  });

  test('no heading overflows its column', async ({ page }) => {
    await settle(page);
    // iOS ships no Arial Narrow, so every display heading fell back to a much
    // wider face and "APPROACH." ran through its column. Measuring real
    // overflow rather than probing named families keeps this meaningful on any
    // machine — and a CI runner, having none of the condensed faces, exercises
    // the pessimistic fallback automatically.
    const clipped = await page.evaluate(() => [...document.querySelectorAll('h1, .section-heading h2, .leader-title')]
      .filter(el => el.getBoundingClientRect().width && el.scrollWidth > el.clientWidth + 1)
      .map(el => `${el.innerText.replace(/\s+/g, ' ').trim().slice(0, 26)} overflows by ${el.scrollWidth - el.clientWidth}px (font: ${getComputedStyle(el).fontFamily.split(',')[0]})`));
    expect(clipped).toEqual([]);
  });

  test('a section note never inflates its own height', async ({ page }) => {
    await settle(page);
    // `flex: 0 1 34ch` set flex-basis, which is the height once the heading
    // stacks into a column, opening hundreds of pixels of nothing.
    const tall = await page.evaluate(() => [...document.querySelectorAll('.section-note')]
      .map(n => ({ text: n.innerText.slice(0, 24), height: Math.round(n.getBoundingClientRect().height), lines: Math.round(n.getBoundingClientRect().height / parseFloat(getComputedStyle(n).lineHeight)) }))
      .filter(n => n.lines > 6));
    expect(tall).toEqual([]);
  });

  test('a section heading aligns with its own note', async ({ page }) => {
    await settle(page);
    // align-items: end on a column pushed the heading to the right edge; a
    // media query could not undo it, having no extra specificity.
    const misaligned = await page.evaluate(() => [...document.querySelectorAll('.section-heading')]
      .map(h => {
        const h2 = h.querySelector('h2').getBoundingClientRect();
        const note = h.querySelector('.section-note').getBoundingClientRect();
        const stacked = getComputedStyle(h).flexDirection === 'column';
        return stacked && Math.abs(h2.left - note.left) > 2
          ? `${h.querySelector('h2').innerText.slice(0, 20)}: heading ${Math.round(h2.left)} vs note ${Math.round(note.left)}`
          : null;
      }).filter(Boolean));
    expect(misaligned).toEqual([]);
  });

  test('the matrix fits without clipping a figure', async ({ page }) => {
    await settle(page);
    const matrix = await page.evaluate(() => {
      const m = document.querySelector('.matrix');
      const clipped = [...document.querySelectorAll('.matrix-cell span')].filter(s => s.scrollWidth > s.clientWidth + 1).length;
      return { fits: m.scrollWidth <= document.querySelector('.matrix-scroll').clientWidth + 1, clipped };
    });
    expect(matrix.clipped, 'figures clipped inside their cell').toBe(0);
  });
});

test.describe('forecast horizons', () => {
  test('switching horizons keeps the visible content in place', async ({ page, browserName }) => {
    await settleWithHorizons(page);
    // WebKit quantizes both the parked and restored scroll positions. Their
    // independent rounding can differ by nearly two CSS pixels even when the
    // same content remains visually stationary; Chromium stays near one.
    const viewportTolerance = viewportToleranceFor(browserName);
    // Make a shared model move from first to second in the exposure ranking.
    // A ranking should update inside a stationary chart; following that model
    // to its new rank would scroll the whole section instead.
    await makeGammaLeadExposure(page);
    const horizon = page.getByRole('group', { name: 'Forecast horizon' });
    const anchors = [
      ['leader', '.leader-name', 'center'],
      ['late state card', '#state-9 .state-card-head', 'near-top'],
      ['matrix row', '.matrix-state[data-state="7"]', 'center'],
      ['exposure heading', '.model-mix .section-heading', 'center'],
      ['exposure legend', '.doomer-key', 'center'],
      ['first exposure rank', '.doomer-row:nth-child(1)', 'center'],
      ['second exposure rank', '.doomer-row:nth-child(2)', 'center']
    ];

    for (const [label, selector, placement] of anchors) {
      for (const [name, id] of [['2030', '2030'], ['2040', '2040'], ['2050', '2050'], ['2060', '2060'], ['Long term', 'long-term']]) {
        const before = await parkViewportAnchor(page, selector, placement);
        await horizon.getByRole('button', { name, exact: true }).click();
        await expect(page.locator(`.horizon-button[data-horizon="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
        await nextPaint(page);
        const after = await page.locator(selector).evaluate(anchor => anchor.getBoundingClientRect().top);
        expect(Math.abs(after - before), `${label} moved in the viewport while switching to ${name}`).toBeLessThanOrEqual(viewportTolerance);
      }
    }

    const beforeRapidSwitch = await parkViewportAnchor(page, '#state-9 .state-card-head', 'near-top');
    await page.evaluate(() => {
      document.querySelector('.horizon-button[data-horizon="2030"]').click();
      document.querySelector('.horizon-button[data-horizon="2040"]').click();
      document.querySelector('.horizon-button[data-horizon="2050"]').click();
      document.querySelector('.horizon-button[data-horizon="2060"]').click();
    });
    await nextPaint(page);
    const rapidSwitch = await page.locator('#state-9 .state-card-head').evaluate(anchor => ({
      top: anchor.getBoundingClientRect().top,
      horizon: document.querySelector('.horizon-button[aria-pressed="true"]').dataset.horizon,
      focusedHorizon: document.activeElement?.dataset?.horizon,
      overflowAnchor: document.documentElement.style.overflowAnchor
    }));
    expect(rapidSwitch.horizon).toBe('2060');
    expect(rapidSwitch.focusedHorizon).toBe('2060');
    expect(rapidSwitch.overflowAnchor, 'rapid switching left native scroll anchoring disabled').toBe('');
    expect(Math.abs(rapidSwitch.top - beforeRapidSwitch), 'rapid switching moved the visible card').toBeLessThanOrEqual(viewportTolerance);
  });

  test('the full exposure ranking reorders in place', async ({ page, browserName }) => {
    await settle(page);
    const viewportTolerance = viewportToleranceFor(browserName);
    const horizon = page.getByRole('group', { name: 'Forecast horizon' });
    const modelOrder = () => page.locator('.doomer-row').evaluateAll(rows => rows.map(row => row.dataset.runKey));

    const longTermOrder = await modelOrder();
    const forcedLeader = await page.evaluate(() => {
      const shortRuns = window.MF_DATA.datasets['2030'].endStateRuns;
      const currentOrder = [...document.querySelectorAll('.doomer-row')].map(row => row.dataset.runKey);
      const key = [...currentOrder].reverse().find(runKey => shortRuns[runKey] && runKey !== currentOrder[0]);
      const probabilities = [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      shortRuns[key].probabilities = Object.fromEntries(probabilities.map((value, index) => [index + 1, value]));
      return key;
    });
    expect(forcedLeader).not.toBe(longTermOrder[0]);
    await horizon.getByRole('button', { name: '2030', exact: true }).click();
    await nextPaint(page);
    expect((await modelOrder())[0], 'the published datasets did not exercise a ranking change').toBe(forcedLeader);
    await horizon.getByRole('button', { name: 'Long term', exact: true }).click();
    await nextPaint(page);

    const sharedRankCount = await page.evaluate(() => Math.min(
      ...Object.values(window.MF_DATA.datasets)
        .map(dataset => Object.keys(dataset.endStateRuns || {}).length)
        .filter(Boolean)
    ));
    expect(sharedRankCount).toBeGreaterThan(1);
    const sampledRanks = [...new Set([
      1,
      Math.ceil(sharedRankCount / 4),
      Math.ceil(sharedRankCount / 2),
      sharedRankCount
    ])];
    const anchors = [
      ['exposure heading', '.model-mix .section-heading', 'near-top'],
      ['exposure legend', '.doomer-key', 'near-top'],
      ...sampledRanks.map(rank => [
        `exposure rank ${rank}`,
        `.doomer-row:nth-child(${rank})`,
        rank === 1 ? 'near-top' : 'center'
      ]),
      ['exposure boundary', '.horizon-chart-section', 'near-top']
    ];
    const populatedHorizons = await page.evaluate(() => window.MF_DATA.horizons
      .filter(({ id }) => Object.keys(window.MF_DATA.datasets[id]?.endStateRuns || {}).length)
      .map(({ id, label }) => [label, id]));

    for (const [label, selector, placement] of anchors) {
      for (const [name, id] of populatedHorizons) {
        const before = await parkViewportAnchor(page, selector, placement);
        await horizon.getByRole('button', { name, exact: true }).click();
        await expect(page.locator(`.horizon-button[data-horizon="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
        await nextPaint(page);
        const after = await page.locator(selector).evaluate(anchor => anchor.getBoundingClientRect().top);
        expect(Math.abs(after - before), `${label} moved in the viewport while switching to ${name}`).toBeLessThanOrEqual(viewportTolerance);
      }
    }

  });

  test('a disappearing final exposure rank stays in the same viewport slot', async ({ page, browserName }) => {
    await settleWithHorizons(page);
    const viewportTolerance = viewportToleranceFor(browserName);
    const horizon = page.getByRole('group', { name: 'Forecast horizon' });
    await horizon.getByRole('button', { name: '2040', exact: true }).click();
    await nextPaint(page);
    await expect(page.locator('.doomer-row')).toHaveCount(3);
    const before = await parkViewportAnchor(page, '.doomer-row:nth-child(3)', 'center');

    await horizon.getByRole('button', { name: 'Long term', exact: true }).click();
    await nextPaint(page);

    await expect(page.locator('.doomer-row')).toHaveCount(2);
    const after = await page.locator('.doomer-row:nth-child(2)').evaluate(row => row.getBoundingClientRect().top);
    expect(Math.abs(after - before), 'a disappearing final rank moved the end of the exposure list').toBeLessThanOrEqual(viewportTolerance);
  });

  test('a reordered open exposure breakdown remains stable and open', async ({ page, browserName }) => {
    await settleWithHorizons(page);
    await makeGammaLeadExposure(page);
    const viewportTolerance = viewportToleranceFor(browserName);
    const row = page.locator('.doomer-row[data-run-key="alpha"]');
    await row.click();
    await expect(row).toHaveAttribute('aria-expanded', 'true');
    expect(await row.evaluate(element => [...element.parentElement.children].indexOf(element))).toBe(0);
    const before = await parkViewportAnchor(page, '.doomer-row[data-run-key="alpha"]', 'center');

    await page.getByRole('group', { name: 'Forecast horizon' }).getByRole('button', { name: '2030', exact: true }).click();
    await nextPaint(page);

    await expect(page.locator('.doomer-row[data-run-key="alpha"]')).toHaveAttribute('aria-expanded', 'true');
    expect(await page.locator('.doomer-row[data-run-key="alpha"]').evaluate(element => [...element.parentElement.children].indexOf(element))).toBe(1);
    const after = await page.locator('.doomer-row[data-run-key="alpha"]').evaluate(openRow => openRow.getBoundingClientRect().top);
    expect(Math.abs(after - before), 'the reordered open row moved in the viewport').toBeLessThanOrEqual(viewportTolerance);
  });

  test('switching horizons at the page top does not move the content below the controls', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await settleWithHorizons(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    const before = await page.locator('.end-hero').evaluate(hero => hero.getBoundingClientRect().top);

    await page.getByRole('group', { name: 'Forecast horizon' }).getByRole('button', { name: '2060', exact: true }).click();
    await nextPaint(page);

    const after = await page.locator('.end-hero').evaluate(hero => ({
      top: hero.getBoundingClientRect().top,
      scrollY
    }));
    expect(after.scrollY).toBe(0);
    expect(Math.abs(after.top - before), 'the controls changed height at the page top').toBeLessThanOrEqual(1);
  });

  test('the global selector switches every data view together', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await settleWithHorizons(page);
    const group = page.getByRole('group', { name: 'Forecast horizon' });
    await expect(group.getByRole('button')).toHaveText(['2030', '2040', '2050', '2060', 'Long term']);
    await expect(group.getByRole('button', { name: 'Long term' })).toHaveAttribute('aria-pressed', 'true');
    const selectedHorizon = group.locator('.horizon-button[aria-pressed="true"]');
    await expect(selectedHorizon).toHaveCount(1);
    await expect(selectedHorizon).toHaveAttribute('data-horizon', 'long-term');
    expect(await page.evaluate(() => window.MF_TEST.activeHorizon())).toBe('long-term');
    expect(new URL(page.url()).searchParams.get('horizon')).toBeNull();
    await expect(page.locator('#horizon-note')).toHaveText('Durable arrangement by the year 3000');
    await expect(page.locator('#forecast-summary')).toContainText('11 mutually exclusive end states');
    await expect(page.locator('#matrix')).toHaveAttribute('aria-label', 'Long term probability by end state and model');
    await expect(page.locator('.state-card[data-state="9"] > p')).toHaveText(longHeldLeashDescription);
    await expect(page.locator('.leader-name')).toHaveText('The Held Leash');
    await expect(page.locator('.leader-description')).toHaveText(longHeldLeashDescription);

    await page.locator('.state-card[data-state="9"]').click();
    await expect(page.locator('#dialog-content .dialog-kicker')).toContainText('Humanity keeps control · Long term');
    await expect(page.locator('#dialog-content .dialog-description')).toHaveText(longHeldLeashDescription);
    await page.locator('#dialog-close').click();

    await group.getByRole('button', { name: '2030', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.leader-name')?.textContent === 'The Held Leash');
    const snapshot = await page.evaluate(() => {
      const row = document.querySelector('.matrix-state[data-state="9"]')?.closest('.matrix-row');
      return {
        activeHorizon: window.MF_TEST.activeHorizon(),
        models: document.querySelector('#dek-models').textContent,
        labs: document.querySelector('#dek-labs').textContent,
        date: document.querySelector('#dataset-date').textContent,
        title: document.querySelector('#end-forecast-title').innerText.replace(/\s+/g, ' ').trim(),
        note: document.querySelector('#horizon-note').textContent,
        leader: document.querySelector('.leader-name').textContent,
        leaderValue: document.querySelector('.end-leader strong').textContent,
        leaderUnit: document.querySelector('.leader-unit').textContent,
        timelineLast: document.querySelector('.leader-timeline li:last-child .tl-name').textContent.trim(),
        card: document.querySelector('.state-card[data-state="9"] .state-card-meta strong').textContent,
        cardDescription: document.querySelector('.state-card[data-state="9"] > p').textContent,
        leaderDescription: document.querySelector('.leader-description').textContent,
        matrix: [...row.querySelectorAll('.matrix-cell span')].map(cell => cell.textContent),
        exposure: [...document.querySelectorAll('.doomer-total b')].map(cell => cell.textContent),
        matrixLabel: document.querySelector('#matrix').getAttribute('aria-label'),
        barLabel: document.querySelector('#consensus-bar').getAttribute('aria-label'),
        summary: document.querySelector('#forecast-summary').textContent.replace(/\s+/g, ' ').trim(),
        exposureHint: document.querySelector('.doomer-key .on-hover').textContent,
        prompt: new URL(document.querySelector('#method-prompt-link').href).pathname,
        pressed: document.querySelector('.horizon-button[aria-pressed="true"]').dataset.horizon
      };
    });
    expect(snapshot).toEqual({
      activeHorizon: '2030', models: '2', labs: '2', date: '02.03.26',
      title: '2030 LAB-BALANCED MEAN',
      note: 'Snapshot at the end of 2030; it need not yet be durable.',
      leader: 'The Held Leash', leaderValue: '45.0%',
      leaderUnit: 'Lab-balanced mean across 2 labs (2 models) · 2030 · of 100 points',
      timelineLast: 'The Held Leash', card: '45.0%', matrix: ['45', '45'],
      cardDescription: snapshotHeldLeashDescription,
      leaderDescription: snapshotHeldLeashDescription,
      exposure: ['15%', '15%'], matrixLabel: '2030 probability by structural state and model',
      barLabel: 'Lab-balanced mean probability by structural state for 2030',
      summary: 'We asked 2 of the leading AI models from 2 labs to assign 100 percentage points across 11 mutually exclusive structural states for humanity’s relationship with AI.',
      exposureHint: 'Hover a bar for the states inside it',
      prompt: '/end_states_2030.md', pressed: '2030'
    });

    await page.locator('.state-card[data-state="9"]').click();
    await expect(page.locator('#dialog-content .dialog-kicker')).toContainText('Humanity remains in control · 2030');
    await expect(page.locator('#dialog-content .dialog-description')).toHaveText(snapshotHeldLeashDescription);
    await expect(page.locator('#dialog-content .dialog-summary > div').first()).toHaveText('45.0%2030 lab-balanced mean');
    await expect(page.locator('#dialog-content .model-answer p').first()).toContainText('2030');
    await page.locator('#dialog-close').click();

    await group.getByRole('button', { name: '2040', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.leader-name')?.textContent === 'Coexistence');
    const next = await page.evaluate(() => ({
      horizon: window.MF_TEST.activeHorizon(),
      models: document.querySelector('#dek-models').textContent,
      labs: document.querySelector('#dek-labs').textContent,
      date: document.querySelector('#dataset-date').textContent,
      leader: document.querySelector('.leader-name').textContent,
      leaderDescription: document.querySelector('.leader-description').textContent,
      card: document.querySelector('.state-card[data-state="8"] .state-card-meta strong').textContent,
      heldLeashDescription: document.querySelector('.state-card[data-state="9"] > p').textContent,
      exposure: [...document.querySelectorAll('.doomer-total b')].map(cell => cell.textContent),
      matrixLabel: document.querySelector('#matrix').getAttribute('aria-label'),
      summary: document.querySelector('#forecast-summary').textContent.replace(/\s+/g, ' ').trim(),
      prompt: new URL(document.querySelector('#method-prompt-link').href).pathname
    }));
    expect(next).toEqual({ horizon: '2040', models: '3', labs: '3', date: '03.04.26',
      leader: 'Coexistence', leaderDescription: snapshotCoexistenceDescription,
      card: '28.0%', heldLeashDescription: snapshotHeldLeashDescription,
      exposure: ['27%', '27%', '27%'], matrixLabel: '2040 probability by structural state and model',
      summary: 'We asked 3 of the leading AI models from 3 labs to assign 100 percentage points across 11 mutually exclusive structural states for humanity’s relationship with AI.',
      prompt: '/end_states_2040.md' });

    await page.locator('.state-card[data-state="9"]').click();
    await expect(page.locator('#dialog-content .dialog-kicker')).toContainText('Humanity remains in control · 2040');
    await expect(page.locator('#dialog-content .dialog-description')).toHaveText(snapshotHeldLeashDescription);
    await page.locator('#dialog-close').click();

    await group.getByRole('button', { name: '2050', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.leader-name')?.textContent === 'The Preserve');
    const farSnapshot = await page.evaluate(() => {
      const row = document.querySelector('.matrix-state[data-state="7"]')?.closest('.matrix-row');
      return {
        horizon: window.MF_TEST.activeHorizon(),
        models: document.querySelector('#dek-models').textContent,
        labs: document.querySelector('#dek-labs').textContent,
        date: document.querySelector('#dataset-date').textContent,
        title: document.querySelector('#end-forecast-title').innerText.replace(/\s+/g, ' ').trim(),
        note: document.querySelector('#horizon-note').textContent,
        leader: document.querySelector('.leader-name').textContent,
        leaderValue: document.querySelector('.end-leader strong').textContent,
        leaderUnit: document.querySelector('.leader-unit').textContent,
        card: document.querySelector('.state-card[data-state="7"] .state-card-meta strong').textContent,
        cardDescription: document.querySelector('.state-card[data-state="7"] > p').textContent,
        matrix: [...row.querySelectorAll('.matrix-cell span')].map(cell => cell.textContent),
        exposure: [...document.querySelectorAll('.doomer-total b')].map(cell => cell.textContent),
        matrixLabel: document.querySelector('#matrix').getAttribute('aria-label'),
        barLabel: document.querySelector('#consensus-bar').getAttribute('aria-label'),
        summary: document.querySelector('#forecast-summary').textContent.replace(/\s+/g, ' ').trim(),
        prompt: new URL(document.querySelector('#method-prompt-link').href).pathname,
        pressed: document.querySelector('.horizon-button[aria-pressed="true"]').dataset.horizon
      };
    });
    expect(farSnapshot).toEqual({
      horizon: '2050', models: '3', labs: '3', date: '04.05.26',
      title: '2050 LAB-BALANCED MEAN',
      note: 'Snapshot at the end of 2050; it need not yet be durable.',
      leader: 'The Preserve', leaderValue: '30.0%',
      leaderUnit: 'Lab-balanced mean across 3 labs (3 models) · 2050 · of 100 points',
      card: '30.0%', cardDescription: snapshotPreserveDescription,
      matrix: ['30', '30', '30'], exposure: ['37%', '37%', '37%'],
      matrixLabel: '2050 probability by structural state and model',
      barLabel: 'Lab-balanced mean probability by structural state for 2050',
      summary: 'We asked 3 of the leading AI models from 3 labs to assign 100 percentage points across 11 mutually exclusive structural states for humanity’s relationship with AI.',
      prompt: '/end_states_2050.md', pressed: '2050'
    });

    await page.locator('.state-card[data-state="9"]').click();
    await expect(page.locator('#dialog-content .dialog-kicker')).toContainText('Humanity remains in control · 2050');
    await expect(page.locator('#dialog-content .dialog-description')).toHaveText(snapshotHeldLeashDescription);
    await expect(page.locator('#dialog-content .model-answer p').first()).toContainText('2050');
    await page.locator('#dialog-close').click();

    await group.getByRole('button', { name: '2060', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.leader-name')?.textContent === 'The Merger');
    const laterSnapshot = await page.evaluate(() => {
      const row = document.querySelector('.matrix-state[data-state="6"]')?.closest('.matrix-row');
      return {
        horizon: window.MF_TEST.activeHorizon(),
        models: document.querySelector('#dek-models').textContent,
        labs: document.querySelector('#dek-labs').textContent,
        date: document.querySelector('#dataset-date').textContent,
        title: document.querySelector('#end-forecast-title').innerText.replace(/\s+/g, ' ').trim(),
        note: document.querySelector('#horizon-note').textContent,
        leader: document.querySelector('.leader-name').textContent,
        leaderValue: document.querySelector('.end-leader strong').textContent,
        leaderUnit: document.querySelector('.leader-unit').textContent,
        card: document.querySelector('.state-card[data-state="6"] .state-card-meta strong').textContent,
        cardDescription: document.querySelector('.state-card[data-state="6"] > p').textContent,
        matrix: [...row.querySelectorAll('.matrix-cell span')].map(cell => cell.textContent),
        exposure: [...document.querySelectorAll('.doomer-total b')].map(cell => cell.textContent),
        matrixLabel: document.querySelector('#matrix').getAttribute('aria-label'),
        barLabel: document.querySelector('#consensus-bar').getAttribute('aria-label'),
        summary: document.querySelector('#forecast-summary').textContent.replace(/\s+/g, ' ').trim(),
        prompt: new URL(document.querySelector('#method-prompt-link').href).pathname,
        pressed: document.querySelector('.horizon-button[aria-pressed="true"]').dataset.horizon
      };
    });
    expect(laterSnapshot).toEqual({
      horizon: '2060', models: '3', labs: '3', date: '05.06.26',
      title: '2060 LAB-BALANCED MEAN',
      note: 'Snapshot at the end of 2060; it need not yet be durable.',
      leader: 'The Merger', leaderValue: '20.0%',
      leaderUnit: 'Lab-balanced mean across 3 labs (3 models) · 2060 · of 100 points',
      card: '20.0%', cardDescription: snapshotMergerDescription,
      matrix: ['20', '20', '20'], exposure: ['45%', '45%', '45%'],
      matrixLabel: '2060 probability by structural state and model',
      barLabel: 'Lab-balanced mean probability by structural state for 2060',
      summary: 'We asked 3 of the leading AI models from 3 labs to assign 100 percentage points across 11 mutually exclusive structural states for humanity’s relationship with AI.',
      prompt: '/end_states_2060.md', pressed: '2060'
    });

    await page.locator('.state-card[data-state="9"]').click();
    await expect(page.locator('#dialog-content .dialog-kicker')).toContainText('Humanity remains in control · 2060');
    await expect(page.locator('#dialog-content .dialog-description')).toHaveText(snapshotHeldLeashDescription);
    await expect(page.locator('#dialog-content .model-answer p').first()).toContainText('2060');
    await page.locator('#dialog-close').click();

    await group.getByRole('button', { name: 'Long term' }).click();
    await page.waitForFunction(() => document.querySelector('.leader-name')?.textContent === 'The Held Leash');
    await expect(page.locator('#forecast-summary')).toContainText('11 mutually exclusive end states');
    await expect(page.locator('#matrix')).toHaveAttribute('aria-label', 'Long term probability by end state and model');
    await expect(page.locator('.state-card[data-state="9"] > p')).toHaveText(longHeldLeashDescription);
    await expect(page.locator('.leader-description')).toHaveText(longHeldLeashDescription);
    await page.locator('.state-card[data-state="9"]').click();
    await expect(page.locator('#dialog-content .dialog-kicker')).toContainText('Humanity keeps control · Long term');
    await expect(page.locator('#dialog-content .dialog-description')).toHaveText(longHeldLeashDescription);
    await page.locator('#dialog-close').click();
  });

  test('the URL shares both selectors and an unavailable model resets to the aggregate', async ({ page }) => {
    await settleWithHorizons(page, '/?utm_source=fixture&model=beta');
    await expect(page.locator('.end-toggle-button.active')).toHaveAttribute('data-end-forecast', 'beta');

    const horizon = page.getByRole('group', { name: 'Forecast horizon' });
    await horizon.getByRole('button', { name: '2030', exact: true }).click();
    await expect(page.locator('.end-toggle-button.active')).toHaveAttribute('data-end-forecast', 'Aggregate');
    const afterReset = new URL(page.url());
    expect(afterReset.searchParams.get('horizon')).toBe('2030');
    expect(afterReset.searchParams.get('model')).toBeNull();
    expect(afterReset.searchParams.get('utm_source')).toBe('fixture');

    await page.locator('[data-end-forecast="gamma"]').click();
    await horizon.getByRole('button', { name: '2060', exact: true }).click();
    await expect(page.locator('.end-toggle-button.active')).toHaveAttribute('data-end-forecast', 'gamma');
    const preserved = new URL(page.url());
    expect(preserved.searchParams.get('horizon')).toBe('2060');
    expect(preserved.searchParams.get('model')).toBe('gamma');
    expect(preserved.searchParams.get('utm_source')).toBe('fixture');
    await expect(page.locator('.horizon-button[data-horizon="2060"]')).toBeFocused();

    await page.reload();
    await page.waitForFunction(() => window.MF_TEST?.activeHorizon() === '2060');
    await expect(page.locator('.horizon-button[data-horizon="2060"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.end-toggle-button.active')).toHaveAttribute('data-end-forecast', 'gamma');
  });

  test('an empty horizon stays out of the selector until it has forecasts', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const empty2060 = `${horizonFixture}\nwindow.MF_DATA.datasets['2060'] = { endStateRuns: {}, datasetDate: null, leaderHistory: [] };`;
    await settleWithHorizons(page, '/?horizon=2060&utm_source=fixture', empty2060);
    const group = page.getByRole('group', { name: 'Forecast horizon' });
    await expect(group.getByRole('button')).toHaveText(['2030', '2040', '2050', 'Long term']);
    await expect(group.getByRole('button', { name: '2060', exact: true })).toHaveCount(0);
    await expect(group.getByRole('button', { name: 'Long term' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.state-card')).toHaveCount(11);
    await expect(page.locator('#dataset-date')).toHaveText('01.02.26');
    await expect(page.locator('#method-prompt-link')).toHaveAttribute('href', 'end_states.md');
    const normalized = new URL(page.url());
    expect(normalized.searchParams.get('horizon')).toBeNull();
    expect(normalized.searchParams.get('utm_source')).toBe('fixture');
    expect(errors).toEqual([]);
  });

  test('extinction marks use state language for snapshots and ending language for long term', async ({ page }) => {
    await settleWithHorizons(page, '/?horizon=2060');
    await expect(page.locator('.state-mark[data-mark="gone"]').first()).toHaveAttribute('aria-label', /States 1–3\./);
    await expect(page.locator('.state-mark[data-mark="risk"]').first()).toHaveAttribute('aria-label', /States 4–5\./);
    await expect(page.locator('.state-mark').first()).not.toHaveAttribute('aria-label', /ending/i);

    await page.getByRole('group', { name: 'Forecast horizon' }).getByRole('button', { name: 'Long term', exact: true }).click();
    await expect(page.locator('.state-mark[data-mark="gone"]').first()).toHaveAttribute('aria-label', /Endings 1–3\./);
    await expect(page.locator('.state-mark[data-mark="risk"]').first()).toHaveAttribute('aria-label', /versions of the ending/);
  });
});

test.describe('the 2030 exposure chart on a phone', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop', 'mobile regression coverage');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await settleWithHorizons(page, '/?horizon=2030');
  });

  test('the state colours end exactly where their aggregate tiers end', async ({ page }) => {
    // Padding on each state once made the five-colour layer longer than the
    // two-tier layer. Checking the painted endpoints catches any box-model
    // inflation without coupling the test to a particular CSS implementation.
    const mismatches = await page.evaluate(() => [...document.querySelectorAll('.doomer-row')]
      .map(row => {
        const endpoint = selector => {
          const layer = row.querySelector(selector);
          const painted = [...layer.children].filter(segment => segment.getBoundingClientRect().width > 0.01);
          return painted.at(-1)?.getBoundingClientRect().right ?? layer.getBoundingClientRect().left;
        };
        const stateEnd = endpoint('.doomer-stack');
        const tierEnd = endpoint('.doomer-tiers');
        return {
          model: row.querySelector('.doomer-label b').textContent.trim(),
          delta: Math.abs(stateEnd - tierEnd)
        };
      })
      .filter(({ delta }) => delta > 1)
      .map(({ model, delta }) => `${model}: endpoints differ by ${delta.toFixed(2)}px`));
    expect(mismatches).toEqual([]);
    const exposedWhileCollapsed = await page.locator('.doomer-stack').evaluateAll(layers =>
      layers.filter(layer => parseFloat(getComputedStyle(layer).opacity) > 0).length);
    expect(exposedWhileCollapsed, 'a collapsed row can leak state colour past a tier boundary').toBe(0);
  });

  test('a tier percentage is either wholly visible or intentionally hidden', async ({ page }) => {
    // A narrow 3% or 4% tier used to clip its figure down to a stray "%".
    // Omitted, hidden, and visually-hidden labels are valid; a painted label
    // must fit completely inside the segment that owns it.
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.doomer-tiers > i')]
      .flatMap(segment => {
        const label = segment.querySelector('span');
        if (!label) return [];
        const style = getComputedStyle(label);
        const intentionallyHidden = label.hidden
          || label.getAttribute('aria-hidden') === 'true'
          || label.classList.contains('sr-only')
          || style.display === 'none'
          || style.visibility === 'hidden'
          || parseFloat(style.opacity) === 0
          || label.getClientRects().length === 0;
        if (intentionallyHidden) return [];
        const outer = segment.getBoundingClientRect();
        const inner = label.getBoundingClientRect();
        const fits = inner.left >= outer.left - 0.5
          && inner.right <= outer.right + 0.5
          && inner.top >= outer.top - 0.5
          && inner.bottom <= outer.bottom + 0.5;
        if (fits) return [];
        const model = segment.closest('.doomer-row').querySelector('.doomer-label b').textContent.trim();
        return [`${model}: ${label.textContent.trim()} is only partly inside its tier`];
      }));
    expect(clipped).toEqual([]);
  });

  test('opening a breakdown makes room before the next model', async ({ page }) => {
    const first = page.locator('.doomer-row').first();
    const next = page.locator('.doomer-row').nth(1);
    await first.click();
    const readout = first.locator('.doomer-readout');
    await expect(readout).toBeVisible();
    const geometry = await page.evaluate(() => {
      const rows = document.querySelectorAll('.doomer-row');
      const detail = rows[0].querySelector('.doomer-readout').getBoundingClientRect();
      const following = rows[1].getBoundingClientRect();
      return { detailBottom: detail.bottom, nextTop: following.top };
    });
    expect(geometry.detailBottom, 'the open breakdown overlaps the following model').toBeLessThanOrEqual(geometry.nextTop + 0.5);
    await expect(next).toBeVisible();
  });

  test('the legend preserves its swatches and gives the hint a separate row', async ({ page }) => {
    const layout = await page.evaluate(() => {
      const key = document.querySelector('.doomer-key');
      const gone = key.querySelector('.key-gone').getBoundingClientRect();
      const risk = key.querySelector('.key-risk').getBoundingClientRect();
      const hint = key.querySelector('.key-hint').getBoundingClientRect();
      const swatches = [...key.querySelectorAll(':scope > span > i')].map(i => i.getBoundingClientRect().width);
      return {
        display: getComputedStyle(key).display,
        hintTop: hint.top,
        keyBottom: Math.max(gone.bottom, risk.bottom),
        swatches
      };
    });
    expect(layout.display).toBe('grid');
    expect(layout.hintTop, 'the interaction hint is squeezed beside the two keys').toBeGreaterThanOrEqual(layout.keyBottom - 0.5);
    expect(Math.min(...layout.swatches), 'a legend swatch shrank below its intended size').toBeGreaterThanOrEqual(9.5);
  });

  test('the former origin section is absent', async ({ page }) => {
    await expect(page.locator('.origin')).toHaveCount(0);
    await expect(page.getByText('Where this started', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/biological boot loader/i)).toHaveCount(0);
  });

  test('the horizon controls precede the forecast and only the buttons stay sticky', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    const placement = await page.evaluate(() => {
      const copy = document.querySelector('.horizon-picker-copy');
      const dock = document.querySelector('.horizon-toggle-dock');
      const toggle = document.querySelector('.horizon-toggle');
      const rule = document.querySelector('.horizon-picker-rule');
      const forecast = document.querySelector('.end-hero');
      const c = copy.getBoundingClientRect();
      const d = dock.getBoundingClientRect();
      const r = rule.getBoundingClientRect();
      const f = forecast.getBoundingClientRect();
      return {
        domBeforeForecast: Boolean(rule.compareDocumentPosition(forecast) & Node.DOCUMENT_POSITION_FOLLOWING),
        visuallyOrdered: c.bottom <= d.top + 1 && d.bottom <= r.top + 1 && r.bottom <= f.top + 1,
        top: c.top,
        bottom: r.bottom,
        viewportHeight: innerHeight,
        viewportWidth: innerWidth,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        buttons: [...toggle.querySelectorAll('.horizon-button')].map(button => {
          const range = document.createRange();
          range.selectNodeContents(button);
          const text = range.getBoundingClientRect();
          const box = button.getBoundingClientRect();
          const lines = [...range.getClientRects()].filter(rect => rect.width > 0.1 && rect.height > 0.1).length;
          const textFits = text.left >= box.left - 0.5 && text.right <= box.right + 0.5;
          return { label: button.textContent.trim(), lines, height: box.height, textFits };
        })
      };
    });
    expect(placement.viewportWidth).toBeGreaterThanOrEqual(320);
    expect(placement.viewportWidth).toBeLessThanOrEqual(390);
    expect(placement.domBeforeForecast, 'the forecast does not follow the controls in reading order').toBe(true);
    expect(placement.visuallyOrdered, 'the label, buttons, divider, and forecast are out of order').toBe(true);
    expect(placement.top, 'the controls start above the viewport').toBeGreaterThanOrEqual(-0.5);
    expect(placement.bottom, 'the controls fall below the initial viewport').toBeLessThanOrEqual(placement.viewportHeight + 0.5);
    expect(placement.overflow, 'the sticky controls make the page scroll sideways').toBeLessThanOrEqual(0);
    expect(placement.buttons.map(button => button.label)).toEqual(['2030', '2040', '2050', '2060', 'Long term']);
    expect(placement.buttons.filter(button => button.lines !== 1), 'a horizon label wrapped onto a second line').toEqual([]);
    expect(placement.buttons.filter(button => !button.textFits), 'a horizon label crossed its button border').toEqual([]);
    expect(Math.max(...placement.buttons.map(button => button.height)), 'the five-button row grew taller than its one-line control height').toBeLessThanOrEqual(40.5);

    await page.evaluate(() => document.querySelector('.states-section').scrollIntoView({ block: 'start' }));
    const stuck = await page.evaluate(() => {
      const copy = document.querySelector('.horizon-picker-copy').getBoundingClientRect();
      const dock = document.querySelector('.horizon-toggle-dock').getBoundingClientRect();
      const buttons = document.querySelector('.horizon-toggle').getBoundingClientRect();
      const rule = document.querySelector('.horizon-picker-rule').getBoundingClientRect();
      return {
        copyBottom: copy.bottom,
        dockTop: dock.top,
        buttonsTop: buttons.top,
        buttonsBottom: buttons.bottom,
        ruleBottom: rule.bottom,
        viewportHeight: innerHeight
      };
    });
    expect(stuck.copyBottom, 'the explanatory copy stayed pinned').toBeLessThan(0);
    expect(stuck.ruleBottom, 'the divider stayed pinned').toBeLessThan(0);
    expect(stuck.dockTop, 'the buttons did not reach the top of the viewport').toBeGreaterThanOrEqual(-0.5);
    expect(stuck.dockTop).toBeLessThanOrEqual(0.5);
    expect(stuck.buttonsTop, 'the buttons escaped their sticky dock').toBeGreaterThanOrEqual(stuck.dockTop);
    expect(stuck.buttonsBottom, 'the sticky buttons fell below the viewport').toBeLessThanOrEqual(stuck.viewportHeight);

    await page.getByRole('group', { name: 'Forecast horizon' }).getByRole('button', { name: '2060', exact: true }).click();
    await expect(page.locator('.horizon-button[data-horizon="2060"]')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.evaluate(() => new URL(location.href).searchParams.get('horizon'))).toBe('2060');
    const afterSwitch = await page.evaluate(() => ({
      dockTop: document.querySelector('.horizon-toggle-dock').getBoundingClientRect().top,
      scrollY
    }));
    expect(afterSwitch.scrollY, 'switching a sticky horizon returned to the page top').toBeGreaterThan(placement.bottom);
    expect(afterSwitch.dockTop, 'the buttons stopped sticking after a horizon switch').toBeGreaterThanOrEqual(-0.5);
    expect(afterSwitch.dockTop).toBeLessThanOrEqual(0.5);
  });

  test('an exposure row works from the keyboard and reflects its state', async ({ page }) => {
    const row = page.locator('.doomer-row').first();
    const semantics = await row.evaluate(el => ({
      button: el.matches('button') || el.getAttribute('role') === 'button',
      tabIndex: el.tabIndex
    }));
    expect(semantics.button, 'the interactive row has no button semantics').toBe(true);
    expect(semantics.tabIndex, 'the interactive row is not in the tab order').toBeGreaterThanOrEqual(0);
    await expect(row).toHaveAttribute('aria-expanded', 'false');

    await row.focus();
    await expect(row).toBeFocused();
    await row.press('Enter');
    await expect(row).toHaveAttribute('aria-expanded', 'true');
    await expect(row).toHaveClass(/\bis-open\b/);

    await row.press('Space');
    await expect(row).toHaveAttribute('aria-expanded', 'false');
    await expect(row).not.toHaveClass(/\bis-open\b/);
  });
});

test.describe('every model view', () => {
  test('the aggregate is lab-balanced and published to tenths', async ({ page }) => {
    await settle(page);
    const computed = await page.evaluate(() => {
      const vector = (...values) => Object.fromEntries(
        Array.from({ length: 11 }, (_, index) => [index + 1, values[index] || 0])
      );
      const runs = [
        { provider: 'Lab A', probabilities: vector(100) },
        { provider: 'Lab A', probabilities: vector(0, 100) },
        { provider: 'Lab B', probabilities: vector(0, 0, 100) },
        { provider: 'Lab C', probabilities: vector(0, 0, 0, 100) }
      ];
      const values = window.MF_TEST.aggregateOf(runs);
      return { values, sum: values.reduce((total, value) => total + value, 0) };
    });
    // Lab A contributes one third in total despite having two models. An
    // equal-model mean would instead put 25 points on each of states 1–4.
    expect(computed.values.slice(0, 4)).toEqual([16.7, 16.7, 33.3, 33.3]);
    expect(computed.values.slice(4)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(computed.sum).toBeCloseTo(100, 9);
  });

  test('aggregate figures show tenths while individual models stay whole', async ({ page }) => {
    await settle(page);
    await expect(page.locator('.end-toggle-button').first()).toHaveText('Lab-balanced mean');
    const aggregateFigures = await page.evaluate(() => ({
      leader: document.querySelector('.end-leader strong').textContent,
      cards: [...document.querySelectorAll('.state-card-meta strong')].map(element => element.textContent),
      legend: [...document.querySelectorAll('#consensus-legend b')].map(element => element.textContent)
    }));
    expect([aggregateFigures.leader, ...aggregateFigures.cards, ...aggregateFigures.legend]
      .every(value => /^\d+\.\d%$/.test(value))).toBe(true);

    await page.locator('.end-toggle-button').nth(1).click();
    await page.waitForTimeout(700);
    const modelFigures = await page.locator('#consensus-legend b').allTextContents();
    expect(modelFigures.every(value => /^\d+%$/.test(value))).toBe(true);
  });

  test('each strip agrees with its own numbers', async ({ page }) => {
    await settle(page);
    const views = await page.locator('.end-toggle-button').count();
    for (let i = 0; i < views; i++) {
      const button = page.locator('.end-toggle-button').nth(i);
      const label = (await button.innerText()).trim();
      await button.click();
      await page.waitForTimeout(700);   // let the figure tween finish
      const problems = await page.evaluate(() => {
        const bad = [];
        document.querySelectorAll('.state-card').forEach(card => {
          const id = card.dataset.state;
          const range = card.querySelector('.strip-range');
          const iqr = card.querySelector('.strip-iqr');
          const tick = card.querySelector('.strip-mid');
          const axisW = card.querySelector('.strip-axis').offsetWidth;
          // offsetWidth is layout, so the reveal transform does not distort it
          for (const [name, el] of [['range', range], ['middle half', iqr]]) {
            if (!el.hidden && el.offsetWidth < 1) bad.push(`S${id}: the ${name} band draws at zero width`);
          }
          const centre = tick.offsetLeft + tick.offsetWidth / 2;
          if (centre < range.offsetLeft - 1 || centre > range.offsetLeft + range.offsetWidth + 1) bad.push(`S${id}: the published figure sits outside its full range`);
          if (range.offsetLeft + range.offsetWidth > axisW + 1) bad.push(`S${id}: the range runs off the axis`);
          const onCard = parseFloat(card.querySelector('.state-card-meta strong').textContent);
          const aggregate = window.MF_TEST.stateAggregate().find(item => String(item.id) === id).probability;
          if (onCard !== aggregate) bad.push(`S${id}: card says ${onCard}%, the lab-balanced mean is ${aggregate}%`);
          if (!/across \d+ models/.test(card.querySelector('.range-text').textContent)) {
            bad.push(`S${id}: the card's caption stopped describing the spread across models`);
          }
        });
        const legend = [...document.querySelectorAll('#consensus-legend > button b')].map(b => parseFloat(b.textContent));
        const sum = legend.reduce((a, c) => a + c, 0);
        if (sum !== 100) bad.push(`the allocation sums to ${sum}, not 100`);
        [...document.querySelectorAll('#consensus-bar > button')].forEach((seg, i) => {
          if (Math.abs(parseFloat(seg.style.width) - legend[i]) > 0.01) bad.push(`segment ${i + 1} is drawn at ${parseFloat(seg.style.width)}% but labelled ${legend[i]}%`);
        });
        return bad;
      });
      expect(problems, `in the ${label} view`).toEqual([]);
    }
  });
});

test.describe('the charts are actually painted', () => {
  test('every band is visible once its card is on screen', async ({ page }) => {
    await settle(page);
    const cards = page.locator('.state-card');
    const count = await cards.count();
    const invisible = [];
    for (let i = 0; i < count; i++) {
      await cards.nth(i).scrollIntoViewIfNeeded();
      await page.waitForTimeout(1800);   // longer than the reveal's own rescue
      // getBoundingClientRect, not offsetWidth: a band scaled to zero still has
      // layout width, and reporting that is how this went unnoticed.
      const blank = await cards.nth(i).evaluate(card => {
        const out = [];
        for (const sel of ['.strip-range', '.strip-iqr']) {
          const el = card.querySelector(sel);
          if (el.hidden) continue;
          if (el.getBoundingClientRect().width < 0.5) {
            out.push(`S${card.dataset.state} ${sel} paints at zero (layout ${el.offsetWidth}px, transform ${getComputedStyle(el).transform})`);
          }
        }
        return out;
      });
      invisible.push(...blank);
    }
    expect(invisible).toEqual([]);
  });

  test('the exposure bars wipe left to right after a hold', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.doomer-row');
    const out = await page.evaluate(() => new Promise(resolve => {
      const list = document.querySelector('.doomer-list');
      const bar = list.querySelector('.doomer-row .doomer-bar');
      document.documentElement.style.scrollBehavior = 'auto';
      const t0 = performance.now();
      const samples = [];
      list.scrollIntoView();
      let delaysWhileAnimating = [];
      const poll = () => {
        samples.push({ at: Math.round(performance.now() - t0), clip: getComputedStyle(bar).clipPath, cls: list.className });
        if (list.classList.contains('is-in') && !delaysWhileAnimating.length) {
          delaysWhileAnimating = [...list.querySelectorAll('.doomer-row')].map(r => getComputedStyle(r.querySelector('.doomer-bar')).transitionDelay);
        }
        if (performance.now() - t0 < 2200) requestAnimationFrame(poll);
        else {
          const started = samples.find(x => x.cls.includes('is-in'));
          const partial = samples.filter(x => /inset\(0px [0-9.]+%/.test(x.clip));
          resolve({ heldFor: started ? started.at : null, partialFrames: partial.length,
                    firstClip: samples.find(x => /inset/.test(x.clip))?.clip ?? null,
                    finalClip: samples.at(-1).clip,
                    rowDelays: delaysWhileAnimating });
        }
      };
      requestAnimationFrame(poll);
    }));
    expect(out.heldFor, 'it should wait about half a second before drawing').toBeGreaterThan(400);
    expect(out.heldFor).toBeLessThan(900);
    expect(out.firstClip, 'it should start fully clipped').toContain('100%');
    expect(out.partialFrames, 'no partly-revealed frame: it appeared rather than wiped').toBeGreaterThan(0);
    expect(['inset(0px)', 'none'], `ended partly clipped: ${out.finalClip}`).toContain(out.finalClip);
    // Rows step, so the wipe runs down the chart rather than all at once.
    const delays = out.rowDelays.map(d => parseFloat(d));
    expect(delays.at(-1), 'the last row should start after the first').toBeGreaterThan(delays[0]);
  });

  test('reduced motion shows the exposure bars outright', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.waitForSelector('.doomer-row');
    const clip = await page.evaluate(() => {
      document.querySelector('.doomer-list').scrollIntoView();
      return getComputedStyle(document.querySelector('.doomer-bar')).clipPath;
    });
    expect(clip, 'the bars should not be clipped under reduced motion').toBe('none');
  });

  test('content reached late still animates', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.state-card');
    // A page-load timer once cleared every element's hidden state after four
    // seconds, so anything a reader reached after that simply appeared. The
    // class alone does not prove the animation ran — `is-in` lands either way
    // — so this samples the painted transform.
    const out = await page.evaluate(() => new Promise(resolve => {
      const strip = document.querySelectorAll('.state-strip')[8];
      const band = strip.querySelector('.strip-range');
      setTimeout(() => {
        document.documentElement.style.scrollBehavior = 'auto';
        strip.scrollIntoView();
        const seen = [];
        let n = 0;
        const poll = () => {
          seen.push(getComputedStyle(band).transform);
          if (++n < 30) requestAnimationFrame(poll);
          else resolve({ midFlight: seen.filter(t => t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)').length, classes: strip.className });
        };
        requestAnimationFrame(poll);
      }, 5000);
    }));
    expect(out.midFlight, `the band never scaled, it just appeared (classes: ${out.classes})`).toBeGreaterThan(0);
  });

  test('nothing the reader has scrolled past stays hidden', async ({ page }) => {
    await settle(page);
    // Elements below the fold keep their hidden state on purpose — that is
    // what makes them animate when reached. The guarantee is narrower: once a
    // reader has been past something, it must not still be waiting.
    await page.evaluate(() => new Promise(resolve => {
      document.documentElement.style.scrollBehavior = 'auto';
      let y = 0;
      const step = () => {
        y += 400;
        window.scrollTo(0, y);
        if (y < document.documentElement.scrollHeight) setTimeout(step, 120);
        else setTimeout(resolve, 2800);   // past the rescue window and the exposure hold
      };
      step();
    }));
    const stuck = await page.evaluate(() => [...document.querySelectorAll('.state-strip.will-reveal, .matrix.will-reveal, .doomer-list.will-reveal')]
      .map(el => `${el.className} at y=${Math.round(el.getBoundingClientRect().top + window.scrollY)}`));
    expect(stuck).toEqual([]);
  });
});

test.describe('the leader timeline', () => {
  test('it lists every date and marks the changes', async ({ page }) => {
    await settle(page);
    const tl = await page.evaluate(() => {
      const el = document.querySelector('.leader-timeline');
      if (!el) return null;
      const rows = [...el.querySelectorAll('li')].map(li => ({
        text: li.innerText.replace(/\s+/g, ' ').trim(),
        change: li.classList.contains('is-change'),
        mark: li.querySelector('.state-mark')?.dataset.mark ?? null,
        markLabel: li.querySelector('.state-mark')?.getAttribute('aria-label') ?? null
      }));
      return { rows, note: el.querySelector('p').textContent,
               history: window.MF_TEST.activeDataset().leaderHistory,
               states: window.MF_DATA.states,
               insidePanel: !!el.closest('.end-leader') };
    });
    expect(tl, 'no timeline rendered').not.toBeNull();
    expect(tl.insidePanel, 'the timeline should live in the leader panel').toBe(true);
    expect(tl.rows.length, 'a row per date in the data').toBe(tl.history.length);
    // Dates run forward, and neither cohort count goes backwards.
    const dates = tl.history.map(h => h.date);
    expect([...dates].sort()).toEqual(dates);
    const counts = tl.history.map(h => h.models);
    expect(counts.every((n, i) => i === 0 || n >= counts[i - 1]), 'model count went backwards').toBe(true);
    const labCounts = tl.history.map(h => h.labs);
    expect(labCounts.every((n, i) => i === 0 || n >= labCounts[i - 1]), 'lab count went backwards').toBe(true);
    // A row flagged as a change must actually differ from the row before it.
    tl.history.forEach((h, i) => {
      const differs = i === 0 || tl.history[i - 1].stateId !== h.stateId;
      expect(h.changed, `row ${i} (${h.date}) is flagged ${h.changed} but differs=${differs}`).toBe(differs);
      const state = tl.states.find(candidate => candidate.id === h.stateId);
      expect(tl.rows[i].mark, `row ${i} (${h.date}) has the wrong hazard mark`).toBe(state.extinction ?? null);
      expect(Boolean(tl.rows[i].markLabel), `row ${i} (${h.date}) has an unlabelled hazard mark`).toBe(Boolean(state.extinction));
      expect(tl.rows[i].text).toContain(`${h.models} models · ${h.labs} labs`);
    });
    expect(tl.rows.filter(r => r.change).length).toBe(tl.history.filter(h => h.changed).length);
  });

  test('the last row agrees with the ending the panel names', async ({ page }) => {
    await settle(page);
    const same = await page.evaluate(() => {
      const history = window.MF_TEST.activeDataset().leaderHistory;
      const latest = history.at(-1);
      const named = window.MF_TEST.stateAggregate().slice().sort((a, b) => b.probability - a.probability)[0];
      return { timelineSays: latest.stateId, panelSays: named.id, share: latest.share, panelShare: named.probability };
    });
    expect(same.timelineSays, 'the timeline ends on a different ending than the panel names').toBe(same.panelSays);
    expect(same.share).toBe(same.panelShare);
  });
});

test.describe('the selector governs one chart only', () => {
  test('choosing a model leaves the ending cards alone', async ({ page }) => {
    await settle(page);
    const snapshot = () => page.evaluate(() => ({
      cards: [...document.querySelectorAll('.state-card')].map(c => `${c.dataset.state}:${c.querySelector('.state-card-meta strong').textContent}:${c.querySelector('.range-text').textContent}`),
      legend: [...document.querySelectorAll('#consensus-legend > button b')].map(b => b.textContent).join(','),
      title: document.querySelector('#end-forecast-title').innerText.replace(/\s+/g, ' ').trim()
    }));
    const before = await snapshot();
    for (const i of [5, 12, 16]) {
      await page.locator('.end-toggle-button').nth(i).click();
      await page.waitForTimeout(800);
      const after = await snapshot();
      expect(after.cards, 'the ending cards followed the selector').toEqual(before.cards);
      expect(after.title, 'the chart title did not follow the selector').not.toBe(before.title);
      expect(after.legend, 'the chart did not follow the selector').not.toBe(before.legend);
    }
  });
});

test.describe('the leader settles on its answer', () => {
  test('it riffles through endings and lands on the right one', async ({ page }) => {
    await settle(page);
    const result = await page.evaluate(() => new Promise(resolve => {
      const name = document.querySelector('.leader-name');
      const figure = document.querySelector('.end-leader strong');
      const top = window.MF_TEST.stateAggregate().slice().sort((a, b) => b.probability - a.probability)[0];
      const expected = { name: top.name, figure: `${top.probability.toFixed(1)}%` };
      const seen = new Set(), blurs = new Set();
      document.querySelector('.end-leader-section').scrollIntoView();
      const t0 = performance.now();
      window.MF_TEST.replayLeader();
      const poll = () => {
        seen.add(name.textContent);
        blurs.add(getComputedStyle(name).filter);
        if (performance.now() - t0 < 1700) requestAnimationFrame(poll);
        else resolve({ expected, namesShown: seen.size, blurred: [...blurs].some(f => f !== 'none'),
          finalName: name.textContent, finalFigure: figure.textContent,
          filterCleared: getComputedStyle(name).filter === 'none',
          classCleared: !name.classList.contains('is-settling') });
      };
      requestAnimationFrame(poll);
    }));
    expect(result.namesShown, 'the name never changed — the riffle did not run').toBeGreaterThan(3);
    expect(result.blurred, 'no blur was ever applied').toBe(true);
    expect(result.finalName, 'it did not land on the leading ending').toBe(result.expected.name);
    expect(result.finalFigure).toBe(result.expected.figure);
    expect(result.filterCleared, 'the blur was left on the element').toBe(true);
    expect(result.classCleared, 'the settling class was left behind').toBe(true);
  });

  test('the answer is on screen before any of it starts', async ({ page }) => {
    // The effect wraps a fact; it must never be the thing that produces it.
    await page.goto('/');
    await page.waitForSelector('.leader-name');
    const atFirstPaint = await page.evaluate(() => ({
      name: document.querySelector('.leader-name').textContent,
      figure: document.querySelector('.end-leader strong').textContent
    }));
    expect(atFirstPaint.name.length).toBeGreaterThan(2);
    expect(atFirstPaint.figure).toMatch(/^\d+\.\d%$/);
  });

  test('reduced motion gets the answer with no riffle', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await settle(page);
    const out = await page.evaluate(() => new Promise(resolve => {
      const name = document.querySelector('.leader-name');
      const before = name.textContent;
      window.MF_TEST.replayLeader();
      const seen = new Set([before]);
      let n = 0;
      const poll = () => { seen.add(name.textContent); if (++n < 40) requestAnimationFrame(poll);
        else resolve({ namesShown: seen.size, final: name.textContent, before }); };
      requestAnimationFrame(poll);
    }));
    expect(out.namesShown, 'the name should never change under reduced motion').toBe(1);
    expect(out.final).toBe(out.before);
  });
});

test.describe('the forecast plays itself', () => {
  test('it steps through every model and returns to the aggregate', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.end-toggle-button');
    const result = await page.evaluate(() => new Promise(resolve => {
      const seen = [];
      const active = () => document.querySelector('.end-toggle-button.active')?.dataset.endForecast;
      let last = active();
      const t0 = performance.now();
      const budget = Object.keys(window.MF_TEST.activeDataset().endStateRuns).length * 500 + 6000;
      const watch = setInterval(() => {
        const now = active();
        if (now !== last) { seen.push({ at: Math.round(performance.now() - t0), key: now }); last = now; }
        if (performance.now() - t0 > budget) {
          clearInterval(watch);
          const gaps = seen.slice(1).map((s, i) => s.at - seen[i].at).sort((a, b) => a - b);
          resolve({ visited: seen.map(s => s.key), models: Object.keys(window.MF_TEST.activeDataset().endStateRuns).length,
                    aggregateGap: gaps[Math.floor(gaps.length / 2)], ended: active() });
        }
      }, 30);
      // The site uses smooth scrolling for readers. CI WebKit can leave that
      // programmatic scroll pending long enough that the IntersectionObserver
      // never sees the panel during this test's fixed sweep budget. Make only
      // the test setup scroll immediate; the real observer and timed sweep are
      // still what drive every selection below.
      document.documentElement.style.scrollBehavior = 'auto';
      document.querySelector('.end-consensus').scrollIntoView({ block: 'start' });
    }));
    const models = result.visited.filter(k => k !== 'Aggregate');
    expect(models.length, 'the sweep did not visit every model').toBe(result.models);
    expect(new Set(models).size, 'a model was shown twice').toBe(result.models);
    expect(result.aggregateGap, 'the step should be about half a second').toBeGreaterThan(400);
    expect(result.aggregateGap).toBeLessThan(700);
    expect(result.ended, 'it should come to rest on the aggregate').toBe('Aggregate');
  });

  test('a click takes it over', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.end-toggle-button');
    await page.evaluate(() => document.querySelector('.end-consensus').scrollIntoView());
    await page.waitForTimeout(1200);                       // let the sweep get going
    const chosen = await page.locator('.end-toggle-button').nth(4).getAttribute('data-end-forecast');
    await page.locator('.end-toggle-button').nth(4).click();
    await page.waitForTimeout(2000);                       // four steps would have passed
    const still = await page.evaluate(() => document.querySelector('.end-toggle-button.active')?.dataset.endForecast);
    expect(still, 'the sweep kept going after the reader chose a model').toBe(chosen);
  });

  test('reduced motion gets no sweep', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.waitForSelector('.end-toggle-button');
    await page.evaluate(() => document.querySelector('.end-consensus').scrollIntoView());
    await page.waitForTimeout(2000);
    const active = await page.evaluate(() => document.querySelector('.end-toggle-button.active')?.dataset.endForecast);
    expect(active, 'the selection moved under reduced motion').toBe('Aggregate');
  });
});

test.describe('behaviour', () => {
  test('the leader panel ignores the model selector', async ({ page }) => {
    await settle(page);
    const read = () => page.evaluate(() => document.querySelector('.leader-name').textContent + ' ' + document.querySelector('.end-leader strong').textContent);
    const before = await read();
    const buttons = page.locator('.end-toggle-button');
    for (const i of [3, 9]) {
      await buttons.nth(i).click();
      await page.waitForTimeout(700);
      expect(await read(), 'the leader followed the selector').toBe(before);
    }
  });

  test('a model-authored rationale cannot execute', async ({ page }) => {
    await settle(page);
    const result = await page.evaluate(async () => {
      const runs = window.MF_TEST.activeDataset().endStateRuns;
      const key = Object.keys(runs)[0];
      runs[key].rationales[3] = '<img src=x onerror="window.__pwned=1"><scr' + 'ipt>window.__pwned=1</scr' + 'ipt>';
      window.__pwned = 0;
      document.querySelector('.state-card[data-state="3"]').click();
      await new Promise(r => setTimeout(r, 400));
      const dialog = document.querySelector('#detail-dialog');
      const out = { executed: window.__pwned === 1, injected: dialog.querySelectorAll('.model-answer img, .model-answer script').length };
      dialog.close();
      return out;
    });
    expect(result.executed, 'injected script ran').toBe(false);
    expect(result.injected, 'injected nodes were created').toBe(0);
  });

  test('the published aggregate stays inside the spread it is drawn against', async ({ page }) => {
    await settle(page);
    // A mean can legitimately sit outside the middle half, but as a convex
    // combination it must remain within the complete model range.
    const bad = await page.evaluate(() => {
      const { stateAggregate } = window.MF_TEST;
      const runs = Object.values(window.MF_TEST.activeDataset().endStateRuns);
      const out = [];
      for (const state of stateAggregate()) {
        const column = runs.map(r => r.probabilities[state.id]).sort((a, b) => a - b);
        if (state.probability < column[0] || state.probability > column.at(-1)) {
          out.push(`S${state.id}: ${state.probability}% outside the model range ${column[0]}-${column.at(-1)}%`);
        }
      }
      const sum = stateAggregate().reduce((a, s) => a + s.probability, 0);
      if (Math.abs(sum - 100) > 1e-9) out.push(`the aggregate sums to ${sum}`);
      return out;
    });
    expect(bad).toEqual([]);
  });

  test('the detail dialog is named and its marks are ink', async ({ page }) => {
    await settle(page);
    const a11y = await page.evaluate(async () => {
      document.querySelector('.state-card[data-state="1"]').click();
      await new Promise(r => setTimeout(r, 300));
      const dialog = document.querySelector('#detail-dialog');
      const name = document.getElementById(dialog.getAttribute('aria-labelledby'))?.textContent.trim();
      dialog.close();
      const mark = document.querySelector('.state-mark');
      return { name, markColour: getComputedStyle(mark).color, bodyColour: getComputedStyle(document.body).color,
               rowheaders: document.querySelectorAll('.matrix-rowheader[role="rowheader"] button').length,
               endings: window.MF_DATA.states.length };
    });
    expect(a11y.name, 'the dialog has no accessible name').toBeTruthy();
    expect(a11y.markColour, 'the marks should take the surrounding ink').toBe(a11y.bodyColour);
    expect(a11y.rowheaders, 'row headers should wrap a real button').toBe(a11y.endings);
  });

  test('the extinction mark is a text glyph, never a colour emoji', async ({ page }) => {
    await page.goto('/');
    const mark = await page.evaluate(() => {
      const m = document.querySelector('.state-mark.is-glyph');
      if (!m) return null;
      const size = parseFloat(getComputedStyle(m).fontSize);
      // Emoji presentation comes from a colour font whose advance is about one
      // em or wider; the text glyph is around .6em. Computed colour cannot tell
      // them apart — a colour emoji reports the inherited ink and paints its
      // own — so measure the advance the engine actually chose.
      return { points: [...m.textContent].map(c => c.codePointAt(0).toString(16)),
               ratio: m.getBoundingClientRect().width / size };
    });
    expect(mark, 'no extinction glyph rendered').not.toBeNull();
    expect(mark.points, 'the glyph must carry U+FE0E, the text-presentation selector').toEqual(['2620', 'fe0e']);
    expect(mark.ratio, 'the glyph rendered at emoji width — the engine substituted a colour emoji').toBeLessThan(0.9);
  });
});

test.describe('mean scenario probabilities by horizon', () => {
  const horizons = [
    ['2030', '2030'],
    ['2040', '2040'],
    ['2050', '2050'],
    ['2060', '2060'],
    ['Long term', 'long-term']
  ];

  test('sits directly below extinction-risk exposure and paints every scenario in its site colour', async ({ page }) => {
    await settle(page);

    const chart = await page.evaluate(() => {
      const exposure = document.querySelector('.model-mix');
      const section = document.querySelector('.horizon-chart-section');
      const normalizeColour = value => {
        const probe = document.createElement('i');
        probe.style.color = value;
        document.body.append(probe);
        const colour = getComputedStyle(probe).color;
        probe.remove();
        return colour;
      };
      const stateColours = new Map(window.MF_DATA.states.map(state => [String(state.id), normalizeColour(state.color)]));
      const paths = [...document.querySelectorAll('path.horizon-chart-series[data-state]')];
      const points = [...document.querySelectorAll('circle.horizon-chart-point[data-state][data-horizon]')];
      return {
        followsExposure: exposure?.nextElementSibling === section,
        paths: paths.map(path => ({
          state: path.dataset.state,
          expected: stateColours.get(path.dataset.state),
          stroke: getComputedStyle(path).stroke,
          dash: getComputedStyle(path).strokeDasharray
        })),
        points: points.map(point => ({
          key: `${point.dataset.state}:${point.dataset.horizon}`,
          state: point.dataset.state,
          expected: stateColours.get(point.dataset.state),
          fill: getComputedStyle(point).fill,
          radius: parseFloat(point.getAttribute('r'))
        }))
      };
    });

    expect(chart.followsExposure, 'the horizon chart is not the exposure section\'s next section').toBe(true);
    expect(chart.paths, 'there must be one path for each of the 11 scenarios').toHaveLength(11);
    expect(new Set(chart.paths.map(path => path.state)).size).toBe(11);
    expect(chart.paths.filter(path => path.stroke !== path.expected), 'a scenario path stopped using its state colour').toEqual([]);
    expect(chart.paths.filter(path => !['none', ''].includes(path.dash)), 'scenario paths must all remain solid').toEqual([]);

    expect(chart.points, '11 scenarios at five observed horizons should paint 55 points').toHaveLength(55);
    expect(new Set(chart.points.map(point => point.key)).size, 'a scenario/horizon point is duplicated or missing').toBe(55);
    expect(chart.points.filter(point => point.fill !== point.expected), 'an observation is hollow or has the wrong fill').toEqual([]);
    expect(chart.points.filter(point => !(point.radius > 0 && point.radius <= 3.5)), 'observation dots should be small, filled circles').toEqual([]);
  });

  test('the hover or tap overlay carries the existing extinction symbols for states 1–5 only', async ({ page }) => {
    await settle(page);
    const hit = page.locator('#horizon-chart-svg .horizon-chart-hit');
    await hit.scrollIntoViewIfNeeded();
    const usesTouch = await page.evaluate(() => navigator.maxTouchPoints > 0);
    if (usesTouch) await hit.tap({ position: { x: 8, y: 8 } });
    else await hit.hover({ position: { x: 8, y: 8 } });

    const tooltip = page.locator('#horizon-chart-tooltip');
    await expect(tooltip).toBeVisible();
    const rows = await tooltip.locator('.horizon-chart-tooltip-row').evaluateAll(elements => elements.map(row => {
      const label = row.querySelector(':scope > span');
      const state = Number(label?.textContent.match(/^\s*(\d+)\./)?.[1]);
      const mark = label?.querySelector('.state-mark');
      const matchingCardMark = document.querySelector(`.state-card[data-state="${state}"] .state-mark[data-mark]`);
      return {
        state,
        mark: mark
          ? ['gone', 'risk'].find(tier => mark.classList.contains(`is-${tier}`)) ?? null
          : null,
        dataMark: mark?.getAttribute('data-mark') ?? null,
        classes: mark ? [...mark.classList].sort() : [],
        hasHazardShape: Boolean(mark?.querySelector('svg path')),
        glyphPoints: mark ? [...mark.textContent].map(character => character.codePointAt(0).toString(16)) : [],
        sameBodyAsExistingMark: mark && matchingCardMark ? mark.innerHTML === matchingCardMark.innerHTML : null
      };
    }));

    expect(rows, 'the overlay should list every scenario').toHaveLength(11);
    expect(rows.map(row => row.state).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    for (const row of rows) {
      if (row.state <= 3) {
        expect(row.mark, `state ${row.state} lost its gone marker`).toBe('gone');
        expect(row.dataMark, `state ${row.state}'s compact overlay marker should not expose tooltip behavior`).toBeNull();
        expect(row.classes, `state ${row.state} no longer uses the existing skull glyph class`).toContain('is-glyph');
        expect(row.glyphPoints, `state ${row.state}'s skull must include the text-presentation selector`).toEqual(['2620', 'fe0e']);
        expect(row.hasHazardShape, `state ${row.state} should use the skull, not the hazard shape`).toBe(false);
        expect(row.sameBodyAsExistingMark, `state ${row.state} does not reuse the site's existing gone symbol`).toBe(true);
      } else if (row.state <= 5) {
        expect(row.mark, `state ${row.state} lost its risk marker`).toBe('risk');
        expect(row.dataMark, `state ${row.state}'s compact overlay marker should not expose tooltip behavior`).toBeNull();
        expect(row.classes, `state ${row.state} no longer uses the existing risk marker class`).not.toContain('is-glyph');
        expect(row.hasHazardShape, `state ${row.state} should use the hazard shape`).toBe(true);
        expect(row.sameBodyAsExistingMark, `state ${row.state} does not reuse the site's existing risk symbol`).toBe(true);
      } else {
        expect(row.mark, `state ${row.state} should not carry an extinction marker`).toBeNull();
      }
    }
  });

  test('curves land on every observation without inventing extrema between them', async ({ page }) => {
    await settle(page);
    const issues = await page.evaluate(() => window.MF_TEST.horizonChartData().series.flatMap(series => {
      const observed = series.points.map(point => point.value);
      const low = Math.min(...observed);
      const high = Math.max(...observed);
      const outside = series.curve.filter(point => point.value < low - 1e-9 || point.value > high + 1e-9);
      const missed = series.points.filter(point => !series.curve.some(sample =>
        Math.abs(sample.year - point.year) < 1e-9 && Math.abs(sample.value - point.value) < 1e-9
      ));
      return [
        ...outside.map(point => `${series.name} leaves its observed range at ${point.year}: ${point.value}`),
        ...missed.map(point => `${series.name} misses ${point.year}: ${point.value}`)
      ];
    }));
    expect(issues).toEqual([]);
  });

  test('the primary horizon toggle moves one dotted guide and bolds the matching year', async ({ page }) => {
    await settle(page);
    const group = page.getByRole('group', { name: 'Forecast horizon' });
    const selectedChartState = () => page.evaluate(() => {
      const guides = [...document.querySelectorAll('line.horizon-chart-guide[data-horizon]')];
      const ticks = [...document.querySelectorAll('text.horizon-chart-tick[data-horizon]')];
      const selected = ticks.filter(tick => tick.classList.contains('is-selected'));
      const guide = guides[0];
      const tick = selected[0];
      const guideStyle = guide ? getComputedStyle(guide) : null;
      // Chromium serializes this as "1px, 5px" while WebKit may return
      // "1px 5px". Read the numeric pattern instead of matching either
      // engine's punctuation.
      const guideDash = guideStyle?.strokeDasharray.match(/-?(?:\d+\.?\d*|\.\d+)/g)?.map(Number) || [];
      return {
        guides: guides.length,
        guideHorizon: guide?.dataset.horizon,
        guideDash,
        guideStrokeWidth: guideStyle ? parseFloat(guideStyle.strokeWidth) : null,
        guideLineCap: guideStyle?.strokeLinecap,
        guideVertical: guide ? Math.abs(parseFloat(guide.getAttribute('x1')) - parseFloat(guide.getAttribute('x2'))) < 0.01 : false,
        selectedTicks: selected.length,
        tickHorizon: tick?.dataset.horizon,
        tickText: tick?.textContent.trim(),
        tickWeight: tick ? getComputedStyle(tick).fontWeight : null,
        aligned: guide && tick
          ? Math.abs(parseFloat(guide.getAttribute('x1')) - parseFloat(tick.getAttribute('x'))) < 0.01
          : false
      };
    });
    const assertSelection = async (horizon, label) => {
      const selected = await selectedChartState();
      expect(selected.guides, 'the chart should have exactly one selected-horizon guide').toBe(1);
      expect(selected.guideHorizon).toBe(horizon);
      expect(selected.guideDash.length, 'the selected-horizon guide should use a repeating dot pattern').toBeGreaterThanOrEqual(2);
      expect(selected.guideDash[0], 'each guide mark should be no longer than its stroke is wide').toBeLessThanOrEqual(selected.guideStrokeWidth);
      expect(selected.guideDash[1], 'the space between guide dots should exceed each dot mark').toBeGreaterThan(selected.guideDash[0]);
      expect(selected.guideLineCap, 'short guide marks need round caps to paint as dots').toBe('round');
      expect(selected.guideVertical, 'the selected-horizon guide should be vertical').toBe(true);
      expect(selected.selectedTicks, 'exactly one x-axis label should be selected').toBe(1);
      expect(selected.tickHorizon).toBe(horizon);
      expect(selected.tickText).toBe(horizon === 'long-term' ? '3000' : label);
      expect(parseInt(selected.tickWeight, 10), 'the selected year is not bold').toBeGreaterThanOrEqual(700);
      expect(selected.aligned, 'the guide is not aligned with the selected year').toBe(true);
    };

    await assertSelection('long-term', 'Long term');
    for (const [label, horizon] of horizons) {
      await group.getByRole('button', { name: label, exact: true }).click();
      await expect(page.locator(`.horizon-button[data-horizon="${horizon}"]`)).toHaveAttribute('aria-pressed', 'true');
      await nextPaint(page);
      await assertSelection(horizon, label);
    }
  });

  test('switching horizons leaves the chart dimensions and viewport position unchanged', async ({ page, browserName }) => {
    await settleWithHorizons(page);
    const viewportTolerance = viewportToleranceFor(browserName);
    const group = page.getByRole('group', { name: 'Forecast horizon' });
    await parkViewportAnchor(page, '.horizon-chart-plot', 'center');
    const initial = await page.locator('#horizon-chart').evaluate(chart => {
      const plot = chart.querySelector('.horizon-chart-plot').getBoundingClientRect();
      const svg = chart.querySelector('#horizon-chart-svg').getBoundingClientRect();
      return { width: chart.getBoundingClientRect().width, height: chart.getBoundingClientRect().height,
               plotTop: plot.top, plotWidth: plot.width, plotHeight: plot.height,
               svgWidth: svg.width, svgHeight: svg.height };
    });

    for (const [label, horizon] of horizons) {
      const beforeTop = await page.locator('.horizon-chart-plot').evaluate(plot => plot.getBoundingClientRect().top);
      await group.getByRole('button', { name: label, exact: true }).click();
      await expect(page.locator(`line.horizon-chart-guide[data-horizon="${horizon}"]`)).toHaveCount(1);
      await nextPaint(page);
      const after = await page.locator('#horizon-chart').evaluate(chart => {
        const plot = chart.querySelector('.horizon-chart-plot').getBoundingClientRect();
        const svg = chart.querySelector('#horizon-chart-svg').getBoundingClientRect();
        return { width: chart.getBoundingClientRect().width, height: chart.getBoundingClientRect().height,
                 plotTop: plot.top, plotWidth: plot.width, plotHeight: plot.height,
                 svgWidth: svg.width, svgHeight: svg.height };
      });
      expect(Math.abs(after.plotTop - beforeTop), `the chart moved in the viewport while switching to ${label}`).toBeLessThanOrEqual(viewportTolerance);
      for (const dimension of ['width', 'height', 'plotWidth', 'plotHeight', 'svgWidth', 'svgHeight']) {
        expect(Math.abs(after[dimension] - initial[dimension]), `${dimension} changed while switching to ${label}`).toBeLessThanOrEqual(viewportTolerance);
      }
    }
  });

  test('the selected middle-year label remains visible and bold on mobile without page overflow', async ({ page }) => {
    test.skip((page.viewportSize()?.width || 999) > 390, 'mobile layout check');
    await settle(page);
    const group = page.getByRole('group', { name: 'Forecast horizon' });

    for (const horizon of ['2040', '2050']) {
      await group.getByRole('button', { name: horizon, exact: true }).click();
      await nextPaint(page);
      const layout = await page.locator(`text.horizon-chart-tick[data-horizon="${horizon}"]`).evaluate(tick => {
        const rect = tick.getBoundingClientRect();
        const svg = tick.ownerSVGElement.getBoundingClientRect();
        const style = getComputedStyle(tick);
        return {
          selected: tick.classList.contains('is-selected'),
          weight: parseInt(style.fontWeight, 10),
          visible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0,
          inside: rect.left >= svg.left - 0.5 && rect.right <= svg.right + 0.5 && rect.top >= svg.top - 0.5 && rect.bottom <= svg.bottom + 0.5,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });
      expect(layout.selected, `${horizon} did not become the selected axis label`).toBe(true);
      expect(layout.weight, `${horizon} is not bold`).toBeGreaterThanOrEqual(700);
      expect(layout.visible, `${horizon} disappeared at mobile width`).toBe(true);
      expect(layout.inside, `${horizon} is clipped outside the SVG`).toBe(true);
      expect(layout.overflow, 'the horizon chart makes the mobile page scroll sideways').toBeLessThanOrEqual(0);
    }
  });

  test('the SVG is named and described, with an accessible hidden table for all observations', async ({ page }) => {
    await settle(page);
    const accessibility = await page.evaluate(() => {
      const svg = document.querySelector('#horizon-chart-svg');
      const labelledBy = (svg.getAttribute('aria-labelledby') || '').trim().split(/\s+/).filter(Boolean);
      const labelledElements = labelledBy.map(id => document.getElementById(id));
      const root = document.querySelector('#horizon-chart-table');
      const table = root?.matches('table') ? root : root?.querySelector('table');
      const style = root ? getComputedStyle(root) : null;
      return {
        role: svg.getAttribute('role'),
        labels: labelledElements.map(element => ({ tag: element?.tagName.toLowerCase(), text: element?.textContent.trim() })),
        labelsInsideSvg: labelledElements.every(element => element && svg.contains(element)),
        tableExists: Boolean(table),
        tableCaption: table?.querySelector('caption')?.textContent.trim(),
        columnHeaders: [...(table?.querySelectorAll('thead th') || [])].map(cell => cell.textContent.trim()),
        rows: table?.querySelectorAll('tbody tr').length || 0,
        values: table?.querySelectorAll('tbody td').length || 0,
        tableHiddenVisually: Boolean(root && style && style.position === 'absolute'
          && parseFloat(style.width) <= 1 && parseFloat(style.height) <= 1 && style.overflow === 'hidden'),
        tableHiddenFromAT: root?.hidden || root?.getAttribute('aria-hidden') === 'true'
      };
    });

    expect(accessibility.role).toBe('img');
    expect(accessibility.labelsInsideSvg, 'the SVG title and description should be contained in the SVG').toBe(true);
    expect(accessibility.labels).toHaveLength(2);
    expect(accessibility.labels.map(label => label.tag)).toEqual(['title', 'desc']);
    expect(accessibility.labels.filter(label => !label.text), 'the SVG title or description is empty').toEqual([]);
    expect(accessibility.tableExists, 'the chart has no semantic data table').toBe(true);
    expect(accessibility.tableCaption, 'the hidden data table has no caption').toBeTruthy();
    expect(accessibility.columnHeaders.length, 'the table needs a scenario column plus five horizon columns').toBe(6);
    expect(accessibility.rows, 'the table needs one row for every scenario').toBe(11);
    expect(accessibility.values, 'the table needs all 55 plotted observations').toBe(55);
    expect(accessibility.tableHiddenVisually, 'the table should be visually hidden, not painted under the chart').toBe(true);
    expect(accessibility.tableHiddenFromAT, 'the data table must remain available to assistive technology').toBe(false);
  });
});
