/* ================= Catwalk =================
   Lives at catwalk.html. Depends on js/leaderboard.js for the score board.

   One long, winding beam and nine lives. The road narrows, curves, and
   from the very first biome can split into two lanes that run apart and
   rejoin — both are equally real, so whichever one the cat is standing
   nearer to is the ground under his feet (see effectivePathAt). Deeper in,
   the beam sometimes opens into a real gap crossed by lining up on a
   narrowing ramp, and in the last few biomes some forks don't rejoin at
   all: one lane just narrows away into nothing, and picking it is an
   unrecoverable fall.

   Falling costs a life and drops the run into the next biome down, but
   distance travelled never resets — only the difficulty ramp within a
   biome does. Between biomes the beam stops dead until the player taps or
   drags again, since a fall is exactly the moment a finger or mouse could
   be anywhere. */

const NOMINAL_W = 380;
const CAT_LINE_FRAC = 0.80;
const TEETER_LIMIT = 0.9;
const FALL_DURATION = 0.85;
const LAND_DURATION = 0.4;
const JUMP_DURATION = 0.6;
const GAP_LEN = 50;
const GAP_MIN_SPACING = 260;
const GAP_MIN_BIOME = 5;
const AUTO_LEAD = 20;
const RAMP_APPROACH = 70;
const FORK_LEN = 150;
const FORK_MIN_SPACING = 300;
const FORK_CHANCE = 0.45;
const FORK_LANE_SHRINK = 0.45; // each lane narrows to (1-this) of the normal width at the fork's widest point
const DEAD_END_MIN_BIOME = 5;  // "later levels" — trap forks only start appearing here
const DEAD_END_CHANCE = 0.65;  // fraction of eligible forks that turn into a trap

const $ = id => document.getElementById(id);
const pick = a => a[Math.floor(Math.random() * a.length)];

const BIOMES = [
  { name: 'Rooftops',       sky: ['#3a5a8c', '#8fb8dc'], beam: ['#8a7860', '#c7ab86'], deco: '#24344a',
    decoKinds: ['chimney', 'antenna', 'bird'], particle: 'cloud', particleColor: '#e8f1fc' },
  { name: 'Treetops',       sky: ['#1f4028', '#5c9a52'], beam: ['#6b5336', '#9c7a4e'], deco: '#2f6a37',
    decoKinds: ['leaf', 'branch', 'acorn'], particle: 'leaf', particleColor: '#bfe6a0' },
  { name: 'Garden Fence',   sky: ['#bfe6ef', '#eaf7de'], beam: ['#b98d55', '#e0b97e'], deco: '#6fae5a',
    decoKinds: ['picket', 'flower', 'stone'], particle: 'petal', particleColor: '#ffcfe8' },
  { name: 'The Bookshelf',  sky: ['#3a2e44', '#5c4a66'], beam: ['#7a5230', '#b98a52'], deco: '#caa15a',
    decoKinds: ['book', 'clock', 'lamp'], particle: 'dust', particleColor: '#ecdcae' },
  { name: 'The Attic',      sky: ['#241d2c', '#4a3d50'], beam: ['#6b5a46', '#a08a68'], deco: '#cfc8d6',
    decoKinds: ['cobweb', 'frame', 'trunk'], particle: 'dust', particleColor: '#d8d2de' },
  { name: 'The Basement',   sky: ['#1c262e', '#3f5866'], beam: ['#5c6a72', '#93a3ab'], deco: '#7fbccf',
    decoKinds: ['pipe', 'crate', 'valve'], particle: 'drip', particleColor: '#a6dcee' },
  { name: 'The Storm Drain',sky: ['#12201f', '#2e4a4e'], beam: ['#3d5a56', '#6f9a8e'], deco: '#8fd9c4',
    decoKinds: ['drop', 'grate', 'ripple'], particle: 'bubble', particleColor: '#c3f5e6' },
  { name: 'Crystal Cave',   sky: ['#140f2a', '#2d1f4e'], beam: ['#4a3a72', '#7a5aa8'], deco: '#b98bff',
    decoKinds: ['crystal', 'stalactite', 'orb'], particle: 'spark', particleColor: '#e6d2ff' },
  { name: 'The Core',       sky: ['#240a08', '#5a1a12'], beam: ['#8a3a1c', '#d1691f'], deco: '#ff8a3d',
    decoKinds: ['flame', 'ember', 'spark'], particle: 'ember', particleColor: '#ffc27a' },
];

const POWERUPS = [
  { type: 'bumper',    weight: 2, icon: '🛡️', color: '#7ec8ff' },
  { type: 'speedup',   weight: 2, icon: '⚡', color: '#ffe066' },
  { type: 'slippery',  weight: 2, icon: '🧈', color: '#bff0ff' },
  { type: 'minuslife', weight: 2, icon: '💀', color: '#ff5470' },
  { type: 'mystery',   weight: 5, icon: '?',  color: '#b98bff' },
];
const NEGATIVE_TYPES = ['slippery', 'minuslife'];
const POWERUP_ICON = Object.fromEntries(POWERUPS.map(p => [p.type, p.icon]));
const POWERUP_COLOR = Object.fromEntries(POWERUPS.map(p => [p.type, p.color]));
const POWERUP_TABLE = POWERUPS.flatMap(p => Array(p.weight).fill(p.type));
const MYSTERY_REVEAL_LABEL = {
  bumper: '🛡️ Shield!', speedup: '⚡ Speed!',
  slippery: '🧈 Slippery!', minuslife: '💀 Ouch, -1 life!',
};

const FALL_LINES = ['WHEEEEE—', 'NOT LIKE THIS', 'THIS IS FINE.', 'PHYSICS WINS AGAIN', 'TUCK AND ROLL!', 'CATASTROPHE.', 'GRAVITY: UNDEFEATED', 'AAAAAAH', 'WELP.', 'NINE LIVES, ONE REGRET'];
const AMBIENT_LINES = ['Still going. Impressive.', 'Look at him go.', 'Nine lives, zero chill.', 'Certified beam walker.', 'This cat has no fear.', 'Do not look down.', 'Unbothered. Moisturized. In his lane.'];
const GAME_OVER_LINES = ['He landed on his tail.', 'Nine lives, well spent.', 'That is going to leave a mark.', 'He will dust himself off. Eventually.', 'A truly heroic wipeout.', 'The beam remains undefeated.'];
const BUMPER_LINES = ['Bubble wrap engaged!', 'Cannot fall. Physics who?', 'Shielded and smug.'];
const SLIPPERY_LINES = ['Butter paws!', 'Whoa, slippery!', 'Ice paws activated.'];
const SPEEDUP_LINES = ['Speed demon!', 'Everything is FAST now.', 'Zoomies engaged.'];
const MINUS_LIFE_LINES = ['Ouch.', 'That one hurt.', 'Rude.', 'A trap! Classic.'];

const canvas = $('stage');
const ctx = canvas.getContext('2d');
const scoreEl = $('score');
const biomeEl = $('biome');
const livesEl = $('lives');
const statusRowEl = $('statusRow');
const bannerEl = $('banner');
const tapPromptEl = $('tapPrompt');

let stageWidth = 380, stageHeight = 675, catLineY = 540;

