# CONTENT_SCHEMA.md
### Merlin Gets a Job — data formats & content contracts

Purpose: let a coding agent build stages from **data**, not hardcoded logic. Mirrors the prior game's vanilla-JS, single-`game.js`, scene-manager approach. All schemas are plain JS objects / JSON-serializable. No framework, no build step.

> Convention: types shown in TypeScript-ish notation for clarity only — ship plain JS. `?` = optional. All ids are lowercase-kebab strings and globally unique.

---

## 1. Global game state

```js
window.__merlinGame = {
  state: {
    currentStage: 'stage1-career-crisis', // stage id, see §3
    furthestStage: 'stage1-career-crisis', // for optional localStorage resume
    assistMode: true,        // true=Assist (default), false=Challenge
    aesthetic: 'home',       // accent theme: home|ila|chinook|hades (drives palette)
    choices: {},             // recorded story choices, e.g. {firstJob:'ila'}
    stars: {},               // per-stage star rating {stageId: 0..3}
    joy: 0,                  // Stage 7 only, monotonic-increasing
    rngSeed: 0,              // set in tests for deterministic spawns
    flags: {}                // misc booleans
  },
  scene: null,               // active Scene instance
  goToStage(id) {},          // scene-manager entrypoint
};
```

- **Assist vs Challenge** is read by every minigame to pick its timing/forgiveness profile. Assist is the default and must never dead-end the story.
- **rngSeed**: all randomized spawns (Stages 4,5,6) must route through a seedable PRNG so Playwright can assert deterministic behavior. Provide `rng(seed)` util.

---

## 2. Scene lifecycle contract

