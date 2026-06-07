# Merlin Gets a Job 🐾

The third Merlin family arcade game. Merlin decides to grow up and get a job like his
animal friends — training with **Ila** (a working-line German Shepherd), **Chinook**
(a young bloodhound), and **Hades** (a very large, very imperious cat) — before realizing
his real job was being the family dog who makes the boys happy all along.

A warm, funny, strictly family-safe, **static vanilla-JS arcade game / PWA**. No framework,
no bundler, no build step — just static files.

See the design docs for the full vision: [`DESIGN_BIBLE.md`](DESIGN_BIBLE.md),
[`STAGE_PLAN.md`](STAGE_PLAN.md), [`CHARACTER_BIBLE.md`](CHARACTER_BIBLE.md),
[`CONTENT_SCHEMA.md`](CONTENT_SCHEMA.md), [`IMPLEMENTATION_ROADMAP.md`](IMPLEMENTATION_ROADMAP.md).

---

## Status

### Milestone 1 — Stage 1: "Merlin's Career Crisis" ✅ (current)

The first **shareable** build. A warm visual-novel intro you can play title → Stage 2:

- Title screen with the dedication **For Cyndie**.
- Cozy home scene drawn on canvas (sunny window, a framed photo of the boys, a rug) with
  **Merlin** — the code-drawn black dog carried forward from `AnthonyAdventure2` (coal coat,
  floppy ears, amber eyes, pink tongue, signature blue-and-gold collar), now gently breathing
  and wagging.
- Merlin's career-crisis monologue (funny, warm, family-safe).
- The three core interactions: **tap to advance**, **tap a glowing object** (his empty bowl),
  and a **no-wrong-answer choice** ("What job should Merlin try first?") recorded to
  `state.choices.firstJob`.
- A **mentor montage** introducing Ila, Chinook, and Hades (storybook cards — no stage
  mechanics yet).
- Clean handoff to `stage2-academy` with `flags.stage1Complete = true`.

Stages 2–7 remain Milestone 0 placeholders.

### Milestone 0 — skeleton & harness ✅

The foundation everything builds on:

- Boots cleanly under any static server, no console errors, no framework.
- Portrait **390×700** frame, scaled to fit desktop/mobile.
- Title screen → seven stages → "The End" → Play Again.
- Global `window.__merlinGame` game object + seven-stage registry (per `CONTENT_SCHEMA.md`).
- Reusable **Scene** lifecycle (`enter / update / render / handleInput / exit`) with tracked
  listener/timer teardown.
- Shared **DialogueManager** (tap-to-advance, optional per-line `onShow` hooks).
- Procedural **WebAudio** stubs (`tap, boof, sniff, poof, bonk, cheer, sigh, purr, slowBlink,
  star, pant, motif`) — no audio files.
- Deterministic seedable **RNG** routed through `state.rngSeed`.
- **Assist / Challenge** toggle (defaults to Assist; persisted via `localStorage`).

Remaining stage gameplay (training drills, fighter, gallery, bird-dog, Hades management,
finale) arrives in later milestones — see [`IMPLEMENTATION_ROADMAP.md`](IMPLEMENTATION_ROADMAP.md).

---

## Run it locally

No build step. Serve the folder statically and open it:

```bash
# from the MerlinGetsAJob/ folder
npx http-server . -p 8383
# then open http://127.0.0.1:8383/
```

Or use any static server / VS Code Live Server. Opening `index.html` over `file://` mostly
works too, but a local server is recommended (and required for PWA install).

## Run the tests

[Playwright](https://playwright.dev) end-to-end suite (matches the prior game's convention):

```bash
npm install
npx playwright install chromium
npm test
```

The test config (`tests/playwright.config.js`) auto-starts a static server on port **8383**.

- `tests/milestone0.spec.js` — boot/title, start→Stage 1, walking all seven stages → ending,
  global object/registry shape, Assist default + toggle, deterministic RNG, scene-teardown /
  no listener accumulation, and a content guardrail (no `kill/death/blood/gun/gore`).
- `tests/stage1.spec.js` — the **For Cyndie** dedication, Stage 1 real content (not the
  placeholder), dialogue advance, glowing-object tap, mentor montage (Ila/Chinook/Hades),
  the first-job choice recording state, handoff to Stage 2, and no listener leaks on replay.

---

## Tech notes & deviations

- **No framework.** The prior game (`AnthonyAdventure2/`) loaded **Phaser 3** from a CDN; this
  project deliberately stays pure vanilla DOM/Canvas per the design brief ("small static
  vanilla-JS arcade game"). The portable patterns — DOM UI overlay, procedural WebAudio,
  `DialogueManager`, and the Playwright/`http-server` test setup — were ported; Phaser was not.
- **Service worker / offline:** **deferred to a later milestone.** The PWA `manifest.json` is
  valid and the app is installable, but full offline support (a service worker) is not wired up
  yet. Fonts currently load from Google Fonts CDN with a system-font fallback.

## Deploy (GitHub Pages)

Static files only — push to `main`, then **Settings → Pages → Branch: main → / (root)**.
No CI build required.

---

Built for Cyndie, Anthony, and the boys. Nick's fault. 🐾
