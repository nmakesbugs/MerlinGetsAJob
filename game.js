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
    tri(x1, y1, x2, y2, x3, y3) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); ctx.fill(); },
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
const OBEY_SEQUENCE_CHALLENGE = ['sit', 'heel', 'down', 'stay', 'down', 'heel'];   // longer in Challenge
const OBEY_BUTTONS_CHALLENGE = ['down', 'stay', 'sit', 'heel'];                    // shuffled layout
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
    this.obeySeq = this._assist() ? OBEY_SEQUENCE : OBEY_SEQUENCE_CHALLENGE;
    this.trackWrong = 0;        // performance counters (for stars / medals)
    this.obeyWrong = 0;
    this.outPerfect = true;     // false once the player chooses "keep holding"
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.layer = document.getElementById('stage2-layer');
    this.layer.style.display = 'block';
    this._setProgress('Ila’s Academy', 0);
    SFX.motif('ila');
    this._intro();
  }

  _assist() { return this.game.state.assistMode; }
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
    if (i !== this.trackNext) { SFX.tap(); this.trackWrong++; return; } // out of order: gentle, but counted
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
    const layout = this._assist() ? ['sit', 'heel', 'down', 'stay'] : OBEY_BUTTONS_CHALLENGE;
    layout.forEach(cmd => {
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
    const cmd = this.obeySeq[this.obeyIndex];
    document.getElementById('s2-obey-cue').textContent = 'Ila says: “' + OBEY_LABELS[cmd] + '!”';
  }
  _obeyTap(cmd) {
    const expected = this.obeySeq[this.obeyIndex];
    if (cmd !== expected) { SFX.tap(); this.obeyWrong++; return; }   // wrong tap re-prompts; counted
    SFX.cheer();
    this.obeyIndex++;
    this._setProgress('Drill 2 — Obedience', this.obeyIndex / this.obeySeq.length);
    if (this.obeyIndex >= this.obeySeq.length) { this._completeObedience(); return; }
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
    // Over-eager comedy — a gentle redo, never a fail or a reward. Costs the perfect-Out.
    this.outPerfect = false;
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
    // Stars: clean tracking + clean obedience + perfect Out = 3.
    let stars = 1;
    if (this.trackWrong === 0 && this.obeyWrong === 0 && this.outPerfect) stars = 3;
    else if (this.trackWrong <= 2 && this.obeyWrong <= 2) stars = 2;
    const medals = this.outPerfect ? [{ id: 'perfect-out', label: 'Perfect Out!' }] : [];
    this.game.stageResult('stage2-academy', stars, medals);
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
      expected: this.drill === 'obedience' ? this.obeySeq[this.obeyIndex] : null,
      outCalled: this.outCalled,
      trackWrong: this.trackWrong, obeyWrong: this.obeyWrong, outPerfect: this.outPerfect,
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

/* ================================================================
   STAGE 3 — Ila Fight Scene (family-safe side-view "fighter").
   Ila anchors; the player times Merlin's assists to fill a Teamwork
   meter and trigger a finisher. Opponents are cartoon troublemakers
   who bonk → see stars → drop loot → flee. No injury, no KO, no death.
   The resource is "Pep" (zero = a funny tumble + retry, never game over).
   ================================================================ */
const STAGE3_OPPONENTS = [
  { id: 1, name: 'Garbage Goblin', color: '#7fae4b', prop: '🍌', prefer: 'boof', intro: 'Garbage Goblin is tipping the bins again!' },
  { id: 2, name: 'Mischief Gremlin', color: '#9b6fc0', prop: '👟', prefer: 'trip', intro: 'Mischief Gremlin swiped a shoe!' },
  { id: 3, name: "The Mailman's Nemesis", color: '#8a8f98', prop: '🗑️', prefer: 'wiggle', intro: "The Mailman's Nemesis tipped the trash everywhere!" },
];
const STAGE3_TEXT = {
  intro: [
    { speaker: 'Ila', text: 'We do not act because we are angry. We protect because we are needed.' },
    { speaker: 'Ila', text: 'Stay beside me. Watch. Wait. Help at the right moment.' },
    { speaker: 'Merlin', text: 'I shall unleash my most powerful technique: the Boof.' },
    { speaker: 'Ila', text: '...Use it well.' },
  ],
  outro: [
    { speaker: 'Merlin', text: 'Did we just… do a job? Was that a job?!' },
    { speaker: 'Ila', text: 'That was teamwork. Yours was the easy part.' },
    { speaker: 'Ila', text: 'You watched, waited, and helped at the right moment. You did it well.' },
    { speaker: 'Merlin', text: 'Excellent. I am proud. Also tired.' },
  ],
  flee: 'They scampered off! ⭐',
  pepOut: 'Oof! Merlin takes a tumble. Shake it off and try again!',
  telegraph: '❗ Winding up!',
};
const ASSIST_GAIN = { boof: 34, trip: 34, wiggle: 40 };

// A round, googly-eyed cartoon troublemaker — silly, never scary.
function drawOpponent(ctx, color) {
  const g = pen(ctx);
  g.fill('#000000', 0.15); g.ellipse(40, 98, 70, 12);
  g.fill(color, 1); g.ellipse(40, 60, 64, 74);
  g.fill(color, 1); g.rrect(22, 92, 12, 16, 4); g.rrect(46, 92, 12, 16, 4);
  g.fill(color, 1); g.ellipse(6, 58, 16, 30); g.ellipse(74, 58, 16, 30);
  g.fill('#ffffff', 0.18); g.ellipse(40, 68, 40, 46);
  g.fill('#ffffff', 1); g.circle(28, 48, 11); g.circle(54, 48, 11);
  g.fill('#222222', 1); g.circle(30, 50, 5); g.circle(56, 50, 5);
  g.fill('#000000', 0.55); g.rect(18, 33, 18, 4); g.rect(46, 33, 18, 4);   // comic brows
  g.fill('#5a3a2a', 1); g.rrect(28, 72, 24, 7, 3);                          // goofy mouth
  g.fill('#ffffff', 1); g.rect(32, 72, 4, 4); g.rect(44, 72, 4, 4);        // two silly teeth
  ctx.globalAlpha = 1;
}

// Neighborhood yard: sky, grass, a little house, a fence.
function drawYard(ctx) {
  const g = pen(ctx);
  g.fill('#bfe3f2', 1); g.rect(0, 0, GW, 330);
  g.fill('#fff1a8', 1); g.circle(330, 64, 24);
  g.fill('#cfe8a0', 1); g.rect(0, 330, GW, GH - 330);
  g.fill('#b7d684', 1); g.ellipse(195, 470, 380, 80);
  g.fill('#e8d6b0', 1); g.rect(24, 200, 150, 110);          // house
  g.fill('#b9543f', 1); g.tri(14, 202, 184, 202, 99, 150);  // roof
  g.fill('#7a5a36', 1); g.rect(74, 252, 30, 58);            // door
  g.fill('#9fd0e8', 1); g.rect(124, 226, 30, 28);           // window
  for (let x = 212; x < GW; x += 26) { g.fill('#caa472', 1); g.rect(x, 252, 9, 58); }
  g.fill('#caa472', 1); g.rect(206, 264, GW - 206, 8);      // fence rail
  ctx.globalAlpha = 1;
}

class Stage3Scene extends Scene {
  enter() {
    this.game.setAccent('ila');
    this.game.setHud('Stage 3');
    this.game.state.flags.stage3Started = true;
    this.t = 0;
    this.oppIndex = -1;
    this.opp = null;
    this.pep = 100;
    this.teamwork = 0;
    this.cool = { boof: 0, trip: 0, wiggle: 0 };
    this.fighting = false;
    this.fleeing = false;
    this.telegraph = 0;
    this.attackTimer = 0;
    this._fleeToken = 0;
    this._fleeStart = 0;
    this.assistsUsed = new Set();   // performance: variety, interrupts, pep-outs
    this.interrupts = 0;
    this.pepOuts = 0;
    this.lastAssist = null;
    this.repeatStreak = 0;
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.layer = document.getElementById('stage3-layer');
    this.layer.style.display = 'block';
    this.pepFill = document.getElementById('s3-pep-fill');
    this.teamFill = document.getElementById('s3-team-fill');
    this.foeName = document.getElementById('s3-foe-name');
    this.telegraphEl = document.getElementById('s3-telegraph');
    this.banner = document.getElementById('s3-banner');
    this.finishBtn = document.getElementById('s3-finish');
    this.btn = {
      boof: document.getElementById('s3-boof'),
      trip: document.getElementById('s3-trip'),
      wiggle: document.getElementById('s3-wiggle'),
    };
    this.bind.on(this.btn.boof, 'click', () => this._useAssist('boof'));
    this.bind.on(this.btn.trip, 'click', () => this._useAssist('trip'));
    this.bind.on(this.btn.wiggle, 'click', () => this._useAssist('wiggle'));
    this.bind.on(this.finishBtn, 'click', () => { if (this._finisher()) { /* real timer handles progression */ } });
    this._updateMeters();
    SFX.motif('ila');
    this.game.dialogue.show(STAGE3_TEXT.intro, () => this._startOpponent(0));
  }

  _assist() { return this.game.state.assistMode; }
  _updateMeters() {
    this.pepFill.style.width = Math.max(0, this.pep) + '%';
    this.teamFill.style.width = Math.min(100, this.teamwork) + '%';
  }
  _showFinisher(on) {
    this.finishBtn.style.display = on ? 'block' : 'none';
    this.finishBtn.classList.toggle('ready', !!on);
  }

  _startOpponent(i) {
    this.oppIndex = i;
    this.opp = STAGE3_OPPONENTS[i];
    this.opp.state = 'fighting';
    this.pep = 100;
    this.teamwork = 0;
    this.cool = { boof: 0, trip: 0, wiggle: 0 };
    this.fighting = true;
    this.fleeing = false;
    this.telegraph = 0;
    this.attackTimer = this._assist() ? 5200 : 3600;
    this.foeName.textContent = this.opp.name + '  ' + this.opp.prop;
    this.telegraphEl.style.display = 'none';
    this._showFinisher(false);
    this._updateMeters();
    this.game.dialogue.show([{ speaker: 'Narrator', text: this.opp.intro }]);
  }

  _useAssist(id, force) {
    if (!this.fighting || this.fleeing) return false;
    if (!force && this.cool[id] > 0) return false;
    this.cool[id] = this._assist() ? 250 : 700;
    if (id === 'boof') SFX.boof(); else if (id === 'trip') SFX.bonk(); else SFX.tap();
    this.assistsUsed.add(id);
    let gain = ASSIST_GAIN[id];
    // Interrupting the opponent's wind-up is the best timing.
    if (this.telegraph > 0) { this.telegraph = 0; this.telegraphEl.style.display = 'none'; gain += 12; this.interrupts++; SFX.star(); }
    if (!this._assist()) {
      // Challenge: the right tool earns more; spamming the same assist earns less.
      if (this.opp && id === this.opp.prefer) gain += 8;
      if (id === this.lastAssist) { this.repeatStreak++; gain = Math.max(8, gain - Math.min(this.repeatStreak * 6, 20)); }
      else this.repeatStreak = 0;
    }
    this.lastAssist = id;
    this.teamwork = Math.min(100, this.teamwork + gain);
    this._updateMeters();
    if (this.teamwork >= 100) this._showFinisher(true);
    return true;
  }

  _fillTeamwork() { this.teamwork = 100; this._updateMeters(); this._showFinisher(true); return true; }

  _finisher() {
    if (this.teamwork < 100 || this.fleeing || !this.fighting) return false;
    this.fighting = false;
    this.fleeing = true;
    this.opp.state = 'stars-flee';
    this._fleeStart = this.t;
    this.telegraphEl.style.display = 'none';
    this._showFinisher(false);
    this.game.state.flags['stage3Opponent' + (this.oppIndex + 1) + 'Complete'] = true;
    SFX.cheer(); SFX.star();
    this._banner(STAGE3_TEXT.flee);
    const tok = ++this._fleeToken;
    this.bind.timeout(() => { if (tok === this._fleeToken) this._afterFlee(); }, 1300);
    return true;
  }

  _afterFlee() {
    if (!this.fleeing) return;            // already progressed (e.g. by a test hook)
    this.fleeing = false;
    this._fleeToken++;                    // invalidate any pending flee timer
    this._hideBanner();
    if (this.oppIndex + 1 < STAGE3_OPPONENTS.length) this._startOpponent(this.oppIndex + 1);
    else this._outro();
  }

  _attackLands() {
    this.telegraph = 0;
    this.telegraphEl.style.display = 'none';
    this.pep = Math.max(0, this.pep - (this._assist() ? 12 : 22));
    SFX.bonk();
    this._updateMeters();
    if (this.pep <= 0) this._pepOut();
  }

  _pepOut() {
    this.fighting = false;
    this.pepOuts++;
    SFX.boof();
    this._banner(STAGE3_TEXT.pepOut);
    const idx = this.oppIndex;
    this.bind.timeout(() => { this._hideBanner(); this._startOpponent(idx); }, 1300);
  }

  _outro() {
    this.game.state.flags.stage3Complete = true;
    const variety = this.assistsUsed.size;
    let stars = 1;
    if (this.pepOuts === 0 && variety >= 3) stars = 3;
    else if (this.pepOuts <= 1 && variety >= 2) stars = 2;
    const medals = variety >= 3 ? [{ id: 'teamwork-pro', label: 'Teamwork Pro' }] : [];
    this.game.stageResult('stage3-fight', stars, medals);
    this.game.dialogue.show(STAGE3_TEXT.outro, () => this.game.goToStage('stage4-sniff'));
  }

  _banner(text) { this.banner.textContent = text; this.banner.style.display = 'block'; }
  _hideBanner() { this.banner.style.display = 'none'; }

  update(dt) {
    this.t += dt;
    ['boof', 'trip', 'wiggle'].forEach(k => { if (this.cool[k] > 0) this.cool[k] = Math.max(0, this.cool[k] - dt); });
    ['boof', 'trip', 'wiggle'].forEach(k => { if (this.btn[k]) this.btn[k].disabled = this.cool[k] > 0 || !this.fighting || this.fleeing; });
    if (!this.fighting || this.fleeing) return;
    if (this.game.dialogue.box.style.display !== 'none') return;   // pause during dialogue
    if (this.telegraph > 0) {
      this.telegraph -= dt;
      if (this.telegraph <= 0) this._attackLands();
    } else {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.telegraph = this._assist() ? 1800 : 1000;
        this.telegraphEl.style.display = 'block';
        this.attackTimer = this._assist() ? 5200 : 3600;
      }
    }
  }

  render() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = this.t;
    drawYard(ctx);
    ctx.save(); ctx.translate(2, 332 + Math.sin(t / 500) * 3); ctx.scale(1.25, 1.25); drawMerlin(ctx, Math.sin(t / 200)); ctx.restore();
    ctx.save(); ctx.translate(98, 326); ctx.scale(1.3, 1.3); drawIla(ctx); ctx.restore();
    if (this.opp) {
      const fleeOff = this.fleeing ? Math.min(1, (t - this._fleeStart) / 1300) : 0;
      const ox = 250 + fleeOff * 230;
      const wob = this.telegraph > 0 ? Math.sin(t / 55) * 4 : Math.sin(t / 320) * 2;
      ctx.save(); ctx.translate(ox + wob, 332 - fleeOff * 26); ctx.scale(1.4, 1.4); drawOpponent(ctx, this.opp.color); ctx.restore();
      ctx.font = '26px serif';
      if (this.fleeing) { ctx.fillText('✨', ox - 6, 322); ctx.fillText('⭐', ox + 46, 300); ctx.fillText('✨', ox + 96, 330); }
      else if (this.telegraph > 0) { ctx.fillText('❗', ox + 34, 296); }
    }
  }

  // ── Debug/test hooks (call the real production methods) ──
  getState() {
    return {
      opponentIndex: this.oppIndex,
      opponentName: this.opp ? this.opp.name : null,
      opponentState: this.opp ? this.opp.state : 'none',
      pep: this.pep,
      teamwork: this.teamwork,
      teamworkFull: this.teamwork >= 100,
      finisherReady: this.teamwork >= 100 && this.fighting,
      fighting: this.fighting,
      fleeing: this.fleeing,
      assistVariety: this.assistsUsed.size,
      interrupts: this.interrupts,
      pepOuts: this.pepOuts,
      prefer: this.opp ? this.opp.prefer : null,
    };
  }
  autoPlay() {
    let guard = 0;
    while (this.game.state.currentStage === 'stage3-fight' && guard++ < 40) {
      if (this.game.dialogue.box.style.display !== 'none') { this.game.dialogue.advance(); continue; }
      if (this.fighting) { this._fillTeamwork(); this._finisher(); this._afterFlee(); continue; }
      if (this.fleeing) { this._afterFlee(); continue; }
      break;
    }
    return this.game.state.currentStage;
  }

  exit() {
    this.layer.style.display = 'none';
    this.telegraphEl.style.display = 'none';
    this._hideBanner();
    this._showFinisher(false);
    if (this.ctx) this.ctx.clearRect(0, 0, GW, GH);
    this.game.dialogue.hide();
    super.exit();
  }
}

