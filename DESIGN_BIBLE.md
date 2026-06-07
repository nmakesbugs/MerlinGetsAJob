# DESIGN_BIBLE.md
### Merlin Gets a Job — the third Merlin family arcade game

> "Everybody's got a job. Even the cat. *Especially* the cat."
> — Merlin, immediately before learning what a job is.

---

## 1. One-paragraph pitch

Merlin, the family dog, decides it's time to grow up and **get a job** like all his impressive animal friends. He apprentices under Ila (a disciplined working-line German Shepherd), Chinook (an earnest young bloodhound), and Hades (an enormous, imperious cat who runs the household). He tries each job, discovers every one of them is harder and more admirable than it looked, and finally realizes his *real* job — the one only he can do — is being the family dog who makes the boys happy and laughing. It is funny the whole way through and sincere at the end.

## 2. Pillars (every design decision serves these)

1. **Warmth over winning.** The game is affectionate first, arcade second. You should never be able to "lose" in a way that feels bad. Failure is comedy, not punishment.
2. **Respect the mentors.** Ila, Chinook, and Hades are *good at their jobs.* The humor comes from Merlin, the lovable amateur — never from mocking the people teaching him. Schutzhund/IGP, bird-dog work, and "cat in charge" are portrayed as genuinely skilled disciplines.
3. **Earn the ending.** Stages 2–6 each plant the same seed: real jobs take discipline, patience, and care. The finale pays it off — Merlin's job is real too, it just looks like cuddles.
4. **Family-safe, always.** No gore, no real violence, no death, no scary content. Fighting is cartoon-slapstick. Hunting is scent-and-find, never shooting an animal that bleeds. The duck gallery uses clay-pigeon / foam targets and cartoon ducks that "poof" and fly off unharmed.
5. **Pick-up-and-play.** One thumb, portrait phone, no instructions needed. A 6-year-old and a grandparent can both play.

## 3. Tone & humor guide

- **Merlin** is the comic engine: over-eager, easily distracted, narrates his own competence wildly inaccurately ("I am ESSENTIALLY a professional now"), gets out-thought by a cat.
- Humor is **kind**. We laugh *with* Merlin's enthusiasm, never *at* anyone's expense.
- Running gags: Merlin mishears every technical term ("Schutzhund" → "Shoots-the-hound?"); Merlin treats treats as a unit of currency; Hades never once does what Merlin expects; the boys cheering off-screen.
- The emotional turn is **sincere and unironic.** When the tone shifts in Stage 7, the jokes step back and let the feeling land.

## 4. Cast (see CHARACTER_BIBLE.md for full sheets)

| Character | Role | One-liner |
|---|---|---|
| **Merlin** | Player / comic hero | The family dog who wants a "real job." |
| **Ila** | Mentor — protection/discipline | Mostly-black black-and-tan working-line GSD, IGP-trained. Calm, exact, kind. |
| **Chinook** | Mentor — scent/field | 6-month-old bloodhound, all nose and heart, still learning. |
| **Hades** | Mentor — management | Very large African-breed-style house cat. Imperious, brilliant, in charge. |
| **The Boys** | The heart | Anthony & Cyndie's kids — the ones Merlin is really working for. |
| **Anthony & Cyndie** | The family | Appear at the edges; the home everyone belongs to. |

## 5. The seven stages at a glance

| # | Stage | Inspiration | Core verb | Lesson planted |
|---|---|---|---|---|
| 1 | Merlin's Career Crisis | Visual-novel tutorial | Choose / tap | "Maybe I need a job." |
| 2 | Ila's Working Dog Academy | Schutzhund/IGP training | Track / hold / obey | Discipline & control are skills. |
| 3 | Ila Fight Scene | Tekken/MK (family-safe) | Time / combo | Courage is *controlled*, and Merlin helps best as a teammate. |
| 4 | Chinook's Big Sniff | Duck Hunt | Aim / tap | Focus and a good nose win the day. |
| 5 | Merlin Goes Bird Dog | Field scent sim | Sniff / point / steady | Hunting work is patience, not chasing. |
| 6 | Hades Teaches Management | Triage / "calm" minigame | Prioritize / restrain | Being in charge means doing *less*, on purpose. |
| 7 | Merlin's Real Job | Emotional finale | Cuddle / play | His job is making the boys happy. |

## 6. Emotional arc (the spine)

