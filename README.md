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

### 1.0 — Final QA / Deploy Polish ✅ (current · release candidate)

Final readiness pass before GitHub Pages. No narrative expansion, no gameplay/mechanics changes.

- **Static title-HUD artifact removed:** `index.html` no longer ships `<span id="hud-stage">Title</span>`
  — the span starts empty, so there's no stray "Title" flash before JS boots. `TitleScene` still
  calls `setHud('')` at runtime.
- **Offline PWA support added:** a minimal versioned `sw.js` (cache-first, `merlin-gets-job-v1.0`),
  registered silently and safely from `game.js`. See *Tech notes* below.
- **Docs reconciled to the correct family geography:** Merlin lives with **Nick's family and the
  three boys** (Merlin's boys). Cyndie *requested* the game and loves cuddling Merlin **when she
  visits** Nick's house — Merlin is **not** Cyndie's dog and does **not** live with her. Hades is
  Anthony & Cyndie's cat. Chinook is **male** (he/him). "For Cyndie" dedication intact. Fixed stale
  framing in `DESIGN_BIBLE.md`, `CHARACTER_BIBLE.md`, and the `finalTableau` schema in
  `CONTENT_SCHEMA.md` (mentor cameo icons, not Anthony/Cyndie).
- **Cache bumped to `?v=1.0`** on `game.js` + `style.css`.
- **Deploy hygiene verified:** no duplicate DOM IDs, every `getElementById` target exists in
  `index.html`, no Assist/Challenge residue, no `debugger`/`console.log` debug noise, no temp
  scripts, no committed `node_modules`/`test-results`.
- Full suite: **111 passed, 0 failed** (110 + a new service-worker registration test).

### 0.91 — QA micro-patch ✅

Finalization of the 0.9 narrative pass:

- **Stage 5 thesis tightened:** "It's just… not *my job*, is it." (ties the bird-dog realization directly to the game's title).
- **Chinook pronoun corrected:** he/him throughout Stage 7 homecoming ("He is six months old.").
- **Mentor-action callbacks in realization:** "To find the toy, hold still, let the little one win, and flop close enough that nobody has to ask if they are loved." — connects each learned skill to the finale without adding dialogue lines.
- **Title-screen HUD artifact removed:** the stale "Title" label in the top-left HUD is now cleared on the title screen.
- Cache bumped to `?v=0.91`. Full suite: **110 passed, 0 failed**.

### 0.9 — Narrative & Emotional Pass ✅

Surgical writing pass — mechanics unchanged from 0.82/0.82.1.

- **Stronger Merlin voice:** short declarative sentences, dog-literal earnestness ("I am deeply,
  professionally exhausted."), over-serious about "career" and "follow-through."
- **Cyndie hello/cuddle continuity** in Stage 1 with correct geography: Cyndie *visits* and says
  Merlin is very good at cuddling. Merlin's hello-saying is declared a serious duty ("if someone
  misses it, I say hello again — that is follow-through").
- **Stage 7 homecoming sharpened:** Merlin names each mentor with admiration, then doubts
  himself; the boys' greeting triggers the hello callback ("Hello! I am here! If you missed it
  the first time, I can say it again. That is my policy.") — echoing Stage 1 without
  mentioning Cyndie.
- **Stage 7 realization tightened (7 lines):** "The boys do not need me to be Ila / Chinook /
  Hades. They need me to be theirs. To find the toy, hold still, let the little one win, and
  flop close enough that nobody has to ask if they are loved. My job is making them happy. I
  had it the whole time." *(0.91 expanded the flop line into the mentor-action callback.)*
- **Stage 7 tableau:** Hades adds one dry second line: "Do not tell him I said so."
- Stage 5 outro first line sharpened for Merlin voice.
- **Cyndie geography preserved throughout.** No line implies Merlin lives with Cyndie or that
  she is his owner. "For Cyndie" dedication intact.
- Cache bumped to `?v=0.9`. Full suite: **110 passed, 0 failed**.

### 0.82.1 — Stage 4 finalization micro-patch ✅

Tiny playtest-tuning patch (not a narrative pass):

- **Stage 4 chase +15%:** target movement is a touch quicker (`S4_SPEED_MULT = 1.15`, applied
  once in `_moveTargets`). Relative feel preserved — duck still lazier than clay, clay still
  fastest/shortest-lived, Big Sniff still slows the chase.
- **Point marker on every round:** a bold DOM ring (`.s4-point-mark`, with a 👃) now shows where
  the find will appear during **every** telegraph, not just during Big Sniff. Big Sniff makes it
  stronger; it's removed when the target spawns and on stage exit.
- **Cleanup:** removed the last stale Assist/Challenge CSS (`#assist-toggle`, `.s6-event.*.challenge`)
  and neutralized the "Assist only" comment. (Stage 3's *Boof Bark / Tail Trip / Distraction
  Wiggle* "assists" are combat actions, not the removed difficulty mode — left intact.)

### 0.82 — Mechanics Simplification + Chinook Fun Patch ✅

- **Removed Assist/Challenge entirely.** There is now **one warm, easy, lightly-skillful default
  mode** — no HUD toggle, no `state.assistMode`, no difficulty menu. Stars and Merlin Medals
  remain as optional feedback.
- **Stage 4 / Chinook is more fun:** Chinook still points to the starting spot, but the target
  now **moves after it appears** (duck drifts slowly, clay zips and is shorter-lived, decoys
  flutter/drift, the Hades cameo is clearly "do not tap"). A primary you never tap **drifts away
  harmlessly** ("It got away — Chinook points again!") and the round advances — never a fail.
  Big Sniff **slows the chase** and highlights the field.
- **Stage 5 / gentle flush timing:** after the handler's cue, a **center-screen timing bar**
  sweeps a marker; tap inside the sweet spot for a *perfect gentle flush*, or anywhere else for
  a *"close enough — the bird flies free!"* Either way the bird flies free; it's forgiving and
  never repeats.
- **Stages 6 & 7 preserved** from 0.81 (rules card, legend, visible Delegate; three boys,
  sequential interactions).

### 0.81 — Gameplay Polish Patch ✅

Focused UX/clarity polish from playtest feedback (not the narrative pass):

- **Stage 6 / Hades clarity:** a one-time **"How to Manage" rules card** + a persistent legend
  (🟡 handle · ⌁ ignore · ☀️ rest · 🤝 delegate); clear event coding incl. a "can delegate" cue;
  explicit feedback when you tap junk ("That was junk — Composure down."), rest the sunbeam, or
  ignore correctly. **Delegate now visibly works** — it resolves the best eligible task with a
  helper response ("Chinook handled it!"), or says "Nothing worth delegating yet" without wasting
  a use.
- **Stage 4 / Chinook fun:** Chinook now **points at where the target will appear** (nose-line +
  scent cone + ring), the target spawns there, light per-kind variety, an obvious "do not tap"
  Hades cameo, and a **Big Sniff** field highlight + slower, clearer point.
- **Stage 7 / finale:** now shows **three boys**, presents interactions **one warm card at a
  time** (no crowded 6-button panel), and a clearer prompt ("fill the room with Joy"). Still
  sweet, no-fail, Joy-only-rises.

### 0.8 — Gameplay & Mechanics Pass ✅ (historical — Assist/Challenge later removed in 0.82)

> Prior history. The Assist/Challenge split described below was **removed in 0.82**; the game now
> has a single warm default mode. Kept here only as a record of the 0.8 milestone.

Made the game feel like a real game without losing the warmth. **Assist Mode stays easy and
guaranteed-finishable**; **Challenge Mode** is now meaningfully more thoughtful.

- **Real star scoring (Stages 2–6):** 1–3 stars based on actual performance (clean tracking /
  varied assists / decoy avoidance / steady holds / restraint), no longer always 3. Stars never
  block progress. Stage 1 and Stage 7 stay at a gentle 3.
- **Merlin Medals** (optional standout play, shown as a small end-of-stage toast):
  `perfect-out` (S2), `teamwork-pro` (S3), `nose-first` (S4), `steady-boy` (S5),
  `catlike-composure` (S6), plus a warm `real-job` completion medal (S7). Stored in
  `state.medals`.
- **Challenge tuning:** longer/shuffled obedience (S2), preferred-assist + repeat-penalty (S3),
  smaller targets + earlier/more decoys (S4), faster fatigue + steadier-hold demands (S5),
  subtler cues + tougher composure (S6). The lesson is restraint and judgment, never twitch
  difficulty — and there is still no story-blocking failure anywhere.

### Milestone 7 — Stage 7: "Merlin's Real Job" ✅ — all seven stages playable

The emotional finale. Merlin comes home tired and unsure whether he ever found a "real job" —
then the boys greet him and he realizes his job was here all along.

- A golden-hour home; warm tap-through interactions (flop, the goofy thing, sniff out the lost
  toy, group hug, hold-still-for-a-photo, let-the-little-one-win) fill a **monotonic Joy meter**
  that only ever rises. No fail state, no difficulty.
- Three **mentor callbacks** show the apprenticeships mattered — Ila's *stay* (photo),
  Chinook's *nose* (find the toy), Hades's *composure* (let the little one win).
- When Joy is full, **comedy steps back** and the sincere realization lands: *"My job is making
  them happy. I've had it the whole time."* Ends on a held tableau (mentor cameo icons, the Home
  motif resolved), then **The End** + Play Again.
- Merlin lives with the family and the boys; the title's **"For Cyndie"** dedication stays
  intact. Flags `stage7Started`, `stage7{Ila,Chinook,Hades}CallbackComplete`, `stage7JoyFull`,
  `stage7Complete`.

### Milestone 6 — Stage 6: "Hades Teaches Management" ✅

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
- `tests/stage7.spec.js` — Stage 7 real content, direct entry, a canvas sanity check, the Joy
  meter starting at 0 and **only increasing**, the required interactions, the three **mentor
  callbacks**, Joy-full → **comedy-suppressed realization**, the realization naming Merlin's job,
  the finale tableau + **The End** + **Play Again → title**, and a guardrail (no failure/sadness,
  correct home geography, "For Cyndie" dedication intact).

> Note: clickable elements use `box-shadow`-only glow pulses (never animated `transform`), and
> tests advance via debug hooks (`drainDialogue`, `stage2AutoPlayDrill`) rather than
> timing-sensitive clicks — both keep the Playwright suite fast and deterministic.

---

## Tech notes & deviations

- **No framework.** The prior game (`AnthonyAdventure2/`) loaded **Phaser 3** from a CDN; this
  project deliberately stays pure vanilla DOM/Canvas per the design brief ("small static
  vanilla-JS arcade game"). The portable patterns — DOM UI overlay, procedural WebAudio,
  `DialogueManager`, and the Playwright/`http-server` test setup — were ported; Phaser was not.
- **Service worker / offline (1.0):** a tiny `sw.js` precaches the essential same-origin assets
  (`./`, `index.html`, `game.js?v=1.0`, `style.css?v=1.0`, `manifest.json`) with a cache-first
  strategy and a versioned cache name (`merlin-gets-job-v1.0`). It registers silently from
  `game.js` (only over http/https, when `navigator.serviceWorker` exists) and does **not** call
  `clients.claim()`, so offline support kicks in on the *next* visit and it never interferes with
  the running session or the Playwright tests. **When you bump the cache `?v=` on a future
  release, also bump the `CACHE` name and the `ASSETS` query strings in `sw.js`.** Fonts still
  load from the Google Fonts CDN with a system-font fallback (those are cross-origin and pass
  straight through to the network).

## Deploy (GitHub Pages)

Static files only — push to `main`, then **Settings → Pages → Branch: main → / (root)**.
No CI build required.

---

Built for Cyndie, Anthony, and the boys. Nick's fault. 🐾