/* ================================================================
   STAGE 4 — Chinook's Big Sniff (family-safe Duck-Hunt-style gallery).
   Chinook (a 6-month-old bloodhound) POINTS to where a target is; the
   player taps what he found. Ducks flap away happy; clay/foam discs
   puff harmlessly. No weapons, no shooting, nothing is hurt. Spawns are
   deterministic under state.rngSeed.
   ================================================================ */
const STAGE4_TEXT = {
  intro: [
    { speaker: 'Chinook', text: 'Okay okay okay so the trick is you SMELL it first, THEN you look.' },
    { speaker: 'Chinook', text: 'Nose, then eyes! Nose, then eyes!' },
    { speaker: 'Merlin', text: 'I have both of those. This should be easy.' },
    { speaker: 'Chinook', text: 'Great! Then follow my point!' },
  ],
  outro: [
    { speaker: 'Chinook', text: 'Your nose will get there! Mine took a whole four months.' },
    { speaker: 'Merlin', text: 'You are six months old.' },
    { speaker: 'Chinook', text: 'Exactly! Plenty of practice.' },
    { speaker: 'Merlin', text: 'I respect you deeply and will now stop questioning puppies.' },
  ],
  bigSniff: 'BIG SNIFF! 🐽',
  scold: {
    butterfly: "That's a butterfly, not a find!",
    hat: "That's the neighbor's hat!",
    hades: 'Hades: “Tap me again and you will find new employment.”',
  },
  telegraph: '👃 Chinook points…',
};
const S4_TARGET = { duck: '🦆', clay: '🥏' };
const S4_DECOY = { butterfly: '🦋', hat: '🎩', hades: '😼' };
const S4_WAVE_ROUNDS = [3, 4, 4];

// Bright sky-and-field gallery backdrop.
function drawSkyField(ctx) {
  const g = pen(ctx);
  g.fill('#bfe7f5', 1); g.rect(0, 0, GW, 470);
  g.fill('#fff3b0', 1); g.circle(62, 68, 30);                      // sun
  g.fill('#ffffff', 0.9); g.ellipse(160, 92, 86, 30); g.ellipse(214, 104, 92, 34); g.ellipse(310, 72, 74, 26);
  g.fill('#d8f0c8', 1); g.rect(0, 460, GW, GH - 460);             // grass
  g.fill('#8fcf6b', 1); g.ellipse(40, 484, 96, 42); g.ellipse(210, 490, 128, 48); g.ellipse(356, 484, 96, 42);
  g.fill('#7cbe59', 1); g.ellipse(130, 506, 150, 42);
  ctx.globalAlpha = 1;
}

