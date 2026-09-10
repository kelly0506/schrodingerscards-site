/* ================= CATamaran =================

   Two waves meeting cancel where they are exactly out of step. That is the
   whole game: the sea sends a swell, you send the same shape upside down, and
   where they cross the water goes flat. Put that flat spot on the cat.

   The one piece of geometry everything else falls out of: your wave and the
   swell travel at the SAME speed in opposite directions, so they hold a
   permanent flat spot at the midpoint between their launch points. Not for one
   frame - for the whole passage. Putting that midpoint on the cat fixes the
   release line at X_YOU + 2 * (X_CAT - X_YOU), and nothing else about the
   board has to move. Equal speeds are not negotiable: an earlier build slowed
   the player's wave to shift that line and measured 83% of the swell still
   standing on a shot that landed dead on the boat, because the flat spot stops
   existing the moment the two speeds differ.

   Ported from the thirteenth prototype pass. Tuning constants are ALL-CAPS at
   the top, as everywhere else in this arcade. */


/* =====================================================================
   Catamaran.
   One engine, three control schemes. Everything that made the first
   version unreadable is fixed here rather than per-take:
     - waves travel slower and your machine sits closer to the cat, so
       there are ~3.8 seconds between a swell launching and the moment
       you must release, instead of ~1.9;
     - the release moment is a marked line on the water, not a feel;
     - what you got wrong is said out loud after every swell.
   ===================================================================== */
const TAU = Math.PI * 2, HALF = Math.PI / 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];

const W = 760, H = 250, SEA_Y = 140, VSCALE = 1.7;
/* The machine near the left edge, the boat well left of centre, both nailed
   down. An earlier pass drifted the boat seaward to push the release line out
   with it; it worked, but it made the player track a target that moves. The
   sea getting faster does the same job and is one thing to understand rather
   than two. */
const X_YOU = 56, X_CAT = 212;
/* Base wave speed, and now the ONLY difficulty lever that moves the geometry.
   A cancellation is only as forgiving as the wave's PERIOD, so speed sets how
   long a tap can be wrong for, how long you get to read a swell before it
   reaches the line, and how close together the sea can send them. It runs
   50 -> 96 over three minutes: reading time for a new swell falls from 8.8
   seconds to 4.6, and the slack in your thumb from about a third of a second
   to a tenth. Nothing else about the board changes. */
const C0 = 50, C_RAMP = 46;
/* Release when the swell's crest is here. Your wave and the swell travel at
   the same speed in opposite directions, so they hold a permanent flat spot
   at the midpoint between their launch points — the boat rides in still water
   for the whole passage, not for one frame. Putting that midpoint on the cat
   is the entire geometry, and it fixes the line at
       X_REL = X_YOU + 2 * (X_CAT - X_YOU)
   Equal speeds are not negotiable: an earlier pass slowed your wave down to
   move this line and measured 83% of the swell still standing on a shot that
   landed dead on the boat, because the flat spot stops existing the moment
   the two speeds differ. */
const X_REL = X_YOU + 2 * (X_CAT - X_YOU);

/* THE RELEASE WINDOW. This band used to be drawn and do nothing: it lit the
   button up and never touched the shot, which is exactly what it looked like.
   It is the mechanic now. Tap with the crest inside it and the launch is
   nudged toward the exact instant — all of the error removed dead centre,
   none of it at the edge, smoothly in between, so there is no cliff and the
   middle of the band is still worth aiming at. Firing is otherwise as
   unprotected as it was: outside the band nothing is done for you at all.
   The width is set per wave, and measured rather than picked — see below. */
/* THE CORE WINDOW: the zone inside which your tap is corrected COMPLETELY,
   so the two waves meet exactly over the cat and he does not move at all.
   Same milliseconds for every wave, and it closes as the moon fills.

   There was no such window before, and that was the whole problem. Correction
   faded from full at the dead centre to nothing at the edge, which sounds
   gentle and is the worst of both: almost every tap kept a little error, and
   a little error does not gently nudge the boat, it SHAKES it. Two waves
   closing head-on with the node slightly off the cat leave him sitting beside
   the node, oscillating for the whole passage rather than being lifted once —
   a quarter wavelength out is twice as violent as never firing at all. So
   "nearly right" looked dramatic, which reads as the game ignoring a good
   shot. There has to be a zone where nearly right IS right. */
const CORE_MS0 = 175, CORE_MS1 = 50;
/* GEOMETRICALLY, not linearly. What a player feels is not the width of the
   window, it is the share of their taps that land inside it, and that follows
   an error curve rather than a straight line. Shrinking the core linearly from
   235 to 50 cost roughly 4, 10, 18 and 28 points of success across the four
   quarters of a run - nearly free at first and then a collapse, which is
   exactly the "too easy then suddenly very hard" this is fixing. Taking the
   same proportion off every second instead costs about 12, 16, 16 and 13:
   harder from the outset and even the whole way down. */
const geo = (a, b, t) => a * Math.pow(b / a, t);
const coreMsRaw = p => geo(CORE_MS0, CORE_MS1, p);
/* Outside the core the correction tapers away over this much again. It WIDENS
   as the moon fills: late on the core is only a few pixels, so without a
   longer shoulder a thumb that is 100ms out lands in open water where nothing
   helps at all - and a wave with no help does not merely fail to cancel, it
   doubles the swell. The shoulder is what keeps a near miss near. */
const taperFor = p => lerp(1.7, 2.8, p);
const coreFor = p => coreMsRaw(p) / 1000 * (C0 + C_RAMP * p);
const bandFor = p => coreFor(p) * taperFor(p);
/* Because the core is the same time for every wave and the correction inside
   it is exact, all five are now EXACTLY as forgiving as each other where it
   matters. The per-wave calibration further down only describes what happens
   once you are outside the core. */
/* Full correction inside the core, smoothly to none at the band edge. Because
   the core is the same time for every wave and the correction inside it is
   exact, all five are now EXACTLY as forgiving as each other where it
   matters. The per-wave calibration further down only describes what happens
   once you are outside the core. */
/* And outside the core, the wave you send comes out WEAK - by exactly as much
   as it has to, and no more. This replaces a flat taper that was the single
   worst thing in the game.

   A mistimed answer is not neutral. Two equal packets meeting with a residual
   phase error phi leave sqrt(1 + a^2 - 2a cos phi) standing, where a is your
   amplitude against the swell's 1. That is greater than 1 - you have made it
   WORSE than never firing - the moment a > 2 cos phi. Past a quarter
   wavelength out, any full-strength answer is a mistake.

   The old rule wound amplitude down from the band edge to a floor of .4, in
   pixels, the same for every wave. Pixels are the wrong unit: phi is a
   fraction of a WAVELENGTH, so the same 16px was 35% of a Ripple and 10% of a
   Roller. Measured, Ripple peaked at 1.71x the swell - answering it 360ms late
   threw the cat 71% harder than ignoring it, and the shoulder that was
   supposed to keep a near miss near was painted green right through that zone.
   All five overshot: Chop 1.36, Swell 1.29, Roller 1.22, Spike 1.15.

   So cap the amplitude at the largest value whose residual stays at or under
   1.0, and MEASURE that cap rather than deriving it. The analytic 2 cos phi
   fixes four waves and leaves Roller at 1.21, because a flat top is a pile of
   harmonics, and the harmonics invert sooner than the fundamental does. Bisecting
   against the real water catches that for any profile. Built at load next to
   rawTol - see safeAmp below. Worst case over the whole difficulty ramp is now
   1.00x for four waves and 1.02 for Chop: a miss fades out instead of flipping
   over, and dead centre is still exactly 0.00. */
const assistK = (err, core, band) => {
  const e = Math.abs(err);
  if (e <= core) return 1;
  if (e >= band) return 0;
  const u = (e - core) / (band - core);
  return 1 - u * u * (3 - 2 * u);
};
/* The core in milliseconds. No longer shown to the player - it was a testing
   readout and the HUD is better without it - but the page still reports it
   below, and it stays the one number the whole difficulty curve turns on. */
const coreMs = p => coreMsRaw(p);
/* A swell counts as handled if what is left of it is under this much of what
   it would have been. Not perfection - a clear improvement. */
const HANDLED = .7;
/* Difficulty is one number, progress, running 0 -> 1 over three minutes.
   Everything that gets harder reads off it, and so does the moon. */
const FULL_MOON_SECS = 180;
const PHASES = ['New moon', 'Waxing crescent', 'First quarter',
                'Waxing gibbous', 'Nearly full', 'Full moon'];
/* How long your wave fades in for. Long enough to kill the birth step, short
   enough that the cancellation is still exact by the time it matters. */
const RAMP = 0.26;


/* The sea has no machine any more, so swells start off the right-hand edge
   and slide into view. That is worth more than tidiness: the crest is now
   visible for (W - X_REL)/c seconds before it reaches the release band. With
   the machine moved to the left edge that starts near 5.2s, and the difficulty
   ramp squeezes it down from there. */
const X_SPAWN = W + 46;

/* Five whole waves. Each differs in profile AND length AND height at once,
   so no two share a silhouette — that is the whole job of this list. The sea
   only ever sends one of these, so an exact answer always exists. */

