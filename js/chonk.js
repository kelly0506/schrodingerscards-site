/* ================= Chonk =================
   Lives at chonk.html. Depends on js/leaderboard.js for the score board.

   A cat eats his way up a food chain. Everything on the board is either
   smaller than him, in which case it is lunch, or bigger, in which case it
   wears red spikes and costs a life. He is measured in kilograms, from a
   350g kitten to the 900kg at which he cannot hold himself together - and
   when he reaches that he goes supernova and leaves a black hole where he
   was standing.

   The hole is the game. It pulls everything, including him, and it FATTENS
   on what it swallows, so every cycle the board has less of itself left and
   the run is on a fuse rather than merely getting cramped. Anything it takes
   winds in on a spiral, gets a short tidal stretch, and condenses to a dot
   at the horizon.

   The weight ladder rises steeply at the top - a crumb is 20g and a cow is
   260kg - so the last stretch to critical mass is about finding something
   enormous rather than eating another hundred mice. */

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const TAU=Math.PI*2;

const BREEDS=[
  { fur:'#9aa3bd', mark:'#7c86a4' }, { fur:'#d9c49b', mark:'#b9a274' },
  { fur:'#7dd8ff', mark:'#4fb4e0' }, { fur:'#b48bff', mark:'#8a63d6' },
  { fur:'#ff8fd0', mark:'#e05fa8' }, { fur:'#ffd88a', mark:'#e0ac48' },
  { fur:'#c98f6a', mark:'#a06f4e' }, { fur:'#6b7397', mark:'#4c5479' }
];

/* Food. `r` is both what it looks like and what decides whether it fits in the
   cat, because those being two different numbers was the worst bug we have had
   in this game. `kg` is what you actually gain, and the ladder rises steeply at
   the top so the last stretch to critical mass is about finding something
   enormous rather than eating another hundred mice.

   Eighteen of them now. The middle of the ladder was the thin part - one fish
   between a mouse and a bird - so the new arrivals are mostly in there, and
   they are all deliberately silly. */
const FOOD=[
  { key:'crumb',   r:5,  tier:0, col:'#d9c49b', pts:5,   kg:0.02 },
  { key:'pea',     r:7,  tier:0, col:'#8fe3b0', pts:8,   kg:0.05 },
  { key:'moth',    r:9,  tier:0, col:'#cdd4f5', pts:11,  kg:0.09 },
  { key:'sprat',   r:10, tier:1, col:'#7dd8ff', pts:14,  kg:0.20 },
  { key:'snail',   r:12, tier:1, col:'#ffd88a', pts:18,  kg:0.28 },
  { key:'mouse',   r:13, tier:1, col:'#9aa3bd', pts:22,  kg:0.40 },
  { key:'frog',    r:16, tier:2, col:'#8fe3b0', pts:30,  kg:0.80 },
  { key:'sausage', r:17, tier:2, col:'#d9825f', pts:33,  kg:1.10 },
  { key:'fish',    r:18, tier:2, col:'#4fb4e0', pts:36,  kg:1.50 },
  { key:'bird',    r:24, tier:2, col:'#ff8fd0', pts:55,  kg:4    },
  { key:'chicken', r:28, tier:3, col:'#eef0fb', pts:70,  kg:7    },
  { key:'duck',    r:32, tier:3, col:'#ffd88a', pts:90,  kg:12   },
  { key:'rabbit',  r:36, tier:3, col:'#d9c49b', pts:110, kg:18   },
  { key:'goose',   r:42, tier:3, col:'#eef0fb', pts:140, kg:32   },
  { key:'turkey',  r:48, tier:4, col:'#c98f6a', pts:175, kg:60   },
  { key:'pig',     r:54, tier:4, col:'#ff9db8', pts:210, kg:95   },
  { key:'sheep',   r:62, tier:4, col:'#e8ecff', pts:260, kg:160  },
  { key:'cow',     r:70, tier:4, col:'#cdd4f5', pts:320, kg:260  }
];

/* Hazards. Each moves differently, so they are told apart by behaviour as much
   as by shape, and each is eventually edible once you have properly outgrown
   it. About a fifth quicker off the mark than last round, and they turn up a
   little sooner and a little thicker. */
const NASTIES=[
  { key:'wasp',   r:11, tier:1, col:'#ffd88a', move:'home',  from:0.15, kg:0.3 },
  { key:'roomba', r:20, tier:2, col:'#a8adcf', move:'rush',  from:0.36, kg:3 },
  { key:'broom',  r:26, tier:3, col:'#c98f6a', move:'sweep', from:0.54, kg:8 },
  { key:'hoover', r:36, tier:4, col:'#ff9d9d', move:'home',  from:0.72, kg:20 }
];

/* Power-ups ride the lanes like everything else and are ALWAYS collectable,
   whatever size you are - they are the one thing on the board that is never a
   decision. */
const POWERS=[
  { key:'heart',  r:12, col:'#ff8fd0', label:'+1 LIFE',      weight:1.0 },
  { key:'shield', r:12, col:'#7dd8ff', label:'SHIELD',       weight:1.2 },
  { key:'whisk',  r:12, col:'#8fe3b0', label:'LONG WHISKERS',weight:1.2 },
  { key:'nip',    r:12, col:'#b48bff', label:'CATNIP!',      weight:0.9 },
  { key:'cream',  r:12, col:'#ffd88a', label:'CREAM',        weight:1.0 },
  { key:'yarn',   r:12, col:'#ff9d9d', label:'SLOW',         weight:0.8 }
];

const cv=document.getElementById('stage'), ctx=cv.getContext('2d');
const $=id=>document.getElementById(id);

const LANES=9;
const R_MIN=13;                       // in S units, a kitten
const KG0=0.35;                       // what he weighs at the start
const KG_NOVA=900;                    // what he cannot hold himself together at
/* Where the board starts shouting. The meter is logarithmic, so this is the
   last 8% of the BAR but the last 480kg of the weight - about two cows. Any
   earlier and the warning nags for half the run. */
const KG_WARN=0.92;

/* How hard a hole winds what it is eating, in radians per second at the
   horizon, falling off with the square of distance the same way the pull
   does. This rotates a thing's velocity rather than adding to it, so it can
   never spin something up fast enough to sling it back out - it only bends
   the path into a curve. */
const SWIRL=2.6;
/* Half the height of the room, near enough - he really does end up enormous. */
function rMaxPx(){ return Math.min(w.W,w.H)*0.22; }
function radiusFor(kg){
  const f=clamp(Math.log(kg/KG0)/Math.log(KG_NOVA/KG0),0,1);
  return R_MIN*w.S + (rMaxPx()-R_MIN*w.S)*f;
}
/* Kilograms, then tonnes, because "412 kg" says something "46%" does not. */
function weightLabel(kg){
  if(kg<1) return (kg*1000).toFixed(0)+' g';
  if(kg<1000) return kg.toFixed(kg<10?1:0)+' kg';
  return (kg/1000).toFixed(2)+' t';
}

const w={ W:0,H:0,S:1, running:false, armed:true, locate:0, t:0,
  cat:null, items:[], bits:[], strands:[], toasts:[], lanes:[],
  keys:{}, pointer:null, held:false,
  score:0, lives:9, eaten:0, phase:0, tier:0, meter:0, shake:0, won:false, over:false,
  fx:{ shield:false, whisk:0, nip:0, slow:0 },
  holes:[], nova:null, suck:null, cycle:0, peakKg:KG0 };

