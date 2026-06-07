const { test, expect } = require('@playwright/test');

// ── helpers (deterministic: drive via debug hooks + stable button clicks) ──
async function enterStage2(page) {
  await page.goto('/');
  await page.evaluate(() => window.__merlinGame.goToStage('stage2-academy'));
  await page.waitForFunction(() => window.__merlinGame.state.currentStage === 'stage2-academy');
}
const drain = (page) => page.evaluate(() => window.__merlinGame.debug.drainDialogue());
const drill = (page) => page.evaluate(() => window.__merlinGame.debug.stage2GetDrill());
const flags = (page) => page.evaluate(() => window.__merlinGame.state.flags);
const stage = (page) => page.evaluate(() => window.__merlinGame.state.currentStage);

// Step through the entire stage one line/drill at a time, collecting dialogue text.
async function collectStageText(page) {
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const t = await page.evaluate(() => document.getElementById('dlg-text').textContent);
    if (t) seen.add(t);
    if ((await stage(page)) !== 'stage2-academy') break;
    const advanced = await page.evaluate(() => window.__merlinGame.debug.advanceDialogue());
    if (!advanced) await page.evaluate(() => window.__merlinGame.debug.stage2AutoPlayDrill());
  }
  return Array.from(seen).join('\n').toLowerCase();
}

// ═══════════════════════════════════════════════════════════
// 1. Stage 2 is the real scene, not the Milestone 0 placeholder.
// ═══════════════════════════════════════════════════════════
test('Stage 2 is real content, not the placeholder', async ({ page }) => {
  await enterStage2(page);
  await expect(page.locator('#stage2-layer')).toBeVisible();
  await expect(page.locator('#stage-view')).toBeHidden();
});

// ═══════════════════════════════════════════════════════════
// 2. Stage 2 can be entered directly via goToStage.
// ═══════════════════════════════════════════════════════════
test('Stage 2 enters via goToStage', async ({ page }) => {
  await enterStage2(page);
  expect(await stage(page)).toBe('stage2-academy');
  expect((await flags(page)).stage2Started).toBe(true);
  expect(await page.evaluate(() => window.__merlinGame.state.aesthetic)).toBe('ila');
});

// ═══════════════════════════════════════════════════════════
// 3 & 4. Ila academy intro renders and Ila is present/identified.
// ═══════════════════════════════════════════════════════════
test('Ila intro renders and Ila is identified', async ({ page }) => {
  await enterStage2(page);
  await expect(page.locator('#dialogue-box')).toBeVisible();
  await expect(page.locator('#dlg-speaker')).toContainText('Ila');
  expect((await drill(page)).mentor).toBe('ila');
});

// ═══════════════════════════════════════════════════════════
// 5. Tracking drill completes (tap pawprints in order) and sets its flag.
// ═══════════════════════════════════════════════════════════
test('tracking drill completes and sets its flag', async ({ page }) => {
  await enterStage2(page);
  await drain(page);                                  // advance intro → reveal scent dots
  expect((await drill(page)).drill).toBe('tracking');
  await expect(page.locator('.s2-dot')).toHaveCount(6);
  for (let i = 0; i < 6; i++) {
    await page.locator(`.s2-dot[data-idx="${i}"]`).click();
  }
  expect((await flags(page)).stage2TrackingComplete).toBe(true);
});

// ═══════════════════════════════════════════════════════════
// 6. Obedience drill completes (tap the called command) and sets its flag.
// ═══════════════════════════════════════════════════════════
test('obedience drill completes and sets its flag', async ({ page }) => {
  await enterStage2(page);
  await drain(page);
  await page.evaluate(() => window.__merlinGame.debug.stage2AutoPlayDrill()); // finish tracking
  await drain(page);                                  // advance to obedience buttons
  expect((await drill(page)).drill).toBe('obedience');
  for (let i = 0; i < 4; i++) {
    const expected = (await drill(page)).expected;
    await page.locator(`.s2-cmd[data-cmd="${expected}"]`).click();
  }
  expect((await flags(page)).stage2ObedienceComplete).toBe(true);
});

// ═══════════════════════════════════════════════════════════
// 7. Control drill rewards RELEASE on "Out!".
// ═══════════════════════════════════════════════════════════
test('control drill rewards release on Out', async ({ page }) => {
  await enterStage2(page);
  await drain(page);
  await page.evaluate(() => window.__merlinGame.debug.stage2AutoPlayDrill()); // tracking
  await drain(page);
  await page.evaluate(() => window.__merlinGame.debug.stage2AutoPlayDrill()); // obedience
  await drain(page);                                  // advance to control prompt
  const ds = await drill(page);
  expect(ds.drill).toBe('control');
  expect(ds.outCalled).toBe(true);
  await page.locator('.s2-ctrl-btn.release').click();
  expect((await flags(page)).stage2ControlComplete).toBe(true);
});

// ═══════════════════════════════════════════════════════════
// 8. Holding past "Out!" gives a comedy redo, NOT completion.
// ═══════════════════════════════════════════════════════════
test('holding past Out gives a redo, not completion', async ({ page }) => {
  await enterStage2(page);
  await drain(page);
  await page.evaluate(() => window.__merlinGame.debug.stage2AutoPlayDrill());
  await drain(page);
  await page.evaluate(() => window.__merlinGame.debug.stage2AutoPlayDrill());
  await drain(page);
  await page.locator('.s2-ctrl-btn.hold').click();
  await expect(page.locator('#dlg-text')).toContainText('worked so hard');
  expect(Boolean((await flags(page)).stage2ControlComplete)).toBe(false);
});

// ═══════════════════════════════════════════════════════════
// 9, 10 & 11. Full Assist auto-play completes Stage 2 and reaches Stage 3 (no dead-end).
// ═══════════════════════════════════════════════════════════
test('Assist auto-play completes Stage 2 and hands off to Stage 3', async ({ page }) => {
  await enterStage2(page);
  expect(await page.evaluate(() => window.__merlinGame.state.assistMode)).toBe(true);

  for (let i = 0; i < 40; i++) {
    if ((await stage(page)) === 'stage3-fight') break;
    const advanced = await page.evaluate(() => window.__merlinGame.debug.advanceDialogue());
    if (!advanced) await page.evaluate(() => window.__merlinGame.debug.stage2AutoPlayDrill());
  }

  const f = await flags(page);
  expect(f.stage2TrackingComplete).toBe(true);
  expect(f.stage2ObedienceComplete).toBe(true);
  expect(f.stage2ControlComplete).toBe(true);
  expect(f.stage2Complete).toBe(true);
  expect(await stage(page)).toBe('stage3-fight');
});

// ═══════════════════════════════════════════════════════════
// 12. Guardrails: respectful, family-safe content (no gore / no aggression framing).
// ═══════════════════════════════════════════════════════════
test('Stage 2 content is family-safe and control-focused', async ({ page }) => {
  await enterStage2(page);
  const text = await collectStageText(page);
  for (const bad of ['kill', 'death', 'blood', 'gore', 'gun', 'attack', 'vicious', 'savage']) {
    expect(text, `should not contain "${bad}"`).not.toContain(bad);
  }
  // The drill is framed as release/control, not aggression.
  expect(text).toContain('out');       // "Out!" release cue
  expect(text).toContain('control');
});
