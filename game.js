'use strict';
/* ================================================================
   MERLIN GETS A JOB — game.js  v0.1  (Milestone 0: skeleton & harness)
   Vanilla JS, no framework, no build step. Portrait 390x700.
   Provides: global game object, stage registry, scene lifecycle with
   tracked teardown, minimal DialogueManager, procedural WebAudio stubs,
   seedable RNG, and an Assist/Challenge toggle.
   Real stage gameplay is intentionally NOT implemented here.
   ================================================================ */
const GW = 390, GH = 700;

/* ── Seedable RNG (mulberry32). Deterministic for a fixed seed. ── */
function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── Procedural WebAudio (stubs). No audio files ship. ──
   Lazily creates an AudioContext on first user gesture. All methods are
   safe no-ops until then. Method names match CONTENT_SCHEMA.md §6. */
const SFX = (() => {
  let ctx = null;
  const init = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } } };
  const resume = () => { if (ctx && ctx.state === 'suspended') ctx.resume(); };
  const tone = (freq, dur, type = 'sine', vol = 0.18) => {
    if (!ctx) return; resume();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + dur);
    o.start(); o.stop(ctx.currentTime + dur);
  };
  const seq = (notes, type = 'sine', step = 0.12, vol = 0.16) => {
    if (!ctx) return;
    notes.forEach((f, i) => setTimeout(() => tone(f, step * 1.4, type, vol), i * step * 1000));
  };
  // Family-safe motifs (short note sequences) — see DESIGN_BIBLE §8.
  const MOTIFS = {
    home:    [392, 440, 523, 587],          // warm lullaby
    ila:     [294, 294, 349, 392],          // steady minor march
    chinook: [523, 659, 587, 784],          // bouncy major
    hades:   [440, 554, 659, 880],          // regal fanfare
  };
  return {
    init, resume,
    tap()       { try { init(); tone(520, 0.05, 'triangle', 0.10); } catch (e) {} },
    boof()      { try { init(); tone(150, 0.22, 'sawtooth', 0.28); } catch (e) {} },
    sniff()     { try { init(); tone(300, 0.10, 'sine', 0.08); } catch (e) {} },
    poof()      { try { init(); tone(700, 0.10, 'sine', 0.12); } catch (e) {} },
    bonk()      { try { init(); tone(220, 0.10, 'square', 0.18); } catch (e) {} },
    cheer()     { try { init(); seq([523, 659, 784], 'triangle', 0.08, 0.14); } catch (e) {} },
    sigh()      { try { init(); tone(330, 0.30, 'sine', 0.10); } catch (e) {} },
    purr()      { try { init(); tone(90, 0.30, 'sawtooth', 0.08); } catch (e) {} },
    slowBlink() { try { init(); tone(660, 0.12, 'sine', 0.06); } catch (e) {} },
    star()      { try { init(); seq([880, 1175], 'sine', 0.06, 0.12); } catch (e) {} },
    pant()      { try { init(); tone(260, 0.06, 'triangle', 0.06); } catch (e) {} },
    motif(name) { try { init(); seq(MOTIFS[name] || MOTIFS.home, 'triangle', 0.14, 0.14); } catch (e) {} },
  };
})();

/* ── Bindings: tracks listeners + timers for guaranteed teardown. ──
   Every Scene owns one; exit() clears it. A module-level registry lets
   tests confirm no listeners accumulate across transitions. */
const _activeBindings = new Set();
class Bindings {
  constructor() { this._listeners = []; this._timers = []; _activeBindings.add(this); }
  on(target, type, fn, opts) { target.addEventListener(type, fn, opts); this._listeners.push([target, type, fn, opts]); return fn; }
  timeout(fn, ms) { const id = setTimeout(fn, ms); this._timers.push(id); return id; }
  interval(fn, ms) { const id = setInterval(fn, ms); this._timers.push(id); return id; }
  get listenerCount() { return this._listeners.length; }
  clearAll() {
    this._listeners.forEach(([t, ty, fn, o]) => t.removeEventListener(ty, fn, o));
    this._listeners = [];
    this._timers.forEach(id => { clearTimeout(id); clearInterval(id); });
    this._timers = [];
    _activeBindings.delete(this);
  }
}
function totalActiveListeners() {
  let n = 0; _activeBindings.forEach(b => { n += b.listenerCount; }); return n;
}

/* ── Scene base class (lifecycle contract from CONTENT_SCHEMA.md §2). ── */
class Scene {
  constructor(game) { this.game = game; this.bind = new Bindings(); }
  enter() {}
  update(dt) {}
  render() {}
  handleInput(evt) {}
  exit() { this.bind.clearAll(); this.game._exitCount++; }
}

/* ── Minimal DialogueManager (singleton, shared across scenes). ──
   Milestone 0: simple queued lines + tap-to-advance. Shaped so Stage 1
   can drive it next. Lines may be strings or {speaker, text}. */