function resize(){
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const r = canvas.getBoundingClientRect();
  stageWidth = r.width;
  stageHeight = r.height;
  canvas.width = Math.round(stageWidth * dpr);
  canvas.height = Math.round(stageHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  catLineY = stageHeight * CAT_LINE_FRAC;
}

function rand(seed){ return () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

const game = {
  state: 'ready',
  catX: stageWidth / 2,
  catVX: 0,
  lives: 9,
  livesMax: 9,
  distanceTotal: 0,
  distanceInBiome: 0,
  biomeIndex: 0,
  teeterTimer: 0,
  fallDir: 1,
  fallT: 0,
  landT: 0,
  jumpT: 0,
  points: [],
  gaps: [],
  decoys: [],
  forks: [],
  pickups: [],
  lastPointD: 0,
  lastPointCx: 0.5,
  lastPointHw: 0,
  lastGapEnd: -9999,
  lastForkEnd: -9999,
  lastPickupD: -9999,
  rng: rand(1),
  deco: [],
  particles: [],
  time: 0,
  pointerActive: false,
  rawPointerX: stageWidth / 2,
  dragAnchorX: stageWidth / 2,
  dragCatAnchorX: stageWidth / 2,
  dragTargetX: stageWidth / 2,
  leftKey: false,
  rightKey: false,
  shieldT: 0,
  shieldNotified: false,
  slipperyT: 0,
  speedBoostT: 0,
  ambientTimer: 0,
  ambientThreshold: 16,
};

function biome(){ return BIOMES[game.biomeIndex]; }

function difficultyT(d){ return Math.max(0, Math.min(1, d / 3500)); }

function halfWidthNominal(d){
  const t = difficultyT(d);
  const base = 74 - t * 42 - game.biomeIndex * 1.4;
  return Math.max(19, base);
}
function spacingNominal(d){
  const t = difficultyT(d);
  return 230 - t * 120;
}
function swingNominal(d){
  const t = difficultyT(d);
  return 70 + t * 130;
}

function isInGap(d){
  for (let i = 0; i < game.gaps.length; i++){
    const g = game.gaps[i];
    if (d >= g.d0 && d <= g.d1) return true;
  }
  return false;
}
function nextGapFrom(d){
  let best = null;
  game.gaps.forEach(g => { if (g.d0 >= d - 2 && (!best || g.d0 < best.d0)) best = g; });
  return best;
}

function seedPath(){
  game.points = [{ d: 0, cx: 0.5, hw: halfWidthNominal(0) / NOMINAL_W }];
  game.lastPointD = 0;
  game.lastPointCx = 0.5;
  game.lastPointHw = halfWidthNominal(0) / NOMINAL_W;
  game.rng = rand(Math.floor(Math.random() * 100000) + 1);
  game.gaps = [];
  game.decoys = [];
  game.forks = [];
  game.pickups = [];
  game.lastGapEnd = -9999;
  game.lastForkEnd = -9999;
  game.lastPickupD = -9999;
  extendPath(catLineY + 60);
  buildDeco();
}

function rampHalfWidthFrac(){
  const px = Math.max(13, 32 - Math.max(0, game.biomeIndex - GAP_MIN_BIOME) * 4.5);
  return px / NOMINAL_W;
}
function rampOffsetCapFrac(){
  const px = 8 + Math.max(0, game.biomeIndex - GAP_MIN_BIOME) * 13;
  return px / NOMINAL_W;
}

// Gaps are crossed by steering onto a ramp: the path narrows (and, in deeper
// biomes, drifts off-center) over RAMP_APPROACH units leading into the gap.
// Staying on the ramp at takeoff auto-launches the hop; drifting off it
// means the ordinary edge-teeter/fall logic catches you before you even
// reach the gap. Reuses the same cosine interpolation as the rest of the
// path, so no separate rendering path is needed for the taper itself.
function maybeSpawnGap(nd, naturalCx, naturalHw){
  if (game.biomeIndex < GAP_MIN_BIOME) return false;
  if (nd - game.lastGapEnd < GAP_MIN_SPACING) return false;
  const gapChance = Math.min(0.6, 0.32 + Math.max(0, game.biomeIndex - GAP_MIN_BIOME) * 0.05);
  if (game.rng() > gapChance) return false;

  const margin = 8 / NOMINAL_W;
  const rampHw = Math.min(naturalHw, rampHalfWidthFrac());
  const maxOffset = Math.max(0, naturalHw - rampHw - margin);
  const offsetCap = Math.min(maxOffset, rampOffsetCapFrac());
  const rampCx = Math.max(rampHw + margin, Math.min(1 - rampHw - margin,
    naturalCx + (game.rng() * 2 - 1) * offsetCap));

  const gapD0 = nd + RAMP_APPROACH;
  const gapD1 = gapD0 + GAP_LEN;

  game.points.push({ d: gapD0, cx: rampCx, hw: rampHw });
  game.points.push({ d: gapD1, cx: rampCx, hw: rampHw });
  game.lastPointD = gapD1;
  game.lastPointCx = rampCx;
  game.lastPointHw = rampHw;

  game.gaps.push({ d0: gapD0, d1: gapD1 });
  game.lastGapEnd = gapD1;

  // Deepest biomes: a decoy lane splits off and dead-ends right at the gap —
  // purely cosmetic (collision always uses the real ramp above), but reads
  // as a fork you have to pick correctly.
  if (game.biomeIndex >= 7 && game.rng() < 0.6){
    const decoyDir = rampCx >= naturalCx ? -1 : 1;
    const decoyCx = Math.max(margin + naturalHw * 0.3, Math.min(1 - margin - naturalHw * 0.3,
      naturalCx + decoyDir * naturalHw * 0.9));
    game.decoys.push({
      d0: nd, d1: gapD0,
      cx0: naturalCx, hw0: naturalHw,
      cx1: decoyCx, hw1: naturalHw * 0.35,
    });
  }
  return true;
}

// A real second lane: it diverges from the main path and fully rejoins it
// FORK_LEN later. Whichever lane the cat is nearer to at any moment is the
// "ground" for collision purposes (see effectivePathAt) — both are equally
// real, so picking one is a genuine choice, not a trick. Available from the
// very first biome, independent of the deeper-biome gap/ramp mechanic.

// Pronounced and unmissable in the early game; still real but tighter
// (harder to read at a glance) in the later, harder biomes.
function forkGapMultFor(biomeIndex){
  return Math.max(1.6, 3.4 - biomeIndex * 0.22);
}

function maybeSpawnFork(nd, naturalCx, naturalHw){
  if (nd - game.lastForkEnd < FORK_MIN_SPACING) return;
  const upcomingGap = nextGapFrom(nd);
  // Only bail if the fork would actually reach into the gap's own ramp
  // taper — not just "a gap exists somewhat further ahead" — otherwise
  // gap-dense late biomes end up crowding out forks almost entirely.
  if (upcomingGap && upcomingGap.d0 - RAMP_APPROACH < nd + FORK_LEN) return;
  if (game.rng() > FORK_CHANCE) return;

  const d0 = nd;
  const d1 = nd + FORK_LEN;
  const margin = 8 / NOMINAL_W;
  const peakLaneHw = naturalHw * (1 - FORK_LANE_SHRINK);
  // A true Y/U split needs room on BOTH sides at once (it's symmetric around
  // the centerline), and the two lanes must be far enough apart that a real
  // gap of open air shows between them — not just a single wide bulge.
  const roomRight = (1 - margin) - naturalCx - peakLaneHw;
  const roomLeft = naturalCx - margin - peakLaneHw;
  const room = Math.min(roomRight, roomLeft);
  const minSep = peakLaneHw * forkGapMultFor(game.biomeIndex);
  if (room < minSep) return;
  const mag = minSep + (room - minSep) * game.rng();

  const deadEnd = game.biomeIndex >= DEAD_END_MIN_BIOME && game.rng() < DEAD_END_CHANCE;
  const deadSide = game.rng() < 0.5 ? 'a' : 'b';
  game.forks.push({ d0, d1, mag, deadEnd, deadSide });
  game.lastForkEnd = d1;

  // Freeze the path's own center/width across the whole fork span so the
  // split stays a clean, stable, symmetric shape instead of drifting
  // mid-split (the ordinary per-point wander resumes normally once the
  // lanes rejoin at d1).
  game.points.push({ d: d1, cx: naturalCx, hw: naturalHw });
  game.lastPointD = d1;
  game.lastPointCx = naturalCx;
  game.lastPointHw = naturalHw;

  // Sometimes one lane gets its own pickup too — independent roll, so it's
  // random whether one path, the other, both, or neither has an item.
  if (nd - game.lastPickupD >= 140 && game.rng() < 0.28){
    const midD = d0 + FORK_LEN * 0.5;
    const type = pick(POWERUP_TABLE);
    const side = game.rng() < 0.5 ? -1 : 1;
    const cx = Math.max(0.03, Math.min(0.97, naturalCx + side * mag));
    game.pickups.push({ d: midD, cx, type, collected: false });
    game.lastPickupD = midD;
  }
}

function pickupOffsetFrac(type, hw){
  const margin = 6 / NOMINAL_W;
  const usable = Math.max(0, hw - margin);
  if (NEGATIVE_TYPES.includes(type)){
    // negatives cluster near the middle of the lane, so they're genuinely hard to dodge
    return (game.rng() * 2 - 1) * usable * 0.25;
  }
  // positive/wildcard items often sit off to one side — grabbing one is a deliberate detour
  const side = game.rng() < 0.5 ? -1 : 1;
  const mag = 0.35 + game.rng() * 0.55;
  return side * usable * mag;
}

function maybeSpawnPickup(nd, cx, hw){
  if (game.biomeIndex < 1) return;
  if (nd - game.lastPickupD < 140) return;
  if (game.rng() > 0.18) return;
  if (isInGap(nd)) return;
  const type = pick(POWERUP_TABLE);
  const px = Math.max(0.02, Math.min(0.98, cx + pickupOffsetFrac(type, hw)));
  game.pickups.push({ d: nd, cx: px, type, collected: false });
  game.lastPickupD = nd;
}

function extendPath(minD){
  while (game.lastPointD < minD){
    const hwNom = halfWidthNominal(game.lastPointD);
    const spacing = spacingNominal(game.lastPointD);
    const swing = swingNominal(game.lastPointD) / NOMINAL_W;
    const hwFrac = hwNom / NOMINAL_W;
    const margin = 8 / NOMINAL_W;
    let nx = game.lastPointCx + (game.rng() * 2 - 1) * swing;
    nx = Math.max(hwFrac + margin, Math.min(1 - hwFrac - margin, nx));
    const nd = game.lastPointD + spacing;
    game.points.push({ d: nd, cx: nx, hw: hwFrac });
    game.lastPointD = nd;
    game.lastPointCx = nx;
    game.lastPointHw = hwFrac;
    const gapSpawned = maybeSpawnGap(nd, nx, hwFrac);
    if (!gapSpawned) maybeSpawnFork(nd, nx, hwFrac);
    maybeSpawnPickup(nd, nx, hwFrac);
  }
  while (game.points.length > 2 && game.points[1].d < game.distanceInBiome - 150){
    game.points.shift();
  }
  game.gaps = game.gaps.filter(g => g.d1 > game.distanceInBiome - 150);
  game.decoys = game.decoys.filter(dc => dc.d1 > game.distanceInBiome - 150);
  game.forks = game.forks.filter(f => f.d1 > game.distanceInBiome - 150);
  game.pickups = game.pickups.filter(p => !p.collected && p.d > game.distanceInBiome - 150);
}

function pathAt(d){
  const pts = game.points;
  let i = 0;
  while (i < pts.length - 2 && pts[i + 1].d < d) i++;
  const a = pts[i], b = pts[i + 1] || pts[i];
  const span = Math.max(1, b.d - a.d);
  const t = Math.max(0, Math.min(1, (d - a.d) / span));
  const ease = 0.5 - 0.5 * Math.cos(Math.PI * t);
  return {
    cx: a.cx + (b.cx - a.cx) * ease,
    hw: a.hw + (b.hw - a.hw) * ease,
  };
}

// Returns the fork descriptor and progress (0 at d0, 1 at d1) at distance d,
// or null if no fork is active there.
function forkAt(d){
  for (let i = 0; i < game.forks.length; i++){
    const f = game.forks[i];
    if (d >= f.d0 && d <= f.d1){
      return { t: (d - f.d0) / Math.max(1, f.d1 - f.d0), f };
    }
  }
  return null;
}

// Both lanes are built symmetrically around the ordinary (frozen-for-the-
// fork) path center, narrowing as they separate — so at the fork's edges
// they coincide exactly (one lane), and toward the middle they open into
// two distinct lanes with real open air between them (a proper Y, not one
// lane bulging sideways). A "dead-end" fork's marked lane instead rises to
// its peak offset and then just narrows away to nothing out in open air —
// it never rejoins, so committing to it is an unrecoverable fall.
function forkLanesAt(d){
  const found = forkAt(d);
  if (!found) return null;
  const { t, f } = found;
  const base = pathAt(d);

  const safeShape = Math.sin(Math.PI * t);
  const safeHalfSep = safeShape * f.mag;
  const safeHw = base.hw * (1 - safeShape * FORK_LANE_SHRINK);

  let deadHalfSep = safeHalfSep, deadHw = safeHw;
  if (f.deadEnd){
    const riseT = Math.min(1, t / 0.5);
    const riseShape = Math.sin(Math.PI * 0.5 * riseT); // eases up to peak by t=0.5, then holds
    deadHalfSep = riseShape * f.mag;
    const shrinkT = Math.max(0, Math.min(1, (t - 0.55) / 0.3));
    deadHw = base.hw * (1 - FORK_LANE_SHRINK) * (1 - shrinkT); // vanishes to nothing by t≈0.85
  }

  const aIsDead = f.deadEnd && f.deadSide === 'a';
  const bIsDead = f.deadEnd && f.deadSide === 'b';
  const hwA = aIsDead ? deadHw : safeHw;
  const hwB = bIsDead ? deadHw : safeHw;
  const sepA = aIsDead ? deadHalfSep : safeHalfSep;
  const sepB = bIsDead ? deadHalfSep : safeHalfSep;

  const margin = 8 / NOMINAL_W;
  const clamp = (cx, hw) => Math.max(margin + hw, Math.min(1 - margin - hw, cx));
  return {
    a: { cx: clamp(base.cx - sepA, hwA), hw: hwA },
    b: { cx: clamp(base.cx + sepB, hwB), hw: hwB },
  };
}

// Whichever lane the cat is nearer to is treated as the real ground for
// teeter/fall purposes — both lanes are equally valid, so the player's
// choice of lane is what determines which one "counts".
function effectivePathAt(d, refX){
  const lanes = forkLanesAt(d);
  if (!lanes) return pathAt(d);
  const distA = Math.abs(refX - lanes.a.cx * stageWidth);
  const distB = Math.abs(refX - lanes.b.cx * stageWidth);
  return distA <= distB ? lanes.a : lanes.b;
}

function buildDeco(){
  const r = rand(game.biomeIndex * 777 + 3);
  game.deco = Array.from({ length: 16 }, () => {
    const roll = r();
    const kindIdx = roll < 0.42 ? 0 : (roll < 0.74 ? 1 : 2);
    return {
      x: r(),
      y: r(),
      s: 0.6 + r() * 1.2,
      kindIdx,
      layer: r() < 0.5 ? 0 : 1,
    };
  });
  const rp = rand(game.biomeIndex * 991 + 17);
  game.particles = Array.from({ length: 8 }, () => ({
    x: rp(), y: rp(), s: 0.5 + rp() * 0.8, phase: rp() * Math.PI * 2, speed: 0.4 + rp() * 0.6,
  }));
}

function syncHud(){
  livesEl.textContent = game.lives;
  scoreEl.textContent = Math.round(game.distanceTotal / 10);
  biomeEl.textContent = game.biomeIndex + 1;
}

function showBanner(text){
  bannerEl.querySelector('p').textContent = text;
  bannerEl.classList.add('show');
  clearTimeout(showBanner._t);
  showBanner._t = setTimeout(() => bannerEl.classList.remove('show'), 1600);
}

function updateStatusRow(){
  const chips = [];
  if (game.shieldT > 0) chips.push('🛡️ ' + Math.ceil(game.shieldT) + 's');
  if (game.slipperyT > 0) chips.push('🧈 ' + Math.ceil(game.slipperyT) + 's');
  if (game.speedBoostT > 0) chips.push('⚡ ' + Math.ceil(game.speedBoostT) + 's');
  statusRowEl.textContent = chips.join('   ');
}

function resyncDrag(){
  game.dragCatAnchorX = game.catX;
  game.dragAnchorX = game.rawPointerX;
  game.dragTargetX = game.catX;
}

// Announces the shield's save exactly once per charge, so picking one up has
// an unmistakable payoff instead of just a small status-row countdown.
function notifyShieldBlock(){
  if (game.shieldNotified) return;
  game.shieldNotified = true;
  showBanner('🛡️ Shield saved you!');
}

function startGame(){
  game.state = 'landing';
  game.landT = 0;
  game.catX = stageWidth / 2;
  game.catVX = 0;
  resyncDrag();
  game.lives = game.livesMax;
  game.distanceTotal = 0;
  game.distanceInBiome = 0;
  game.biomeIndex = 0;
  game.teeterTimer = 0;
  game.shieldT = 0;
  game.shieldNotified = false;
  game.slipperyT = 0;
  game.speedBoostT = 0;
  game.ambientTimer = 0;
  game.ambientThreshold = 16 + Math.random() * 10;
  game.jumpT = 0;
  seedPath();
  syncHud();
  updateStatusRow();
  showBanner(biome().name);
}

function endGame(){
  game.state = 'gameover';
  const score = Math.round(game.distanceTotal / 10);
  $('ov-title').textContent = pick(GAME_OVER_LINES);
  $('ov-body').textContent = 'He made it to ' + biome().name + ' — biome ' + (game.biomeIndex + 1) + ' of 9.';
  $('final-score').textContent = score;
  $('ov-final').hidden = false;
  $('go').textContent = 'Walk again';
  $('go').onclick = newRun;
  $('overlay').hidden = false;
  boardUI.finish();
}

function fallOff(dir){
  game.state = 'falling';
  game.fallDir = dir;
  game.fallT = 0;
  game.fallStartX = game.catX;
  game.fallStartAngle = game.lastAngle || 0;
  showBanner(pick(FALL_LINES));
}

function transitionBiome(){
  game.lives -= 1;
  syncHud();
  if (game.lives <= 0){
    endGame();
    return;
  }
  game.biomeIndex = Math.min(game.biomeIndex + 1, BIOMES.length - 1);
  game.distanceInBiome = 0;
  game.teeterTimer = 0;
  seedPath();
  game.catX = stageWidth * pathAt(0).cx;
  resyncDrag();
  game.catVX = 0;
  normalized = 0;
  teeterFactor = 0;
  // Fully pause here — after a fall the player's finger/mouse could be
  // anywhere, so the world holds still until they deliberately act again,
  // rather than resuming movement (and risk) the instant they weren't ready.
  game.state = 'waiting';
  game.landT = 0;
  syncHud();
  showBanner(biome().name);
  tapPromptEl.classList.add('show');
}

function resumeFromWaiting(){
  if (game.state !== 'waiting') return;
  tapPromptEl.classList.remove('show');
  game.state = 'landing';
  game.landT = 0;
}

function triggerJump(){
  if (!(game.state === 'stable' || game.state === 'teeter' || game.state === 'landing')) return;
  game.state = 'jumping';
  game.jumpT = 0;
}

function doMinusLife(silent){
  game.lives -= 1;
  syncHud();
  if (game.lives <= 0){
    endGame();
    return;
  }
  if (!silent) showBanner('💀 ' + pick(MINUS_LIFE_LINES));
}

// Returns true when the effect ended the game (minuslife at 0 lives) — the
// caller must bail out of the current frame in that case, since its
// already-computed position math is stale.
function applyPowerup(type, silent){
  switch (type){
    case 'bumper':
      game.shieldT = Math.max(game.shieldT, 4.5);
      game.shieldNotified = false;
      if (!silent) showBanner('🛡️ ' + pick(BUMPER_LINES));
      return false;
    case 'slippery':
      game.slipperyT = Math.max(game.slipperyT, 4.5);
      if (!silent) showBanner('🧈 ' + pick(SLIPPERY_LINES));
      return false;
    case 'speedup':
      game.speedBoostT = Math.max(game.speedBoostT, 4);
      if (!silent) showBanner('⚡ ' + pick(SPEEDUP_LINES));
      return false;
    case 'minuslife':
      doMinusLife(silent);
      return true;
    case 'mystery': {
      const revealed = pick(POWERUP_TABLE.filter(t => t !== 'mystery'));
      const changed = applyPowerup(revealed, true);
      showBanner('🎁 Mystery: ' + MYSTERY_REVEAL_LABEL[revealed]);
      return changed;
    }
  }
  return false;
}

function checkPickupCollection(){
  const d = game.distanceInBiome;
  for (const pu of game.pickups){
    if (pu.collected) continue;
    if (Math.abs(pu.d - d) < 14){
      const px = pu.cx * stageWidth;
      if (Math.abs(game.catX - px) < 26){
        pu.collected = true;
        if (applyPowerup(pu.type)) return true;
      }
    }
  }
  return false;
}

// input
window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA'){ game.leftKey = true; e.preventDefault(); resumeFromWaiting(); }
  if (e.code === 'ArrowRight' || e.code === 'KeyD'){ game.rightKey = true; e.preventDefault(); resumeFromWaiting(); }
}, { passive: false });
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') game.leftKey = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') game.rightKey = false;
});