/* Five waves, and the job of this list is that no two share a silhouette
   while no two are meaningfully harder than each other.

   Lengths are deliberately packed into a 2x range (64-130) — that is the
   fairness half, since forgiveness is bounded by wavelength and a 3.4x spread
   made the short ones traps. All the READING is carried by the other three
   axes instead, which cost nothing physically:
     env   how many crests arrive in the packet, 4.8 down to 1.7
     amp   how tall they stand, 8 up to 27
     shape round, triangular, pointed or flat-topped
   Spike and Chop were the pair that kept getting mixed up, so they are now
   separated on all four at once: 1.7 crests against 3.6, 27 tall against 19,
   104 long against 78, one sharp point against a run of triangles. */
/* Five waves. The core corrects exactly, for any wavelength, so length is
   FREE again - it no longer has to be rationed to keep the short waves
   playable, which is what flattened this list out last time. Back to a 3.4x
   spread, with crest count carrying the fast read. Chop is a run of tall
   sharp triangles, Spike is one very tall point, Swell is a couple of broad
   round humps; those three were the muddle. */
const WAVES = [
  { name: 'Ripple', shape: 'sine',    lam: 46,  amp: 9,  env: 2.6, col: '#6ee7c8' },
  { name: 'Chop',   shape: 'saw2',    lam: 62,  amp: 18, env: 2.1, col: '#22d3ee' },
  { name: 'Swell',  shape: 'sine',    lam: 100, amp: 15, env: 1.4, col: '#7aa2ff' },
  { name: 'Spike',  shape: 'spike2',  lam: 118, amp: 28, env: .80, col: '#c084fc' },
  /* Roller was rose, a shade off the pink that means "you". Amber is the one
     warm hue the sea can own without being mistaken for your own wave. */
  { name: 'Roller', shape: 'square2', lam: 156, amp: 12, env: .95, col: '#ffc46b' }
];

/* Envelope width is per-wave now. It used to be 1.6 wavelengths for every
   wave, which meant every packet showed the SAME number of crests no matter
   how long it was — the single biggest reason the five blurred together.
   Build B gives each wave its own count; build A keeps the flat 1.6. */

/* Liberties with the physics, deliberately. A matching game lives or dies on
   how different the things you match look, and length and height alone are a
   weak read at a glance. Every profile here is antisymmetric across half a
   cycle — prof(a + PI) === -prof(a) — which is the one property the game
   cannot do without: it is what lets your wave cancel the swell exactly when
   the shapes agree. Anything skewed front-to-back breaks that and is out. */
function prof(shape, a) {
  const c = Math.cos(a);
  /* These were sharper. Sharper looked better and played terribly: a square
     edge answered four pixels late left more water moving than not answering
     at all, because the steeper the profile the less a phase error forgives.
     Softened until every shape survives a human-sized mistake, which is as
     sharp as they can honestly be. */
  if (shape === 'spike')  return Math.sign(c) * Math.pow(Math.abs(c), 1.6);
  if (shape === 'square') return Math.sign(c) * Math.pow(Math.abs(c), 0.68);
  /* Peaks at phase 0, like every other profile here. It used to be written
     the other way up, which put a TROUGH at the packet centre — and the
     release marker is drawn at the packet centre, so Chop was the one wave
     with its marker pointing at nothing. Still antisymmetric across half a
     cycle, so it still cancels. */
  if (shape === 'saw') {
    const u = ((a / TAU) % 1 + 1) % 1;
    return (4 * Math.abs(u - 0.5) - 1) * .6 + c * .4;   // triangle, corners rounded off
  }
  /* Build B's three. Sharper than A's by a little, not by a lot: sharper
     profiles punish a phase error harder, and past a full moon there is no
     band left to absorb one. Measured, not guessed — see the note in the
     handoff about what happened the last time these were pushed. */
  if (shape === 'spike2')  return Math.sign(c) * Math.pow(Math.abs(c), 1.42);
  if (shape === 'square2') return Math.sign(c) * Math.pow(Math.abs(c), 0.50);
  if (shape === 'saw2') {
    /* Corners crisp enough to read as triangles at a glance, but not as crisp
       as they were: a sharp corner is a pile of harmonics, and every one of
       them amplifies a mistimed answer. At .85 a missed Chop threw the boat
       55px and 35 degrees, against 34px for simply ignoring it - the worst
       overshoot of the five, and the wave that felt worst to play. */
    const u = ((a / TAU) % 1 + 1) % 1;
    return (4 * Math.abs(u - 0.5) - 1) * .74 + c * .26;
  }
  return c;
}
function waveAt(w, x, t) {
  const age = t - w.t0;
  if (age < 0) return 0;
  const xc = w.x0 + w.dir * w.c * age;
  const u = (x - xc) / w.W;
  if (u <= -1 || u >= 1) return 0;
  const e = Math.cos(u * HALF);
  /* Your wave is born at the machine, which sits 122px from the boat — but a
     long packet is 186px wide, so it appears ALREADY overlapping the cat. At
     full amplitude that is a step change in the water between two frames, and
     heave is a rate of change, so it reads as a violent slam and a textbook
     cancellation scored as a capsize. Fading it in over a moment costs almost
     nothing in cancellation and removes the step entirely. */
  let a = w.amp;
  if (w.ramp) { const r = clamp((t - w.born) / w.ramp, 0, 1); a *= r * r * (3 - 2 * r); }
  return a * e * e * prof(w.shape, TAU * (x - xc) / w.lam + w.ph);
}
const mkPacket = (x0, dir, lam, amp, t0, ph, o) =>
  ({ x0, dir, lam, amp, t0, born: t0, ph, W: lam * ((o && o.env) || 1.6),
     ramp: (o && o.ramp) || 0, shape: (o && o.shape) || 'sine', c: (o && o.c) || C0 });

/* When the sea speeds up, EVERY wave has to speed up together. Two waves
   travelling at different rates never meet where the geometry says they will,
   so a wave sent just before a difficulty change would miss through no fault
   of the player — which is exactly what the stepped build was doing at every
   phase boundary. Rebasing on the current centre keeps them where they are
   and only changes how fast they go from here. */
function rebase(waves, t, c) {
  for (const w of waves) { w.x0 = centreOf(w, t); w.t0 = t; w.c = c; }
}

/* Calibration, and read this before trusting it: `raw` is DESCRIPTIVE. An
   earlier comment here claimed it was "what bandFor inverts, so the release
   window is fitted to each wave's actual physics". It never was - bandFor is
   coreFor * taperFor and has never read .raw - and the gap between the claim
   and the code is what hid the Ripple bug for a whole pass. The window is one
   global width in milliseconds for all five waves, on purpose: inside the core
   the correction is exact, so wavelength cannot matter there.

   What raw measures, per wave, is the UNCORRECTED error each wave survives:
   Ripple 5px, Chop 10px, Swell 12px, Spike 16px, Roller 9px. Those numbers are
   why safeAmp below has to exist - the global band is 15px, so without a cap
   the shoulder hands Ripple three times the error it can absorb. */
function rawTol(v) {
  const c = C0, sample = 1 / 30;
  const residual = e => {
    const sw = mkPacket(X_SPAWN, -1, v.lam, v.amp, 0, 0, { shape: v.shape, c, env: v.env });
    const tF = (X_SPAWN - (X_REL + e)) / c;
    const me = mkPacket(X_YOU, 1, v.lam, v.amp, tF, Math.PI,
                        { ramp: RAMP, shape: v.shape, c, env: v.env });
    let peak = 0;
    const end = tF + (2 * sw.W + 300) / c;
    for (let t = tF; t < end; t += sample)
      peak = Math.max(peak, Math.abs(waveAt(sw, X_CAT, t) + waveAt(me, X_CAT, t)));
    return peak / v.amp;
  };
  let lo = 0, hi = v.lam * .5;
  for (let i = 0; i < 18; i++) {
    const m = (lo + hi) / 2;
    residual(m) < HANDLED ? lo = m : hi = m;
  }
  return Math.max(lo, .5);
}
WAVES.forEach(v => { v.raw = rawTol(v); });

/* THE SAFE-AMPLITUDE CAP. For each wave, the largest amplitude your answer may
   carry at a given leftover error without leaving MORE water than not
   answering at all. Measured the same way as raw, by bisection against the
   real sea, so a profile's harmonics are accounted for rather than assumed
   away: sampled across half a wavelength, which is as far out as phase error
   means anything. Costs a few milliseconds at load and re-measures itself if
   the wave set is ever edited. */