class DialogueManager {
  constructor() {
    this.box = document.getElementById('dialogue-box');
    this.spk = document.getElementById('dlg-speaker');
    this.txt = document.getElementById('dlg-text');
    this.queue = []; this.onDone = null;
    this._bind = new Bindings(); // persistent: never torn down
    this._bind.on(this.box, 'click', () => this.advance());
  }
  show(lines, onDone) {
    this.queue = Array.isArray(lines) ? lines.slice() : [lines];
    this.onDone = onDone || null;
    this.box.style.display = 'block';
    this._next();
  }
  _next() {
    if (!this.queue.length) { this.hide(); if (this.onDone) { const cb = this.onDone; this.onDone = null; cb(); } return; }
    const line = this.queue.shift();
    const speaker = typeof line === 'string' ? '' : (line.speaker || '');
    const text = typeof line === 'string' ? line : (line.text || '');
    this.spk.textContent = speaker;
    this.spk.style.display = speaker ? 'block' : 'none';
    this.txt.textContent = text;
    if (typeof line === 'object' && typeof line.onShow === 'function') line.onShow();
  }
  advance() { if (this.box.style.display !== 'none') { SFX.tap(); this._next(); } }
  hide() { this.box.style.display = 'none'; }
}

/* ── Stage registry (CONTENT_SCHEMA.md §3). ──
   `accent` drives the per-stage palette; `flavor` is a short placeholder. */
const STAGES = [
  { id: 'stage1-career-crisis', n: 1, title: "Merlin's Career Crisis",    accent: 'home',    flavor: 'Everyone has a job but me. Time to fix that.',          next: 'stage2-academy' },
  { id: 'stage2-academy',       n: 2, title: "Ila's Working Dog Academy", accent: 'ila',     flavor: 'Ila makes discipline look easy. It is not easy.',       next: 'stage3-fight' },
  { id: 'stage3-fight',         n: 3, title: 'Ila Fight Scene',            accent: 'ila',     flavor: 'Stand beside Ila — courage means staying calm.',        next: 'stage4-sniff' },
  { id: 'stage4-sniff',         n: 4, title: "Chinook's Big Sniff",        accent: 'chinook', flavor: 'Nose first, then eyes. Chinook makes it look simple.',   next: 'stage5-birddog' },
  { id: 'stage5-birddog',       n: 5, title: 'Merlin Goes Bird Dog',       accent: 'chinook', flavor: 'Real field work is slow, patient, and tiring.',          next: 'stage6-hades' },
  { id: 'stage6-hades',         n: 6, title: 'Hades Teaches Management',    accent: 'hades',   flavor: 'Hades teaches that being in charge means doing less.',   next: 'stage7-realjob' },
  { id: 'stage7-realjob',       n: 7, title: "Merlin's Real Job",          accent: 'home',    flavor: 'Maybe my real job was here the whole time.',            next: null },
];

/* ── Title scene ── */
class TitleScene extends Scene {
  enter() {
    this.game.setAccent('home');
    this.game.setHud('Title');
    show('title-screen');
    SFX.motif('home');
    const btn = document.getElementById('start-btn');
    this.bind.on(btn, 'click', () => { SFX.tap(); this.game.goToStage('stage1-career-crisis'); });
  }
  exit() { hide('title-screen'); super.exit(); }
}

/* ── Placeholder stage scene factory ── */
function makePlaceholderScene(entry) {
  return class PlaceholderScene extends Scene {
    enter() {
      this.game.setAccent(entry.accent);
      this.game.setHud('Stage ' + entry.n);
      document.getElementById('sv-badge').textContent = 'Stage ' + entry.n;
      document.getElementById('sv-title').textContent = entry.title;
      document.getElementById('sv-flavor').textContent = entry.flavor;
      show('stage-view');
      SFX.motif(entry.accent);
      const btn = document.getElementById('stage-continue');
      this.bind.on(btn, 'click', () => {
        SFX.tap();
        this.game.goToStage(entry.next ? entry.next : '__end');
      });
    }
    exit() { hide('stage-view'); super.exit(); }
  };
}

/* ================================================================
   MERLIN — code-drawn sprite carried forward from AnthonyAdventure2.
   The prior game drew Merlin with Phaser Graphics; this is a faithful
   port to Canvas 2D (same coal-black coat, floppy ears, amber eyes,
   pink tongue, and signature blue collar with gold studs). Local coords
   match the original 145x115 texture; he faces right.
   ================================================================ */
function pen(ctx) {
  return {
    fill(hex, a) { ctx.globalAlpha = (a == null ? 1 : a); ctx.fillStyle = hex; },
    rect(x, y, w, h) { ctx.fillRect(x, y, w, h); },
    rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill(); },
    circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); },
    // Phaser fillEllipse uses full width/height; convert to radii.
    ellipse(x, y, w, h) { ctx.beginPath(); ctx.ellipse(x, y, w / 2, h / 2, 0, 0, 6.2832); ctx.fill(); },
  };
}