function resize(){
  const dpr=Math.min(devicePixelRatio||1,2), r=cv.getBoundingClientRect();
  w.W=r.width; w.H=r.height;
  cv.width=Math.round(w.W*dpr); cv.height=Math.round(w.H*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  w.S=Math.min(w.W/620,w.H/413);
  buildLanes();
}
addEventListener('resize',resize);

/* ---- lanes ----
   Alternating directions and staggered speeds, so there is always a way
   through: if one lane is a wall of geese, the two either side are going the
   other way at a different pace. */
function buildLanes(){
  w.lanes=[];
  const top=w.H*0.05, usable=w.H*0.90, h=usable/LANES;
  for(let i=0;i<LANES;i++){
    w.lanes.push({ i, y:top+h*(i+0.5), h, dir:i%2?1:-1,
      speed:(38+((i*29)%30))*w.S, next:rand(0,1.4) });
  }
}

function makeCat(x,y){
  return { x:x!==undefined?x:w.W*0.5, y:y!==undefined?y:w.H*0.5, vx:0, vy:0,
    kg:KG0, r:R_MIN*w.S, B:pick(BREEDS),
    seed:Math.random()*9, chew:0, hurt:0, inv:0, face:1 };
}
/* How far past the cat's own edge he can take something in. Whiskers extend it
   for ten seconds. */
function reachBonus(){
  return (w.fx.whisk>0?16:0)*w.S;
}
function grown(c){ return clamp(Math.log(c.kg/KG0)/Math.log(KG_NOVA/KG0),0,1); }

/* ================= the cat =================
   Split in two this round: drawCatAt draws him at the origin and assumes the
   caller has set the transform, so the black hole can stretch him into a
   noodle without any of this code knowing about it. */
function drawCat(c,t){
  ctx.save(); ctx.translate(c.x,c.y); drawCatAt(c,t,0); ctx.restore();
  if(c.hurt>0){
    ctx.strokeStyle=`rgba(255,157,157,${c.hurt})`; ctx.lineWidth=3*w.S;
    ctx.beginPath(); ctx.arc(c.x,c.y,c.r*1.6,0,TAU); ctx.stroke();
  }
}
function drawCatAt(c,t,panic){
  const R=c.r, f=grown(c), fur=c.B.fur;
  const blink=c.inv>0&&Math.floor(t*14)%2;
  ctx.save(); ctx.globalAlpha=blink?0.45:1;
  /* He faces where he is going. The head, and therefore the mouth, is drawn on
     the +x side, so without this he happily ate things with his backside. The
     flip only commits above a small speed, so drifting to a stop does not make
     him pirouette. */
  ctx.scale(c.face,1);
  ctx.rotate(clamp(Math.abs(c.vx)/(2600*w.S),-0.22,0.22)*Math.sign(c.vy||1)*0.4);

  /* At critical mass he strains: a fast tremor and a hot rim, so the supernova
     is something you watch coming rather than something that happens to you. */
  const strain = panic ? 0 : clamp((f-KG_WARN)/(1-KG_WARN),0,1);
  if(strain>0){
    ctx.translate(Math.sin(t*47+c.seed)*R*0.035*strain, Math.cos(t*41)*R*0.035*strain);
    ctx.shadowColor='rgba(255,216,138,'+(0.5+0.5*Math.sin(t*9)).toFixed(3)+')';
    ctx.shadowBlur=(14+16*strain)*w.S;
  }

  ctx.strokeStyle=c.B.mark; ctx.lineCap='round'; ctx.lineWidth=R*(0.18+0.16*f);
  ctx.beginPath();
  ctx.moveTo(-R*(0.70+0.16*f),R*0.10);
  ctx.quadraticCurveTo(-R*(1.10+0.20*f),-R*(0.10+0.30*f),-R*(0.86+0.12*f),-R*(0.52+0.20*f));
  ctx.stroke();

  const legLen=R*(0.34-0.20*f);
  ctx.strokeStyle=fur; ctx.lineWidth=R*(0.17+0.08*f);
  for(const lx of [-0.42,-0.14,0.16,0.44]){
    const sw=Math.sin(t*(9-4*f)+lx*6+c.seed)*(0.26-0.18*f) + (panic?Math.sin(t*26+lx*9)*0.5*panic:0);
    ctx.beginPath();
    ctx.moveTo(R*lx,R*(0.44+0.14*f));
    ctx.lineTo(R*(lx+sw*0.3),R*(0.44+0.14*f)+legLen);
    ctx.stroke();
  }

  const bw=R*(0.82+0.16*f), bh=R*(0.70+0.06*f);
  ctx.fillStyle=fur;
  ctx.beginPath(); ctx.ellipse(0,R*0.06,bw,bh,0,0,TAU); ctx.fill();
  if(f>0.2){
    ctx.fillStyle='rgba(255,255,255,.10)';
    ctx.beginPath(); ctx.ellipse(0,R*(0.26+0.10*f),bw*0.7,bh*0.5,0,0,TAU); ctx.fill();
  }
  ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(10,13,24,.28)'; ctx.lineWidth=1.5*w.S;
  ctx.beginPath(); ctx.ellipse(0,R*0.06,bw,bh,0,0,TAU); ctx.stroke();

  const hx=R*(0.44+0.20*f), hy=-R*(0.44-0.16*f), hr=R*(0.46+0.06*f);
  ctx.fillStyle=fur;
  for(const sd of [-1,1]){
    ctx.beginPath();
    ctx.moveTo(hx+sd*hr*0.22,hy-hr*0.46);
    ctx.lineTo(hx+sd*hr*0.70,hy-hr*(1.50-0.45*f));
    ctx.lineTo(hx+sd*hr*0.98,hy-hr*0.22);
    ctx.closePath(); ctx.fill();
  }
  ctx.beginPath(); ctx.arc(hx,hy,hr,0,TAU); ctx.fill();
  if(f>0.3){
    ctx.beginPath(); ctx.arc(hx-hr*0.58,hy+hr*0.40,hr*0.36*f,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(hx+hr*0.58,hy+hr*0.40,hr*0.36*f,0,TAU); ctx.fill();
  }
  ctx.strokeStyle='rgba(10,13,24,.28)'; ctx.lineWidth=1.4*w.S;
  ctx.beginPath(); ctx.arc(hx,hy,hr,0,TAU); ctx.stroke();

  /* Eyes. Being eaten by a black hole widens them and shrinks the pupils to
     pinpricks, which is the whole joke of the death animation. */
  const ink='#141830', lid=clamp(f*1.1,0,0.62)*(1-panic), er=hr*(0.30-0.05*f)*(1+0.75*panic);
  for(const sd of [-1,1]){
    const ex=hx+sd*hr*0.33, ey=hy-hr*0.04;
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(ex,ey,er*(sd<0?1.08:0.92),0,TAU); ctx.fill();
    ctx.fillStyle=ink;
    const dr=Math.sin(t*(panic?18:1.9)+(sd<0?0:2.1)+c.seed)*er*(panic?0.30:0.16);
    ctx.beginPath(); ctx.arc(ex+dr,ey+er*0.08,er*0.46*(1-0.55*panic),0,TAU); ctx.fill();
    if(lid>0.02){
      ctx.fillStyle=fur;
      ctx.beginPath(); ctx.ellipse(ex,ey-er*(1-lid),er*1.25,er*lid*1.15,0,0,TAU); ctx.fill();
    }
  }
  ctx.fillStyle='#ff9db8'; ctx.beginPath();
  ctx.moveTo(hx,hy+hr*0.32); ctx.lineTo(hx-hr*0.11,hy+hr*0.17); ctx.lineTo(hx+hr*0.11,hy+hr*0.17);
  ctx.closePath(); ctx.fill();
  const open=clamp(Math.max(c.chew,panic),0,1);
  ctx.fillStyle=ink; ctx.beginPath();
  ctx.ellipse(hx,hy+hr*(0.50+0.10*open),hr*(0.18+0.26*open),hr*(0.09+0.30*open),0,0,TAU); ctx.fill();
  ctx.restore();
}

/* ================= faces =================
   One helper, three kinds of stupid: cross-eyed, wall-eyed, or googly, chosen
   per item when it spawns. It goes on the food AND on the hazards, which get
   angry eyebrows over the top of the same eyes - a wasp is funnier when it is
   cross-eyed and still trying to kill you.

   Everything below draws in the item's own space, +x forward, so the caller
   owns the facing flip. Eyes are re-flipped so nothing is looking backwards. */
function derp(o,t,ex,ey,er,gap,angry){
  const d=o.derp, s=o.seed;
  ctx.save(); ctx.scale(o.flip||1,1);
  for(const sd of [-1,1]){
    const px=ex+sd*gap;
    const py=ey+(d===1&&sd<0?er*0.22:0);
    const rr=er*(sd<0?1:(d===2?1.25:0.82));
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(px,py,rr,0,TAU); ctx.fill();
    let ox,oy;
    if(d===0){ ox=-sd*rr*0.36; oy=rr*0.12; }
    else if(d===1){ ox=sd*rr*0.38; oy=Math.sin(t*1.5+s)*rr*0.16; }
    else { ox=Math.sin(t*2.3+s+sd*1.7)*rr*0.30; oy=Math.cos(t*1.9+s)*rr*0.24; }
    ctx.fillStyle='#141830';
    ctx.beginPath(); ctx.arc(px+ox,py+oy,rr*0.48,0,TAU); ctx.fill();
    if(angry){
      ctx.strokeStyle='#141830'; ctx.lineWidth=er*0.40; ctx.lineCap='round';
      ctx.beginPath();
      ctx.moveTo(px-rr*1.05,py-rr*(sd<0?1.55:1.35));
      ctx.lineTo(px+rr*1.05,py-rr*(sd<0?0.85:1.05));
      ctx.stroke();
    }
  }
  ctx.restore();
}
/* A little open mouth, and one item in three sticks its tongue out. */
function gob(o,t,mx,my,mr){
  ctx.save(); ctx.scale(o.flip||1,1);
  ctx.fillStyle='#141830';
  ctx.beginPath(); ctx.ellipse(mx,my,mr,mr*(0.6+0.35*Math.abs(Math.sin(t*1.3+o.seed))),0,0,TAU); ctx.fill();
  if(o.derp===2){
    ctx.fillStyle='#ff9db8';
    ctx.beginPath(); ctx.ellipse(mx,my+mr*0.85,mr*0.55,mr*0.75,0,0,TAU); ctx.fill();
  }
  ctx.restore();
}

const ink='#141830';
function ell(x,y,rx,ry,rot){ ctx.beginPath(); ctx.ellipse(x,y,rx,ry,rot||0,0,TAU); ctx.fill(); }
function dot(x,y,r){ ctx.beginPath(); ctx.arc(x,y,r,0,TAU); ctx.fill(); }

/* Four legs and a tail, shared by everything with hooves. `k` carries the
   per-animal differences so a sheep is not a re-typed cow. */
function beast(o,t,r,k){
  const col=o.col;
  ctx.fillStyle=col;
  ctx.strokeStyle=col; ctx.lineWidth=r*0.15; ctx.lineCap='round';
  for(const lx of [-0.55,-0.2,0.2,0.55]){
    ctx.beginPath();
    ctx.moveTo(r*lx,r*0.45);
    ctx.lineTo(r*(lx+Math.sin(t*4+lx*7+o.seed)*0.08),r*0.98);
    ctx.stroke();
  }
  ctx.fillStyle=col; ell(0,0,r,r*0.62);
  if(k.fluff){
    for(let i=0;i<11;i++){
      const a=(i/11)*TAU;
      ctx.fillStyle=col; dot(Math.cos(a)*r*0.92,Math.sin(a)*r*0.55,r*0.26);
    }
  }
  if(k.spots){
    ctx.fillStyle='rgba(20,24,48,.30)';
    ell(-r*0.25,-r*0.12,r*0.26,r*0.19,0.4);
    ell(r*0.30,r*0.14,r*0.20,r*0.15,-0.3);
    ell(r*0.05,r*0.30,r*0.14,r*0.10,0.2);
  }
  /* tail */
  ctx.strokeStyle=col; ctx.lineWidth=r*0.11;
  ctx.beginPath();
  if(k.curly){
    ctx.arc(-r*1.02,-r*0.16,r*0.19,-1.2,4.2);
  } else {
    ctx.moveTo(-r*0.95,-r*0.20);
    ctx.quadraticCurveTo(-r*1.35,-r*0.05,-r*1.22,r*0.30);
  }
  ctx.stroke();
  if(k.bobtail){ ctx.fillStyle='#fff'; dot(-r*1.06,r*0.02,r*0.24); }

  const hx=r*(k.hx||0.86), hy=-r*(k.hy||0.18), hr=r*(k.hr||0.42);
  ctx.fillStyle=k.face||col;
  if(k.ears==='long'){
    for(const sd of [-1,1]) { ctx.save(); ctx.translate(hx,hy); ctx.rotate(sd*0.30-0.5);
      ell(0,-hr*1.5,hr*0.24,hr*1.35); ctx.restore(); }
  } else if(k.ears==='point'){
    for(const sd of [-1,1]){
      ctx.beginPath();
      ctx.moveTo(hx+sd*hr*0.45,hy-hr*0.5);
      ctx.lineTo(hx+sd*hr*0.20,hy-hr*1.35);
      ctx.lineTo(hx+sd*hr*0.85,hy-hr*0.85);
      ctx.closePath(); ctx.fill();
    }
  }
  dot(hx,hy,hr);
  if(k.horns){
    ctx.strokeStyle='#e8ecff'; ctx.lineWidth=r*0.09;
    for(const sd of [-1,1]){
      ctx.beginPath();
      ctx.moveTo(hx+sd*hr*0.55,hy-hr*0.62);
      ctx.quadraticCurveTo(hx+sd*hr*1.25,hy-hr*1.05,hx+sd*hr*1.05,hy-hr*0.35);
      ctx.stroke();
    }
  }
  if(k.snout){
    ctx.fillStyle='#ff9db8'; ell(hx+hr*0.62,hy+hr*0.24,hr*0.40,hr*0.32);
    ctx.fillStyle=ink; dot(hx+hr*0.72,hy+hr*0.12,hr*0.07); dot(hx+hr*0.72,hy+hr*0.38,hr*0.07);
  }
  if(k.teeth){
    ctx.fillStyle='#fff';
    ctx.fillRect(hx+hr*0.42,hy+hr*0.32,hr*0.34,hr*0.42);
  }
  derp(o,t,hx+hr*0.14,hy-hr*0.10,hr*0.26,hr*0.34,false);
}

/* Wings, beak, and a head that is mostly eyes. */
function birdy(o,t,r,k){
  const col=o.col, flap=Math.sin(t*(k.flap||9)+o.seed);
  ctx.fillStyle=col;
  if(k.fan){
    for(let i=-2;i<=2;i++){
      ctx.save(); ctx.translate(-r*0.75,0); ctx.rotate(i*0.32);
      ctx.fillStyle=i%2?'#a06f4e':'#d9c49b';
      ell(-r*0.62,0,r*0.66,r*0.17);
      ctx.restore();
    }
    ctx.fillStyle=col;
  } else {
    ctx.beginPath();
    ctx.moveTo(-r*0.85,0); ctx.lineTo(-r*1.5,-r*0.34); ctx.lineTo(-r*1.42,r*0.30);
    ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle='#e0ac48'; ctx.lineWidth=r*0.11; ctx.lineCap='round';
  for(const lx of [-0.16,0.22]){
    ctx.beginPath(); ctx.moveTo(r*lx,r*0.5); ctx.lineTo(r*(lx+0.05),r*0.92); ctx.stroke();
  }
  ctx.fillStyle=col; ell(0,0,r,r*0.64);
  ctx.fillStyle='rgba(255,255,255,.34)';
  ell(r*0.05,-r*0.06,r*0.56,r*0.28,flap*0.55);
  ctx.fillStyle=col;

  let hx=r*0.78, hy=-r*0.46;
  if(k.neck){
    hx=r*0.62; hy=-r*1.30;
    ctx.strokeStyle=col; ctx.lineWidth=r*0.30;
    ctx.beginPath(); ctx.moveTo(r*0.42,-r*0.30);
    ctx.quadraticCurveTo(r*0.90,-r*0.95,hx,hy); ctx.stroke();
  }
  const hr=r*(k.hr||0.40);
  ctx.fillStyle=col; dot(hx,hy,hr);
  if(k.comb){
    ctx.fillStyle='#ff5a5a';
    for(const cx of [-0.3,0,0.3]) dot(hx+hr*cx,hy-hr*0.92,hr*0.24);
    ell(hx+hr*0.30,hy+hr*0.80,hr*0.20,hr*0.30);
  }
  if(k.snood){ ctx.fillStyle='#ff5a5a'; ell(hx+hr*0.80,hy+hr*0.30,hr*0.16,hr*0.46); }
  ctx.fillStyle=k.bill?'#e0ac48':'#ffd88a';
  if(k.bill){
    ell(hx+hr*1.10,hy+hr*0.16,hr*0.66,hr*0.28);
  } else {
    ctx.beginPath();
    ctx.moveTo(hx+hr*0.55,hy-hr*0.10); ctx.lineTo(hx+hr*1.45,hy+hr*0.14);
    ctx.lineTo(hx+hr*0.55,hy+hr*0.38); ctx.closePath(); ctx.fill();
  }
  derp(o,t,hx,hy-hr*0.16,hr*0.30,hr*0.36,false);
}

function fishy(o,t,r){
  ctx.fillStyle=o.col;
  ell(0,0,r,r*0.58);
  ctx.beginPath();
  ctx.moveTo(-r*0.85,0);
  ctx.lineTo(-r*1.60,-r*0.55+Math.sin(t*7+o.seed)*r*0.14);
  ctx.lineTo(-r*1.60,r*0.55+Math.sin(t*7+o.seed)*r*0.14);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-r*0.1,-r*0.5); ctx.lineTo(r*0.1,-r*1.02); ctx.lineTo(r*0.35,-r*0.44);
  ctx.closePath(); ctx.fill();
  derp(o,t,r*0.42,-r*0.10,r*0.19,r*0.26,false);
  gob(o,t,r*0.88,r*0.16,r*0.12);
}

/* Everything the board can draw, keyed by name. Local space, +x forward. */
const SHAPES={
  crumb(o,t,r){
    ctx.fillStyle=o.col;
    ctx.beginPath();
    for(let i=0;i<7;i++){
      const a=(i/7)*TAU, rr=r*(0.72+((i*37+o.seed*13)%10)/10*0.5);
      i?ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):ctx.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(20,24,48,.35)'; dot(r*0.2,-r*0.1,r*0.16); dot(-r*0.3,r*0.2,r*0.12);
  },
  pea(o,t,r){
    ctx.fillStyle=o.col; dot(0,0,r);
    ctx.strokeStyle='#5fbf88'; ctx.lineWidth=r*0.16; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(0,-r*0.9); ctx.quadraticCurveTo(r*0.5,-r*1.5,r*0.1,-r*1.7); ctx.stroke();
    derp(o,t,0,-r*0.06,r*0.30,r*0.36,false);
    gob(o,t,0,r*0.48,r*0.14);
  },
  moth(o,t,r){
    const fl=0.35+0.65*Math.abs(Math.sin(t*11+o.seed));
    ctx.translate(0,Math.sin(t*5+o.seed)*r*0.22);
    ctx.fillStyle='rgba(205,212,245,.55)';
    for(const sd of [-1,1]){
      ell(sd*r*0.55,-r*0.15,r*0.62*fl,r*0.80,sd*0.5);
      ell(sd*r*0.45,r*0.42,r*0.44*fl,r*0.50,-sd*0.4);
    }
    ctx.fillStyle='#8f96b8'; ell(0,0,r*0.30,r*0.78);
    ctx.strokeStyle='#8f96b8'; ctx.lineWidth=r*0.09; ctx.lineCap='round';
    for(const sd of [-1,1]){
      ctx.beginPath(); ctx.moveTo(sd*r*0.1,-r*0.6);
      ctx.quadraticCurveTo(sd*r*0.6,-r*1.3,sd*r*0.25,-r*1.5); ctx.stroke();
    }
    derp(o,t,0,-r*0.42,r*0.26,r*0.28,false);
  },
  snail(o,t,r){
    ctx.fillStyle='#c9d2f0';
    ell(-r*0.1,r*0.55,r*1.05,r*0.30);
    ctx.fillStyle=o.col;
    ctx.strokeStyle='#c98f6a'; ctx.lineWidth=r*0.24; ctx.lineCap='round';
    ctx.beginPath(); ctx.arc(-r*0.15,-r*0.05,r*0.70,0,TAU); ctx.stroke();
    ctx.strokeStyle='#a06f4e'; ctx.lineWidth=r*0.14;
    ctx.beginPath();
    for(let i=0;i<28;i++){
      const a=i*0.42, rr=r*0.68*(1-i/34);
      const px=-r*0.15+Math.cos(a)*rr, py=-r*0.05+Math.sin(a)*rr;
      i?ctx.lineTo(px,py):ctx.moveTo(px,py);
    }
    ctx.stroke();
    ctx.strokeStyle=o.col; ctx.lineWidth=r*0.12;
    for(const sd of [-1,1]){
      ctx.beginPath(); ctx.moveTo(r*0.68,r*0.30);
      ctx.quadraticCurveTo(r*0.95,-r*0.3,r*(0.80+sd*0.16),-r*0.72); ctx.stroke();
    }
    derp(o,t,r*0.80,-r*0.80,r*0.20,r*0.17,false);
  },
  mouse(o,t,r){
    ctx.fillStyle=o.col;
    ell(0,0,r,r*0.70);
    dot(-r*0.55,-r*0.52,r*0.34);
    ctx.fillStyle='#ff9db8'; dot(-r*0.55,-r*0.52,r*0.19);
    ctx.strokeStyle=o.col; ctx.lineWidth=r*0.14; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-r*0.85,r*0.12);
    ctx.quadraticCurveTo(-r*1.7,r*0.35,-r*1.5,-r*0.42); ctx.stroke();
    ctx.fillStyle='#ff9db8'; dot(r*0.98,r*0.08,r*0.13);
    ctx.fillStyle='#fff'; ctx.fillRect(r*0.72,r*0.26,r*0.24,r*0.26);
    derp(o,t,r*0.42,-r*0.16,r*0.20,r*0.28,false);
  },
  frog(o,t,r){
    ctx.fillStyle=o.col;
    ctx.strokeStyle=o.col; ctx.lineWidth=r*0.20; ctx.lineCap='round';
    for(const sd of [-1,1]){
      ctx.beginPath(); ctx.moveTo(-r*0.4,sd*r*0.35);
      ctx.quadraticCurveTo(-r*1.0,sd*r*0.85,-r*0.45,sd*r*0.80); ctx.stroke();
    }
    ell(0,r*0.10,r,r*0.66);
    ctx.fillStyle='rgba(255,255,255,.16)'; ell(0,r*0.42,r*0.66,r*0.26);
    ctx.fillStyle=o.col;
    dot(-r*0.34,-r*0.62,r*0.34); dot(r*0.34,-r*0.62,r*0.34);
    ctx.strokeStyle=ink; ctx.lineWidth=r*0.09;
    ctx.beginPath(); ctx.arc(0,r*0.02,r*0.62,0.35,Math.PI-0.35); ctx.stroke();
    if(o.derp===2){
      ctx.strokeStyle='#ff9db8'; ctx.lineWidth=r*0.14;
      ctx.beginPath(); ctx.moveTo(r*0.3,r*0.52);
      ctx.quadraticCurveTo(r*1.1,r*0.85,r*1.25,r*0.30); ctx.stroke();
    }
    derp(o,t,0,-r*0.62,r*0.22,r*0.34,false);
  },
  sausage(o,t,r){
    ctx.lineCap='round'; ctx.strokeStyle=o.col; ctx.lineWidth=r*0.56;
    ctx.beginPath();
    ctx.moveTo(-r*0.90,r*0.26);
    ctx.quadraticCurveTo(0,-r*0.42,r*0.90,r*0.26);
    ctx.stroke();
    /* the two pinches, which are the whole reason it reads as a sausage */
    ctx.strokeStyle='rgba(20,24,48,.28)'; ctx.lineWidth=r*0.08;
    for(const sd of [-1,1]){
      ctx.beginPath();
      ctx.moveTo(sd*r*0.34,r*(sd<0?0.30:0.30)-r*0.30);
      ctx.lineTo(sd*r*0.30,r*(sd<0?0.30:0.30)+r*0.26);
      ctx.stroke();
    }
    ctx.fillStyle='rgba(255,255,255,.16)';
    ell(0,-r*0.02,r*0.62,r*0.10,-0.12);
    derp(o,t,r*0.74,r*0.02,r*0.17,r*0.21,false);
  },
  sprat(o,t,r){ fishy(o,t,r); },
  fish(o,t,r){ fishy(o,t,r); },
  bird(o,t,r){    birdy(o,t,r,{}); },
  chicken(o,t,r){ birdy(o,t,r,{comb:true,flap:11}); },
  duck(o,t,r){    birdy(o,t,r,{bill:true}); },
  goose(o,t,r){   birdy(o,t,r,{neck:true,bill:true,hr:0.34,flap:6}); },
  turkey(o,t,r){  birdy(o,t,r,{fan:true,snood:true,flap:5}); },
  rabbit(o,t,r){  beast(o,t,r,{ears:'long',bobtail:true,teeth:true,hr:0.40,hy:0.26}); },
  pig(o,t,r){     beast(o,t,r,{ears:'point',snout:true,curly:true}); },
  sheep(o,t,r){   beast(o,t,r,{fluff:true,ears:'point',face:'#3b4470',hr:0.38}); },
  cow(o,t,r){     beast(o,t,r,{spots:true,horns:true,snout:true,ears:'point',hr:0.44}); },

  wasp(o,t,r){
    ctx.fillStyle=o.col; ell(0,0,r,r*0.62);
    ctx.fillStyle=ink;
    for(const bx of [-0.3,0.15,0.6]) ctx.fillRect(r*bx,-r*0.62,r*0.22,r*1.24);
    ctx.fillStyle='rgba(255,255,255,.5)';
    ell(-r*0.1,-r*0.5,r*0.5,r*0.22,Math.sin(t*22+o.seed)*0.6);
    ctx.fillStyle=ink;
    ctx.beginPath(); ctx.moveTo(-r,0); ctx.lineTo(-r*1.55,-r*0.12); ctx.lineTo(-r,r*0.16);
    ctx.closePath(); ctx.fill();
    derp(o,t,r*0.52,-r*0.10,r*0.20,r*0.26,true);
  },
  roomba(o,t,r){
    ctx.fillStyle=o.col; ell(0,0,r,r*0.55);
    ctx.strokeStyle='#ff9d9d'; ctx.lineWidth=r*0.14;
    ctx.beginPath(); ctx.arc(0,0,r*0.66,(t*6)%TAU,(t*6)%TAU+2.2); ctx.stroke();
    derp(o,t,0,-r*0.04,r*0.22,r*0.30,true);
  },
  broom(o,t,r){
    ctx.strokeStyle='#a06f4e'; ctx.lineWidth=r*0.22; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(0,-r); ctx.lineTo(0,r*0.35); ctx.stroke();
    ctx.fillStyle='#d9c49b';
    ctx.beginPath(); ctx.moveTo(-r*0.55,r*0.3); ctx.lineTo(r*0.55,r*0.3);
    ctx.lineTo(r*0.75,r*1.05); ctx.lineTo(-r*0.75,r*1.05); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#a06f4e'; dot(0,-r*0.72,r*0.46);
    derp(o,t,0,-r*0.70,r*0.22,r*0.25,true);
  },
  hoover(o,t,r){
    ctx.fillStyle=o.col; ctx.fillRect(-r*0.6,-r*0.5,r*1.2,r);
    ctx.fillStyle='#3b4470';
    ctx.beginPath(); ctx.moveTo(r*0.6,0); ctx.lineTo(r*1.5,-r*0.55);
    ctx.lineTo(r*1.5,r*0.55); ctx.closePath(); ctx.fill();
    ctx.fillStyle=ink; dot(-r*0.25,r*0.6,r*0.2); dot(r*0.3,r*0.6,r*0.2);
    derp(o,t,0,-r*0.14,r*0.22,r*0.28,true);
  }
};

/* ================= tides =================
   How hard the nearest hole is pulling on a point, 0 at the edge of its reach
   and 1 at the horizon. Used for drawing only: things get stretched along the
   line to the hole, which is what a tide actually does to you, and it is the
   clearest possible signal that something is being taken. */
function tidal(x,y){
  let best=null;
  for(const H of w.holes){
    const pull=H.rH*M.pullRange;
    const dx=H.x-x, dy=H.y-y, d=Math.hypot(dx,dy)||1;
    if(d<pull){
      const k=clamp(1-(d-H.rH)/Math.max(1,pull-H.rH),0,1);
      if(!best||k>best.k) best={ k, a:Math.atan2(dy,dx), d, H };
    }
  }
  return best;
}

/* ================= things ================= */
function drawItem(o,t){
  const r=o.r, x=o.x, y=o.y, dir=o.vx<0?-1:1;
  const s=tidal(x,y);
  const st=s?Math.pow(s.k,2.4):0;
  const con=st;
  ctx.save();
  ctx.translate(x,y);
  if(st>0.01){
    /* The thing CONDENSES on its way in. There is still a tidal stretch, so
       you can see which way it is being pulled, but the shrink runs on the
       same curve and beats it everywhere: the drawn size only ever goes DOWN
       from the moment the hole takes hold, to a tenth at the horizon. It
       never draws wider than the animal itself, against 4.6x last round -
       which is why a cow used to lie across the board and hide everything
       behind it. */
    const shrink=1-0.90*con;
    ctx.rotate(s.a);
    ctx.scale((1+st*0.85)*shrink, (1/(1+st*1.50))*shrink);
    ctx.rotate(-s.a);
    ctx.rotate(con*2.4*(s.H.spin||1));   /* and it tumbles as it goes */
    ctx.globalAlpha=1-0.50*con;
  }
  ctx.scale(dir,1);
  if(o.power) drawPower(o,t,r);
  else if(SHAPES[o.key]) SHAPES[o.key](o,t,r);
  else { ctx.fillStyle=o.col; dot(0,0,r); }
  ctx.restore();

  /* ONE ring, one meaning: this will cost you a life if you touch it. It goes
     on hazards you have not outgrown AND on food that is simply too big,
     because biting something bigger than your head is now exactly as bad as
     being stung. It fades out as a thing is dragged in, because by then it is
     no longer a decision you get to make. */
  if(!o.power && isThreat(o) && con<0.6){
    const p=0.5+0.5*Math.sin(t*7+o.seed);
    ctx.strokeStyle=`rgba(255,90,90,${(0.5+0.35*p)*(1-con/0.6)})`; ctx.lineWidth=2.4*w.S;
    ctx.beginPath();
    for(let i=0;i<=10;i++){
      const a=(i/10)*TAU+t*0.8, rr=r*(i%2?1.55:1.24)*(1-0.7*con);
      const px=x+Math.cos(a)*rr, py=y+Math.sin(a)*rr;
      i?ctx.lineTo(px,py):ctx.moveTo(px,py);
    }
    ctx.closePath(); ctx.stroke();
  }
}

/* A capsule with a glyph, glowing, and never wearing a threat ring. */
function drawPower(o,t,r){
  const pu=0.5+0.5*Math.sin(t*5+o.seed);
  ctx.shadowColor=o.col; ctx.shadowBlur=(10+8*pu)*w.S;
  ctx.fillStyle=o.col; dot(0,0,r);
  ctx.shadowBlur=0;
  ctx.fillStyle='#0a0d18';
  const K=o.key;
  if(K==='heart'){
    ctx.beginPath();
    ctx.moveTo(0,r*0.52);
    ctx.bezierCurveTo(-r*0.95,-r*0.10,-r*0.42,-r*0.78,0,-r*0.26);
    ctx.bezierCurveTo(r*0.42,-r*0.78,r*0.95,-r*0.10,0,r*0.52);
    ctx.fill();
  } else if(K==='shield'){
    ctx.beginPath();
    ctx.moveTo(0,-r*0.62); ctx.lineTo(r*0.5,-r*0.34); ctx.lineTo(r*0.5,r*0.16);
    ctx.quadraticCurveTo(0,r*0.72,-r*0.5,r*0.16); ctx.lineTo(-r*0.5,-r*0.34);
    ctx.closePath(); ctx.fill();
  } else if(K==='whisk'){
    ctx.strokeStyle='#0a0d18'; ctx.lineWidth=r*0.13; ctx.lineCap='round';
    for(const sd of [-1,1]) for(const dy of [-0.22,0,0.22]){
      ctx.beginPath(); ctx.moveTo(sd*r*0.12,r*dy); ctx.lineTo(sd*r*0.72,r*(dy*1.5-0.05)); ctx.stroke(); }
  } else if(K==='nip'){
    for(const a of [0,2.1,4.2]) ell(Math.cos(a)*r*0.3,Math.sin(a)*r*0.3,r*0.34,r*0.17,a);
  } else if(K==='cream'){
    ctx.beginPath();
    ctx.moveTo(-r*0.42,-r*0.42); ctx.lineTo(r*0.42,-r*0.42);
    ctx.lineTo(r*0.22,r*0.52); ctx.lineTo(-r*0.22,r*0.52); ctx.closePath(); ctx.fill();
  } else {
    dot(0,0,r*0.44);
    ctx.strokeStyle=o.col; ctx.lineWidth=r*0.10;
    ctx.beginPath(); ctx.arc(0,0,r*0.24,0,4); ctx.stroke();
  }
}

/* The whole game in one function. Catnip suspends it for a few seconds, which
   is what makes catnip worth having. */
function isThreat(o){
  if(o.power) return false;
  if(w.fx.nip>0) return false;
  if(o.nasty) return !M.edible(o);
  return o.r > w.cat.r*0.97;
}

/* ================= spawning =================
   Convoys, not confetti: a lane fires a RUN of the same thing, evenly spaced.
   That is what makes a lane readable, and what makes the opening a buffet
   rather than a scavenger hunt. MAX_ITEMS is the ceiling that stops the lanes
   piling up faster than anyone can eat. */
const MAX_ITEMS=30;
function spawnRun(L){
  const c=w.cat, p=w.phase;
  if(w.items.length>=MAX_ITEMS){ L.next=rand(0.8,1.6); return; }

  /* power-ups: uncommon, and never a decision - always safe to take */
  if(Math.random() < 0.085){
    const tot=POWERS.reduce((a,P)=>a+P.weight,0);
    let roll=Math.random()*tot, P=POWERS[0];
    for(const q of POWERS){ roll-=q.weight; if(roll<=0){ P=q; break; } }
    addItem(L,P,false,1,true);
    L.next=rand(1.6,3.0);
    return;
  }

  /* Hazards. Nudged up this round: they start a shade earlier and top out at
     about a fifth more of the board than last time. */
  const nastyChance = clamp((p-0.13)*0.40,0,0.21);
  if(Math.random()<nastyChance){
    const opts=NASTIES.filter(n=>p>=n.from);
    if(opts.length){ addItem(L,pick(opts),true,1); L.next=rand(2.0,3.4); return; }
  }

  const ceiling=c.r*(1.35+1.6*p);
  const opts=FOOD.filter(F=>F.r*w.S<=ceiling);
  const bias=Math.pow(Math.random(), 1+2.4*(1-p));
  const F=opts.length?opts[Math.min(opts.length-1,Math.floor(bias*opts.length))]:FOOD[0];
  const n=F.r<=7 ? Math.round(rand(2,4)) : F.r<=13 ? Math.round(rand(1,3)) : 1;
  addItem(L,F,false,n);
  L.next=rand(1.6,3.0)*(1-0.30*p);
}
function addItem(L,T,nasty,count,power){
  const r=T.r*w.S, gap=r*3.4+26*w.S;
  for(let k=0;k<count;k++){
    const off=(L.dir>0?-1:1)*(k*gap);
    w.items.push({
      key:T.key, col:T.col, r, nasty:!!nasty, power:!!power, label:T.label,
      tier:T.tier||0, pts:T.pts||0, kg:T.kg||0.05,
      move:T.move||'line', seed:Math.random()*9,
      derp:Math.floor(Math.random()*3),
      x:(L.dir>0? -r-20*w.S : w.W+r+20*w.S)+off,
      y:L.y+rand(-L.h*0.20,L.h*0.20),
      vx:L.dir*L.speed, vy:0, lane:L.i
    });
  }
}

/* ================= simulation ================= */
function step(dt){
  const c=w.cat;
  w.t+=dt;
  /* The two set pieces own the clock while they run: no control, no spawning,
     nothing else on the board moves. */
  if(w.nova){ stepNova(dt); return; }
  if(w.suck){ stepSuck(dt); return; }

  w.peakKg=Math.max(w.peakKg,c.kg);
  c.chew=Math.max(0,c.chew-dt*2.6);
  c.hurt=Math.max(0,c.hurt-dt*1.4);
  c.inv=Math.max(0,c.inv-dt);
  w.locate=Math.max(0,w.locate-dt);
  /* Difficulty is partly the clock and partly how big you already are, so a
     good player meets the wasps sooner instead of outrunning the schedule. */
  w.phase=clamp(w.t/120 + grown(c)*0.50, 0, 1);
  for(const k of ['whisk','nip','slow']) if(w.fx[k]>0) w.fx[k]-=dt;

  /* facing, with a deadband so a drifting stop does not spin him round */
  if(Math.abs(c.vx)>40*w.S) c.face=c.vx<0?-1:1;

  /* ---- control: direct. A target, a top speed, and enough acceleration to
     be there in a few frames. Nothing about this is springy. A full-grown cat
     is still slower than a kitten, but only by a third. ---- */
  const f=grown(c), top=(620-210*f)*w.S;
  let ax=0, ay=0;
  if(w.keys.left) ax-=1; if(w.keys.right) ax+=1;
  if(w.keys.up) ay-=1; if(w.keys.down) ay+=1;
  if(ax||ay){
    const m=Math.hypot(ax,ay)||1;
    c.vx += (ax/m*top - c.vx)*Math.min(1,dt*14);
    c.vy += (ay/m*top - c.vy)*Math.min(1,dt*14);
  } else if(w.pointer&&w.held){
    const dx=w.pointer.x-c.x, dy=w.pointer.y-c.y, d=Math.hypot(dx,dy);
    if(d>1){
      const want=Math.min(d/dt, top);
      c.vx += (dx/d*want - c.vx)*Math.min(1,dt*16);
      c.vy += (dy/d*want - c.vy)*Math.min(1,dt*16);
    } else { c.vx*=0.6; c.vy*=0.6; }
  } else { c.vx*=Math.pow(0.02,dt); c.vy*=Math.pow(0.02,dt); }
  c.x=clamp(c.x+c.vx*dt, c.r, w.W-c.r);
  c.y=clamp(c.y+c.vy*dt, c.r, w.H-c.r);

  for(const L of w.lanes){ L.next-=dt; if(L.next<=0) spawnRun(L); }

  for(const o of w.items.slice()){
    if(o.move==='home'){
      /* Quicker than last round, but still slower than the cat: a wasp should
         make you move, not make you lose. */
      const dx=c.x-o.x, dy=c.y-o.y, d=Math.hypot(dx,dy)||1;
      const sp=(o.key==='wasp'?102:76)*w.S*(w.fx.slow>0?0.42:1);
      o.vx+=((dx/d)*sp-o.vx)*dt*1.7;
      o.vy+=((dy/d)*sp-o.vy)*dt*1.7;
    } else if(o.move==='rush'){ o.vx*=1+dt*0.62; }
    else if(o.move==='sweep'){ o.vy=Math.sin(w.t*2.2+o.seed)*180*w.S; }
    const slow=w.fx.slow>0?0.42:1;
    o.x+=o.vx*dt*slow; o.y+=o.vy*dt*slow;
    o.y=clamp(o.y,o.r,w.H-o.r);
    if(o.x<-o.r*4-40*w.S||o.x>w.W+o.r*4+40*w.S){ w.items=w.items.filter(x=>x!==o); continue; }

    const d=Math.hypot(o.x-c.x,o.y-c.y), touch=c.r+o.r*0.86+reachBonus();
    if(d<touch){
      if(o.power) takePower(o);
      else if(isThreat(o)){ if(c.inv<=0) hitBy(o); }
      else eat(o);
    }
  }

  stepHoles(dt);
  ageFx(dt,true);
  w.shake*=Math.pow(0.02,dt);
  hud();
}

/* bits, strands and toasts all age the same way wherever we are */
function ageFx(dt,gravity){
  for(const b of w.bits){ b.age+=dt; b.x+=b.vx*dt; b.y+=b.vy*dt; if(gravity) b.vy+=420*w.S*dt; }
  w.bits=w.bits.filter(b=>b.age<b.life);
  for(const s of w.strands) s.age+=dt;
  w.strands=w.strands.filter(s=>s.age<s.life);
  for(const t of w.toasts) t.age+=dt;
  w.toasts=w.toasts.filter(t=>t.age<t.life);
}

/* ---- the holes ----
   They pull everything, including you. Inside the event horizon there is no
   argument and no life left to spend. */
function stepHoles(dt){
  const c=w.cat;
  for(const H of w.holes){
    const pull=H.rH*M.pullRange;
    for(const o of w.items.slice()){
      const dx=H.x-o.x, dy=H.y-o.y, d=Math.hypot(dx,dy)||1;
      if(d<pull){
        const g=M.pullForce*w.S*(1-d/pull)*(1-d/pull);
        o.vx+=(dx/d)*g*dt; o.vy+=(dy/d)*g*dt;
        /* and then bend the whole velocity sideways, so it arrives on a spiral */
        const th=SWIRL*(1-d/pull)*(1-d/pull)*(H.spin||1)*dt;
        const cs=Math.cos(th), sn=Math.sin(th);
        const nvx=o.vx*cs-o.vy*sn; o.vy=o.vx*sn+o.vy*cs; o.vx=nvx;
      }
      if(d<H.rH){
        w.items=w.items.filter(x=>x!==o);
        /* it leaves a strand behind on the way through */
        w.strands.push({ H, a:Math.atan2(o.y-H.y,o.x-H.x), r0:Math.max(d,H.rH*1.2)+o.r*2.4,
          col:o.col, age:0, life:0.55 });
        burst(H.x,H.y,o.col,4);
        H.eaten++;
        /* It fattens on what it swallows: about a third of a pixel a
           mouthful plus a little for the weight of it, capped at a quarter
           of the board. Slow enough that a run has time to be a run. */
        H.rH=Math.min(Math.min(w.W,w.H)*0.24,
                      H.rH+(0.34+Math.min(0.72,(o.kg||0)*0.024))*w.S);
      }
    }
    const dx=H.x-c.x, dy=H.y-c.y, d=Math.hypot(dx,dy)||1;
    if(d<pull){
      const g=M.pullForce*w.S*(1-d/pull)*(1-d/pull)*M.catPull;
      c.vx+=(dx/d)*g*dt; c.vy+=(dy/d)*g*dt;
    }
    if(d<H.rH+c.r*0.25){ return startSuck(H); }
  }
}

function eat(o){
  w.items=w.items.filter(x=>x!==o);
  w.cat.chew=1; w.eaten++; w.score+=o.pts||10;
  feed((o.kg||0.05)*M.appetite);
  burst(o.x,o.y,o.col,9);
}
function takePower(o){
  w.items=w.items.filter(x=>x!==o);
  w.score+=60; burst(o.x,o.y,o.col,16);
  toast(o.label,o.col);
  switch(o.key){
    case 'heart':  w.lives=Math.min(9,w.lives+1); break;
    case 'shield': w.fx.shield=true; break;
    case 'whisk':  w.fx.whisk=10; break;
    case 'cream':  feed(Math.max(1.5,w.cat.kg*0.06)); break;
    case 'nip':    w.fx.nip=Math.max(w.fx.nip,5); break;
    case 'yarn':   w.fx.slow=Math.max(w.fx.slow,6); break;
  }
}
function hitBy(o){
  const c=w.cat;
  /* A shield eats the hit instead of you. */
  if(w.fx.shield){
    w.fx.shield=false; c.inv=1.4; w.shake=10;
    burst(c.x,c.y,'#7dd8ff',20); toast('SHIELD HELD','#7dd8ff');
    const a0=Math.atan2(c.y-o.y,c.x-o.x);
    c.vx=Math.cos(a0)*380*w.S; c.vy=Math.sin(a0)*380*w.S;
    return;
  }
  c.hurt=1; c.inv=1.5; w.shake=14; w.lives--;
  burst(c.x,c.y,'#ff5a5a',18);
  toast((o.nasty?o.key.toUpperCase()+'!':'TOO BIG!')+'  -1 LIFE','#ff9d9d');
  const a=Math.atan2(c.y-o.y,c.x-o.x);
  c.vx=Math.cos(a)*420*w.S; c.vy=Math.sin(a)*420*w.S;
  if(w.lives<=0) finish(false);
}
function feed(kg){
  const c=w.cat;
  c.kg+=kg;
  c.r=radiusFor(c.kg);
  /* Recorded here rather than only in step(), because the frame he goes
     critical on returns early and would otherwise never bank the peak. */
  w.peakKg=Math.max(w.peakKg,c.kg);
  if(c.kg>=KG_NOVA && !w.nova) startNova();
}
function burst(x,y,col,n){
  for(let i=0;i<n;i++){
    const a=rand(0,TAU), sp=rand(50,220)*w.S;
    w.bits.push({ x,y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, age:0, life:rand(0.2,0.5), col });
  }
}
function toast(text,col){ w.toasts.push({ text, col:col||'#eef0fb', age:0, life:1.5 }); }

/* ================= the collapse =================
   Round four ran this in two seconds and mostly as a white flash, and the note
   was that you could not tell what had happened to you. It is five stages and
   three and a half seconds now, each one captioned while it plays:

     STRAIN     he swells, glows and shakes, and the board dims around him
     IMPLODE    he is crushed to a point
     FLASH      one frame of white
     BLAST      the shockwave, and he comes apart into debris
     FALL       the debris is hauled back in, and the hole is left behind

   Nothing else on the board moves for any of it. */
const NV={ strain:0.85, imp:1.20, flash:1.34, blast:2.30, fall:3.35, end:3.70 };

function startNova(){
  const c=w.cat;
  w.nova={ x:c.x, y:c.y, age:0, r0:c.r, B:c.B, deb:null };
  w.shake=26;
  hud();
}
function stepNova(dt){
  const n=w.nova; n.age+=dt;
  const a=n.age;
  w.shake = a<NV.imp ? 10+22*(a/NV.imp)
          : a<NV.flash ? 4
          : a<NV.blast ? 26*(1-(a-NV.flash)/(NV.blast-NV.flash))
          : 3;
  if(a>=NV.flash && !n.deb){
    n.deb=[];
    for(let i=0;i<64;i++){
      n.deb.push({ a:rand(0,TAU), r:n.r0*rand(0.1,0.5), vr:rand(240,760)*w.S,
        spin:rand(-1.2,1.2), col:i%3?n.B.fur:'#ffd88a', sz:rand(2,5)*w.S });
    }
  }
  if(n.deb){
    for(const p of n.deb){
      if(a<NV.blast){ p.r+=p.vr*dt; p.a+=p.spin*dt*0.4; }
      else { p.r+=(0-p.r)*Math.min(1,dt*2.6); p.a+=4.2*dt; }
    }
  }
  if(a>NV.end) finishNova();
  ageFx(dt,false);
}
function finishNova(){
  const n=w.nova;
  w.holes.push({ x:n.x, y:n.y, rH:M.holeR*w.S, eaten:0, seed:Math.random()*9,
    spin:Math.random()<0.5?-1:1 });
  w.cycle++;
  w.score+=2500*w.cycle;
  w.nova=null;
  /* Restart small, and as far from the new hole as the room allows. */
  const fx = n.x < w.W/2 ? w.W*0.82 : w.W*0.18;
  const fy = n.y < w.H/2 ? w.H*0.78 : w.H*0.22;
  w.cat=makeCat(fx,fy);
  w.cat.inv=2.4;
  w.fx={ shield:false, whisk:0, nip:0, slow:0 };
  w.items=[];
  for(const L of w.lanes) L.next=rand(0.3,1.6);
  /* And then it WAITS. He is a kitten again, in a corner, on a board that has
     changed shape - dropping you straight back into a moving room is how you
     lose him. Nothing moves until you say so. */
  w.armed=false;
}

/* ================= going in =================
   If the cat crosses a horizon he does not simply vanish: he is stretched into
   a noodle, wound twice around the hole, and posted through it. */
const SK={ grab:0.45, spiral:1.55, gone:1.90, end:2.15 };
function startSuck(H){
  if(w.suck) return;
  const c=w.cat;
  const dx=c.x-H.x, dy=c.y-H.y;
  w.suck={ H, age:0, a0:Math.atan2(dy,dx),
    r0:Math.max(Math.hypot(dx,dy), H.rH*1.5), popped:false };
  w.shake=24; w.lives=0;
  toast('OH NO','#b48bff');
}
function stepSuck(dt){
  const s=w.suck; s.age+=dt;
  w.shake=Math.max(0, 18*(1-s.age/SK.gone));
  if(s.age>=SK.gone && !s.popped){
    s.popped=true; w.shake=20;
    burst(s.H.x,s.H.y,w.cat.B.fur,34);
  }
  if(s.age>SK.end){ w.suck=null; finish(false,'past the event horizon'); return; }
  ageFx(dt,false);
}
function drawSuck(t){
  const s=w.suck, H=s.H;
  const k=clamp(s.age/SK.gone,0,1);
  if(k>=1) return;
  const a=s.a0 + Math.pow(k,1.5)*11.0;
  const r=s.r0*Math.pow(1-k,0.9) + H.rH*0.85;
  const x=H.x+Math.cos(a)*r, y=H.y+Math.sin(a)*r;
  /* No stretch at all for the first third of a second: he is held, wide-eyed
     and flailing, and you get to see it. Then the tide takes him. */
  const st=Math.pow(clamp((k-0.18)/0.82,0,1),1.7);
  /* Measured: at 8.5x he was 620px long on a 432px board, i.e. off both ends.
     5.5x with a harder shrink keeps the whole noodle on screen. */
  const sx=(1+st*5.5)*(1-0.55*k), sy=(1/(1+st*5.5))*(1-0.55*k);
  ctx.save();
  ctx.translate(x,y);
  ctx.rotate(a);
  ctx.scale(sx,sy);
  /* +x is away from the hole here, so pushing him out by half the length he
     just gained keeps his leading end at the horizon instead of straddling it */
  ctx.translate(w.cat.r*(sx-1)*0.34/sx, 0);
  ctx.rotate(-a);
  ctx.globalAlpha=1-0.25*k;
  drawCatAt(w.cat,t,clamp(k*3.0,0,1));
  ctx.restore();
  /* the trail he is being drawn out into */
  ctx.strokeStyle=`rgba(180,139,255,${0.5*(1-k)})`;
  ctx.lineWidth=w.cat.r*0.5*(1-k)+2*w.S;
  ctx.beginPath();
  for(let i=0;i<=22;i++){
    const kk=k+(i/22)*0.55*(1-k);
    const aa=s.a0+Math.pow(clamp(kk,0,1),1.5)*11.0;
    const rr=s.r0*Math.pow(clamp(1-kk,0,1),1.5)+H.rH*0.2;
    const px=H.x+Math.cos(aa)*rr, py=H.y+Math.sin(aa)*rr;
    i?ctx.lineTo(px,py):ctx.moveTo(px,py);
  }
  ctx.stroke();
}

/* ================= the two prototypes ================= */
/* The one set of numbers the game is played with. It was two prototypes -
   a hole that sits there for ever, and a hole that eats - and this is the
   one that got picked. */
const M={
  appetite:1.15,        // B ate 15% faster to pay for the board closing in
  holeR:20,             // a new hole, in S units
  pullRange:6.2,        // how far its reach goes, as a multiple of that
  pullForce:210,
  catPull:1.15,         // it pulls him harder than it pulls the furniture
  edible(o){ return w.cat.r > o.r*1.30; }
};


/* ================= flow ================= */
function newGame(){
  resize();
  w.cat=makeCat(); w.items=[]; w.bits=[]; w.strands=[]; w.toasts=[];
  w.score=0; w.eaten=0; w.lives=9; w.phase=0; w.t=0;
  w.tier=0; w.meter=0; w.won=false; w.over=false;
  w.fx={ shield:false, whisk:0, nip:0, slow:0 };
  w.holes=[]; w.nova=null; w.suck=null; w.cycle=0; w.peakKg=KG0;
  /* open the buffet: several lanes already loaded before the first frame */
  for(const L of w.lanes) L.next=rand(0,0.4);
  for(let i=0;i<3;i++) spawnRun(w.lanes[i*3%LANES]);
  w.running=true; w.armed=true; w.locate=1.6;
  $('overlay').hidden=true;
  $('ov-final').hidden=true; $('entry').hidden=true;
  boardUI.closePeek();
  hud(); cv.focus({preventScroll:true});
}
function finish(won,how){
  w.running=false; w.over=true; w.won=won;
  const cyc=w.cycle;
  $('ov-title').textContent = how==='past the event horizon' ? 'Gone'
    : cyc>0 ? cyc+' collapse'+(cyc>1?'s':'') : 'All nine used up';
  $('ov-body').textContent = (how==='past the event horizon'
    ? 'He crossed his own event horizon. '
    : 'Nine lives, all spent. ')
    + 'Heaviest he got: ' + weightLabel(w.peakKg) + ', over ' + w.eaten + ' mouthfuls'
    + (cyc>0 ? ', and he left ' + cyc + ' black hole' + (cyc>1?'s':'') + ' behind.' : '.');
  $('final-score').textContent=w.score;
  $('ov-final').hidden=false;
  $('go').textContent='Again';
  $('go').onclick=newGame;
  $('overlay').hidden=false;
  boardUI.finish();
}
function hud(){
  const c=w.cat; if(!c) return;
  const f=grown(c);
  $('score').textContent=w.score;
  $('eaten').textContent=w.eaten;
  $('lives').textContent=w.lives;
  $('weight').textContent=weightLabel(c.kg);
  $('grow-fill').style.width=(f*100).toFixed(1)+'%';
  const crit = f>=KG_WARN && !w.nova;
  $('grow-fill').classList.toggle('crit',crit);
  $('zone').classList.toggle('crit',crit);
  $('zone').textContent = crit ? 'CRITICAL MASS IMMINENT'
    : w.holes.length
      ? (w.holes.length+' black hole'+(w.holes.length>1?'s':'')+' - cycle '+(w.cycle+1))
      : (w.phase<0.14?'Nothing to fear yet'
        : w.phase<0.34?'Something is buzzing'
        : w.phase<0.60?'Getting busy'
        : w.phase<0.85?'Genuinely dangerous':'Heavy going');
}

/* ================= input ================= */
function atCanvas(e){
  const r=cv.getBoundingClientRect();
  return { x:clamp(e.clientX-r.left,0,w.W), y:clamp(e.clientY-r.top,0,w.H) };
}
/* Any input at all releases the hold after a collapse. */
function arm(){ if(w.running&&!w.armed){ w.armed=true; w.locate=1.0; } }
cv.addEventListener('pointerdown',e=>{
  if(!w.running) return;
  e.preventDefault();
  try{ cv.setPointerCapture?.(e.pointerId); }catch{}
  arm();
  w.pointer=atCanvas(e); w.held=true;
});
cv.addEventListener('pointermove',e=>{
  if(!w.running||!w.held) return;
  e.preventDefault(); w.pointer=atCanvas(e);
});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])
  cv.addEventListener(ev,()=>{ w.held=false; });
