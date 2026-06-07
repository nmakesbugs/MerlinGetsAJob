const { test, expect } = require('@playwright/test');

// ── helpers (deterministic: debug hooks + stable selectors) ──
async function enterStage5(page) {
  await page.goto('/');
  await page.evaluate(() => window.__merlinGame.goToStage('stage5-birddog'));
  await page.waitForFunction(() => window.__merlinGame.state.currentStage === 'stage5-birddog');
}
const drain = (page) => page.evaluate(() => window.__merlinGame.debug.drainDialogue());
const s5 = (page) => page.evaluate(() => window.__merlinGame.debug.stage5GetState());
const flags = (page) => page.evaluate(() => window.__merlinGame.state.flags);
const stage = (page) => page.evaluate(() => window.__merlinGame.state.currentStage);

async function enterAndScent(page) {
  await enterStage5(page);
  await drain(page);                                   // advance intro → first find (scent phase)
  await page.waitForFunction(() => { const s = window.__merlinGame.scene; return s && s.phase === 'scent'; });
}
async function toPoint(page) {
  for (let i = 0; i < 12; i++) {
    if ((await s5(page)).phase === 'point') return;
    await page.evaluate(() => window.__merlinGame.debug.stage5AdvanceScent());
  }
}

// ═══════════════════════════════════════════════════════════
// 1 & 2. Real content (not placeholder) + direct entry.
// ═══════════════════════════════════════════════════════════
test('Stage 5 is real content, not the placeholder', async ({ page }) => {
  await enterStage5(page);
  await expect(page.locator('#stage5-layer')).toBeVisible();
  await expect(page.locator('#stage-view')).toBeHidden();
});
test('Stage 5 enters via goToStage', async ({ page }) => {
  await enterStage5(page);
  expect(await stage(page)).toBe('stage5-birddog');
  expect((await flags(page)).stage5Started).toBe(true);
  expect(await page.evaluate(() => window.__merlinGame.state.aesthetic)).toBe('chinook');
});

// ═══════════════════════════════════════════════════════════
// 3. Chinook guides the intro; Merlin/field render to canvas.
// ═══════════════════════════════════════════════════════════
test('intro renders and Merlin draws to canvas', async ({ page }) => {
  await enterStage5(page);
  await expect(page.locator('#dlg-speaker')).toContainText('Chinook');
  const hasMerlinInk = await page.evaluate(() => {
    window.__merlinGame.scene.render();
    const d = document.getElementById('game-canvas').getContext('2d').getImageData(120, 430, 100, 90).data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] < 50 && d[i + 1] < 50 && d[i + 2] < 50 && d[i + 3] > 200) return true;  // Merlin's black coat
    }
    return false;
  });
  expect(hasMerlinInk).toBe(true);
});

// ═══════════════════════════════════════════════════════════
// 4 & 5. Scent strength appears; advancing it leads to the point/hold phase.
// ═══════════════════════════════════════════════════════════
test('scent strength rises and leads to the point phase', async ({ page }) => {
  await enterAndScent(page);
  expect((await s5(page)).scentStrength).toBe(0);
  await page.evaluate(() => window.__merlinGame.debug.stage5AdvanceScent());
  expect((await s5(page)).scentStrength).toBeGreaterThan(0);
  await toPoint(page);
  expect((await s5(page)).phase).toBe('point');
});

// ═══════════════════════════════════════════════════════════
// 6 & 7. Point completes via the hold action; flush is locked until the cue.
// ═══════════════════════════════════════════════════════════
test('point completes via hold, and flush is locked before the cue', async ({ page }) => {
  await enterAndScent(page);
  await toPoint(page);
  await page.evaluate(() => window.__merlinGame.debug.stage5CompletePointHold());
  const st = await s5(page);
  expect(st.phase).toBe('cue');
  expect(st.cueReady).toBe(false);
  expect(st.flushAvailable).toBe(false);
  await expect(page.locator('#s5-flush-btn')).toBeDisabled();
  expect(await page.evaluate(() => window.__merlinGame.debug.stage5FlushOnCue())).toBe(false);  // cannot flush yet
});

// ═══════════════════════════════════════════════════════════
// 8. After the cue, gentle flush sends the bird free and completes the find.
// ═══════════════════════════════════════════════════════════
test('flush after the cue sends the bird free', async ({ page }) => {
  await enterAndScent(page);
  await toPoint(page);
  await page.evaluate(() => window.__merlinGame.debug.stage5CompletePointHold());
  await drain(page);                                   // deliver the handler's "Easy… now" cue
  expect((await s5(page)).cueReady).toBe(true);
  expect(await page.evaluate(() => window.__merlinGame.debug.stage5FlushOnCue())).toBe(true);
  expect((await s5(page)).lastFlush).toBe('fly-free');
  expect((await flags(page)).stage5Find1Complete).toBe(true);
});

// ═══════════════════════════════════════════════════════════
// 9. Fatigue rises across finds.
// ═══════════════════════════════════════════════════════════
test('fatigue rises across finds', async ({ page }) => {
  await enterStage5(page);
  await drain(page);
  const f1 = await page.evaluate(() => window.__merlinGame.debug.stage5AutoPlayFind());
  const f2 = await page.evaluate(() => window.__merlinGame.debug.stage5AutoPlayFind());
  expect(f2).toBeGreaterThan(f1);
});

