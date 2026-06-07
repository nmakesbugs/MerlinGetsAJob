const { test, expect } = require('@playwright/test');

// ── helpers (deterministic: debug hooks + stable selectors) ──
async function enterStage4(page, seed) {
  await page.goto('/');
  await page.evaluate((s) => {
    if (s != null) window.__merlinGame.state.rngSeed = s;
    window.__merlinGame.goToStage('stage4-sniff');
  }, seed == null ? null : seed);
  await page.waitForFunction(() => window.__merlinGame.state.currentStage === 'stage4-sniff');
}
const drain = (page) => page.evaluate(() => window.__merlinGame.debug.drainDialogue());
const s4 = (page) => page.evaluate(() => window.__merlinGame.debug.stage4GetState());
const flags = (page) => page.evaluate(() => window.__merlinGame.state.flags);
const stage = (page) => page.evaluate(() => window.__merlinGame.state.currentStage);

// Enter and advance the intro to the first round (telegraphing, no target yet).
async function enterAndStart(page, seed) {
  await enterStage4(page, seed);
  await drain(page);
  await page.waitForFunction(() => { const s = window.__merlinGame.scene; return s && s.telegraphing; });
}
async function ensureTarget(page) {
  let st = await s4(page);
  if (!st.target) { await page.evaluate(() => window.__merlinGame.debug.stage4SpawnNextTarget()); st = await s4(page); }
  return st;
}
// Spawn/tap rounds until a target of `want` kind is tapped; returns its lastResolve.
async function tapUntilKind(page, want) {
  for (let i = 0; i < 16; i++) {
    if ((await stage(page)) !== 'stage4-sniff') break;
    const st = await ensureTarget(page);
    if (!st.target) { await drain(page); continue; }
    const kind = st.target.kind;
    await page.evaluate(() => window.__merlinGame.debug.stage4TapTarget());
    if (kind === want) return (await s4(page)).lastResolve;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════
// 1 & 2. Real content (not placeholder) + direct entry.
// ═══════════════════════════════════════════════════════════
test('Stage 4 is real content, not the placeholder', async ({ page }) => {
  await enterStage4(page);
  await expect(page.locator('#stage4-layer')).toBeVisible();
  await expect(page.locator('#stage-view')).toBeHidden();
});
test('Stage 4 enters via goToStage', async ({ page }) => {
  await enterStage4(page);
  expect(await stage(page)).toBe('stage4-sniff');
  expect((await flags(page)).stage4Started).toBe(true);
  expect(await page.evaluate(() => window.__merlinGame.state.aesthetic)).toBe('chinook');
});

// ═══════════════════════════════════════════════════════════
// 3 & 4. Chinook is identified + a minimal canvas sanity check.
// ═══════════════════════════════════════════════════════════
test('Chinook appears and is identified, and renders to canvas', async ({ page }) => {
  await enterStage4(page);
  await expect(page.locator('#dlg-speaker')).toContainText('Chinook');
  // Sanity: Chinook's russet coat leaves brown ink in his render area (not sky/grass).
  const hasRusset = await page.evaluate(() => {
    window.__merlinGame.scene.render();
    const d = document.getElementById('game-canvas').getContext('2d').getImageData(200, 420, 110, 90).data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (r > 110 && r > g + 25 && r > b + 30) return true;   // russet/brown
    }
    return false;
  });
  expect(hasRusset).toBe(true);
});

// ═══════════════════════════════════════════════════════════
// 5. Chinook's point/telegraph appears before a target spawns.
// ═══════════════════════════════════════════════════════════
test('Chinook points (telegraph) before a target appears', async ({ page }) => {
  await enterAndStart(page);
  const st = await s4(page);
  expect(st.telegraphing).toBe(true);
  expect(st.target).toBeNull();
  await expect(page.locator('#s4-telegraph')).toBeVisible();
  await page.evaluate(() => window.__merlinGame.debug.stage4SpawnNextTarget());
  expect((await s4(page)).target).not.toBeNull();
});

// ═══════════════════════════════════════════════════════════
// 6 & 7. Duck → harmless fly-off; clay/foam disc → harmless puff.
// ═══════════════════════════════════════════════════════════
test('tapping a duck makes it fly off unharmed', async ({ page }) => {
  await enterAndStart(page, 123);
  const r = await tapUntilKind(page, 'duck');
  expect(r).not.toBeNull();
  expect(r.outcome).toBe('fly-off');
});
test('tapping a clay disc makes it puff harmlessly', async ({ page }) => {
  await enterAndStart(page, 123);
  const r = await tapUntilKind(page, 'clay');
  expect(r).not.toBeNull();
  expect(r.outcome).toBe('puff');
});

// ═══════════════════════════════════════════════════════════
// 8. Tapping a decoy is funny, not a fail/dead-end.
// ═══════════════════════════════════════════════════════════
test('tapping a decoy does not fail or dead-end', async ({ page }) => {
  await enterAndStart(page);
  await ensureTarget(page);
  await page.evaluate(() => window.__merlinGame.debug.stage4ForceDecoy('butterfly'));
  expect((await s4(page)).decoy).not.toBeNull();
  await page.evaluate(() => window.__merlinGame.debug.stage4TapDecoy());
  const st = await s4(page);
  expect(st.combo).toBe(0);                       // decoy resets combo
  expect(st.target).not.toBeNull();               // the real find is still there
  expect(await stage(page)).toBe('stage4-sniff');  // no dead-end
  expect(Boolean((await flags(page)).stage4Complete)).toBe(false);
});

// ═══════════════════════════════════════════════════════════
// 9. Score and combo increase on a correct spot.
// ═══════════════════════════════════════════════════════════
test('a correct spot increases score and combo', async ({ page }) => {
  await enterAndStart(page);
  await ensureTarget(page);
  const before = await s4(page);
  await page.evaluate(() => window.__merlinGame.debug.stage4TapTarget());
  const after = await s4(page);
  expect(after.score).toBeGreaterThan(before.score);
  expect(after.combo).toBeGreaterThan(before.combo);
});

// ═══════════════════════════════════════════════════════════
// 10. Big Sniff meter fills and triggers the bonus state.
// ═══════════════════════════════════════════════════════════
test('Big Sniff fills and triggers a bonus', async ({ page }) => {
  await enterAndStart(page);
  await page.evaluate(() => window.__merlinGame.debug.stage4TriggerBigSniff());
  const st = await s4(page);
  expect(st.bigSniffFull).toBe(true);
  expect(st.bigSniffActive).toBe(true);
  expect((await flags(page)).stage4BigSniffTriggered).toBe(true);
  await expect(page.locator('#s4-banner')).toContainText('BIG SNIFF');
});

// ═══════════════════════════════════════════════════════════
// 12. Spawns are deterministic under a fixed rngSeed.
// ═══════════════════════════════════════════════════════════
test('target spawns are deterministic under rngSeed', async ({ page }) => {
  await enterAndStart(page, 123);
  await page.evaluate(() => window.__merlinGame.debug.stage4SpawnNextTarget());
  const t1 = (await s4(page)).target;

  await page.evaluate(() => { window.__merlinGame.goToStage('title'); window.__merlinGame.state.rngSeed = 123; window.__merlinGame.goToStage('stage4-sniff'); });
  await drain(page);
  await page.evaluate(() => window.__merlinGame.debug.stage4SpawnNextTarget());
  const t2 = (await s4(page)).target;

  expect(t2).toEqual(t1);
});

// ═══════════════════════════════════════════════════════════
// 11, 13, 14 & 15. Assist auto-play clears all waves → Stage 5 (no dead-end).
// ═══════════════════════════════════════════════════════════
test('Assist auto-play completes all waves and hands off to Stage 5', async ({ page }) => {
  await enterStage4(page, 7);
  expect(await page.evaluate(() => window.__merlinGame.state.assistMode)).toBe(true);
  await page.evaluate(() => window.__merlinGame.debug.stage4AutoPlayGallery());

  const f = await flags(page);
  expect(f.stage4Wave1Complete).toBe(true);
  expect(f.stage4Wave2Complete).toBe(true);
  expect(f.stage4Wave3Complete).toBe(true);
  expect(f.stage4Complete).toBe(true);
  expect(await stage(page)).toBe('stage5-birddog');
});

// ═══════════════════════════════════════════════════════════
// 16. Guardrails: family-safe spot-and-tap, ducks fly off, not shooting.
// ═══════════════════════════════════════════════════════════
test('Stage 4 content is family-safe (no shooting / no harm)', async ({ page }) => {
  await enterStage4(page);
  const text = await page.evaluate(() => window.__merlinGame.debug.stage4AllText().toLowerCase());
  for (const bad of ['blood', 'gore', 'death', 'kill', 'gun', 'weapon', 'injur', 'shoot', 'hunt']) {
    expect(text, `should not contain "${bad}"`).not.toContain(bad);
  }
  expect(text).toContain('fly off');   // ducks fly off unharmed
  expect(text).toContain('poof');
});

// ═══════════════════════════════════════════════════════════
// 0.8 Gameplay pass — stars, medals, Challenge difference.
// ═══════════════════════════════════════════════════════════
const starOf4 = (page, id) => page.evaluate((s) => window.__merlinGame.state.stars[s], id);
const medalsOf4 = (page) => page.evaluate(() => window.__merlinGame.state.medals);

test('a clean gallery earns 3 stars and the Nose First medal', async ({ page }) => {
  await enterStage4(page, 7);
  await page.evaluate(() => window.__merlinGame.debug.stage4AutoPlayGallery());
  expect(await starOf4(page, 'stage4-sniff')).toBe(3);
  expect((await medalsOf4(page))['nose-first']).toBe(true);
});

test('tapping decoys lowers stars and skips Nose First', async ({ page }) => {
  await enterAndStart(page, 7);
  for (let i = 0; i < 3; i++) {
    await ensureTarget(page);
    await page.evaluate(() => window.__merlinGame.debug.stage4ForceDecoy('butterfly'));
    await page.evaluate(() => window.__merlinGame.debug.stage4TapDecoy());
  }
  await page.evaluate(() => window.__merlinGame.debug.stage4AutoPlayGallery());
  expect(await starOf4(page, 'stage4-sniff')).toBeLessThan(3);
  expect(Boolean((await medalsOf4(page))['nose-first'])).toBe(false);
});

test('Challenge mode uses smaller targets', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { window.__merlinGame.state.rngSeed = 7; window.__merlinGame.setAssist(false); window.__merlinGame.goToStage('stage4-sniff'); });
  await page.waitForFunction(() => window.__merlinGame.state.currentStage === 'stage4-sniff');
  await drain(page);
  await page.evaluate(() => window.__merlinGame.debug.stage4SpawnNextTarget());
  expect(await page.locator('.s4-target.primary.small').count()).toBeGreaterThan(0);
});