function keyOf(e){
  switch(e.key){
    case 'ArrowLeft': case 'a': case 'A': return 'left';
    case 'ArrowRight': case 'd': case 'D': return 'right';
    case 'ArrowUp': case 'w': case 'W': return 'up';
    case 'ArrowDown': case 's': case 'S': return 'down';
  }
  return null;
}
addEventListener('keydown',e=>{
  const k=keyOf(e);
  if(k){ w.keys[k]=true; arm(); if(w.running) e.preventDefault(); }
  else if(e.key===' '&&w.running&&!w.armed){ arm(); e.preventDefault(); }
});
addEventListener('keyup',  e=>{ const k=keyOf(e); if(k) w.keys[k]=false; });

/* ================= loop ================= */
const FIXED=1/60, MAX_STEPS=4;
let last=performance.now(), acc=0;
function frame(now){
  const dt=clamp((now-last)/1000,0,0.25); last=now;
  /* The set pieces keep stepping while they play; the post-collapse hold does
     not, which is what makes the board actually stand still. */
  const live = w.running && (w.armed || !!w.nova || !!w.suck);
  acc = live ? Math.min(acc+dt,FIXED*MAX_STEPS) : 0;
  while(acc>=FIXED && live){ acc-=FIXED; step(FIXED); }
  const t=now/1000;
  ctx.save();
  if(w.shake>0.4) ctx.translate(rand(-w.shake,w.shake),rand(-w.shake,w.shake));
  const g=ctx.createLinearGradient(0,0,0,w.H);
  g.addColorStop(0,'#12162c'); g.addColorStop(1,'#1b2040');
  ctx.fillStyle=g; ctx.fillRect(-60,-60,w.W+120,w.H+120);
  ctx.strokeStyle='rgba(168,173,207,.07)'; ctx.lineWidth=1;
  for(const L of w.lanes){
    ctx.beginPath(); ctx.moveTo(0,L.y+L.h/2); ctx.lineTo(w.W,L.y+L.h/2); ctx.stroke();
  }
  drawHoles(t);
  drawStrands();
  if(w.cat){
    for(const o of w.items) drawItem(o,t);
    if(!w.nova&&!w.suck) drawCat(w.cat,t);
  }
  if(w.suck) drawSuck(t);
  if(w.nova) drawNova(t);
  for(const b of w.bits){
    ctx.globalAlpha=Math.max(0,1-b.age/b.life);
    ctx.fillStyle=b.col; ctx.fillRect(b.x-2*w.S,b.y-2*w.S,4*w.S,4*w.S);
  }
  ctx.globalAlpha=1;
  if(w.running&&!w.nova&&!w.suck&&w.cat) drawWarning(t);
  w.toasts.forEach((tt,i)=>{
    const k=tt.age/tt.life;
    ctx.globalAlpha=Math.max(0,1-k*k);
    ctx.fillStyle=tt.col;
    ctx.font=`700 ${16*w.S}px "Space Grotesk", system-ui, sans-serif`;
    ctx.textAlign='center';
    ctx.fillText(tt.text,w.W/2,w.H*0.14-k*24*w.S-i*19*w.S);
  });
  /* the shield, worn */
  if(w.cat&&w.fx.shield&&!w.nova&&!w.suck){
    ctx.strokeStyle=`rgba(125,216,255,${0.5+0.3*Math.sin(t*6)})`; ctx.lineWidth=2.6*w.S;
    ctx.beginPath(); ctx.arc(w.cat.x,w.cat.y,w.cat.r*1.55,0,TAU); ctx.stroke();
  }
  /* what is currently running, top left, so it is never a mystery */
  const active=[];
  if(w.fx.shield) active.push(['SHIELD','#7dd8ff']);
  if(w.fx.nip>0) active.push(['CATNIP '+Math.ceil(w.fx.nip)+'s','#b48bff']);
  if(w.fx.whisk>0) active.push(['WHISKERS '+Math.ceil(w.fx.whisk)+'s','#8fe3b0']);
  if(w.fx.slow>0) active.push(['SLOW '+Math.ceil(w.fx.slow)+'s','#ff9d9d']);
  ctx.textAlign='left';
  ctx.font=`700 ${10*w.S}px "Space Grotesk", system-ui, sans-serif`;
  active.forEach((a,i)=>{ ctx.fillStyle=a[1]; ctx.fillText(a[0],10*w.S,(16+13*i)*w.S); });
  ctx.textAlign='center';
  ctx.globalAlpha=1;
  const quiet=!w.nova&&!w.suck;
  if(w.running&&!w.armed&&quiet) drawHold(t);
  else if(w.locate>0&&w.cat&&quiet) drawLocator(t,clamp(w.locate,0,1));
  if(w.running&&w.armed&&quiet&&w.t<6&&!w.holes.length){
    ctx.fillStyle='rgba(205,212,245,.6)';
    ctx.font=`${13*w.S}px "Sora", system-ui, sans-serif`;
    ctx.fillText('drag, or use the arrow keys - eat anything, avoid the red spikes',w.W/2,w.H-12*w.S);
  }
  ctx.restore();
  requestAnimationFrame(frame);
}

