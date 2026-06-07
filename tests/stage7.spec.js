const { test, expect } = require('@playwright/test');

// ── helpers (deterministic: debug hooks + stable selectors) ──
async function enterStage7(page) {
  await page.goto('/');
  await page.evaluate(() => window.__merlinGame.goToStage('stage7-realjob'));
  await page.waitForFunction(() => window.__merlinGame.state.currentStage === 'stage7-realjob');
}
const drain = (page) => page.evaluate(() => window.__merlinGame.debug.drainDialogue());
const s7 = (page) => page.evaluate(() => window.__merlinGame.debug.stage7GetState());
const flags = (page) => page.evaluate(() => window.__merlinGame.state.flags);
const stage = (page) => page.evaluate(() => window.__merlinGame.state.currentStage);

async function enterPlay(page) {
  await enterStage7(page);
  await drain(page);                                   // advance homecoming → boys greet → play
  await page.waitForFunction(() => { const s = window.__merlinGame.scene; return s && s.phase === 'play'; });
}

// ═══════════════════════════════════════════════════════════
// 1 & 2. Real content (not placeholder) + direct entry.
// ═══════════════════════════════════════════════════════════
test('Stage 7 is real content, not the placeholder', async ({ page }) => {
  await enterStage7(page);
  await expect(page.locator('#stage7-layer')).toBeVisible();
  await expect(page.locator('#stage-view')).toBeHidden();
});
test('Stage 7 enters via goToStage', async ({ page }) => {
  await enterStage7(page);
  expect(await stage(page)).toBe('stage7-realjob');
  expect((await flags(page)).stage7Started).toBe(true);
  expect(await page.evaluate(() => window.__merlinGame.state.aesthetic)).toBe('home');
});

// ═══════════════════════════════════════════════════════════
// 3 & 4. Merlin/home render (canvas sanity); Joy meter appears at 0.
// ═══════════════════════════════════════════════════════════
test('Merlin renders and the Joy meter starts at zero', async ({ page }) => {
  await enterStage7(page);
  await expect(page.locator('#s7-joy')).toBeVisible();
  expect((await s7(page)).joy).toBe(0);
  const hasMerlinInk = await page.evaluate(() => {
    window.__merlinGame.scene.render();
    const d = document.getElementById('game-canvas').getContext('2d').getImageData(100, 450, 90, 90).data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] < 50 && d[i + 1] < 50 && d[i + 2] < 50 && d[i + 3] > 200) return true;  // Merlin's black coat
    }
    return false;
  });
  expect(hasMerlinInk).toBe(true);
});

// ═══════════════════════════════════════════════════════════
// 5 & 6. Interactions are sequential (not a crowded panel); Joy only increases.
// ═══════════════════════════════════════════════════════════
test('interactions are sequential and Joy only increases', async ({ page }) => {
  await enterPlay(page);
  // Only ONE warm action is shown at a time (less crowded than the old 6-button panel).
  expect((await s7(page)).visibleInteractions).toBe(1);
  await expect(page.locator('.s7-inter')).toHaveCount(1);
  const first = await page.locator('.s7-inter').getAttribute('data-id');
  expect(first).toBe('flop');                       // the sequence starts with "Flop beside the boys"

  let joy = (await s7(page)).joy;
  for (let i = 0; i < 3; i++) {
    await page.locator('.s7-inter').click();        // tap the current single card
    const next = (await s7(page)).joy;
    expect(next).toBeGreaterThan(joy);              // strictly up, never down
    joy = next;
    expect((await s7(page)).visibleInteractions).toBeLessThanOrEqual(1);  // never crowded
  }
});

test('three boys are represented in the finale', async ({ page }) => {
  await enterStage7(page);
  expect((await s7(page)).boyCount).toBe(3);
});

// ═══════════════════════════════════════════════════════════
// 7, 8 & 9. Mentor callbacks complete and set their flags.
// ═══════════════════════════════════════════════════════════
test('mentor callbacks complete and set their flags', async ({ page }) => {
  await enterPlay(page);
  await page.evaluate(() => window.__merlinGame.debug.stage7DoInteraction('photo'));
  expect((await flags(page)).stage7IlaCallbackComplete).toBe(true);
  await page.evaluate(() => window.__merlinGame.debug.stage7DoInteraction('find-toy'));
  expect((await flags(page)).stage7ChinookCallbackComplete).toBe(true);
  await page.evaluate(() => window.__merlinGame.debug.stage7DoInteraction('let-win'));
  expect((await flags(page)).stage7HadesCallbackComplete).toBe(true);
});

