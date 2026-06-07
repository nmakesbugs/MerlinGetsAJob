# IMPLEMENTATION_ROADMAP.md
### Merlin Gets a Job — build order for a coding agent

Goal: ship a working, family-safe, PWA arcade game stage-by-stage with a green Playwright suite at every step. **No code in this doc** — this is the sequencing, the contracts each milestone must hit, and the definition of done. Build in the order below; each milestone is independently testable and demoable.

Stack (carried from "Anthony & Merlin's Adventure"): **vanilla JS, single `game.js`, `index.html`, `style.css`, `manifest.json`, no build step, GitHub Pages static deploy, Playwright tests.** Portrait 390×700, PWA-installable, procedural WebAudio.

---

## Milestone 0 — Project skeleton & harness
**Build:** Repo scaffolding mirroring the prior game: `index.html`, `game.js`, `style.css`, `manifest.json`, `tests/` (Playwright config + one smoke spec), `README.md`, `.gitignore`. Set up the **scene manager**, global `__merlinGame.state`, the ported `DialogueManager`, the ported procedural `Audio` module (stubs for new motifs/SFX), and a seedable `rng`. A title screen + an empty placeholder for each of the 7 stages that just calls `goToStage(next)`.
**Done when:**
- [ ] `index.html` loads, portrait frame renders, PWA manifest valid (installable).
- [ ] Scene manager can walk title → stage1 → … → stage7 placeholders and back to title.
- [ ] `exit()` teardown verified (no listener leaks between scenes).
- [ ] Playwright smoke test: app boots, title renders, can reach each stage placeholder.
- [ ] No build step; opening `index.html` (or a static serve) just works.

## Milestone 1 — Stage 1: Career Crisis (vertical slice of "feel")
**Why first:** establishes tone, the only control (tap), DialogueManager in anger, and the scene-handoff pattern every other stage copies.
**Build:** Title art, intro montage, tutorial taps, glowing-object tap, no-wrong-answer first-job choice, Home lullaby motif (partial), handoff to Stage 2.
**Done when:** Stage 1 acceptance criteria in STAGE_PLAN.md all pass; Playwright asserts dialogue advance, glow-tap, choice recorded, handoff. This is the first **demoable build for Cyndie.**

## Milestone 2 — Stage 2: Ila's Academy (the "drill" toolkit)
**Why second:** builds the three reusable minigame primitives — **timed-tap, follow-path/drag, hold-steady** — that Stages 3–6 reuse. Investing here pays off everywhere.
**Build:** Tracking (follow-path), Obedience (timed-tap on beat), Control-Release (hold-then-release-on-cue). Ila sprite + demo-first pattern. (Assist/Challenge profiles were removed in 0.82 — single warm default mode.)
**Done when:** Stage 2 acceptance criteria pass; the protection drill rewards release-on-cue (control, not aggression); Assist auto-completes in tests; three drills individually testable.

## Milestone 3 — Stage 4: Chinook's Big Sniff (reaction/aim primitive)
**Build order note:** do the **gallery before the fighter** — it's simpler, reuses the timed-tap/telegraph primitive, and de-risks Stage 3.
**Build:** Wave spawner (seeded), Chinook point-telegraph, tap-to-spot, poof/fly-off + clay-shatter, decoys (funny, non-failing), combo + Big Sniff bonus round. Chinook sprite. Family-safety guardrails (no weapon/blood; reticle = scent-spot).
**Done when:** Stage 4 acceptance criteria pass; deterministic under seed; content-guardrail test (no forbidden strings/assets) green.

## Milestone 4 — Stage 3: Ila Fight Scene (juice + teamwork)
**Why after the gallery:** reuses telegraph + timed-tap, adds the Teamwork Meter and assist-cooldowns. Highest "juice" stage; budget animation polish here.
**Build:** Side-view layout, Ila anchor (AI), Merlin assists (Boof/Tail-Trip/Wiggle) on cooldown, Teamwork Meter + finisher, "Pep" (instant-retry, never game-over), 3 cartoon opponents with stars-and-flee defeats. Reinforce "controlled timing beats mashing."
**Done when:** Stage 3 acceptance criteria pass; guardrail test asserts no ko/death/blood states or assets; opponents always exit via flee; finisher fires on full meter.

## Milestone 5 — Stage 5: Bird Dog (the tonal pivot)
**Build:** Scent-gradient follow, the hold-steady **point** (reuse Stage 2 hold primitive), cued gentle flush (bird flies free), fatigue meter that visibly tires Merlin, escalating finds, the exhausted outro line that questions "is this my job?" Begin fragmenting the Home motif underneath.
**Done when:** Stage 5 acceptance criteria pass; no shoot/catch mechanic exists; theme reads as patience/steadiness/helping; the doubt-seeding outro plays and hands to Stage 6.