/* ---- drawing the holes ----
   A black disc, a bright rim where things are being torn apart on the way in,
   and a wide faint well showing how far the pull reaches - because a hazard
   whose range you cannot see is just an unfair one. */
function drawHoles(t){
  for(const H of w.holes){
    const pull=H.rH*M.pullRange;
    const g=ctx.createRadialGradient(H.x,H.y,H.rH*0.9,H.x,H.y,pull);
    g.addColorStop(0,'rgba(180,139,255,.16)');
    g.addColorStop(0.45,'rgba(125,216,255,.05)');
    g.addColorStop(1,'rgba(10,13,24,0)');
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.arc(H.x,H.y,pull,0,TAU); ctx.fill();
    for(let i=0;i<3;i++){
      const rr=H.rH*(1.30+i*0.24), sp=t*(1.7-i*0.35)+H.seed;
      ctx.strokeStyle=`rgba(${i?125:255},${i?216:216},${i?255:138},${0.5-i*0.13})`;
      ctx.lineWidth=(3.2-i*0.7)*w.S;
      ctx.beginPath();
      ctx.ellipse(H.x,H.y,rr,rr*0.42,sp*0.35,sp%TAU,sp%TAU+2.4);
      ctx.stroke();
    }
    ctx.fillStyle='#05060d';
    ctx.beginPath(); ctx.arc(H.x,H.y,H.rH,0,TAU); ctx.fill();
    ctx.strokeStyle='rgba(255,216,138,.85)'; ctx.lineWidth=2*w.S;
    ctx.beginPath(); ctx.arc(H.x,H.y,H.rH,0,TAU); ctx.stroke();
  }
}
/* What a thing leaves behind on its way through: a tapering spiral, the last
   of it being wound in. */
