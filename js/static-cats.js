/* ================= Static Cats — three mockups =================
   Lives at static-cats.html. NOT a shipped game: this is three playable
   prototypes of the same idea sitting behind one picker, so the mechanics can
   be felt rather than argued about. Nothing here writes to a leaderboard and
   nothing is linked from the arcade.

   What all three share: the cats are the same cats. BREEDS and the renderer
   below are ported from js/catastrophe.js, including its `puff` parameter —
   the thing that spikes a cat's silhouette when it panics is exactly the thing
   a charged cat needs, so charge drives it directly.

   Where they differ is the whole point:

     A  Rub & Cling   charge anywhere, chase the balloons down
     B  Carpet & Earth  charge only on the rugs, and mind what you touch
     C  Static Field  charge is a magnet, and every balloon has a window

   Read the block above each mode for what it is trying to prove.
*/

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const TAU=Math.PI*2;

/* Same eight cats as Catastrophe, Fits and Hats. */
const BREEDS=[
  { key:'common',   fur:'#9aa3bd', mark:'#7c86a4', ear:'round', eye:'sleepy' },
  { key:'uncommon', fur:'#d9c49b', mark:'#b9a274', ear:'point', eye:'normal' },
  { key:'holo',     fur:'#7dd8ff', mark:'#4fb4e0', ear:'tall',  eye:'wide'   },
  { key:'ultra',    fur:'#b48bff', mark:'#8a63d6', ear:'point', eye:'huge'   },
  { key:'sir',      fur:'#ff8fd0', mark:'#e05fa8', ear:'tuft',  eye:'normal' },
  { key:'gold',     fur:'#ffd88a', mark:'#e0ac48', ear:'crown', eye:'derp'   },
  { key:'tabby',    fur:'#c98f6a', mark:'#a06f4e', ear:'point', eye:'normal' },
  { key:'ink',      fur:'#6b7397', mark:'#4c5479', ear:'tall',  eye:'wide'   }
];

/* Balloon tiers. The colour IS the requirement — there is no reading to do
   mid-game, you learn "gold is the expensive one" in about four seconds. */
const TIERS=[
  { need:0.00, col:'#ff8fd0', dark:'#e05fa8', name:'pink',   pts:10 },
  { need:0.30, col:'#7dd8ff', dark:'#4fb4e0', name:'blue',   pts:20 },
  { need:0.58, col:'#b48bff', dark:'#8a63d6', name:'purple', pts:35 },
  { need:0.82, col:'#ffd88a', dark:'#e0ac48', name:'gold',   pts:60 }
];

/* Power-ups ride inside a balloon and announce themselves on collection.
   Silly on purpose — the ask was for silly things to happen. */
const POWERS=[
  { key:'time',  label:'+5 SECONDS',  col:'#8fe3b0' },
  { key:'full',  label:'FULL CHARGE', col:'#ffd88a' },
  { key:'slow',  label:'SLOW DRIFT',  col:'#7dd8ff' },
  { key:'magnet',label:'MAGNET PAWS', col:'#ff8fd0' }
];

const cv=document.getElementById('stage'), ctx=cv.getContext('2d');
const $=id=>document.getElementById(id);

const w={ W:0, H:0, S:1, mode:'A', running:false, over:false,
  t:0, level:1, score:0, timeLeft:0, cat:null, balloons:[], sparks:[], toasts:[],
  carpets:[], grounds:[], pointer:null, held:false, power:{}, cleared:0 };