function drawMerlin(ctx, wag) {
  const g = pen(ctx);
  // Shadow
  g.fill('#000000', 0.15); g.ellipse(66, 108, 90, 14);
  // Tail (curl of shrinking circles) — wag rotates it gently around its base.
  ctx.save();
  ctx.translate(16, 70); ctx.rotate((wag || 0) * 0.18); ctx.translate(-16, -70);
  g.fill('#0e0e0e', 1);
  [[14, 75], [9, 62], [5, 50], [2, 40]].forEach(([x, y], i) => g.circle(x, y - i * 2, 7 - i));
  ctx.restore();
  // Body
  g.fill('#111111', 1); g.ellipse(66, 72, 98, 60);
  // Legs
  g.fill('#0c0c0c', 1);
  g.rrect(28, 84, 14, 20, 5); g.rrect(46, 84, 14, 26, 5);
  g.rrect(78, 84, 14, 26, 5); g.rrect(96, 84, 14, 20, 5);
  // Head
  g.fill('#111111', 1); g.ellipse(100, 52, 34, 36);
  g.fill('#1c1c1c', 1); g.circle(108, 32, 30);
  g.fill('#242424', 1); g.ellipse(122, 40, 28, 20);   // muzzle
  g.fill('#0e0e0e', 1); g.ellipse(128, 35, 15, 10);   // nose
  // Ears
  g.fill('#0d0d0d', 1); g.ellipse(92, 14, 20, 30); g.ellipse(118, 11, 18, 28);
  // Eyes (amber-brown), pupils, glints
  g.fill('#8B5E3C', 1); g.circle(99, 26, 7); g.circle(115, 23, 7);
  g.fill('#2a1500', 1); g.circle(99, 26, 4); g.circle(115, 23, 4);
  g.fill('#ffffff', 1); g.circle(101, 24, 2); g.circle(117, 21, 2);
  // Tongue
  g.fill('#FF9FB5', 1); g.ellipse(124, 54, 14, 22);
  g.fill('#E888A0', 1); g.rect(123, 44, 2, 14);
  // Signature blue collar with gold studs
  g.fill('#4488DD', 1); g.rrect(84, 58, 30, 9, 3);
  g.fill('#FFD700', 1); [87, 93, 99, 105].forEach(cx => g.circle(cx, 62, 2));
  ctx.globalAlpha = 1;
}

// Cozy home: warm wall, wood floor, sunny window, a framed photo of the boys, a rug.
function drawHomeRoom(ctx) {
  const g = pen(ctx);
  g.fill('#fff3df', 1); g.rect(0, 0, GW, 470);          // wall
  g.fill('#d9a564', 1); g.rect(0, 470, GW, GH - 470);   // floor
  g.fill('#c98f4e', 1); g.rect(0, 470, GW, 6);          // baseboard line
  // Window with sky + sun
  g.fill('#7ec8e3', 1); g.rrect(40, 70, 130, 150, 10);
  g.fill('#fff1a8', 1); g.circle(150, 110, 22);          // sun
  g.fill('#ffffff', 0.8); g.ellipse(80, 150, 60, 22); g.ellipse(110, 175, 70, 24);
  g.fill('#a9744a', 1); g.rect(36, 64, 138, 8); g.rect(36, 216, 138, 8);
  g.rect(100, 70, 8, 150); g.rect(40, 140, 130, 8);      // window frame
  // Framed family photo of the boys (warmth implied)
  g.fill('#7a4a22', 1); g.rrect(238, 92, 110, 86, 8);
  g.fill('#fdf6e8', 1); g.rrect(246, 100, 94, 70, 4);
  g.fill('#9fd0e8', 1); g.rrect(250, 104, 86, 62, 3);
  g.fill('#f3c9a0', 1); g.circle(272, 138, 12); g.circle(300, 134, 13); g.circle(326, 140, 11);
  g.fill('#3a6e3a', 1); g.rect(252, 150, 82, 16);        // little grass strip
  // Rug under Merlin
  g.fill('#c0473f', 1); g.ellipse(195, 600, 320, 120);
  g.fill('#e0a93f', 1); g.ellipse(195, 600, 250, 88);
  g.fill('#c0473f', 1); g.ellipse(195, 600, 180, 56);
  ctx.globalAlpha = 1;
}

/* ── STAGE 1 — Merlin's Career Crisis (visual-novel intro) ── */
class Stage1Scene extends Scene {
  enter() {
    this.game.setAccent('home');
    this.game.setHud('Stage 1');
    this.t = 0;
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.layer = document.getElementById('stage1-layer');
    this.montage = document.getElementById('mentor-montage');
    this.bowl = document.getElementById('glow-bowl');
    this.hint = document.getElementById('stage1-hint');
    this.choicePanel = document.getElementById('choice-panel');
    this.choiceOpts = document.getElementById('choice-options');
    this.layer.style.display = 'block';
    SFX.motif('home');
    // A warm offscreen giggle from the boys to set the tone.
    this.bind.timeout(() => SFX.cheer(), 600);
    this._intro();
  }

  _say(lines, onDone) { this.game.dialogue.show(lines, onDone); }

