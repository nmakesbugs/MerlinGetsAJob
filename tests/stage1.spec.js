const { test, expect } = require('@playwright/test');

// ── helpers ──
async function waitForStage(page, id) {
  await page.waitForFunction((s) => window.__merlinGame && window.__merlinGame.state.currentStage === s, id, { timeout: 8000 });
}
async function clickDialogue(page) {
  const dlg = page.locator('#dialogue-box');
  if (await dlg.isVisible().catch(() => false)) { await dlg.click(); }
}
// Advance through dialogue (clicking the box) until `predicate` is true.
async function advanceUntil(page, predicate, max = 50) {
  for (let i = 0; i < max; i++) {
    if (await predicate()) return true;
    await clickDialogue(page);
    await page.waitForTimeout(110);
  }
  return predicate();
}
const isVisible = (page, sel) => page.locator(sel).isVisible().catch(() => false);

async function enterStage1(page) {
  await page.goto('/');
  await page.locator('#start-btn').click();
  await waitForStage(page, 'stage1-career-crisis');
}

// ═══════════════════════════════════════════════════════════
// 1. Title dedication reads "For Cyndie".
// ═══════════════════════════════════════════════════════════
test('title shows the dedication For Cyndie', async ({ page }) => {
  await page.goto('/');
  const ded = page.locator('[data-testid="dedication"]');
  await expect(ded).toBeVisible();
  await expect(ded).toContainText('For Cyndie');
  await expect(ded).not.toContainText(/everyone/i);
});

// ═══════════════════════════════════════════════════════════
// 2 & 3. Start enters Stage 1 with real content (not the placeholder).
// ═══════════════════════════════════════════════════════════
test('start enters Stage 1 real content, not the placeholder', async ({ page }) => {
  await enterStage1(page);
  await expect(page.locator('#stage1-layer')).toBeVisible();
  await expect(page.locator('#stage-view')).toBeHidden();          // placeholder not used
  await expect(page.locator('#dialogue-box')).toBeVisible();
  await expect(page.locator('#dlg-speaker')).toContainText('Merlin');
});

// ═══════════════════════════════════════════════════════════
// 4. Dialogue advances on tap/click.
// ═══════════════════════════════════════════════════════════
test('dialogue advances on click', async ({ page }) => {
  await enterStage1(page);
  const txt = page.locator('#dlg-text');
  const first = await txt.textContent();
  await page.locator('#dialogue-box').click();
  await expect(txt).not.toHaveText(first || '');
});

// ═══════════════════════════════════════════════════════════
// 5. Glowing object appears and is tappable.
// ═══════════════════════════════════════════════════════════
test('a glowing object appears and can be tapped', async ({ page }) => {
  await enterStage1(page);
  const reached = await advanceUntil(page, () => isVisible(page, '#glow-bowl'));
  expect(reached).toBe(true);
  await expect(page.locator('#stage1-hint')).toBeVisible();
  await page.locator('#glow-bowl').click();
  await expect(page.locator('#glow-bowl')).toBeHidden();           // consumed on tap
});

// ═══════════════════════════════════════════════════════════
// 6. Mentor montage appears with Ila, Chinook, and Hades.
// ═══════════════════════════════════════════════════════════
test('mentor montage shows Ila, Chinook and Hades', async ({ page }) => {
  await enterStage1(page);
  await advanceUntil(page, () => isVisible(page, '#glow-bowl'));
  await page.locator('#glow-bowl').click();
  const reached = await advanceUntil(page, () => isVisible(page, '#mentor-montage'));
  expect(reached).toBe(true);
  await expect(page.locator('.mentor-card[data-mentor="ila"]')).toContainText('Ila');
  await expect(page.locator('.mentor-card[data-mentor="chinook"]')).toContainText('Chinook');
  await expect(page.locator('.mentor-card[data-mentor="hades"]')).toContainText('Hades');
});

// ═══════════════════════════════════════════════════════════
// 7 & 8. First-job choice appears and records state.choices.firstJob.
// ═══════════════════════════════════════════════════════════
test('first-job choice records state.choices.firstJob', async ({ page }) => {
  await enterStage1(page);
  await advanceUntil(page, () => isVisible(page, '#glow-bowl'));
  await page.locator('#glow-bowl').click();
  const reached = await advanceUntil(page, () => isVisible(page, '#choice-panel'));
  expect(reached).toBe(true);

  const buttons = page.locator('.choice-btn');
  await expect(buttons).toHaveCount(3);

  await page.locator('.choice-btn[data-choice="chinook"]').click();
  const chosen = await page.evaluate(() => window.__merlinGame.state.choices.firstJob);
  expect(chosen).toBe('chinook');
});

// ═══════════════════════════════════════════════════════════
// 9 & 10. Stage 1 completes → stage2-academy; teardown is clean.
// ═══════════════════════════════════════════════════════════
test('Stage 1 completes, hands off to Stage 2, and tears down cleanly', async ({ page }) => {
  await enterStage1(page);
  const exitsBefore = await page.evaluate(() => window.__merlinGame.debug.exitCount);

  await advanceUntil(page, () => isVisible(page, '#glow-bowl'));
  await page.locator('#glow-bowl').click();
  await advanceUntil(page, () => isVisible(page, '#choice-panel'));
  await page.locator('.choice-btn[data-choice="ila"]').click();

  // Finish the closing lines until we land on Stage 2.
  const transitioned = await advanceUntil(
    page, async () => (await page.evaluate(() => window.__merlinGame.state.currentStage)) === 'stage2-academy');
  expect(transitioned).toBe(true);

  // Flag set, completion recorded, Stage 1 DOM torn down, exit() fired.
  expect(await page.evaluate(() => window.__merlinGame.state.flags.stage1Complete)).toBe(true);
  expect(await page.evaluate(() => window.__merlinGame.state.furthestStage)).toBe('stage2-academy');
  await expect(page.locator('#stage1-layer')).toBeHidden();
  expect(await page.evaluate(() => window.__merlinGame.debug.exitCount)).toBeGreaterThan(exitsBefore);
});

// ═══════════════════════════════════════════════════════════
// 11. No duplicate listeners accumulate after replaying Stage 1.
// ═══════════════════════════════════════════════════════════
test('replaying Stage 1 does not leak listeners', async ({ page }) => {
  await enterStage1(page);
  const firstCount = await page.evaluate(() => window.__merlinGame.debug.activeListenerCount());

  // Jump back to title and re-enter Stage 1.
  await page.evaluate(() => window.__merlinGame.goToStage('title'));
  await page.locator('#start-btn').click();
  await waitForStage(page, 'stage1-career-crisis');
  const secondCount = await page.evaluate(() => window.__merlinGame.debug.activeListenerCount());

  expect(secondCount).toBe(firstCount);
});