function drawStrands(){
  for(const s of w.strands){
    const k=s.age/s.life, H=s.H;
    ctx.strokeStyle=s.col;
    ctx.globalAlpha=0.55*(1-k);
    ctx.lineWidth=3.2*w.S*(1-k);
    ctx.lineCap='round';
    ctx.beginPath();
    for(let i=0;i<=14;i++){
      const f=i/14;
      const rr=(H.rH*0.2)+(s.r0-H.rH*0.2)*f*(1-k);
      const aa=s.a+f*2.0+k*2.4;
      const px=H.x+Math.cos(aa)*rr, py=H.y+Math.sin(aa)*rr;
      i?ctx.lineTo(px,py):ctx.moveTo(px,py);
    }
    ctx.stroke();
  }
  ctx.globalAlpha=1;
}

/* ---- the warning ----
   You should never be surprised by your own supernova. Past 87% he glows, the
   board gains a hot rim, and it says so in words. */
function drawWarning(t){
  const f=grown(w.cat);
  if(f<KG_WARN) return;
  const k=clamp((f-KG_WARN)/(1-KG_WARN),0,1), pulse=0.5+0.5*Math.sin(t*7);
  const g=ctx.createRadialGradient(w.W/2,w.H/2,w.H*0.30,w.W/2,w.H/2,w.H*0.80);
  g.addColorStop(0,'rgba(255,216,138,0)');
  g.addColorStop(1,`rgba(255,157,90,${0.10+0.24*k*pulse})`);
  ctx.fillStyle=g; ctx.fillRect(0,0,w.W,w.H);
  ctx.textAlign='center';
  ctx.fillStyle=`rgba(255,216,138,${0.45+0.5*pulse})`;
  ctx.font=`700 ${12*w.S}px "Space Grotesk", system-ui, sans-serif`;
  ctx.fillText('CRITICAL MASS IMMINENT',w.W/2,w.H*0.07);
}

