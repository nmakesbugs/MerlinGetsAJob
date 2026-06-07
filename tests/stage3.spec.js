const { test, expect } = require('@playwright/test');

// ── helpers (deterministic: debug hooks + stable button clicks) ──
async function enterStage3(page) {
  await page.goto('/');
  await page.evaluate(() => window.__merlinGame.goToStage('stage3-fight'));
  await page.waitForFunction(() => window.__merlinGame.state.currentStage === 'stage3-fight');
}
const drain = (page) => page.evaluate(() => window.__merlinGame.debug.drainDialogue());
const s3 = (page) => page.evaluate(() => window.__merlinGame.debug.stage3GetState());
const flags = (page) => page.evaluate(() => window.__merlinGame.state.flags);
const stage = (page) => page.evaluate(() => window.__merlinGame.state.currentStage);

// Enter and advance through the intro so opponent 1 is active.
async function enterAndFight(page) {
  await enterStage3(page);
  await drain(page);
  await page.waitForFunction(() => { const s = window.__merlinGame.scene; return s && s.fighting; });
}

// ═══════════════════════════════════════════════════════════
// 1. Stage 3 is the real scene, not the Milestone 0 placeholder.
// ═══════════════════════════════════════════════════════════
test('Stage 3 is real content, not the placeholder', async ({ page }) => {
  await enterStage3(page);
  await expect(page.locator('#stage3-layer')).toBeVisible();
  await expect(page.locator('#stage-view')).toBeHidden();
});

// ═══════════════════════════════════════════════════════════
// 2. Stage 3 enters directly via goToStage.
// ═══════════════════════════════════════════════════════════
test('Stage 3 enters via goToStage', async ({ page }) => {
  await enterStage3(page);
  expect(await stage(page)).toBe('stage3-fight');
  expect((await flags(page)).stage3Started).toBe(true);
  expect(await page.evaluate(() => window.__merlinGame.state.aesthetic)).toBe('ila');
});

// ═══════════════════════════════════════════════════════════
// 3. Ila and Merlin are present (Ila leads the intro; Merlin's assists + sprites render).
// ═══════════════════════════════════════════════════════════
test('Ila and Merlin are present', async ({ page }) => {
  await enterStage3(page);
  await expect(page.locator('#dlg-speaker')).toContainText('Ila');
  await expect(page.locator('#s3-boof')).toContainText('Boof');   // Merlin's signature assist
  const hasInk = await page.evaluate(() => {
    window.__merlinGame.scene.render();
    const d = document.getElementById('game-canvas').getContext('2d').getImageData(0, 300, 390, 320).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
    return false;
  });
  expect(hasInk).toBe(true);
});

// ═══════════════════════════════════════════════════════════
// 4. Opponent 1 appears with a cartoon name.
// ═══════════════════════════════════════════════════════════
test('opponent 1 appears with a cartoon name', async ({ page }) => {
  await enterAndFight(page);
  expect((await s3(page)).opponentName).toBe('Garbage Goblin');
  await expect(page.locator('#s3-foe-name')).toContainText('Garbage Goblin');
});

// ═══════════════════════════════════════════════════════════
// 5. Boof Bark (real button click) fills Teamwork.
// ═══════════════════════════════════════════════════════════
test('Boof Bark assist fills Teamwork', async ({ page }) => {
  await enterAndFight(page);
  expect((await s3(page)).teamwork).toBe(0);
  await page.locator('#s3-boof').click();
  expect((await s3(page)).teamwork).toBeGreaterThan(0);
});

// ═══════════════════════════════════════════════════════════
// 6 & 7. Tail Trip and Distraction Wiggle each fill Teamwork.
// ═══════════════════════════════════════════════════════════
test('Tail Trip assist fills Teamwork', async ({ page }) => {
  await enterAndFight(page);
  const before = (await s3(page)).teamwork;
  await page.evaluate(() => window.__merlinGame.debug.stage3UseAssist('trip'));
  expect((await s3(page)).teamwork).toBeGreaterThan(before);
});
test('Distraction Wiggle assist fills Teamwork', async ({ page }) => {
  await enterAndFight(page);
  const before = (await s3(page)).teamwork;
  await page.evaluate(() => window.__merlinGame.debug.stage3UseAssist('wiggle'));
  expect((await s3(page)).teamwork).toBeGreaterThan(before);
});

// ═══════════════════════════════════════════════════════════
// 8. Teamwork meter fills and enables the finisher.
// ═══════════════════════════════════════════════════════════
test('Teamwork fills and enables the finisher', async ({ page }) => {
  await enterAndFight(page);
  await page.evaluate(() => window.__merlinGame.debug.stage3FillTeamwork());
  const st = await s3(page);
  expect(st.teamworkFull).toBe(true);
  expect(st.finisherReady).toBe(true);
  await expect(page.locator('#s3-finish')).toBeVisible();
});

// ═══════════════════════════════════════════════════════════
// 9. Finisher makes the opponent stars-flee and records the flag.
// ═══════════════════════════════════════════════════════════
test('finisher makes the opponent stars-flee', async ({ page }) => {
  await enterAndFight(page);
  await page.evaluate(() => window.__merlinGame.debug.stage3FillTeamwork());
  await page.evaluate(() => window.__merlinGame.debug.stage3Finish());
  expect((await s3(page)).opponentState).toBe('stars-flee');
  expect((await flags(page)).stage3Opponent1Complete).toBe(true);
  await expect(page.locator('#s3-banner')).toContainText('scampered');
});