const SAFE_N = 16;
function safeTable(v) {
  /* peak left over the boat for one swell answered at `err` with amplitude
     scaled by `a` - the same quantity the game scores as w.peak / w.amp */
  const left = (err, a) => {
    const c = C0;
    const sw = mkPacket(X_SPAWN, -1, v.lam, v.amp, 0, 0, { shape: v.shape, c, env: v.env });
    const tF = (X_SPAWN - (X_REL + err)) / c;
    const me = mkPacket(X_YOU, 1, v.lam, v.amp * a, tF, Math.PI,
                        { ramp: RAMP, shape: v.shape, c, env: v.env });
    let peak = 0;
    for (let t = 0; t < (X_SPAWN + sw.W + 60) / c; t += 1 / 120)
      if (Math.abs(centreOf(sw, t) - X_CAT) < sw.W)
        peak = Math.max(peak, Math.abs(waveAt(sw, X_CAT, t) + waveAt(me, X_CAT, t)));
    return peak / v.amp;
  };
  const tab = [];
  for (let i = 0; i <= SAFE_N; i++) {
    const err = i / SAFE_N * v.lam * .5;
    if (left(err, 1) <= 1) { tab.push(1); continue; }   // full strength is safe here
    let lo = 0, hi = 1;
    for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; left(err, m) <= 1 ? lo = m : hi = m; }
    tab.push(lo);
  }
  return tab;
}
/* Keyed on the error LEFT AFTER the window has done its work, not on what the
   thumb did - inside the core the leftover is zero, so the cap never touches a
   good shot. */
/* AND A FLOOR, which costs something and is worth it. Uncapped, the table
   sends a Ripple answered 320ms late out at amplitude ZERO: the player taps,
   the machine flashes, and no wave leaves. That is the game ignoring a tap,
   which is the exact complaint this whole pass exists to fix - being right
   about the water is no good if the screen says nothing happened.

   So something always leaves, and it leaves visibly feeble, which is the
   honest picture anyway: a rushed launch does not get the water moving. The
   price is that the guarantee softens from "never worse than not firing" to
   "at most 11% worse", because a floored wave half a wavelength out still
   adds. Measured worst case by floor: .00 -> 1.02x, .08 -> 1.07, .12 -> 1.11,
   .20 -> 1.18. Against the 1.71x this replaces, 11% is not a thing a player
   can feel, and an invisible answer very much is. */
const AMP_FLOOR = .12;
const safeAmp = (v, errLeft) => {
  const u = clamp(Math.abs(errLeft) / (v.lam * .5), 0, 1) * SAFE_N;
  const i = Math.min(SAFE_N - 1, Math.floor(u));
  return Math.max(AMP_FLOOR, lerp(v.safe[i], v.safe[i + 1], u - i));
};
const centreOf = (w, t) => w.x0 + w.dir * w.c * (t - w.t0);
/* Built here, not up with safeTable, because safeTable calls centreOf and
   centreOf is a const: running the pass any earlier throws a temporal dead
   zone ReferenceError that takes the entire script block with it. rawTol gets
   away with sitting higher up only because it never touches centreOf. */
WAVES.forEach(v => { v.safe = safeTable(v); });
function surf(waves, x, t) { let y = 0; for (const w of waves) y += waveAt(w, x, t); return y; }

/* ---------- canvas ---------- */
const FITS = new WeakMap();
let RESIZED = true;
addEventListener('resize', () => { RESIZED = true; });
function fit(cv) {
  let f = FITS.get(cv);
  if (f && !RESIZED) return f.ctx;
  const r = cv.getBoundingClientRect();
  if (!r.width) return f ? f.ctx : null;
  if (f && Math.abs(f.cssW - r.width) < 0.5) return f.ctx;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = f ? f.w : cv.width, h = f ? f.h : cv.height;
  cv.width = Math.round(r.width * dpr);
  cv.height = Math.round(r.width * dpr * h / w);
  const ctx = cv.getContext('2d');
  const sc = (r.width * dpr) / w;
  ctx.setTransform(sc, 0, 0, sc, 0, 0);
  f = { ctx, w, h, cssW: r.width, scale: r.width / w };
  FITS.set(cv, f);
  return ctx;
}
const labelPx = (cv, b) => {
  const f = FITS.get(cv);
  return Math.min(18, Math.max(9, (b || 8.6) / (f ? f.scale : 1)));
};
function tag(c, cv, text, x, y, align, col) {
  /* Space Mono is the site's mono face and is already loaded by the page;
     IBM Plex was a prototype leftover that silently fell back to whatever the
     device had. */
  c.font = '500 ' + labelPx(cv, 8.4).toFixed(1) + 'px "Space Mono", ui-monospace, monospace';
  c.textAlign = 'left';
  const w = c.measureText(text).width, h = labelPx(cv, 8.4);
  const px = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  c.fillStyle = 'rgba(4,8,16,.72)';
  c.beginPath(); c.roundRect(px - 5, y - h - 2, w + 10, h + 8, 4); c.fill();
  c.fillStyle = col || 'rgba(200,211,235,.92)';
  c.fillText(text, px, y);
}

const RIGS = [];
function rig(el, tick) {
  const p = { tick, live: true };
  RIGS.push(p);
  if ('IntersectionObserver' in window)
    new IntersectionObserver(es => { p.live = es.some(e => e.isIntersecting); },
      { rootMargin: '100px' }).observe(el);
}
let last = performance.now();
function loop(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  for (const p of RIGS) if (p.live) p.tick(dt, now / 1000);
  RESIZED = false;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ---------- the sea ---------- */
/* The moon IS the difficulty read-out: new at the start, full at three
   minutes. The terminator is a real ellipse — half-axis r*(2k-1), so it is a
   straight line at the quarter and bulges the correct way either side of it.
   Offsetting a second circle is the usual cheap version and gives a lens
   instead of a quarter, which reads wrong the moment you look at it. */
function drawMoon(c, x, y, r, k) {
  c.save(); c.translate(x, y);
  c.beginPath(); c.arc(0, 0, r, 0, TAU);
  c.fillStyle = 'rgba(233,238,250,.07)'; c.fill();
  c.strokeStyle = 'rgba(233,238,250,.13)'; c.lineWidth = 1; c.stroke();
  if (k > 0.004) {
    const a = r * Math.abs(2 * k - 1);
    c.beginPath();
    c.arc(0, 0, r, -HALF, HALF, false);
    c.ellipse(0, 0, a, r, 0, HALF, -HALF, k < 0.5);
    c.closePath();
    c.fillStyle = 'rgba(240,244,255,.80)'; c.fill();
  }
  c.restore();
}
function drawSea(c, waves, t, moon) {
  const sky = c.createLinearGradient(0, 0, 0, SEA_Y);
  sky.addColorStop(0, '#060507'); sky.addColorStop(1, '#141019');
  c.fillStyle = sky; c.fillRect(0, 0, W, SEA_Y);
  drawMoon(c, 626, 36, 15, moon);

  waves.forEach(w => {
    c.beginPath();
    for (let x = 0; x <= W; x += 4) {
      const y = SEA_Y - waveAt(w, x, t) * VSCALE;
      x === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    /* The first three swells of a run wear their own colour, so the shape on
       the water and the button that answers it are the same thing twice. Only
       the taught ones: colouring every swell would be handing over the answer
       and the game is the reading. */
    c.strokeStyle = !w.sea ? 'rgba(255,61,139,.62)'
      : w.teach ? w.col : 'rgba(142,201,232,.42)';
    c.lineWidth = w.sea && w.teach ? 1.9 : 1.3; c.stroke();
  });

  const pts = [];
  for (let x = 0; x <= W; x += 3) pts.push([x, SEA_Y - surf(waves, x, t) * VSCALE]);
  c.beginPath();
  c.moveTo(0, H); c.lineTo(pts[0][0], pts[0][1]);
  for (const p of pts) c.lineTo(p[0], p[1]);
  c.lineTo(W, H); c.closePath();
  const wg = c.createLinearGradient(0, SEA_Y - 60, 0, H);
  wg.addColorStop(0, '#1d2836'); wg.addColorStop(.45, '#121a26'); wg.addColorStop(1, '#080a10');
  c.fillStyle = wg; c.fill();
  c.beginPath();
  for (let i = 0; i < pts.length; i++) i === 0 ? c.moveTo(pts[i][0], pts[i][1]) : c.lineTo(pts[i][0], pts[i][1]);
  c.strokeStyle = '#bfe4f5'; c.lineWidth = 2; c.lineJoin = 'round'; c.stroke();
  c.save(); c.setLineDash([4, 6]); c.globalAlpha = .25;
  c.strokeStyle = '#bfe4f5'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(0, SEA_Y); c.lineTo(W, SEA_Y); c.stroke(); c.restore();
}

/* The single biggest fix from the last version: you are told exactly where
   the crest has to be when you press, instead of having to feel it. */
function drawReleaseLine(c, cv, x, armed, core, band) {
  /* Two zones, because there are two, and they are two COLOURS now. The inner
     block is the core: tap with the crest in there and the cancellation comes
     out exact whatever else you did. The shoulder around it is where the help
     runs out and the boat starts to rock.

     Both used to be green, and that was a straight lie to the player. Green
     means go, and the shoulder is where a Ripple used to leave half again as
     much water as never firing - the game was colouring its own worst zone as
     the good one. Amber says "this will help, it will not be flat", which is
     exactly what the shoulder does now that the amplitude cap stops it
     backfiring. Green is kept for the one band where flat is guaranteed. */
  const top = 30, bot = H - 26;
  c.save();
  c.globalAlpha = armed ? .09 : .06;
  c.fillStyle = '#ffcf6b';
  c.fillRect(x - band, top, band * 2, bot - top);
  c.globalAlpha = armed ? .26 : .15;
  c.fillStyle = '#5fe3a6';
  c.fillRect(x - core, top, core * 2, bot - top);
  c.restore();
  c.save();
  c.globalAlpha = armed ? .8 : .45;
  c.strokeStyle = '#5fe3a6'; c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(x - core, top); c.lineTo(x - core, bot);
  c.moveTo(x + core, top); c.lineTo(x + core, bot);
  c.stroke();
  c.restore();
  c.save();
  c.globalAlpha = armed ? .95 : .5;
  c.strokeStyle = armed ? '#5fe3a6' : '#7f8ca8';
  c.lineWidth = armed ? 2.4 : 1.4;
  c.setLineDash([5, 5]);
  c.beginPath(); c.moveTo(x, top); c.lineTo(x, bot); c.stroke();
  c.restore();
  tag(c, cv, armed ? 'RELEASE NOW' : 'RELEASE HERE', x, 24, 'center',
      armed ? '#5fe3a6' : 'rgba(200,211,235,.85)');
}

/* A marker riding on the crest of each incoming swell, so "when the crest
   reaches the line" is a thing you can actually watch. */
function drawCrestMark(c, w, t, active) {
  /* Every swell says whether it has been answered yet. Without this the sea is
     unreadable once there is more than one in it: you cannot tell the swell
     you just handled from the one still coming for you, so a bounce from an
     unanswered swell reads as the game ignoring a shot you got right. */
  const x = centreOf(w, t);
  if (x < -20 || x > W + 20) return;
  const y = SEA_Y - waveAt(w, x, t) * VSCALE;
  const done = w.answers && w.answers.length;
  const k = active || done ? 1 : .62;
  c.beginPath();
  c.moveTo(x, y - 15 * k); c.lineTo(x - 5.5 * k, y - 24 * k); c.lineTo(x + 5.5 * k, y - 24 * k);
  c.closePath();
  if (done) { c.strokeStyle = '#5fe3a6'; c.lineWidth = 1.8; c.stroke(); }
  else if (active) { c.fillStyle = '#8ec9e8'; c.fill(); }
  else { c.strokeStyle = 'rgba(142,201,232,.5)'; c.lineWidth = 1.4; c.stroke(); }
}

function drawMachine(c, x, colour, spin, v, mine) {
  c.save(); c.translate(x, SEA_Y);
  c.fillStyle = '#17121d'; c.strokeStyle = '#3d3348'; c.lineWidth = 1.5;
  c.beginPath(); c.roundRect(-21, -10, 42, 16, 4); c.fill(); c.stroke();
  c.save(); c.translate(0, -12); c.rotate(spin * (mine ? -1 : 1));
  c.strokeStyle = colour; c.lineWidth = 2.4; c.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const th = (i / 3) * TAU;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(th) * 10, Math.sin(th) * 10); c.stroke();
  }
  c.restore();
  c.beginPath(); c.arc(0, -12, 2.8, 0, TAU); c.fillStyle = colour; c.fill();
  /* Both machines draw their sample at the SAME scale, so "does mine look
     like theirs" is a fair question to ask by eye. */
  /* The sample above the machine is the exact profile you are about to send,
     drawn in that wave's own colour — it is the one honest preview. */
  if (v) {
    c.strokeStyle = v.col || colour; c.lineWidth = 2; c.lineJoin = 'round';
    c.beginPath();
    for (let i = -42; i <= 42; i++) {
      const yy = -34 - prof(v.shape, TAU * i / v.lam) * v.amp * .5;
      i === -42 ? c.moveTo(i, yy) : c.lineTo(i, yy);
    }
    c.stroke();
  }
  c.restore();
}