function pointerX(e){
  const rect = canvas.getBoundingClientRect();
  return Math.max(0, Math.min(rect.width, e.clientX - rect.left));
}
// Dragging always moves the cat *relative* to wherever he already is —
// the anchor is set on touch-down, so tapping anywhere never snaps him
// to that point, only subsequent finger movement does.
canvas.addEventListener('pointerdown', (e) => {
  game.pointerActive = true;
  const x = pointerX(e);
  game.rawPointerX = x;
  game.dragAnchorX = x;
  game.dragCatAnchorX = game.catX;
  game.dragTargetX = game.catX;
  resumeFromWaiting();
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
});
const DRAG_DEADZONE = 6; // px — absorbs hand tremor so a plain click never nudges the cat
canvas.addEventListener('pointermove', (e) => {
  if (!game.pointerActive) return;
  const x = pointerX(e);
  game.rawPointerX = x;
  let delta = x - game.dragAnchorX;
  delta = Math.abs(delta) < DRAG_DEADZONE ? 0 : delta - Math.sign(delta) * DRAG_DEADZONE;
  game.dragTargetX = Math.max(6, Math.min(stageWidth - 6, game.dragCatAnchorX + delta));
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev =>
  canvas.addEventListener(ev, () => { game.pointerActive = false; })
);

function updateControl(dt){
  const slow = game.slipperyT > 0;
  if (game.pointerActive){
    if (slow){
      game.catX += (game.dragTargetX - game.catX) * Math.min(1, dt * 5);
    } else {
      game.catX = game.dragTargetX;
    }
    game.catVX = 0;
  } else {
    const accel = slow ? 550 : 900, maxSpeed = 260, friction = slow ? 2 : 6;
    if (game.leftKey) game.catVX -= accel * dt;
    if (game.rightKey) game.catVX += accel * dt;
    if (!game.leftKey && !game.rightKey) game.catVX -= game.catVX * Math.min(1, friction * dt);
    game.catVX = Math.max(-maxSpeed, Math.min(maxSpeed, game.catVX));
    game.catX += game.catVX * dt;
  }
  game.catX = Math.max(6, Math.min(stageWidth - 6, game.catX));
}

function speedFor(){
  const t = difficultyT(game.distanceInBiome);
  const base = 122 + t * 65 + game.biomeIndex * 10;
  return base * (game.speedBoostT > 0 ? 1.45 : 1);
}

let normalized = 0, teeterFactor = 0;

function update(dt){
  if (game.state === 'gameover') return;
  game.time += dt;
  if (game.shieldT > 0) game.shieldT = Math.max(0, game.shieldT - dt);
  if (game.slipperyT > 0) game.slipperyT = Math.max(0, game.slipperyT - dt);
  if (game.speedBoostT > 0) game.speedBoostT = Math.max(0, game.speedBoostT - dt);
  updateStatusRow();

  const grounded = game.state === 'stable' || game.state === 'teeter' || game.state === 'landing' || game.state === 'jumping';

  if (grounded){
    // Freeze steering input during the brief post-fall "landing" beat:
    // wherever the player's finger/mouse happens to be at that instant
    // (often near an edge, since that's where they just fell from) must never
    // be able to yank the cat off a freshly-centered, safe respawn.
    if (game.state !== 'landing') updateControl(dt);
    const speed = speedFor();
    game.distanceTotal += speed * dt;
    game.distanceInBiome += speed * dt;
    extendPath(game.distanceInBiome + catLineY + 60);
    syncHud();

    const p = effectivePathAt(game.distanceInBiome, game.catX);
    const centerPx = p.cx * stageWidth;
    const hwPx = p.hw * stageWidth;
    const offset = game.catX - centerPx;
    normalized = offset / hwPx;

    if (checkPickupCollection() || game.state === 'gameover') return;

    if (game.state === 'jumping'){
      game.jumpT += dt;
      if (game.jumpT >= JUMP_DURATION){
        const stillInGap = isInGap(game.distanceInBiome);
        const outOfBounds = Math.abs(normalized) > 1;
        if ((stillInGap || outOfBounds) && game.shieldT <= 0){
          fallOff(normalized >= 0 ? 1 : -1);
        } else {
          if ((stillInGap || outOfBounds)) notifyShieldBlock();
          game.state = 'landing';
          game.landT = 0;
        }
      }
    } else {
      const currentlyInGap = isInGap(game.distanceInBiome);

      if (!currentlyInGap){
        const upcoming = nextGapFrom(game.distanceInBiome);
        if (upcoming && upcoming.d0 - game.distanceInBiome <= AUTO_LEAD && upcoming.d0 - game.distanceInBiome > -5){
          triggerJump();
        }
      }

      if (game.state === 'jumping'){
        // triggerJump() just fired above (auto mode) — let next frame's jump branch handle it
      } else if (currentlyInGap && game.shieldT <= 0){
        fallOff(0);
      } else {
        if (currentlyInGap) notifyShieldBlock();
        if (Math.abs(normalized) <= 0.55){
          game.teeterTimer = Math.max(0, game.teeterTimer - dt * 2);
        } else {
          const over = Math.max(0, Math.abs(normalized) - 1);
          game.teeterTimer += dt * (1 + over * 4);
        }
        game.state = game.teeterTimer > 0.05 && game.state !== 'landing' ? 'teeter' : (game.state === 'landing' ? 'landing' : 'stable');
        teeterFactor = Math.max(0, Math.min(1, game.teeterTimer / TEETER_LIMIT));

        if (game.state === 'landing'){
          game.landT += dt;
          if (game.landT >= LAND_DURATION){
            game.state = 'stable';
            game.landT = 0;
            // Control resumes now, for the first time since this landing began —
            // re-anchor to wherever the finger/mouse currently is so it doesn't
            // instantly snap the cat toward however far it drifted while frozen.
            resyncDrag();
          }
        }

        if (game.state === 'stable'){
          game.ambientTimer += dt;
          if (game.ambientTimer > game.ambientThreshold){
            showBanner(pick(AMBIENT_LINES));
            game.ambientTimer = 0;
            game.ambientThreshold = 16 + Math.random() * 10;
          }
        }

        const wouldFall = game.teeterTimer > TEETER_LIMIT || Math.abs(normalized) > 1.7;
        if (wouldFall && game.shieldT <= 0){
          fallOff(normalized >= 0 ? 1 : -1);
        } else if (wouldFall){
          notifyShieldBlock();
          game.teeterTimer = 0;
        }
      }
    }
  } else if (game.state === 'falling'){
    game.fallT += dt;
    if (game.fallT >= FALL_DURATION) transitionBiome();
  }
}

function drawDecoShape(kind, x, y, s){
  switch (kind){
    case 'chimney':
      ctx.fillRect(x - s * 0.4, y - s * 0.9, s * 0.8, s * 1.3);
      ctx.fillRect(x - s * 0.55, y - s * 1.05, s * 1.1, s * 0.25);
      break;
    case 'leaf':
      ctx.beginPath();
      ctx.ellipse(x, y, s * 0.7, s * 0.45, Math.PI / 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'picket':
      ctx.beginPath();
      ctx.moveTo(x - s * 0.35, y + s * 0.7);
      ctx.lineTo(x - s * 0.35, y - s * 0.3);
      ctx.lineTo(x, y - s * 0.75);
      ctx.lineTo(x + s * 0.35, y - s * 0.3);
      ctx.lineTo(x + s * 0.35, y + s * 0.7);
      ctx.closePath();
      ctx.fill();
      break;
    case 'book':
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.06);
      ctx.fillRect(-s * 0.5, -s * 0.65, s, s * 1.3);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-s * 0.06, -s * 0.65, s * 0.12, s * 1.3);
      ctx.restore();
      break;
    case 'cobweb':
      ctx.save();
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1.2;
      for (let a = 0; a < 6; a++){
        const ang = (a / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(ang) * s * 0.9, y + Math.sin(ang) * s * 0.9);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x, y, s * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      break;
    case 'pipe':
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x - s * 0.6, y - s * 0.3, s * 1.2, s * 0.6, s * 0.3);
      else ctx.rect(x - s * 0.6, y - s * 0.3, s * 1.2, s * 0.6);
      ctx.fill();
      break;
    case 'drop':
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.8);
      ctx.quadraticCurveTo(x + s * 0.6, y + s * 0.2, x, y + s * 0.7);
      ctx.quadraticCurveTo(x - s * 0.6, y + s * 0.2, x, y - s * 0.8);
      ctx.fill();
      break;
    case 'crystal':
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.9);
      ctx.lineTo(x + s * 0.5, y - s * 0.1);
      ctx.lineTo(x + s * 0.25, y + s * 0.8);
      ctx.lineTo(x - s * 0.25, y + s * 0.8);
      ctx.lineTo(x - s * 0.5, y - s * 0.1);
      ctx.closePath();
      ctx.fill();
      break;
    case 'flame':
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.8);
      ctx.quadraticCurveTo(x + s * 0.55, y + s * 0.1, x + s * 0.15, y - s * 0.8);
      ctx.quadraticCurveTo(x + s * 0.05, y - s * 0.3, x - s * 0.2, y - s * 0.4);
      ctx.quadraticCurveTo(x - s * 0.5, y + s * 0.1, x, y + s * 0.8);
      ctx.fill();
      break;
    case 'antenna':
      ctx.fillRect(x - s * 0.04, y - s * 0.9, s * 0.08, s * 1.1);
      ctx.fillRect(x - s * 0.22, y - s * 0.55, s * 0.44, s * 0.06);
      ctx.fillRect(x - s * 0.14, y - s * 0.3, s * 0.28, s * 0.06);
      break;
    case 'branch':
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(0.5);
      ctx.fillRect(-s * 0.6, -s * 0.06, s * 1.2, s * 0.12);
      ctx.restore();
      break;
    case 'flower':
      for (let a = 0; a < 5; a++){
        const ang = (a / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(ang) * s * 0.32, y + Math.sin(ang) * s * 0.32, s * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'clock':
      ctx.beginPath();
      ctx.arc(x, y, s * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x - s * 0.04, y - s * 0.38, s * 0.08, s * 0.38);
      ctx.fillRect(x, y - s * 0.06, s * 0.26, s * 0.12);
      break;
    case 'frame':
      ctx.fillRect(x - s * 0.5, y - s * 0.65, s, s * 1.3);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(x - s * 0.36, y - s * 0.5, s * 0.72, s);
      break;
    case 'crate':
      ctx.fillRect(x - s * 0.5, y - s * 0.5, s, s);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.5, y - s * 0.5); ctx.lineTo(x + s * 0.5, y + s * 0.5);
      ctx.moveTo(x + s * 0.5, y - s * 0.5); ctx.lineTo(x - s * 0.5, y + s * 0.5);
      ctx.stroke();
      break;
    case 'grate':
      if (ctx.roundRect){ ctx.beginPath(); ctx.roundRect(x - s * 0.55, y - s * 0.35, s * 1.1, s * 0.7, s * 0.15); ctx.fill(); }
      else { ctx.fillRect(x - s * 0.55, y - s * 0.35, s * 1.1, s * 0.7); }
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1.2;
      for (let i = -1; i <= 1; i++){
        ctx.beginPath();
        ctx.moveTo(x - s * 0.4, y + i * s * 0.18);
        ctx.lineTo(x + s * 0.4, y + i * s * 0.18);
        ctx.stroke();
      }
      break;
    case 'stalactite':
      ctx.beginPath();
      ctx.moveTo(x - s * 0.35, y - s * 0.7);
      ctx.lineTo(x + s * 0.35, y - s * 0.7);
      ctx.lineTo(x, y + s * 0.7);
      ctx.closePath();
      ctx.fill();
      break;
    case 'ember':
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.4);
      ctx.lineTo(x + s * 0.4, y);
      ctx.lineTo(x, y + s * 0.4);
      ctx.lineTo(x - s * 0.4, y);
      ctx.closePath();
      ctx.fill();
      break;
    case 'bird':
      ctx.beginPath();
      ctx.moveTo(x - s * 0.4, y);
      ctx.quadraticCurveTo(x - s * 0.15, y - s * 0.3, x, y);
      ctx.quadraticCurveTo(x + s * 0.15, y - s * 0.3, x + s * 0.4, y);
      ctx.lineWidth = s * 0.09;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.stroke();
      break;
    case 'acorn':
      ctx.beginPath();
      ctx.ellipse(x, y + s * 0.15, s * 0.28, s * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - s * 0.3, y - s * 0.35, s * 0.6, s * 0.22);
      break;
    case 'stone':
      ctx.beginPath();
      ctx.ellipse(x, y, s * 0.45, s * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'lamp':
      ctx.beginPath();
      ctx.moveTo(x - s * 0.3, y - s * 0.1);
      ctx.lineTo(x + s * 0.3, y - s * 0.1);
      ctx.lineTo(x + s * 0.16, y + s * 0.4);
      ctx.lineTo(x - s * 0.16, y + s * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(x - s * 0.04, y - s * 0.6, s * 0.08, s * 0.5);
      break;
    case 'trunk':
      ctx.fillRect(x - s * 0.5, y - s * 0.35, s, s * 0.85);
      ctx.beginPath();
      ctx.arc(x, y - s * 0.35, s * 0.5, Math.PI, 0);
      ctx.fill();
      break;
    case 'valve':
      ctx.beginPath();
      ctx.arc(x, y, s * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = s * 0.1;
      ctx.strokeStyle = ctx.fillStyle;
      for (let a = 0; a < 4; a++){
        const ang = (a / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(ang) * s * 0.55, y + Math.sin(ang) * s * 0.55);
        ctx.stroke();
      }
      break;
    case 'ripple':
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = s * 0.08;
      for (let a = 0; a < 3; a++){
        ctx.beginPath();
        ctx.arc(x, y, s * (0.25 + a * 0.2), 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
      }
      break;
    case 'orb':
      ctx.beginPath();
      ctx.arc(x, y, s * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha *= 0.4;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.55, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'spark':
      ctx.save();
      ctx.translate(x, y);
      for (let a = 0; a < 4; a++){
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-s * 0.04, -s * 0.5, s * 0.08, s);
      }
      ctx.restore();
      break;
    default:
      ctx.beginPath();
      ctx.arc(x, y, s * 0.5, 0, Math.PI * 2);
      ctx.fill();
  }
}

function drawBackdrop(){
  const b = biome();
  const g = ctx.createLinearGradient(0, 0, 0, catLineY);
  g.addColorStop(0, b.sky[0]);
  g.addColorStop(1, b.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, stageWidth, stageHeight);

  ctx.save();
  ctx.fillStyle = b.deco;
  // Two parallax layers: a smaller/dimmer/slower back layer and a
  // larger/bolder/faster front layer, for a sense of depth as the world scrolls.
  const scrollBack = (game.distanceInBiome * 0.18) % (stageHeight + 80);
  const scrollFront = (game.distanceInBiome * 0.42) % (stageHeight + 80);
  game.deco.forEach((d) => {
    const scrollY = d.layer === 0 ? scrollBack : scrollFront;
    const x = d.x * stageWidth;
    const y = (d.y * (stageHeight + 80) + scrollY) % (stageHeight + 80) - 40;
    const sizeMul = d.layer === 0 ? 0.8 : 1.3;
    const s = d.s * 18 * sizeMul;
    ctx.globalAlpha = d.layer === 0 ? 0.26 : 0.5;
    const kinds = b.decoKinds || [b.decoKind];
    drawDecoShape(kinds[d.kindIdx] || kinds[0], x, y, s);
  });
  ctx.restore();

  drawParticles(b);
}

function drawParticles(b){
  if (!b.particle) return;
  ctx.save();
  ctx.fillStyle = b.particleColor || '#fff';
  game.particles.forEach((p) => {
    const t = game.time * p.speed + p.phase;
    const span = stageHeight + 40;
    const raw = p.y * span - game.time * 22 * p.speed;
    const y = ((raw % span) + span) % span - 20;
    const x = p.x * stageWidth + Math.sin(t) * 8;
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 2);
    ctx.beginPath();
    ctx.arc(x, y, p.s * 4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function fillBeamRun(run, b){
  if (run.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(run[0].cx - run[0].hw, run[0].y);
  run.forEach((s) => ctx.lineTo(s.cx - s.hw, s.y));
  for (let i = run.length - 1; i >= 0; i--) ctx.lineTo(run[i].cx + run[i].hw, run[i].y);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, stageWidth, 0);
  g.addColorStop(0, b.beam[0]);
  g.addColorStop(0.5, b.beam[1]);
  g.addColorStop(1, b.beam[0]);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawBeamTexture(){
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 2;
  const seamSpacing = 34;
  const dTop = game.distanceInBiome + catLineY;
  const dBottom = game.distanceInBiome - (stageHeight - catLineY) - seamSpacing;
  const firstSeam = Math.floor(dBottom / seamSpacing) * seamSpacing;
  for (let d = firstSeam; d <= dTop; d += seamSpacing){
    if (d < 0 || isInGap(d)) continue;
    const y = catLineY - (d - game.distanceInBiome);
    if (y < -4 || y > stageHeight + 4) continue;
    const lanes = forkLanesAt(d);
    if (lanes){
      [lanes.a, lanes.b].forEach((lane) => {
        const hw = lane.hw * stageWidth;
        if (hw < 3) return;
        const cx = lane.cx * stageWidth;
        ctx.beginPath();
        ctx.moveTo(cx - hw + 2, y);
        ctx.lineTo(cx + hw - 2, y);
        ctx.stroke();
      });
    } else {
      const p = pathAt(d);
      const cx = p.cx * stageWidth, hw = p.hw * stageWidth;
      ctx.beginPath();
      ctx.moveTo(cx - hw + 3, y);
      ctx.lineTo(cx + hw - 3, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawGapEdges(){
  ctx.save();
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = 'rgba(255,196,0,0.85)';
  ctx.lineWidth = 2.5;
  game.gaps.forEach((g) => {
    [g.d0, g.d1].forEach((d) => {
      const y = catLineY - (d - game.distanceInBiome);
      if (y < -10 || y > stageHeight + 10) return;
      const p = pathAt(d);
      const cx = p.cx * stageWidth, hw = p.hw * stageWidth;
      ctx.beginPath();
      ctx.moveTo(cx - hw, y);
      ctx.lineTo(cx + hw, y);
      ctx.stroke();
    });
  });
  ctx.restore();
}

function drawPickups(){
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  game.pickups.forEach((pu) => {
    if (pu.collected) return;
    const y = catLineY - (pu.d - game.distanceInBiome);
    if (y < -22 || y > stageHeight + 22) return;
    const x = pu.cx * stageWidth;
    const bob = Math.sin(game.time * 4 + pu.d) * 3;
    const pulse = 1 + Math.sin(game.time * 5 + pu.d) * 0.08;
    const color = POWERUP_COLOR[pu.type] || '#fff';

    // soft outer glow so pickups pop against any biome's backdrop
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.22;
    ctx.arc(x, y + bob, 21 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (pu.type === 'mystery'){
      ctx.save();
      ctx.translate(x, y + bob);
      ctx.rotate(game.time * 2.2 + pu.d);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = color;
      ctx.fillRect(-13, -13, 26, 26);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(-13, -13, 26, 26);
      ctx.restore();
      ctx.fillStyle = '#1c1420';
      ctx.font = '700 16px "Space Grotesk", sans-serif';
      ctx.fillText('?', x, y + bob + 1);
    } else {
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(x, y + bob, 15 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = '16px sans-serif';
      ctx.fillText(POWERUP_ICON[pu.type] || '?', x, y + bob + 1);
    }
  });
  ctx.restore();
}

function drawDecoys(){
  const b = biome();
  game.decoys.forEach((dc) => {
    const steps = 10;
    const run = [];
    for (let i = 0; i <= steps; i++){
      const t = i / steps;
      const ease = 0.5 - 0.5 * Math.cos(Math.PI * t);
      const d = dc.d0 + (dc.d1 - dc.d0) * t;
      const cx = (dc.cx0 + (dc.cx1 - dc.cx0) * ease) * stageWidth;
      const hw = (dc.hw0 + (dc.hw1 - dc.hw0) * ease) * stageWidth;
      const y = catLineY - (d - game.distanceInBiome);
      run.push({ y, cx, hw });
    }
    fillBeamRun(run, b);
  });
}

function drawBeam(){
  const b = biome();
  const step = 6;
  const samplesA = [];
  const samplesB = [];
  const MIN_LANE_PX = 3; // below this, treat a shrinking (dead-end) lane as already gone
  for (let y = 0; y <= stageHeight; y += step){
    const d = Math.max(0, game.distanceInBiome + (catLineY - y));
    const gap = isInGap(d);
    const lanes = forkLanesAt(d);
    if (lanes){
      const aHwPx = lanes.a.hw * stageWidth, bHwPx = lanes.b.hw * stageWidth;
      samplesA.push(aHwPx > MIN_LANE_PX ? { y, cx: lanes.a.cx * stageWidth, hw: aHwPx, gap } : null);
      samplesB.push(bHwPx > MIN_LANE_PX ? { y, cx: lanes.b.cx * stageWidth, hw: bHwPx, gap } : null);
    } else {
      const p = pathAt(d);
      samplesA.push({ y, cx: p.cx * stageWidth, hw: p.hw * stageWidth, gap });
      samplesB.push(null);
    }
  }
  let i = 0;
  while (i < samplesA.length){
    if (!samplesA[i] || samplesA[i].gap){ i++; continue; }
    const runStart = i;
    while (i < samplesA.length && samplesA[i] && !samplesA[i].gap) i++;
    fillBeamRun(samplesA.slice(runStart, i), b);
  }
  i = 0;
  while (i < samplesB.length){
    if (!samplesB[i] || samplesB[i].gap){ i++; continue; }
    const runStart = i;
    while (i < samplesB.length && samplesB[i] && !samplesB[i].gap) i++;
    fillBeamRun(samplesB.slice(runStart, i), b);
  }

  drawDecoys();
  drawBeamTexture();
  drawGapEdges();

  const nearFall = teeterFactor > 0.4 && game.state === 'teeter';
  if (nearFall){
    const cur = effectivePathAt(game.distanceInBiome, game.catX);
    ctx.strokeStyle = `rgba(255,107,106,${0.3 + teeterFactor * 0.5})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo((cur.cx * stageWidth) - cur.hw * stageWidth, catLineY - 40);
    ctx.lineTo((cur.cx * stageWidth) - cur.hw * stageWidth, catLineY + 4);
    ctx.moveTo((cur.cx * stageWidth) + cur.hw * stageWidth, catLineY - 40);
    ctx.lineTo((cur.cx * stageWidth) + cur.hw * stageWidth, catLineY + 4);
    ctx.stroke();
  }

  drawPickups();
}

function drawCat(){
  let x = game.catX, y = catLineY, angle = 0, scaleY = 1;

  if (game.state === 'falling'){
    const t = game.fallT / FALL_DURATION;
    const ease = t * t;
    x = game.fallStartX + game.fallDir * 130 * t;
    y = catLineY + ease * (stageHeight - catLineY + 50);
    angle = game.fallStartAngle + Math.sin(t * Math.PI * 2.5) * 0.85 * game.fallDir;
    scaleY = 1 - 0.2 * t;
    ctx.save();
    ctx.globalAlpha = 1 - Math.max(0, t - 0.75) / 0.25;
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(1.55, 1.55 * scaleY);
    paintCat(0, 1, game.time, angle, true, false);
    ctx.restore();
    return;
  }

  const jumping = game.state === 'jumping';
  if (jumping){
    const t = Math.min(1, game.jumpT / JUMP_DURATION);
    const hop = Math.sin(Math.PI * t) * 34;
    y = catLineY - hop;
  }

  const walk = Math.sin(game.time * 8) * (game.state === 'stable' ? 2.4 : 1);
  let baseAngle = Math.max(-1.6, Math.min(1.6, normalized || 0)) * 0.5;
  baseAngle += Math.sin(game.time * 11) * 0.12 * teeterFactor;
  angle = jumping ? Math.sin(Math.min(1, game.jumpT / JUMP_DURATION) * Math.PI) * 0.16 * (game.catVX >= 0 ? 1 : -1) : baseAngle;
  game.lastAngle = angle;

  if (game.state === 'landing'){
    const t = game.landT / LAND_DURATION;
    scaleY = 0.6 + Math.min(1, t * 1.6) * 0.4 + (t < 1 ? Math.sin(t * Math.PI) * 0.08 : 0);
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(1, scaleY);
  paintCat(walk, teeterFactor, game.time, angle, false, jumping);
  ctx.restore();

  if (game.shieldT > 0){
    const pulse = 1 + Math.sin(game.time * 6) * 0.06;
    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(game.time * 6) * 0.15;
    ctx.fillStyle = 'rgba(126,200,255,0.16)';
    ctx.beginPath();
    ctx.arc(x, y - 3, 22 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(126,200,255,0.9)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }
}

function paintCat(walk, teeter, time, angle, falling, jumping){
  const bodyColor = '#e2793b';
  const darkStripe = '#b85a26';
  const belly = '#f7dcc0';

  // tail
  ctx.strokeStyle = bodyColor;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-11, -2);
  const tailFlick = falling ? Math.sin(time * 14) * 10 : Math.sin(time * 4) * 6 - (angle || 0) * 20;
  ctx.quadraticCurveTo(-24, -10 + tailFlick * 0.2, -20 + tailFlick, -22);
  ctx.stroke();

  // legs
  ctx.fillStyle = darkStripe;
  if (falling){
    const kick = Math.sin(time * 20) * 6;
    ctx.fillRect(-9, 6 + kick, 5, 9);
    ctx.fillRect(4, 6 - kick, 5, 9);
  } else if (jumping){
    ctx.fillRect(-9, 2, 5, 8);
    ctx.fillRect(4, 2, 5, 8);
  } else {
    ctx.fillRect(-9, 6 + walk, 5, 9);
    ctx.fillRect(4, 6 - walk, 5, 9);
  }

  // arms out when teetering (or always flailing while falling)
  const armTeeter = falling ? 1 : teeter;
  if (armTeeter > 0.12){
    const wob = Math.sin(time * (falling ? 22 : 15)) * armTeeter * (falling ? 20 : 14);
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-8, -4);
    ctx.lineTo(-20, -4 + wob);
    ctx.moveTo(8, -4);
    ctx.lineTo(20, -4 - wob);
    ctx.stroke();
  }

  // body
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(0, 0, 15, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.ellipse(0, 3, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // head
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.arc(11, -9, 9, 0, Math.PI * 2);
  ctx.fill();
  // ears
  ctx.beginPath();
  ctx.moveTo(5, -14); ctx.lineTo(8, -22); ctx.lineTo(11, -15); ctx.closePath(); ctx.fill();
  ctx.moveTo(14, -15); ctx.lineTo(18, -22); ctx.lineTo(19, -13); ctx.closePath(); ctx.fill();

  if (falling){
    // wide surprised eyes + open-mouth yell, for maximum comedy
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(9, -10, 3, 0, Math.PI * 2);
    ctx.arc(15, -10, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c1420';
    const jitter = Math.sin(time * 30) * 0.8;
    ctx.beginPath();
    ctx.arc(9 + jitter, -10, 1.3, 0, Math.PI * 2);
    ctx.arc(15 + jitter, -10, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a2338';
    ctx.beginPath();
    ctx.ellipse(13, -4, 2.6, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // eyes
    ctx.fillStyle = '#1c1420';
    ctx.beginPath();
    ctx.arc(9, -10, 1.4, 0, Math.PI * 2);
    ctx.arc(15, -10, 1.4, 0, Math.PI * 2);
    ctx.fill();
    // nose
    ctx.fillStyle = '#d1567a';
    ctx.beginPath();
    ctx.moveTo(12.5, -6.5); ctx.lineTo(14.5, -6.5); ctx.lineTo(13.5, -5); ctx.closePath();
    ctx.fill();
  }
}

function render(){
  ctx.clearRect(0, 0, stageWidth, stageHeight);
  drawBackdrop();
  if (game.state !== 'ready'){
    drawBeam();
    drawCat();
  }
}

let last = performance.now();
function loop(now){
  let dt = (now - last) / 1000;
  last = now;
  dt = Math.min(dt, 0.05);
  if (game.state !== 'ready' && game.state !== 'gameover') update(dt);
  render();
  requestAnimationFrame(loop);
}

/* ================= this game's board =================
   Mechanics live in js/leaderboard.js, shared with the other seven; only
   the store id and the local key are per-game, which is what keeps the
   boards independent of one another. */
const Board = makeBoard({
  id: 'ff808181a067127101a06ad5c6cf0c0c',
  localKey: 'catwalk-board',
  storeName: 'schrodingerscards-catwalk-highscores'
});
const boardUI = attachBoardUI(Board, () => Math.round(game.distanceTotal / 10));

/* ================= wiring ================= */
function newRun(){
  startGame();
  $('overlay').hidden = true;
  $('ov-final').hidden = true;
  $('entry').hidden = true;
  boardUI.closePeek();
  canvas.focus({ preventScroll: true });
}

/* The start screen. One mode, so this only ever resets it. */
function toStart(){
  game.state = 'ready';
  $('ov-title').textContent = 'A Windy Road. 9 Lives. Where Will You End Up?';
  $('ov-body').textContent = 'Drag anywhere (or ←/→) to steer — it always moves him relative to where he already is, so a stray tap never yanks him across the beam. In the later biomes, line up on the narrow ramp before a gap to launch across it, and watch for roads that split in two.';
  $('ov-final').hidden = true;
  $('entry').hidden = true;
  $('board').hidden = true;
  $('go').textContent = 'Start walking';
  $('go').onclick = newRun;
  $('overlay').hidden = false;
  livesEl.textContent = game.livesMax;
  scoreEl.textContent = '0';
  biomeEl.textContent = '1';
}

resize();
window.addEventListener('resize', resize);
toStart();
requestAnimationFrame(loop);