/* ---- the hold after a collapse ----
   The board is frozen and dimmed, and the game points at him until you are
   ready. This exists because a fresh kitten in a far corner of a rearranged
   room is genuinely hard to find. */
function drawHold(t){
  ctx.fillStyle='rgba(10,13,24,.55)'; ctx.fillRect(0,0,w.W,w.H);
  const c=w.cat;
  if(c){
    drawCat(c,t);
    drawLocator(t,1);
    ctx.textAlign='center';
    ctx.fillStyle='#ffd88a';
    ctx.font=`700 ${11*w.S}px "Space Grotesk", system-ui, sans-serif`;
    ctx.fillText('HE IS HERE',c.x,c.y-c.r*4.6);
  }
  ctx.textAlign='center';
  ctx.fillStyle='#eef0fb';
  ctx.font=`700 ${19*w.S}px "Space Grotesk", system-ui, sans-serif`;
  ctx.fillText('CYCLE '+(w.cycle+1),w.W/2,w.H*0.30);
  ctx.fillStyle='#a8adcf';
  ctx.font=`${13*w.S}px "Sora", system-ui, sans-serif`;
  ctx.fillText('The board is holding still. Click, or press a key, when you have found him.',
    w.W/2,w.H*0.30+22*w.S);
}
/* Three rings closing on the cat, plus a marker above him. */
function drawLocator(t,alpha){
  const c=w.cat; if(!c) return;
  const p=(t*1.05)%1;
  for(let i=0;i<3;i++){
    const k=(p+i/3)%1, rr=c.r*(1.2+4.0*(1-k));
    ctx.strokeStyle=`rgba(255,216,138,${0.70*k*alpha})`;
    ctx.lineWidth=2.4*w.S;
    ctx.beginPath(); ctx.arc(c.x,c.y,rr,0,TAU); ctx.stroke();
  }
  ctx.fillStyle=`rgba(255,216,138,${alpha})`;
  const bob=Math.sin(t*4)*3*w.S, ty=c.y-c.r*2.4+bob;
  ctx.beginPath();
  ctx.moveTo(c.x,ty+7*w.S); ctx.lineTo(c.x-7*w.S,ty-6*w.S); ctx.lineTo(c.x+7*w.S,ty-6*w.S);
  ctx.closePath(); ctx.fill();
}

