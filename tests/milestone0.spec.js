const { test, expect } = require('@playwright/test');

// ── helpers ──
const STAGE_IDS = [
  'stage1-career-crisis', 'stage2-academy', 'stage3-fight', 'stage4-sniff',
  'stage5-birddog', 'stage6-hades', 'stage7-realjob',
];

async function currentStage(page) {
  return page.evaluate(() => window.__merlinGame.state.currentStage);
}
async function waitForStage(page, id) {
  await page.waitForFunction((s) => window.__merlinGame && window.__merlinGame.state.currentStage === s, id, { timeout: 8000 });
}

// ═══════════════════════════════════════════════════════════
// 1. App boots and the title renders.
// ═══════════════════════════════════════════════════════════
test('app boots with no console errors and shows the title', async ({ page }) => {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));

  await page.goto('/');
  await expect(page.locator('#title-screen')).toBeVisible();
  await expect(page.locator('.ts-title')).toContainText('Merlin');
  await expect(page.locator('.ts-title')).toContainText('Gets a Job');
  await expect(page.locator('#hud-stage')).not.toContainText('title', { ignoreCase: true }); // 0.9.1 no stale HUD label
  expect(errors, errors.join('\n')).toEqual([]);
});

// ═══════════════════════════════════════════════════════════
// 2. Start button reaches Stage 1.
// ═══════════════════════════════════════════════════════════
test('start button enters stage 1', async ({ page }) => {
  await page.goto('/');
  await page.locator('#start-btn').click();
  await waitForStage(page, 'stage1-career-crisis');
  // Stage 1 is a full scene as of Milestone 1 (its content is covered by stage1.spec.js).
  await expect(page.locator('#stage1-layer')).toBeVisible();
});

// ═══════════════════════════════════════════════════════════
// 3 & 4. Every stage scene is reachable; the generic end scene + Play Again still work.
// (All seven stages are now real scenes — no placeholders remain.)
// ═══════════════════════════════════════════════════════════
test('every stage is reachable and the end scene returns to title', async ({ page }) => {
  await page.goto('/');

  // Each registered stage can be entered directly.
  for (const id of STAGE_IDS) {
    await page.evaluate((s) => window.__merlinGame.goToStage(s), id);
    await waitForStage(page, id);
  }

  // The generic end scene renders and Play Again returns to the title.
  await page.evaluate(() => window.__merlinGame.goToStage('__end'));
  await waitForStage(page, '__end');
  await expect(page.locator('#end-screen')).toBeVisible();
  await expect(page.locator('.end-title')).toContainText('The End');

  await page.locator('#end-restart').click();
  await waitForStage(page, 'title');
  await expect(page.locator('#title-screen')).toBeVisible();
});

// ═══════════════════════════════════════════════════════════
// 5. Global game object exposes required state + goToStage + registry.
// ═══════════════════════════════════════════════════════════
test('global __merlinGame matches CONTENT_SCHEMA', async ({ page }) => {
  await page.goto('/');
  const shape = await page.evaluate(() => {
    const g = window.__merlinGame;
    const s = g.state;
    return {
      hasGoTo: typeof g.goToStage === 'function',
      hasScene: 'scene' in g,
      stateKeys: Object.keys(s).sort(),
      stageIds: g.debug.stageIds(),
    };
  });
  expect(shape.hasGoTo).toBe(true);
  expect(shape.hasScene).toBe(true);
  expect(shape.stageIds).toEqual(STAGE_IDS);
  for (const k of ['currentStage', 'furthestStage', 'aesthetic', 'choices', 'stars', 'medals', 'joy', 'rngSeed', 'flags']) {
    expect(shape.stateKeys).toContain(k);
  }
});

// ═══════════════════════════════════════════════════════════
// 6. There is a single default mode — no Assist/Challenge toggle.
// ═══════════════════════════════════════════════════════════
test('there is no Assist/Challenge toggle (single default mode)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#assist-toggle')).toHaveCount(0);
  expect(await page.evaluate(() => 'assistMode' in window.__merlinGame.state)).toBe(false);
  expect(await page.evaluate(() => typeof window.__merlinGame.setAssist)).toBe('undefined');
});

// ═══════════════════════════════════════════════════════════
// 7. Seeded RNG is deterministic for a fixed seed.
// ═══════════════════════════════════════════════════════════
test('seeded RNG is deterministic', async ({ page }) => {
  await page.goto('/');
  const { a, b, c } = await page.evaluate(() => ({
    a: window.__merlinGame.debug.rngSequence(12345, 5),
    b: window.__merlinGame.debug.rngSequence(12345, 5),
    c: window.__merlinGame.debug.rngSequence(99999, 5),
  }));
  expect(a).toEqual(b);          // same seed → same sequence
  expect(a).not.toEqual(c);      // different seed → different sequence
  a.forEach(v => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); });
});

// ═══════════════════════════════════════════════════════════
// 8. Scene transitions call exit() and do not accumulate listeners.
// ═══════════════════════════════════════════════════════════
test('scene teardown runs and listeners do not accumulate', async ({ page }) => {
  await page.goto('/');
  // Re-enter the same placeholder scene (Stage 7) twice; a clean exit() means the live
  // listener count returns to the identical baseline (no accumulation).
  await page.evaluate(() => window.__merlinGame.goToStage('stage7-realjob'));
  await waitForStage(page, 'stage7-realjob');
  const firstCount = await page.evaluate(() => window.__merlinGame.debug.activeListenerCount());
  const exitsBefore = await page.evaluate(() => window.__merlinGame.debug.exitCount);

  await page.evaluate(() => window.__merlinGame.goToStage('title'));
  await waitForStage(page, 'title');
  await page.evaluate(() => window.__merlinGame.goToStage('stage7-realjob'));
  await waitForStage(page, 'stage7-realjob');
  const secondCount = await page.evaluate(() => window.__merlinGame.debug.activeListenerCount());
  const exitsAfter = await page.evaluate(() => window.__merlinGame.debug.exitCount);

  // Same scene re-entered → identical live-listener count (no leak).
  expect(secondCount).toBe(firstCount);
  // exit() fired for each transition.
  expect(exitsAfter).toBeGreaterThan(exitsBefore);
});

// ═══════════════════════════════════════════════════════════
// 9. No forbidden content strings appear in loaded game content.
//    (Scans app content objects, NOT this test file's literal text.)
// ═══════════════════════════════════════════════════════════
test('loaded game content has no forbidden strings', async ({ page }) => {
  await page.goto('/');
  const content = await page.evaluate(() => window.__merlinGame.debug.contentStrings().toLowerCase());
  for (const word of ['kill', 'death', 'blood', 'gun', 'gore']) {
    expect(content).not.toContain(word);
  }
});