  _intro() {
    this._say([
      { speaker: 'Merlin', text: "Ah — morning. Sun's up. The boys are off being boys. And me? I'm at my post. Professionally lounging." },
      { speaker: 'Merlin', text: "...Hold on. Is lounging a job?" },
      { speaker: 'Narrator', text: "It is not." },
      { speaker: 'Merlin', text: "Let me think about this seriously. Anthony has a job. Cyndie has a job." },
      { speaker: 'Merlin', text: "The CAT has a job, and he mostly sleeps on the warm laptop." },
      { speaker: 'Merlin', text: "I, a serious adult dog, have NO job. This is a crisis. A career crisis." },
    ], () => this._bowl());
  }

  _bowl() {
    this.game.dialogue.hide();
    this.bowl.style.display = 'block';
    this.hint.textContent = 'Tap the glowing bowl 🥣';
    this.hint.style.display = 'block';
    const onTap = () => {
      SFX.tap(); SFX.sniff();
      this.bowl.style.display = 'none';
      this.hint.style.display = 'none';
      this._say([
        { speaker: 'Merlin', text: "Empty. Like my résumé. That settles it." },
        { speaker: 'Merlin', text: "I will simply… get one. How hard could a job be?" },
        { speaker: 'Merlin', text: "...It's going to be very hard, isn't it." },
      ], () => this._montage());
    };
    this.bind.on(this.bowl, 'click', onTap);
  }

  _montage() {
    const setActive = (m) => {
      this.montage.querySelectorAll('.mentor-card').forEach(c =>
        c.classList.toggle('active', c.getAttribute('data-mentor') === m));
    };
    this.montage.style.display = 'flex';
    // next frame so the entrance transition plays
    this.bind.timeout(() => this.montage.classList.add('show'), 30);
    this._say([
      { speaker: 'Narrator', text: "Merlin considers his impressive friends — each one a true professional.", onShow: () => setActive(null) },
      { speaker: 'Narrator', text: "ILA. A working dog. Discipline, tracking, courage, control. She makes 'hard' look calm.", onShow: () => setActive('ila') },
      { speaker: 'Narrator', text: "CHINOOK. Six months old and already the best nose in the county. A bird-dog in training.", onShow: () => setActive('chinook') },
      { speaker: 'Narrator', text: "HADES. He runs this entire household with one slow blink. Nobody questions Hades.", onShow: () => setActive('hades') },
      { speaker: 'Merlin', text: "Impressive. Intimidating. Inspiring. I'll apprentice with all of them!", onShow: () => setActive(null) },
    ], () => this._choice());
  }

  _choice() {
    this.game.dialogue.hide();
    document.getElementById('choice-title').textContent = 'What job should Merlin try first?';
    const options = [
      { id: 'ila', label: "Ila's Working Dog Academy", reply: "A dog of discipline! Excellent instinct." },
      { id: 'chinook', label: "Chinook's Big Sniff", reply: "The nose knows! ...But let's start with the basics." },
      { id: 'hades', label: "Ask Hades who's in charge", reply: "Bold. Hades will love being asked. ...Eventually. Let's warm up first." },
    ];
    this.choiceOpts.innerHTML = '';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.type = 'button';
      btn.setAttribute('data-choice', opt.id);
      btn.textContent = opt.label;
      this.bind.on(btn, 'click', () => {
        SFX.tap();
        this.game.state.choices.firstJob = opt.id;
        this.choicePanel.style.display = 'none';
        this._finish(opt.reply);
      });
      this.choiceOpts.appendChild(btn);
    });
    this.choicePanel.style.display = 'block';
  }

  _finish(reply) {
    this.montage.classList.remove('show');
    this.montage.style.display = 'none';
    this._say([
      { speaker: 'Merlin', text: reply },
      { speaker: 'Merlin', text: "Right — first things first. Ila said to show up early." },
      { speaker: 'Merlin', text: "Off to Ila's Working Dog Academy!" },
    ], () => {
      this.game.state.flags.stage1Complete = true;
      this.game.goToStage('stage2-academy');
    });
  }

  update(dt) { this.t += dt; }

  render() {
    if (!this.ctx) return;
    drawHomeRoom(this.ctx);
    const ctx = this.ctx;
    const bob = Math.sin(this.t / 520) * 4;        // gentle breathing bob
    const wag = Math.sin(this.t / 180);            // tail wag
    ctx.save();
    ctx.translate(95, 408 + bob);
    ctx.scale(2.05, 2.05);
    drawMerlin(ctx, wag);
    ctx.restore();
  }

  exit() {
    // Reset all Stage 1 DOM and clear the canvas.
    this.layer.style.display = 'none';
    this.montage.style.display = 'none';
    this.montage.classList.remove('show');
    this.bowl.style.display = 'none';
    this.hint.style.display = 'none';
    this.choicePanel.style.display = 'none';
    this.choiceOpts.innerHTML = '';
    if (this.ctx) this.ctx.clearRect(0, 0, GW, GH);
    this.game.dialogue.hide();
    super.exit();
  }
}