// Chinook — droopy, sweet, oversized-pawed bloodhound puppy (faces right).
function drawChinook(ctx) {
  const g = pen(ctx);
  const RUS = '#a0522d', RUS2 = '#8b4a26', CREAM = '#f0e0c8', EARD = '#6a3318', NOSE = '#241712';
  g.fill('#000000', 0.15); g.ellipse(74, 112, 98, 14);
  g.fill(EARD, 1); g.ellipse(92, 66, 24, 74); g.ellipse(130, 60, 22, 66);   // long hanging ears (behind)
  g.fill(RUS, 1);[34, 54, 86, 106].forEach(x => g.rrect(x, 86, 15, 18, 4)); // legs
  g.fill(CREAM, 1);[32, 52, 84, 104].forEach(x => g.rrect(x, 100, 19, 13, 5)); // big puppy paws
  g.fill(RUS, 1); g.ellipse(66, 72, 104, 56);                     // body
  g.fill(CREAM, 1); g.ellipse(100, 84, 42, 30);                   // chest
  g.fill(RUS, 1); g.ellipse(110, 50, 36, 38);                     // head
  g.fill(RUS2, 1); g.ellipse(126, 62, 32, 26);                    // droopy jowls
  g.fill(RUS2, 1); g.ellipse(106, 40, 26, 8); g.ellipse(112, 46, 28, 8);   // brow wrinkles
  g.fill(NOSE, 1); g.ellipse(142, 58, 16, 12);                    // big nose
  g.fill('#4a2f22', 1); g.ellipse(142, 55, 8, 4);
  g.fill('#2a1a10', 1); g.ellipse(102, 45, 8, 9); g.ellipse(116, 43, 8, 9); // droopy eyes
  g.fill('#ffffff', 1); g.circle(100, 43, 2); g.circle(114, 41, 2);
  g.fill('#7a3d1f', 1); g.ellipse(88, 56, 15, 44); g.ellipse(132, 52, 14, 40); // front ear flaps
  ctx.globalAlpha = 1;
}

class Stage4Scene extends Scene {
  enter() {
    this.game.setAccent('chinook');
    this.game.setHud('Stage 4');
    this.game.state.flags.stage4Started = true;
    this.t = 0;
    this.rng = makeRng(this.game.state.rngSeed || 1);
    this.wave = 1;
    this.roundInWave = 0;
    this.score = 0;
    this.combo = 0;
    this.bigSniff = 0;
    this.bigSniffTriggered = false;
    this.bigSniffActive = false;
    this.bigSniffBonusLeft = 0;
    this.telegraphing = false;
    this.target = null;
    this.decoy = null;
    this.lastResolve = null;
    this.decoyTaps = 0;             // performance: discrimination + combo
    this.hits = 0;
    this.maxCombo = 0;
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.layer = document.getElementById('stage4-layer');
    this.field = document.getElementById('s4-field');
    this.telegraphEl = document.getElementById('s4-telegraph');
    this.banner = document.getElementById('s4-banner');
    this.layer.style.display = 'block';
    this._updateHud();
    SFX.motif('chinook');
    this.game.dialogue.show(STAGE4_TEXT.intro, () => { this.wave = 1; this.roundInWave = 0; this._beginRound(); });
  }

  _assist() { return this.game.state.assistMode; }
  _waveRounds() { return S4_WAVE_ROUNDS[this.wave - 1]; }
  _updateHud() {
    document.getElementById('s4-wave').textContent = 'Wave ' + this.wave;
    document.getElementById('s4-score').textContent = 'Score ' + this.score;
    document.getElementById('s4-combo').textContent = 'Combo ' + this.combo;
    document.getElementById('s4-bigsniff-fill').style.width = Math.min(100, this.bigSniff) + '%';
  }
  _banner(text, ms) {
    this.banner.textContent = text; this.banner.style.display = 'block';
    this.bind.timeout(() => { this.banner.style.display = 'none'; }, ms || 1000);
  }

  _beginRound() {
    this.telegraphing = true;
    this.target = null;
    this.telegraphEl.style.display = 'block';
    SFX.sniff();
    this.bind.timeout(() => this._spawnRound(), this._assist() ? 1100 : 600);
  }

  _spawnRound() {
    if (this.target) return;                         // already spawned (e.g. forced by a test hook)
    this.telegraphing = false;
    this.telegraphEl.style.display = 'none';
    const r = this.rng;
    const kind = r() < 0.5 ? 'duck' : 'clay';
    const x = Math.round(12 + r() * 64);
    const y = Math.round(16 + r() * 30);
    this.target = { kind, x, y, el: null };
    this._addEl(this.target, true);
    // Challenge: decoys from the first wave and more often; Assist: gentler.
    const decoyFrom = this._assist() ? 2 : 1;
    const decoyChance = this._assist() ? 0.5 : 0.62;
    if (this.wave >= decoyFrom && r() < decoyChance) {
      const dkind = ['butterfly', 'hat', 'hades'][Math.floor(r() * 3)];
      const dx = Math.round(12 + r() * 64), dy = Math.round(16 + r() * 30);
      this.decoy = { kind: dkind, x: dx, y: dy, el: null };
      this._addEl(this.decoy, false);
    }
  }

  _addEl(t, primary) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 's4-target' + (primary ? ' primary' : ' decoy') + (this._assist() ? '' : ' small');
    b.setAttribute('data-kind', t.kind);
    b.setAttribute('data-role', primary ? 'primary' : 'decoy');
    b.style.left = t.x + '%';
    b.style.top = t.y + '%';
    b.textContent = primary ? S4_TARGET[t.kind] : S4_DECOY[t.kind];
    t.el = b;
    this.bind.on(b, 'click', () => primary ? this._resolveTarget(t.kind) : this._resolveDecoy(t));
    this.field.appendChild(b);
  }

  _removeEl(t, cls) {
    if (t && t.el) {
      const el = t.el; el.classList.add(cls); el.disabled = true;
      this.bind.timeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 360);
    }
  }
  _clearDecoy() { if (this.decoy) { this._removeEl(this.decoy, 'gone'); this.decoy = null; } }

  _resolveTarget(kind) {
    if (!this.target) return false;
    const bonus = this.bigSniffActive;
    this._removeEl(this.target, kind === 'duck' ? 'flyoff' : 'puff');
    this._clearDecoy();
    SFX.poof(); SFX.cheer();
    this.score += bonus ? 20 : 10;
    this.combo += 1;
    this.hits += 1;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this.lastResolve = { kind, outcome: kind === 'duck' ? 'fly-off' : 'puff' };
    this.target = null;
    if (!this.bigSniffTriggered) {
      this.bigSniff = Math.min(100, this.bigSniff + 22);
      if (this.bigSniff >= 100) this._triggerBigSniff();
    }
    if (this.bigSniffActive && --this.bigSniffBonusLeft <= 0) this.bigSniffActive = false;
    this._updateHud();
    this.roundInWave += 1;
    if (this.roundInWave >= this._waveRounds()) this._endWave();
    else this._beginRound();
    return true;
  }

  _resolveDecoy(t) {
    this.combo = 0;
    this.decoyTaps += 1;
    this.score = Math.max(0, this.score - 5);
    this.lastResolve = { kind: t.kind, outcome: 'decoy' };
    if (t.kind === 'hades') SFX.purr(); else SFX.tap();
    this._banner(STAGE4_TEXT.scold[t.kind], 900);
    this._removeEl(t, 'gone');
    if (this.decoy === t) this.decoy = null;
    this._updateHud();
    return true;
  }

  _triggerBigSniff() {
    this.bigSniffTriggered = true;
    this.bigSniffActive = true;
    this.bigSniffBonusLeft = 2;
    this.game.state.flags.stage4BigSniffTriggered = true;
    SFX.cheer();
    this._banner(STAGE4_TEXT.bigSniff, 1200);
  }

  _endWave() {
    this.game.state.flags['stage4Wave' + this.wave + 'Complete'] = true;
    if (this.wave >= 3) { this._outro(); return; }
    this.wave += 1;
    this.roundInWave = 0;
    this._updateHud();
    this._beginRound();
  }

  _outro() {
    this.game.state.flags.stage4Complete = true;
    let stars = 1;
    if (this.decoyTaps === 0 && this.maxCombo >= 5) stars = 3;
    else if (this.decoyTaps <= 2) stars = 2;
    const medals = this.decoyTaps === 0 ? [{ id: 'nose-first', label: 'Nose First' }] : [];
    this.game.stageResult('stage4-sniff', stars, medals);
    this.game.dialogue.show(STAGE4_TEXT.outro, () => this.game.goToStage('stage5-birddog'));
  }

  update(dt) { this.t += dt; }

  render() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = this.t;
    drawSkyField(ctx);
    ctx.save(); ctx.translate(2, 372 + Math.sin(t / 520) * 3); ctx.scale(1.15, 1.15); drawMerlin(ctx, Math.sin(t / 220)); ctx.restore();
    ctx.save(); ctx.translate(150, 360 + Math.sin(t / 300) * 3); ctx.scale(1.25, 1.25); drawChinook(ctx); ctx.restore();
    if (this.telegraphing) {
      ctx.save(); ctx.strokeStyle = 'rgba(160,82,45,0.5)'; ctx.setLineDash([4, 6]); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(330, 396); ctx.lineTo(300, 180); ctx.stroke(); ctx.restore();
    }
  }

  // ── Debug/test hooks (call the real production methods) ──
  getState() {
    return {
      wave: this.wave,
      roundInWave: this.roundInWave,
      score: this.score,
      combo: this.combo,
      bigSniff: this.bigSniff,
      bigSniffFull: this.bigSniff >= 100,
      bigSniffActive: this.bigSniffActive,
      telegraphing: this.telegraphing,
      target: this.target ? { kind: this.target.kind, x: this.target.x, y: this.target.y } : null,
      decoy: this.decoy ? { kind: this.decoy.kind } : null,
      lastResolve: this.lastResolve,
      decoyTaps: this.decoyTaps, hits: this.hits, maxCombo: this.maxCombo,
    };
  }
  spawnNext() { if (this.telegraphing && !this.target) { this._spawnRound(); return true; } return false; }
  tapTarget() { return this.target ? this._resolveTarget(this.target.kind) : false; }
  tapDecoy() { return this.decoy ? this._resolveDecoy(this.decoy) : false; }
  forceBigSniff() { if (!this.bigSniffTriggered) { this.bigSniff = 100; this._triggerBigSniff(); this._updateHud(); return true; } return false; }
  forceDecoy(kind) { if (!this.decoy) { this.decoy = { kind: kind || 'butterfly', x: 50, y: 24, el: null }; this._addEl(this.decoy, false); return true; } return false; }
  autoPlay() {
    let guard = 0;
    while (this.game.state.currentStage === 'stage4-sniff' && guard++ < 80) {
      if (this.game.dialogue.box.style.display !== 'none') { this.game.dialogue.advance(); continue; }
      if (this.telegraphing && !this.target) { this._spawnRound(); continue; }
      if (this.target) { this._resolveTarget(this.target.kind); continue; }
      break;
    }
    return this.game.state.currentStage;
  }

  exit() {
    this.layer.style.display = 'none';
    this.telegraphEl.style.display = 'none';
    this.banner.style.display = 'none';
    if (this.field) this.field.innerHTML = '';
    if (this.ctx) this.ctx.clearRect(0, 0, GW, GH);
    this.game.dialogue.hide();
    super.exit();
  }
}

