/* ================= Catstatic =================
   Lives at catstatic.html. Depends on js/leaderboard.js for the score board.

   Skid the cat across the carpet and friction charges his fur until it stands
   on end; charged fur holds balloons. Chosen over three other shapes across
   four rounds of prototypes — the ones that lost were charging anywhere in an
   open arena, charging by wagging on the spot, and a magnet with a window.

   Two things carry the game and neither is obvious from the code:

   - Charge is a PLACE. It only builds on carpet, and it leaks everywhere, so
     the room is a route rather than an arena.
   - Seconds are points. A room pays out the time you did not spend on it, so
     the board rewards playing fast and getting deep rather than sweeping up
     every cheap balloon in room one.
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
  carpets:[], grounds:[], walls:[], rods:[], hazards:[], bolts:[],
  pointer:null, held:false, dug:false, power:{}, cleared:0,
  catch:'steady', roomStart:0 };

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
  const S=w.S, B=c.B, R=c.r, puff=c.puff;
  /* Struck by lightning: for a beat the cat goes to X-ray, the way it happens
     in every cartoon. Drawn by swapping the fur for bone and laying a ribcage
     over the top — same silhouette, so it reads as the same cat. */
  const zap=c.strikeT>0;
  /* The X-ray inverts the cat rather than bleaching him: the body goes to a
     dark plate and the bones are the bright thing on it, which is the way a
     cartoon X-ray actually reads. Drawing white bones on a white cat, as the
     first pass did, hid every rib. */
  const XBODY='#262c56';
  const fur = zap ? XBODY : B.fur;
  const mark = zap ? XBODY : B.mark;
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
  ctx.strokeStyle=mark; ctx.lineCap='round';
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

  /* ---- body ----
     Sharp triangles, like the explosion emoji, struck by lightning.

     The geometry is what makes them triangles: vertices strictly ALTERNATE
     out, in, out, in, with straight lines between, so every outward point
     comes to an actual apex. The previous pass gave every vertex its own
     random radius, which broke the alternation and turned the whole cat into
     a lumpy blob — the variation has to live in the LENGTH of the spikes, not
     in whether a given point is a spike at all.

     So: the valleys are uniform (a clean base for each triangle), and only
     the peaks vary, each one from a hash of its own index and the cat's seed.
     Stable per cat, so a given cat always wears the same ragged crown. */
  const hash=(i)=>{ const n=Math.sin(i*12.9898+c.seed*78.233)*43758.5453; return n-Math.floor(n); };
  ctx.fillStyle=fur;
  ctx.beginPath();
  const N=32;                        // even, so the alternation closes cleanly
  for(let i=0;i<=N;i++){
    const a=(i/N)*TAU;
    const peak=(i%2)===0;
    let spike=1;
    if(puff>0.02){
      if(peak){
        const rnd=hash(i%N);
        const crawl=Math.sin(t*(3.5+rnd*5)+i*1.7+c.seed)*0.07*puff;
        spike=1+puff*(0.34+0.62*rnd)+crawl;
      } else {
        spike=1-puff*0.17;           // a uniform valley sharpens every point
      }
    }
    const rx=R*0.92*spike, ry=R*0.72*spike;
    const x=Math.cos(a)*rx, y=Math.sin(a)*ry+R*0.06;
    i?ctx.lineTo(x,y):ctx.moveTo(x,y);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle=zap?`rgba(240,245,255,${0.55+0.45*Math.abs(Math.sin(t*40))})`:'rgba(10,13,24,.26)';
  ctx.lineWidth=(zap?2.4:1.6)*S; ctx.stroke();

  /* ---- head ---- */
  const hx=R*0.52, hy=-R*0.46, hr=R*0.52;
  const ink='#141830';
  /* Ears are pointy, always, and their geometry does NOT depend on the charge:
     the old version folded them back and shortened them as the meter filled,
     which at a full charge swallowed them into the head entirely. They twitch
     and that is all. */
  ctx.fillStyle=fur;
  for(const sd of [-1,1]){
    const twitch=Math.sin(t*7+sd*1.7+c.seed)*0.05*(0.4+puff);
    ctx.beginPath();
    ctx.moveTo(hx+sd*hr*0.22, hy-hr*0.50);
    ctx.lineTo(hx+sd*hr*(0.78+twitch), hy-hr*(1.70+twitch*2));
    ctx.lineTo(hx+sd*hr*1.02, hy-hr*0.26);
    ctx.closePath(); ctx.fill();
  }
  ctx.beginPath(); ctx.arc(hx,hy,hr,0,TAU); ctx.fill();
  /* inner ear, drawn after the head so it sits on top cleanly */
  ctx.fillStyle='rgba(255,157,184,.55)';
  for(const sd of [-1,1]){
    const twitch=Math.sin(t*7+sd*1.7+c.seed)*0.05*(0.4+puff);
    ctx.beginPath();
    ctx.moveTo(hx+sd*hr*0.36, hy-hr*0.56);
    ctx.lineTo(hx+sd*hr*(0.74+twitch), hy-hr*(1.40+twitch*2));
    ctx.lineTo(hx+sd*hr*0.86, hy-hr*0.42);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle=fur;
  ctx.beginPath(); ctx.arc(hx,hy,hr,0,TAU); ctx.fill();
  ctx.strokeStyle='rgba(10,13,24,.26)'; ctx.lineWidth=1.5*S; ctx.stroke();

  /* ---- face ----
     Delighted rather than alarmed, and deliberately a bit stupid: the eyes
     are different sizes, the pupils do not agree with each other, and there
     is a tongue out at all times. Charge makes all of that MORE so. */
  const er=hr*(0.34+0.13*puff);
  const ex=hr*0.36, ey=-hr*0.04;
  for(const sd of [-1,1]){
    const rr=er*(sd<0?1.10:0.90);                       // one eye bigger
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(hx+sd*ex,hy+ey,rr,0,TAU); ctx.fill();
    ctx.strokeStyle='rgba(10,13,24,.22)'; ctx.lineWidth=1*S; ctx.stroke();
    /* the pupils drift independently, which is most of the derp */
    const wob=Math.sin(t*2.3+(sd<0?0:1.9)+c.seed)*0.16;
    const px=hx+sd*ex+rr*(sd<0?0.16:-0.10)+rr*wob;
    const py=hy+ey+rr*(sd<0?0.10:-0.06);
    ctx.fillStyle=ink;
    ctx.beginPath(); ctx.arc(px,py,rr*(0.46+0.12*puff),0,TAU); ctx.fill();
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(px+rr*0.16,py-rr*0.20,rr*0.16,0,TAU); ctx.fill();
  }
  /* nose */
  ctx.fillStyle='#ff9db8'; ctx.beginPath();
  ctx.moveTo(hx,hy+hr*0.34); ctx.lineTo(hx-hr*0.12,hy+hr*0.18); ctx.lineTo(hx+hr*0.12,hy+hr*0.18);
  ctx.closePath(); ctx.fill();
  /* a big open grin, and a tongue hanging out of one side of it */
  ctx.strokeStyle=ink; ctx.lineWidth=hr*0.09; ctx.lineCap='round';
  ctx.beginPath(); ctx.arc(hx,hy+hr*0.30,hr*0.36,0.18*Math.PI,0.82*Math.PI); ctx.stroke();
  /* A tongue tip, not a tongue. The first one was a long wobbling ellipse
     hanging off the chin, which read as an injury. This is a small rounded
     tip tucked just inside the grin, slightly off-centre, and it holds still. */
  ctx.fillStyle='#ff7fa8';
  ctx.beginPath();
  ctx.ellipse(hx+hr*0.07,hy+hr*0.52,hr*0.13,hr*0.10,0,0,TAU);
  ctx.fill();
  /* whiskers */
  ctx.strokeStyle='rgba(20,24,48,.4)'; ctx.lineWidth=hr*0.06;
  for(const g of [-1,1]) for(const dy of [-0.02,0.12]){
    ctx.beginPath(); ctx.moveTo(hx+g*hr*0.38,hy+hr*dy); ctx.lineTo(hx+g*hr*0.98,hy+hr*(dy+0.04)); ctx.stroke(); }
  ctx.restore();

  /* ---- the X-ray ----
     A cat, not a diagram. Same silhouette as the body above, the same head in
     the same place with the same pointy ears, and a spine that runs from the
     skull to the tip of the tail. The first attempt was a ribcage floating in
     a blob and read as a bug. */
  if(zap){
    ctx.save(); ctx.translate(c.x,c.y); ctx.rotate(c.rot);
    const bone='#f2f5ff', dark=XBODY;
    ctx.strokeStyle=bone; ctx.fillStyle=bone;
    ctx.lineCap='round'; ctx.lineJoin='round';

    /* spine, from the shoulders back to the tail root */
    ctx.lineWidth=R*0.10;
    ctx.beginPath(); ctx.moveTo(R*0.40,-R*0.14); ctx.lineTo(-R*0.66,R*0.02); ctx.stroke();
    /* ribs: eight of them, shortening toward the hips */
    ctx.lineWidth=R*0.055;
    for(let i=0;i<8;i++){
      const f=i/7, bx=R*(0.34-0.86*f), by=-R*0.13+R*0.16*f;
      const len=R*(0.42-0.14*f);
      ctx.beginPath();
      ctx.moveTo(bx,by);
      ctx.quadraticCurveTo(bx-R*0.06,by+len*0.7,bx+R*0.04,by+len);
      ctx.stroke();
    }
    /* hips and shoulder blades */
    ctx.lineWidth=R*0.09;
    ctx.beginPath(); ctx.moveTo(-R*0.56,-R*0.10); ctx.lineTo(-R*0.44,R*0.24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(R*0.30,-R*0.16); ctx.lineTo(R*0.20,R*0.16); ctx.stroke();
    /* the four legs, following the same hips the fur uses */
    ctx.lineWidth=R*0.07;
    hips.forEach((h,i)=>{
      const a=Math.PI/2 + c.legs[i];
      const kx=h[0]+Math.cos(a)*R*0.42, ky=h[1]+Math.sin(a)*R*0.42;
      const a2=a + c.legs[i]*0.8 + 0.25;
      const px=kx+Math.cos(a2)*R*0.36, py=ky+Math.sin(a2)*R*0.36;
      ctx.beginPath(); ctx.moveTo(h[0],h[1]); ctx.lineTo(kx,ky); ctx.lineTo(px,py); ctx.stroke();
    });
    /* tail vertebrae, along the tail the cat is actually wearing */
    let bx=-R*0.72, by=R*0.06, ang=Math.PI;
    for(let i=0;i<5;i++){
      ang += c.tail[i] + (-0.20+0.55*puff);
      const nx2=bx+Math.cos(ang)*R*0.34, ny2=by+Math.sin(ang)*R*0.34;
      ctx.beginPath(); ctx.arc(nx2,ny2,R*0.055,0,TAU); ctx.fill();
      bx=nx2; by=ny2;
    }
    /* skull: the head circle, the same pointy ears, and a muzzle */
    for(const sd of [-1,1]){
      ctx.beginPath();
      ctx.moveTo(hx+sd*hr*0.22, hy-hr*0.50);
      ctx.lineTo(hx+sd*hr*0.78, hy-hr*1.70);
      ctx.lineTo(hx+sd*hr*1.02, hy-hr*0.26);
      ctx.closePath(); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(hx,hy,hr*0.94,0,TAU); ctx.fill();
    ctx.fillStyle=dark;
    /* hollow eye sockets and a nose cavity, which is what makes it a skull */
    ctx.beginPath(); ctx.ellipse(hx-hr*0.36,hy-hr*0.04,hr*0.26,hr*0.30,-0.2,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hx+hr*0.36,hy-hr*0.04,hr*0.24,hr*0.28,0.2,0,TAU); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx,hy+hr*0.40); ctx.lineTo(hx-hr*0.13,hy+hr*0.16); ctx.lineTo(hx+hr*0.13,hy+hr*0.16);
    ctx.closePath(); ctx.fill();
    /* teeth */
    ctx.strokeStyle=dark; ctx.lineWidth=hr*0.07;
    ctx.beginPath(); ctx.moveTo(hx-hr*0.30,hy+hr*0.60); ctx.lineTo(hx+hr*0.30,hy+hr*0.60); ctx.stroke();
    for(let i=-2;i<=2;i++){
      ctx.beginPath(); ctx.moveTo(hx+i*hr*0.14,hy+hr*0.60); ctx.lineTo(hx+i*hr*0.14,hy+hr*0.76); ctx.stroke();
    }
    ctx.restore();
  }

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
/* Round one asked for a swing that was both fast and wide before it paid
   anything, which is comfortable with a thumb and awkward with a mouse: a
   mouse wags from the wrist over a much shorter distance. Both floors come
   down, and the payment goes up to compensate. */
const SWIPE={ minSpeed:150, minSpan:15, gain:0.060 };
/* How far you must drag before a dug-in cat lets go of the rug. Comfortably
   more than a scrubbing stroke, comfortably less than a deliberate pull. */
const BREAKAWAY=95;
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
  /* THE FIX. On a rug, a cat digs in: the pointer stops steering him and
     starts rubbing him instead, so a wag charges without throwing him across
     the room. Drag further than BREAKAWAY and he lets go and follows again,
     which is how you leave. Off the rug nothing has changed. */
  const md=MODES[w.mode];
  w.dug=false;
  if(w.pointer && w.held){
    const dx=w.pointer.x-c.x, dy=w.pointer.y-c.y;
    const digging = md.digIn && onCarpet(c) && Math.hypot(dx,dy)<BREAKAWAY*w.S;
    if(digging){
      w.dug=true;
      /* he shuffles on the spot in the direction of the scrub — the movement
         that says "rubbing" without actually going anywhere */
      c.vx+=clamp(dx,-40*w.S,40*w.S)*3.0*dt;
      c.vy+=clamp(dy,-26*w.S,26*w.S)*3.0*dt;
    } else {
      /* Round two's cat lagged behind the pointer badly enough to feel like
         steering a boat. The spring is more than twice as stiff now and the
         damping tighter with it, so he arrives where you point in about a
         sixth of a second and stops there instead of coasting. Enough inertia
         survives that a skid still reads as a skid. */
      const k=105;
      c.vx+=dx*k*dt; c.vy+=dy*k*dt;
    }
  }
  /* Carried balloons lift. Enough of them and steering gets genuinely
     floaty, which is a difficulty curve you get for free from the fiction. */
  c.vy -= c.carried.length*26*w.S*dt;
  c.vx*=Math.pow(0.000035,dt); c.vy*=Math.pow(0.000035,dt);
  c.x+=c.vx*dt; c.y+=c.vy*dt;
  collideWalls(c,0.25);
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

/* ---- the catch ----
   Round three tapered the slack hard from room to room, which meant the rule
   changed under you as you played: a catch that worked in room two missed in
   room six for no visible reason. All three models below keep the slack
   roughly constant instead, and none of them is ever drawn — you should feel
   forgiven, not see a hitbox.

   What differs is where the extra reach comes from:
     steady   a flat, generous ring. Same in room one and room nine.
     charged  the ring GROWS with the meter, so a charged cat is a wider cat.
     cling    as charged, and balloons inside it drift toward you. */
const CATCH={
  steady:{ name:'Steady reach',
    label:'A flat, generous catch. The same in room one as in room nine, so the rule never changes under you.',
    reach(c){ return 30*w.S; } },
  charged:{ name:'Charged reach',
    label:'The catch grows with the meter. A full cat is a wider cat, which gives the charge a second job.',
    reach(c){ return (14+34*c.charge)*w.S; } },
  cling:{ name:'Cling',
    label:'As Charged reach, and balloons inside it drift toward you — the magnet from round one, without a ring drawn round it.',
    reach(c){ return (14+34*c.charge)*w.S; }, pull:true }
};
function grace(){ return CATCH[w.catch].reach(w.cat); }

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

/* ================= the room =================
   Everything below is shared by all three prototypes. What differs between
   them is only WHICH of it gets switched on, and how early. */

/* Three grades of carpet. The colour is the charge rate, so you can pick your
   runway from across the room without reading anything. */
const CARPETS=[
  { key:'shag', mult:1.85, col:'#c9a6ff', line:'rgba(201,166,255,', label:'SHAG' },
  { key:'rug',  mult:1.00, col:'#b48bff', line:'rgba(180,139,255,', label:'RUG'  },
  { key:'mat',  mult:0.72, col:'#7c86a4', line:'rgba(124,134,164,', label:'MAT'  }
];
/* Carpets are furnishings, not swatches. The GRADE is told by the weave — deep
   tufts, a woven pile with a border and fringe, or a tight flat mat — and the
   colour varies within a grade so two rugs of the same speed are still two
   different rugs. Each is rendered once into its own little canvas when the
   room is built rather than every frame, because a shag pile is a few hundred
   strokes and the game runs at sixty. */
const TONES=[
  { base:'#3a2b52', pile:'#6b4f8f', trim:'#c9a6ff' },
  { base:'#2b3a52', pile:'#4f6f8f', trim:'#7dd8ff' },
  { base:'#52332b', pile:'#8f5f4f', trim:'#ffb08a' },
  { base:'#2b4a3a', pile:'#4f8f6f', trim:'#8fe3b0' },
  { base:'#4a2b3f', pile:'#8f4f74', trim:'#ff8fd0' }
];
function makeCarpetTexture(r){
  const dpr=Math.min(devicePixelRatio||1,2);
  const cw=Math.max(4,Math.round(r.w*dpr)), ch=Math.max(4,Math.round(r.h*dpr));
  const cvx=document.createElement('canvas'); cvx.width=cw; cvx.height=ch;
  const x=cvx.getContext('2d'); x.scale(dpr,dpr);
  const T=r.tone, G=r.grade, W=r.w, H=r.h;
  let sd=r.seed*9973;
  const rnd=()=>{ sd=(sd*9301+49297)%233280; return sd/233280; };

  x.fillStyle=T.base; x.fillRect(0,0,W,H);

  if(G.key==='shag'){
    /* deep pile: hundreds of little tufts leaning every which way */
    for(let i=0;i<Math.round(W*H/26);i++){
      const px=rnd()*W, py=rnd()*H, a=rnd()*TAU, len=3+rnd()*5;
      x.strokeStyle=rnd()<0.5?T.pile:T.trim;
      x.globalAlpha=0.18+rnd()*0.42;
      x.lineWidth=1.6; x.lineCap='round';
      x.beginPath(); x.moveTo(px,py); x.lineTo(px+Math.cos(a)*len,py+Math.sin(a)*len); x.stroke();
    }
    x.globalAlpha=1;
  } else if(G.key==='rug'){
    /* a woven pile with a border and a medallion in the middle */
    x.strokeStyle=T.pile; x.globalAlpha=0.5; x.lineWidth=1;
    for(let yy=2;yy<H;yy+=3){ x.beginPath(); x.moveTo(0,yy); x.lineTo(W,yy); x.stroke(); }
    x.globalAlpha=0.28;
    for(let xx=2;xx<W;xx+=6){ x.beginPath(); x.moveTo(xx,0); x.lineTo(xx,H); x.stroke(); }
    x.globalAlpha=1;
    x.strokeStyle=T.trim; x.lineWidth=2; x.globalAlpha=0.55;
    x.strokeRect(6,6,W-12,H-12);
    x.lineWidth=1; x.strokeRect(11,11,W-22,H-22);
    /* medallion */
    x.globalAlpha=0.5;
    x.beginPath();
    x.moveTo(W/2,H*0.24); x.lineTo(W*0.66,H/2); x.lineTo(W/2,H*0.76); x.lineTo(W*0.34,H/2);
    x.closePath(); x.stroke();
    x.beginPath(); x.ellipse(W/2,H/2,W*0.09,H*0.16,0,0,TAU); x.stroke();
    x.globalAlpha=1;
  } else {
    /* a thin flat mat: tight even weave, rubber edge */
    x.strokeStyle=T.pile; x.globalAlpha=0.55; x.lineWidth=1;
    for(let xx=0;xx<W+H;xx+=4){ x.beginPath(); x.moveTo(xx,0); x.lineTo(xx-H,H); x.stroke(); }
    x.globalAlpha=0.30;
    for(let xx=-H;xx<W;xx+=4){ x.beginPath(); x.moveTo(xx,0); x.lineTo(xx+H,H); x.stroke(); }
    x.globalAlpha=1;
    x.strokeStyle=T.trim; x.globalAlpha=0.4; x.lineWidth=3; x.strokeRect(2,2,W-4,H-4);
    x.globalAlpha=1;
  }
  return cvx;
}

const hitBox=(a,b,pad)=>a.x<b.x+b.w+pad&&a.x+a.w+pad>b.x&&a.y<b.y+b.h+pad&&a.y+a.h+pad>b.y;

/* Places a rectangle that clears everything already down. The clearance
   relaxes rather than giving up, because a room that silently loses its
   radiator (or its rug) is worse than a cramped one. */
function place(mk,pads){
  for(const pad of pads){
    for(let k=0;k<28;k++){
      const cand=mk();
      const clash = w.carpets.some(o=>hitBox(cand,o,pad*w.S))
                 || w.grounds.some(o=>hitBox(cand,o,pad*w.S))
                 || w.walls.some(o=>hitBox(cand,o,pad*w.S))
                 || w.rods.some(o=>hitBox(cand,{x:o.x-14*w.S,y:o.y-14*w.S,w:28*w.S,h:28*w.S},pad*w.S));
      if(!clash) return cand;
    }
  }
  return null;
}

function buildRoom(level,opts){
  opts=opts||{};
  w.carpets=[]; w.grounds=[]; w.walls=[]; w.rods=[]; w.hazards=[]; w.bolts=[];

  /* ---- walls, first, because everything else routes around them ---- */
  if(level>=opts.wallsFrom){
    const n=Math.min(4,1+Math.floor((level-opts.wallsFrom)/2));
    for(let i=0;i<n;i++){
      const vert=Math.random()<0.5;
      const wl=place(()=>({
        x:rand(w.W*0.14,w.W*0.80), y:rand(w.H*0.12,w.H*0.74),
        w:vert?16*w.S:w.W*rand(0.20,0.34), h:vert?w.H*rand(0.22,0.38):16*w.S }),[26,14,6]);
      if(wl) w.walls.push(wl);
    }
  }

  /* ---- carpet ---- */
  const nRug=2+Math.min(2,Math.floor(level/3));
  for(let i=0;i<nRug;i++){
    /* Runways, not mats: charging by skidding needs room to reach a skidding
       speed. The first rug is always decent carpet so a room is never
       unplayable; after that the grade is luck of the draw. */
    /* The first rug is always ordinary carpet so no room is unplayable, and
       the second is always shag once shag exists, so a room reliably offers a
       choice of speeds rather than leaving it to three coin flips. */
    const grade = i===0 ? CARPETS[1]
                : i===1 ? (level>=3?CARPETS[0]:CARPETS[1])
                : pick(level>=3?CARPETS:[CARPETS[0],CARPETS[1]]);
    /* Deliberately short. An early runway that spans half the room makes
       charging a formality; these are rugs you have to work a bit, and they
       tighten as the rooms go on so the same skid buys less. */
    const shrink=clamp(1-(level-1)*0.035,0.80,1);
    /* Floored against the cat rather than against the room: he is 52 units
       across, and a rug he does not fit on cannot be skidded along at all.
       Room nine was handing out rugs 54 units tall, which stopped charging
       working there entirely. */
    const rw=Math.max(w.W*rand(0.28,0.38)*shrink, 180*w.S);
    const rh=Math.max(w.H*rand(0.16,0.24)*shrink, 72*w.S);
    const r=place(()=>({ x:rand(10,Math.max(11,w.W-rw-10)), y:rand(10,Math.max(11,w.H-rh-10)),
      w:rw, h:rh }),[10,4,0]);
    if(r){
      r.grade=grade; r.tone=pick(TONES); r.seed=Math.random()*9;
      r.tex=makeCarpetTexture(r);
      w.carpets.push(r);
    }
  }

  /* ---- radiators: still the best thing in the game ---- */
  for(let i=0;i<1+Math.min(3,Math.floor(level/2));i++){
    const g=place(()=>({ x:rand(w.W*0.12,w.W*0.86), y:rand(w.H*0.12,w.H*0.80),
      w:44*w.S, h:70*w.S, seed:Math.random()*9 }),[52,41,30,19,8]);
    if(g) w.grounds.push(g);
  }

  /* ---- lightning rods ---- */
  if(level>=opts.rodsFrom){
    for(let i=0;i<1+Math.floor((level-opts.rodsFrom)/3);i++){
      const rod=place(()=>({ x:rand(w.W*0.12,w.W*0.88), y:rand(w.H*0.20,w.H*0.82),
        w:20*w.S, h:20*w.S }),[40,26,12]);
      if(rod) w.rods.push({ x:rod.x, y:rod.y, reach:44*w.S, cool:0, wind:0, seed:Math.random()*9 });
    }
  }

  /* ---- the menagerie ---- */
  if(opts.scissorsFrom && level>=opts.scissorsFrom)
    for(let i=0;i<1+(level>=7&&opts.crowded?1:0);i++)
      w.hazards.push({ kind:'scissors', x:rand(40,w.W-40), y:rand(40,w.H-40),
        vx:0, vy:0, ang:0, cut:0, seed:Math.random()*9 });
  if(opts.magnetFrom && level>=opts.magnetFrom)
    w.hazards.push({ kind:'magnet', x:rand(w.W*0.2,w.W*0.8), y:rand(w.H*0.2,w.H*0.8),
      seed:Math.random()*9, pulse:0 });
  if(opts.vacuumFrom && level>=opts.vacuumFrom)
    w.hazards.push({ kind:'vacuum', x:rand(60,w.W-60), y:rand(60,w.H-60),
      vx:rand(-40,40), vy:rand(-40,40), ate:0, seed:Math.random()*9 });

  /* ---- balloons ---- */
  const n=4+level*2;
  for(let i=0;i<n;i++){
    const tier=Math.min(3,Math.floor(rand(0,1+level*0.55)));
    const p=Math.random()<0.18?pick(POWERS):null;
    /* The box has to be the balloon's ACTUAL size — this was a fixed 28px
       square regardless of scale, so on a small canvas balloons spawned
       inside the walls. */
    const br=15*w.S;
    const box=(x,y)=>({x:x-br,y:y-br,w:br*2,h:br*2});
    let x,y,tries=0;
    do{ x=rand(60,w.W-60); y=rand(50,w.H-90); tries++; }
    while(tries<40 && (w.carpets.some(r=>hitBox(box(x,y),r,30*w.S))
                    || w.walls.some(r=>hitBox(box(x,y),r,8*w.S))));
    w.balloons.push(makeBalloon(tier,x,y,p));
  }
}

function carpetUnder(c){
  return w.carpets.find(r=>c.x>r.x&&c.x<r.x+r.w&&c.y>r.y&&c.y<r.y+r.h)||null;
}
function onCarpet(c){ return !!carpetUnder(c); }

function collideWalls(b,bounce){
  for(const wl of w.walls){
    const cx=clamp(b.x,wl.x,wl.x+wl.w), cy=clamp(b.y,wl.y,wl.y+wl.h);
    let dx=b.x-cx, dy=b.y-cy, d=Math.hypot(dx,dy);
    if(d>=b.r) continue;
    if(d===0){ dy=-1; d=1; }
    const nx=dx/d, ny=dy/d;
    b.x+=nx*(b.r-d); b.y+=ny*(b.r-d);
    const vn=b.vx*nx+b.vy*ny;
    if(vn<0){ b.vx-=(1+bounce)*vn*nx; b.vy-=(1+bounce)*vn*ny; }
  }
}

/* Grounding: touch a radiator while charged and the lot goes to ground. */
function groundOn(c){
  for(const g of w.grounds){
    if(c.x>g.x-c.r&&c.x<g.x+g.w+c.r&&c.y>g.y-c.r&&c.y<g.y+g.h+c.r){
      if(c.charge>0.05){
        spark(c.x,c.y,'#ff9d9d',30);
        w.timeLeft=Math.max(0,w.timeLeft-1);
        toast('GROUNDED  -1s','#ff9d9d');
        c.charge=0;
      }
    }
  }
}

/* ---- lightning rods ----
   Stand under one and keep working and it will find you. The wind-up is long
   enough to be a decision: you are stationary and useless for half a second,
   which in a room with scissors in it is a real price for a full meter. */
function stepRods(c,dt){
  for(const r of w.rods){
    if(r.cool>0){ r.cool-=dt; r.wind=0; continue; }
    const near=Math.hypot(c.x-r.x,c.y-r.y)<r.reach;
    if(near && w.held){
      r.wind+=dt;
      if(r.wind>0.5){
        c.charge=1; c.strikeT=0.55; r.cool=8; r.wind=0;
        w.bolts.push({ x:r.x, y:r.y, tx:c.x, ty:c.y, age:0, seed:Math.random()*9 });
        toast('STRUCK BY LIGHTNING','#ffd88a');
        spark(c.x,c.y,'#ffd88a',30);
      }
    } else r.wind=Math.max(0,r.wind-dt*2);
  }
}

/* ---- the menagerie ---- */
function stepHazards(c,dt){
  for(const h of w.hazards){
    if(h.kind==='scissors'){
      /* Slow, patient, and impossible to outrun for ever. Touching it costs
         you balloons, not charge — they are cut loose and scatter back into
         the room, so it undoes work rather than ending the run. */
      const dx=c.x-h.x, dy=c.y-h.y, d=Math.hypot(dx,dy)||1;
      const sp=(46+7*w.level)*w.S;
      h.vx+=(dx/d*sp-h.vx)*dt*1.6; h.vy+=(dy/d*sp-h.vy)*dt*1.6;
      h.x+=h.vx*dt; h.y+=h.vy*dt;
      h.ang=Math.atan2(h.vy,h.vx);
      h.cut=Math.max(0,h.cut-dt);
      if(d<c.r+16*w.S && h.cut<=0 && c.carried.length){
        const n=Math.min(2,c.carried.length);
        for(let i=0;i<n;i++){
          const b=c.carried.pop();
          b.stuck=false;
          const a=rand(0,TAU);
          b.vx=Math.cos(a)*rand(160,300)*w.S; b.vy=Math.sin(a)*rand(160,300)*w.S;
          w.balloons.push(b);
        }
        h.cut=2.6;
        /* Seconds are points now, so a snip costs score as well as balloons.
           This is where the danger in the later rooms actually lives. */
        w.timeLeft=Math.max(0,w.timeLeft-2);
        toast('SNIP  -2s','#ff9d9d');
        spark(c.x,c.y,'#ff9d9d',14);
      }
    }
    else if(h.kind==='magnet'){
      /* It wants a charged cat, which is exactly the cat you are trying to
         be. The pull scales with your meter, so being full is a liability
         near it — the one thing in the game that argues against charging. */
      h.pulse+=dt;
      const dx=h.x-c.x, dy=h.y-c.y, d=Math.hypot(dx,dy)||1;
      if(d<230*w.S){
        const f=300*w.S*c.charge*(1-d/(230*w.S));
        c.vx+=dx/d*f*dt; c.vy+=dy/d*f*dt;
      }
    }
    else if(h.kind==='vacuum'){
      /* Not after you at all — after the balloons. It turns a room into a
         race, which is a different kind of pressure from being chased. */
      h.x+=h.vx*dt; h.y+=h.vy*dt;
      if(h.x<30*w.S||h.x>w.W-30*w.S) h.vx*=-1;
      if(h.y<30*w.S||h.y>w.H-30*w.S) h.vy*=-1;
      if(Math.random()<dt*0.6){ h.vx=rand(-60,60)*w.S; h.vy=rand(-60,60)*w.S; }
      for(const b of w.balloons.slice()){
        const dx=h.x-b.x, dy=h.y-b.y, d=Math.hypot(dx,dy)||1;
        if(d<90*w.S){
          b.vx+=dx/d*220*w.S*dt; b.vy+=dy/d*220*w.S*dt;
          if(d<26*w.S){
            w.balloons=w.balloons.filter(x=>x!==b);
            h.ate++; spark(h.x,h.y,'#6d7299',10); toast('HOOVERED','#6d7299');
            checkClear();
          }
        }
      }
    }
  }
}

/* A room can now empty without you having collected everything — the vacuum
   can eat the last balloon — so the clear check lives in one place. */
function checkClear(){ if(!w.balloons.length && w.running) winLevel(); }

/* ---- friction charging, the mechanic that won ---- */
function frictionCharge(c,dt){
  const rug=carpetUnder(c);
  if(!rug) return;
  const speed=Math.hypot(c.vx,c.vy);
  if(speed>45*w.S){
    /* Retuned once the steering got direct: a snappier cat skids faster, and
       at the old rate a standard rug filled the meter in well under a second,
       which made the grades indistinguishable because everything hit the cap.
       Swept against the 32-second clock AND against the short rugs: a rug you
       can cross in half a second cannot be skidded on as fast as a runway, so
       shortening the carpets pushed a full meter out to nearly five seconds,
       which is a sixth of the room's clock spent charging once. The rate went
       up to bring it back to about three. */
    c.charge=clamp(c.charge+Math.min(speed/(500*w.S),1)*1.85*rug.grade.mult*dt,0,1);
    if(Math.random()<0.4) spark(c.x,c.y+c.r*0.6,rug.grade.col,1);
  }
}

/* ---- collection ---- */
function tryTake(c,dt){
  const mode=CATCH[w.catch];
  const extra=grace()+(w.power.magnet>0?46*w.S:0);
  for(const b of w.balloons.slice()){
    const d=Math.hypot(b.x-c.x,b.y-c.y);
    const reach=c.r+b.r+extra;
    /* Cling reaches further than it takes: balloons are drawn in from about
       twice the catch distance, so the catch itself still has to be earned. */
    if(mode.pull && c.charge>=b.T.need && d<reach*2.1){
      /* The falloff keeps a floor on it. A pure linear ramp is nearly nothing
         at the outer edge, which made the drift take the better part of two
         seconds to close — far too slow to read as cling in a game you play at
         this speed. */
      const f=780*w.S*(0.30+0.70*(1-d/(reach*2.1)));
      b.vx+=(c.x-b.x)/d*f*dt; b.vy+=(c.y-b.y)/d*f*dt;
    }
    if(d<reach){
      if(c.charge>=b.T.need){ c.charge=clamp(c.charge-b.T.need*0.55,0,1); collect(b,c); }
      else if(Math.random()<0.08) spark(b.x,b.y,'#6b7397',2);
    }
  }
}

/* ================= drawing the room ================= */
function drawRoom(){
  for(const r of w.carpets){
    const G=r.grade, live=w.cat&&carpetUnder(w.cat)===r&&Math.hypot(w.cat.vx,w.cat.vy)>45*w.S;
    ctx.save();
    ctx.beginPath(); roundRect(r.x,r.y,r.w,r.h,9*w.S); ctx.clip();
    if(r.tex) ctx.drawImage(r.tex,r.x,r.y,r.w,r.h);
    if(live){ ctx.fillStyle='rgba(255,255,255,.10)'; ctx.fillRect(r.x,r.y,r.w,r.h); }
    ctx.restore();
    /* fringe on the short ends of a proper rug, which is most of what says
       "carpet" rather than "coloured rectangle" */
    if(G.key==='rug'){
      ctx.strokeStyle=r.tone.trim; ctx.globalAlpha=0.45; ctx.lineWidth=1.2*w.S;
      for(let yy=r.y+5*w.S; yy<r.y+r.h-4*w.S; yy+=5*w.S){
        ctx.beginPath(); ctx.moveTo(r.x,yy); ctx.lineTo(r.x-5*w.S,yy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r.x+r.w,yy); ctx.lineTo(r.x+r.w+5*w.S,yy); ctx.stroke();
      }
      ctx.globalAlpha=1;
    }
    ctx.strokeStyle=live?r.tone.trim:G.line+'.45)';
    ctx.lineWidth=(live?2.4:1.4)*w.S;
    roundRect(r.x,r.y,r.w,r.h,9*w.S); ctx.stroke();
    ctx.fillStyle=G.line+'.75)';
    ctx.font=`600 ${9*w.S}px "Space Grotesk", system-ui, sans-serif`;
    ctx.textAlign='center'; ctx.fillText(G.label,r.x+r.w/2,r.y+r.h-6*w.S);
  }
  for(const wl of w.walls){
    ctx.fillStyle='#2f3560'; ctx.strokeStyle='#3b4470'; ctx.lineWidth=1.5*w.S;
    roundRect(wl.x,wl.y,wl.w,wl.h,4*w.S); ctx.fill(); ctx.stroke();
  }
  const heat=w.cat?w.cat.charge:0;
  for(const g of w.grounds){
    if(heat>0.05){
      const gr=ctx.createRadialGradient(g.x+g.w/2,g.y+g.h/2,4,g.x+g.w/2,g.y+g.h/2,70*w.S*(0.5+heat));
      gr.addColorStop(0,`rgba(255,157,157,${0.05+0.25*heat})`);
      gr.addColorStop(1,'rgba(255,157,157,0)');
      ctx.fillStyle=gr; ctx.beginPath(); ctx.arc(g.x+g.w/2,g.y+g.h/2,70*w.S*(0.5+heat),0,TAU); ctx.fill();
    }
    ctx.fillStyle='rgba(168,173,207,.16)';
    ctx.strokeStyle=`rgba(255,157,157,${0.45+0.5*heat})`; ctx.lineWidth=(1.6+1.4*heat)*w.S;
    roundRect(g.x,g.y,g.w,g.h,5*w.S); ctx.fill(); ctx.stroke();
    ctx.strokeStyle='rgba(168,173,207,.45)'; ctx.lineWidth=2*w.S;
    for(let i=1;i<4;i++){
      ctx.beginPath(); ctx.moveTo(g.x+g.w*i/4,g.y+4*w.S); ctx.lineTo(g.x+g.w*i/4,g.y+g.h-4*w.S); ctx.stroke(); }
  }
  for(const r of w.rods) drawRod(r);
  for(const h of w.hazards) drawHazard(h);
}

function drawRod(r){
  const ready=r.cool<=0, k=r.wind/0.5;
  ctx.strokeStyle=ready?'#a8adcf':'rgba(168,173,207,.3)'; ctx.lineWidth=3*w.S; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(r.x,r.y+16*w.S); ctx.lineTo(r.x,r.y-22*w.S); ctx.stroke();
  ctx.fillStyle=ready?'#ffd88a':'#3b4470';
  ctx.beginPath(); ctx.arc(r.x,r.y-24*w.S,4.5*w.S,0,TAU); ctx.fill();
  ctx.fillStyle='rgba(168,173,207,.35)';
  ctx.beginPath(); ctx.ellipse(r.x,r.y+17*w.S,11*w.S,4*w.S,0,0,TAU); ctx.fill();
  if(ready&&k>0.02){
    /* the charge visibly gathering, so the wind-up is legible */
    ctx.strokeStyle=`rgba(255,216,138,${0.3+0.7*k})`; ctx.lineWidth=2*w.S;
    ctx.beginPath(); ctx.arc(r.x,r.y-24*w.S,(8+16*k)*w.S,0,TAU); ctx.stroke();
  }
}

function drawHazard(h){
  const S=w.S;
  if(h.kind==='scissors'){
    ctx.save(); ctx.translate(h.x,h.y); ctx.rotate(h.ang);
    ctx.strokeStyle=h.cut>0?'#ff9d9d':'#cdd4f5'; ctx.lineWidth=3*S; ctx.lineCap='round';
    for(const sgn of [-1,1]){
      ctx.beginPath(); ctx.moveTo(-11*S,sgn*5*S); ctx.lineTo(13*S,-sgn*4*S); ctx.stroke();
      ctx.beginPath(); ctx.arc(-15*S,sgn*7*S,5*S,0,TAU); ctx.stroke();
    }
    ctx.fillStyle='#8b93bb'; ctx.beginPath(); ctx.arc(0,0,2.6*S,0,TAU); ctx.fill();
    ctx.restore();
  }
  else if(h.kind==='magnet'){
    const pull=w.cat?w.cat.charge:0;
    if(pull>0.05){
      const g=ctx.createRadialGradient(h.x,h.y,4,h.x,h.y,230*S);
      g.addColorStop(0,`rgba(255,157,157,${0.04+0.10*pull})`);
      g.addColorStop(1,'rgba(255,157,157,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(h.x,h.y,230*S,0,TAU); ctx.fill();
    }
    ctx.lineCap='butt'; ctx.lineWidth=8*S;
    ctx.strokeStyle='#ff9d9d';
    ctx.beginPath(); ctx.arc(h.x,h.y,13*S,Math.PI,0); ctx.stroke();
    ctx.strokeStyle='#a8adcf'; ctx.lineWidth=8*S;
    ctx.beginPath(); ctx.moveTo(h.x-13*S,h.y); ctx.lineTo(h.x-13*S,h.y+9*S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(h.x+13*S,h.y); ctx.lineTo(h.x+13*S,h.y+9*S); ctx.stroke();
  }
  else if(h.kind==='vacuum'){
    ctx.fillStyle='#8b93bb';
    roundRect(h.x-14*S,h.y-10*S,28*S,20*S,5*S); ctx.fill();
    ctx.fillStyle='#3b4470';
    ctx.beginPath(); ctx.moveTo(h.x-14*S,h.y-2*S); ctx.lineTo(h.x-26*S,h.y-11*S);
    ctx.lineTo(h.x-26*S,h.y+7*S); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#6d7299';
    ctx.beginPath(); ctx.arc(h.x-8*S,h.y+11*S,4*S,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(h.x+8*S,h.y+11*S,4*S,0,TAU); ctx.fill();
  }
}

/* The bolt itself: a jagged line from off the top of the room, through the
   rod, into the cat. Short-lived and drawn over everything. */
function drawBolts(){
  for(const b of w.bolts){
    const k=1-b.age/0.35;
    if(k<=0) continue;
    ctx.strokeStyle=`rgba(255,255,255,${k})`; ctx.lineWidth=(3.4*k+1)*w.S;
    ctx.lineJoin='round';
    const seg=(x0,y0,x1,y1,n)=>{
      ctx.beginPath(); ctx.moveTo(x0,y0);
      for(let i=1;i<=n;i++){
        const f=i/n;
        ctx.lineTo(x0+(x1-x0)*f+(i<n?rand(-11,11)*w.S:0),
                   y0+(y1-y0)*f+(i<n?rand(-6,6)*w.S:0));
      }
      ctx.stroke();
    };
    seg(b.x,-10,b.x,b.y-24*w.S,5);
    seg(b.x,b.y-24*w.S,b.tx,b.ty,4);
    ctx.strokeStyle=`rgba(255,216,138,${k*0.75})`; ctx.lineWidth=(8*k+1)*w.S;
    seg(b.x,b.y-24*w.S,b.tx,b.ty,3);
  }
}

/* ================= the three prototypes =================
   Identical games. The only difference is what the later rooms contain, which
   is the one thing still open. */
function makeMode(key,name,blurb,catchKey){
  return {
    key, name, blurb, catchKey, decay:0.20, digIn:false,
    hint:'drag him fast across a carpet to charge — the shag is quickest',
    build(level){ buildRoom(level,ROOM); },
    chargeMult(){ return 0; },                 // friction charges, wagging does not
    step(dt){
      const c=w.cat;
      frictionCharge(c,dt);
      stepRods(c,dt);
      stepHazards(c,dt);
      groundOn(c);
      tryTake(c,dt);
      for(const b of w.balloons) collideWalls(b,0.6);
      for(const bo of w.bolts) bo.age+=dt;
      w.bolts=w.bolts.filter(bo=>bo.age<0.35);
      if(c.strikeT>0) c.strikeT-=dt;
    },
    drawFloor(){ drawRoom(); }
  };
}

/* Menagerie, which won round three. Every prototype below IS this game — the
   rods, the walls, the scissors, the magnet and the carpet grades are
   identical in all three. The only thing that differs is how a balloon is
   caught, because "I don't quite like how the radius works" is the one note I
   cannot act on without guessing which way. */
const ROOM={ rodsFrom:3, wallsFrom:4, scissorsFrom:3, magnetFrom:5, crowded:true };

/* Cling: the catch grows with the meter, and balloons you can afford drift in
   from about twice that distance. Picked over a flat catch and a charge-scaled
   one without the drift — it is the only one where the static behaves the way
   the fiction says it does. */
const MODE=makeMode('cling','Catstatic','','cling');
const MODES={ cling:MODE };   // one mode; the lookup stays so w.mode still resolves

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
  /* Stamped so the clear bonus can be paid on how long THIS room took, rather
     than on the shared clock — which carries over, and would otherwise pay you
     again for seconds you already banked. */
  w.roomStart=w.timeLeft;
  w.balloons=[]; w.sparks=[]; w.toasts=[]; w.power={};
  resize();
  w.cat=makeCat();
  MODES[w.mode].build(n);
  /* Walls are placed before the cat is positioned, and the old centre-of-room
     spawn dropped him inside one in about one room in nine. He now starts on
     the first rug, which place() has already proved is clear of every wall —
     and which is where you were going to go first anyway. */
  if(w.carpets.length){
    const r0=w.carpets[0];
    w.cat.x=r0.x+r0.w/2; w.cat.y=r0.y+r0.h/2;
    w.cat.vx=w.cat.vy=0;
  }
  w.running=true;
  boardUI.closePeek();
  $('entry').hidden=true;
  $('overlay').hidden=true;
  hud();
  cv.focus({preventScroll:true});
}
function newGame(){
  w.score=0; w.cleared=0; w.timeLeft=LEVEL_TIME;
  $('ov-final').hidden=true; $('entry').hidden=true; $('board').hidden=true;
  startLevel(1);
}
/* The clear bonus. Seconds you did NOT spend are the score, multiplied by the
   room number, so the leaderboard rewards clearing rooms fast and getting deep
   rather than mopping up every pink balloon in room one. A room that takes the
   full allowance pays nothing; a brisk one pays more than its balloons did. */
function clearBonus(){
  const used=Math.max(0,w.roomStart-w.timeLeft);
  const saved=Math.max(0,LEVEL_TIME-used);
  return { used, saved, pts:Math.round(saved*8*w.level) };
}
function winLevel(){
  w.running=false;
  const cb=clearBonus();
  w.score+=cb.pts;
  if(w.level>=9)
    return finish('Every room cleared',
      'Nine rooms of extremely charged cat. The last one went in '+cb.used.toFixed(1)+' seconds.');
  w.timeLeft+=12;
  toast('CLEARED IN '+cb.used.toFixed(1)+'s  +'+cb.pts,'#8fe3b0');
  setTimeout(()=>{
    $('ov-title').textContent='Room '+w.level+' cleared';
    $('ov-body').textContent='Cleared in '+cb.used.toFixed(1)+' seconds \u2014 '+cb.saved.toFixed(1)+
      ' spare, worth '+cb.pts+' points at room '+w.level+'. Twelve seconds back on the clock. '+
      (w.level+1===9?'Last room.':'');
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
  boardUI.finish();
}
function hud(){
  $('score').textContent=w.score;
  $('level').textContent=w.level+'/9';
  $('left').textContent=w.balloons.length;
  $('clock').textContent=Math.max(0,Math.ceil(w.timeLeft));
  const c=w.cat;
  $('charge-fill').style.width=(c?c.charge*100:0)+'%';
}

/* ================= this game's board =================
   Mechanics live in js/leaderboard.js, shared with the other four; only the
   store id and the local key are per-game, which is what keeps the boards
   independent of one another. */
const Board = makeBoard({
  id: 'ff808181a061cdc401a064da78860902',
  localKey: 'catstatic-board',
  storeName: 'schrodingerscards-catstatic-highscores'
});
const boardUI = attachBoardUI(Board, () => w.score);

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
  drawBolts();
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
    ctx.fillText(MODES[w.mode].hint||'press and scrub side to side on a rug',w.W/2,w.H-16*w.S);
  }
}

/* ================= wiring ================= */
/* The start screen. One mode, so this only ever resets it. */
function toStart(){
  w.mode='cling'; w.catch='cling';
  w.running=false; w.over=false;
  $('ov-title').textContent='Catstatic';
  $('ov-body').textContent='Skid him across the carpet until his fur stands on end, then collect the balloons it will hold. Nine rooms, one clock, and the time you save is the score.';
  $('ov-final').hidden=true; $('entry').hidden=true; $('board').hidden=true;
  $('go').textContent='Start';
  $('go').onclick=newGame;
  $('overlay').hidden=false;
  resize();
  w.cat=makeCat(); w.balloons=[]; w.level=1; w.score=0; w.timeLeft=LEVEL_TIME;
  hud();
}

resize();
toStart();
requestAnimationFrame(frame);
