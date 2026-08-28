// Layout invariants. Every assertion here corresponds to a defect this site
// actually shipped, so a failure names the thing that broke rather than a
// snapshot diff.
import { test, expect } from '@playwright/test';

const settle = async page => {
  await page.goto('/');
  await page.waitForFunction(() => document.querySelectorAll('.state-card').length === 11);
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
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
        .map(el => `${el.tagName}.${(el.className || '').toString().split(' ')[0]}`);
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
          const inLegend = parseInt(document.querySelectorAll('#consensus-legend > button b')[id - 1].textContent, 10);
          if (onCard !== inLegend) bad.push(`S${id}: card says ${onCard}%, legend says ${inLegend}%`);
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
      const key = Object.keys(window.MF_DATA.endStateRuns)[0];
      window.MF_DATA.endStateRuns[key].rationales[3] = '<img src=x onerror="window.__pwned=1"><scr' + 'ipt>window.__pwned=1</scr' + 'ipt>';
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
      const runs = Object.values(window.MF_DATA.endStateRuns);
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
               rowheaders: document.querySelectorAll('.matrix-rowheader[role="rowheader"] button').length };
    });
    expect(a11y.name, 'the dialog has no accessible name').toBeTruthy();
    expect(a11y.markColour, 'the marks should take the surrounding ink').toBe(a11y.bodyColour);
    expect(a11y.rowheaders, 'row headers should wrap a real button').toBe(11);
  });
});