/* ================================================================
   STAGE 5 — Merlin Goes Bird Dog (the "anti-Duck-Hunt").
   Slow, patient field work: follow the SCENT, hold a steady POINT, then
   GENTLY FLUSH on the handler's cue so the bird flies FREE. No shooting,
   no catching, nothing is hurt. Fatigue rises so the work feels real.
   Fixed (deterministic) find paths — no RNG needed.
   ================================================================ */
const S5_FIND_STEPS = [4, 6, 8];      // scent steps per find (escalating)
const S5_FINDS = 3;
const STAGE5_TEXT = {
  intro: [
    { speaker: 'Chinook', text: 'Now comes the quiet part. You smell it, find it, point, and wait.' },
    { speaker: 'Merlin', text: 'Wait after finding it?' },
    { speaker: 'Chinook', text: 'That’s the job!' },
    { speaker: 'Merlin', text: 'This job has a surprising amount of not-doing-the-thing.' },
  ],
  cue: [
    { speaker: 'Handler', text: 'Easy… easy…' },
    { speaker: 'Handler', text: '…now.' },
  ],
  outro: [
    { speaker: 'Merlin', text: 'I found it and I didn’t pounce and the bird is fine and the human is happy and I am… so tired.' },
    { speaker: 'Merlin', text: 'This is real work. Slow, and careful, and it’s for someone else.' },
    { speaker: 'Merlin', text: 'Chinook’s going to be amazing at this.' },
    { speaker: 'Merlin', text: 'It’s just… not me, is it.' },
  ],
  flushBanner: 'The bird flies free! 🕊️',
  steady: 'Steady… hold it.',
};

// Calm meadow — softer palette than the Stage 4 gallery.
function drawBirdField(ctx) {
  const g = pen(ctx);
  g.fill('#cfe6f0', 1); g.rect(0, 0, GW, 300);
  g.fill('#f3efb0', 1); g.circle(322, 60, 22);
  g.fill('#ffffff', 0.7); g.ellipse(120, 80, 80, 26); g.ellipse(252, 96, 92, 28);
  g.fill('#cfe09a', 1); g.rect(0, 300, GW, GH - 300);
  g.fill('#b9d27e', 1); g.ellipse(195, 470, 400, 90);
  g.fill('#9bbf5e', 1);
  for (let x = 10; x < GW; x += 34) { g.tri(x, GH - 40, x - 7, GH - 92, x + 7, GH - 92); g.tri(x + 14, GH - 40, x + 7, GH - 80, x + 21, GH - 80); }
  ctx.globalAlpha = 1;
}

class Stage5Scene extends Scene {
  enter() {
    this.game.setAccent('chinook');
    this.game.setHud('Stage 5');
    this.game.state.flags.stage5Started = true;
    this.t = 0;
    this.findIndex = 0;
    this.phase = 'intro';     // intro|scent|point|cue|flushed|outro
    this.scentStep = 0;
    this.holdMeter = 0;
    this.holding = false;
    this.cueReady = false;
    this.fatigue = 0;
    this.lastFlush = null;
    this.holdResets = 0;            // performance: steadiness (early releases) + fatigue
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.layer = document.getElementById('stage5-layer');
    this.cueEl = document.getElementById('s5-cue');
    this.banner = document.getElementById('s5-banner');
    this.scentBtn = document.getElementById('s5-scent-btn');
    this.holdBtn = document.getElementById('s5-hold-btn');
    this.flushBtn = document.getElementById('s5-flush-btn');
    this.layer.style.display = 'block';
    this.bind.on(this.scentBtn, 'click', () => this._advanceScent());
    this.bind.on(this.holdBtn, 'pointerdown', (e) => { e.preventDefault(); this.holding = true; });
    this.bind.on(this.holdBtn, 'pointerup', () => this._holdRelease());
    this.bind.on(this.holdBtn, 'pointerleave', () => this._holdRelease());
    this.bind.on(this.flushBtn, 'click', () => this._flush());
    SFX.motif('chinook');
    this._updateHud();
    this.game.dialogue.show(STAGE5_TEXT.intro, () => this._startFind(0));
  }

  _assist() { return this.game.state.assistMode; }
  _scentTotal() { return S5_FIND_STEPS[this.findIndex]; }
  _scentStrength() { return Math.round((this.scentStep / this._scentTotal()) * 100); }
  _holdMs() { return this._assist() ? 1200 : 2200; }

  _updateHud() {
    document.getElementById('s5-find').textContent = 'Find ' + (this.findIndex + 1) + ' of ' + S5_FINDS;
    document.getElementById('s5-scent-fill').style.width = this._scentStrength() + '%';
    document.getElementById('s5-point-fill').style.width = Math.min(100, this.holdMeter) + '%';
    document.getElementById('s5-fatigue-fill').style.width = Math.min(100, this.fatigue) + '%';
  }
  _banner(text, ms) { this.banner.textContent = text; this.banner.style.display = 'block'; this.bind.timeout(() => { this.banner.style.display = 'none'; }, ms || 1000); }

  _setPhase(p) {
    this.phase = p;
    this.scentBtn.style.display = p === 'scent' ? 'block' : 'none';
    this.holdBtn.style.display = p === 'point' ? 'block' : 'none';
    this.flushBtn.style.display = p === 'cue' ? 'block' : 'none';
    if (p !== 'cue') { this.cueEl.style.display = 'none'; this.flushBtn.disabled = true; this.flushBtn.classList.remove('ready'); }
  }

  _startFind(i) {
    this.findIndex = i;
    this.scentStep = 0;
    this.holdMeter = 0;
    this.cueReady = false;
    this._updateHud();
    SFX.sniff();
    this._setPhase('scent');
  }

  _advanceScent() {
    if (this.phase !== 'scent') return false;
    this.scentStep += 1;
    this.fatigue = Math.min(100, this.fatigue + (this._assist() ? 2 : 4));   // Challenge tires faster
    SFX.sniff();
    this._updateHud();
    if (this.scentStep >= this._scentTotal()) this._beginPoint();
    return true;
  }

  _beginPoint() {
    this.holdMeter = 0;
    this._setPhase('point');
    this._banner(STAGE5_TEXT.steady, 900);
  }

  _holdRelease() {
    if (this.phase === 'point' && this.holding && this.holdMeter < 100) {
      this.holding = false;
      this.holdMeter = 0;            // gentle reset — restraint is hard, but never a fail
      this.holdResets += 1;
      if (!this._assist()) this.fatigue = Math.min(100, this.fatigue + 4);
      this._updateHud();
    }
    this.holding = false;
  }

  _pointComplete() {
    this.holding = false;
    this.holdMeter = 100;
    this._updateHud();
    SFX.pant();
    this._setPhase('cue');
    this.cueEl.textContent = STAGE5_TEXT.cue[0].text;
    this.cueEl.style.display = 'block';
    this.flushBtn.disabled = true;
    this.game.dialogue.show(STAGE5_TEXT.cue, () => {
      this.cueReady = true;
      this.cueEl.textContent = 'now — flush gently!';
      this.flushBtn.disabled = false;
      this.flushBtn.classList.add('ready');
    });
  }

  _flush() {
    if (this.phase !== 'cue' || !this.cueReady) return false;
    this.lastFlush = 'fly-free';
    this.game.state.flags['stage5Find' + (this.findIndex + 1) + 'Complete'] = true;
    this.fatigue = Math.min(100, this.fatigue + 12);
    SFX.poof(); SFX.cheer();
    this._setPhase('flushed');
    this._banner(STAGE5_TEXT.flushBanner, 1100);
    this._updateHud();
    if (this.findIndex + 1 < S5_FINDS) this._startFind(this.findIndex + 1);
    else this._outro();
    return true;
  }

  _outro() {
    this._setPhase('outro');
    this.game.state.flags.stage5Complete = true;
    let stars = 1;
    if (this.holdResets === 0 && this.fatigue < 90) stars = 3;
    else if (this.holdResets <= 1) stars = 2;
    const medals = this.holdResets === 0 ? [{ id: 'steady-boy', label: 'Steady Boy' }] : [];
    this.game.stageResult('stage5-birddog', stars, medals);
    SFX.sigh();
    this.game.dialogue.show(STAGE5_TEXT.outro, () => this.game.goToStage('stage6-hades'));
  }

  update(dt) {
    this.t += dt;
    if (this.holding && this.phase === 'point') {
      this.holdMeter = Math.min(100, this.holdMeter + (dt / this._holdMs()) * 100);
      this._updateHud();
      if (this.holdMeter >= 100) this._pointComplete();
    }
  }