/* ================================================================
   ILA — code-drawn working-line German Shepherd (black-and-tan).
   Mostly-black saddle, tan points (legs, chest, cheeks, brows),
   upright ears, steady square stance, calm alert face. Drawn head-right
   in local coords; the scene mirrors her to face Merlin. Disciplined and
   kind — never snarling or aggressive.
   ================================================================ */
function drawIla(ctx) {
  const g = pen(ctx);
  const BLK = '#1c1c1c', BLK2 = '#141414', TAN = '#c8a86b', TAN2 = '#a8884b', NOSE = '#0e0e0e';
  g.fill('#000000', 0.15); g.ellipse(72, 110, 100, 14);                 // shadow
  // Relaxed tail (hangs low — calm, not raised)
  g.fill(BLK2, 1); [[20, 72, 9], [13, 82, 8], [9, 94, 6], [7, 104, 4]].forEach(([x, y, r]) => g.circle(x, y, r));
  // Legs: black uppers, tan lower points
  g.fill(BLK, 1);[34, 52, 86, 104].forEach(x => g.rrect(x, 80, 13, 20, 4));
  g.fill(TAN, 1);[34, 52, 86, 104].forEach(x => g.rrect(x, 98, 13, 13, 4));
  // Body + tan chest + black saddle
  g.fill(BLK, 1); g.ellipse(72, 70, 102, 54);
  g.fill(TAN, 1); g.ellipse(108, 82, 40, 30);
  g.fill(BLK, 1); g.ellipse(70, 62, 98, 44);
  // Head: black skull, tan cheeks, tan muzzle with black bridge, nose
  g.fill(BLK, 1); g.ellipse(110, 52, 30, 34);
  g.fill(TAN, 1); g.ellipse(120, 60, 26, 24);
  g.fill(TAN, 1); g.ellipse(132, 58, 30, 18);
  g.fill(BLK, 1); g.ellipse(127, 49, 26, 13);
  g.fill(NOSE, 1); g.ellipse(144, 54, 12, 9);
  // Upright ears (alert) — black outer, tan inner
  g.fill(BLK, 1); g.tri(98, 6, 92, 34, 110, 30); g.tri(122, 4, 116, 32, 134, 28);
  g.fill(TAN2, 1); g.tri(101, 15, 98, 32, 108, 30); g.tri(124, 13, 121, 30, 130, 28);
  // Tan eyebrow markings, calm amber eyes, glints
  g.fill(TAN2, 1); g.ellipse(110, 40, 9, 5); g.ellipse(124, 38, 9, 5);
  g.fill('#3a2a14', 1); g.circle(111, 46, 4); g.circle(124, 44, 4);
  g.fill('#a9762f', 1); g.circle(111, 46, 2); g.circle(124, 44, 2);
  g.fill('#ffffff', 1); g.circle(112, 45, 1); g.circle(125, 43, 1);
  // Calm closed mouth (a steady line — no teeth, no snarl)
  g.fill(NOSE, 1); g.rect(133, 63, 13, 1.6);
  ctx.globalAlpha = 1;
}

// Training field: sky, grass, a low fence, and three lane markers.
function drawAcademyField(ctx) {
  const g = pen(ctx);
  g.fill('#bfe3f2', 1); g.rect(0, 0, GW, 300);                    // sky
  g.fill('#fff1a8', 1); g.circle(330, 70, 26);                    // sun
  g.fill('#8fcf6b', 1); g.rect(0, 300, GW, GH - 300);             // grass
  g.fill('#7cbe59', 1); g.ellipse(195, 470, 360, 70);            // mown ring
  // Simple back fence
  g.fill('#caa472', 1); g.rect(0, 286, GW, 8);
  for (let x = 20; x < GW; x += 46) { g.fill('#b8915f', 1); g.rect(x, 262, 7, 30); }
  // Soft training cones (orange) for academy feel
  g.fill('#e8702a', 1); g.tri(60, 330, 50, 360, 70, 360); g.tri(330, 330, 320, 360, 340, 360);
  ctx.globalAlpha = 1;
}

/* ── STAGE 2 — Ila's Working Dog Academy (three IGP-inspired drills) ── */
const OBEY_SEQUENCE = ['sit', 'heel', 'down', 'stay'];
const OBEY_LABELS = { sit: 'Sit', heel: 'Heel', down: 'Down', stay: 'Stay' };

class Stage2Scene extends Scene {
  enter() {
    this.game.setAccent('ila');
    this.game.setHud('Stage 2');
    this.game.state.flags.stage2Started = true;
    this.t = 0;
    this.drill = null;          // 'tracking' | 'obedience' | 'control'
    this.awaitingInput = false; // true only when a drill expects a tap
    this.obeyIndex = 0;
    this.outCalled = false;
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.layer = document.getElementById('stage2-layer');
    this.layer.style.display = 'block';
    this._setProgress('Ila’s Academy', 0);
    SFX.motif('ila');
    this._intro();
  }