function drawCat(c, R, panic, t) {
  const sw = Math.sin(t * (5 + panic * 8)) * (.25 + panic * 1.1);
  c.strokeStyle = '#d98b45'; c.lineWidth = R * .34; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-R * .8, -R * .35);
  c.quadraticCurveTo(-R * 2.1, -R * (.5 + panic), -R * (1.7 + sw * .5), -R * (1.5 + panic * .7 + sw));
  c.stroke();
  c.fillStyle = '#e8a25c'; c.strokeStyle = '#a86a30'; c.lineWidth = R * .1;
  c.beginPath(); c.ellipse(0, -R * .95, R * 1.02, R * 1.12, 0, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#f9dcb8';
  c.beginPath(); c.ellipse(R * .22, -R * .78, R * .46, R * .66, .1, 0, TAU); c.fill();
  const hy = -R * 2.35;
  [-1, 1].forEach(s => {
    const bx = s * R * .56, by = hy - R * .52, ang = -HALF + s * (.5 + panic * .95);
    const tx = bx + Math.cos(ang) * R * .92, ty = by + Math.sin(ang) * R * .92 * (1 - panic * .4);
    c.fillStyle = '#f4c089'; c.strokeStyle = '#a86a30'; c.lineWidth = R * .09;
    c.beginPath(); c.moveTo(bx - s * R * .26, by + R * .1);
    c.lineTo(tx, ty); c.lineTo(bx + s * R * .38, by + R * .24);
    c.closePath(); c.fill(); c.stroke();
  });
  c.fillStyle = '#e8a25c'; c.strokeStyle = '#a86a30'; c.lineWidth = R * .1;
  c.beginPath(); c.ellipse(0, hy, R * .92, R * .84, 0, 0, TAU); c.fill(); c.stroke();
  const open = panic < .18 ? 0 : Math.min(1, (panic - .18) * 3.2);
  [-1, 1].forEach(s => {
    const ex = s * R * .36, ey = hy - R * .06;
    if (open < .05) {
      c.strokeStyle = '#a86a30'; c.lineWidth = R * .09;
      c.beginPath(); c.moveTo(ex - R * .2, ey); c.quadraticCurveTo(ex, ey + R * .12, ex + R * .2, ey); c.stroke();
    } else {
      c.save(); c.translate(ex, ey); c.scale(1, open);
      c.fillStyle = '#f7fbe6'; c.beginPath(); c.ellipse(0, 0, R * .24, R * .24, 0, 0, TAU); c.fill();
      c.fillStyle = '#141830';
      c.beginPath(); c.ellipse(0, 0, R * (.13 - panic * .05), R * .2, 0, 0, TAU); c.fill();
      c.restore();
    }
  });
  /* THE CAPTAIN'S HAT. A tricorn, and the reason is that it survives being
     small. The sailor's cap it replaces was 6px across with a 1.2px cyan band,
     near-white on a cream head, and on a phone that band lands under one
     device pixel - it was invisible for a measurable reason, not a stylistic
     one. A tricorn is carried entirely by its OUTLINE: a wide upturned brim
     with a point fore and aft and a low crown between them is recognisable as
     a silhouette, at any size, with no interior detail at all. So it is drawn
     as a silhouette, wider than the head, in near-black - which also gives it
     the contrast against tan fur that white never had.

     The pale edge is not decoration. Black on this sea is black on black, so
     the hat needs its own rim light to hold a shape against dark water. */
  /* THE EYE PATCH, over the forward eye. The strap is not optional: a black
     oval on its own reads as a smudge or a shut eye, and it is the strap
     running up and aft across the brow that says patch. It sits below the hat
     brim so the two do not fight for the same band of the head. */
  c.save();
  /* STRAIGHT, and it stops at the ear. Curved across the whole brow it was a
     unibrow: an arc spanning both eyes at eyebrow height reads as a face
     feature, not as something passing behind the head. One straight diagonal
     running up and aft to the base of the far ear reads as a strap going
     round, because that is the line a strap actually takes. */
  c.strokeStyle = '#16121c'; c.lineWidth = R * .085; c.lineCap = 'round';
  c.beginPath();
  /* Aft side: the long run, up to the base of the far ear. */
  c.moveTo(R * .34, hy - R * .10);
  c.lineTo(-R * .62, hy - R * .54);
  /* Forward side, and it has to be here too. A strap that leaves the patch in
     one direction only does not go round anything - it reads as a stray line
     with a blob on the end. Both segments start UNDER the patch, which is
     drawn after them, so each one emerges from beneath the leather rather than
     butting against its edge. The forward run is much the shorter of the two
     because the patch is already well forward on the face; it stops just
     inside the head's outline, so it passes out of sight rather than stopping
     in mid-air. */
  c.moveTo(R * .46, hy - R * .12);
  c.lineTo(R * .70, hy - R * .44);
  c.stroke();
  c.fillStyle = '#16121c';
  c.beginPath(); c.ellipse(R * .38, hy - R * .06, R * .31, R * .27, .1, 0, TAU);
  c.fill();
  /* one highlight, so it reads as leather rather than a hole */
  c.globalAlpha = .30; c.fillStyle = '#9b8ca8';
  c.beginPath(); c.ellipse(R * .30, hy - R * .16, R * .13, R * .07, .3, 0, TAU);
  c.fill();
  c.restore();

  c.save(); c.translate(0, hy - R * .70); c.rotate(-.07);
  const HAT = '#16121c', HRIM = '#8a7c98';
  /* THE LEGO PIRATE HAT, from the reference rather than from memory - and the
     shape I had been drawing was close to backwards. I had two horns standing
     up with a dip between them. This hat is the other way round: a PEAKED
     CROWN in the middle, and the brim sweeping DOWN and OUT from it to a point
     at each side. The high point is the centre, not the ends.

     That single relationship is the whole silhouette, and it is why the thing
     is recognisable as a black shape with no interior detail: crown up, brim
     down and wide, points low and outboard. It also sits deeper on the head
     than a bicorne does, with the brim coming down over the brow. */
  c.beginPath();
  c.moveTo(-R * 1.32, -R * .18);                              // port brim point, low
  c.quadraticCurveTo(-R * .74, -R * .60, -R * .50, -R * .86); // up to the crown
  c.quadraticCurveTo(0, -R * 1.46, R * .50, -R * .86);        // over the peak
  c.quadraticCurveTo(R * .74, -R * .60, R * 1.32, -R * .18);  // down to starboard point
  c.quadraticCurveTo(0, R * .06, -R * 1.32, -R * .18);        // brim underside, dipping over the brow
  c.closePath();
  c.fillStyle = HAT; c.fill();
  /* The rim light is not decoration: black on this sea is black on black, and
     the hat needs its own edge to hold a shape against dark water. Mitred, so
     the two brim points stay points. */
  c.strokeStyle = HRIM; c.lineWidth = R * .075;
  c.lineJoin = 'miter'; c.miterLimit = 8; c.stroke();

  /* THE SKULL IS THE ACCENT, in pink instead of the reference's white, because
     pink is the player's colour everywhere else in this game and the boat is
     the player's. It is also the right accent to spend on: a badge on the
     crown is what the eye goes to on the real hat, and it degrades honestly -
     at board size the detail collapses into a single pink mark on a black hat,
     which is still exactly what that reads as. */
  c.strokeStyle = '#ff3d8b'; c.lineWidth = R * .10; c.lineCap = 'round';
  c.beginPath();
  c.moveTo(-R * .25, -R * .60); c.lineTo(R * .25, -R * .90);
  c.moveTo(-R * .25, -R * .90); c.lineTo(R * .25, -R * .60);
  c.stroke();                                                  // crossbones behind
  c.fillStyle = '#ff3d8b';
  c.beginPath(); c.ellipse(0, -R * .80, R * .21, R * .19, 0, 0, TAU); c.fill();
  c.fillRect(-R * .10, -R * .69, R * .20, R * .11);            // jaw
  c.fillStyle = HAT;                                           // sockets
  c.beginPath(); c.ellipse(-R * .085, -R * .82, R * .055, R * .07, 0, 0, TAU); c.fill();
  c.beginPath(); c.ellipse(R * .085, -R * .82, R * .055, R * .07, 0, 0, TAU); c.fill();
  c.restore();

  c.fillStyle = '#f9dcb8';
  c.beginPath(); c.ellipse(0, hy + R * .32, R * .38, R * .25, 0, 0, TAU); c.fill();
  c.fillStyle = '#f2a0a8';
  c.beginPath(); c.moveTo(-R * .1, hy + R * .22); c.lineTo(R * .1, hy + R * .22); c.lineTo(0, hy + R * .34);
  c.closePath(); c.fill();
  if (panic > .55) {
    c.fillStyle = '#2a1620';
    c.beginPath(); c.ellipse(0, hy + R * .55, R * .16, R * .17, 0, 0, TAU); c.fill();
  }
  c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = R * .045;
  [-1, 1].forEach(s => { for (let i = 0; i < 2; i++) {
    c.beginPath(); c.moveTo(s * R * .28, hy + R * .28);
    c.quadraticCurveTo(s * R * .8, hy + R * (.1 + i * .2), s * R * 1.35, hy + R * (.02 + i * .3));
    c.stroke(); } });
}
/* One hull: a pointed prow, a flat run, a transom. A path rather than an
   ellipse, because an ellipse reads as a rowing boat and the game is called
   Catamaran. Bow points right, into the weather. */
