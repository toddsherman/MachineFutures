// Layout invariants. Every assertion here corresponds to a defect this site
// actually shipped, so a failure names the thing that broke rather than a
// snapshot diff.
import { test, expect } from '@playwright/test';

const settle = async page => {
  await page.goto('/');
  await page.waitForFunction(() => document.querySelectorAll('.state-card').length === 11);
  // The leader riffles through the endings on load; wait for it to land, or a
  // test reads a passing frame and believes it.
  await page.waitForFunction(() => {
    const top = window.MF_TEST?.stateMedians().slice().sort((a, b) => b.probability - a.probability)[0];
    return top && document.querySelector('.leader-name')?.textContent === top.name;
  });
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.MF_TEST?.stopSweep();
  });
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

test.describe('the charts are actually painted', () => {
  test('every band is visible once its card is on screen', async ({ page }) => {
    await settle(page);
    const cards = page.locator('.state-card');
    const count = await cards.count();
    const invisible = [];
    for (let i = 0; i < count; i++) {
      await cards.nth(i).scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);   // longer than the reveal's own rescue
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

  test('no strip is left waiting for an animation', async ({ page }) => {
    await settle(page);
    await page.waitForTimeout(4500);   // past the long-stop
    const stuck = await page.evaluate(() => [...document.querySelectorAll('.state-strip.will-reveal, .matrix.will-reveal')]
      .map(el => el.className));
    expect(stuck).toEqual([]);
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
      const watch = setInterval(() => {
        const now = active();
        if (now !== last) { seen.push({ at: Math.round(performance.now() - t0), key: now }); last = now; }
        if (performance.now() - t0 > 12000) {
          clearInterval(watch);
          const gaps = seen.slice(1).map((s, i) => s.at - seen[i].at).sort((a, b) => a - b);
          resolve({ visited: seen.map(s => s.key), models: Object.keys(window.MF_DATA.endStateRuns).length,
                    medianGap: gaps[Math.floor(gaps.length / 2)], ended: active() });
        }
      }, 30);
      document.querySelector('.end-consensus').scrollIntoView();
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