  render() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = this.t, tired = this.fatigue / 100;
    drawBirdField(ctx);
    ctx.save(); ctx.translate(372, 372); ctx.scale(-0.85, 0.85); drawChinook(ctx); ctx.restore();   // supportive cameo (right)
    const wag = this.phase === 'point' ? 0.06 * Math.sin(t / 110) : Math.sin(t / 240) * 0.5;
    const bob = Math.sin(t / (520 + tired * 420)) * (3 - tired * 1.6);
    ctx.save(); ctx.translate(64, 360 + tired * 12 + bob); ctx.scale(1.4, 1.4); drawMerlin(ctx, wag); ctx.restore();
    if (this.phase === 'scent' || this.phase === 'point') {
      ctx.save(); ctx.strokeStyle = 'rgba(120,160,90,0.5)'; ctx.setLineDash([4, 6]); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(258, 448); ctx.lineTo(330, 448 - this._scentStrength() * 0.5); ctx.stroke(); ctx.restore();
    }
  }

  // ── Debug/test hooks (call the real production methods) ──
  getState() {
    return {
      findIndex: this.findIndex,
      phase: this.phase,
      scentStep: this.scentStep,
      scentTotal: this._scentTotal(),
      scentStrength: this._scentStrength(),
      holdMeter: this.holdMeter,
      cueReady: this.cueReady,
      fatigue: this.fatigue,
      lastFlush: this.lastFlush,
      flushAvailable: this.phase === 'cue' && this.cueReady,
      holdResets: this.holdResets,
    };
  }
  advanceScent() { return this._advanceScent(); }
  completePointHold() { if (this.phase === 'point') { this._pointComplete(); return true; } return false; }
  forceHoldReset() { if (this.phase === 'point') { this.holding = true; this.holdMeter = 20; this._holdRelease(); return true; } return false; }
  flushOnCue() { return this._flush(); }
  autoPlayFind() {
    const start = this.findIndex; let guard = 0;
    while (this.findIndex === start && this.game.state.currentStage === 'stage5-birddog' && guard++ < 50) {
      if (this.game.dialogue.box.style.display !== 'none') { this.game.dialogue.advance(); continue; }
      if (this.phase === 'scent') { this._advanceScent(); continue; }
      if (this.phase === 'point') { this._pointComplete(); continue; }
      if (this.phase === 'cue' && this.cueReady) { this._flush(); continue; }
      break;
    }
    return this.fatigue;
  }
  autoPlayStage() {
    let guard = 0;
    while (this.game.state.currentStage === 'stage5-birddog' && guard++ < 120) {
      if (this.game.dialogue.box.style.display !== 'none') { this.game.dialogue.advance(); continue; }
      if (this.phase === 'scent') { this._advanceScent(); continue; }
      if (this.phase === 'point') { this._pointComplete(); continue; }
      if (this.phase === 'cue' && this.cueReady) { this._flush(); continue; }
      break;
    }
    return this.game.state.currentStage;
  }

  exit() {
    this.layer.style.display = 'none';
    this.cueEl.style.display = 'none';
    this.banner.style.display = 'none';
    if (this.ctx) this.ctx.clearRect(0, 0, GW, GH);
    this.game.dialogue.hide();
    super.exit();
  }
}

/* ================================================================
   STAGE 6 — Hades Teaches Management ("The Throne of Composure").
   A reverse-whack-a-mole: the winning skill is RESTRAINT. Tap the events
   that matter (the boys, the bowl), IGNORE the junk (doorbell, leaf),
   claim the sunbeam to rest, and delegate the tedious. Tapping junk drains
   Composure; zero Composure is a comedy spiral + reset, never a game-over.
   Deterministic scripted event sequences. Hades is imperious, never cruel.
   ================================================================ */
const STAGE6_EVENTS = {
  'boys-need': { pri: 'high', icon: '🧒', label: 'The boys need you' },
  'empty-bowl': { pri: 'high', icon: '🥣', label: 'Empty bowl' },
  'squabble': { pri: 'high', icon: '🙃', label: 'Gentle squabble' },
  'toy-fetch': { pri: 'med', icon: '🧸', label: 'Toy to fetch' },
  'doorbell': { pri: 'low', icon: '🔔', label: 'Doorbell' },
  'leaf': { pri: 'low', icon: '🍃', label: 'A leaf' },
  'noise': { pri: 'low', icon: '📦', label: 'A noise' },
  'sunbeam': { pri: 'rest', icon: '☀️', label: 'Sunbeam' },
};
const STAGE6_ROUNDS = [
  ['boys-need', 'leaf', 'empty-bowl', 'sunbeam', 'squabble'],
  ['doorbell', 'boys-need', 'leaf', 'toy-fetch', 'sunbeam', 'squabble'],
  ['leaf', 'boys-need', 'doorbell', 'empty-bowl', 'sunbeam', 'toy-fetch', 'squabble'],
];
const STAGE6_TEXT = {
  intro: [
    { speaker: 'Hades', text: 'You believe being in charge means doing everything.' },
    { speaker: 'Hades', text: 'It means doing almost nothing — perfectly, and at exactly the right moment.' },
    { speaker: 'Merlin', text: 'Doing nothing sounds like resting.' },
    { speaker: 'Hades', text: 'You are beginning to understand. Slowly.' },
  ],
  demo: [
    { speaker: 'Hades', text: 'Watch. The boys need something — I attend to it at once.' },
    { speaker: 'Hades', text: 'A leaf drifts past the window. I do not move.' },
    { speaker: 'Hades', text: 'A sunbeam arrives. I claim it. This is strategy, not laziness.' },
    { speaker: 'Hades', text: 'The tedious tasks, I delegate. Now — your turn.' },
  ],
  verdict: [
    { speaker: 'Hades', text: 'You are loud, undisciplined, and you tracked mud onto my domain.' },
    { speaker: 'Hades', text: 'And yet the boys are happy when you are near.' },
    { speaker: 'Hades', text: 'Perhaps your management style is simply… being loved.' },
    { speaker: 'Merlin', text: 'Is that a job?' },
    { speaker: 'Hades', text: 'For you? Apparently.' },
  ],
  spiral: 'Merlin spirals into chaos! Hades sighs and resets the room.',
  ignored: 'Ignored — wisely.',
};
const S6_SLOTS = [[24, 36], [62, 30], [42, 52], [76, 50], [28, 60], [60, 62]];

// Hades — a large, athletic, imperious spotted cat on a royal cushion.
function drawHades(ctx) {
  const g = pen(ctx);
  const COAT = '#bca77f', SPOT = '#5d4a30', CREAM = '#e7d8b8';
  g.fill('#5b3a8c', 1); g.ellipse(60, 140, 122, 30); g.fill('#7a52ad', 1); g.ellipse(60, 135, 108, 22);  // cushion
  g.fill(COAT, 1); g.ellipse(20, 128, 62, 18);                               // curled tail (front)
  g.fill(SPOT, 1);[14, 28, 42].forEach(x => g.circle(x, 127, 3));
  g.fill(COAT, 1); g.ellipse(62, 96, 70, 92);                                // tall sitting body
  g.fill(CREAM, 1); g.ellipse(64, 110, 40, 62);                              // chest
  g.fill(COAT, 1); g.rrect(48, 120, 14, 30, 6); g.rrect(70, 120, 14, 30, 6); // front legs
  g.fill(CREAM, 1); g.ellipse(55, 150, 16, 8); g.ellipse(77, 150, 16, 8);    // paws
  g.fill(SPOT, 1);[[44, 80], [80, 82], [40, 104], [86, 108], [50, 62], [78, 64]].forEach(([x, y]) => g.ellipse(x, y, 8, 6));
  g.fill(COAT, 1); g.ellipse(62, 46, 52, 46);                                // head
  g.fill(COAT, 1); g.tri(40, 6, 30, 44, 58, 40); g.tri(84, 6, 70, 40, 98, 44); // big ears
  g.fill('#caa6d6', 1); g.tri(42, 16, 36, 40, 53, 38); g.tri(82, 16, 75, 38, 92, 40); // inner ear
  g.fill(CREAM, 1); g.ellipse(62, 58, 34, 22);                               // muzzle
  g.fill('#3a2a30', 1); g.tri(58, 56, 66, 56, 62, 62);                       // nose
  g.fill('#c9b24a', 1); g.ellipse(50, 46, 12, 7); g.ellipse(74, 46, 12, 7);  // amber eyes
  g.fill('#2a3a20', 1); g.rrect(45, 41, 10, 4, 2); g.rrect(69, 41, 10, 4, 2); // heavy regal lids
  g.fill('#15150e', 1); g.ellipse(50, 47, 3, 5); g.ellipse(74, 47, 3, 5);    // slit pupils
  g.fill(SPOT, 1);[56, 62, 68].forEach((x, i) => g.rect(x, 16 + (i === 1 ? -2 : 0), 3, 11));  // forehead ticking
  g.fill('#ffffff', 0.7); g.rect(30, 58, 18, 1); g.rect(76, 58, 18, 1);      // whiskers
  ctx.globalAlpha = 1;
}

// Cozy living room: warm wall, wood floor, sunny window, the boys' photo, a rug.
function drawLivingRoom(ctx) {
  const g = pen(ctx);
  g.fill('#fbe6cf', 1); g.rect(0, 0, GW, 440);
  g.fill('#d9a564', 1); g.rect(0, 440, GW, GH - 440);
  g.fill('#c98f4e', 1); g.rect(0, 440, GW, 5);
  g.fill('#9fd3e8', 1); g.rrect(30, 60, 120, 120, 8);
  g.fill('#fff1a8', 1); g.circle(120, 95, 18);
  g.fill('#a9744a', 1); g.rect(26, 54, 128, 8); g.rect(26, 176, 128, 8); g.rect(86, 60, 7, 120);
  g.fill('#ffe9a8', 0.45); g.tri(58, 182, 150, 182, 120, 440);               // sunbeam on floor
  g.fill('#7a4a22', 1); g.rrect(250, 80, 96, 74, 8); g.fill('#fdf6e8', 1); g.rrect(257, 87, 82, 60, 4);
  g.fill('#9fd0e8', 1); g.rrect(261, 91, 74, 52, 3);
  g.fill('#f3c9a0', 1); g.circle(280, 118, 10); g.circle(305, 116, 11); g.circle(326, 120, 9);  // the boys
  g.fill('#7a52ad', 1); g.ellipse(150, 560, 300, 120); g.fill('#9b73c8', 1); g.ellipse(150, 560, 230, 86);
  ctx.globalAlpha = 1;
}

class Stage6Scene extends Scene {
  enter() {
    this.game.setAccent('hades');
    this.game.setHud('Stage 6');
    this.game.state.flags.stage6Started = true;
    this.t = 0;
    this.phase = 'intro';            // intro|demo|round|verdict
    this.round = 0;
    this.queue = [];
    this.active = [];
    this._eid = 0;
    this._slot = 0;
    this.spawnTimer = 0;
    this.composure = 100;
    this.happiness = 0;
    this.happinessGoal = 120;
    this.delegatesLeft = this._assist() ? 3 : 2;
    this.junkTaps = 0;             // performance: restraint
    this.composureResets = 0;
    this.delegatesUsed = 0;
    this.junkTapsThisRound = 0;
    this.cleanRounds = 0;
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.layer = document.getElementById('stage6-layer');
    this.eventsEl = document.getElementById('s6-events');
    this.banner = document.getElementById('s6-banner');
    this.delegateBtn = document.getElementById('s6-delegate');
    this.layer.style.display = 'block';
    this.bind.on(this.delegateBtn, 'click', () => this._delegate());
    SFX.motif('hades');
    this._updateHud();
    this.game.dialogue.show(STAGE6_TEXT.intro, () => this._demo());
  }

