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
// Play spawn→tap rounds until we reach the telegraph (point) of a given wave.
async function playToWaveTelegraph(page, wave) {
  for (let i = 0; i < 48; i++) {
    if ((await stage(page)) !== 'stage4-sniff') break;
    const st = await s4(page);
    if (st.wave === wave && st.telegraphing && !st.target) return st;
    if (st.telegraphing && !st.target) { await page.evaluate(() => window.__merlinGame.debug.stage4SpawnNextTarget()); continue; }
    if (st.target) { await page.evaluate(() => window.__merlinGame.debug.stage4TapTarget()); continue; }
    await drain(page);
  }
  return null;
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
  const t1 = (await s4(page)).spawnAt;          // immutable spawn position (target then moves)

  await page.evaluate(() => { window.__merlinGame.goToStage('title'); window.__merlinGame.state.rngSeed = 123; window.__merlinGame.goToStage('stage4-sniff'); });
  await drain(page);
  await page.evaluate(() => window.__merlinGame.debug.stage4SpawnNextTarget());
  const t2 = (await s4(page)).spawnAt;

  expect(t2).toEqual(t1);
});

// ═══════════════════════════════════════════════════════════
// 11, 13, 14 & 15. Assist auto-play clears all waves → Stage 5 (no dead-end).
// ═══════════════════════════════════════════════════════════
test('auto-play completes all waves and hands off to Stage 5', async ({ page }) => {
  await enterStage4(page, 7);
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

// ═══════════════════════════════════════════════════════════
// 0.81 Polish — Chinook's point direction + Big Sniff highlight.
// ═══════════════════════════════════════════════════════════
test('Chinook points at the spot, and the target appears there', async ({ page }) => {
  await enterAndStart(page, 5);
  const st = await s4(page);
  expect(st.telegraphing).toBe(true);
  expect(st.target).toBeNull();
  expect(st.pointAt).not.toBeNull();                       // Chinook is already pointing
  await page.evaluate(() => window.__merlinGame.debug.stage4SpawnNextTarget());
  const after = await s4(page);
  expect(after.spawnAt.x).toBe(st.pointAt.x);              // target appears where he pointed
  expect(after.spawnAt.y).toBe(st.pointAt.y);
});

test('Big Sniff highlights the gallery field', async ({ page }) => {
  await enterAndStart(page, 5);
  await page.evaluate(() => window.__merlinGame.debug.stage4SpawnNextTarget());
  await page.evaluate(() => window.__merlinGame.debug.stage4TriggerBigSniff());
  await page.evaluate(() => window.__merlinGame.debug.stage4TapTarget());   // → next round begins with Big Sniff active
  expect(await page.locator('#s4-field.bigsniff').count()).toBe(1);
});

// ═══════════════════════════════════════════════════════════
// 0.82 — moving targets after the point + harmless timeout.
// ═══════════════════════════════════════════════════════════
test('the target moves after it spawns', async ({ page }) => {
  await enterAndStart(page, 5);
  await page.evaluate(() => window.__merlinGame.debug.stage4SpawnNextTarget());
  expect((await s4(page)).targetMoving).toBe(true);
  const x0 = (await s4(page)).target.x;
  await page.evaluate(() => window.__merlinGame.debug.stage4AdvanceMotion(500));
  const x1 = (await s4(page)).target.x;
  expect(x1).not.toBe(x0);                                  // it drifted along
});

test('duck and clay drift at different speeds', async ({ page }) => {
  await enterAndStart(page, 11);
  const speeds = {};
  for (let i = 0; i < 16 && Object.keys(speeds).length < 2; i++) {
    if ((await stage(page)) !== 'stage4-sniff') break;
    let st = await s4(page);
    if (!st.target) { await page.evaluate(() => window.__merlinGame.debug.stage4SpawnNextTarget()); st = await s4(page); }
    if (st.target) { speeds[st.target.kind] = Math.abs(st.targetVx); await page.evaluate(() => window.__merlinGame.debug.stage4TapTarget()); }
    else { await drain(page); }
  }
  expect(speeds.duck).toBeGreaterThan(0);
  expect(speeds.clay).toBeGreaterThan(0);
  expect(speeds.clay).toBeGreaterThan(speeds.duck);        // clay is faster than the lazy duck
});

test('a target that times out drifts away and the round advances (no fail)', async ({ page }) => {
  await enterAndStart(page, 5);
  await page.evaluate(() => window.__merlinGame.debug.stage4SpawnNextTarget());
  const before = (await s4(page)).targetTimedOut;
  await page.evaluate(() => window.__merlinGame.debug.stage4ForceTimeout());
  const after = await s4(page);
  expect(after.targetTimedOut).toBe(before + 1);
  expect(after.lastResolve.outcome).toBe('timeout');
  expect(await stage(page)).toBe('stage4-sniff');          // never a dead-end
  expect(Boolean((await flags(page)).stage4Complete)).toBe(false);
});

// ═══════════════════════════════════════════════════════════
// 0.82.1 — the DOM point marker is obvious on EVERY round; +15% chase.
// ═══════════════════════════════════════════════════════════
test('the point marker shows on wave 1 during the telegraph, at the point spot', async ({ page }) => {
  await enterAndStart(page, 5);
  const st = await s4(page);
  expect(st.pointAt).not.toBeNull();
  expect(st.pointMarkVisible).toBe(true);
  const mark = page.locator('.s4-point-mark');
  await expect(mark).toBeVisible();
  expect(await mark.evaluate(el => el.style.left)).toBe(st.pointAt.x + '%');   // positioned at pointAt
  expect(await mark.evaluate(el => el.style.top)).toBe(st.pointAt.y + '%');
});

test('the point marker appears on every wave (1, 2, 3), not just Big Sniff', async ({ page }) => {
  await enterAndStart(page, 7);
  expect((await s4(page)).pointMarkVisible).toBe(true);     // wave 1
  for (const w of [2, 3]) {
    const st = await playToWaveTelegraph(page, w);
    expect(st, `should reach wave ${w} telegraph`).not.toBeNull();
    expect(st.wave).toBe(w);
    expect(st.pointMarkVisible).toBe(true);
    await expect(page.locator('.s4-point-mark')).toBeVisible();
  }
});

test('the point marker is hidden once the target spawns', async ({ page }) => {
  await enterAndStart(page, 5);
  expect((await s4(page)).pointMarkVisible).toBe(true);
  await page.evaluate(() => window.__merlinGame.debug.stage4SpawnNextTarget());
  const st = await s4(page);
  expect(st.pointMarkVisible).toBe(false);
  await expect(page.locator('.s4-point-mark')).toBeHidden();
  expect(st.spawnAt).not.toBeNull();                        // target still spawned where he pointed
});

test('Big Sniff keeps the point marker visible (and the field stronger)', async ({ page }) => {
  await enterAndStart(page, 5);
  await page.evaluate(() => window.__merlinGame.debug.stage4SpawnNextTarget());
  await page.evaluate(() => window.__merlinGame.debug.stage4TriggerBigSniff());
  await page.evaluate(() => window.__merlinGame.debug.stage4TapTarget());      // → next round telegraph, Big Sniff active
  const st = await s4(page);
  expect(st.telegraphing).toBe(true);
  expect(st.bigSniffActive).toBe(true);
  expect(st.pointMarkVisible).toBe(true);
  await expect(page.locator('#s4-field.bigsniff .s4-point-mark')).toBeVisible();
});

test('Big Sniff still slows the chase', async ({ page }) => {
  await enterAndStart(page, 5);
  await page.evaluate(() => window.__merlinGame.debug.stage4SpawnNextTarget());
  const st = await s4(page);
  const vx = Math.abs(st.targetVx), x0 = st.target.x;
  await page.evaluate(() => window.__merlinGame.debug.stage4TriggerBigSniff());   // Big Sniff active
  await page.evaluate(() => window.__merlinGame.debug.stage4AdvanceMotion(200));
  const moved = Math.abs((await s4(page)).target.x - x0);
  expect(moved).toBeGreaterThan(0);
  expect(moved).toBeLessThan(vx * 1.15 * 0.2);              // slowed below the un-slowed +15% distance
});