```
Stage 1   Restlessness   "I don't have a job. I should."
Stage 2   Awe            "Ila is incredible. This is HARD."
Stage 3   Belonging      "I helped! ...as a sidekick, but I helped."
Stage 4   Humility       "Chinook makes it look easy. It is not easy."
Stage 5   Exhaustion     "Real work is patient and slow and tiring."
Stage 6   Realization    "Even being the boss is a real, careful job."
Stage 7   Homecoming     "MY job was here the whole time."
```

Every stage ends with Merlin admiring the mentor and quietly noticing he's still not *quite* it. Stage 7 resolves the ache.

## 7. Aesthetic direction

- **Format:** 390×700 portrait, single-screen scenes, scales to fit any phone. Matches the prior game's frame.
- **Look:** Clean, warm, storybook-arcade. Bold flat shapes, thick outlines, expressive eyes. Readable at arm's length in sunlight.
- **Palette:** Warm home base (creams, warm browns, soft golds). Each mentor gets an accent: **Ila = deep navy/charcoal + tan**, **Chinook = russet/auburn + cream**, **Hades = royal purple + gold**, **Home/Merlin = warm amber**. The finale saturates into golden-hour warmth.
- **Type:** One chunky display font for titles, one highly legible sans for dialogue. Large text, generous spacing.
- **Motion:** Squash-and-stretch, bouncy easing, lots of little idle animations (tail wags, ear twitches, Hades's tail-flick). Juice = joy.

## 8. Audio direction

- Reuse the prior game's **WebAudio synth** approach (no audio files to ship; everything procedural). See CONTENT_SCHEMA.md §Audio.
- Each mentor has a short musical motif (a few synth notes): Ila = steady marching minor; Chinook = bouncy curious major; Hades = regal, slightly smug fanfare; Home = warm lullaby that returns, fully, in Stage 7.
- Family-safe SFX only: boofs, taps, sniff-snuffles, "poof," cheering boys, a contented sigh. No real-weapon or impact-pain sounds — fight hits are cartoon "bonk/boing."

## 9. Family-safety rules (hard constraints — non-negotiable)

- No blood, no injury, no death, no real weapons aimed at living things.
- Stage 3 (fight): opponents are silly cartoon "bad guys" (e.g. a Mischief Gremlin, a Garbage Goblin who knocks over cans). They get bonked, see stars, and run away comedically. No human-on-human or animal-on-animal cruelty.
- Stage 4 (Duck Hunt homage): targets are **clay/foam discs and cartoon ducks that "poof" into feathers and fly off happy.** A reticle, never a realistic gun pointed at a real animal. Optionally frame it explicitly as a *scent-and-spot* game where Chinook "points" and you tap the bird Chinook found.
- Stage 5: bird-dog work ends with a bird *found and gently flushed*, then flying free. Nobody is hurt.
- Nothing scary, no dark themes, no potty humor beyond gentle, no romance. Respectful of the real disciplines.

## 10. Tech stack & constraints (carried from the prior game)

- **Vanilla JS, no framework, no build step.** `index.html` + `game.js` + `style.css` + `manifest.json`. Static files deployable to GitHub Pages as-is.
- Scene-manager architecture (one active scene at a time), a shared `DialogueManager`, procedural WebAudio. Mirror the prior game's patterns so a coding agent can lift them.
- **PWA**: installable to phone home screen, portrait-locked, offline-capable.
- **Playwright** test suite, one spec per stage, asserting scene transitions and acceptance criteria.
- Single global game-state object; deterministic, test-seedable RNG for the gallery/field stages.
- Target: runs at 60fps on a mid-range phone; total payload small (no large assets).

## 11. Accessibility & "everyone can play"

- All minigames have a gentle **Assist** default (generous timing windows, no fail-out). An optional "Challenge" toggle tightens windows for older kids/adults.
- Big tap targets (min 44px), high contrast, no reliance on color alone (icons + text).
- Skippable/auto-advancing dialogue; nothing requires reading speed.
- No twitch-precision required to *progress* — skill affects score/flair, never whether you can finish the story.

## 12. Out of scope (v1)

- No accounts, no network, no leaderboards, no purchases, no analytics.
- No additional mentors beyond Ila, Chinook, Hades.
- No save system beyond optional localStorage "furthest stage reached" (nice-to-have, not required for v1).

---
*See STAGE_PLAN.md for per-stage build specs, CHARACTER_BIBLE.md for cast sheets, CONTENT_SCHEMA.md for data formats, and IMPLEMENTATION_ROADMAP.md for build order.*