Every stage implements this interface (mirror the prior game's pattern):

```js
class Scene {
  constructor(game) {}
  enter() {}     // set up DOM/canvas, listeners, music; called once on entry
  update(dt) {}  // per-frame; dt in ms
  render() {}    // draw (if canvas-based)
  handleInput(evt) {} // tap/drag/keyboard
  exit() {}      // TEAR DOWN all listeners, timers, audio nodes; called on leave
}
```

- `exit()` **must** remove every listener/timer it created (tested). No leaks between stages.
- Stages signal completion by calling `game.goToStage(nextId)`.
- A stage may expose `__debug` hooks (e.g. `forceComplete()`) used only by tests.

---

## 3. Stage registry

```js
const STAGES = [
  { id:'stage1-career-crisis', title:"Merlin's Career Crisis",       next:'stage2-academy' },
  { id:'stage2-academy',       title:"Ila's Working Dog Academy",    next:'stage3-fight'   },
  { id:'stage3-fight',         title:'Ila Fight Scene',              next:'stage4-sniff'   },
  { id:'stage4-sniff',         title:"Chinook's Big Sniff",          next:'stage5-birddog' },
  { id:'stage5-birddog',       title:'Merlin Goes Bird Dog',         next:'stage6-hades'   },
  { id:'stage6-hades',         title:'Hades Teaches Management',      next:'stage7-realjob' },
  { id:'stage7-realjob',       title:"Merlin's Real Job",            next:null             },
];
```

---

## 4. Dialogue schema (shared `DialogueManager`)

Reuse/port the prior game's `DialogueManager`. Content is data:

```js
// A dialogue line
{
  speaker: 'merlin'|'ila'|'chinook'|'hades'|'boys'|'narrator'|'',
  text: 'string',           // supports simple inline tags below
  emote?: 'happy'|'determined'|'tired'|'awe'|'smug'|'deadpan'|'soft',
  sfx?: 'tap'|'boof'|'sniff'|'poof'|'cheer'|'sigh'|'purr'|null,
  motif?: 'ila'|'chinook'|'hades'|'home'|null, // duck the music to a motif
  pause?: number            // ms beat before next line (comic/emotional timing)
}

// A dialogue sequence
{ id:'stage2-intro', lines:[ /* Line[] */ ], onDone?:'callbackKey' }
```

- Inline tags (optional, keep minimal): `[beat]` short pause, `*word*` emphasis. Avoid heavy markup.
- **Tone metadata matters:** the finale's climax lines set `emote:'soft'`, `sfx:null`, and suppress comedy SFX — tests assert no comedic SFX fire during the Stage 7 realization beat.

---

## 5. Per-stage content schemas

### Stage 1 — Career Crisis
```js
{
  intro: DialogueSequence,
  tutorialTaps: [ { id, hint, target:'dialogue'|'object', objectId? } ],
  glowObjects: [ { id, sprite, x, y, onTap:'advance'|'choice' } ],
  firstJobChoice: { prompt, options:[ {id, label, flavorLine} ] } // no wrong answer
}
```

### Stage 2 — Academy (3 drills)
```js
{
  drills: [
    { type:'tracking',
      trail:[ {x,y} ],          // ordered scent points
      pace:{ assist:number, challenge:number }, // max safe speed
      cleanThreshold:0.0..1.0 }, // fraction of trail to pass
    { type:'obedience',
      cues:[ { cmd:'sit'|'heel'|'down'|'stay', tBeat:number } ], // beat times (ms)
      window:{ assist:number, challenge:number } }, // tap tolerance ms
    { type:'control-release',
      holdCueAt:number,         // ms when Ila calls "Out!"
      releaseWindow:{ assist:number, challenge:number },
      // holding past cue => gentle redo prompt, NOT a fail
      overholdPenalty:'redo' }
  ],
  demoFirst:true,               // Ila demonstrates each before player attempt
  dialogue:{ intro, perDrill:[], outro }
}
```

### Stage 3 — Fight
```js
{
  hero:'ila',
  playerControls:'merlin-assists',
  assists:[ { id:'boof', cooldownMs, effect:'stun', telegraphMs },
            { id:'tail-trip', cooldownMs, effect:'trip' },
            { id:'wiggle', cooldownMs, effect:'distract' } ],
  teamworkMeter:{ fillPerGoodAssist, finisherId:'team-finisher' },
  pep:{ max:100, onZero:'retry' },   // NOT health; zero => instant retry, never game-over
  opponents:[
    { id:'garbage-goblin', sprite, telegraphMs, defeatAnim:'stars-flee', loot:'banana' },
    { id:'mischief-gremlin', sprite, telegraphMs, defeatAnim:'stars-flee', loot:'shoe' },
    { id:'mailmans-nemesis', sprite, boss:true, telegraphMs, defeatAnim:'stars-flee' }
  ],
  // HARD CONSTRAINT: no 'ko'|'death'|'blood' states or assets allowed
  dialogue:{ intro, perOpponent:[], victory }
}
```

### Stage 4 — Big Sniff (gallery)
```js
{
  waves:[ { count, spawnIntervalMs, targetSpeed, telegraphMs } ], // ramps up
  targetTypes:[
    { id:'duck', hitAnim:'poof-flyoff', points:10 },   // flies off UNHARMED
    { id:'clay-disc', hitAnim:'puff-shatter', points:10 }
  ],
  decoys:[ { id:'butterfly', penalty:5 }, { id:'hat', penalty:5 },
           { id:'hades-sunbathing', penalty:5, gag:'hades-scold' } ], // funny, never fail
  pointTelegraph:true,          // Chinook points before each spawn
  combo:{ multiplierStep:0.5, max:4 },
  bigSniff:{ fillPerAccurateSpot, bonusRound:{ durationMs, scoreMult:2, slowMo:true } },
  // HARD CONSTRAINT: no gun/weapon/blood asset or string; reticle is a "scent-spot"
  dialogue:{ intro, banter:[], outro }
}
```

### Stage 5 — Bird Dog (scent sim)
```js
{
  finds:[   // each find escalates
    { scentField:{ peakX, peakY, gradient:'fn-or-grid' },
      followTolerance:{ assist, challenge },   // how forgiving the scent-follow is
      pointHoldMs:{ assist, challenge },        // how long to hold the point
      wobbleTolerance:{ assist, challenge },    // stillness required during point
      flushCue:'on-human-command' }             // tap to gently flush only on cue
  ],
  fatigue:{ ratePerSecond:{ assist, challenge }, max:100 }, // we FEEL the work
  birdOutcome:'fly-free',       // never caught/shot
  // HARD CONSTRAINT: no shoot/catch mechanic; verb is sniff->point->steady->flush-free
  dialogue:{ intro, perFind:[], exhaustedOutro } // outro questions "is this my job?"
}
```

### Stage 6 — Hades Management ("Throne of Composure")
```js
{
  demoFirst:true,               // Hades manages effortlessly first
  rounds:[ { durationMs, eventRateMs } ], // chaos ramps
  eventTypes:[
    { id:'boys-need-something', priority:'high', onHandle:'+happiness' },
    { id:'doorbell',           priority:'low',  onTap:'-composure' },
    { id:'leaf',               priority:'ignore', onTap:'-composure' },
    { id:'sunbeam',            priority:'rest',  onTap:'+composure', flavor:'strategic rest' },
    { id:'empty-bowl',         priority:'high',  onHandle:'+happiness' },
    { id:'toy-fetch',          priority:'med',   onHandle:'+happiness-small' },
    { id:'squabble',           priority:'high',  onHandle:'+happiness' } // friendly boys squabble
  ],
  composure:{ max:100, onZero:'comedic-spiral-reset' }, // never hard fail
  happinessGoal:number,         // win condition
  delegate:{ uses:{ assist, challenge }, helpers:['roomba','chinook','boys'] },
  priorityCues:{ assist:'glow-high-dim-junk', challenge:'subtle' },
  // Hades is competent/respected; restraint + strategic rest are the winning skills
  dialogue:{ intro, demoLine, midBanter:[], verdict } // verdict names Merlin's real gift
}
```

### Stage 7 — Real Job (finale)
```js
{
  homecoming: DialogueSequence,     // tired, "did I find a job?"
  callbacks:[                        // each mentor lesson gets a warm payoff
    { lesson:'ila-stay',  vignette:'hold-still-for-photo' },
    { lesson:'chinook-nose', vignette:'find-lost-toy' },
    { lesson:'hades-composure', vignette:'let-the-baby-win' }
  ],
  interactions:[ { id:'flop', onTap:'+joy' }, { id:'goofy-thing', onTap:'+joy' },
                 { id:'group-hug', onTap:'+joy' } ],
  joyMeter:{ monotonic:true },       // only goes up
  realizationLine: DialogueSequence, // sincere, comedy suppressed
  finalTableau:{ characters:['merlin','boys','anthony','cyndie'], motif:'home-resolved' },
  credits:{ text, optional:true }
}
```

---

## 6. Audio schema (procedural WebAudio — port from prior game)

Reuse the prior game's synth `Audio` module. Add motifs + the family-safe SFX set. **No audio files ship.**

```js
Audio = {
  // SFX (family-safe only)
  tap(), boof(), sniff(), poof(), bonk(), cheer(), sigh(), purr(),
  slowBlink(), star(), pant(),
  // Motifs (short note sequences; see DESIGN_BIBLE §8)
  motif(name) // 'ila'(steady minor march) | 'chinook'(bouncy major)
              // | 'hades'(regal smug fanfare) | 'home'(warm lullaby)
  // 'home' motif plays partial in Stage 1, fragments under Stage 5 outro,
  // and resolves FULLY in Stage 7.
}
```
- **Forbidden:** realistic gunshots, impact-pain sounds, scary/violent audio. Fight hits are cartoon `bonk`/boing only.

---

## 7. Asset manifest format

Keep assets minimal and code-drawn where possible (matching the prior game's procedural style). For any image/sprite, register:

```js
{ id, type:'sprite'|'bg'|'prop'|'ui', stage, frames?, accentTheme?, notes }
```
- Prefer code-drawn shapes / CSS for UI and simple props; reserve sprites for the four characters + the boys + cartoon opponents.
- Every character needs the animation states listed in CHARACTER_BIBLE.md.
- Accent themes drive palette swaps per stage (home/ila/chinook/hades).

---

## 8. Content authoring rules (guardrails encoded as data)

These are validated by tests (see STAGE_PLAN testing notes):
- No content object may contain the strings: `kill`, `death`, `blood`, `gun`, `shoot`(at a living thing), `gore`. (Stage 4/5 use `spot`, `flush`, `poof`, `clay`.)
- Stage 3 opponents must have `defeatAnim:'stars-flee'` and no `ko`/`death` state.
- Stage 4 targets must have a `*-flyoff`/`*-shatter` (harmless) hit anim.
- Stage 5 must have no `catch`/`shoot` mechanic; bird outcome is `fly-free`.
- Stage 6 `composure.onZero` must be `comedic-spiral-reset` (never `gameover`).
- Stage 7 realization lines must set `sfx:null` and not trigger comedy SFX.
- Every stage's Assist profile must be reachable to completion with no skill (a test "auto-plays" Assist to the end).
