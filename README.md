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

### Milestone 6 — Stage 6: "Hades Teaches Management" ✅ (current)

The original **"Throne of Composure"** — a reverse-whack-a-mole where the winning skill is
**restraint**. Hades (a large, athletic, imperious, code-drawn spotted cat) teaches that being
in charge means doing *less*, deliberately.

- Tap what matters (**the boys**, the empty bowl, a gentle squabble) to raise **Household
  Happiness**; **ignore the junk** (doorbell, leaf, noise) — tapping it **drains Composure**.
- **Claim the sunbeam** for strategic rest (restores Composure) and **Delegate** tedious tasks
  to a helper (limited uses) — a leader empowers others.
- **Composure** zero = Merlin spirals into adorable chaos, Hades sighs, the room resets — a
  comedy reset, **never a game-over**. Hades demonstrates first.
- Hades's dry verdict **names Merlin's real gift** ("your management style is simply… being
  loved"), seeding the finale. Flags `stage6DemoComplete`, `stage6Round{1,2,3}Complete`,
  `stage6Complete` (+ `stage6DelegatedTask`, `stage6ComposureResetSeen`); hands off to
  `stage7-realjob`.

### Milestone 5 — Stage 5: "Merlin Goes Bird Dog" ✅

The "anti-Duck-Hunt" — the slow, patient reality behind the gallery. Merlin tries the real
bird-dog job himself and learns it's hard, careful work.

- Each find is a **scent-follow** (steady steps toward the bird) → **hold the point**
  (press-and-hold restraint meter) → **gentle flush on the handler's cue** (`Easy… easy… now`)
  so the **bird flies free**. No shooting, no catching, nothing is hurt.
- A rising **fatigue** meter across 3 escalating finds makes the work *feel* tiring; Merlin
  droops as he tires. The flush is locked until the handler's cue.
- A reflective tonal pivot: Merlin ends exhausted, respecting Chinook, openly wondering
  "it's just… not me, is it." (seeds the finale).
- Flags `stage5Find{1,2,3}Complete` + `stage5Complete`; hands off to `stage6-hades`. Assist
  mode cannot dead-end.

### Milestone 4 — Stage 4: "Chinook's Big Sniff" ✅

A family-safe Duck-Hunt-style spot-and-tap gallery — **not shooting**. **Chinook** (a sweet,
droopy 6-month-old bloodhound) **points**; you tap what he found.

- Chinook points (telegraph) → a target spawns → tap it: **ducks flap away happy**, **clay/foam
  discs puff harmlessly**. No weapons, no shooting, nothing is hurt.
- Playful **decoys** (butterfly, neighbor's hat, a Hades sunbathing cameo) reset combo with a
  funny scold — never a fail or dead-end.
- 3 waves, lightweight **score + combo**, and a **Big Sniff** meter that fills and triggers a
  bonus (double points). Spawns are **deterministic under `state.rngSeed`**.
- Flags `stage4Wave{1,2,3}Complete`, `stage4BigSniffTriggered`, `stage4Complete`; hands off to
  `stage5-birddog`. Assist mode cannot dead-end.

### Milestone 3 — Stage 3: "Ila Fight Scene" ✅

A family-safe side-view "fighter" (Tekken/MK energy, zero violence). **Ila** anchors; the player
times **Merlin's assists** to fill a **Teamwork** meter and trigger a finisher.

- Three assists: **Boof Bark**, **Tail Trip**, **Distraction Wiggle** (cooldowns, fill Teamwork;
  interrupting an opponent's "winding up!" telegraph gives a bonus).
- **Teamwork** fills → the **Boof & Bound!** finisher → the opponent **bonks, sees stars, drops
  loot, and scampers off**. No KO, no blood, no death.
- Three cartoon troublemakers: Garbage Goblin, Mischief Gremlin, The Mailman's Nemesis.
- The resource is **Pep**, not health — reaching zero is a comedy tumble + same-opponent retry,
  never a game-over. Assist mode cannot dead-end.
- Flags `stage3Opponent{1,2,3}Complete` + `stage3Complete`; hands off to `stage4-sniff`.

### Milestone 2 — Stage 2: "Ila's Working Dog Academy" ✅

Merlin's first apprenticeship: three short, distinct IGP-inspired drills under **Ila**, a
code-drawn black-and-tan working-line German Shepherd (tan points, upright ears, calm steady
stance — disciplined and kind, never aggressive).

- **Drill 1 — Tracking:** tap the scent pawprints in order; patient, steady scent-following.
- **Drill 2 — Obedience:** Ila demonstrates, then you tap the called command (Sit / Heel /
  Down / Stay) — listening and precision.
- **Drill 3 — Control:** hold the padded sleeve, then **release on Ila's "Out!"**. Releasing is
  rewarded; "keep holding" triggers a gentle comedy redo, never a fail. The lesson is that the
  hard part of strength is *stopping* — control and trust, not aggression.
- A progress indicator per drill; Assist mode cannot dead-end (a debug auto-play path drives
  each drill to completion). Hands off to `stage3-fight`.

### Milestone 1 — Stage 1: "Merlin's Career Crisis" ✅

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
- `tests/stage2.spec.js` — Stage 2 real content, direct entry + Ila identification, each of
  the three drills completing and setting its flag, control rewarding **release on "Out!"**
  (and holding giving a redo, not completion), full Assist auto-play → Stage 3, and a
  family-safe / control-focused content guardrail.
- `tests/stage3.spec.js` — Stage 3 real content, direct entry, Ila & Merlin present, cartoon
  opponent names, each assist filling Teamwork, the finisher's **stars-flee**, **Pep**-zero
  retry (not game-over), full Assist auto-play through all opponents → Stage 4, and a
  family-safe guardrail (Pep not health, flee not injury).
- `tests/stage4.spec.js` — Stage 4 real content, direct entry, Chinook identified + a canvas
  sanity check, point-before-target telegraph, duck **fly-off** / clay **puff**, non-failing
  decoys, score/combo, the Big Sniff bonus, **deterministic spawns under `rngSeed`**, full
  Assist auto-play through all waves → Stage 5, and a family-safe guardrail (no shooting).
- `tests/stage5.spec.js` — Stage 5 real content, direct entry, a canvas sanity check, scent
  strength → point phase, point-completes-via-hold, **flush locked until the cue**, gentle
  flush → **bird fly-free**, rising fatigue across finds, full Assist auto-play → Stage 6, and
  a family-safe guardrail (no shooting/catching; birds fly free).
- `tests/stage6.spec.js` — Stage 6 real content, direct entry, Hades identified + a canvas
  sanity check, demo flag, high-priority handling raising happiness, **junk draining Composure**,
  **sunbeam restoring it**, delegate consuming a use, **Composure-zero comedic reset (no
  game-over)**, full Assist auto-play → Stage 7, and a verdict/tone guardrail (names "being
  loved"; no cruelty).

> Note: clickable elements use `box-shadow`-only glow pulses (never animated `transform`), and
> tests advance via debug hooks (`drainDialogue`, `stage2AutoPlayDrill`) rather than
> timing-sensitive clicks — both keep the Playwright suite fast and deterministic.

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