function hull(c, dx, dy, len, dep, fill, line) {
  const h = len / 2;
  c.beginPath();
  c.moveTo(dx + h, dy);
  c.quadraticCurveTo(dx + h * .25, dy + dep * 1.05, dx - h * .55, dy + dep * .95);
  c.lineTo(dx - h, dy + dep * .5);
  c.lineTo(dx - h, dy);
  c.closePath();
  c.fillStyle = fill; c.fill();
  c.strokeStyle = line; c.lineWidth = 1.3; c.stroke();
}

/* THE CAT IS THE ORIGIN, and that is the whole change here.

   The boat used to be laid out from the waterline outward, with the near
   pontoon pinned just under the water's surface and everything else hung off
   it. Nothing was centred on anything: the hulls were different lengths and
   sat at different offsets, so the vessel's visual centre landed around -5,
   while the cat sat at +13 and the water was sampled at 0. Three different
   centres in one drawing, which is exactly what "cockeyed" looks like.

   Now (0,0) is the cat. It is the middle of the boat, it is the point the
   water is measured at, and it is what the hull pitches about. The two
   pontoons are the same length and sit at equal and opposite offsets from it,
   so the vessel is symmetric by construction rather than by fiddling. Pinning
   a hull to the waterline was never necessary - the boat is placed as one
   object and the water passes where it passes. */
const SEAT_H = 5;           // the cat's seat, in px above the waterline
function drawBoat(c, x, y, rot, panic, t) {
  /* Translate to the CAT, not the waterline, then pitch about it. The caller
     still passes the waterline, so no call site has to know about this. */
  c.save(); c.translate(x, y - SEAT_H); c.rotate(rot);

  /* Equal and opposite: same length, same offset, mirrored. The far pontoon
     goes up and aft, the near one down and forward, and the midpoint of the
     pair is the origin. */
  /* The horizontal offset is SMALL. Pushed out to 13 the pair stopped being
     one boat: you got a plank sticking out to port with nothing under it and
     another to starboard with nothing over it. Seen from slightly above the
     beam, a catamaran's far hull sits almost directly behind the near one and
     a little toward the vanishing point - the separation the eye reads is
     vertical, not lengthwise. */
  const OFF_X = 7, HULL_LEN = 70;
  const FAR_X = -OFF_X, NR_X = OFF_X;      // mirrored: this is the centring
  /* Vertically they are NOT mirrored, and should not be. The near hull has to
     meet the water and the far one has to sit high enough to read as further
     away; forcing them to equal and opposite heights put only 2px of the far
     hull above the trampoline, so the deck covered the second pontoon almost
     entirely and the boat went back to having one hull. The far hull's whole
     body now clears the deck's far edge. */
  /* Kept TIGHT. Spread 28px apart the far hull stopped reading as the other
     half of this boat and started reading as a plank hanging in the air above
     a different one - the gap has to be small enough that the eye pairs them.
     Deep enough hulls and a shallow deck slant do the rest. */
  const FAR_Y = -14, FAR_D = 9.5;          // far pontoon, clear of the deck
  const NR_Y  =   4, NR_D  = 11.5;         // near pontoon, 1px proud of the water
  const TRAMP_F = -6, TRAMP_N = 6;         // deck edges, mirrored about the cat

  /* The far hull stays darker than the near one, because it is further off
     and in its own shadow, but both are lighter than the water they sit
     against - drawn near-black on a near-black sea it simply vanished, and a
     catamaran with one visible hull is a boat. */
  hull(c, FAR_X, FAR_Y, HULL_LEN, FAR_D, '#191322', '#6b5a7f');

  /* Beams before the near hull, so the near hull crops their lower ends where
     it should occlude them. Tubes: dark core, lit top edge. */
  const beam = (x1, y1, x2, y2) => {
    c.strokeStyle = '#241c2c'; c.lineWidth = 4.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    c.strokeStyle = '#6b5a78'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(x1, y1 - 1.4); c.lineTo(x2, y2 - 1.4); c.stroke();
  };
  beam(FAR_X - 28, FAR_Y + 6, NR_X - 28, NR_Y + 3);        // aft beam
  beam(FAR_X + 26, FAR_Y + 6, NR_X + 26, NR_Y + 3);        // forward beam

  /* Trampoline, slanted because the far hull is higher, and stopping short of
     both beams - that shortfall is the daylight that does the actual work of
     making two pontoons read as two. It crosses the origin exactly, which is
     what the cat sits on. */
  c.beginPath();
  c.moveTo(FAR_X - 22, TRAMP_F); c.lineTo(FAR_X + 20, TRAMP_F);
  c.lineTo(NR_X + 20, TRAMP_N);  c.lineTo(NR_X - 22, TRAMP_N);
  c.closePath();
  /* Darker than the hulls and outlined faintly, so the deck recedes and the
     two pontoons lead. Lit up it read as a grey ramp, which is one object
     again rather than the gap between two. */
  c.fillStyle = '#171120'; c.fill();
  c.strokeStyle = '#3b3048'; c.lineWidth = 1; c.stroke();
  c.save(); c.globalAlpha = .16; c.strokeStyle = '#6b5a78'; c.lineWidth = .6;
  for (let i = -20; i <= 18; i += 6) {
    c.beginPath(); c.moveTo(FAR_X + i, TRAMP_F + .6); c.lineTo(NR_X + i, TRAMP_N - .8); c.stroke();
  }
  c.restore();

  hull(c, NR_X, NR_Y, HULL_LEN, NR_D, '#2a1f36', '#9b82b2');

  /* Mast aft of the cat, which is where a sail goes on a boat facing right,
     and far enough aft to leave the middle of the deck to the cat. It is also
     a long lever on purpose: the pitch the water puts on the boat shows at the
     masthead long before it shows at the deck, so flat water becomes something
     you can see being flat. */
  /* NO RIG. The sail came out at Kelly's call: with the hulls reading properly
     and the cat carrying a hat and a patch, it was covering the boat rather
     than completing it, and this drawing is 100px wide.

     One thing goes with it and is worth writing down. The mast was doing a
     second job: it is a long lever, so whatever pitch the water put on the
     boat showed at the masthead a long time before it showed at the deck, and
     "flat water is something you can SEE being flat" was half the read. That
     cue is gone. The hulls still tilt and the cat still leans, but the tell is
     smaller now, so if the boat starts feeling unresponsive to good shots this
     is the first place to look. */

  /* Amidships, dead on the origin. */
  c.save(); c.translate(0, 2); drawCat(c, 10.5, panic, t); c.restore();
  c.restore();
}

