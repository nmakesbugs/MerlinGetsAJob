const { test, expect } = require('@playwright/test');

// ── helpers (deterministic: debug hooks + stable selectors) ──
async function enterStage6(page) {
  await page.goto('/');
  await page.evaluate(() => window.__merlinGame.goToStage('stage6-hades'));
  await page.waitForFunction(() => window.__merlinGame.state.currentStage === 'stage6-hades');
}
const drain = (page) => page.evaluate(() => window.__merlinGame.debug.drainDialogue());
const s6 = (page) => page.evaluate(() => window.__merlinGame.debug.stage6GetState());
const flags = (page) => page.evaluate(() => window.__merlinGame.state.flags);
const stage = (page) => page.evaluate(() => window.__merlinGame.state.currentStage);

// Enter and advance intro + demo into Round 1 (player's turn).
async function enterRound1(page) {
  await enterStage6(page);
  await drain(page);
  await page.waitForFunction(() => { const s = window.__merlinGame.scene; return s && s.phase === 'round'; });
}

// ═══════════════════════════════════════════════════════════
// 1 & 2. Real content (not placeholder) + direct entry.
// ═══════════════════════════════════════════════════════════
test('Stage 6 is real content, not the placeholder', async ({ page }) => {
  await enterStage6(page);
  await expect(page.locator('#stage6-layer')).toBeVisible();
  await expect(page.locator('#stage-view')).toBeHidden();
});
test('Stage 6 enters via goToStage', async ({ page }) => {
  await enterStage6(page);
  expect(await stage(page)).toBe('stage6-hades');
  expect((await flags(page)).stage6Started).toBe(true);
  expect(await page.evaluate(() => window.__merlinGame.state.aesthetic)).toBe('hades');
});

// ═══════════════════════════════════════════════════════════
// 3 & 4. Hades is identified + a minimal canvas sanity check.
// ═══════════════════════════════════════════════════════════
test('Hades is identified and renders to canvas', async ({ page }) => {
  await enterStage6(page);
  await expect(page.locator('#dlg-speaker')).toContainText('Hades');
  const hasHadesCoat = await page.evaluate(() => {
    window.__merlinGame.scene.render();
    const d = document.getElementById('game-canvas').getContext('2d').getImageData(285, 335, 55, 70).data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (r >= 150 && r <= 235 && r > b + 25 && g >= 120 && g <= 210) return true;   // tan coat
    }
    return false;
  });
  expect(hasHadesCoat).toBe(true);
});

// ═══════════════════════════════════════════════════════════
// 5. Demo completes and sets its flag before the player's turn.
// ═══════════════════════════════════════════════════════════
test('demo completes and sets stage6DemoComplete', async ({ page }) => {
  await enterRound1(page);
  expect((await flags(page)).stage6DemoComplete).toBe(true);
  expect((await s6(page)).phase).toBe('round');
});

// ═══════════════════════════════════════════════════════════
// 6. Handling a high-priority event increases household happiness.
// ═══════════════════════════════════════════════════════════
test('handling a high-priority event increases happiness', async ({ page }) => {
  await enterRound1(page);
  const before = (await s6(page)).happiness;
  await page.evaluate(() => window.__merlinGame.debug.stage6HandleEvent('boys-need'));
  expect((await s6(page)).happiness).toBeGreaterThan(before);
});

// ═══════════════════════════════════════════════════════════
// 7 & 10. Tapping junk drains Composure (tapping everything is wrong).
// ═══════════════════════════════════════════════════════════
test('tapping junk drains Composure', async ({ page }) => {
  await enterRound1(page);
  const before = (await s6(page)).composure;
  await page.evaluate(() => window.__merlinGame.debug.stage6HandleEvent('leaf'));
  const after1 = (await s6(page)).composure;
  expect(after1).toBeLessThan(before);
  await page.evaluate(() => window.__merlinGame.debug.stage6HandleEvent('doorbell'));
  expect((await s6(page)).composure).toBeLessThan(after1);   // tapping everything keeps draining
});

// ═══════════════════════════════════════════════════════════
// 8. Sunbeam / strategic rest restores Composure.
// ═══════════════════════════════════════════════════════════
test('sunbeam restores Composure', async ({ page }) => {
  await enterRound1(page);
  await page.evaluate(() => window.__merlinGame.debug.stage6HandleEvent('leaf'));   // spend some first
  const before = (await s6(page)).composure;
  await page.evaluate(() => window.__merlinGame.debug.stage6HandleEvent('sunbeam'));
  expect((await s6(page)).composure).toBeGreaterThan(before);
});

// ═══════════════════════════════════════════════════════════
// 9. Delegate consumes a use and records stage6DelegatedTask.
// ═══════════════════════════════════════════════════════════
test('delegate consumes a use and sets the flag', async ({ page }) => {
  await enterRound1(page);
  const before = (await s6(page)).delegatesLeft;
  expect(await page.evaluate(() => window.__merlinGame.debug.stage6DelegateEvent('empty-bowl'))).toBe(true);
  expect((await s6(page)).delegatesLeft).toBe(before - 1);
  expect((await flags(page)).stage6DelegatedTask).toBe(true);
});

// ═══════════════════════════════════════════════════════════
// 11. Composure zero triggers a comedic reset, not a game-over.
// ═══════════════════════════════════════════════════════════
test('Composure zero triggers a comedic reset, not a game-over', async ({ page }) => {
  await enterRound1(page);
  await page.evaluate(() => window.__merlinGame.debug.stage6DrainComposure());
  expect((await flags(page)).stage6ComposureResetSeen).toBe(true);
  expect(await stage(page)).toBe('stage6-hades');        // still playing
  expect((await s6(page)).composure).toBeGreaterThan(0); // partial reset, not zero/dead
  await expect(page.locator('#s6-banner')).toContainText(/spiral/i);
});

