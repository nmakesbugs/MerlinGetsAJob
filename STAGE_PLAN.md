# STAGE_PLAN.md
### Merlin Gets a Job — per-stage build specifications

Each stage below is written to be implemented and tested independently. Format is identical per stage:
**Goal · Player verb · Mechanics · Flow · Dialogue flavor · Emotional beat · Assets · Difficulty/Assist · Testing notes · Acceptance criteria.**

Global rules: portrait 390×700, one thumb, Assist-on by default, no fail-out that blocks the story, every stage ends by handing off to the next via the scene manager. Reuse the shared `DialogueManager`, scene lifecycle (`enter/update/exit`), and procedural audio.

---

## Stage 1 — Merlin's Career Crisis
*Intro / tutorial. Inspiration: warm visual-novel + one-tap tutorial.*

- **Goal:** Establish Merlin, the family, the comedic premise, and teach the only control the player needs: **tap to advance / tap the highlighted thing.**
- **Player verb:** Tap.
- **Mechanics:**
  - Title card → animated intro. Merlin watches his friends "have jobs" through a storybook montage (Ila training, Chinook sniffing, Hades supervising).
  - 2–3 **tutorial taps**: tap to advance dialogue; tap a glowing object (Merlin's empty food bowl, a tiny briefcase that appears) to make a choice.
  - A single light **choice** with no wrong answer: "What job should Merlin try first?" (all roads lead forward; the choice just flavors the next line).
- **Flow:** Logo → cold-open gag → Merlin's monologue ("Everyone has a job but me") → meet-the-mentors montage → Merlin resolves to apprentice → tutorial taps mastered → "Off to Ila's!" transition.
- **Dialogue flavor:**
  - Merlin: *"Anthony has a job. Cyndie has a job. The CAT has a job, and he mostly sleeps on the warm laptop. I, a serious adult dog, have NO job. This is a crisis. A career crisis."*
  - Merlin: *"I will simply… get one. How hard could a job be?"* (beat) *"It's going to be very hard, isn't it."*
- **Emotional beat:** Restlessness + warmth. We love Merlin instantly and root for him.
- **Assets:** Title art, Merlin idle + "determined" pose, mentor cameo sprites, food bowl + briefcase props, home interior background, intro music (warm lullaby motif — the one that returns in Stage 7), tap/click SFX.
- **Difficulty/Assist:** None. Pure tutorial; cannot fail.
- **Testing notes:** Assert title renders, dialogue advances on tap, the glowing-object tap registers, choice records a value, scene hands off to Stage 2.
- **Acceptance criteria:**
  - [ ] First meaningful tap advances dialogue within 1 frame; no instructions screen needed.
  - [ ] At least one glowing interactive object teaches "tap the highlighted thing."
  - [ ] A no-wrong-answer choice is recorded to game state.
  - [ ] Scene transitions cleanly to Stage 2 and tears down its own listeners.

---

## Stage 2 — Ila's Working Dog Academy
*Schutzhund/IGP-inspired training. Inspiration: rhythm/precision skill drills.*

> Represent IGP respectfully: **tracking, obedience, and protection are about discipline, focus, courage, and control — never uncontrolled aggression.**

- **Goal:** Three short, distinct skill drills mirroring IGP's three phases. Teach Merlin (and player) that working-dog skill = focus + control.
- **Player verb:** Follow / hold / release on cue.
- **Mechanics (3 mini-drills, ~30–45s each):**
  1. **Tracking** — A scent trail of faint footprints winds across the field. Drag/tap to keep Merlin's nose **on the trail** at a steady pace; going too fast loses the scent (gentle reset, not failure). Score = how much of the trail is followed cleanly. *Lesson: patience and a steady nose.*
  2. **Obedience** — A "Simon-says" cue rhythm. Commands appear ("Sit," "Heel," "Down," "Stay"); tap the matching button **on the beat**. Ila demonstrates flawlessly first. *Lesson: precision and listening.*
  3. **Protection / Control** — The *control* drill, not an aggression drill. A cartoon "decoy" runs a padded-sleeve bite-and-release exercise. The skill being tested is the **"Out!" (release on command)**: Merlin must **let go the instant Ila calls it.** Holding past the cue = over-eager comedy, not reward. *Lesson: the hard part of power is stopping. Courage under control.*
- **Flow:** Ila greets Merlin → demonstrates each drill perfectly → Merlin attempts → comedic near-misses → Ila gives calm, encouraging correction → Merlin completes all three (Assist guarantees eventual success) → Ila: "Good. You have heart. Control comes with time."
- **Dialogue flavor:**
  - Ila (calm, exact, kind): *"A working dog is not the loudest dog. It is the dog who waits, watches, and acts only when asked."*
  - Merlin (mishearing): *"So Schutzhund means… 'shoots the hound'?"* Ila: *"It means 'protection dog.' It is about trust."* Merlin: *"…I knew that."*
  - On the Out drill: Ila: *"Out."* Merlin (muffled, still holding sleeve): *"Bud I worked so hard fur dis sleeve."* Ila: *"Out, Merlin."* Merlin: *"Okay okay — out, out, very disciplined, look at me."*
- **Emotional beat:** Awe + humility. Ila is genuinely impressive; Merlin is trying his heart out.
- **Assets:** Ila sprite (idle, demo, "Out" command pose), Merlin tracking/sit/heel/hold poses, scent-trail footprints, padded decoy (clearly a friendly cartoon helper in a padded suit), training-field background, on-beat cue UI, Ila motif (steady minor march), snuffle/"good dog" SFX.
- **Difficulty/Assist:** Assist = wide timing windows, infinite retries, drills auto-pass after a few tries with encouragement. Challenge = tighter windows, star rating.
- **Testing notes:** Each drill is its own testable sub-module. Assert: trail completion tracked; obedience taps scored against beat; the Out drill *rewards releasing on cue and gently penalizes holding* (penalty = redo prompt, never a hard fail). Assert all three completable in Assist.
- **Acceptance criteria:**
  - [ ] Three distinct drills (track / obey / control-release) present and individually playable.
  - [ ] The protection drill rewards **release on command**, framing control as the skill — never aggression.
  - [ ] Ila demonstrates each drill before the player attempts it.
  - [ ] Assist mode cannot dead-end; player always reaches Ila's closing line and Stage 3.

---

## Stage 3 — Ila Fight Scene
*Family-safe side-view fighter. Inspiration: Tekken/Mortal Kombat, scrubbed of all violence.*

> Family-safe means: cartoon "bad guys," bonks not blood, stars-and-running-away, comedic. Ila fights with **controlled skill**; Merlin assists as the heart-of-gold sidekick.

- **Goal:** A short, juicy 1-screen fighter where **Ila** (AI-assisted hero) takes on a few cartoon troublemakers and **Merlin helps** via timed assist moves. Payoff of Stage 2's "courage under control."
- **Player verb:** Time taps / simple combos (Merlin's assists), with Ila as the anchor.
- **Mechanics:**
  - Side-view, two facing fighters. **Ila is the powerhouse**; the player primarily controls **Merlin's assist actions** (a "Boof Bark" stun, a "Tail Trip," a "Distraction Wiggle") on cooldown, plus a shared **Teamwork Meter** that fills as you time assists well and unleashes a finisher.
  - 2–3 silly opponents in sequence: e.g. **Garbage Goblin** (knocks over cans), **Mischief Gremlin** (steals shoes), and a mini-"boss" **The Mailman's Nemesis** (purely comedic). Each "defeat" = opponent gets bonked, sees cartoon stars, drops the stolen item, and **runs away laughing/embarrassed.** No injury, no K.O. screen — a "They scampered off!" banner.
  - Block/dodge = a single well-timed tap (Assist auto-blocks if you're slow). Merlin can faint-comedically when bonked but pops back up with hearts.
  - **Family-safe HP:** call it "Pep" / "Spirit," not health. Reaching zero = a funny tumble + instant retry, never a death/game-over.
- **Flow:** Bad guys cause cartoon chaos in the neighborhood → Ila steps in, calm and ready → tutorial prompt for Merlin's first assist → fight 1 → fight 2 → teamwork finisher on the mini-boss → bad guys flee → Ila: "You watched, you waited, you helped at the right moment. That is the work."
- **Dialogue flavor:**
  - Ila: *"We do not fight because we are angry. We protect because we are needed. Stay beside me."*
  - Merlin: *"I shall unleash my most powerful technique: the Boof."* (Boofs. Garbage Goblin drops a banana peel in surprise.) Merlin: *"DEVASTATING."*
  - Victory: Merlin: *"Did we just… do a job? Was that a job?!"* Ila: *"That was teamwork. Yours was the easy part." (beat, warm) "You did it well."*
- **Emotional beat:** Belonging. Merlin contributes for real — as a teammate, which quietly foreshadows the finale (his strength is *being there for others*).
- **Assets:** Ila fighter sprite set (idle, ready, strike, victory — all clearly controlled/heroic, never feral), Merlin assist-move sprites (Boof, Tail Trip, Wiggle, comedic tumble, pop-back-up-with-hearts), 3 cartoon-opponent sprite sets with "stars + flee" animations, neighborhood street background, Teamwork Meter UI, "They scampered off!" banner, cartoon bonk/boing SFX (no pain sounds), Ila motif intensified.
- **Difficulty/Assist:** Assist = auto-block, generous assist windows, opponents telegraph hugely, you cannot truly lose. Challenge = manual block, real combo timing, star rating.
- **Testing notes:** Assert no "death/K.O./blood" strings or assets exist; opponents always exit via "flee" state; "Pep" reaching zero triggers retry not game-over; teamwork finisher fires on full meter; sequence advances opponent-by-opponent to Stage 4.
- **Acceptance criteria:**
  - [ ] Side-view fighter with Ila as anchor and player-controlled Merlin assists + Teamwork Meter.
  - [ ] Zero gore/violence: opponents are cartoon, defeats are "bonk → stars → flee," HP is "Pep" with instant retry.
  - [ ] Fight reinforces Stage 2's control theme (well-timed restraint > mashing).
  - [ ] Completable in Assist; hands off to Stage 4.

---

## Stage 4 — Chinook's Big Sniff
*Retro target gallery. Inspiration: Duck Hunt, family-safe & non-gory.*

> No realistic gun at a living animal. Use a **scent-and-spot reticle**: Chinook sniffs out the target, you tap where Chinook points. Targets "poof" into feathers/foam and fly off happy, or are clay/foam discs.

- **Goal:** Fast, joyful reaction-and-aim gallery introducing Chinook and the *nose-first* theme. Chinook is genuinely great at this; Merlin is hilariously not.
- **Player verb:** Spot & tap.
- **Mechanics:**
  - Chinook **points** (classic bird-dog freeze + nose-line) toward where a target will appear — a brief telegraph. Player taps the target when it pops up. Hit = cartoon **"poof"** (cartoon duck flaps off cheerfully / clay disc shatters into harmless puff).
  - Waves of increasing speed/# of targets. Combo multiplier for consecutive spots. A few **"don't tap" decoys** (the neighbor's hat, a butterfly, Hades sunbathing — tapping Hades = funny scolding, small score ding, no fail).
  - Chinook's **"Big Sniff" meter**: fill it by following Chinook's points accurately; when full, triggers a slow-mo bonus round where everything's worth double.
  - Merlin's running commentary as comic relief; Merlin occasionally tries to "help" by chasing the wrong thing.
- **Flow:** Chinook demos a perfect point-and-find → player tries a slow round → speed ramps over 3 waves → Big Sniff bonus round → score tally → Chinook: "Your nose will get there! Mine took a whole four months." Merlin: "You're SIX MONTHS OLD." → Stage 5.
- **Dialogue flavor:**
  - Chinook (earnest puppy, droopy and sweet): *"Okay okay okay so the trick is you SMELL it first, THEN you look. Nose, then eyes! Nose, then eyes!"*
  - Merlin (tapping a butterfly): *"FOUND ONE."* Chinook: *"That's a butterfly, Mr. Merlin."* Merlin: *"…A flying one. Suspicious."*
  - Tapping Hades by accident: Hades (off-screen, flat): *"Touch me again and you will find new and creative employment."*
- **Emotional beat:** Humility + delight. A literal puppy is better at this than Merlin, and it's charming, not deflating.
- **Assets:** Chinook sprite (idle, **point/freeze pose**, happy bounce), cartoon duck (fly-in, "poof" feather burst, fly-off), clay/foam disc + shatter puff, decoy props (hat, butterfly, sunbathing Hades cameo), reticle/tap-feedback, sky/field gallery background, Big Sniff meter + slow-mo overlay, Chinook motif (bouncy major), snuffle/poof/cheer SFX.
- **Difficulty/Assist:** Assist = long telegraphs, big targets, slow waves, no negative scoring. Challenge = short telegraphs, smaller/faster targets, decoy penalties, star rating.
- **Testing notes:** Assert deterministic seedable spawns for tests; hit detection on tap; decoys reduce score but never fail-out; Big Sniff meter triggers bonus; **no gun/weapon/blood asset or string**; targets always "poof"/fly-off unharmed. Verify 3 waves + bonus complete and hand to Stage 5.
- **Acceptance criteria:**
  - [ ] Duck-Hunt-style spot-and-tap gallery with Chinook's point as the telegraph.
  - [ ] Strictly non-gory: poof/foam/clay only, animals fly off unharmed, no weapon aimed at a living thing.
  - [ ] Combo + Big Sniff bonus round implemented; deterministic under test seed.
  - [ ] Completable in Assist; hands off to Stage 5.

---

## Stage 5 — Merlin Goes Bird Dog
*Field / scent / bird-dog sequence. Inspiration: a patient scent sim — the "anti-Duck-Hunt."*

> Represent bird-dog work respectfully: **scent, patience, field awareness, steadiness, and helping the human** — *not* chasing or shooting. The lesson: real hunting work is slow, careful, and tiring.

- **Goal:** Flip Stage 4's twitchy fun into its grown-up reality. Merlin tries the *actual job* and learns it's patience, not chaos. He gets tired. He respects it.
- **Player verb:** Sniff (follow scent) → Point (hold steady) → gently flush, then **wait** with the human.
- **Mechanics:**
  - **Scent field:** an invisible scent gradient across the field; an on-screen "scent strength" indicator warms up/cools down. Player steers Merlin to follow rising scent (slow, deliberate movement — moving too fast scatters the scent / spooks the bird → gentle reset).
  - **The Point:** when scent peaks, Merlin must **freeze and hold a steady "point"** — a hold-still mechanic (keep your thumb still / hold within a wobble zone) for a few seconds while the meter fills. Merlin's instinct to bolt is the comedy + the challenge: resist the urge.
  - **Steadiness to flush:** on the human's cue ("Easy… easy… now."), tap once to **gently flush** the bird, which flies up and **away, free**. Success = the human is helped, the bird is safe. No shot, no catch — the *job is the finding and the steadiness.*
  - **Fatigue:** a "tired" meter rises over the sequence; the field is large; Merlin visibly flags. We *feel* the work. 2–3 finds, each longer/harder, then Merlin flops down, exhausted and proud.
- **Flow:** Chinook (or a human handler) sets the scene → find 1 (easy) → find 2 (must hold the point longer) → find 3 (long track + steady flush) → Merlin collapses happily, panting → reflection line that points straight at the finale.
- **Dialogue flavor:**
  - Merlin (vibrating): *"There's a bird. I can SMELL it. Every fiber of me says CHASE. I will… not… chase. I'm being SO patient. Am I being patient? I'm being patient."*
  - On a successful steady flush: Merlin: *"I found it and I DIDN'T pounce and the bird is fine and the human is happy and I am… so tired."*
  - Closing: Merlin (flopped, panting): *"This is real work. Slow, and careful, and it's for someone else. Chinook's going to be amazing at this." (beat) "It's just… not me, is it."*
- **Emotional beat:** Exhaustion + dawning self-knowledge. The first time Merlin openly wonders if maybe his job is something else. Seed for Stage 7 fully planted.
- **Assets:** Large field background (parallax/scroll), Merlin movement + **point/freeze pose** + "vibrating with restraint" + exhausted-flop poses, scent-strength indicator (warm/cool), hold-steady wobble meter, bird (hidden → flush-up → fly-free), fatigue meter, ambient field SFX, soft wind, Merlin panting, a gentler reprise of the Home lullaby fading in under the closing line.
- **Difficulty/Assist:** Assist = forgiving scent gradient, wide point-hold tolerance, slow fatigue, no fail. Challenge = narrower scent, tighter hold (more wobble penalty), faster fatigue, star rating.
- **Testing notes:** Assert scent gradient follow works; point-hold requires stillness for N seconds (steadiness, not speed); flush only fires on the human's cue; **no shooting/catching mechanic exists**; fatigue rises; closing reflection line plays and hands to Stage 6.
- **Acceptance criteria:**
  - [ ] Scent-follow → hold-point → cued-flush loop, reps escalating, with a fatigue meter.
  - [ ] Theme = patience/steadiness/helping; explicitly **not** chase/shoot/catch.
  - [ ] Merlin's closing line openly questions whether this is his job (sets up finale).
  - [ ] Completable in Assist; hands off to Stage 6.

---

## Stage 6 — Hades Teaches Management
*Funny "being in charge" minigame. Inspiration: triage / "calm is power." (Original mode — designed here.)*

> Hades is a very large, athletic, imperious, intelligent cat. The joke of management: **being in charge means doing less, deliberately** — supervising, prioritizing, conserving energy, and never losing your composure. Cat logic as leadership.

### The proposed mode: **"The Throne of Composure"**
A reverse-whack-a-mole **triage** game. The household is chaos; Merlin's dog instinct is to react to EVERYTHING. Hades teaches him that a leader responds only to **what matters**, ignores the rest, and **never spends composure carelessly.**

- **Goal:** Keep the household running for ~60–90s by **choosing what to respond to and what to majestically ignore**, while conserving a **Composure** resource. Funny because the "skill" is restraint — the opposite of everything Merlin is.
- **Player verb:** Triage — tap the *right* events, **resist** tapping the wrong ones; occasionally delegate.
- **Mechanics:**
  - **Events pop up** around a top-down/iso living room: the doorbell rings, a boy drops a snack, the boys start a (friendly) squabble, a sunbeam appears, a leaf blows past the window, the food bowl empties, a toy needs fetching.
  - Each event has a **priority** (the boys need something = high; a leaf = ignore; a sunbeam = *Hades says claim it, it's strategic rest*). Tapping a **high-priority** event = handled, household happiness up. Tapping a **low-priority/ignore** event = Merlin wasted energy → **Composure drops** (he got distracted, like a dog).
  - **Composure meter:** the core resource. Reacting to junk drains it; **deliberately ignoring** junk and taking strategic rests (the sunbeam!) restores it. Run out of Composure = Merlin spirals into adorable chaos (everything beeps, he chases his tail) → a funny reset, Hades sighs, you continue. Never a hard fail.
  - **Delegate command:** a few times you can tap "Delegate" to assign a task to a helper (a Roomba, Chinook, the boys themselves) — teaching that a leader empowers others instead of doing everything. Limited uses = pick your moments.
  - **Hades demonstrates**: at the top, Hades handles the same chaos by barely moving — one regal paw-tap, one slow blink, total control. The contrast is the comedy and the lesson.
- **Flow:** Hades, from a high perch, surveys his domain → "Watch." (Hades manages effortlessly) → Merlin's turn: chaos ramps over 2–3 rounds → Merlin learns to ignore the leaves and claim the sunbeams → household-happiness goal met → Hades's verdict.
- **Dialogue flavor:**
  - Hades (imperious, unbothered, brilliant): *"You believe being in charge means doing everything. It means doing almost nothing — perfectly, and at exactly the right moment."*
  - Hades: *"The doorbell is beneath me. The boys are not. Learn the difference and you may, one day, approach competence."*
  - Merlin (chasing a leaf): *"A LEAF. A THREAT. I must—"* Hades: *"You must sit down."* Merlin: *"...Sitting down. Wow. This is so hard. Doing nothing is the hardest thing I've ever done."*
  - Verdict (a rare, dry compliment): Hades: *"You are loud, undisciplined, and you tracked mud onto my domain." (beat) "And yet the boys are happy when you are near. Perhaps your management style is simply… being loved. Do not let it go to your head."*
- **Emotional beat:** Realization — and Hades, of all characters, is the one who *names* Merlin's real gift out loud (the boys are happy when you're near). The cat sets up the finale.
- **Assets:** Hades sprite (regal perch idle, slow-blink, single paw-tap, imperious walk, tail-flick — large and athletic), living-room iso/top-down background, event icons (doorbell, snack, squabbling boys, sunbeam, leaf, empty bowl, toy), Composure meter, household-happiness meter, "Delegate" button + helper sprites (Roomba/Chinook/boys), Merlin "spiral" chaos animation, Hades motif (smug regal fanfare), purr/sigh/slow-blink SFX.
- **Difficulty/Assist:** Assist = clear priority cues (high-priority events glow, junk is dim), slow ramp, forgiving Composure. Challenge = subtler cues, faster events, tighter Composure, star rating.
- **Testing notes:** Assert priority system scores high-priority taps positive and junk taps negative-to-Composure; **ignoring junk and resting restores Composure**; Composure-zero triggers comedic reset not game-over; Delegate has limited uses and offloads a task; Hades's demo plays first; verdict line plays and hands to Stage 7.
- **Acceptance criteria:**
  - [ ] Triage mechanic where **restraint/ignoring** and **strategic rest** are the winning skills (not tapping everything).
  - [ ] Composure resource + Delegate mechanic implemented; chaos reset is comedic, never a hard fail.
  - [ ] Hades portrayed as competent, imperious, intelligent — respected, not mocked.
  - [ ] Hades's verdict explicitly foreshadows Merlin's real gift; hands off to Stage 7.

---

## Stage 7 — Merlin's Real Job
*Emotional finale. Sincere, unironic, earns the feeling.*

- **Goal:** Pay off the whole arc. Merlin realizes his job — the one only he can do — is being the family dog who makes the boys happy and laughing. Tone shifts from comedy to genuine warmth.
- **Player verb:** Gentle, low-stakes interactions: cuddle, play, make-the-boys-laugh. No challenge, no score — just feeling.
- **Mechanics:**
  - Merlin comes home, tired, unsure he's found "a job." A quiet montage: the mentors' lessons echo as soft callbacks (Ila's discipline, Chinook's nose, Hades's composure).
  - **The boys** see Merlin. Simple, warm interactions the player taps through: Merlin flops next to them, does the goofy thing that makes them shriek with laughter, gets the group hug. Each interaction fills a **"Joy" heart** (the only meter, and it can't go down).
  - A short, soft **callback beat**: Merlin uses a *little* of each lesson (a steady "stay" for a photo, a good sniff to find a lost toy, the composure to let the baby win) — showing the apprenticeships weren't wasted; they made him a better family dog.
  - Ends on a held, warm tableau: the whole family + Merlin, the Home lullaby motif resolving to full. Optional gentle credits / "The End."
- **Flow:** Quiet homecoming → "Did I find a job?" doubt → boys arrive → warmth builds through small interactions → the realization line → full-hearted tableau → credits.
- **Dialogue flavor (jokes step back; let it land):**
  - Merlin (quiet): *"Ila is brave. Chinook has the best nose in the county. Hades runs an entire household with one eyebrow. And me? I tried every job. I wasn't great at any of them."*
  - (The boys run in, laughing, pile onto him.)
  - Merlin (realizing, soft): *"Oh. Oh, I see it now. Nobody else can do THIS one. The boys don't need me to track, or fight, or hunt, or be in charge. They need me to be… here. Goofy. Theirs."*
  - Merlin (final): *"My job is making them happy. I've had it the whole time. I'm really, really good at it."*
  - Optional mentor cameo close: Ila, Chinook, and Hades watching from the doorway. Hades: *"...He found it." (slow blink) "About time."*
- **Emotional beat:** Homecoming + sincere joy. The ache from Stage 5 resolves completely. This is the moment the whole game exists for.
- **Assets:** Home interior at golden hour, Merlin (tired→content→joyful poses, group-hug pose), **the boys** sprites (laughing, hugging), family cameo (Anthony & Cyndie at the edges), soft callback vignettes for each lesson, Joy heart meter, full Home lullaby resolution, contented-sigh/boys-laughing/group-"aww" SFX, credits card.
- **Difficulty/Assist:** None. Unloseable by design. Pure interactive warmth.
- **Testing notes:** Assert tone-shift (no comedy SFX/strings in the climax beat), Joy meter only increases, each mentor lesson gets a callback, final tableau + credits render, "The End." reached. This is the emotional acceptance gate — verify the realization line and family tableau both appear.
- **Acceptance criteria:**
  - [ ] Finale is sincere and unironic; comedy recedes for the realization beat.
  - [ ] Merlin explicitly realizes his job is making the boys happy/laughing.
  - [ ] Each apprenticeship gets a warm callback (lessons weren't wasted).
  - [ ] Ends on a held family tableau with the Home motif resolved; reaches "The End."

---

## Cross-stage acceptance (whole game)
- [ ] All 7 stages reachable in order via the scene manager; each tears down cleanly.
- [ ] Assist mode guarantees no story-blocking failure anywhere.
- [ ] Every stage plants/pays the "real work is real" theme; finale resolves it.
- [ ] Zero gore/violence/scary content; mentors respected throughout.
- [ ] Runs in portrait on a phone, installable as PWA, no build step.
