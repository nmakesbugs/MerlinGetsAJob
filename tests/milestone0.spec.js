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
// 3 & 4. Walk Stage 1 → 7 via the Continue button, then reach the ending.
// ═══════════════════════════════════════════════════════════
test('walks every placeholder stage in order and reaches the ending', async ({ page }) => {
  await page.goto('/');

  // Stages 1–4 are full scenes (see stage1/2/3/4 specs); jump to the placeholder chain (stages 5–7).
  await page.evaluate(() => window.__merlinGame.goToStage('stage5-birddog'));

  for (let i = 4; i < STAGE_IDS.length; i++) {
    await waitForStage(page, STAGE_IDS[i]);
    await expect(page.locator('#sv-badge')).toContainText('Stage ' + (i + 1));
    if (i < STAGE_IDS.length - 1) await page.locator('#stage-continue').click();
  }

  // From Stage 7, Continue reaches the placeholder ending.
  await page.locator('#stage-continue').click();
  await waitForStage(page, '__end');
  await expect(page.locator('#end-screen')).toBeVisible();
  await expect(page.locator('.end-title')).toContainText('The End');

  // Play Again returns to the title.
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
  for (const k of ['currentStage', 'furthestStage', 'assistMode', 'aesthetic', 'choices', 'stars', 'joy', 'rngSeed', 'flags']) {
    expect(shape.stateKeys).toContain(k);
  }
});

// ═══════════════════════════════════════════════════════════
// 6. Assist defaults to true and the toggle flips it.
// ═══════════════════════════════════════════════════════════
test('assist mode defaults on and toggles', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => window.__merlinGame.state.assistMode)).toBe(true);
  await expect(page.locator('#assist-toggle')).toHaveText('Assist: ON');

  await page.locator('#assist-toggle').click();
  expect(await page.evaluate(() => window.__merlinGame.state.assistMode)).toBe(false);
  await expect(page.locator('#assist-toggle')).toHaveText('Challenge');

  await page.locator('#assist-toggle').click();
  expect(await page.evaluate(() => window.__merlinGame.state.assistMode)).toBe(true);
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
  // Drive the identical placeholder scenes (stages 5–7) to measure listener stability.
  await page.evaluate(() => window.__merlinGame.goToStage('stage5-birddog'));
  await waitForStage(page, 'stage5-birddog');

  const exitsBefore = await page.evaluate(() => window.__merlinGame.debug.exitCount);
  await page.locator('#stage-continue').click();
  await waitForStage(page, 'stage6-hades');
  const atStage6 = await page.evaluate(() => window.__merlinGame.debug.activeListenerCount());

  // Advance the remaining placeholder stages.
  for (const id of ['stage7-realjob']) {
    await page.locator('#stage-continue').click();
    await waitForStage(page, id);
  }
  const atStage7 = await page.evaluate(() => window.__merlinGame.debug.activeListenerCount());
  const exitsAfter = await page.evaluate(() => window.__merlinGame.debug.exitCount);

  // Placeholder scenes are structurally identical → identical live-listener count.
  expect(atStage7).toBe(atStage6);
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
