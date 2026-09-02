/* ---------------- leaderboard ----------------

   Scores are shared: everyone who plays reads and writes the same list,
   with no account for anyone. It is one JSON document on a free public
   store that needs no key, fetched and rewritten by the page.

   Two things this deliberately does not do:
   - It cannot stop someone forging a score. A browser game has no way to
     prove a number was earned. That is an accepted trade.
   - It does not trust what comes back. Anything could be in that
     document, so names are re-sanitised on the way in AND on the way out
     before they are ever put on the page.

   If the store is unreachable the board quietly falls back to this
   browser's own scores, so a service outage degrades rather than breaks. */
const SCORES_ID = 'ff808181a058d43f01a0602bfe69182a';   // the shared board
const SCORES_API = 'https://api.restful-api.dev/objects';

const BOARD_SIZE = 10;
const LOCAL_KEY = 'scats-board';

/* Three letters is enough to spell something we would not want sitting on
   the site. Names are A-Z and 0-9 only, and these are refused outright. */
const BLOCKED = new Set([
  'ASS','FUK','FUC','FCK','CUM','TIT','SEX','FAG','JEW','NIG','KKK',
  'CNT','DIK','DIC','PIS','SHT','WTF','GAY','HOE','NAZ','POO','PEE'
]);
function cleanName(v){
  const n = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3);
  if (!n) return null;
  return BLOCKED.has(n) ? null : n;
}
function cleanRow(r){
  if (!r || typeof r !== 'object') return null;
  const name = cleanName(r.name);
  const score = Number(r.score);
  if (!name || !Number.isFinite(score) || score <= 0 || score > 1e6) return null;
  return { name, score: Math.floor(score), at: Number(r.at) || 0 };
}

const Board = {
  shared: false,
  url(){ return SCORES_ID ? `${SCORES_API}/${SCORES_ID}` : null; },
  async init(){
    this.shared = false;
    if (!this.url()) return false;
    try {
      const res = await fetch(this.url(), { cache:'no-store' });
      this.shared = res.ok;
    } catch { this.shared = false; }
    return this.shared;
  },
  localRows(){
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; }
  },
  async fetchShared(){
    const res = await fetch(this.url(), { cache:'no-store' });
    if (!res.ok) throw new Error(res.status);
    const body = await res.json();
    const raw = (body && body.data && body.data.scores) || [];
    return raw.map(cleanRow).filter(Boolean).sort((a,b)=>b.score-a.score);
  },
  async top(){
    if (this.shared){
      try { return (await this.fetchShared()).slice(0, BOARD_SIZE); }
      catch { this.shared = false; }
    }
    return this.localRows().map(cleanRow).filter(Boolean)
      .sort((a,b)=>b.score-a.score).slice(0, BOARD_SIZE);
  },
  async qualifies(score){
    if (score <= 0) return false;
    const rows = await this.top();
    return rows.length < BOARD_SIZE || score > rows[rows.length-1].score;
  },
  async submit(name, score){
    const row = cleanRow({ name, score, at: Date.now() });
    if (!row) return null;
    if (this.shared){
      try {
        /* Re-read immediately before writing, so two people finishing at
           once are unlikely to overwrite each other. Not airtight — the
           store has no compare-and-set — but the window is tiny and the
           stakes are a cat game. */
        const current = await this.fetchShared();
        const next = [...current, row].sort((a,b)=>b.score-a.score).slice(0, 50);
        const res = await fetch(this.url(), {
          method:'PUT',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ name:'schrodingerscards-highscores', data:{ scores: next } })
        });
        if (res.ok) return row;
      } catch { /* fall through to local */ }
    }
    const rows = this.localRows();
    rows.push(row);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.sort((a,b)=>b.score-a.score).slice(0,50)));
    return row;
  }
};

/* ---------------- roster ----------------
   w0 = spawn weight at the start of a round, w1 = weight at the end.
   Everything else scales with rarity: faster, twitchier, longer hold,
   tighter ring. Straight out of the Stardew fishing playbook. */