// ═══════════════════════════════════════════════════════════
// 10 & 12. Joy full sets the flag and enters the suppressed-comedy realization.
// ═══════════════════════════════════════════════════════════
test('Joy full triggers the realization with comedy suppressed', async ({ page }) => {
  await enterPlay(page);
  await page.evaluate(() => window.__merlinGame.debug.stage7FillJoy());
  expect((await flags(page)).stage7JoyFull).toBe(true);
  const st = await s7(page);
  expect(st.joy).toBe(100);
  expect(st.phase).toBe('realization');
  expect(st.comedySuppressed).toBe(true);
});

// ═══════════════════════════════════════════════════════════
// 11. Realization names Merlin's real job.
// ═══════════════════════════════════════════════════════════
test("realization names Merlin's job: the boys, being happy, being theirs", async ({ page }) => {
  await enterStage7(page);
  const text = await page.evaluate(() => window.__merlinGame.debug.stage7AllText().toLowerCase());
  expect(text).toContain('my job is making them happy');
  expect(text).toContain('theirs');
  // 0.9.1: Chinook pronoun + learned-action callbacks
  expect(text).toContain('chinook has the best nose in the county. he is six months old.');
  expect(text).toContain('find the toy');
  expect(text).toContain('hold still');
  expect(text).toContain('let the little one win');
});

// ═══════════════════════════════════════════════════════════
// 13–16. Finale: tableau + The End render; completion flag; Play Again → title.
// ═══════════════════════════════════════════════════════════
test('finale reaches The End and Play Again returns to title', async ({ page }) => {
  await enterStage7(page);
  await page.evaluate(() => window.__merlinGame.debug.stage7AutoPlayFinale());

  const f = await flags(page);
  expect(f.stage7JoyFull).toBe(true);
  expect(f.stage7IlaCallbackComplete).toBe(true);
  expect(f.stage7ChinookCallbackComplete).toBe(true);
  expect(f.stage7HadesCallbackComplete).toBe(true);
  expect(f.stage7Complete).toBe(true);
  expect(await page.evaluate(() => window.__merlinGame.state.joy)).toBe(100);

  await expect(page.locator('#s7-tableau')).toBeVisible();
  await expect(page.locator('#s7-end')).toBeVisible();
  await expect(page.locator('.s7-end-title')).toContainText('The End');

  await page.locator('#s7-replay').click();
  await page.waitForFunction(() => window.__merlinGame.state.currentStage === 'title');
  await expect(page.locator('#title-screen')).toBeVisible();
});

// ═══════════════════════════════════════════════════════════
// 17. Guardrails: no fail/sadness; correct home geography; dedication intact.
// ═══════════════════════════════════════════════════════════
test('finale is warm, not a failure, and keeps the home geography', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="dedication"]')).toContainText('For Cyndie');  // dedication intact

  const text = await page.evaluate(() => { window.__merlinGame.goToStage('stage7-realjob'); return window.__merlinGame.debug.stage7AllText().toLowerCase(); });
  for (const bad of ['game over', 'failure', 'worthless', 'bad dog', 'nobody loves', 'all alone', 'cyndie']) {
    expect(text, `should not contain "${bad}"`).not.toContain(bad);
  }
  expect(text).toContain('boys');
  expect(text).toContain('happy');
});

// ═══════════════════════════════════════════════════════════
// 0.8 Gameplay pass — Stage 7 stays gentle (3 stars + warm medal, no penalty).
// ═══════════════════════════════════════════════════════════
test('finale stays gentle: 3 stars and a completion medal', async ({ page }) => {
  await enterStage7(page);
  await page.evaluate(() => window.__merlinGame.debug.stage7AutoPlayFinale());
  expect(await page.evaluate(() => window.__merlinGame.state.stars['stage7-realjob'])).toBe(3);
  expect((await page.evaluate(() => window.__merlinGame.state.medals))['real-job']).toBe(true);
});