/* ================= layout ================= */
function resize(){
  const dpr=Math.min(devicePixelRatio||1,2), r=cv.getBoundingClientRect();
  w.W=r.width; w.H=r.height;
  cv.width=Math.round(w.W*dpr); cv.height=Math.round(w.H*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  /* Same scale basis as the other games, so a cat is the same size here. */
  w.S=Math.min(w.W/620,w.H/413);
}
addEventListener('resize',()=>{ resize(); if(w.cat) w.cat.r=26*w.S; });

/* ================= the cat =================
   Ported from catastrophe.js. The only real change is that `puff` comes from
   the charge meter rather than from a panic timer, and that a charged cat
   trails sparks instead of fright lines. */
function makeCat(){
  return { x:w.W*0.5, y:w.H*0.6, vx:0, vy:0, r:26*w.S, rot:0,
    B:pick(BREEDS), charge:0, puff:0, seed:Math.random()*9,
    legs:[0,0,0,0], legV:[0,0,0,0], tail:[0,0,0,0,0], carried:[] };
}

function drawCat(c,t){
  const S=w.S, B=c.B, R=c.r, fur=B.fur, puff=c.puff;
  /* A charged cat sits in its own field. It grows with the meter so you can
     read your charge without looking away from the cat. */
  if(puff>0.04){
    const g=ctx.createRadialGradient(c.x,c.y,R*0.5,c.x,c.y,R*(1.7+1.5*puff));
    g.addColorStop(0,`rgba(125,216,255,${0.05+0.22*puff})`);
    g.addColorStop(1,'rgba(125,216,255,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(c.x,c.y,R*(1.7+1.5*puff),0,TAU); ctx.fill();
  }
  ctx.save(); ctx.translate(c.x,c.y); ctx.rotate(c.rot);

  /* tail: five segments, standing on end as the charge climbs */
  ctx.strokeStyle=B.mark; ctx.lineCap='round';
  ctx.lineWidth=R*(0.22+0.10*puff);
  ctx.beginPath();
  let tx=-R*0.78, ty=R*0.10, ang=Math.PI;
  ctx.moveTo(tx,ty);
  for(let i=0;i<5;i++){
    ang += c.tail[i] + (-0.20+0.55*puff);
    tx += Math.cos(ang)*R*0.34; ty += Math.sin(ang)*R*0.34;
    ctx.lineTo(tx,ty);
  }
  ctx.stroke();

  /* legs */
  ctx.strokeStyle=fur; ctx.lineWidth=R*0.20; ctx.lineCap='round';
  const hips=[[-R*0.44,R*0.34],[-R*0.16,R*0.42],[R*0.20,R*0.42],[R*0.48,R*0.34]];
  hips.forEach((h,i)=>{
    const a=Math.PI/2 + c.legs[i];
    const kx=h[0]+Math.cos(a)*R*0.42, ky=h[1]+Math.sin(a)*R*0.42;
    const a2=a + c.legs[i]*0.8 + 0.25 + (puff>0.5?Math.sin(t*26+i*2+c.seed)*0.35*puff:0);
    const px=kx+Math.cos(a2)*R*0.36, py=ky+Math.sin(a2)*R*0.36;
    ctx.beginPath(); ctx.moveTo(h[0],h[1]); ctx.lineTo(kx,ky); ctx.lineTo(px,py); ctx.stroke();
    ctx.fillStyle=fur; ctx.beginPath(); ctx.arc(px,py,R*0.13,0,TAU); ctx.fill();
  });

  /* body: the spiky silhouette, driven straight off the charge meter. The
     spikes also jitter at high charge, which is most of why a full cat reads
     as dangerous rather than merely fluffy. */
  ctx.fillStyle=fur;
  ctx.beginPath();
  const N=26;
  for(let i=0;i<=N;i++){
    const a=(i/N)*TAU;
    const jitter = puff>0.5 ? Math.sin(t*30+i*3.1+c.seed)*0.06*puff : 0;
    const spike = puff>0.02 ? (i%2? 1+(0.42*puff)+jitter : 1-0.05*puff) : 1;
    const rx=R*0.92*spike, ry=R*0.72*spike;
    const x=Math.cos(a)*rx, y=Math.sin(a)*ry+R*0.06;
    i?ctx.lineTo(x,y):ctx.moveTo(x,y);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(10,13,24,.26)'; ctx.lineWidth=1.6*S; ctx.stroke();

  /* head */
  const hx=R*0.52, hy=-R*0.46, hr=R*0.52;
  ctx.fillStyle=fur;
  const tall=B.ear==='tall'?1.5:B.ear==='round'?0.95:1.2;
  for(const s of [-1,1]){
    const lean = puff*s*0.5;                 // ears blown back by the charge
    ctx.beginPath();
    ctx.moveTo(hx+s*hr*0.30,hy-hr*0.44);
    ctx.quadraticCurveTo(hx+s*hr*(0.75+lean),hy-hr*tall*(1-0.3*puff),
                         hx+s*hr*(1.0+lean*1.4),hy-hr*(tall*0.55-0.2*puff));
    ctx.quadraticCurveTo(hx+s*hr*0.85,hy-hr*0.25,hx+s*hr*0.55,hy-hr*0.12);
    ctx.closePath(); ctx.fill();
  }
  ctx.beginPath(); ctx.arc(hx,hy,hr,0,TAU); ctx.fill();
  ctx.strokeStyle='rgba(10,13,24,.26)'; ctx.lineWidth=1.5*S; ctx.stroke();
  /* face — eyes widen with the charge */
  const ink='#141830';
  const er=hr*(0.26+0.16*puff)*(B.eye==='huge'?1.2:B.eye==='wide'?1.1:1);
  const ex=hr*0.34, ey=-hr*0.06;
  for(const s of [-1,1]){
    ctx.fillStyle='#ffd25e'; ctx.beginPath(); ctx.arc(hx+s*ex,hy+ey,er,0,TAU); ctx.fill();
    ctx.fillStyle=ink; ctx.beginPath(); ctx.arc(hx+s*ex,hy+ey,er*(0.34+0.2*puff),0,TAU); ctx.fill();
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(hx+s*ex+er*0.28,hy+ey-er*0.32,er*0.2,0,TAU); ctx.fill();
  }
  ctx.fillStyle='#ff9db8'; ctx.beginPath();
  ctx.moveTo(hx,hy+hr*0.30); ctx.lineTo(hx-hr*0.11,hy+hr*0.16); ctx.lineTo(hx+hr*0.11,hy+hr*0.16);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle=ink; ctx.lineWidth=hr*0.08; ctx.lineCap='round'; ctx.beginPath();
  if(puff>0.55) ctx.ellipse(hx,hy+hr*0.52,hr*0.20,hr*0.26,0,0,TAU);   // gone wide-eyed
  else ctx.arc(hx,hy+hr*0.5,hr*0.22,1.15*Math.PI,1.85*Math.PI);
  ctx.stroke();
  ctx.strokeStyle='rgba(20,24,48,.4)'; ctx.lineWidth=hr*0.06;
  for(const g of [-1,1]) for(const dy of [-0.04,0.10]){
    ctx.beginPath(); ctx.moveTo(hx+g*hr*0.36,hy+hr*dy); ctx.lineTo(hx+g*hr*0.95,hy+hr*(dy+0.04)); ctx.stroke(); }
  ctx.restore();

  /* arcs crawling over a well-charged cat */
  if(puff>0.35){
    ctx.strokeStyle=`rgba(125,216,255,${0.25+0.5*puff*Math.abs(Math.sin(t*17+c.seed))})`;
    ctx.lineWidth=1.6*S;
    for(let i=0;i<4;i++){
      const a=(i/4)*TAU+t*2.2+c.seed;
      const r1=R*(1.15+0.12*Math.sin(t*9+i));
      ctx.beginPath();
      ctx.moveTo(c.x+Math.cos(a)*r1,c.y+Math.sin(a)*r1*0.85);
      ctx.lineTo(c.x+Math.cos(a+0.35)*r1*1.35,c.y+Math.sin(a+0.35)*r1*1.1);
      ctx.stroke();
    }
  }
}

/* ================= balloons ================= */
function makeBalloon(tier,x,y,power){
  const T=TIERS[tier];
  return { x, y, vx:rand(-14,14), vy:rand(-9,9), r:15*w.S, tier, T,
    seed:Math.random()*9, stuck:false, ax:0, ay:0, power:power||null, pop:0 };
}
function drawBalloon(b,t){
  const R=b.r, sway=Math.sin(t*1.6+b.seed)*0.16;
  ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(sway);
  /* string */
  ctx.strokeStyle='rgba(205,212,245,.35)'; ctx.lineWidth=1.2*w.S;
  ctx.beginPath(); ctx.moveTo(0,R*0.95);
  ctx.quadraticCurveTo(R*0.35*Math.sin(t*2+b.seed),R*1.6,0,R*2.2); ctx.stroke();
  /* body */
  ctx.fillStyle=b.T.col;
  ctx.beginPath(); ctx.ellipse(0,0,R*0.82,R,0,0,TAU); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.35)';
  ctx.beginPath(); ctx.ellipse(-R*0.28,-R*0.34,R*0.2,R*0.28,-0.5,0,TAU); ctx.fill();
  /* knot */
  ctx.fillStyle=b.T.dark;
  ctx.beginPath(); ctx.moveTo(-R*0.14,R*0.92); ctx.lineTo(R*0.14,R*0.92); ctx.lineTo(0,R*1.12);
  ctx.closePath(); ctx.fill();
  /* a power-up balloon has something rattling about inside it */
  if(b.power){
    ctx.fillStyle=`rgba(255,255,255,${0.5+0.4*Math.sin(t*6+b.seed)})`;
    ctx.beginPath(); ctx.arc(0,R*0.05,R*0.22,0,TAU); ctx.fill();
  }
  ctx.restore();
}

/* ================= effects ================= */
function spark(x,y,col,n){
  for(let i=0;i<(n||8);i++){
    const a=rand(0,TAU), sp=rand(60,260)*w.S;
    w.sparks.push({ x,y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, age:0,
      life:rand(0.25,0.6), col:col||'#7dd8ff' });
  }
}
function toast(text,col){ w.toasts.push({ text, col:col||'#eef0fb', age:0, life:1.3 }); }

/* ================= input =================
   One gesture does two jobs, which is the heart of the idea: where your
   finger goes the cat goes, and how violently you wag it side to side is how
   much charge you build. Travelling smoothly charges nothing; scrubbing on
   the spot charges fast and moves you nowhere. That tension is the game.

   Charge is credited on REVERSALS rather than on raw speed, because raw speed
   rewards one long fast drag across the screen — which is travel, not rubbing.
   A reversal is only worth anything if the swing that led to it was both quick
   and wide enough, so tiny nervous jiggles do nothing. */
const SWIPE={ minSpeed:260, minSpan:26, gain:0.052 };
const track={ lastX:0, dir:0, span:0, speed:0, t:0 };

function atCanvas(e){
  const r=cv.getBoundingClientRect();
  return { x:clamp(e.clientX-r.left,0,w.W), y:clamp(e.clientY-r.top,0,w.H) };
}
function onDown(e){
  if(!w.running) return;
  e.preventDefault();
  try{ cv.setPointerCapture?.(e.pointerId); }catch{}
  const p=atCanvas(e);
  w.pointer=p; w.held=true;
  track.lastX=p.x; track.dir=0; track.span=0; track.speed=0;
}
function onMove(e){
  if(!w.running||!w.held) return;
  e.preventDefault();
  const p=atCanvas(e);
  const dx=p.x-track.lastX;
  const dt=Math.max(1/240,(performance.now()-track.t)/1000);
  track.t=performance.now();
  const sp=Math.abs(dx)/dt;
  if(Math.abs(dx)>0.4){
    const dir=Math.sign(dx);
    if(track.dir && dir!==track.dir){
      /* a completed swing: credit it if it was worth having */
      if(track.span>SWIPE.minSpan*w.S && track.speed>SWIPE.minSpeed*w.S)
        earnCharge(SWIPE.gain*clamp(track.span/(90*w.S),0.5,2.2));
      track.span=0; track.speed=0;
    }
    track.dir=dir;
    track.span+=Math.abs(dx);
    track.speed=Math.max(track.speed,sp);
    track.lastX=p.x;
  }
  w.pointer=p;
}
function onUp(){ w.held=false; track.dir=0; }
cv.addEventListener('pointerdown',onDown);
cv.addEventListener('pointermove',onMove);
for(const ev of ['pointerup','pointercancel','lostpointercapture'])
  cv.addEventListener(ev,onUp);

/* Each mode decides whether a swing counts and what it is worth. */
function earnCharge(amount){
  const c=w.cat; if(!c) return;
  const mode=MODES[w.mode];
  const mult=mode.chargeMult ? mode.chargeMult(c) : 1;
  if(mult<=0){ if(Math.random()<0.25) spark(c.x,c.y+c.r,'#6b7397',2); return; }
  const before=c.charge;
  c.charge=clamp(c.charge+amount*mult,0,1);
  if(c.charge>before && Math.random()<0.5) spark(c.x,c.y,'#7dd8ff',2);
}

/* ================= shared simulation ================= */
function stepCat(c,dt){
  /* The cat is dragged toward the finger on a spring rather than pinned to
     it, so a violent scrub whips the cat about instead of teleporting it —
     which is what makes rubbing look like rubbing. */
  if(w.pointer && w.held){
    const k=13, dx=w.pointer.x-c.x, dy=w.pointer.y-c.y;
    c.vx+=dx*k*dt; c.vy+=dy*k*dt;
  }
  /* Carried balloons lift. Enough of them and steering gets genuinely
     floaty, which is a difficulty curve you get for free from the fiction. */
  c.vy -= c.carried.length*26*w.S*dt;
  c.vx*=Math.pow(0.0016,dt); c.vy*=Math.pow(0.0016,dt);
  c.x+=c.vx*dt; c.y+=c.vy*dt;
  const R=c.r;
  if(c.x<R){ c.x=R; c.vx=Math.abs(c.vx)*0.4; }
  if(c.x>w.W-R){ c.x=w.W-R; c.vx=-Math.abs(c.vx)*0.4; }
  if(c.y<R){ c.y=R; c.vy=Math.abs(c.vy)*0.4; }
  if(c.y>w.H-R){ c.y=w.H-R; c.vy=-Math.abs(c.vy)*0.4; }
  c.rot=clamp(c.vx/(1400*w.S),-0.4,0.4);

  /* legs and tail idle, faster the more charged it is */
  const drive=0.3+c.puff;
  for(let i=0;i<4;i++){
    const target=Math.sin(w.t*(9+14*c.puff)+i*1.9+c.seed)*0.5*drive;
    c.legV[i]+=(target-c.legs[i])*dt*30; c.legV[i]*=0.86; c.legs[i]+=c.legV[i];
  }
  for(let i=0;i<5;i++)
    c.tail[i]=Math.sin(w.t*(4+13*c.puff)-i*0.85+c.seed)*(0.18+0.5*c.puff);

  c.puff += (c.charge-c.puff)*Math.min(1,dt*9);
}

function stepBalloons(dt){
  const slow=w.power.slow>0?0.35:1;
  for(const b of w.balloons){
    if(b.stuck) continue;
    b.vy += Math.sin(w.t*0.7+b.seed)*5*dt;   // idle bob
    b.vx += Math.cos(w.t*0.5+b.seed*2)*5*dt;
    b.x += b.vx*dt*slow; b.y += b.vy*dt*slow;
    b.vx*=Math.pow(0.6,dt); b.vy*=Math.pow(0.6,dt);
    const R=b.r;
    if(b.x<R){ b.x=R; b.vx=Math.abs(b.vx); }
    if(b.x>w.W-R){ b.x=w.W-R; b.vx=-Math.abs(b.vx); }
    if(b.y<R){ b.y=R; b.vy=Math.abs(b.vy); }
    if(b.y>w.H-R*2.4){ b.y=w.H-R*2.4; b.vy=-Math.abs(b.vy); }
  }
}

/* Balloons ride above the cat on their strings, jostling each other. */
function stepCarried(c,dt){
  c.carried.forEach((b,i)=>{
    const n=c.carried.length;
    const spread=(i-(n-1)/2)*0.42;
    const tx=c.x+Math.sin(spread+Math.sin(w.t*1.3+b.seed)*0.2)*c.r*1.5;
    const ty=c.y-c.r*2.1-Math.cos(spread)*c.r*0.6;
    b.vx+=(tx-b.x)*26*dt; b.vy+=(ty-b.y)*26*dt;
    b.vx*=Math.pow(0.02,dt); b.vy*=Math.pow(0.02,dt);
    b.x+=b.vx*dt; b.y+=b.vy*dt;
  });
}

function collect(b,c){
  b.stuck=true;
  c.carried.push(b);
  w.balloons=w.balloons.filter(x=>x!==b);
  w.score+=b.T.pts*w.level;
  w.cleared++;
  spark(b.x,b.y,b.T.col,14);
  if(b.power) applyPower(b.power);
  if(!w.balloons.length) winLevel();
}
function applyPower(p){
  toast(p.label,p.col);
  if(p.key==='time') w.timeLeft+=5;
  if(p.key==='full') w.cat.charge=1;
  if(p.key==='slow') w.power.slow=6;
  if(p.key==='magnet') w.power.magnet=7;
}

/* ================= mode A — Rub & Cling =================
   The plainest reading of the pitch, and the baseline the other two are
   arguing with. Charge anywhere, at any time. Every balloon has a price in
   charge and touching it pays that price, so a gold balloon costs you most of
   the meter and you are immediately poor again. The loop is: scrub, spend,
   scrub, spend. Nothing about the room matters — only your own rhythm.

   What it is testing: is the swipe-to-charge gesture fun on its own? */
const MODE_A={
  key:'A', name:'Rub & Cling',
  blurb:'Charge anywhere. Every balloon costs charge to pick up — the gold ones cost nearly all of it. Scrub, spend, scrub again.',
  decay:0.085,
  build(level){
    w.carpets=[]; w.grounds=[];
    const n=4+level*2;
    for(let i=0;i<n;i++){
      const tier=Math.min(3,Math.floor(rand(0,1+level*0.55)));
      const p=Math.random()<0.18?pick(POWERS):null;
      w.balloons.push(makeBalloon(tier,rand(60,w.W-60),rand(50,w.H-90),p));
    }
  },
  chargeMult(){ return 1; },
  step(dt){
    const c=w.cat;
    for(const b of w.balloons){
      const reach=c.r+b.r+(w.power.magnet>0?46*w.S:0);
      if(Math.hypot(b.x-c.x,b.y-c.y)<reach){
        if(c.charge>=b.T.need){
          /* Paying the price is what keeps you scrubbing. A pink balloon is
             nearly free; a gold one empties you. */
          c.charge=clamp(c.charge-Math.max(0.12,b.T.need*0.85),0,1);
          collect(b,c);
        } else if(Math.random()<0.10){
          spark(b.x,b.y,'#6b7397',2);       // a visible refusal, not silence
        }
      }
    }
  },
  drawFloor(){}
};

/* ================= mode B — Carpet & Earth =================
   The "charge up on the carpet" route. Scrubbing only works on a rug, which
   turns the room into the thing you plan around: the rugs are where charge
   lives and the balloons are deliberately not near them. Off the rug the
   meter bleeds, so every trip out is a decision about how much you can carry.

   And there is a way to lose it all. The radiators are earthed: touch one
   while charged and the whole meter goes to ground in a bang. They are parked
   between the rugs and the good balloons on purpose.

   What it is testing: does making charge a PLACE make the room interesting,
   or does it just add walking? */
const MODE_B={
  key:'B', name:'Carpet & Earth',
  blurb:'Charge only builds on the rugs. Off them it bleeds away — and the radiators are earthed, so touching one while charged dumps the lot.',
  decay:0.20,
  build(level){
    w.carpets=[]; w.grounds=[];
    const nRug=2+Math.min(2,Math.floor(level/3));
    for(let i=0;i<nRug;i++){
      const rw=w.W*rand(0.20,0.28), rh=w.H*rand(0.17,0.24);
      w.carpets.push({ x:rand(10,w.W-rw-10), y:rand(10,w.H-rh-10), w:rw, h:rh });
    }
    for(let i=0;i<1+Math.min(3,Math.floor(level/2));i++){
      w.grounds.push({ x:rand(w.W*0.2,w.W*0.8), y:rand(w.H*0.2,w.H*0.8),
        w:44*w.S, h:70*w.S, seed:Math.random()*9 });
    }
    const n=4+level*2;
    for(let i=0;i<n;i++){
      const tier=Math.min(3,Math.floor(rand(0,1+level*0.55)));
      const p=Math.random()<0.18?pick(POWERS):null;
      /* placed away from the rugs, so charge always has to be carried */
      let x,y,tries=0;
      do{ x=rand(60,w.W-60); y=rand(50,w.H-90); tries++; }
      while(tries<24 && w.carpets.some(r=>x>r.x-40&&x<r.x+r.w+40&&y>r.y-40&&y<r.y+r.h+40));
      w.balloons.push(makeBalloon(tier,x,y,p));
    }
  },
  chargeMult(c){ return onCarpet(c)?1.55:0; },
  step(dt){
    const c=w.cat;
    /* earthing: the whole point of the radiators */
    for(const g of w.grounds){
      if(c.x>g.x-c.r&&c.x<g.x+g.w+c.r&&c.y>g.y-c.r&&c.y<g.y+g.h+c.r){
        if(c.charge>0.05){
          spark(c.x,c.y,'#ff9d9d',26);
          toast('EARTHED','#ff9d9d');
          c.charge=0;
        }
      }
    }
    for(const b of w.balloons){
      const reach=c.r+b.r+(w.power.magnet>0?46*w.S:0);
      if(Math.hypot(b.x-c.x,b.y-c.y)<reach){
        if(c.charge>=b.T.need){ c.charge=clamp(c.charge-b.T.need*0.55,0,1); collect(b,c); }
        else if(Math.random()<0.10) spark(b.x,b.y,'#6b7397',2);
      }
    }
  },
  drawFloor(){
    for(const r of w.carpets){
      ctx.fillStyle='rgba(180,139,255,.10)';
      ctx.strokeStyle='rgba(180,139,255,.35)'; ctx.lineWidth=1.5*w.S;
      roundRect(r.x,r.y,r.w,r.h,10*w.S); ctx.fill(); ctx.stroke();
      /* a woven hatch, so a rug reads as a rug and not as a puddle */
      ctx.save(); ctx.beginPath(); roundRect(r.x,r.y,r.w,r.h,10*w.S); ctx.clip();
      ctx.strokeStyle='rgba(180,139,255,.16)'; ctx.lineWidth=1;
      for(let x=r.x-r.h;x<r.x+r.w;x+=9*w.S){
        ctx.beginPath(); ctx.moveTo(x,r.y+r.h); ctx.lineTo(x+r.h,r.y); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle='rgba(180,139,255,.5)';
      ctx.font=`${9*w.S}px "Space Grotesk", system-ui, sans-serif`;
      ctx.textAlign='center'; ctx.fillText('RUG',r.x+r.w/2,r.y+r.h-6*w.S);
    }
    for(const g of w.grounds){
      ctx.fillStyle='rgba(168,173,207,.16)';
      ctx.strokeStyle='rgba(255,157,157,.55)'; ctx.lineWidth=1.6*w.S;
      roundRect(g.x,g.y,g.w,g.h,5*w.S); ctx.fill(); ctx.stroke();
      ctx.strokeStyle='rgba(168,173,207,.45)'; ctx.lineWidth=2*w.S;
      for(let i=1;i<4;i++){
        ctx.beginPath(); ctx.moveTo(g.x+g.w*i/4,g.y+4*w.S);
        ctx.lineTo(g.x+g.w*i/4,g.y+g.h-4*w.S); ctx.stroke();
      }
    }
  }
};
function onCarpet(c){
  return w.carpets.some(r=>c.x>r.x&&c.x<r.x+r.w&&c.y>r.y&&c.y<r.y+r.h);
}

/* ================= mode C — Static Field =================
   Charge stops being a key and becomes a magnet: it pulls balloons toward you
   from a distance that grows with the meter, and you never chase anything.

   The twist is that every balloon has a WINDOW rather than a minimum. Too
   little charge and it ignores you; too much and it is repelled, because like
   charges push apart. So the meter is not a score to maximise — it is a dial
   to hold at the right place, and the balloons you want are on opposite ends
   of it. Scrubbing up is easy; scrubbing to exactly 0.6 is the skill.

   What it is testing: is managing a level more interesting than filling it? */
const MODE_C={
  key:'C', name:'Static Field',
  blurb:'Charge is a magnet, not a key. Every balloon has a window — too little and it ignores you, too much and it flees. Hold the meter, do not fill it.',
  decay:0.10,
  build(level){
    w.carpets=[]; w.grounds=[];
    const n=4+level*2;
    for(let i=0;i<n;i++){
      const tier=Math.min(3,Math.floor(rand(0,1+level*0.55)));
      const p=Math.random()<0.18?pick(POWERS):null;
      const b=makeBalloon(tier,rand(60,w.W-60),rand(50,w.H-90),p);
      /* the window: opens at the tier's need, and shuts a fixed way above it */
      b.lo=b.T.need; b.hi=Math.min(1.02,b.T.need+0.30);
      w.balloons.push(b);
    }
  },
  chargeMult(){ return 1; },
  step(dt){
    const c=w.cat;
    const field=fieldOf(c);
    for(const b of w.balloons){
      const dx=c.x-b.x, dy=c.y-b.y, d=Math.hypot(dx,dy)||1;
      if(d<field){
        const nx=dx/d, ny=dy/d;
        if(c.charge<b.lo){ /* beneath the window: nothing happens */ }
        else if(c.charge>b.hi){
          /* over the window — like repels like, and it runs */
          const push=520*w.S*(c.charge-b.hi)/0.3;
          b.vx-=nx*push*dt; b.vy-=ny*push*dt;
        } else {
          const pull=640*w.S*(1-d/field)+140*w.S;
          b.vx+=nx*pull*dt; b.vy+=ny*pull*dt;
          if(d<c.r+b.r){ collect(b,c); }
        }
      }
    }
  },
  drawFloor(){
    /* the reach of the field, so the dial has something to point at */
    const c=w.cat; if(!c) return;
    const field=fieldOf(c);
    ctx.strokeStyle=`rgba(125,216,255,${0.10+0.18*c.charge})`;
    ctx.lineWidth=1.4*w.S; ctx.setLineDash([5,7]);
    ctx.beginPath(); ctx.arc(c.x,c.y,field,0,TAU); ctx.stroke();
    ctx.setLineDash([]);
  }
};

/* The field has a floor as well as a slope. Scaling it from nothing made the
   CHEAP balloons the fiddly ones — a pink is collectable at a fifth of the
   meter, but a fifth of the meter reached barely past the cat's own whiskers,
   so the easiest thing in the room needed the most precise driving. The floor
   keeps low-charge play readable; the slope is still what makes a full cat
   sweep the room. */
function fieldOf(c){
  return c.r*2.2 + 90*w.S + c.charge*150*w.S + (w.power.magnet>0?60*w.S:0);
}

const MODES={ A:MODE_A, B:MODE_B, C:MODE_C };

function roundRect(x,y,ww,hh,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.arcTo(x+ww,y,x+ww,y+hh,r); ctx.arcTo(x+ww,y+hh,x,y+hh,r);
  ctx.arcTo(x,y+hh,x,y,r); ctx.arcTo(x,y,x+ww,y,r); ctx.closePath();
}

/* ================= level flow =================
   Nine levels, for the obvious reason. A clock that carries across them, with
   time handed back for clearing a room, so a good player plays longer rather
   than being handed a fresh timer for free. */
const LEVEL_TIME=32;
function startLevel(n){
  w.level=n; w.over=false;
  w.balloons=[]; w.sparks=[]; w.toasts=[]; w.power={};
  resize();
  w.cat=makeCat();
  MODES[w.mode].build(n);
  w.running=true;
  $('overlay').hidden=true;
  hud();
  cv.focus({preventScroll:true});
}
function newGame(){
  w.score=0; w.cleared=0; w.timeLeft=LEVEL_TIME;
  startLevel(1);
}
function winLevel(){
  w.running=false;
  if(w.level>=9) return finish('Every room cleared','Nine levels of extremely charged cat. Nothing left to stick to him.');
  w.timeLeft+=12;
  toast('ROOM CLEAR  +12s','#8fe3b0');
  setTimeout(()=>{
    $('ov-title').textContent='Room '+w.level+' cleared';
    $('ov-body').textContent='+12 seconds. '+(w.level+1===9?'Last room.':'Room '+(w.level+1)+' has more of them, and more of the expensive ones.');
    $('ov-score').hidden=true; $('ov-final').hidden=true;
    $('go').textContent='Next room';
    $('go').onclick=()=>startLevel(w.level+1);
    $('overlay').hidden=false;
  },700);
}
function finish(title,body){
  w.running=false; w.over=true;
  $('ov-title').textContent=title;
  $('ov-body').textContent=body;
  $('final-score').textContent=w.score;
  $('ov-final').hidden=false; $('ov-score').hidden=true;
  $('go').textContent='Play again';
  $('go').onclick=newGame;
  $('overlay').hidden=false;
}
function hud(){
  $('score').textContent=w.score;
  $('level').textContent=w.level+'/9';
  $('left').textContent=w.balloons.length;
  $('clock').textContent=Math.max(0,Math.ceil(w.timeLeft));
  const c=w.cat;
  $('charge-fill').style.width=(c?c.charge*100:0)+'%';
}

/* ================= loop ================= */
let last=performance.now(), acc=0;
const FIXED=1/60, MAX_STEPS=4;
function frame(now){
  const dt=clamp((now-last)/1000,0,0.25); last=now;
  acc = w.running ? Math.min(acc+dt,FIXED*MAX_STEPS) : 0;
  while(acc>=FIXED){ acc-=FIXED; sim(FIXED); }
  draw(now/1000);
  requestAnimationFrame(frame);
}
function sim(dt){
  w.t+=dt;
  const c=w.cat, mode=MODES[w.mode];
  w.timeLeft-=dt;
  if(w.timeLeft<=0){ w.timeLeft=0; return finish('Out of time','The static went with it. '+w.cleared+' balloons over '+w.level+' room'+(w.level>1?'s':'')+'.'); }
  /* charge always leaks — a charged cat is a temporary cat */
  c.charge=clamp(c.charge-mode.decay*dt,0,1);
  for(const k of Object.keys(w.power)) if(w.power[k]>0) w.power[k]-=dt;
  stepCat(c,dt);
  stepBalloons(dt);
  mode.step(dt);
  stepCarried(c,dt);
  for(const s of w.sparks){ s.age+=dt; s.x+=s.vx*dt; s.y+=s.vy*dt; s.vy+=260*w.S*dt; s.vx*=0.96; }
  w.sparks=w.sparks.filter(s=>s.age<s.life);
  for(const t of w.toasts) t.age+=dt;
  w.toasts=w.toasts.filter(t=>t.age<t.life);
  hud();
}
function draw(t){
  ctx.clearRect(0,0,w.W,w.H);
  MODES[w.mode].drawFloor();
  for(const b of w.balloons) drawBalloon(b,t);
  if(w.cat){
    for(const b of w.cat.carried) drawBalloon(b,t);
    drawCat(w.cat,t);
    /* the string from each carried balloon down to the cat */
    ctx.strokeStyle='rgba(205,212,245,.28)'; ctx.lineWidth=1.1*w.S;
    for(const b of w.cat.carried){
      ctx.beginPath(); ctx.moveTo(b.x,b.y+b.r); ctx.lineTo(w.cat.x,w.cat.y-w.cat.r*0.3); ctx.stroke();
    }
  }
  for(const s of w.sparks){
    ctx.globalAlpha=Math.max(0,1-s.age/s.life);
    ctx.fillStyle=s.col;
    ctx.fillRect(s.x-1.5*w.S,s.y-1.5*w.S,3*w.S,3*w.S);
  }
  ctx.globalAlpha=1;
  w.toasts.forEach((tt,i)=>{
    const k=tt.age/tt.life;
    ctx.globalAlpha=Math.max(0,1-k*k);
    ctx.fillStyle=tt.col;
    ctx.font=`700 ${17*w.S}px "Space Grotesk", system-ui, sans-serif`;
    ctx.textAlign='center';
    ctx.fillText(tt.text,w.W/2,w.H*0.22-k*30*w.S-i*20*w.S);
  });
  ctx.globalAlpha=1;
  /* a nudge for the one thing nobody guesses on their own */
  if(w.running && w.cat && w.cat.charge<0.05 && w.t<6){
    ctx.fillStyle='rgba(205,212,245,.55)';
    ctx.font=`${13*w.S}px "Sora", system-ui, sans-serif`;
    ctx.textAlign='center';
    ctx.fillText('press and scrub side to side to charge him up',w.W/2,w.H-16*w.S);
  }
}

/* ================= wiring ================= */
function setMode(key){
  w.mode=key;
  for(const b of document.querySelectorAll('.mode-pick button'))
    b.classList.toggle('on',b.dataset.mode===key);
  const m=MODES[key];
  $('mode-name').textContent=m.name;
  $('mode-blurb').textContent=m.blurb;
  w.running=false;
  $('ov-title').textContent=m.name;
  $('ov-body').textContent=m.blurb;
  $('ov-final').hidden=true;
  $('go').textContent='Start';
  $('go').onclick=newGame;
  $('overlay').hidden=false;
  resize();
  w.cat=makeCat(); w.balloons=[]; w.level=1; w.score=0; w.timeLeft=LEVEL_TIME;
  hud();
}
for(const b of document.querySelectorAll('.mode-pick button'))
  b.addEventListener('click',()=>setMode(b.dataset.mode));

resize();
setMode('A');
requestAnimationFrame(frame);