const RARITIES = [
  { key:'common',   name:'Common',       pts:5,   fur:'#9aa3bd', mark:'#7c86a4', speed:78,  lock:850,  radius:106, dart:[1.5,2.4], aura:0,   w0:46,  w1:15,
    build:{ scale:2.5, bx:20, by:12.5, hr:9.5, hx:15, hy:-6, leg:3.5, ear:'round', tail:'stub', eye:'sleepy' } },
  { key:'uncommon', name:'Uncommon',     pts:12,  fur:'#d9c49b', mark:'#b9a274', speed:96,  lock:950,  radius:100, dart:[1.2,2.0], aura:0,   w0:28,  w1:22,
    build:{ scale:2.2, bx:24, by:8, hr:10, hx:21, hy:-5, leg:7, ear:'point', tail:'long', eye:'normal' } },
  { key:'holo',     name:'Rare Holo',    pts:25,  fur:'#7dd8ff', mark:'#4fb4e0', speed:120, lock:1100, radius:93,  dart:[0.9,1.6], aura:.35, w0:16,  w1:25,
    build:{ scale:2.1, bx:13.5, by:9, hr:10.5, hx:11, hy:-14, leg:13, ear:'tall', tail:'long', eye:'wide' } },
  { key:'ultra',    name:'Ultra Rare',   pts:50,  fur:'#b48bff', mark:'#8a63d6', speed:146, lock:1250, radius:86,  dart:[0.7,1.2], aura:.55, w0:7,   w1:19,
    build:{ scale:2.3, bx:11, by:8.5, hr:15.5, hx:10, hy:-12, leg:3, ear:'point', tail:'curl', eye:'huge' } },
  { key:'sir',      name:'Special Illustration', pts:100, fur:'#ff8fd0', mark:'#e05fa8', speed:172, lock:1400, radius:80, dart:[0.5,0.95], aura:.78, w0:2.5, w1:12,
    build:{ scale:2.35, bx:18, by:15, hr:12, hx:14, hy:-10, leg:1.5, ear:'tuft', tail:'poof', eye:'normal', fluff:1 } },
  { key:'gold',     name:'Hyper Rare',   pts:250, fur:'#ffd88a', mark:'#e0ac48', speed:202, lock:1550, radius:74,  dart:[0.4,0.75], aura:1,   w0:0.5, w1:5,
    build:{ scale:2.45, bx:15, by:10, hr:12, hx:14, hy:-9, leg:6, ear:'crown', tail:'flow', eye:'derp' } }
];
const byKey = Object.fromEntries(RARITIES.map(r => [r.key, r]));

const cv = document.getElementById('field');
let ctx = cv.getContext('2d');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const ROUND_MS = 45000;
const CAT_SCALE = 2.35;
const VISIT_MS = 8200;          // how long a cat sticks around uncaught

let W=0, H=0, fieldScale=1, ringScale=1, running=false, endsAt=0, score=0, caught=0, progress=0;
let cats=[], pops=[], haul={}, motes=[], rings=[];
let best = Number(localStorage.getItem('scats-best') || 0);
document.getElementById('best').textContent = best;
const pointer = { x:-999, y:-999, down:false, touch:false };
/* Where the wave actually is. On a phone the finger covers whatever it is
   over, so the aim point rides above the contact point and the player can
   see both the wave and the cat they are chasing. */
const TOUCH_LIFT = 58;
const aim = { x:-999, y:-999 };
function updateAim(){
  aim.x = pointer.x;
  aim.y = pointer.y - (pointer.touch ? TOUCH_LIFT : 0);
}

function resize(){
  const dpr = Math.min(devicePixelRatio||1, 2);
  const r = cv.getBoundingClientRect();
  W=r.width; H=r.height;
  cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  /* A phone field is barely a third the width of a desktop one, so cats and
     rings have to come down with it or the board is all cat. Rings shrink
     more gently than the cats — a fingertip is not a mouse pointer. */
  fieldScale = Math.max(0.58, Math.min(1, W/560));
  MIN_GAP = 185*fieldScale;
  ringScale = 0.78 + 0.22*fieldScale;
}
addEventListener('resize', resize);

const lerp=(a,b,k)=>a+(b-a)*k;
const rand=(a,b)=>a+Math.random()*(b-a);

function pickRarity(){
  const weights = RARITIES.map(r => lerp(r.w0, r.w1, progress));
  const total = weights.reduce((a,b)=>a+b,0);
  let roll = Math.random()*total;
  for (let i=0;i<RARITIES.length;i++){ roll -= weights[i]; if (roll<=0) return RARITIES[i]; }
  return RARITIES[0];
}

/* Cats never spawn on top of each other, and gently push apart if they
   drift together. One overlapping pair ruins the whole read of the field. */