// ═══════════════════════════════════════════════════════════
// 11. Pep reaching zero triggers a retry, not a game-over.
// ═══════════════════════════════════════════════════════════
test('Pep zero triggers a retry, not a game-over', async ({ page }) => {
  await enterAndFight(page);
  await page.evaluate(() => window.__merlinGame.debug.stage3ForcePepZero());
  // Still in Stage 3, a comedy tumble banner shows, not complete.
  expect(await stage(page)).toBe('stage3-fight');
  await expect(page.locator('#s3-banner')).toContainText('tumble');
  expect(Boolean((await flags(page)).stage3Complete)).toBe(false);
  // The same opponent resets and the fight resumes (no dead-end).
  await page.waitForFunction(() => { const s = window.__merlinGame.scene; return s && s.fighting && s.pep === 100; }, null, { timeout: 4000 });
});

// ═══════════════════════════════════════════════════════════
// 10, 12 & 13. Assist auto-play clears every opponent → Stage 4 (no dead-end).
// ═══════════════════════════════════════════════════════════
test('Assist auto-play clears all opponents and hands off to Stage 4', async ({ page }) => {
  await enterStage3(page);
  expect(await page.evaluate(() => window.__merlinGame.state.assistMode)).toBe(true);
  await page.evaluate(() => window.__merlinGame.debug.stage3AutoPlayFight());

  const f = await flags(page);
  expect(f.stage3Opponent1Complete).toBe(true);
  expect(f.stage3Opponent2Complete).toBe(true);
  expect(f.stage3Opponent3Complete).toBe(true);
  expect(f.stage3Complete).toBe(true);
  expect(await stage(page)).toBe('stage4-sniff');
});

// ═══════════════════════════════════════════════════════════
// 14. Guardrails: family-safe, Pep (not health), defeat is flee (not injury).
// ═══════════════════════════════════════════════════════════
test('Stage 3 content is family-safe cartoon slapstick', async ({ page }) => {
  await enterStage3(page);
  const text = await page.evaluate(() => window.__merlinGame.debug.stage3AllText().toLowerCase());
  for (const bad of ['kill', 'death', 'blood', 'gore', 'gun', 'knockout', 'injur', 'vicious', 'weapon', 'attack', 'health']) {
    expect(text, `should not contain "${bad}"`).not.toContain(bad);
  }
  expect(text).toContain('pep');        // resource is Pep
  expect(text).toContain('scamper');    // defeat = flee, not injury
});

// ═══════════════════════════════════════════════════════════
// 0.8 Gameplay pass — stars, medals, Challenge difference.
// ═══════════════════════════════════════════════════════════
const starOf3 = (page, id) => page.evaluate((s) => window.__merlinGame.state.stars[s], id);
const medalsOf3 = (page) => page.evaluate(() => window.__merlinGame.state.medals);

test('using all three assists earns 3 stars and the Teamwork Pro medal', async ({ page }) => {
  await enterAndFight(page);
  for (let o = 0; o < 3; o++) {
    await drain(page);
    for (const a of ['boof', 'trip', 'wiggle']) await page.evaluate((x) => window.__merlinGame.debug.stage3UseAssist(x), a);
    await page.evaluate(() => { window.__merlinGame.debug.stage3FillTeamwork(); window.__merlinGame.debug.stage3Finish(); window.__merlinGame.debug.stage3AfterFlee(); });
  }
  for (let i = 0; i < 8; i++) { if ((await stage(page)) !== 'stage3-fight') break; await page.evaluate(() => window.__merlinGame.debug.advanceDialogue()); }
  expect(await starOf3(page, 'stage3-fight')).toBe(3);
  expect((await medalsOf3(page))['teamwork-pro']).toBe(true);
});

test('mash-the-finisher auto-play earns fewer stars and no medal', async ({ page }) => {
  await enterStage3(page);
  await page.evaluate(() => window.__merlinGame.debug.stage3AutoPlayFight());
  expect(await starOf3(page, 'stage3-fight')).toBeLessThan(3);
  expect(Boolean((await medalsOf3(page))['teamwork-pro'])).toBe(false);
});

test('Challenge penalizes repeating the same assist', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { window.__merlinGame.setAssist(false); window.__merlinGame.goToStage('stage3-fight'); });
  await page.waitForFunction(() => window.__merlinGame.state.currentStage === 'stage3-fight');
  await drain(page);   // advance the intro so opponent 1 is fighting
  await page.waitForFunction(() => { const s = window.__merlinGame.scene; return s && s.fighting; });
  const gain1 = await page.evaluate(() => { const s = window.__merlinGame.scene; s.teamwork = 0; window.__merlinGame.debug.stage3UseAssist('boof'); return s.teamwork; });
  const gain2 = await page.evaluate(() => { const s = window.__merlinGame.scene; const b = s.teamwork; window.__merlinGame.debug.stage3UseAssist('boof'); return s.teamwork - b; });
  expect(gain2).toBeLessThan(gain1);   // repeating the same assist earns less
});