/* ---- drawing the collapse ---- */
function caption(big,small,col,alpha){
  if(alpha<=0.01) return;
  ctx.textAlign='center';
  ctx.globalAlpha=clamp(alpha,0,1);
  ctx.fillStyle=col;
  ctx.font=`700 ${Math.min(34,26*w.S)}px "Space Grotesk", system-ui, sans-serif`;
  ctx.fillText(big,w.W/2,w.H*0.24);
  if(small){
    ctx.fillStyle='rgba(238,240,251,.72)';
    ctx.font=`${13*w.S}px "Sora", system-ui, sans-serif`;
    ctx.fillText(small,w.W/2,w.H*0.24+22*w.S);
  }
  ctx.globalAlpha=1;
}
function drawNova(t){
  const n=w.nova, a=n.age, cx=n.x, cy=n.y, hR=M.holeR*w.S;

  /* the board goes quiet and dark around him for the whole thing */
  ctx.fillStyle=`rgba(10,13,24,${0.62*clamp(a/NV.strain,0,1)})`;
  ctx.fillRect(0,0,w.W,w.H);

  if(a<NV.flash){
    /* STRAIN, then IMPLODE. He swells, whitens and shakes; then he is crushed
       to a point in a sixth of a second. */
    const swell = a<NV.strain ? a/NV.strain : 1;
    const crush = a<NV.strain ? 0 : (a-NV.strain)/(NV.flash-NV.strain);
    const sc = (1+0.55*swell*swell)*(1-0.94*crush*crush);
    const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,n.r0*(2.2+2.5*swell));
    glow.addColorStop(0,`rgba(255,240,190,${0.30+0.45*swell})`);
    glow.addColorStop(1,'rgba(255,216,138,0)');
    ctx.fillStyle=glow;
    ctx.beginPath(); ctx.arc(cx,cy,n.r0*(2.2+2.5*swell),0,TAU); ctx.fill();
    ctx.save();
    ctx.translate(cx+Math.sin(t*61)*n.r0*0.05*swell, cy+Math.cos(t*57)*n.r0*0.05*swell);
    ctx.scale(sc,sc);
    drawCatAt(w.cat,t,clamp(swell*1.4,0,1));
    ctx.fillStyle=`rgba(255,255,255,${0.62*swell*swell})`;
    ctx.beginPath(); ctx.arc(0,0,n.r0*1.02,0,TAU); ctx.fill();
    ctx.restore();
    /* the rim of light being squeezed out of him */
    if(crush>0){
      ctx.strokeStyle=`rgba(255,255,255,${crush})`; ctx.lineWidth=(2+9*crush)*w.S;
      ctx.beginPath(); ctx.arc(cx,cy,n.r0*sc*1.4+4*w.S,0,TAU); ctx.stroke();
    }
    caption('CRITICAL MASS','900 kg. He cannot hold himself together.','#ffd88a',
      clamp(a/0.25,0,1));
  } else {
    /* FLASH, BLAST, FALL. */
    const since=a-NV.flash;
    if(since<0.30){
      ctx.fillStyle=`rgba(255,255,255,${1-since/0.30})`;
      ctx.fillRect(0,0,w.W,w.H);
    }
    if(a<NV.blast){
      const k=since/(NV.blast-NV.flash);
      for(let i=0;i<3;i++){
        const kk=clamp(k-i*0.14,0,1); if(kk<=0) continue;
        ctx.strokeStyle=`rgba(${i?125:255},${i?216:236},${i?255:190},${(1-kk)*0.9})`;
        ctx.lineWidth=(18-13*kk)*w.S*(1-i*0.25);
        ctx.beginPath(); ctx.arc(cx,cy,n.r0*(0.8+11*kk),0,TAU); ctx.stroke();
      }
      caption('SUPERNOVA',null,'#ffffff',clamp(k*3,0,1)*clamp((1-k)*3,0,1));
    }
    /* the hole opening: black from the moment of the blast, settling to size */
    const fk=clamp((a-NV.blast)/(NV.fall-NV.blast),0,1);
    const rNow = a<NV.blast ? hR*0.35*clamp(since/0.4,0,1) : hR*(0.35+0.65*fk);
    ctx.fillStyle='#05060d';
    ctx.beginPath(); ctx.arc(cx,cy,rNow,0,TAU); ctx.fill();
    ctx.strokeStyle=`rgba(255,216,138,${0.35+0.5*fk})`; ctx.lineWidth=2*w.S;
    ctx.beginPath(); ctx.arc(cx,cy,rNow,0,TAU); ctx.stroke();

    /* the debris, drawn stretched along its own radius - flung out, then
       hauled back in */
    if(n.deb){
      for(const p of n.deb){
        const px=cx+Math.cos(p.a)*p.r, py=cy+Math.sin(p.a)*p.r;
        if(p.r<rNow*0.9) continue;
        const stretch=a<NV.blast ? p.sz*2.2 : p.sz*(2.2+9*fk);
        ctx.strokeStyle=p.col;
        ctx.globalAlpha=a<NV.blast?0.9:Math.max(0,0.9-0.5*fk);
        ctx.lineWidth=p.sz*(a<NV.blast?1:Math.max(0.35,1-fk*0.7));
        ctx.lineCap='round';
        ctx.beginPath();
        ctx.moveTo(px,py);
        ctx.lineTo(cx+Math.cos(p.a)*(p.r-stretch),cy+Math.sin(p.a)*(p.r-stretch));
        ctx.stroke();
      }
      ctx.globalAlpha=1;
    }
    if(a>=NV.blast){
      caption('A HOLE WHERE HE WAS','It stays there. Start again, and mind it.','#b48bff',
        clamp((a-NV.blast)/0.3,0,1));
    }
  }
}