let MIN_GAP = 185;   // a cat is ~110px wide, so this keeps clear air between them
function freeSpot(){
  for (let tries=0; tries<80; tries++){
    const x = rand(90, W-90), y = rand(80, H-80);
    if (cats.every(c => Math.hypot(c.x-x, c.y-y) > MIN_GAP)) return {x,y};
  }
  return { x: rand(90, W-90), y: rand(80, H-80) };
}

function spawnCat(){
  const r = pickRarity();
  const { x, y } = freeSpot();
  cats.push({
    r, x, y, vx:0, vy:0, target:null, think:0,
    face:1, walk:0, blink:0, nextBlink:rand(1,3), seed:rand(0,10),
    lock:0, born:performance.now(), leaving:0, arrive:0
  });
}

const catCap = () => Math.min(3, 1 + Math.floor(caught / 5));

/* ---------------- the cat ---------------- */
function drawCat(c, t){
  const r = c.r, B = r.build;
  let scale = B.scale * fieldScale * (c.arrive < 1 ? 0.55 + 0.45*c.arrive : 1);
  /* A caught cat collapses to a point rather than fading out — it squashes
     down, spins a little and vanishes, which is much funnier than a
     dissolve. A cat that merely wandered off still just fades. */
  if (c.caughtFlag) scale *= Math.pow(1 - c.leaving, 0.85);
  ctx.save();
  ctx.translate(c.x, c.y);
  if (c.caughtFlag && c.leaving) ctx.rotate(c.leaving * 1.5);
  ctx.globalAlpha = c.leaving ? (c.caughtFlag ? 1 - Math.pow(c.leaving, 2.2) : 1 - c.leaving) : 1;

  // aura, so a rare sighting announces itself across the field
  if (r.aura > 0){
    const pulse = 0.75 + 0.25*Math.sin(t*3 + c.seed);
    const g = ctx.createRadialGradient(0,0,4,0,0,60*pulse);
    g.addColorStop(0, r.fur + '55'); g.addColorStop(1, r.fur + '00');
    ctx.globalAlpha *= r.aura;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0,0,60*pulse,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = c.leaving ? 1-c.leaving : 1;
  }

  ctx.scale(c.face*scale, scale);
  const moving = Math.abs(c.vx)+Math.abs(c.vy) > 8;
  const bob = moving ? Math.sin(c.walk*9)*1.3 : Math.sin(t*1.6 + c.seed)*0.8;
  const alarm = c.lock;
  const fur = r.fur, ink = '#141830';
  ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.fillStyle = fur; ctx.strokeStyle = fur;

  const hx = B.hx, hy = B.hy + bob;

  /* ---- tail: five silhouettes, not one curve recoloured ---- */
  const sw = Math.sin(t*(2.2+alarm*5.5)+c.seed)*(5+alarm*6);
  ctx.lineWidth = B.tail==='poof' ? 8 : B.tail==='stub' ? 6 : 4;
  ctx.beginPath();
  const tx = -B.bx + 2;
  if (B.tail==='stub'){
    ctx.moveTo(tx, 2+bob); ctx.quadraticCurveTo(tx-7, 1+sw*0.4, tx-8, -4+sw*0.5);
  } else if (B.tail==='curl'){
    ctx.moveTo(tx, 1+bob);
    ctx.bezierCurveTo(tx-14, 4+sw*0.4, tx-16, -10+sw*0.5, tx-5, -12+sw*0.6);
    ctx.bezierCurveTo(tx-1, -13+sw*0.6, tx-2, -6+sw*0.4, tx-7, -7+sw*0.5);
  } else if (B.tail==='flow'){
    ctx.moveTo(tx, 2+bob);
    ctx.bezierCurveTo(tx-18, 6+sw, tx-30, -8+sw*1.3, tx-20, -22+sw*1.5);
  } else if (B.tail==='poof'){
    ctx.moveTo(tx, 2+bob); ctx.quadraticCurveTo(tx-16, 2+sw*0.6, tx-15, -12+sw);
  } else {
    ctx.moveTo(tx, 2+bob); ctx.quadraticCurveTo(tx-13, 0+sw*0.5, tx-11, -14+sw);
  }
  ctx.stroke();
  if (B.tail==='poof'){
    ctx.beginPath(); ctx.arc(tx-15, -13+sw, 6, 0, Math.PI*2); ctx.fill();
  }

  /* ---- legs: length is a big part of the silhouette ---- */
  const step = moving ? Math.sin(c.walk*9)*2.2 : 0;
  const legTop = B.by - 1 + bob;
  for (const [lx,ph] of [[-B.bx*0.55,1],[-B.bx*0.2,-1],[B.bx*0.25,-1],[B.bx*0.6,1]]){
    ctx.beginPath();
    ctx.roundRect(lx-1.9, legTop, 3.8, Math.max(2, B.leg + ph*step), 1.9);
    ctx.fill();
  }

  /* ---- body ---- */
  ctx.beginPath(); ctx.ellipse(0, bob, B.bx, B.by, 0, 0, Math.PI*2); ctx.fill();
  if (B.fluff){   // ruff of fur around a poofy cat
    for (let i=0;i<9;i++){
      const a2 = (i/9)*Math.PI*2;
      ctx.beginPath();
      ctx.arc(Math.cos(a2)*B.bx*0.86, bob+Math.sin(a2)*B.by*0.86, 4.2, 0, Math.PI*2);
      ctx.fill();
    }
  }

  /* ---- head ---- */
  ctx.beginPath(); ctx.arc(hx, hy, B.hr, 0, Math.PI*2); ctx.fill();

  /* ---- ears ---- */
  const back = alarm*4;
  const e = B.hr*0.78;
  if (B.ear==='round'){
    ctx.beginPath(); ctx.arc(hx-e*0.75+back, hy-e*0.8, 4.4, 0, Math.PI*2);
    ctx.arc(hx+e*0.7, hy-e*0.85, 4.4, 0, Math.PI*2); ctx.fill();
  } else if (B.ear==='crown'){
    for (const [ex,h] of [[-e*0.85,-e*1.5],[0,-e*1.95],[e*0.85,-e*1.5]]){
      ctx.beginPath();
      ctx.moveTo(hx+ex-3.4, hy-e*0.6); ctx.lineTo(hx+ex, hy+h+back);
      ctx.lineTo(hx+ex+3.4, hy-e*0.6); ctx.closePath(); ctx.fill();
    }
  } else {
    const tall = B.ear==='tall' ? 1.75 : 1.15;
    ctx.beginPath();
    ctx.moveTo(hx-e-1+back, hy-e*0.55); ctx.lineTo(hx-e*1.15+back*1.5, hy-e*tall+back); ctx.lineTo(hx-1.5, hy-e*0.95); ctx.closePath();
    ctx.moveTo(hx+e*0.8-back*0.4, hy-e*0.62); ctx.lineTo(hx+e*1.15+back, hy-e*tall+back); ctx.lineTo(hx+2, hy-e); ctx.closePath();
    ctx.fill();
    if (B.ear==='tuft'){
      ctx.beginPath(); ctx.arc(hx-e*1.05, hy-e*1.25, 3, 0, Math.PI*2);
      ctx.arc(hx+e*1.05, hy-e*1.25, 3, 0, Math.PI*2); ctx.fill();
    }
  }

  /* ---- markings ---- */
  if (r.key !== 'common'){
    ctx.fillStyle = r.mark;
    ctx.beginPath(); ctx.ellipse(-B.bx*0.35, -B.by*0.25+bob, B.bx*0.32, B.by*0.28, -0.25, 0, Math.PI*2); ctx.fill();
    if (['ultra','sir','gold'].includes(r.key)){
      ctx.beginPath(); ctx.ellipse(B.bx*0.15, bob, B.bx*0.22, B.by*0.22, -0.2, 0, Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = fur;
  }

  /* ---- eyes: the derpiest part, so five distinct treatments ---- */
  const blinking = c.blink > 0;
  const ey = hy - B.hr*0.12;
  const ex1 = hx - B.hr*0.36, ex2 = hx + B.hr*0.37;
  ctx.fillStyle = ink;
  if (blinking){
    ctx.fillRect(ex1-2.7, ey-0.8, 5.4, 1.5);
    ctx.fillRect(ex2-2.7, ey-0.8, 5.4, 1.5);
  } else if (B.eye==='sleepy'){
    ctx.lineWidth = 1.8; ctx.strokeStyle = ink;
    ctx.beginPath(); ctx.arc(ex1, ey, 3, Math.PI*0.08, Math.PI*0.92); ctx.stroke();
    ctx.beginPath(); ctx.arc(ex2, ey, 2.8, Math.PI*0.08, Math.PI*0.92); ctx.stroke();
    ctx.strokeStyle = fur;
  } else {
    let r1, r2, off1 = 0, off2 = 0;
    if (B.eye==='huge'){ r1 = 5 + alarm; r2 = 4.6 + alarm; }
    else if (B.eye==='wide'){ r1 = 4 + alarm*1.4; r2 = 3.8 + alarm*1.4; }
    else if (B.eye==='derp'){ r1 = 4.6 + alarm; r2 = 2.9 + alarm; off1 = -0.7; off2 = 1.1; }
    else { r1 = 3.2 + alarm*1.4; r2 = 2.9 + alarm*1.5; }
    ctx.beginPath(); ctx.arc(ex1, ey+off1, r1, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex2, ey+off2, r2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    // catchlights aimed inward — this is what makes them read cross-eyed
    ctx.beginPath(); ctx.arc(ex1+r1*0.34, ey+off1-r1*0.34, r1*0.33, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex2-r2*0.3, ey+off2-r2*0.34, r2*0.32, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = ink;
  }

  /* ---- muzzle + tongue ---- */
  const my = hy + B.hr*0.44;
  ctx.beginPath(); ctx.moveTo(hx+0.6, my+1.6); ctx.lineTo(hx-1.8, my); ctx.lineTo(hx+3, my); ctx.closePath(); ctx.fill();
  const tongueOut = B.eye==='derp' || Math.sin(t*0.9 + c.seed) > 0.55;
  if (!blinking && tongueOut){
    ctx.fillStyle='#ff9db8';
    ctx.beginPath(); ctx.roundRect(hx-0.7, my+1.8, 2.9, 3.6, 1.3); ctx.fill();
    ctx.fillStyle = ink;
  }

  /* ---- whiskers ---- */
  ctx.strokeStyle='rgba(20,24,48,.4)'; ctx.lineWidth=.8;
  for (const [dy,dy2] of [[0.4,-1.4],[1.6,1.4],[2.4,4.2]]){
    ctx.beginPath(); ctx.moveTo(hx+2.4, my+dy); ctx.lineTo(hx+B.hr+2, my+dy2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx-1.6, my+dy); ctx.lineTo(hx-B.hr-1, my+dy2); ctx.stroke();
  }

  ctx.restore();
  ctx.globalAlpha=1;

  // sparkles on the top two
  if (r.key==='sir'||r.key==='gold'){
    ctx.fillStyle=r.fur;
    for (let i=0;i<4;i++){
      const a2 = t*1.4 + c.seed + i*Math.PI/2;
      const rad = 46 + Math.sin(t*2+i)*6;
      ctx.globalAlpha = (c.leaving?1-c.leaving:1) * (0.35+0.35*Math.sin(t*3+i));
      ctx.beginPath(); ctx.arc(c.x+Math.cos(a2)*rad, c.y+Math.sin(a2)*rad*0.7, 2.1, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1;
  }
}

/* ---------------- cursor: the site's wave, at cursor scale ----------------
   Same three-component sum as the What We Carry tiles and the wave in the
   other game — the k values are scaled up so roughly three cycles fit across
   the cursor rather than across a whole card. The beat between the three is
   what stops it looking like a screensaver sine. */
const CURSOR_PARTS = [
  { k:0.206, s:1.00, a:1.00 },
  { k:0.352, s:-0.58, a:0.54 },
  { k:0.545, s:1.62, a:0.29 }
];
function drawCursor(t, locking){
  if (aim.x < -100) return;
  const half = 46;
  const amp = (20 - locking*9);   // taller swing; collapses further as the lock builds
  const g = ctx.createLinearGradient(aim.x-half,0,aim.x+half,0);
  g.addColorStop(0,'#7dd8ff'); g.addColorStop(1,'#b48bff');
  ctx.strokeStyle=g;
  ctx.lineWidth = pointer.down ? 2.6 : 1.9;

  const at = (i) => CURSOR_PARTS.reduce((sum,p) =>
    sum + p.a*Math.sin(i*p.k + t*p.s*3), 0) / 1.83;

  for (const [sign, alpha, lw] of [[1,.95,1],[-1,.62,.85]]){
    ctx.beginPath();
    for (let i=-half;i<=half;i+=1.5){
      // taper at the ends so it reads as a packet, not a cut-off ribbon
      const env = Math.cos((i/half)*Math.PI/2);
      const y = aim.y + sign*at(i)*amp*env;
      i===-half ? ctx.moveTo(aim.x+i,y) : ctx.lineTo(aim.x+i,y);
    }
    ctx.globalAlpha = (pointer.down ? 1 : .7) * alpha;
    ctx.lineWidth = (pointer.down ? 2.6 : 1.9) * lw;
    ctx.stroke();
  }

  // on touch the finger covers the real point, so show where it actually is
  if (pointer.touch && pointer.down){
    ctx.globalAlpha=.28; ctx.lineWidth=1; ctx.setLineDash([3,5]);
    ctx.beginPath(); ctx.moveTo(aim.x, aim.y+14); ctx.lineTo(pointer.x, pointer.y-10); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.globalAlpha=1;
}

function drawPop(p){
  const k=p.life/p.max;
  ctx.globalAlpha=k; ctx.fillStyle=p.color; ctx.textAlign='center';
  ctx.font='700 14px "Space Grotesk",system-ui,sans-serif';
  ctx.fillText(p.name, p.x, p.y-(1-k)*38);
  ctx.font='700 21px "Space Grotesk",system-ui,sans-serif';
  ctx.fillText(p.pts>0?('+'+p.pts):'got away', p.x, p.y-(1-k)*38+23);
  ctx.globalAlpha=1;
}

/* Motes flung out at the moment of capture. */
function poof(x, y, colour){
  for (let i=0;i<10;i++){
    const a = (i/10)*Math.PI*2 + Math.random()*0.5;
    const sp = 60 + Math.random()*90;
    motes.push({ x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp - 30,
                 life:0.55+Math.random()*0.25, max:0.8, colour, r:1.6+Math.random()*2 });
  }
  rings.push({ x, y, r:6, life:1, colour });
}

function land(c){
  score += c.r.pts; caught++;
  poof(c.x, c.y, c.r.fur);
  haul[c.r.key] = (haul[c.r.key]||0)+1;
  document.getElementById('score').textContent = score;
  document.getElementById('caught').textContent = caught;
  pops.push({x:c.x,y:c.y-30,name:c.r.name,pts:c.r.pts,color:c.r.fur,life:1.1,max:1.1});
  c.leaving = 0.001; c.caughtFlag = true;
}

let last=performance.now();
function loop(now){
  const dt=Math.min((now-last)/1000,.05); last=now;
  const t=now/1000;
  ctx.clearRect(0,0,W,H);

  if (running){
    const leftMs=Math.max(0,endsAt-now);
    progress = 1 - leftMs/ROUND_MS;

    // which cat is being measured — only the nearest one in range
    let tracked=null, bestD=Infinity;
    if (pointer.down){
      for (const c of cats){
        if (c.leaving) continue;
        const d=Math.hypot(aim.x-c.x, aim.y-c.y);
        if (d < c.r.radius*ringScale && d < bestD){ bestD=d; tracked=c; }
      }
    }

    for (const c of cats){
      if (c.leaving){ c.leaving=Math.min(1,c.leaving+dt*(c.caughtFlag?2.1:3.2)); continue; }
      c.arrive = Math.min(1, c.arrive + dt*3);

      c.think-=dt;
      if (!c.target || c.think<=0){
        const m=70;
        c.target={x:rand(m,W-m), y:rand(m,H-m)};
        c.think=rand(c.r.dart[0], c.r.dart[1]);
      }
      const dx=c.target.x-c.x, dy=c.target.y-c.y, d=Math.hypot(dx,dy)||1;
      if (d<14) c.think=0;
      const flee = c===tracked ? 1+c.lock*0.7 : 1;
      c.vx=(dx/d)*c.r.speed*flee; c.vy=(dy/d)*c.r.speed*flee;
      c.x+=c.vx*dt; c.y+=c.vy*dt;

      // keep them apart
      for (const o of cats){
        if (o===c||o.leaving) continue;
        const sx=c.x-o.x, sy=c.y-o.y, sd=Math.hypot(sx,sy)||1;
        if (sd<MIN_GAP){
          const push=(MIN_GAP-sd)*dt*4.5;
          c.x+=sx/sd*push; c.y+=sy/sd*push;
          /* Send it somewhere else too, or it just walks straight back in. */
          if (sd<MIN_GAP*0.7) c.think=0;
        }
      }

      c.x=Math.max(52,Math.min(W-52,c.x)); c.y=Math.max(48,Math.min(H-48,c.y));
      if (Math.abs(c.vx)>6) c.face=c.vx>0?1:-1;
      c.walk+=dt*(Math.hypot(c.vx,c.vy)/90);
      c.blink-=dt; c.nextBlink-=dt;
      if (c.nextBlink<=0){ c.blink=.13; c.nextBlink=rand(1.8,4.5); }

      if (c===tracked){
        c.lock=Math.min(1, c.lock + (dt*1000)/c.r.lock);
        if (c.lock>=1) land(c);
      } else {
        c.lock=Math.max(0, c.lock - dt*0.8);
      }

      // wanders off if nobody pins it down
      if (!c.caughtFlag && now-c.born > VISIT_MS){
        c.leaving=0.001;
        pops.push({x:c.x,y:c.y-30,name:c.r.name,pts:0,color:'#6d7299',life:.9,max:.9});
      }
    }

    cats = cats.filter(c => c.leaving < 1);
    while (cats.length < catCap()) spawnCat();

    document.getElementById('time').textContent = Math.min(ROUND_MS/1000, Math.ceil(leftMs/1000));
    const fill=document.getElementById('timer-fill');
    fill.style.width=(leftMs/ROUND_MS*100)+'%';
    fill.classList.toggle('low', leftMs<10000);
    if (leftMs<=0) finish();
  }

  // rings
  if (running){
    for (const c of cats){
      if (c.leaving) continue;
      ctx.strokeStyle = c.lock>0.01 ? c.r.fur : 'rgba(168,173,207,.22)';
      ctx.globalAlpha = c.lock>0.01 ? .9 : 1;
      ctx.lineWidth = c.lock>0.01 ? 3 : 1;
      if (c.lock<=0.01) ctx.setLineDash([4,7]);
      ctx.beginPath();
      c.lock>0.01
        ? ctx.arc(c.x,c.y,c.r.radius*ringScale*0.66,-Math.PI/2,-Math.PI/2+c.lock*Math.PI*2)
        : ctx.arc(c.x,c.y,c.r.radius*ringScale,0,Math.PI*2);
      ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha=1;
    }
    for (const c of cats) drawCat(c, reduced?0:t);
  }

  // expanding shockwave rings
  for (const g of rings){
    g.life -= dt*2.2; g.r += dt*230;
    if (g.life<=0) continue;
    ctx.globalAlpha = g.life*0.5; ctx.strokeStyle = g.colour; ctx.lineWidth = 2.4*g.life;
    ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI*2); ctx.stroke();
  }
  rings = rings.filter(g=>g.life>0);
  ctx.globalAlpha = 1;

  // motes
  for (const m of motes){
    m.life -= dt; if (m.life<=0) continue;
    m.x += m.vx*dt; m.y += m.vy*dt; m.vy += 210*dt; m.vx *= 0.98;
    ctx.globalAlpha = Math.max(0, m.life/m.max); ctx.fillStyle = m.colour;
    ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI*2); ctx.fill();
  }
  motes = motes.filter(m=>m.life>0);
  ctx.globalAlpha = 1;

  for (const p of pops) p.life-=dt;
  pops=pops.filter(p=>p.life>0);
  pops.forEach(drawPop);

  if (running){
    const anyLock = cats.some(c=>c.lock>0.01);
    drawCursor(reduced?0:t, anyLock ? Math.max(...cats.map(c=>c.lock)) : 0);
  }
  requestAnimationFrame(loop);
}

/* ---------------- input ---------------- */
function pos(e){
  const r=cv.getBoundingClientRect();
  pointer.x=e.clientX-r.left; pointer.y=e.clientY-r.top;
  if (e.pointerType) pointer.touch = e.pointerType !== 'mouse';
  updateAim();
}
cv.addEventListener('pointermove', pos);
cv.addEventListener('pointerdown', e=>{
  /* Stops the browser turning the press into a selection or a drag before
     we ever see a move. Safe here because the canvas has no text or
     controls of its own — the overlay sits outside it. */
  e.preventDefault();
  pos(e); pointer.down=true;
  document.body.classList.add('dragging');
  try { cv.setPointerCapture(e.pointerId); } catch {}
});
addEventListener('pointerup', ()=>{ pointer.down=false; document.body.classList.remove('dragging'); });
addEventListener('pointercancel', ()=>{ pointer.down=false; document.body.classList.remove('dragging'); });

/* Belt and braces for the long-press behaviours that fire independently of
   pointer events: the iOS callout menu, the selection, and the drag image. */
for (const evt of ['contextmenu','selectstart','dragstart']){
  cv.addEventListener(evt, e => e.preventDefault());
}
/* Older iOS ignores touch-action, so refuse the touch gestures outright. */
cv.addEventListener('touchstart', e => e.preventDefault(), { passive:false });
cv.addEventListener('touchmove',  e => e.preventDefault(), { passive:false });
cv.addEventListener('pointerleave', ()=>{ if(!pointer.down){ pointer.x=-999; pointer.y=-999; updateAim(); } });

function start(){
  resize();
  score=0; caught=0; progress=0; cats=[]; pops=[]; haul={}; motes=[]; rings=[];
  document.getElementById('score').textContent='0';
  document.getElementById('caught').textContent='0';
  document.getElementById('overlay').hidden=true;
  running=true; endsAt=performance.now()+ROUND_MS;
  spawnCat();
  cv.focus({preventScroll:true});
}

function finish(){
  running=false; pointer.down=false;
  const isPb = score>best;
  if (isPb){ best=score; localStorage.setItem('scats-best',String(best)); document.getElementById('best').textContent=best; }
  const rows = RARITIES.filter(r=>haul[r.key]).reverse()
    .map(r=>`<div><b style="color:${r.fur}">${r.name}</b><span>&times;${haul[r.key]}</span></div>`).join('');
  const h=document.getElementById('haul');
  h.innerHTML = rows || '<div><b style="color:var(--text-faint)">Nothing caught</b><span></span></div>';
  h.hidden=false;
  document.getElementById('ov-title').textContent = caught ? 'Haul' : 'They all got away';
  document.getElementById('ov-body').textContent = isPb
    ? 'Best run yet. Dropping a common cat to chase something gold is almost always the right call.'
    : 'Rare cats show up more often late in the round. Save your attention for the back half.';
  document.getElementById('final-score').textContent=score;
  document.getElementById('ov-score').hidden=false;
  document.getElementById('pb').hidden=!isPb;
  document.getElementById('start').textContent='Play again';
  document.getElementById('overlay').hidden=false;

  // offer the initials box only if the run actually made the board
  const entry = document.getElementById('entry');
  entry.hidden = true;
  renderBoard();
  Board.qualifies(score).then(ok => {
    if (!ok) return;
    entry.hidden = false;
    document.getElementById('entry-msg').textContent =
      Board.shared ? 'You made the board! Enter your initials.'
                   : 'High score! Enter your initials.';
    initials.value = '';
    initials.focus();
  });
}
document.getElementById('start').addEventListener('click', start);

/* ---------------- board UI ---------------- */
let justEntered = null;
async function renderBoard(){
  const rows = await Board.top();
  const wrap = document.getElementById('board');
  const list = document.getElementById('board-list');
  if (!rows.length){ wrap.hidden = true; return; }
  document.getElementById('board-title').textContent =
    Board.shared ? 'High scores' : 'Your best runs';
  list.innerHTML = rows.map((r,i)=>{
    const mine = justEntered && r.name===justEntered.name && r.score===justEntered.score;
    return `<li class="${mine?'you':''}"><span class="rank">${i+1}</span>` +
           `<span class="who">${cleanName(r.name) || '???'}</span>` +
           `<span class="pts">${Number(r.score)||0}</span></li>`;
  }).join('');
  wrap.hidden = false;
}

const initials = document.getElementById('initials');
initials.addEventListener('input', () => {
  initials.value = initials.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3);
});
initials.addEventListener('keydown', e => { if (e.key==='Enter') submitScore(); });
document.getElementById('submit-score').addEventListener('click', () => submitScore());

async function submitScore(){
  const name = cleanName(initials.value) || 'CAT';
  document.getElementById('entry').hidden = true;
  justEntered = await Board.submit(name, score);
  await renderBoard();
}

Board.init();

/* ---------------- dex ---------------- */
document.getElementById('dex').innerHTML = RARITIES.map(r=>`
  <div class="dex-card">
    <canvas width="80" height="64" data-key="${r.key}"></canvas>
    <div><b style="color:${r.fur}">${r.name}</b><span>${r.pts} pts</span></div>
  </div>`).join('');
document.querySelectorAll('.dex-card canvas').forEach(el=>{
  const r = byKey[el.dataset.key];
  const x = el.getContext('2d');
  const realCtx = ctx;
  ctx = x;                                  // draw the true silhouette, scaled down
  const savedScale = r.build.scale, savedAura = r.aura;
  r.build.scale = savedScale * 0.34;
  r.aura = 0;                               // the glow would flood a 40px tile
  drawCat({ r, x:46, y:40, vx:0, vy:0, face:1, walk:0, blink:0, seed:2.1,
            lock:0, leaving:0, arrive:1 }, 0.6);
  r.build.scale = savedScale; r.aura = savedAura;
  ctx = realCtx;
});

resize();
requestAnimationFrame(loop);