function drawFloater(c, x, y, age, t) {
  c.save(); c.translate(x, y); c.rotate(Math.sin(t * 1.6) * .16);
  c.fillStyle = '#ff8a3d'; c.strokeStyle = '#c25a1c'; c.lineWidth = 2;
  c.beginPath(); c.ellipse(0, 0, 26, 11, 0, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#0c2740';
  c.beginPath(); c.ellipse(0, 0, 13, 5, 0, 0, TAU); c.fill();
  c.strokeStyle = '#e8a25c'; c.lineWidth = 3.4; c.lineCap = 'round';
  [-9, -3, 3, 9].forEach((lx, i) => {
    c.beginPath(); c.moveTo(lx, -2); c.lineTo(lx + Math.sin(t * 3 + i) * 2, -12 - (i % 2) * 3); c.stroke();
  });
  c.save(); c.translate(0, -6); c.scale(.72, .72);
  c.fillStyle = '#e8a25c'; c.strokeStyle = '#a86a30'; c.lineWidth = 1.2;
  c.beginPath(); c.ellipse(0, -6, 9, 8, 0, 0, TAU); c.fill(); c.stroke();
  [-1, 1].forEach(s => {
    c.beginPath(); c.moveTo(s * 5, -11); c.lineTo(s * 9, -17); c.lineTo(s * 1.5, -14);
    c.closePath(); c.fillStyle = '#f4c089'; c.fill(); c.stroke();
  });
  c.strokeStyle = '#a86a30'; c.lineWidth = 1.3;
  [-1, 1].forEach(s => { c.beginPath(); c.moveTo(s * 3.5 - 2, -7); c.lineTo(s * 3.5 + 2, -7); c.stroke(); });
  c.fillStyle = '#2a1620';
  c.beginPath(); c.ellipse(0, -2.5, 2.4, 1.8, 0, 0, TAU); c.fill();
  c.restore(); c.restore();
}

/* A wave drawn as a button face. Picking a picture is the whole point of
   passes 1 and 2 — there is no number anywhere in the control strip. */
function waveIcon(o) {
  /* The button draws the WHOLE packet, fitted to the box horizontally, with
     height left on a scale shared by all five. That is a deliberate lie about
     length and a deliberate truth about the two things the player actually
     reads: how many crests arrive, and how tall they stand. Drawing it at one
     shared scale instead showed a single crest for every wave longer than
     about 90px, which threw away the crest count entirely — the one cue that
     separates all five. The reference strip lower down keeps honest scale. */
  const w = 62, h = 28, mid = 15;
  const env = (o.env || 1.6) * o.lam;
  const sx = (w / 2 - 2) / env;
  let d = '';
  for (let x = 0; x <= w; x += 1) {
    const wx = (x - w / 2) / sx, u = wx / env;
    const e = Math.abs(u) >= 1 ? 0 : Math.cos(u * HALF);
    const y = mid - e * e * prof(o.shape, TAU * wx / o.lam) * o.amp * .40;
    d += (x === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
  }
  return '<svg width="62" height="28" viewBox="0 0 62 28" aria-hidden="true">' +
    '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.9" ' +
    'stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function motion(st, waves, t, dt, xc) {
  const h = surf(waves, xc, t);
  const raw = dt > 0.0005 ? (h - (st.lastH == null ? h : st.lastH)) / dt : 0;
  st.lastH = h;
  st.vy = st.vy == null ? raw : lerp(st.vy, raw, .45);
  const v = Math.abs(st.vy);
  st.vyHeld = Math.max(v, (st.vyHeld || 0) * (1 - Math.min(1, dt * 1.6)));
  return { h, vy: v, held: st.vyHeld, pitch: -Math.atan(clamp(st.vy / 130, -1.4, 1.4)) * .75 };
}
function balanceUI(el, v) {
  el.querySelector('i').style.width = clamp(v, 0, 100) + '%';
  el.classList.toggle('mid', v < 60 && v >= 28);
  el.classList.toggle('no', v < 28);
}


/* ================= the game ================= */
function makeGame() {
  const $ = id => document.getElementById(id);
  const cv = $('stage');
  const say = $('say'), bal = $('bal');

  /* How far the water may move the cat before it costs him, in pixels of
     displacement. This used to be measured on heave — the RATE the water
     lifts him — which is right for a smooth swell and catastrophic for a
     sharp one: the derivative of a near-square edge is enormous, so a
     perfectly good answer to a Roller scored as a capsize. Displacement is
     what the player can actually see the boat doing, and it does not explode
     on a corner. */
  const TOLPX0 = 9.5, TOLPXMIN = 5.5;

  /* A tap always sends a wave, so this is the only thing stopping a player
     from spraying the sea with them. One second, and deliberately invisible:
     a visible cooldown turns the game into watching a meter instead of
     watching the water. It is long enough that a mashed tap costs you the
     next real answer, which is punishment enough. */
  const SEND_COOL = 1.0;

  const S = { on: false, phase: 'idle', t: 0, waves: [], next: 0, gap: 6.2,
              score: 0, alive: 0, bal: 100, cool: 0, over: 0, pending: 0, taught: 0,
              waveI: 2, diff: null, armedNow: false, lastPhase: null, ann: '', annT: 0,
              speed: null, lastH: null, vy: 0, flash: '', flashCol: '', flashT: 0,
              sentI: -1, sentT: 0 };

  const tolNow   = () => TOLPX0 - (TOLPX0 - TOLPXMIN) * progress();
  const rawProg  = () => S.diff != null ? S.diff : clamp(S.alive / FULL_MOON_SECS, 0, 1);
  const phaseOf  = p => Math.min(PHASES.length - 1, Math.floor(p * PHASES.length));
  const progress = () => rawProg();
  const levelNow = () => phaseOf(rawProg());
  /* Two speeds, and every bit of the geometry falls out of their ratio. The
     sea gets faster; the machine eases off a touch, which is the same thing
     said from the other side and keeps the release line moving even at the
     top of the ramp. Never let these two be equal by accident — that is the
     one arrangement where the line stops moving. */
  /* One speed for every wave in the water, yours and the sea's alike, and it
     is the only thing the ramp moves. Faster waves mean less time to read a
     swell before it hits the line, less slack in the tap, and less room
     between swells — three kinds of pressure off one number. */
  const cSea   = () => C0 + C_RAMP * progress();
  /* Wide enough that one swell is off the boat before the next is on it.
     The widest packet is about 280px across, which at full speed takes 2.9s
     to pass — under the old 2.4s gap there were always two swells on the cat
     at once, so answering one perfectly still left him bouncing, and the game
     looked like it was ignoring good shots. Pressure comes from the slack and
     the reading time instead, which is where the player can feel it. */
  const gapNow = () => 7.2 - 3.8 * progress();

  const myWave = () => WAVES[S.waveI];

  /* ---- the wave buttons, which are also the release control ---- */
  const host = $('wave');
  const picks = [];
  const paint2 = () => {
    picks.forEach((b, j) => b.classList.toggle('sent', j === S.sentI && S.sentT > 0));
    host.classList.toggle('armed', S.armedNow);
  };
  WAVES.forEach((v, i) => {
    const b = document.createElement('button');
    b.className = 'pick';
    b.style.setProperty('--wc', v.col);
    b.innerHTML = waveIcon(v) + '<em>' + v.name + '</em>';
    /* send() before paint2(), because send() is what decides whether the tap
       actually produced a wave - a tap inside the cooldown should not flash. */
    b.addEventListener('click', () => { S.waveI = i; send(); paint2(); });
    picks.push(b); host.appendChild(b);
  });

  /* ---- firing ----
     A tap sends a wave. Always. The machine still does not check what the sea
     is doing, does not refuse, and does not wait. What changed is that the
     green band is no longer only advice: inside it, some of your timing error
     is taken off the launch, all of it dead centre and none at the edge. It
     is help you can see the size of and watch run out, which is a different
     thing from the invisible snap-to-perfect that was cut earlier. */
  function send() {
    if (S.phase !== 'run' || S.cool > 0) return;
    const v = myWave(), p = progress();
    let amp = v.amp;
    /* The band, spent. The tap still fires this instant and the wave still
       leaves from the machine — what being inside the window buys is a shift
       in WHERE it leaves from, which is the same correction expressed as
       something you can watch happen. Outside the window: nothing, as before.
       err > 0 means the crest has not reached the line yet, i.e. you fired
       early, so the launch point slides back toward the machine's left. */
    let x0 = X_YOU, tapErr = 0;
    const tw = target(S.t);
    if (tw) {
      const core = coreFor(p), band = bandFor(p);
      tapErr = centreOf(tw, S.t) - X_REL;
      /* assistK is 1 inside the core, 0 outside the band, smooth between, so
         one call covers every case and errLeft is what the water actually
         sees. Capping on errLeft rather than on tapErr is the whole point: a
         shot the window corrected exactly is not a mistimed shot and must come
         out at full strength. */
      const k = assistK(tapErr, core, band);
      x0 -= tapErr * k;
      amp *= safeAmp(v, tapErr * (1 - k));
    }
    const m = mkPacket(x0, 1, v.lam, amp, S.t, Math.PI,
                       { ramp: RAMP, shape: v.shape, c: cSea(), env: v.env });
    m.mine = true;
    /* WHICH SWELL THIS SHOT ANSWERS is decided here, once, at the moment you
       tap — not worked out afterwards by proximity.

       It used to be inferred: after the fact the game looked for whichever of
       your waves had passed closest to the swell. That cannot work, and it is
       the bug behind "I sent a Chop at a Chop and it told me I was wrong".
       Your wave travels right and a swell travels left, so EVERY wave you
       have ever fired crosses EVERY swell at some point and every one of them
       registers a separation of about zero. Which one won was decided by
       which frame happened to sample nearest the crossing — so the verdict
       named a more or less random one of your last few shots.

       Because the two speeds are equal, the point where they meet is fixed
       the instant the wave leaves, so it can be recorded now too. */
    if (tw) {
      m.aimedAt = tw;
      m.meetAt = (x0 + centreOf(tw, S.t)) / 2;
      /* What the THUMB did, before the window forgave any of it. Reporting the
         post-assist error instead understates the mistake and teaches the
         player to correct by the wrong amount. */
      m.tapErr = tapErr;
      m.tapMs = Math.round(Math.abs(tapErr) / cSea() * 1000);
      tw.answers.push(m);
    }
    S.waves.push(m);
    S.cool = SEND_COOL;
    S.sentI = S.waveI; S.sentT = .28;
  }

  /* The swell the controls are pointed at — the one whose crest is nearest the
     release line, not the one nearest the boat. With two in the air those are
     different swells, and the one you can still do something about is the one
     at the line. */
  function target(t) {
    /* The swell your next tap is FOR - and never one you have already answered.
       Without that test a second tap while the swell you just handled is still
       the nearest thing to the line binds to it again, and a swell is judged on
       itself plus every answer aimed at it: two good answers make w - w - w,
       a full-strength inverted wave right under the cat. The game was pointing
       shots at swells it had already dealt with, which gets steadily worse as
       the sea speeds up and the swells bunch together. */
    let best = null, bd = 1e9;
    for (const w of S.waves) {
      if (!w.sea || w.judged) continue;
      if (w.answers && w.answers.length) continue;
      if (centreOf(w, t) - X_CAT < -w.W * .5) continue;
      const d = Math.abs(centreOf(w, t) - X_REL);
      if (d < bd) { bd = d; best = w; }
    }
    return best;
  }

  function spawn(t) {
    const v = pick(WAVES);
    const w = mkPacket(X_SPAWN, -1, v.lam, v.amp, t, 0,
                       { shape: v.shape, c: cSea(), env: v.env });
    w.sea = true; w.judged = false; w.col = v.col; w.teach = S.taught < 3;
    w.peak = 0; w.lastH = null; w.vy = 0; w.name = v.name;
    w.answers = []; w.marked = false;
    S.waves.push(w);
    /* The opening swells name themselves. The line is written now but only
       shown when THIS swell is the one approaching the release line — saying
       it at spawn meant naming a swell that was still off-screen while a
       different one sat on the line, which teaches the opposite of what it
       is for. */
    if (S.taught < 3) {
      S.taught++;
      w.hint = S.taught === 1
        ? 'Here comes a ' + v.name + '. Tap ' + v.name + ', timed so your wave meets the swell at the boat.'
        : S.taught === 2
        ? 'A ' + v.name + ' this time. Read the shape, not the size.'
        : 'A ' + v.name + '. Last one named; after this they are yours to spot.';
    }
    return w;
  }

  function start() {
    Object.assign(S, { on: true, phase: 'run', t: 0, waves: [], next: 2.4,
      gap: 6.2, score: 0, alive: 0, bal: 100, cool: 0, over: 0, pending: 0, taught: 0,
      lastPhase: null, ann: '', annT: 0, speed: null, lastH: null, vy: 0,
      flash: '', flashCol: '', flashT: 0, sentI: -1, sentT: 0 });
    overlay.hidden = true;
    say.className = 'say';
    say.textContent = 'Tap a wave to send it, any time you like.';
    paint();
  }
  function paint() {
    $('score').textContent = S.score;
    $('afloat').textContent = S.alive.toFixed(1) + 's';
    $('moon').textContent = PHASES[levelNow()];
    const tw = S.phase === 'run' ? target(S.t) : null;
    balanceUI(bal, S.bal);
  }

  /* After every swell, say what went wrong — and with free firing the most
     common answer is no longer "wrong wave" but "right wave, wrong moment",
     so timing is reported first. */
  /* The verdict now reports WHAT ACTUALLY HAPPENED rather than a pass/fail.
     It used to print "Flat. The cat did not move." for anything that left
     under 70% of the swell standing — so a two-thirds bounce, plainly visible,
     was announced as a clean cancel. That is a straight contradiction of what
     the player is watching, and it costs the game all its credibility. The
     percentage is the measured residual over the boat, and how far off the tap
     was is reported in milliseconds, which is the number a thumb can learn
     from. Nothing says the cat did not move unless the cat did not move. */
  const nameOfShape = sh => (WAVES.find(v => v.shape === sh) || { name: 'something else' }).name;
  function bestAnswer(w) {
    if (!w.answers || !w.answers.length) return null;
    return w.answers.find(a => a.shape === w.shape) || w.answers[0];
  }
  function verdict(w) {
    const a = bestAnswer(w);
    if (!a) return ['no', 'Nothing answered that one. It went straight under the boat.'];
    if (a.shape !== w.shape)
      return ['no', 'That was a ' + w.name + ' and you sent a ' + nameOfShape(a.shape) + '.'];
    const left = (w.peak || 0) / w.amp;
    /* meetAt is where the flat spot landed. It sits half way between the error
       in your tap and the boat, so double it to get back to the tap. */
    const off = a.tapMs == null ? 0 : a.tapMs;
    const when = (a.tapErr || 0) > 0 ? 'early' : 'late';
    if (left < .12) return ['ok', pick(['Flat. The cat did not move.',
      'Cancelled. Not so much as an ear.', 'Nothing happened, which was the point.'])];
    if (left < .35) return ['ok', Math.round(left * 100) + '% of it got through, ' +
      off + 'ms ' + when + '.'];
    if (left < HANDLED) return ['ok', 'Took the edge off it. ' + Math.round(left * 100) +
      '% still came through, ' + off + 'ms ' + when + '.'];
    if (left > 1) return ['no', 'That made it worse. ' + off + 'ms ' + when +
      ', so your wave stacked on top of the swell instead of under it.'];
    return ['no', 'Barely touched it. ' + off + 'ms ' + when + '.'];
  }

  function tick(dt, now) {
    const c = fit(cv); if (!c) return;
    if (S.on) S.t += dt;
    const t = S.t, tol = tolNow();

    if (S.phase === 'over') {
      S.over += dt;
      if (S.over > 3.6) { S.phase = 'idle'; S.on = false; finish(); }
    } else if (S.phase === 'run') {
      S.alive += dt;
      const sp = cSea();
      if (S.speed !== sp) { rebase(S.waves, t, sp); S.speed = sp; }
      S.cool = Math.max(0, S.cool - dt);
      S.next -= dt;
      if (S.next <= 0) {
        spawn(t);
        /* Two at a time cannot happen before the first quarter, and the odds
           climb with the moon rather than switching on. */
        /* Two at a time, but later and rarer than before, and never so close
           that the one-second cooldown makes the second one unanswerable. */
        if (S.taught >= 3 && progress() >= .55 && Math.random() < (progress() - .55) * .6)
          S.pending = t + rnd(2.8, 3.6);
        /* The first three swells are the lesson, so they come one at a time
           and wait for each other. Otherwise the hint names one swell while a
           different one is sitting on the release line, which teaches the
           opposite of what it is for. */
        S.next = S.taught < 3 ? Math.max(gapNow(), 8.5) : gapNow();
        /* A twin pushes the following swell out, or the pair piles into it. */
        if (S.pending) S.next = Math.max(S.next, S.pending - t + gapNow() * .8);
      }
      if (S.pending && t >= S.pending) { spawn(t); S.pending = 0; }
      S.waves = S.waves.filter(w => {
        const xc = centreOf(w, t);
        return xc > -w.W - 40 && xc < W + w.W + 40;
      });
    }

    /* Nothing announces itself any more. The moon is the only place the
       difficulty is written down, which is what won the last A/B. */
    if (S.annT > 0) S.annT -= dt;

    const M = motion(S, S.waves, t, dt, X_CAT);
    const h = M.h, vy = M.vy;

    if (S.phase === 'run') {
      for (const w of S.waves) {
        if (!w.sea || w.judged) continue;
        const d = centreOf(w, t) - X_CAT;

        /* Say the teaching line as this swell comes into range, not when it
           was born half a screen away. */
        if (w.hint && centreOf(w, t) - X_REL < 150) {
          say.className = 'say'; say.textContent = w.hint; w.hint = null;
        }

        /* Judge this swell on the water IT is responsible for: itself, plus
           the waves you actually aimed at it. It used to add in every wave in
           the sea, so a stray shot drifting over the boat counted against a
           swell you had answered perfectly — the second half of why a good
           tap could come back marked wrong. Other water still moves the cat,
           and still costs balance; it just is not this swell's fault. */
        let hw = waveAt(w, X_CAT, t);
        for (const a of w.answers) hw += waveAt(a, X_CAT, t);
        if (Math.abs(d) < w.W) w.peak = Math.max(w.peak, Math.abs(hw));
        /* Say what happened AT the moment of the meeting, over the boat, while
           the player is still looking at it. The line under the sea arrives a
           second later and by then the cause is off screen. */
        if (!w.marked && Math.abs(d) < 4) {
          w.marked = true;
          const through = Math.abs(hw) / w.amp;
          S.flash = through < .12 ? 'FLAT' : Math.round(through * 100) + '% THROUGH';
          S.flashCol = through < .12 ? '#5fe3a6' : through < .45 ? '#ffcf6b' : '#ff6f85';
          S.flashT = 1.1;
        }

        if (d < -w.W * .45) {
          w.judged = true;
          const [cls, msg] = verdict(w);
          if (cls === 'ok') S.score++;
          say.className = 'say ' + cls; say.textContent = msg;
        }
      }
      const lift = Math.abs(h);
      if (lift > tol) {
        S.bal -= Math.min(34, (lift / tol - 1) * 44) * dt;
        if (S.bal <= 0) {
          S.bal = 0; S.phase = 'over'; S.over = 0;
          say.className = 'say no';
          say.textContent = 'Overboard after ' + S.alive.toFixed(1) +
            's. The vest fires, the cat is fine and deeply unimpressed. ' +
            S.score + ' swells handled.';
        }
      } else if (lift < tol * .5) {
        S.bal = Math.min(100, S.bal + 2.5 * dt);
      }
      paint();
    }

    const pr = progress();
    const tw = S.phase === 'run' ? target(t) : null;
    const core = coreFor(pr), band = bandFor(pr);
    /* Armed means inside the CORE - the zone where the answer comes out exact.
       Lighting up for the taper as well would promise more than it delivers. */
    const armed = !!(tw && Math.abs(centreOf(tw, t) - X_REL) < core);
    if (S.armedNow !== armed) { S.armedNow = armed; paint2(); }
    /* Drop the confirmation highlight a moment after the send. */
    if (S.sentT > 0) { S.sentT -= dt; if (S.sentT <= 0) paint2(); }

    /* ---- draw ---- */
    drawSea(c, S.waves, t, pr);
    drawReleaseLine(c, cv, X_REL, armed, core, band);
    S.waves.forEach(w => { if (w.sea && !w.judged) drawCrestMark(c, w, t, w === tw); });
    /* The sample over the machine used to preview the selected wave. With no
       selection there is nothing to preview, so it shows what was just thrown
       and then clears. */
    drawMachine(c, X_YOU, '#ffb057', now * -2.2,
                S.sentT > 0 && S.sentI >= 0 ? WAVES[S.sentI] : null, true);
    /* tol is pixels of displacement now, so panic has to be measured against
       the same thing — comparing it to heave left the cat permanently
       terrified, because heave runs an order of magnitude larger. */
    const panic = S.phase === 'over' ? 1
      : clamp((100 - S.bal) / 70, 0, 1) * .5 + clamp(Math.abs(h) / tol, 0, 1) * .5;
    if (S.phase === 'over')
      drawFloater(c, X_CAT + Math.min(S.over * 42, 300),
        SEA_Y - surf(S.waves, X_CAT + S.over * 42, t) * VSCALE + 4, S.over, now);
    else
      drawBoat(c, X_CAT, SEA_Y - h * VSCALE, M.pitch, panic, now);
    /* The result, over the boat, at the moment it happens. */
    if (S.flashT > 0) {
      S.flashT -= dt;
      c.save(); c.globalAlpha = clamp(S.flashT * 1.6, 0, 1);
      tag(c, cv, S.flash, X_CAT, SEA_Y - h * VSCALE - 70, 'center', S.flashCol);
      c.restore();
    }
    tag(c, cv, 'YOU', X_YOU, SEA_Y + 32, 'center');
    tag(c, cv, 'THE SEA', W - 6, SEA_Y + 32, 'right');
    if (S.annT > 0) tag(c, cv, S.ann.toUpperCase(), W / 2, 62, 'center', '#ffcf6b');
    if (S.phase === 'idle') tag(c, cv, 'PRESS START', X_CAT, 24, 'center');
  }

  /* ---- the tutorial, in the overlay ----
     Available but skippable, and skippable at every step: Start never leaves
     the overlay, so nobody is ever walked through three cards to get to a
     small browser game. "How it works" turns into "Next" while you are in it
     and hands you back to the intro at the end. */
  const TUT = [
    { h: 'Two waves cancel',
      b: '<p>A swell rolls in from the right and tries to tip the cat off his boat. Your machine, on the left, answers with the same wave built upside down.</p>' +
         '<p>Where the two cross, the crests fill the troughs and the water goes flat. Put that flat spot on the cat.</p>' },
    { h: 'Five shapes, one answer',
      b: '<p>The sea only ever sends these five, so an exact answer always exists. <b>Count the crests</b>: it tells them apart faster than height or length does.</p><div class="tutwaves">' +
         WAVES.map(v => '<span style="color:' + v.col + '">' + waveIcon(v) + '<em>' + v.name + '</em></span>').join('') + '</div>' },
    { h: 'Tap on the green',
      b: '<p>One tap sends a wave. Tap while a crest is inside the green band and the two meet exactly over the cat, who does not move at all.</p>' +
         '<p>Amber helps but will not flatten it. The green closes as the moon fills.</p>' }
  ];
  const ovTitle = $('ov-title'), ovBody = $('ov-body'), howBtn = $('how');
  const INTRO = { h: ovTitle.textContent, b: ovBody.innerHTML };
  let tutI = -1;                       // -1 = showing the intro, not the tutorial
  function showTut() {
    if (tutI < 0) {
      ovTitle.textContent = INTRO.h; ovBody.innerHTML = INTRO.b;
      howBtn.textContent = 'How it works';
      return;
    }
    ovTitle.textContent = TUT[tutI].h;
    ovBody.innerHTML = TUT[tutI].b;
    howBtn.textContent = tutI === TUT.length - 1 ? 'Done' : 'Next';
  }
  howBtn.addEventListener('click', () => {
    tutI = tutI >= TUT.length - 1 ? -1 : tutI + 1;
    showTut();
  });

  /* ---- the overlay, the board and the run that ends ---- */
  const overlay = $('overlay');
  function finish() {
    tutI = -1;
    ovTitle.textContent = 'Overboard';
    ovBody.textContent = S.score >= 25
      ? 'The vest fires, the cat is fine and deeply unimpressed with you.'
      : 'Two waves only cancel where they are exactly out of step. Watch the green.';
    $('final-score').textContent = S.score;
    $('ov-score').hidden = false;
    $('start').textContent = 'Play again';
    howBtn.textContent = 'How it works';
    overlay.hidden = false;
    boardUI.finish();
  }
  $('start').addEventListener('click', () => { tutI = -1; start(); });

  paint();
  rig(cv, tick);
  /* The board asks for the score from outside this closure. */
  return { get score() { return S.score; } };
}

/* ================= board and boot =================

   This game's own board: a fresh document on the store and its own local key,
   so a score here can never turn up on another game's list. These three
   strings are frozen the moment the game is live - changing any of them
   orphans every score already on the board, with no admin UI and no undo. */
const Board = makeBoard({
  id: 'ff808181a067127101a08cda63186a82',
  localKey: 'catamaran-board',
  storeName: 'schrodingerscards-catamaran-highscores'
});

/* The game closes over boardUI and boardUI needs the game's score, so one of
   the two has to be declared before it can be assigned. The game only reaches
   for boardUI on game over, long after this runs. */
let boardUI;
const game = makeGame();
boardUI = attachBoardUI(Board, () => game.score);