  _say(lines, onDone) { this.game.dialogue.show(lines, onDone); }
  _setProgress(label, frac) {
    document.getElementById('s2-progress-label').textContent = label;
    document.getElementById('s2-progress-fill').style.width = Math.round(frac * 100) + '%';
  }
  _showDrill(id) {
    ['s2-track', 's2-obey', 's2-control'].forEach(d =>
      document.getElementById(d).style.display = (d === id ? 'block' : 'none'));
  }

  _intro() {
    this._say([
      { speaker: 'Ila', text: 'Welcome, Merlin. I am Ila. This is the academy.' },
      { speaker: 'Ila', text: 'A working dog is not the loudest dog. It is the dog who waits, watches, and acts only when asked.' },
      { speaker: 'Merlin', text: 'I am excellent at waiting. Unless snacks are involved.' },
      { speaker: 'Ila', text: 'Then we begin. First — tracking.' },
    ], () => this._startTracking());
  }

  /* Drill 1 — Tracking: tap the scent pawprints in order. */
  _startTracking() {
    this.drill = 'tracking';
    this._setProgress('Drill 1 — Tracking', 0);
    this._say([
      { speaker: 'Ila', text: 'Follow the scent. Nose down, slow and steady. Touch each print in order.' },
    ], () => this._revealTrack());
  }
  _revealTrack() {
    const field = document.getElementById('s2-track');
    field.innerHTML = '';
    // A winding trail (percentages of the field).
    this.trackPts = [[24, 78], [40, 66], [33, 52], [52, 44], [66, 54], [78, 40]];
    this.trackNext = 0;
    this.trackPts.forEach((p, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 's2-dot' + (i === 0 ? ' next' : '');
      dot.setAttribute('data-idx', String(i));
      dot.style.left = p[0] + '%';
      dot.style.top = p[1] + '%';
      dot.textContent = '🐾';
      this.bind.on(dot, 'click', () => this._trackTap(i, dot));
      field.appendChild(dot);
    });
    this._showDrill('s2-track');
    this.awaitingInput = true;
  }
  _trackTap(i, dot) {
    if (i !== this.trackNext) { SFX.tap(); return; } // out of order: gentle feedback, no progress
    SFX.sniff();
    dot.classList.remove('next');
    dot.classList.add('done');
    this.trackNext++;
    this._setProgress('Drill 1 — Tracking', this.trackNext / this.trackPts.length);
    if (this.trackNext >= this.trackPts.length) { this._completeTracking(); return; }
    const nextDot = document.querySelector('.s2-dot[data-idx="' + this.trackNext + '"]');
    if (nextDot) nextDot.classList.add('next');
  }
  _completeTracking() {
    this.awaitingInput = false;
    this.game.state.flags.stage2TrackingComplete = true;
    this._showDrill(null);
    this._say([{ speaker: 'Ila', text: 'Good. Patient and steady. That is tracking.' }], () => this._startObedience());
  }