  _assist() { return this.game.state.assistMode; }
  _spawnInterval() { return [1700, 1400, 1100][Math.max(0, this.round - 1)] || 1500; }
  _junkLife() { return this._assist() ? 2800 : 2000; }

  _updateHud() {
    document.getElementById('s6-comp-fill').style.width = Math.max(0, Math.min(100, this.composure)) + '%';
    document.getElementById('s6-happy-fill').style.width = Math.min(100, Math.round(this.happiness / this.happinessGoal * 100)) + '%';
    document.getElementById('s6-round').textContent = this.phase === 'round' ? ('Round ' + this.round) : 'Hades’ Domain';
    this.delegateBtn.textContent = '🤝 Delegate (' + this.delegatesLeft + ')';
    this.delegateBtn.disabled = this.delegatesLeft <= 0 || this.phase !== 'round';
  }
  _banner(text, ms) { this.banner.textContent = text; this.banner.style.display = 'block'; this.bind.timeout(() => { this.banner.style.display = 'none'; }, ms || 1100); }

  _demo() {
    this.phase = 'demo';
    this._updateHud();
    this.game.dialogue.show(STAGE6_TEXT.demo, () => {
      this.game.state.flags.stage6DemoComplete = true;
      this._startRound(1);
    });
  }

  _startRound(r) {
    this.phase = 'round';
    this.round = r;
    this.queue = STAGE6_ROUNDS[r - 1].slice();
    this.junkTapsThisRound = 0;
    this._clearActive();
    this.spawnTimer = 0;
    this._updateHud();
  }

  _clearActive() { this.active.forEach(e => { if (e.el && e.el.parentNode) e.el.parentNode.removeChild(e.el); }); this.active = []; }
  _findActive(type) { return this.active.find(e => e.type === type) || null; }

  _spawnType(type) {
    const def = STAGE6_EVENTS[type];
    const ev = { id: ++this._eid, type, pri: def.pri, life: (def.pri === 'low' ? this._junkLife() : def.pri === 'rest' ? 3400 : null), slot: this._slot++ % S6_SLOTS.length };
    this.active.push(ev);
    this._addEl(ev);
    return ev;
  }
  _spawnNext() { if (!this.queue.length) return null; return this._spawnType(this.queue.shift()); }

  _addEl(ev) {
    const def = STAGE6_EVENTS[ev.type];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 's6-event pri-' + ev.pri + (this._assist() ? '' : ' challenge');  // Challenge: subtler cues
    b.setAttribute('data-type', ev.type);
    b.setAttribute('data-pri', ev.pri);
    b.style.left = S6_SLOTS[ev.slot][0] + '%';
    b.style.top = S6_SLOTS[ev.slot][1] + '%';
    b.innerHTML = '<span class="s6-ev-icon">' + def.icon + '</span><span class="s6-ev-label">' + def.label + '</span>';
    ev.el = b;
    this.bind.on(b, 'click', () => this._handleEvent(ev));
    this.eventsEl.appendChild(b);
  }
  _removeEl(ev) { if (ev.el && ev.el.parentNode) ev.el.parentNode.removeChild(ev.el); const i = this.active.indexOf(ev); if (i >= 0) this.active.splice(i, 1); }

  _handleEvent(ev) {
    if (this.active.indexOf(ev) < 0) return false;
    if (ev.pri === 'high') { this.happiness += 20; SFX.cheer(); }
    else if (ev.pri === 'med') { this.happiness += 10; SFX.tap(); }
    else if (ev.pri === 'low') { this.composure -= (this._assist() ? 18 : 24); this.junkTaps++; this.junkTapsThisRound++; SFX.boof(); }  // reacted to junk
    else if (ev.pri === 'rest') { this.composure = Math.min(100, this.composure + 22); SFX.purr(); }  // strategic rest
    this.composure = Math.max(0, Math.min(100, this.composure));
    this._removeEl(ev);
    this._updateHud();
    if (this.composure <= 0) this._spiral();
    else this._checkRound();
    return true;
  }

  _ignoreEvent(ev) {
    if (this.active.indexOf(ev) < 0) return false;
    if (ev.pri === 'low') { this.composure = Math.min(100, this.composure + 6); SFX.slowBlink(); this._banner(STAGE6_TEXT.ignored, 700); }
    this._removeEl(ev);
    this._updateHud();
    this._checkRound();
    return true;
  }

  _delegate(ev) {
    if (this.delegatesLeft <= 0 || this.phase !== 'round') return false;
    const target = ev || this.active.find(e => e.pri === 'high' || e.pri === 'med');
    if (!target) return false;
    this.delegatesLeft -= 1;
    this.delegatesUsed += 1;
    this.game.state.flags.stage6DelegatedTask = true;
    this.happiness += (target.pri === 'high' ? 20 : 10);
    SFX.slowBlink();
    this._removeEl(target);
    this._updateHud();
    this._checkRound();
    return true;
  }

  _spiral() {
    this.game.state.flags.stage6ComposureResetSeen = true;
    this.composureResets++;
    SFX.boof(); SFX.sigh();
    this._clearActive();
    this.composure = 60;                  // partial reset — never a game-over
    this._banner(STAGE6_TEXT.spiral, 1400);
    this._updateHud();
  }

  _checkRound() {
    if (this.phase !== 'round') return;
    if (this.queue.length === 0 && this.active.length === 0) this._completeRound();
  }
  _completeRound() {
    this.game.state.flags['stage6Round' + this.round + 'Complete'] = true;
    if (this.junkTapsThisRound === 0) this.cleanRounds++;
    if (this.round < STAGE6_ROUNDS.length) this._startRound(this.round + 1);
    else this._verdict();
  }

  _verdict() {
    this.phase = 'verdict';
    this.game.state.flags.stage6Complete = true;
    let stars = 1;
    if (this.junkTaps === 0 && this.composureResets === 0) stars = 3;
    else if (this.composureResets === 0) stars = 2;
    const medals = this.cleanRounds >= 1 ? [{ id: 'catlike-composure', label: 'Catlike Composure' }] : [];
    this.game.stageResult('stage6-hades', stars, medals);
    this._updateHud();
    SFX.slowBlink();
    this.game.dialogue.show(STAGE6_TEXT.verdict, () => this.game.goToStage('stage7-realjob'));
  }

  update(dt) {
    this.t += dt;
    if (this.phase !== 'round') return;
    if (this.game.dialogue.box.style.display !== 'none') return;
    // expire junk/rest (ignoring junk is rewarded)
    for (let i = this.active.length - 1; i >= 0; i--) {
      const ev = this.active[i];
      if (ev.life != null) { ev.life -= dt; if (ev.life <= 0) this._ignoreEvent(ev); }
    }
    // scripted spawn over time (for human play)
    if (this.queue.length && this.active.length < 3) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) { this._spawnNext(); this.spawnTimer = this._spawnInterval(); }
    }
  }

  render() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = this.t;
    drawLivingRoom(ctx);
    ctx.save(); ctx.translate(8, 412 + Math.sin(t / 600) * 2); ctx.scale(1.15, 1.15); drawMerlin(ctx, Math.sin(t / 260) * 0.6); ctx.restore();
    const flick = Math.sin(t / 700) * 0.04;                 // slow regal tail-flick feel
    ctx.save(); ctx.translate(230, 300); ctx.rotate(flick); ctx.scale(1.3, 1.3); drawHades(ctx); ctx.restore();
  }

  // ── Debug/test hooks (call the real production methods) ──
  getState() {
    return {
      phase: this.phase,
      round: this.round,
      composure: this.composure,
      happiness: this.happiness,
      happinessGoal: this.happinessGoal,
      delegatesLeft: this.delegatesLeft,
      activeTypes: this.active.map(e => e.type),
      queueLen: this.queue.length,
      demoComplete: !!this.game.state.flags.stage6DemoComplete,
      junkTaps: this.junkTaps, junkTapsThisRound: this.junkTapsThisRound,
      composureResets: this.composureResets, delegatesUsed: this.delegatesUsed, cleanRounds: this.cleanRounds,
    };
  }
  spawnEvent(type) { if (!STAGE6_EVENTS[type] || this.phase !== 'round') return false; return this._spawnType(type).type; }
  handleEvent(type) { const ev = this._findActive(type) || (this.phase === 'round' ? this._spawnType(type) : null); return ev ? this._handleEvent(ev) : false; }
  ignoreEvent(type) { const ev = this._findActive(type); return ev ? this._ignoreEvent(ev) : false; }
  delegateEvent(type) { const ev = this._findActive(type) || (this.phase === 'round' ? this._spawnType(type) : null); return ev ? this._delegate(ev) : false; }
  drainComposure() { this.composure = 0; this._spiral(); return true; }
  autoPlayRound() {
    const r = this.round; let guard = 0;
    while (this.round === r && this.phase === 'round' && this.game.state.currentStage === 'stage6-hades' && guard++ < 80) {
      const hi = this.active.find(e => e.pri === 'high' || e.pri === 'med');
      if (hi) { this._handleEvent(hi); continue; }
      const rest = this.active.find(e => e.pri === 'rest');
      if (rest) { this._handleEvent(rest); continue; }
      const junk = this.active.find(e => e.pri === 'low');
      if (junk) { this._ignoreEvent(junk); continue; }
      if (this.queue.length) { this._spawnNext(); continue; }
      break;
    }
    return this.round;
  }
  autoPlayStage() {
    let guard = 0;
    while (this.game.state.currentStage === 'stage6-hades' && guard++ < 300) {
      if (this.game.dialogue.box.style.display !== 'none') { this.game.dialogue.advance(); continue; }
      if (this.phase !== 'round') { break; }
      const hi = this.active.find(e => e.pri === 'high' || e.pri === 'med');
      if (hi) { this._handleEvent(hi); continue; }
      const rest = this.active.find(e => e.pri === 'rest');
      if (rest) { this._handleEvent(rest); continue; }
      const junk = this.active.find(e => e.pri === 'low');
      if (junk) { this._ignoreEvent(junk); continue; }
      if (this.queue.length) { this._spawnNext(); continue; }
      break;
    }
    return this.game.state.currentStage;
  }

  exit() {
    this.layer.style.display = 'none';
    this.banner.style.display = 'none';
    this._clearActive();
    if (this.ctx) this.ctx.clearRect(0, 0, GW, GH);
    this.game.dialogue.hide();
    super.exit();
  }
}