## Milestone 6 — Stage 6: Hades — Throne of Composure (original mode)
**Build:** Top-down/iso room, event spawner with **priority system** (high/low/ignore/rest/med), Composure resource (junk drains, ignoring + sunbeam-rest restores), comedic-spiral reset on zero, Delegate (limited uses → helpers), Hades demo-first, household-happiness goal, Hades's verdict that names Merlin's real gift. Hades sprite (regal idle, slow-blink, paw-tap, athletic leap).
**Done when:** Stage 6 acceptance criteria pass; restraint/strategic-rest are the winning strategy (a test confirms tapping-everything *loses* composure); reset is comedic not game-over; verdict foreshadows finale.

## Milestone 7 — Stage 7: Merlin's Real Job (the payoff)
**Build:** Golden-hour home, tired homecoming + doubt, three lesson callbacks (Ila stay / Chinook nose / Hades composure), warm tap-through interactions (Joy meter, monotonic), the sincere realization line (comedy suppressed), full family tableau with the Home motif **resolved**, optional credits, "The End."
**Done when:** Stage 7 acceptance criteria pass; tone-shift verified (no comedy SFX during realization beat); each mentor lesson gets a callback; final tableau + credits render. **This is the emotional acceptance gate — review with Cyndie.**

## Milestone 8 — Polish, accessibility, PWA, ship
**Build:** Assist/Challenge toggle in a simple settings/title menu; optional localStorage resume (furthest stage); audio mix pass (motifs cohere, Home lullaby arc lands); accessibility pass (tap-target sizes, contrast, skippable dialogue); offline PWA verification; cross-device portrait scaling; final content-guardrail sweep; README with deploy + PWA-install instructions (mirror prior game's).
**Done when:**
- [ ] Whole-game cross-stage acceptance (STAGE_PLAN.md bottom) passes end-to-end.
- [ ] Full Playwright suite green (one spec per stage + smoke + guardrails + an Assist auto-play-to-end run).
- [ ] Installable PWA, works offline, portrait on phone, 60fps on mid-range device.
- [ ] No gore/violence/scary content anywhere; mentors portrayed respectfully (manual review).
- [ ] README + deploy instructions complete.

---

## Testing strategy (Playwright, one spec per stage)
- **Smoke:** boot, title, reach every stage.
- **Per-stage:** assert that stage's acceptance criteria from STAGE_PLAN.md, using `__debug`/seeded RNG hooks. Assert scene `exit()` teardown.
- **Assist auto-play:** a test that drives the *entire game* in Assist with minimal/no skill and confirms it reaches "The End" — proves the no-dead-end guarantee.
- **Guardrail suite:** scan loaded content objects/assets for forbidden strings/states (see CONTENT_SCHEMA.md §8); assert Stage 3 flee-defeats, Stage 4 harmless hits, Stage 5 no-shoot/catch, Stage 6 comedic reset, Stage 7 comedy-suppressed climax.
- **Determinism:** seeded spawns in Stages 4/5/6 reproduce identically under a fixed `rngSeed`.

## Git / delivery workflow
- Work locally on a feature branch per milestone (e.g. `stage-1-career-crisis`). Keep commits scoped to a milestone.
- Each milestone = a self-contained PR with its tests green; **you (Nick) push to the GitHub host and open/merge the PR.**
- Static deploy via GitHub Pages (Settings → Pages → main → / root), identical to the prior game. No CI build required, though a Playwright GitHub Action is a nice-to-have.
- Suggested branch order matches milestones 0→8. Stages can be demoed to Cyndie incrementally (Milestone 1 is the first shareable build; Milestone 7 is the emotional review gate).

## Risk register / sequencing rationale
- **Build the gallery (Stage 4) before the fighter (Stage 3):** simpler, de-risks the shared telegraph/timed-tap primitive.
- **Front-load Stage 2's drill primitives:** timed-tap, follow-path, hold-steady are reused by Stages 3, 5, 6 — get them solid early.
- **Stage 7 is the whole point:** protect schedule for it; it's small in mechanics but highest in emotional stakes. Don't let earlier polish eat its time.
- **Family-safety is a test, not a vibe:** the guardrail suite must be green from the first stage that could violate it (Stage 3), so safety can't regress.
- **Keep it code-drawn:** lean on procedural shapes/CSS/WebAudio like the prior game to keep payload tiny and the build dependency-free.
```