  /* Drill 2 — Obedience: Ila demonstrates, then tap the called command. */
  _startObedience() {
    this.drill = 'obedience';
    this.obeyIndex = 0;
    this._setProgress('Drill 2 — Obedience', 0);
    this._say([
      { speaker: 'Ila', text: 'Now, obedience. Watch me first: Sit. Heel. Down. Stay.' },
      { speaker: 'Ila', text: 'Your turn. Tap the command I call — only when I call it.' },
    ], () => this._revealObey());
  }
  _revealObey() {
    const wrap = document.getElementById('s2-obey-buttons');
    wrap.innerHTML = '';
    OBEY_SEQUENCE.forEach(cmd => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 's2-cmd'; b.setAttribute('data-cmd', cmd);
      b.textContent = OBEY_LABELS[cmd];
      this.bind.on(b, 'click', () => this._obeyTap(cmd));
      wrap.appendChild(b);
    });
    this._showDrill('s2-obey');
    this.awaitingInput = true;
    this._obeyPrompt();
  }
  _obeyPrompt() {
    const cmd = OBEY_SEQUENCE[this.obeyIndex];
    document.getElementById('s2-obey-cue').textContent = 'Ila says: “' + OBEY_LABELS[cmd] + '!”';
  }
  _obeyTap(cmd) {
    const expected = OBEY_SEQUENCE[this.obeyIndex];
    if (cmd !== expected) { SFX.tap(); return; }   // Assist: wrong tap just re-prompts, no penalty
    SFX.cheer();
    this.obeyIndex++;
    this._setProgress('Drill 2 — Obedience', this.obeyIndex / OBEY_SEQUENCE.length);
    if (this.obeyIndex >= OBEY_SEQUENCE.length) { this._completeObedience(); return; }
    this._obeyPrompt();
  }
  _completeObedience() {
    this.awaitingInput = false;
    this.game.state.flags.stage2ObedienceComplete = true;
    this._showDrill(null);
    this._say([{ speaker: 'Ila', text: 'Precise. You listened well.' }], () => this._startControl());
  }

  /* Drill 3 — Control: hold, then RELEASE on Ila's "Out!". */
  _startControl() {
    this.drill = 'control';
    this.outCalled = false;
    this._setProgress('Drill 3 — Control', 0);
    this._say([
      { speaker: 'Ila', text: 'The last lesson is the hardest. Take the sleeve. Hold.' },
      { speaker: 'Merlin', text: 'Holding! I am SO good at holding.' },
      { speaker: 'Ila', text: 'Out.' },
    ], () => this._controlPrompt());
  }
  _controlPrompt() {
    this.outCalled = true;
    document.getElementById('s2-control-prompt').textContent = 'Ila: “Out!”';
    const wrap = document.getElementById('s2-control-buttons');
    wrap.innerHTML = '';
    const release = document.createElement('button');
    release.type = 'button'; release.className = 's2-ctrl-btn release'; release.setAttribute('data-action', 'release');
    release.textContent = '✓ Release the sleeve (Out!)';
    this.bind.on(release, 'click', () => this._controlReleased());
    const hold = document.createElement('button');
    hold.type = 'button'; hold.className = 's2-ctrl-btn hold'; hold.setAttribute('data-action', 'hold');
    hold.textContent = '🦴 Keep holding (it’s a good sleeve)';
    this.bind.on(hold, 'click', () => this._controlHold());
    wrap.appendChild(release); wrap.appendChild(hold);
    this._showDrill('s2-control');
    this.awaitingInput = true;
  }
  _controlHold() {
    // Over-eager comedy — a gentle redo, never a fail or a reward.
    this.awaitingInput = false;
    this._showDrill(null);
    this._say([
      { speaker: 'Merlin', text: 'But I worked so hard for this sleeve.' },
      { speaker: 'Ila', text: 'Out, Merlin.' },
    ], () => this._controlPrompt());
  }
  _controlReleased() {
    this.awaitingInput = false;
    this.game.state.flags.stage2ControlComplete = true;
    this._setProgress('Drill 3 — Control', 1);
    this._showDrill(null);
    this._say([
      { speaker: 'Merlin', text: 'Okay. Out. Very disciplined. Look at me.' },
      { speaker: 'Ila', text: 'That is the lesson. The hard part of strength is stopping.' },
    ], () => this._outro());
  }

  _outro() {
    this.game.state.flags.stage2Complete = true;
    this.game.state.stars['stage2-academy'] = 3;
    this._say([
      { speaker: 'Ila', text: 'Good. You have heart. Control comes with time.' },
      { speaker: 'Merlin', text: 'I have heart. I also have tired paws.' },
      { speaker: 'Ila', text: 'Then you are learning.' },
      { speaker: 'Merlin', text: 'Next job trial, please!' },
    ], () => this.game.goToStage('stage3-fight'));
  }

  /* Debug/test support — small helpers that reuse the real completion paths. */
  getDrillState() {
    return {
      mentor: 'ila',
      drill: this.drill,
      awaitingInput: this.awaitingInput,
      expected: this.drill === 'obedience' ? OBEY_SEQUENCE[this.obeyIndex] : null,
      outCalled: this.outCalled,
    };
  }
  autoPlayDrill() {
    if (!this.awaitingInput) return false;
    if (this.drill === 'tracking') { this._completeTracking(); return true; }
    if (this.drill === 'obedience') { this._completeObedience(); return true; }
    if (this.drill === 'control') { this._controlReleased(); return true; }
    return false;
  }

  update(dt) { this.t += dt; }
  render() {
    if (!this.ctx) return;
    drawAcademyField(this.ctx);
    const ctx = this.ctx, bob = Math.sin(this.t / 520) * 3, wag = Math.sin(this.t / 220);
    // Merlin (left, facing right)
    ctx.save(); ctx.translate(8, 300 + bob); ctx.scale(1.5, 1.5); drawMerlin(ctx, wag * 0.6); ctx.restore();
    // Ila (right, mirrored to face left) — steady, minimal motion
    ctx.save(); ctx.translate(384, 300); ctx.scale(-1.5, 1.5); drawIla(ctx); ctx.restore();
  }

  exit() {
    this.layer.style.display = 'none';
    ['s2-track', 's2-obey', 's2-control'].forEach(d => { const e = document.getElementById(d); if (e) e.style.display = 'none'; });
    document.getElementById('s2-track').innerHTML = '';
    document.getElementById('s2-obey-buttons').innerHTML = '';
    document.getElementById('s2-control-buttons').innerHTML = '';
    if (this.ctx) this.ctx.clearRect(0, 0, GW, GH);
    this.game.dialogue.hide();
    super.exit();
  }
}

/* ── Ending scene ── */
class EndScene extends Scene {
  enter() {
    this.game.setAccent('home');
    this.game.setHud('The End');
    show('end-screen');
    SFX.cheer();
    const btn = document.getElementById('end-restart');
    this.bind.on(btn, 'click', () => { SFX.tap(); this.game.goToStage('title'); });
  }
  exit() { hide('end-screen'); super.exit(); }
}