/* ================= this game's board =================
   Mechanics live in js/leaderboard.js, shared with the other five; only the
   store id and the local key are per-game, which is what keeps the boards
   independent of one another. */
const Board = makeBoard({
  id: 'ff808181a061cdc401a065ceb1c70d29',
  localKey: 'chonk-board',
  storeName: 'schrodingerscards-chonk-highscores'
});
const boardUI = attachBoardUI(Board, () => w.score);

/* ================= wiring ================= */
/* The start screen. One mode, so this only ever resets it. */
function toStart(){
  w.running=false; w.over=false; w.armed=true; w.locate=0;
  $('ov-title').textContent='Chonk';
  $('ov-body').textContent='Eat your way up the food chain. Anything without red spikes is lunch; anything with them costs a life. Get to 900kg and see what happens.';
  $('ov-final').hidden=true; $('entry').hidden=true; $('board').hidden=true;
  $('go').textContent='Start';
  $('go').onclick=newGame;
  $('overlay').hidden=false;
  resize();
  w.cat=makeCat(); w.items=[]; w.bits=[]; w.strands=[]; w.toasts=[];
  w.score=0; w.eaten=0; w.lives=9;
  w.tier=0; w.meter=0; w.phase=0; w.t=0;
  w.fx={ shield:false, whisk:0, nip:0, slow:0 };
  w.holes=[]; w.nova=null; w.suck=null; w.cycle=0; w.peakKg=KG0;
  hud();
}

resize();
toStart();
requestAnimationFrame(frame);