// ═══════════════════════════════════════════════════════════
// 12, 14 & 15. Assist auto-play completes every round → Stage 7.
// ═══════════════════════════════════════════════════════════
test('auto-play completes Stage 6 and hands off to Stage 7', async ({ page }) => {
  await enterStage6(page);
  await page.evaluate(() => window.__merlinGame.debug.stage6AutoPlayStage());

  const f = await flags(page);
  expect(f.stage6Round1Complete).toBe(true);
  expect(f.stage6Round2Complete).toBe(true);
  expect(f.stage6Round3Complete).toBe(true);
  expect(f.stage6Complete).toBe(true);
  expect(await stage(page)).toBe('stage7-realjob');
});

// ═══════════════════════════════════════════════════════════
// 13 & 16. Hades names Merlin's gift; content is kind, not cruel.
// ═══════════════════════════════════════════════════════════
test('Hades verdict names Merlin’s gift and stays kind', async ({ page }) => {
  await enterStage6(page);
  const text = await page.evaluate(() => window.__merlinGame.debug.stage6AllText().toLowerCase());
  expect(text).toContain('being loved');                 // names his real gift
  expect(text).toContain('the boys are happy when you are near');
  for (const bad of ['blood', 'kill', 'death', 'hurt', 'danger', 'stupid', 'idiot', 'hate', 'scary']) {
    expect(text, `should not contain "${bad}"`).not.toContain(bad);
  }
});

// ═══════════════════════════════════════════════════════════
// 0.8 Gameplay pass — stars, medals, Challenge difference.
// ═══════════════════════════════════════════════════════════
const starOf6 = (page, id) => page.evaluate((s) => window.__merlinGame.state.stars[s], id);
const medalsOf6 = (page) => page.evaluate(() => window.__merlinGame.state.medals);

test('clean management earns 3 stars and the Catlike Composure medal', async ({ page }) => {
  await enterStage6(page);
  await page.evaluate(() => window.__merlinGame.debug.stage6AutoPlayStage());
  expect(await starOf6(page, 'stage6-hades')).toBe(3);
  expect((await medalsOf6(page))['catlike-composure']).toBe(true);
});

test('tapping junk lowers the star score', async ({ page }) => {
  await enterRound1(page);
  await page.evaluate(() => { window.__merlinGame.debug.stage6HandleEvent('leaf'); window.__merlinGame.debug.stage6HandleEvent('leaf'); });
  await page.evaluate(() => window.__merlinGame.debug.stage6AutoPlayStage());
  expect(await starOf6(page, 'stage6-hades')).toBeLessThan(3);
});


// ═══════════════════════════════════════════════════════════
// 0.81 Polish — clarity: rules panel, event coding, Delegate feedback.
// ═══════════════════════════════════════════════════════════
test('the How to Manage rules panel and legend appear at round start', async ({ page }) => {
  await enterRound1(page);
  expect((await s6(page)).rulesShown).toBe(true);
  await expect(page.locator('#s6-rules')).toBeVisible();
  await expect(page.locator('#s6-rules')).toContainText('Do not tap everything');
  await expect(page.locator('#s6-legend')).toBeVisible();
});

test('high-priority and junk events are visually distinguishable', async ({ page }) => {
  await enterRound1(page);
  await page.evaluate(() => window.__merlinGame.debug.stage6SpawnEvent('boys-need'));
  const high = page.locator('.s6-event[data-type="boys-need"]').first();
  await expect(high).toHaveClass(/pri-high/);
  await expect(high).toHaveClass(/can-delegate/);          // delegate-eligible cue
  await page.evaluate(() => window.__merlinGame.debug.stage6SpawnEvent('leaf'));
  await expect(page.locator('.s6-event[data-type="leaf"]').first()).toHaveClass(/pri-low/);  // dim/dashed junk
});

test('Delegate resolves an eligible task with a visible helper response', async ({ page }) => {
  await enterRound1(page);
  await page.evaluate(() => window.__merlinGame.debug.stage6SpawnEvent('empty-bowl'));
  const before = (await s6(page)).delegatesLeft;
  expect(await page.evaluate(() => window.__merlinGame.debug.stage6DelegateEvent('empty-bowl'))).toBe(true);
  const st = await s6(page);
  expect(st.delegatesLeft).toBe(before - 1);
  expect(st.lastDelegateMsg).toBeTruthy();                 // "Chinook handled it!" etc.
  await expect(page.locator('.s6-event[data-type="empty-bowl"]')).toHaveCount(0);  // the task was resolved/removed
  expect((await flags(page)).stage6DelegatedTask).toBe(true);
  await expect(page.locator('#s6-banner')).toBeVisible();
});

test('tapping junk shows feedback and drains Composure', async ({ page }) => {
  await enterRound1(page);
  const before = (await s6(page)).composure;
  await page.evaluate(() => window.__merlinGame.debug.stage6HandleEvent('leaf'));
  expect((await s6(page)).composure).toBeLessThan(before);
  await expect(page.locator('#s6-banner')).toContainText(/junk/i);
});

test('sunbeam shows feedback and restores Composure', async ({ page }) => {
  await enterRound1(page);
  await page.evaluate(() => window.__merlinGame.debug.stage6HandleEvent('leaf'));   // spend some first
  const before = (await s6(page)).composure;
  await page.evaluate(() => window.__merlinGame.debug.stage6HandleEvent('sunbeam'));
  expect((await s6(page)).composure).toBeGreaterThan(before);
  await expect(page.locator('#s6-banner')).toContainText(/rest/i);
});