/* ================================================================
   STAGE 7 — Merlin's Real Job (the emotional finale).
   Merlin comes home tired and unsure, the boys greet him, and through
   warm tap-through interactions a monotonic Joy meter fills. Three mentor
   callbacks show the apprenticeships made him a better family dog. When
   Joy is full, comedy steps back and the sincere realization lands. Ends
   on a held tableau, the Home motif resolved, and "The End".
   Merlin lives with Nick's family and the boys. No fail state. No scoring.
   ================================================================ */
const STAGE7_INTERACTIONS = [
  { id: 'flop', label: '🐾 Flop beside the boys' },
  { id: 'goofy', label: '😝 Do the goofy thing' },
  { id: 'photo', label: '📸 Hold still for the photo', cb: 'ila' },
  { id: 'find-toy', label: '👃 Sniff out the lost toy', cb: 'chinook' },
  { id: 'let-win', label: '🧸 Let the little one win', cb: 'hades' },
  { id: 'hug', label: '🫂 Pile into a group hug' },
];
const STAGE7_CB_FLAG = { ila: 'stage7IlaCallbackComplete', chinook: 'stage7ChinookCallbackComplete', hades: 'stage7HadesCallbackComplete' };
const STAGE7_TEXT = {
  homecoming: [
    { speaker: 'Merlin', text: 'Home. Finally. My paws are so tired.' },
    { speaker: 'Merlin', text: 'Ila is brave.' },
    { speaker: 'Merlin', text: 'Chinook has the best nose in the county.' },
    { speaker: 'Merlin', text: 'Hades runs an entire household with one eyebrow.' },
    { speaker: 'Merlin', text: 'And me? I tried every job. I wasn’t great at any of them.' },
    { speaker: 'Merlin', text: '...Maybe I just don’t have a job.' },
    { speaker: 'The boys', text: 'MERLIN!! He’s home!' },
    { speaker: 'Merlin', text: '...Oh. Hello, boys.' },
  ],
  realization: [
    { speaker: 'Merlin', text: 'Oh. Oh, I see it now.' },
    { speaker: 'Merlin', text: 'Nobody else can do this one.' },
    { speaker: 'Merlin', text: 'The boys don’t need me to track, fight, hunt, or be in charge.' },
    { speaker: 'Merlin', text: 'They need me to be here. Goofy. Warm. Theirs.' },
    { speaker: 'Merlin', text: 'My job is making them happy.' },
    { speaker: 'Merlin', text: 'I’ve had it the whole time.' },
  ],
  tableau: [
    { speaker: 'Hades', text: '…He found it. About time.' },
  ],
  prompt: 'Be Merlin. Make the boys happy. 🧡',
};

// Two simple, warm kid figures (the boys) — generic and affectionate.
function drawKid(g, x, y, shirt, skin, hair) {
  g.fill('#000000', 0.12); g.ellipse(x, y + 54, 38, 9);
  g.fill(shirt, 1); g.rrect(x - 15, y + 16, 30, 30, 7);            // body
  g.fill(shirt, 1); g.rrect(x - 22, y + 18, 9, 18, 4); g.rrect(x + 13, y + 18, 9, 18, 4); // arms
  g.fill('#3a4a66', 1); g.rrect(x - 13, y + 44, 11, 14, 4); g.rrect(x + 2, y + 44, 11, 14, 4); // legs
  g.fill(skin, 1); g.ellipse(x, y, 26, 26);                        // head
  g.fill(hair, 1); g.ellipse(x, y - 8, 27, 16); g.rrect(x - 13, y - 12, 26, 8, 4); // hair
  g.fill('#23150c', 1); g.circle(x - 6, y + 1, 2.4); g.circle(x + 6, y + 1, 2.4); // eyes
  g.fill('#b5654a', 1); g.rrect(x - 5, y + 8, 10, 2.4, 1.2);       // happy smile
  g.fill('#ffffff', 1); g.circle(x - 6.7, y + 0.3, 0.8); g.circle(x + 5.3, y + 0.3, 0.8);
}
function drawBoys(ctx) {
  const g = pen(ctx);
  drawKid(g, 250, 392, '#5a8fd6', '#f3c9a0', '#3a2a18');
  drawKid(g, 320, 410, '#e07a4a', '#eebb92', '#5a3a20');
}

// Golden-hour home — warm amber wash, low sun, cozy rug.
function drawHomeGolden(ctx) {
  const g = pen(ctx);
  g.fill('#ffe2b0', 1); g.rect(0, 0, GW, 452);
  g.fill('#f0c07a', 1); g.rect(0, 452, GW, GH - 452);
  g.fill('#e0a458', 1); g.rect(0, 452, GW, 5);
  g.fill('#ffcf86', 1); g.rrect(32, 60, 120, 130, 10);             // window
  g.fill('#ff9e5c', 1); g.circle(92, 150, 30);                     // low sunset sun
  g.fill('#ffd9a0', 0.6); g.circle(92, 150, 48);
  g.fill('#b8824e', 1); g.rect(28, 54, 128, 8); g.rect(28, 186, 128, 8); g.rect(88, 60, 7, 130);
  g.fill('#ffe9b0', 0.4); g.tri(60, 192, 150, 192, 110, 452);      // warm sunbeam
  g.fill('#d98a4a', 1); g.ellipse(160, 560, 320, 120); g.fill('#e8a35e', 1); g.ellipse(160, 560, 240, 88);
  ctx.globalAlpha = 1;
}

class Stage7Scene extends Scene {
  enter() {
    this.game.setAccent('home');
    this.game.setHud('The End');
    this.game.state.flags.stage7Started = true;
    this.t = 0;
    this.phase = 'homecoming';      // homecoming|play|realization|tableau|end
    this.joy = 0;
    this.realizing = false;
    this.done = new Set();
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.layer = document.getElementById('stage7-layer');
    this.joyFill = document.getElementById('s7-joy-fill');
    this.interEl = document.getElementById('s7-interactions');
    this.tableauEl = document.getElementById('s7-tableau');
    this.endEl = document.getElementById('s7-end');
    this.layer.style.display = 'block';
    this.interEl.style.display = 'none';
    this.tableauEl.style.display = 'none';
    this.endEl.style.display = 'none';
    document.getElementById('s7-callbacks').style.display = 'none';
    this._updateJoy();
    SFX.motif('home');
    this.game.dialogue.show(STAGE7_TEXT.homecoming, () => this._beginPlay());
  }

  _updateJoy() { this.joyFill.style.width = Math.min(100, this.joy) + '%'; }