// ═══════════════════════════════════════════════════════════
// 10–13. Assist auto-play completes every find → Stage 6 (no dead-end).
// ═══════════════════════════════════════════════════════════
test('auto-play completes Stage 5 and hands off to Stage 6', async ({ page }) => {
  await enterStage5(page);
  await page.evaluate(() => window.__merlinGame.debug.stage5AutoPlayStage());

  const f = await flags(page);
  expect(f.stage5Find1Complete).toBe(true);
  expect(f.stage5Find2Complete).toBe(true);
  expect(f.stage5Find3Complete).toBe(true);
  expect(f.stage5Complete).toBe(true);
  expect(await stage(page)).toBe('stage6-hades');
});

// ═══════════════════════════════════════════════════════════
// 14. Guardrails: scent/point/steady/flush framing, birds fly free, no harm.
// ═══════════════════════════════════════════════════════════
test('Stage 5 content is family-safe (no shooting / no catching)', async ({ page }) => {
  await enterStage5(page);
  const text = await page.evaluate(() => window.__merlinGame.debug.stage5AllText().toLowerCase());
  for (const bad of ['blood', 'gore', 'death', 'kill', 'gun', 'weapon', 'shoot', 'catch', 'hunt']) {
    expect(text, `should not contain "${bad}"`).not.toContain(bad);
  }
  expect(text).toContain('scent');
  expect(text).toContain('flush');
  expect(text).toContain('free');          // the bird flies free
  expect(text).toContain('not my job');    // 0.9.1 thesis line
});

// ═══════════════════════════════════════════════════════════
// 0.8 Gameplay pass — stars, medals, Challenge difference.
// ═══════════════════════════════════════════════════════════
const starOf5 = (page, id) => page.evaluate((s) => window.__merlinGame.state.stars[s], id);
const medalsOf5 = (page) => page.evaluate(() => window.__merlinGame.state.medals);

test('clean holds earn 3 stars and the Steady Boy medal', async ({ page }) => {
  await enterStage5(page);
  await page.evaluate(() => window.__merlinGame.debug.stage5AutoPlayStage());
  expect(await starOf5(page, 'stage5-birddog')).toBe(3);
  expect((await medalsOf5(page))['steady-boy']).toBe(true);
});

test('a hold reset lowers stars and skips Steady Boy', async ({ page }) => {
  await enterAndScent(page);
  await toPoint(page);
  await page.evaluate(() => window.__merlinGame.debug.stage5ForceHoldReset());
  await page.evaluate(() => window.__merlinGame.debug.stage5AutoPlayStage());
  expect(await starOf5(page, 'stage5-birddog')).toBeLessThan(3);
  expect(Boolean((await medalsOf5(page))['steady-boy'])).toBe(false);
});

// ═══════════════════════════════════════════════════════════
// 0.82 — center-screen gentle-flush timing.
// ═══════════════════════════════════════════════════════════
async function toFlushTiming(page) {
  await enterAndScent(page);
  await toPoint(page);
  await page.evaluate(() => window.__merlinGame.debug.stage5CompletePointHold());
  await drain(page);                                   // deliver the cue → timing begins
  await page.waitForFunction(() => { const s = window.__merlinGame.scene; return s && s.phase === 'flushTiming'; });
}

test('after the cue, the flush timing widget appears', async ({ page }) => {
  await toFlushTiming(page);
  const st = await s5(page);
  expect(st.flushTimingActive).toBe(true);
  expect(st.flushSweetEnd).toBeGreaterThan(st.flushSweetStart);
  await expect(page.locator('#s5-timing')).toBeVisible();
  await expect(page.locator('#s5-flush-btn')).toBeEnabled();
});

test('flushing in the sweet spot is a perfect gentle flush', async ({ page }) => {
  await toFlushTiming(page);
  await page.evaluate(() => { const s = window.__merlinGame.scene; window.__merlinGame.debug.stage5FlushAt((s.flushSweetStart + s.flushSweetEnd) / 2); });
  const st = await s5(page);
  expect(st.lastFlushQuality).toBe('perfect');
  expect(st.lastFlush).toBe('fly-free');                 // bird flies free
  expect(st.flushMistakes).toBe(0);
  expect((await flags(page)).stage5Find1Complete).toBe(true);
});

test('flushing outside the sweet spot still sends the bird free (gentle, no fail)', async ({ page }) => {
  await toFlushTiming(page);
  await page.evaluate(() => window.__merlinGame.debug.stage5FlushAt(2));   // well before the sweet spot
  const st = await s5(page);
  expect(st.lastFlushQuality).toBe('gentle');
  expect(st.lastFlush).toBe('fly-free');                 // still flies free
  expect(st.flushMistakes).toBe(1);
  expect((await flags(page)).stage5Find1Complete).toBe(true);
  expect(await stage(page)).toBe('stage5-birddog');      // progresses, no dead-end
});
