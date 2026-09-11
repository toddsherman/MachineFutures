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
    const top = window.MF_TEST?.stateMedians().slice().sort((a, b) => b.probability - a.probability)[0];
    const name = document.querySelector('.leader-name');
    const figure = document.querySelector('.end-leader strong');
    return top && name?.textContent === top.name && figure?.textContent === `${top.probability}%`
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
        .map(el => `${el.tagName}.${(el.className || '').toString().split(' ')[0]} "${el.innerText.replace(/\s+/g, ' ').trim().slice(0, 30)}"`);
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
    // same content remains visually stationary; Chromium stays within one.
    const viewportTolerance = browserName === 'webkit' ? 2 : 1;
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
    const viewportTolerance = browserName === 'webkit' ? 2 : 1;
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
      ['exposure boundary', '.method-hero', 'near-top']
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
    const viewportTolerance = browserName === 'webkit' ? 2 : 1;
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
    const viewportTolerance = browserName === 'webkit' ? 2 : 1;
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
    await expect(group.getByRole('button')).toHaveText(['Long term', '2030', '2040', '2050', '2060']);
    await expect(group.getByRole('button', { name: 'Long term' })).toHaveAttribute('aria-pressed', 'true');
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
      title: '2030 MEDIAN MACHINE FORECAST',
      note: 'Snapshot at the end of 2030; it need not yet be durable.',
      leader: 'The Held Leash', leaderValue: '45%',
      leaderUnit: 'Median across 2 models · 2030 · of 100 points',
      timelineLast: 'The Held Leash', card: '45%', matrix: ['45', '45'],
      cardDescription: snapshotHeldLeashDescription,
      leaderDescription: snapshotHeldLeashDescription,
      exposure: ['15%', '15%'], matrixLabel: '2030 probability by structural state and model',
      barLabel: 'Median probability by structural state for 2030',
      summary: 'We asked 2 of the leading AI models from 2 labs to assign 100 percentage points across 11 mutually exclusive structural states for humanity’s relationship with AI.',
      exposureHint: 'Hover a bar for the states inside it',
      prompt: '/end_states_2030.md', pressed: '2030'
    });

    await page.locator('.state-card[data-state="9"]').click();
    await expect(page.locator('#dialog-content .dialog-kicker')).toContainText('Humanity remains in control · 2030');
    await expect(page.locator('#dialog-content .dialog-description')).toHaveText(snapshotHeldLeashDescription);
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
      card: '28%', heldLeashDescription: snapshotHeldLeashDescription,
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
      title: '2050 MEDIAN MACHINE FORECAST',
      note: 'Snapshot at the end of 2050; it need not yet be durable.',
      leader: 'The Preserve', leaderValue: '30%',
      leaderUnit: 'Median across 3 models · 2050 · of 100 points',
      card: '30%', cardDescription: snapshotPreserveDescription,
      matrix: ['30', '30', '30'], exposure: ['37%', '37%', '37%'],
      matrixLabel: '2050 probability by structural state and model',
      barLabel: 'Median probability by structural state for 2050',
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
      title: '2060 MEDIAN MACHINE FORECAST',
      note: 'Snapshot at the end of 2060; it need not yet be durable.',
      leader: 'The Merger', leaderValue: '20%',
      leaderUnit: 'Median across 3 models · 2060 · of 100 points',
      card: '20%', cardDescription: snapshotMergerDescription,
      matrix: ['20', '20', '20'], exposure: ['45%', '45%', '45%'],
      matrixLabel: '2060 probability by structural state and model',
      barLabel: 'Median probability by structural state for 2060',
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

  test('the URL shares both selectors and an unavailable model resets to Median', async ({ page }) => {
    await settleWithHorizons(page, '/?utm_source=fixture&model=beta');
    await expect(page.locator('.end-toggle-button.active')).toHaveAttribute('data-end-forecast', 'beta');

    const horizon = page.getByRole('group', { name: 'Forecast horizon' });
    await horizon.getByRole('button', { name: '2030', exact: true }).click();
    await expect(page.locator('.end-toggle-button.active')).toHaveAttribute('data-end-forecast', 'Median');
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
    await expect(group.getByRole('button')).toHaveText(['Long term', '2030', '2040', '2050']);
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
    expect(placement.buttons.map(button => button.label)).toEqual(['Long term', '2030', '2040', '2050', '2060']);
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
          if (centre < iqr.offsetLeft - 1 || centre > iqr.offsetLeft + iqr.offsetWidth + 1) bad.push(`S${id}: the published figure sits outside its middle half`);
          if (centre < range.offsetLeft - 1 || centre > range.offsetLeft + range.offsetWidth + 1) bad.push(`S${id}: the published figure sits outside its full range`);
          if (range.offsetLeft + range.offsetWidth > axisW + 1) bad.push(`S${id}: the range runs off the axis`);
          const onCard = parseInt(card.querySelector('.state-card-meta strong').textContent, 10);
          const median = window.MF_TEST.stateMedians().find(m => String(m.id) === id).probability;
          if (onCard !== median) bad.push(`S${id}: card says ${onCard}%, the median is ${median}%`);
          if (!/across \d+ models/.test(card.querySelector('.range-text').textContent)) {
            bad.push(`S${id}: the card's caption stopped describing the spread across models`);
          }
        });
        const legend = [...document.querySelectorAll('#consensus-legend > button b')].map(b => parseInt(b.textContent, 10));
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
    // Dates run forward, and the model count never goes backwards.
    const dates = tl.history.map(h => h.date);
    expect([...dates].sort()).toEqual(dates);
    const counts = tl.history.map(h => h.models);
    expect(counts.every((n, i) => i === 0 || n >= counts[i - 1]), 'model count went backwards').toBe(true);
    // A row flagged as a change must actually differ from the row before it.
    tl.history.forEach((h, i) => {
      const differs = i === 0 || tl.history[i - 1].stateId !== h.stateId;
      expect(h.changed, `row ${i} (${h.date}) is flagged ${h.changed} but differs=${differs}`).toBe(differs);
      const state = tl.states.find(candidate => candidate.id === h.stateId);
      expect(tl.rows[i].mark, `row ${i} (${h.date}) has the wrong hazard mark`).toBe(state.extinction ?? null);
      expect(Boolean(tl.rows[i].markLabel), `row ${i} (${h.date}) has an unlabelled hazard mark`).toBe(Boolean(state.extinction));
    });
    expect(tl.rows.filter(r => r.change).length).toBe(tl.history.filter(h => h.changed).length);
  });

  test('the last row agrees with the ending the panel names', async ({ page }) => {
    await settle(page);
    const same = await page.evaluate(() => {
      const history = window.MF_TEST.activeDataset().leaderHistory;
      const latest = history.at(-1);
      const named = window.MF_TEST.stateMedians().slice().sort((a, b) => b.probability - a.probability)[0];
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
      const top = window.MF_TEST.stateMedians().slice().sort((a, b) => b.probability - a.probability)[0];
      const expected = { name: top.name, figure: `${top.probability}%` };
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
    expect(atFirstPaint.figure).toMatch(/^\d+%$/);
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
  test('it steps through every model and returns to the median', async ({ page }) => {
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
                    medianGap: gaps[Math.floor(gaps.length / 2)], ended: active() });
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
    const models = result.visited.filter(k => k !== 'Median');
    expect(models.length, 'the sweep did not visit every model').toBe(result.models);
    expect(new Set(models).size, 'a model was shown twice').toBe(result.models);
    expect(result.medianGap, 'the step should be about half a second').toBeGreaterThan(400);
    expect(result.medianGap).toBeLessThan(700);
    expect(result.ended, 'it should come to rest on the median').toBe('Median');
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
    expect(active, 'the selection moved under reduced motion').toBe('Median');
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
    // Exercises the shipped normalisation, not a copy: the across-model
    // medians do not sum to 100, and handing the remainder out blindly once
    // pushed a figure outside its own band.
    const bad = await page.evaluate(() => {
      const { stateMedians } = window.MF_TEST;
      const runs = Object.values(window.MF_TEST.activeDataset().endStateRuns);
      const out = [];
      for (const state of stateMedians()) {
        const column = runs.map(r => r.probabilities[state.id]).sort((a, b) => a - b);
        const at = f => { const k = (column.length - 1) * f, lo = Math.floor(k), hi = Math.ceil(k); return column[lo] + (column[hi] - column[lo]) * (k - lo); };
        if (state.probability < at(0.25) || state.probability > at(0.75)) {
          out.push(`S${state.id}: ${state.probability}% outside the models' middle half ${at(0.25)}-${at(0.75)}%`);
        }
      }
      const sum = stateMedians().reduce((a, s) => a + s.probability, 0);
      if (sum !== 100) out.push(`the aggregate sums to ${sum}`);
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