/* ── Scenes that replace the Milestone 0 placeholder for a given stage. ── */
const SCENE_OVERRIDES = {
  'stage1-career-crisis': Stage1Scene,
  'stage2-academy': Stage2Scene,
};

/* ── Tiny view helpers ── */
function show(id) { const el = document.getElementById(id); if (el) el.style.display = 'flex'; }
function hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }

/* ── Global game object (CONTENT_SCHEMA.md §1). ── */
const game = {
  state: {
    currentStage: 'title',
    furthestStage: 'stage1-career-crisis',
    assistMode: true,
    aesthetic: 'home',
    choices: {},
    stars: {},
    joy: 0,
    rngSeed: 0,
    flags: {},
  },
  scene: null,
  dialogue: null,
  _exitCount: 0,

  goToStage(id) {
    if (this.scene) { this.scene.exit(); this.scene = null; }
    let SceneClass;
    if (id === 'title') {
      SceneClass = TitleScene;
      this.state.currentStage = 'title';
    } else if (id === '__end') {
      SceneClass = EndScene;
      this.state.currentStage = '__end';
    } else {
      const entry = STAGES.find(s => s.id === id);
      if (!entry) { console.warn('Unknown stage:', id); return; }
      SceneClass = SCENE_OVERRIDES[id] || makePlaceholderScene(entry);
      this.state.currentStage = id;
      this._recordFurthest(id);
    }
    document.body.setAttribute('data-stage', this.state.currentStage);
    this.scene = new SceneClass(this);
    this.scene.enter();
  },

  setAccent(a) { this.state.aesthetic = a; document.body.setAttribute('data-accent', a); },
  setHud(label) { const el = document.getElementById('hud-stage'); if (el) el.textContent = label; },

  setAssist(on) {
    this.state.assistMode = !!on;
    const btn = document.getElementById('assist-toggle');
    if (btn) {
      btn.textContent = on ? 'Assist: ON' : 'Challenge';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    try { localStorage.setItem('merlin.assist', on ? '1' : '0'); } catch (e) {}
  },

  _recordFurthest(id) {
    const order = STAGES.map(s => s.id);
    if (order.indexOf(id) > order.indexOf(this.state.furthestStage)) this.state.furthestStage = id;
  },

  // Test/debug hooks (read-only conveniences; not used by gameplay).
  debug: {
    makeRng,
    rngSequence(seed, n) { const r = makeRng(seed); const out = []; for (let i = 0; i < n; i++) out.push(r()); return out; },
    activeListenerCount: totalActiveListeners,
    get exitCount() { return game._exitCount; },
    stageIds() { return STAGES.map(s => s.id); },
    // All player-facing content strings for the guardrail scan (titles + flavors).
    contentStrings() {
      const parts = [];
      STAGES.forEach(s => { parts.push(s.title, s.flavor); });
      parts.push('Merlin Gets a Job', 'The End', "Merlin's real job: making the boys happy.");
      return parts.join(' \n ');
    },
    // Deterministic advancement helpers (avoid timing-sensitive UI clicks in tests).
    advanceDialogue() {
      const d = game.dialogue;
      if (d && d.box.style.display !== 'none') { d.advance(); return true; }
      return false;
    },
    drainDialogue(max) {
      const d = game.dialogue; let n = 0; const cap = max || 80;
      while (d && d.box.style.display !== 'none' && n < cap) { d.advance(); n++; }
      return n;
    },
    // Stage 2 hooks (delegate to the live scene; reuse real completion paths).
    stage2GetDrill() { return game.scene && game.scene.getDrillState ? game.scene.getDrillState() : null; },
    stage2AutoPlayDrill() { return game.scene && game.scene.autoPlayDrill ? game.scene.autoPlayDrill() : false; },
  },
};
window.__merlinGame = game;

/* ── Fit the 390x700 frame into any viewport (preserve aspect). ── */
function fitFrame() {
  const scale = Math.min(window.innerWidth / GW, window.innerHeight / GH);
  document.documentElement.style.setProperty('--scale', String(Math.min(scale, 1.6)));
}

/* ── Main loop (no-op for placeholders, ready for real stages). ── */
let _lastT = 0;
function loop(t) {
  const dt = _lastT ? t - _lastT : 16; _lastT = t;
  if (game.scene) { game.scene.update(dt); game.scene.render(); }
  requestAnimationFrame(loop);
}

/* ── Boot ── */
function boot() {
  game.dialogue = new DialogueManager();

  // Restore Assist preference (defaults to ON / Assist).
  let assist = true;
  try { const v = localStorage.getItem('merlin.assist'); if (v === '0') assist = false; } catch (e) {}
  game.setAssist(assist);

  const toggle = document.getElementById('assist-toggle');
  toggle.addEventListener('click', () => { SFX.tap(); game.setAssist(!game.state.assistMode); });

  // First user gesture unlocks audio (browser autoplay policy).
  const unlock = () => { SFX.init(); SFX.resume(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);

  fitFrame();
  window.addEventListener('resize', fitFrame);

  game.goToStage('title');
  requestAnimationFrame(loop);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