  _beginPlay() {
    this.phase = 'play';
    document.getElementById('s7-callbacks').style.display = 'flex';
    this.interEl.innerHTML = '';
    STAGE7_INTERACTIONS.forEach(it => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 's7-inter'; b.setAttribute('data-id', it.id);
      b.textContent = it.label;
      this.bind.on(b, 'click', () => this._doInteraction(it.id));
      this.interEl.appendChild(b);
    });
    this.interEl.style.display = 'flex';
    this._banner();
  }
  _banner() {
    const p = document.getElementById('s7-prompt');
    if (p) p.textContent = STAGE7_TEXT.prompt;
  }

  _doInteraction(id) {
    if (this.phase !== 'play' || this.done.has(id)) return false;
    const it = STAGE7_INTERACTIONS.find(i => i.id === id);
    if (!it) return false;
    this.done.add(id);
    this.joy = Math.min(100, this.joy + 17);     // monotonic — only ever rises
    SFX.cheer();
    if (it.cb) {
      this.game.state.flags[STAGE7_CB_FLAG[it.cb]] = true;
      const chip = document.querySelector('#s7-callbacks .s7-cb[data-cb="' + it.cb + '"]');
      if (chip) chip.classList.add('done');
    }
    const btn = this.interEl.querySelector('.s7-inter[data-id="' + id + '"]');
    if (btn) { btn.disabled = true; btn.classList.add('done'); }
    this._updateJoy();
    if (this.done.size >= STAGE7_INTERACTIONS.length) this._onJoyFull();
    return true;
  }

  _onJoyFull() {
    if (this.game.state.flags.stage7JoyFull) return;
    this.joy = 100;
    this.game.state.flags.stage7JoyFull = true;
    this._updateJoy();
    this._realization();
  }

  _realization() {
    this.phase = 'realization';
    this.realizing = true;                       // comedy SFX are suppressed during this beat
    this.interEl.style.display = 'none';
    this.layer.classList.add('reverent');
    SFX.sigh();                                  // a soft, sincere breath — not a comedy cue
    this.game.dialogue.show(STAGE7_TEXT.realization, () => this._tableau());
  }

  _tableau() {
    this.phase = 'tableau';
    this.realizing = false;
    this.layer.classList.remove('reverent');
    this.tableauEl.style.display = 'flex';
    SFX.motif('home');                           // the Home lullaby, resolved
    this.game.dialogue.show(STAGE7_TEXT.tableau, () => this._theEnd());
  }

  _theEnd() {
    this.phase = 'end';
    this.game.state.flags.stage7Complete = true;
    this.game.state.joy = this.joy;
    // Gentle finale: always full stars + a warm completion medal. No penalties.
    this.game.stageResult('stage7-realjob', 3, [{ id: 'real-job', label: 'Merlin’s Real Job' }]);
    this.endEl.style.display = 'flex';
    SFX.cheer();
    const replay = document.getElementById('s7-replay');
    this.bind.on(replay, 'click', () => { SFX.tap(); this.game.goToStage('title'); });
  }

  update(dt) { this.t += dt; }

  render() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = this.t;
    drawHomeGolden(ctx);
    // The boys appear once they've greeted him (play onward).
    if (this.phase !== 'homecoming') drawBoys(ctx);
    const joyful = this.joy / 100;
    const bob = Math.sin(t / (520 - joyful * 200)) * (2 + joyful * 2);
    const wag = Math.sin(t / (260 - joyful * 140)) * (0.5 + joyful * 0.6);
    ctx.save(); ctx.translate(40, 384 - joyful * 6 + bob); ctx.scale(1.4, 1.4); drawMerlin(ctx, wag); ctx.restore();
  }

  // ── Debug/test hooks (call the real production methods) ──
  getState() {
    return {
      phase: this.phase,
      joy: this.joy,
      joyFull: !!this.game.state.flags.stage7JoyFull,
      realizing: this.realizing,
      comedySuppressed: this.realizing,
      interactionsLeft: STAGE7_INTERACTIONS.filter(i => !this.done.has(i.id)).map(i => i.id),
      done: Array.from(this.done),
    };
  }
  doInteraction(id) { return this._doInteraction(id); }
  fillJoy() { STAGE7_INTERACTIONS.forEach(i => this._doInteraction(i.id)); return this.joy; }
  autoPlayFinale() {
    let guard = 0;
    while (this.game.state.currentStage === 'stage7-realjob' && !this.game.state.flags.stage7Complete && guard++ < 80) {
      if (this.game.dialogue.box.style.display !== 'none') { this.game.dialogue.advance(); continue; }
      const next = STAGE7_INTERACTIONS.find(i => !this.done.has(i.id));
      if (next && this.phase === 'play') { this._doInteraction(next.id); continue; }
      break;
    }
    return this.phase;
  }

  exit() {
    this.layer.style.display = 'none';
    this.layer.classList.remove('reverent');
    this.tableauEl.style.display = 'none';
    this.endEl.style.display = 'none';
    this.interEl.innerHTML = '';
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
  'stage3-fight': Stage3Scene,
  'stage4-sniff': Stage4Scene,
  'stage5-birddog': Stage5Scene,
  'stage6-hades': Stage6Scene,
  'stage7-realjob': Stage7Scene,
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
    medals: {},
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

  // ── Shared scoring: stars (1–3) + optional Merlin Medals + a light toast. ──
  // Stars never block progression; medals are optional standout-play rewards.
  stageResult(stageId, stars, medals) {
    const n = Math.max(1, Math.min(3, stars | 0));
    this.state.stars[stageId] = n;
    const earned = [];
    (medals || []).forEach(m => { if (m && m.id && !this.state.medals[m.id]) { this.state.medals[m.id] = true; earned.push(m.label || m.id); } });
    let msg = '★'.repeat(n) + '☆'.repeat(3 - n);
    if (earned.length) msg += '  ·  🏅 ' + earned.join(', ');
    this.toast(msg);
  },
  toast(text, ms) {
    const el = document.getElementById('result-toast');
    if (!el) return;
    el.textContent = text; el.style.display = 'block';
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { el.style.display = 'none'; }, ms || 1800);
  },

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
    // Stage 3 hooks (delegate to the live scene; reuse real production methods).
    stage3GetState() { return game.scene && game.scene.getState ? game.scene.getState() : null; },
    stage3UseAssist(id) { return game.scene && game.scene._useAssist ? game.scene._useAssist(id, true) : false; },
    stage3FillTeamwork() { return game.scene && game.scene._fillTeamwork ? game.scene._fillTeamwork() : false; },
    stage3Finish() { return game.scene && game.scene._finisher ? game.scene._finisher() : false; },
    stage3AfterFlee() { return game.scene && game.scene._afterFlee ? game.scene._afterFlee() : false; },
    stage3ForcePepZero() { if (game.scene && game.scene._pepOut && game.scene.fighting) { game.scene.pep = 0; game.scene._pepOut(); return true; } return false; },
    stage3AutoPlayFight() { return game.scene && game.scene.autoPlay ? game.scene.autoPlay() : null; },
    // All Stage 3 player-facing strings (for the family-safety guardrail scan).
    stage3AllText() {
      const parts = [];
      STAGE3_TEXT.intro.concat(STAGE3_TEXT.outro).forEach(l => parts.push(l.text));
      STAGE3_OPPONENTS.forEach(o => { parts.push(o.name, o.intro); });
      parts.push(STAGE3_TEXT.flee, STAGE3_TEXT.pepOut, STAGE3_TEXT.telegraph,
        'Boof Bark', 'Tail Trip', 'Distraction Wiggle', 'Boof & Bound', 'Pep', 'Teamwork');
      return parts.join(' \n ');
    },
    // Stage 4 hooks (delegate to the live scene; reuse real production methods).
    stage4GetState() { return game.scene && game.scene.getState ? game.scene.getState() : null; },
    stage4SpawnNextTarget() { return game.scene && game.scene.spawnNext ? game.scene.spawnNext() : false; },
    stage4TapTarget() { return game.scene && game.scene.tapTarget ? game.scene.tapTarget() : false; },
    stage4TapDecoy() { return game.scene && game.scene.tapDecoy ? game.scene.tapDecoy() : false; },
    stage4TriggerBigSniff() { return game.scene && game.scene.forceBigSniff ? game.scene.forceBigSniff() : false; },
    stage4ForceDecoy(kind) { return game.scene && game.scene.forceDecoy ? game.scene.forceDecoy(kind) : false; },
    stage4AutoPlayGallery() { return game.scene && game.scene.autoPlay ? game.scene.autoPlay() : null; },
    // All Stage 4 player-facing strings (for the family-safety guardrail scan).
    stage4AllText() {
      const parts = [];
      STAGE4_TEXT.intro.concat(STAGE4_TEXT.outro).forEach(l => parts.push(l.text));
      parts.push(STAGE4_TEXT.bigSniff, STAGE4_TEXT.telegraph,
        STAGE4_TEXT.scold.butterfly, STAGE4_TEXT.scold.hat, STAGE4_TEXT.scold.hades,
        'spot', 'tap', 'find', 'point', 'poof', 'fly off', 'clay puff', 'scent spot');
      return parts.join(' \n ');
    },
    // Stage 5 hooks (delegate to the live scene; reuse real production methods).
    stage5GetState() { return game.scene && game.scene.getState ? game.scene.getState() : null; },
    stage5AdvanceScent() { return game.scene && game.scene.advanceScent ? game.scene.advanceScent() : false; },
    stage5CompletePointHold() { return game.scene && game.scene.completePointHold ? game.scene.completePointHold() : false; },
    stage5ForceHoldReset() { return game.scene && game.scene.forceHoldReset ? game.scene.forceHoldReset() : false; },
    stage5FlushOnCue() { return game.scene && game.scene.flushOnCue ? game.scene.flushOnCue() : false; },
    stage5AutoPlayFind() { return game.scene && game.scene.autoPlayFind ? game.scene.autoPlayFind() : null; },
    stage5AutoPlayStage() { return game.scene && game.scene.autoPlayStage ? game.scene.autoPlayStage() : null; },
    // All Stage 5 player-facing strings (for the family-safety guardrail scan).
    stage5AllText() {
      const parts = [];
      STAGE5_TEXT.intro.concat(STAGE5_TEXT.cue, STAGE5_TEXT.outro).forEach(l => parts.push(l.text));
      parts.push(STAGE5_TEXT.flushBanner, STAGE5_TEXT.steady,
        'Follow the scent', 'Hold the point', 'Flush gently',
        'scent', 'sniff', 'point', 'hold steady', 'wait', 'flush gently', 'bird flies free', 'help the human');
      return parts.join(' \n ');
    },
    // Stage 6 hooks (delegate to the live scene; reuse real production methods).
    stage6GetState() { return game.scene && game.scene.getState ? game.scene.getState() : null; },
    stage6SpawnEvent(type) { return game.scene && game.scene.spawnEvent ? game.scene.spawnEvent(type) : false; },
    stage6HandleEvent(type) { return game.scene && game.scene.handleEvent ? game.scene.handleEvent(type) : false; },
    stage6IgnoreEvent(type) { return game.scene && game.scene.ignoreEvent ? game.scene.ignoreEvent(type) : false; },
    stage6DelegateEvent(type) { return game.scene && game.scene.delegateEvent ? game.scene.delegateEvent(type) : false; },
    stage6DrainComposure() { return game.scene && game.scene.drainComposure ? game.scene.drainComposure() : false; },
    stage6AutoPlayRound() { return game.scene && game.scene.autoPlayRound ? game.scene.autoPlayRound() : null; },
    stage6AutoPlayStage() { return game.scene && game.scene.autoPlayStage ? game.scene.autoPlayStage() : null; },
    // All Stage 6 player-facing strings (for the tone/safety guardrail scan).
    stage6AllText() {
      const parts = [];
      STAGE6_TEXT.intro.concat(STAGE6_TEXT.demo, STAGE6_TEXT.verdict).forEach(l => parts.push(l.text));
      Object.keys(STAGE6_EVENTS).forEach(k => parts.push(STAGE6_EVENTS[k].label));
      parts.push(STAGE6_TEXT.spiral, STAGE6_TEXT.ignored, 'Composure', 'Happiness', 'Delegate');
      return parts.join(' \n ');
    },
    // Stage 7 hooks (delegate to the live scene; reuse real production methods).
    stage7GetState() { return game.scene && game.scene.getState ? game.scene.getState() : null; },
    stage7DoInteraction(id) { return game.scene && game.scene.doInteraction ? game.scene.doInteraction(id) : false; },
    stage7FillJoy() { return game.scene && game.scene.fillJoy ? game.scene.fillJoy() : false; },
    stage7AutoPlayFinale() { return game.scene && game.scene.autoPlayFinale ? game.scene.autoPlayFinale() : null; },
    // All Stage 7 player-facing strings (for the finale guardrail scan).
    stage7AllText() {
      const parts = [];
      STAGE7_TEXT.homecoming.concat(STAGE7_TEXT.realization, STAGE7_TEXT.tableau).forEach(l => parts.push(l.text));
      STAGE7_INTERACTIONS.forEach(i => parts.push(i.label));
      parts.push(STAGE7_TEXT.prompt, 'The End', "Merlin's job: making the boys happy.");
      return parts.join(' \n ');
    },
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
  // One bad frame must never permanently freeze the game loop.
  try { if (game.scene) { game.scene.update(dt); game.scene.render(); } }
  catch (e) { if (!loop._warned) { console.error('frame error:', e); loop._warned = true; } }
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
