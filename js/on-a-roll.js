/* ================= On a Roll =================
   Lives at on-a-roll.html. Depends on js/leaderboard.js for the score board.

   A cat has found the toilet roll. Somewhere down it is one square carrying
   the symbol you were shown; the job is to unspool the roll and stop dead on
   that square before you run past it.

   The control is the whole game. Press and hold to spin the roll and it keeps
   building speed the longer you hold; let go and it coasts down on an
   exponential settle. A quick TAP adds speed too - so mashing gets you moving
   fast - while pressing and HOLDING while it is already moving is the brake.
   Tap to go faster, hold to stop; the roll never looks at the clock, only at
   whether this press is a flick or a hold, which is what makes stopping
   reliable even in the middle of a mash.

   Landing is judged by a selector of FIXED height while the paper squares
   shrink toward it as the levels go on. A square has to cover the selector
   completely, so level one is loose - the square is three times the box - and
   by the late levels it is barely taller than the box and you have to be
   precise. Overshooting does not freeze the roll: it keeps coasting, three
   times faster than an ordinary landing, and the miss lands when it settles.

   Hazards have to be STOPPED on, not merely passed over: a skull ends the run
   outright, a cracked heart costs a life, a broken clock costs seven seconds.
   A mushroom sets the cat tripping for six seconds, which is a visual problem
   rather than a mechanical one - the room goes psychedelic and the paper
   tints, but the physics never change. */
(function(){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const TAU=Math.PI*2;
/* Stable pseudo-random keyed by an integer — the paper pile has to look
   randomly crumpled but must NOT reshuffle itself every frame, so every
   piece derives its position and size from its own index instead of
   Math.random(). */
function nrnd(n){ const x=Math.sin(n*127.1+311.7)*43758.5453; return x-Math.floor(x); }
const ink='#141830';
const COLORS={ paper:'#f3ecd9', paperShade:'#dccca1', paperLine:'#b8a06a', gold:'#ffd88a',
  pink:'#ff8fd0', danger:'#ff5a5a', good:'#8fe3b0', amber:'#ffb15a', shroom:'#e0b3ff',
  accent:'#7dd8ff', accent2:'#b48bff', surface2:'#1b2040', border:'#2a2f52', textDim:'#a8adcf', bg:'#0a0d18',
  hazHeart:'#5c2430', hazClock:'#5c3a1a', hazSkull:'#3a1016', mystery:'#e8e8f0' };

/* ---------------- icons ---------------- */
let ctx0=null;
function drawStar(cx,cy,r){
  ctx0.beginPath();
  for(let i=0;i<10;i++){
    const a=-Math.PI/2+i*Math.PI/5, rr=i%2?r*0.42:r;
    const x=cx+Math.cos(a)*rr, y=cy+Math.sin(a)*rr;
    i?ctx0.lineTo(x,y):ctx0.moveTo(x,y);
  }
  ctx0.closePath(); ctx0.fill();
}
function drawDiamond(cx,cy,r){
  ctx0.beginPath();
  ctx0.moveTo(cx,cy-r); ctx0.lineTo(cx+r*0.75,cy); ctx0.lineTo(cx,cy+r); ctx0.lineTo(cx-r*0.75,cy);
  ctx0.closePath(); ctx0.fill();
}
function drawRingIcon(cx,cy,r){
  ctx0.beginPath(); ctx0.arc(cx,cy,r,0,TAU); ctx0.arc(cx,cy,r*0.52,0,TAU,true); ctx0.fill('evenodd');
}
function drawClockIcon(cx,cy,r){
  ctx0.beginPath(); ctx0.arc(cx,cy,r,0,TAU); ctx0.fill();
  ctx0.save(); ctx0.strokeStyle='#fff'; ctx0.lineWidth=r*0.16; ctx0.lineCap='round';
  ctx0.beginPath(); ctx0.moveTo(cx,cy); ctx0.lineTo(cx,cy-r*0.55); ctx0.stroke();
  ctx0.beginPath(); ctx0.moveTo(cx,cy); ctx0.lineTo(cx+r*0.4,cy+r*0.15); ctx0.stroke();
  ctx0.restore();
}
function drawHeartIcon(cx,cy,r){
  ctx0.beginPath();
  ctx0.moveTo(cx,cy+r*0.5);
  ctx0.bezierCurveTo(cx-r*0.9,cy-r*0.1,cx-r*0.4,cy-r*0.75,cx,cy-r*0.25);
  ctx0.bezierCurveTo(cx+r*0.4,cy-r*0.75,cx+r*0.9,cy-r*0.1,cx,cy+r*0.5);
  ctx0.fill();
}
function drawSkull(cx,cy,r){
  ctx0.fillStyle='#fff';
  ctx0.beginPath(); ctx0.arc(cx,cy-r*0.10,r*0.82,0,TAU); ctx0.fill();
  ctx0.fillRect(cx-r*0.5,cy+r*0.18,r,r*0.5);
  ctx0.fillStyle=COLORS.hazSkull;
  ctx0.beginPath(); ctx0.ellipse(cx-r*0.30,cy-r*0.12,r*0.20,r*0.26,0,0,TAU); ctx0.fill();
  ctx0.beginPath(); ctx0.ellipse(cx+r*0.30,cy-r*0.12,r*0.20,r*0.26,0,0,TAU); ctx0.fill();
  ctx0.beginPath(); ctx0.moveTo(cx,cy+r*0.04); ctx0.lineTo(cx-r*0.09,cy+r*0.26); ctx0.lineTo(cx+r*0.09,cy+r*0.26); ctx0.closePath(); ctx0.fill();
  for(const dx of [-0.30,-0.08,0.14,0.36]) ctx0.fillRect(cx+dx*r,cy+r*0.40,r*0.10,r*0.16);
}
function drawCrackedHeart(cx,cy,r){
  ctx0.fillStyle='#fff';
  ctx0.beginPath();
  ctx0.moveTo(cx,cy+r*0.5);
  ctx0.bezierCurveTo(cx-r*0.9,cy-r*0.1,cx-r*0.4,cy-r*0.75,cx,cy-r*0.25);
  ctx0.bezierCurveTo(cx+r*0.4,cy-r*0.75,cx+r*0.9,cy-r*0.1,cx,cy+r*0.5);
  ctx0.fill();
  ctx0.strokeStyle=COLORS.hazHeart; ctx0.lineWidth=r*0.13; ctx0.lineCap='round'; ctx0.lineJoin='round';
  ctx0.beginPath();
  ctx0.moveTo(cx-r*0.10,cy-r*0.35); ctx0.lineTo(cx+r*0.08,cy-r*0.05); ctx0.lineTo(cx-r*0.08,cy+r*0.12); ctx0.lineTo(cx+r*0.10,cy+r*0.42);
  ctx0.stroke();
}
function drawBrokenClock(cx,cy,r){
  ctx0.fillStyle='#fff'; ctx0.beginPath(); ctx0.arc(cx,cy,r,0,TAU); ctx0.fill();
  ctx0.strokeStyle=COLORS.hazClock; ctx0.lineWidth=r*0.15; ctx0.lineCap='round';
  ctx0.beginPath(); ctx0.moveTo(cx,cy); ctx0.lineTo(cx-r*0.42,cy-r*0.30); ctx0.stroke();
  ctx0.beginPath(); ctx0.moveTo(cx,cy); ctx0.lineTo(cx+r*0.5,cy+r*0.12); ctx0.stroke();
  ctx0.lineWidth=r*0.10;
  ctx0.beginPath(); ctx0.moveTo(cx-r*0.72,cy-r*0.72); ctx0.lineTo(cx+r*0.1,cy+r*0.1); ctx0.lineTo(cx+r*0.72,cy+r*0.5); ctx0.stroke();
}
function drawMushroom(cx,cy,r){
  ctx0.fillStyle='#f2e6d0'; ctx0.fillRect(cx-r*0.18,cy-r*0.05,r*0.36,r*0.58);
  ctx0.fillStyle='#c0392b';
  ctx0.beginPath(); ctx0.ellipse(cx,cy-r*0.15,r*0.85,r*0.55,0,Math.PI,0); ctx0.fill();
  ctx0.fillStyle='#fff';
  for(const [dx,dy,rr] of [[-0.36,-0.28,0.11],[0.06,-0.42,0.10],[0.42,-0.16,0.10]]){
    ctx0.beginPath(); ctx0.arc(cx+dx*r,cy+dy*r,rr*r,0,TAU); ctx0.fill();
  }
}
function drawMystery(cx,cy,r){
  ctx0.fillStyle=ink;
  ctx0.font='700 '+(r*1.7)+'px "Space Grotesk", sans-serif';
  ctx0.textAlign='center'; ctx0.textBaseline='middle';
  ctx0.fillText('?', cx, cy+r*0.06);
}
const TARGET_ICONS=['star','diamond','ring'];
const ICONS={ star:drawStar, diamond:drawDiamond, ring:drawRingIcon, clock:drawClockIcon, heart:drawHeartIcon,
  skull:drawSkull, hazheart:drawCrackedHeart, hazclock:drawBrokenClock, mushroom:drawMushroom, mystery:drawMystery };

const POWERS=[
  { key:'clock', col:COLORS.accent, fx:g=>{ g.timeLeft=Math.min(g.timeCap,g.timeLeft+8); toast(g,'+8s',COLORS.accent); } },
  { key:'heart', col:COLORS.pink,   fx:g=>{ g.lives=Math.min(9,g.lives+1); toast(g,'+1 LIFE',COLORS.pink); } }
];
const HAZARDS=[
  { key:'hazheart', col:COLORS.hazHeart, fx:g=>{ g.lives--; toast(g,'-1 LIFE',COLORS.danger); if(g.lives<=0) g.status='over'; } },
  { key:'hazclock', col:COLORS.hazClock, fx:g=>{ g.timeLeft=Math.max(0,g.timeLeft-7); toast(g,'-7s',COLORS.amber); } }
];

function toast(g,text,color){ g.toastT=1; g.toastText=text; g.toastColor=color; }

/* ---------------- level shape ---------------- */
function levelParams(level){
  return { depth: 8+(level-1)*7, time: Math.max(14, 34-(level-1)*3) };
}
function makeLevel(level){
  const p=levelParams(level);
  const total=p.depth+4+Math.round(Math.random()*4);
  const target=p.depth+Math.round(Math.random()*2)-1;
  const squares=new Array(total+3).fill(null).map(()=>({ kind:'plain' }));
  const targetIcon=TARGET_ICONS[Math.floor(Math.random()*TARGET_ICONS.length)];
  squares[target]={ kind:'target', icon:targetIcon };
  const used=new Set([target]);
  function place(kind,extra){
    let tries=0;
    while(tries<25){
      tries++;
      const c=Math.round(2+Math.random()*(target-3));
      if(c<2||used.has(c)) continue;
      used.add(c);
      squares[c]=Object.assign({ kind },extra||{});
      return true;
    }
    return false;
  }
  const powerCount=level>3?2:1;
  for(let i=0;i<powerCount;i++) place('power',{ power:POWERS[Math.floor(Math.random()*POWERS.length)] });

  const hazardCount=1+Math.floor((level-1)/2);
  for(let i=0;i<hazardCount;i++){
    const roll=Math.random();
    if(roll<0.18) place('skull');
    else place('hazard',{ hazard:HAZARDS[Math.floor(Math.random()*HAZARDS.length)] });
  }
  place('mushroom');
  if(Math.random()<0.5) place('mystery');

  return { squares, target, total, targetIcon, timeLimit:p.time };
}

/* ---------------- press-and-hold physics ----------------
   Settled numbers (Snappy's ramp/decay, plus the Kick tap bonus). Touch
   down moves it right away, speed builds toward VMAX over RAMP seconds,
   release lets it coast on the exponential settle, a press after a real
   pause while it's still moving is the brake, and a rapid second tap
   resumes the ramp and adds TAP_KICK instead of braking. */
const PRESETS={
  kick: { RAMP:0.7, VMIN:0.9, VMAX:9.0, DMIN:0.8, DMAX:5.0, TAP_MAX_DUR:0.14, TAP_KICK:1.3 }
};
const BRAKE_ENGAGE=0.25, BRAKE_TIME=0.16;
/* Overshoot always re-solves for a much harder stop than an ordinary
   landing gets, regardless of preset or how fast the miss was carrying. */
const OVERSHOOT_BOOST=3.0;
const TRIP_TIME=6, SETTLE_EPS=0.05;
/* Landing. The selector is a FIXED height — always this fraction of the
   roll's width, at every level — while the paper squares shrink toward
   it as levels get harder. A square must cover the selector completely
   to count, so early on (tall squares, small box) there's a lot of slack
   and by the late levels the square is barely bigger than the box.
   Tolerance goes 0.70 -> 0.12 of a square's travel, versus a flat 0.50
   under the old "75% of the square inside the box" rule. */
const SEL_FRAC=0.30;

/* ---------------- one game instance per prototype ---------------- */
function makeGame(){
  const cv=document.getElementById('stage'), ctx=cv.getContext('2d');
  const banner=document.getElementById('banner');
  const P=PRESETS.kick;
  let onEnd=()=>{};
  const g={
    W:0,H:0, running:false, raf:null, t:0, score:0, resumeAt:0,
    dist:0, vel:0, decay:0, holding:false, holdStart:0, downAt:-99, pressWhileMoving:false,
    braking:false, brakeStart:0, brakeV0:0, overshootPending:false,
    level:1, timeLeft:0, timeCap:0,
    lives:9, status:'play', face:'idle', bustedAt:-99, shake:0, catSeed:Math.random()*9,
    lvl:null, tripUntil:0, streak:0, toastT:0, toastText:'', toastColor:''
  };

  /* Level 1 is a true square (height == the roll's fixed width). Deeper
     levels flatten that square into a wider rectangle by shrinking only
     the height — the width never changes, so the selector (which always
     matches this same height) stays honest to what's on screen. */
  function sheetShrink(){ return Math.max(0.42,1-(g.level-1)*0.09); }
  /* Selector height as a fraction of the CURRENT square's height. Rises
     with the level purely because the square is shrinking under it. */
  function selK(){ return clamp(SEL_FRAC/sheetShrink(),0.05,0.92); }
  /* The band of frac(dist) where the square fully covers the selector. */
  function captureWindow(){ const k=selK(); return [k/2,1-k/2]; }
  function inCapture(){ const f=overlapFrac(), w=captureWindow(); return f>=w[0]&&f<=w[1]; }
  function tripping(){ return g.t<g.tripUntil; }
  function holdV(f){ return P.VMIN+(P.VMAX-P.VMIN)*f; }
  function holdD(f){ return P.DMIN+(P.DMAX-P.DMIN)*f; }
  function releaseDecayFor(vel){
    const f=clamp(vel/P.VMAX,0,1);
    return vel/Math.max(0.3,holdD(f));
  }
  function rampTimeFor(vel){
    const f=clamp((vel-P.VMIN)/(P.VMAX-P.VMIN),0,1);
    return f*P.RAMP;
  }

  function resize(){
    const dpr=Math.min(devicePixelRatio||1,2), r=cv.getBoundingClientRect();
    g.W=r.width; g.H=r.height;
    cv.width=Math.round(g.W*dpr); cv.height=Math.round(g.H*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  function newLevel(){
    g.lvl=makeLevel(g.level);
    g.dist=0; g.vel=0; g.decay=0; g.holding=false; g.braking=false; g.overshootPending=false; g.tripUntil=0;
    g.downAt=-99; g.pressWhileMoving=false;
    g.timeLeft=g.lvl.timeLimit; g.timeCap=g.lvl.timeLimit+15;
    g.status='play'; g.face='idle'; g.resumeAt=0;
  }
  function reset(fullGame){
    if(fullGame){ g.lives=9; g.level=1; g.streak=0; g.score=0; }
    newLevel();
    hideBanner();
    syncHud();
  }

  function curIdx(){ return Math.floor(g.dist); }
  function overlapFrac(){ return g.dist-curIdx(); }

  function onSettle(){
    if(!inCapture()) return;
    const sq=g.lvl.squares[curIdx()];
    if(!sq) return;
    if(sq.kind==='target'){
      g.status='win'; g.face='win'; g.streak++;
      /* Depth is what the board should reward, so the level is the
         multiplier. The clock bonus is what makes a fast, confident run
         beat a cautious one that scraped in with a second to spare. */
      const gain=100*g.level+Math.round(g.timeLeft)*5;
      g.score+=gain;
      let bonus='';
      if(g.streak>0 && g.streak%2===0 && g.lives<9){ g.lives=Math.min(9,g.lives+1); bonus=' +1 life.'; }
      announce('win','Found it! +'+gain+bonus,1.15);
      g.level++;
    } else if(sq.kind==='power'){
      sq.kind='spent'; sq.power.fx(g); g.score+=25;
    } else if(sq.kind==='hazard'){
      sq.kind='spent'; sq.hazard.fx(g);
      if(g.lives<=0) endRun('Out of lives.');
    } else if(sq.kind==='skull'){
      sq.kind='spent'; endRun('A skull. That ends a run outright, however many lives are left.');
    } else if(sq.kind==='mushroom'){
      sq.kind='spent'; g.tripUntil=g.t+TRIP_TIME; toast(g,'TRIPPING',COLORS.shroom);
    } else if(sq.kind==='mystery'){
      sq.kind='spent';
      if(Math.random()<0.5){ g.timeLeft=Math.min(g.timeCap,g.timeLeft+12); toast(g,'+12s!',COLORS.gold); g.score+=25; }
      else { g.lives=Math.max(0,g.lives-2); toast(g,'-2 LIVES',COLORS.danger); if(g.lives<=0) endRun('Out of lives.'); }
    }
  }

  function finalizeOvershoot(){
    g.overshootPending=false;
    g.lives--; g.face='busted'; g.bustedAt=g.t; g.shake=1; g.streak=0;
    if(g.lives<=0) return endRun('Overshot it — that was the last life.');
    g.status='lose';
    announce('lose', `Overshot it — ${g.lives} ${g.lives===1?'life':'lives'} left.`, 1.35);
  }

  /* Between-level messages sit on a strip over the canvas; only the end of
     a run is worth taking over the whole screen with the overlay. Every one
     of them clears itself, so a run never sits waiting on a click - though
     pressing during the hold skips it. */
  function announce(kind,msg,hold){
    banner.className='banner show '+kind;
    banner.querySelector('p').textContent=msg;
    g.resumeAt=g.t+hold;
  }
  function hideBanner(){ banner.className='banner'; }
  function resume(){
    hideBanner();
    newLevel();
    syncHud();
  }
  function endRun(why){
    g.status='over'; g.face='busted'; g.bustedAt=g.t; g.resumeAt=0;
    hideBanner();
    onEnd(why);
  }

  function step(dt){
    g.t+=dt;
    g.toastT=Math.max(0,g.toastT-dt*1.1);
    if(g.status!=='play'){
      if(g.status!=='over' && g.resumeAt && g.t>=g.resumeAt) resume();
      draw(); syncSpeed(); return;
    }

    if(!g.overshootPending){
      g.timeLeft-=dt;
      if(g.timeLeft<=0){
        g.timeLeft=0; g.lives--; g.face='busted'; g.bustedAt=g.t; g.shake=1; g.streak=0;
        if(g.lives<=0) endRun('Out of time — that was the last life.');
        else { g.status='lose'; announce('lose', `Out of time — ${g.lives} ${g.lives===1?'life':'lives'} left.`, 1.35); }
        syncHud(); draw(); return;
      }
    }

    const wasMoving=g.vel>SETTLE_EPS;

    if(g.pressWhileMoving && !g.overshootPending && (g.t-g.downAt)>=P.TAP_MAX_DUR){
      g.braking=true; g.brakeStart=g.t; g.brakeV0=g.vel; g.pressWhileMoving=false;
    }

    if(g.braking){
      const f=clamp((g.t-g.brakeStart)/BRAKE_TIME,0,1);
      g.vel=g.brakeV0*(1-f);
      if(f>=1){ g.vel=0; g.braking=false; }
    } else if(g.holding){
      g.vel=holdV(clamp((g.t-g.holdStart)/P.RAMP,0,1));
    } else if(g.vel>0){
      g.vel*=Math.exp(-g.decay*dt);
      if(g.vel<0.001) g.vel=0;
    }

    g.dist+=g.vel*dt;
    const newIdx=curIdx();

    if(g.overshootPending){
      if(wasMoving && g.vel<=SETTLE_EPS) finalizeOvershoot();
    } else if(newIdx>g.lvl.target){
      g.decay=Math.max(g.decay||0, releaseDecayFor(g.vel))*OVERSHOOT_BOOST;
      g.overshootPending=true; g.holding=false; g.braking=false; g.pressWhileMoving=false;
    } else if(wasMoving && g.vel<=SETTLE_EPS){
      onSettle();
    }
    syncHud(); syncSpeed();
    draw();
  }

  function syncHud(){
    document.getElementById('score').textContent=g.score;
    document.getElementById('lives').textContent=g.lives;
    document.getElementById('level').textContent=g.level;
    const timeEl=document.getElementById('time');
    timeEl.textContent=g.timeLeft.toFixed(1);
    timeEl.classList.toggle('danger', g.timeLeft<6);
    timeEl.classList.toggle('warn', g.timeLeft>=6&&g.timeLeft<12);
    const fc=document.getElementById('find-icon'), fctx=fc.getContext('2d');
    fctx.clearRect(0,0,32,32);
    ctx0=fctx; fctx.fillStyle=COLORS.gold;
    ICONS[g.lvl.targetIcon](16,16,12);
  }
  function syncSpeed(){
    document.getElementById('speed-fill').style.width=(clamp(g.vel/P.VMAX,0,1)*100)+'%';
  }

  /* ---------------- shared drawing helpers ---------------- */
  function roundRect(x,y,w,h,r){
    ctx.beginPath(); ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
  }
  function squareFill(sq){
    if(sq.kind==='target') return COLORS.gold;
    if(sq.kind==='power') return sq.power.col;
    if(sq.kind==='hazard') return sq.hazard.col;
    if(sq.kind==='skull') return COLORS.hazSkull;
    if(sq.kind==='mushroom') return COLORS.shroom;
    if(sq.kind==='mystery') return COLORS.mystery;
    if(sq.kind==='spent') return COLORS.paperShade;
    return COLORS.paper;
  }
  function squareIconAt(sq,x,y,r){
    ctx0=ctx;
    if(sq.kind==='target'){ ctx.fillStyle=ink; ICONS[sq.icon](x,y,r); }
    else if(sq.kind==='power'){ ctx.fillStyle=ink; ICONS[sq.power.key](x,y,r); }
    else if(sq.kind==='hazard'){ ICONS[sq.hazard.key](x,y,r); }
    else if(sq.kind==='skull'){ ICONS.skull(x,y,r); }
    else if(sq.kind==='mushroom'){ ICONS.mushroom(x,y,r); }
    else if(sq.kind==='mystery'){ ICONS.mystery(x,y,r); }
  }
  function drawSpeedLines(x,y,w,vel){
    const n=clamp(Math.round(vel*0.7),0,5);
    ctx.strokeStyle=`rgba(238,240,251,${clamp(vel/P.VMAX,0,1)*0.5})`;
    ctx.lineWidth=2; ctx.lineCap='round';
    for(let i=0;i<n;i++){
      const yy=y-i*7-4;
      ctx.beginPath(); ctx.moveTo(x-w*0.30,yy); ctx.lineTo(x+w*0.30,yy); ctx.stroke();
    }
  }

  /* ---------------- the cat ---------------- */
  function drawCat(cx,baseY,R,reachX,reachY){
    const t=g.t, seed=g.catSeed;
    const shakeX=g.shake>0?(Math.random()-0.5)*R*0.08*g.shake:0;
    const busted=g.face==='busted', win=g.face==='win';
    const tearAge=t-g.bustedAt;
    ctx.save(); ctx.translate(cx+shakeX,baseY);
    if(busted) ctx.rotate(-0.12);
    else if(win) ctx.rotate(0.03);
    const fur=COLORS.accent2, mark='#8a63d6';

    ctx.strokeStyle=fur; ctx.lineWidth=R*0.17; ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(-R*0.40,-R*0.55);
    ctx.quadraticCurveTo(-R*0.98,-R*0.30,-R*0.86,R*0.02);
    ctx.quadraticCurveTo(-R*0.76,R*0.24,-R*0.40,R*0.10);
    ctx.stroke();

    ctx.fillStyle=fur;
    ctx.beginPath();
    ctx.moveTo(-R*0.46,0);
    ctx.quadraticCurveTo(-R*0.60,-R*0.30,-R*0.50,-R*0.62);
    ctx.quadraticCurveTo(-R*0.40,-R*1.00,-R*0.06,-R*1.18);
    ctx.quadraticCurveTo(R*0.06,-R*1.24,R*0.10,-R*1.34);
    ctx.lineTo(R*0.02,-R*1.50);
    ctx.lineTo(R*0.17,-R*1.40);
    ctx.quadraticCurveTo(R*0.24,-R*1.32,R*0.30,-R*1.30);
    ctx.lineTo(R*0.28,-R*1.54);
    ctx.lineTo(R*0.44,-R*1.32);
    ctx.quadraticCurveTo(R*0.50,-R*1.27,R*0.56,-R*1.24);
    ctx.quadraticCurveTo(R*0.68,-R*1.14,R*0.72,-R*0.98);
    ctx.quadraticCurveTo(R*0.75,-R*0.86,R*0.68,-R*0.80);
    ctx.quadraticCurveTo(R*0.58,-R*0.74,R*0.52,-R*0.80);
    ctx.quadraticCurveTo(R*0.44,-R*0.66,R*0.42,-R*0.50);
    ctx.quadraticCurveTo(R*0.46,-R*0.28,R*0.36,-R*0.10);
    ctx.quadraticCurveTo(R*0.28,R*0.04,R*0.10,R*0.06);
    ctx.lineTo(-R*0.30,R*0.06);
    ctx.quadraticCurveTo(-R*0.42,R*0.05,-R*0.46,0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle='rgba(10,13,24,.22)'; ctx.lineWidth=1.4; ctx.stroke();

    ctx.fillStyle='#5c3f99';
    ctx.beginPath(); ctx.moveTo(R*0.08,-R*1.44); ctx.lineTo(R*0.14,-R*1.47); ctx.lineTo(R*0.17,-R*1.39); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(R*0.33,-R*1.36); ctx.lineTo(R*0.35,-R*1.46); ctx.lineTo(R*0.41,-R*1.36); ctx.closePath(); ctx.fill();

    ctx.fillStyle='rgba(255,255,255,.10)';
    ctx.beginPath(); ctx.ellipse(R*0.30,-R*0.35,R*0.16,R*0.34,0.2,0,TAU); ctx.fill();

    ctx.fillStyle=fur;
    ctx.beginPath(); ctx.ellipse(-R*0.06,R*0.02,R*0.17,R*0.10,0,0,TAU); ctx.fill();
    ctx.strokeStyle='rgba(10,13,24,.22)'; ctx.lineWidth=1.2; ctx.stroke();

    ctx.strokeStyle=fur; ctx.lineWidth=R*0.15; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(R*0.40,-R*0.60); ctx.quadraticCurveTo(R*0.50,-R*0.40,R*0.44,-R*0.16); ctx.stroke();
    ctx.fillStyle=fur; ctx.beginPath(); ctx.arc(R*0.44,-R*0.14,R*0.11,0,TAU); ctx.fill();

    const ex=R*0.58,ey=-R*1.05, er=R*0.135;
    const trip=tripping()&&!busted&&!win;
    function teardrop(tx,ty,s){
      ctx.beginPath();
      ctx.moveTo(tx,ty-s*1.35);
      ctx.quadraticCurveTo(tx+s*0.85,ty-s*0.10,tx+s*0.72,ty+s*0.34);
      ctx.quadraticCurveTo(tx+s*0.50,ty+s*0.95,tx,ty+s*0.95);
      ctx.quadraticCurveTo(tx-s*0.50,ty+s*0.95,tx-s*0.72,ty+s*0.34);
      ctx.quadraticCurveTo(tx-s*0.85,ty-s*0.10,tx,ty-s*1.35);
      ctx.closePath();
    }
    if(busted){
      /* Eye squeezed shut and curving DOWN at the outer corner, plus a
         crease beneath it — the shape does the sad work, the tear only
         confirms it. */
      ctx.strokeStyle=ink; ctx.lineWidth=R*0.034; ctx.lineCap='round';
      ctx.beginPath();
      ctx.moveTo(ex-er*1.05,ey-er*0.32);
      ctx.quadraticCurveTo(ex-er*0.10,ey+er*0.72,ex+er*1.05,ey-er*0.12);
      ctx.stroke();
      ctx.save(); ctx.globalAlpha=0.45; ctx.lineWidth=R*0.019;
      ctx.beginPath();
      ctx.moveTo(ex-er*0.72,ey+er*0.30);
      ctx.quadraticCurveTo(ex-er*0.05,ey+er*1.00,ex+er*0.78,ey+er*0.36);
      ctx.stroke(); ctx.restore();
      /* Brow driven up at the inner end — the classic sad angle. */
      ctx.strokeStyle=mark; ctx.lineWidth=R*0.026;
      ctx.beginPath();
      ctx.moveTo(ex-er*0.95,ey-er*0.86);
      ctx.quadraticCurveTo(ex,ey-er*1.05,ex+er*0.90,ey-er*1.50);
      ctx.stroke();
      /* Deep frown with a wobbling lower lip. */
      const lip=Math.sin(t*7.5)*R*0.012;
      ctx.strokeStyle=ink; ctx.lineWidth=R*0.036; ctx.lineCap='round';
      ctx.beginPath();
      ctx.moveTo(R*0.38,-R*0.72);
      ctx.quadraticCurveTo(R*0.58,-R*0.55,R*0.78,-R*0.71);
      ctx.stroke();
      ctx.strokeStyle='rgba(20,24,48,.45)'; ctx.lineWidth=R*0.020;
      ctx.beginPath();
      ctx.moveTo(R*0.44,-R*0.665+lip);
      ctx.quadraticCurveTo(R*0.58,-R*0.60+lip,R*0.72,-R*0.66+lip);
      ctx.stroke();
      /* Three tears on staggered loops, so the crying keeps going
         instead of stopping after one drop. */
      for(let k=0;k<3;k++){
        const ta=tearAge-k*0.43;
        if(ta<0) continue;
        const f=(ta%1.30)/1.30;
        const ty=ey+er*0.50+f*R*0.50;
        const s=er*0.52*(1-f*0.22);
        ctx.save();
        ctx.globalAlpha=(f<0.12?f/0.12:(f>0.55?Math.max(0,(1-f)/0.45):1))*0.92;
        ctx.fillStyle='rgba(125,216,255,.95)';
        teardrop(ex-er*0.34+k*er*0.16,ty,s); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,.55)';
        ctx.beginPath();
        ctx.ellipse(ex-er*0.34+k*er*0.16-s*0.22,ty-s*0.28,s*0.18,s*0.30,0,0,TAU);
        ctx.fill();
        ctx.restore();
      }
      /* A drop still welling at the corner of the eye. */
      ctx.fillStyle='rgba(125,216,255,.85)';
      teardrop(ex-er*0.42,ey+er*0.34,er*0.34*(0.85+Math.sin(t*3.2)*0.15)); ctx.fill();
    } else if(win){
      /* Two real lenses with a bridge and a temple arm running back to
         the ear, rather than one flat visor bar. */
      const lensW=er*1.62, lensH=er*1.34;
      const nearX=ex+er*0.58, farX=ex-er*1.32;
      ctx.strokeStyle='#080b16'; ctx.lineWidth=er*0.26; ctx.lineCap='round';
      ctx.beginPath();
      ctx.moveTo(farX-lensW*0.40,ey-lensH*0.14);
      ctx.quadraticCurveTo(ex-er*2.05,ey-er*0.42,ex-er*2.30,ey-er*0.62);
      ctx.stroke();
      for(const [lcx,lw,lh] of [[farX,lensW*0.90,lensH*0.90],[nearX,lensW,lensH]]){
        ctx.fillStyle='#080b16';
        roundRect(lcx-lw/2,ey-lh/2,lw,lh,lh*0.36); ctx.fill();
        const lg=ctx.createLinearGradient(lcx-lw/2,ey-lh/2,lcx+lw/2,ey+lh/2);
        lg.addColorStop(0,'rgba(125,216,255,.60)');
        lg.addColorStop(0.55,'rgba(180,139,255,.32)');
        lg.addColorStop(1,'rgba(10,13,26,.20)');
        ctx.fillStyle=lg;
        roundRect(lcx-lw*0.40,ey-lh*0.34,lw*0.80,lh*0.68,lh*0.26); ctx.fill();
      }
      ctx.strokeStyle='#080b16'; ctx.lineWidth=er*0.19;
      ctx.beginPath();
      ctx.moveTo(farX+lensW*0.42,ey-lensH*0.20);
      ctx.quadraticCurveTo((farX+nearX)/2,ey-lensH*0.46,nearX-lensW*0.44,ey-lensH*0.18);
      ctx.stroke();
      /* Glint sweeping across the near lens, clipped to its shape. */
      ctx.save();
      roundRect(nearX-lensW/2,ey-lensH/2,lensW,lensH,lensH*0.36); ctx.clip();
      const gp=(t*0.6)%1.6;
      ctx.strokeStyle='rgba(255,255,255,.85)'; ctx.lineWidth=er*0.20; ctx.lineCap='round';
      const gx=nearX-lensW*0.85+gp*lensW*1.05;
      ctx.beginPath();
      ctx.moveTo(gx-lensH*0.32,ey+lensH*0.62); ctx.lineTo(gx+lensH*0.32,ey-lensH*0.62);
      ctx.stroke();
      ctx.restore();
      /* Open, toothy, thoroughly pleased-with-itself grin. */
      /* Open grin: a near-straight top edge with the teeth tucked under
         it, and a deep downward bulge for the bottom lip. */
      const m0=R*0.40, m1=R*0.82, my=-R*0.76;
      const mouth=()=>{
        ctx.beginPath();
        ctx.moveTo(m0,my);
        ctx.quadraticCurveTo((m0+m1)/2,my-R*0.030,m1,my);
        ctx.quadraticCurveTo((m0+m1)/2,my+R*0.265,m0,my);
        ctx.closePath();
      };
      ctx.fillStyle='#2a0f1c'; mouth(); ctx.fill();
      ctx.save(); mouth(); ctx.clip();
      ctx.fillStyle='#fff';
      ctx.fillRect(m0,my-R*0.035,m1-m0,R*0.062);
      ctx.fillStyle='#ff8fb0';
      ctx.beginPath(); ctx.ellipse((m0+m1)/2+R*0.03,my+R*0.150,R*0.125,R*0.085,0,0,TAU); ctx.fill();
      ctx.restore();
      ctx.strokeStyle=ink; ctx.lineWidth=R*0.022; ctx.lineCap='round';
      mouth(); ctx.stroke();
      ctx.fillStyle='#ff9db8';
      ctx.beginPath(); ctx.moveTo(R*0.71,-R*0.92); ctx.lineTo(R*0.66,-R*0.86); ctx.lineTo(R*0.71,-R*0.83); ctx.closePath(); ctx.fill();
      /* Raised cheek, sells the smile as coming from the whole face. */
      ctx.fillStyle='rgba(255,157,184,.30)';
      ctx.beginPath(); ctx.ellipse(R*0.40,-R*0.86,R*0.075,R*0.048,0,0,TAU); ctx.fill();
      ctx.fillStyle=COLORS.gold;
      for(const [sx,sy,sr] of [[R*0.95,ey-er*1.6,er*0.35],[R*0.20,ey-er*2.2,er*0.24],[R*0.86,ey+er*2.6,er*0.20]]){
        ctx.save(); ctx.translate(sx,sy); ctx.rotate(t*3);
        for(let i=0;i<4;i++){ ctx.rotate(Math.PI/2); ctx.beginPath(); ctx.moveTo(0,-sr); ctx.lineTo(sr*0.18,0); ctx.lineTo(0,sr); ctx.lineTo(-sr*0.18,0); ctx.closePath(); ctx.fill(); }
        ctx.restore();
      }
    } else if(trip){
      /* Blown-out pupil running a rainbow spiral, drawn segment by
         segment so the hue travels along the curve as it spins. */
      const sway=Math.sin(t*3.1)*er*0.16;
      const eR=er*1.42, eyT=ey+sway*0.4;
      ctx.fillStyle='#fff';
      ctx.beginPath(); ctx.ellipse(ex,eyT,eR,eR*0.93,0,0,TAU); ctx.fill();
      ctx.save();
      ctx.beginPath(); ctx.ellipse(ex,eyT,eR,eR*0.93,0,0,TAU); ctx.clip();
      ctx.lineCap='round'; ctx.lineWidth=eR*0.33;
      const steps=54, turns=2.6, spin=t*4.2;
      for(let i=0;i<steps;i++){
        const f0=i/steps, f1=(i+1)/steps;
        const a0=f0*TAU*turns+spin, a1=f1*TAU*turns+spin;
        ctx.strokeStyle=`hsl(${(f0*300+t*170)%360},92%,58%)`;
        ctx.beginPath();
        ctx.moveTo(ex+Math.cos(a0)*eR*1.18*f0, eyT+Math.sin(a0)*eR*1.08*f0);
        ctx.lineTo(ex+Math.cos(a1)*eR*1.18*f1, eyT+Math.sin(a1)*eR*1.08*f1);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle='rgba(10,13,24,.40)'; ctx.lineWidth=R*0.016;
      ctx.beginPath(); ctx.ellipse(ex,eyT,eR,eR*0.93,0,0,TAU); ctx.stroke();
      /* Brow riding the same wave as the eye. */
      ctx.strokeStyle=`hsl(${(t*150)%360},85%,70%)`; ctx.lineWidth=R*0.026; ctx.lineCap='round';
      ctx.beginPath();
      ctx.moveTo(ex-er*0.90,ey-er*1.62+sway);
      ctx.quadraticCurveTo(ex+er*0.15,ey-er*2.05-sway,ex+er*1.05,ey-er*1.55+sway);
      ctx.stroke();
      ctx.fillStyle='#ff9db8';
      ctx.beginPath(); ctx.moveTo(R*0.71,-R*0.92); ctx.lineTo(R*0.66,-R*0.86); ctx.lineTo(R*0.71,-R*0.83); ctx.closePath(); ctx.fill();
      /* Slack, blissed-out mouth with the tongue lolling out. */
      const mo=Math.sin(t*2.3)*R*0.012;
      ctx.fillStyle='#2a0f1c';
      ctx.beginPath();
      ctx.moveTo(R*0.46,-R*0.78);
      ctx.quadraticCurveTo(R*0.60,-R*0.60+mo,R*0.76,-R*0.77);
      ctx.quadraticCurveTo(R*0.61,-R*0.70,R*0.46,-R*0.78);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle='#ff8fb0';
      ctx.beginPath();
      ctx.ellipse(R*0.62,-R*0.625+mo,R*0.075,R*0.055,0.25,0,TAU); ctx.fill();
      /* Whiskers gone wavy. */
      ctx.lineWidth=R*0.018; ctx.lineCap='round';
      for(let k=0;k<3;k++){
        ctx.strokeStyle=`hsla(${(t*160+k*70)%360},90%,72%,.85)`;
        const y0=ey-R*0.03+k*R*0.035;
        ctx.beginPath();
        ctx.moveTo(R*0.70,y0);
        ctx.quadraticCurveTo(R*0.80,y0+Math.sin(t*4+k)*R*0.045,R*0.94,y0-Math.sin(t*3.3+k)*R*0.04);
        ctx.stroke();
      }
    } else {
      /* Idle: the eye blinks on a loop instead of staring forever. */
      const bc=(t*0.62+seed)%4.4;
      const blink=bc<0.16?1-Math.abs(bc-0.08)/0.08:0;
      const lidH=er*0.82*(1-blink*0.92);
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.ellipse(ex,ey,er,Math.max(lidH,er*0.06),0,0,TAU); ctx.fill();
      if(blink<0.5){
        const dr=Math.sin(t*1.4+seed)*er*0.25;
        ctx.save();
        ctx.beginPath(); ctx.ellipse(ex,ey,er,Math.max(lidH,er*0.06),0,0,TAU); ctx.clip();
        ctx.fillStyle=ink; ctx.beginPath(); ctx.arc(ex+dr,ey+er*0.10,er*0.50,0,TAU); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,.75)';
        ctx.beginPath(); ctx.arc(ex+dr-er*0.18,ey-er*0.10,er*0.15,0,TAU); ctx.fill();
        ctx.restore();
      } else {
        ctx.strokeStyle=ink; ctx.lineWidth=R*0.022; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(ex-er*0.85,ey); ctx.lineTo(ex+er*0.85,ey); ctx.stroke();
      }
      ctx.strokeStyle=mark; ctx.lineWidth=R*0.026; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(ex-er*0.85,ey-er*1.35); ctx.quadraticCurveTo(ex+er*0.15,ey-er*1.75,ex+er*1.0,ey-er*1.30); ctx.stroke();
      ctx.fillStyle='#ff9db8';
      ctx.beginPath(); ctx.moveTo(R*0.71,-R*0.92); ctx.lineTo(R*0.66,-R*0.86); ctx.lineTo(R*0.71,-R*0.83); ctx.closePath(); ctx.fill();
      ctx.strokeStyle=ink; ctx.lineWidth=R*0.03; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(R*0.69,-R*0.84); ctx.quadraticCurveTo(R*0.62,-R*0.74,R*0.54,-R*0.78); ctx.stroke();
      ctx.strokeStyle='rgba(238,240,251,.55)'; ctx.lineWidth=R*0.018;
      for(const dy of [-0.02,0.03]){
        ctx.beginPath(); ctx.moveTo(R*0.70,ey-R*0.02+dy*R*0.2); ctx.lineTo(R*0.92,ey-R*0.06+dy*R*0.3); ctx.stroke();
      }
    }
    ctx.restore();

    if(busted) return;

    const shoulder={x:cx+R*0.30,y:baseY-R*1.02};
    if(g.braking){
      const bf=clamp((g.t-g.brakeStart)/BRAKE_TIME,0,1);
      const paw={x:reachX,y:reachY};
      const mx=(shoulder.x+paw.x)/2+R*0.10, my=(shoulder.y+paw.y)/2-R*0.10;
      ctx.strokeStyle=fur; ctx.lineWidth=R*0.17; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(shoulder.x,shoulder.y); ctx.quadraticCurveTo(mx,my,paw.x,paw.y); ctx.stroke();
      ctx.save(); ctx.translate(paw.x,paw.y); ctx.rotate(-0.15);
      ctx.fillStyle=fur; ctx.beginPath(); ctx.ellipse(0,0,R*0.19,R*0.13,0,0,TAU); ctx.fill();
      ctx.restore();
      if(bf<0.6){
        ctx.strokeStyle=`rgba(255,255,255,${0.7*(1-bf/0.6)})`; ctx.lineWidth=2;
        for(const a of [-0.5,0,0.5,1.0]){
          ctx.beginPath(); ctx.moveTo(paw.x+Math.cos(a)*R*0.22,paw.y+Math.sin(a)*R*0.22);
          ctx.lineTo(paw.x+Math.cos(a)*R*(0.30+bf*0.35),paw.y+Math.sin(a)*R*(0.30+bf*0.35)); ctx.stroke();
        }
      }
    } else {
      const pump=Math.sin(t*(5+9*clamp(g.vel/P.VMAX,0,1))+seed)*R*0.05;
      const paw={x:reachX,y:reachY+pump};
      const mx=(shoulder.x+paw.x)/2 + R*0.10, my=(shoulder.y+paw.y)/2 - R*0.16;
      ctx.strokeStyle=fur; ctx.lineWidth=R*0.155; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(shoulder.x,shoulder.y); ctx.quadraticCurveTo(mx,my,paw.x,paw.y); ctx.stroke();
      ctx.fillStyle=fur; ctx.beginPath(); ctx.arc(paw.x,paw.y,R*0.115,0,TAU); ctx.fill();
      ctx.strokeStyle='rgba(10,13,24,.25)'; ctx.lineWidth=1.2; ctx.stroke();
      ctx.strokeStyle='rgba(10,13,24,.30)'; ctx.lineWidth=R*0.018;
      for(const o of [-0.045,0,0.045]){
        ctx.beginPath(); ctx.moveTo(paw.x+o*R,paw.y-R*0.09); ctx.lineTo(paw.x+o*R,paw.y-R*0.03); ctx.stroke();
      }
    }
  }

  function drawToilet(cx,groundY,w,h){
    const tankW=w*0.66, tankH=h*0.58;
    const tankX=cx-w*0.50, tankY=groundY-h;
    const bowlTop=groundY-h*0.62;
    ctx.fillStyle='rgba(0,0,0,.22)';
    ctx.beginPath(); ctx.ellipse(cx+w*0.04,groundY+h*0.03,w*0.62,h*0.09,0,0,TAU); ctx.fill();
    ctx.fillStyle=COLORS.surface2;
    roundRect(tankX,tankY,tankW,tankH,w*0.07); ctx.fill();
    ctx.strokeStyle=COLORS.border; ctx.lineWidth=1.5; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tankX+tankW*0.05, bowlTop);
    ctx.lineTo(cx+w*0.40, bowlTop);
    ctx.quadraticCurveTo(cx+w*0.56, bowlTop+h*0.05, cx+w*0.50, groundY-h*0.02);
    ctx.quadraticCurveTo(cx+w*0.10, groundY+h*0.06, cx-w*0.46, groundY-h*0.04);
    ctx.quadraticCurveTo(tankX-w*0.02, bowlTop+h*0.10, tankX+tankW*0.05, bowlTop);
    ctx.closePath();
    ctx.fillStyle=COLORS.surface2; ctx.fill();
    ctx.strokeStyle=COLORS.border; ctx.lineWidth=1.5; ctx.stroke();
    const lidY=tankY-h*0.10;
    ctx.fillStyle='#232a4d';
    roundRect(tankX-w*0.06, lidY, w*0.62, h*0.16, h*0.08); ctx.fill();
    ctx.strokeStyle=COLORS.border; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.04)';
    roundRect(tankX-w*0.02, lidY+h*0.02, w*0.30, h*0.05, h*0.025); ctx.fill();
    return lidY;
  }

  /* The pile on the floor: a folded stack, the shape that read best.
     Fold height is capped so a full stack still clears the bottom of the
     roll, leaving room for the falling sheet to bridge the gap. */
  function pileMetrics(){
    const passed=Math.min(curIdx(),g.lvl.target+2);
    const count=Math.min(26,Math.max(0,passed));
    const foldH=clamp(g.H*0.09/Math.max(9,count), g.H*0.0055, g.H*0.010);
    return { count, foldH, stackH: count*foldH*0.92 };
  }

  function drawPileFolds(cx,groundY,W,foldW){
    const { count, foldH }=pileMetrics();
    if(count<=0) return;
    const trip=tripping();
    for(let i=0;i<count;i++){
      const y=groundY-i*foldH*0.92;
      const skew=(i%2?1:-1)*foldW*0.07;
      ctx.fillStyle=i%2?COLORS.paper:COLORS.paperShade;
      ctx.beginPath();
      ctx.moveTo(cx-foldW/2+skew,y);
      ctx.lineTo(cx+foldW/2+skew,y);
      ctx.lineTo(cx+foldW/2-skew,y-foldH);
      ctx.lineTo(cx-foldW/2-skew,y-foldH);
      ctx.closePath(); ctx.fill();
      if(trip){ ctx.fillStyle=`hsla(${(i*37+g.t*130)%360},90%,62%,.24)`; ctx.fill(); }
      ctx.strokeStyle='rgba(20,24,48,.16)'; ctx.lineWidth=1; ctx.stroke();
    }
  }

  /* The sheet still falling between the roll and the heap — a soft
     vertical ribbon that waves harder the faster the roll is spinning. */
  function drawStrand(bx,fromY,toY,w){
    if(toY<=fromY) return;
    const trip=tripping();
    const amp=w*0.05+Math.min(w*0.16,g.vel*w*0.016);
    const wob=y=>Math.sin(y*0.045-g.t*(2.2+g.vel*0.35))*amp;
    const steps=12;
    ctx.beginPath();
    for(let i=0;i<=steps;i++){ const y=fromY+(toY-fromY)*i/steps, d=wob(y); i?ctx.lineTo(bx-w/2+d,y):ctx.moveTo(bx-w/2+d,y); }
    for(let i=steps;i>=0;i--){ const y=fromY+(toY-fromY)*i/steps, d=wob(y); ctx.lineTo(bx+w/2+d,y); }
    ctx.closePath();
    ctx.fillStyle=COLORS.paper; ctx.fill();
    if(trip){ ctx.fillStyle=`hsla(${(g.t*140)%360},90%,62%,.28)`; ctx.fill(); }
    ctx.strokeStyle='rgba(20,24,48,.20)'; ctx.lineWidth=1.2; ctx.stroke();
    ctx.strokeStyle='rgba(20,24,48,.13)'; ctx.lineWidth=1;
    for(let i=1;i<steps;i+=3){
      const y=fromY+(toY-fromY)*i/steps, d=wob(y);
      ctx.beginPath(); ctx.moveTo(bx-w/2+d,y); ctx.lineTo(bx+w/2+d,y); ctx.stroke();
    }
  }

  function drawSelector(bx,winY,w,selH){
    const inZone = tripping()?false : inCapture();
    const top=winY-selH/2, h=selH;
    ctx.save();
    ctx.strokeStyle = inZone ? '#fff' : 'rgba(255,216,138,0.9)';
    ctx.lineWidth = (inZone?3.2:2.2);
    if(inZone){ ctx.shadowColor=COLORS.gold; ctx.shadowBlur=w*0.10; }
    ctx.strokeRect(bx-w/2,top,w,h);
    ctx.shadowBlur=0;
    ctx.fillStyle=COLORS.gold;
    for(const sd of [-1,1]){
      ctx.beginPath();
      ctx.moveTo(bx+sd*(w/2+3),winY-h*0.16);
      ctx.lineTo(bx+sd*(w/2+3+w*0.055),winY);
      ctx.lineTo(bx+sd*(w/2+3),winY+h*0.16);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  /* Trip layer painted BEHIND the scene: rolling colour bands plus a
     slow rainbow pinwheel, so the whole room is moving, not just an
     overlay tint on top of a static one. */
  function drawTripBg(W,H){
    const t=g.t;
    ctx.save();
    ctx.translate(W*0.60,H*0.42);
    for(let i=0;i<10;i++){
      const a0=(i/10)*TAU+t*0.35, a1=a0+TAU/20;
      ctx.fillStyle=`hsla(${(i*36+t*80)%360},85%,58%,.10)`;
      ctx.beginPath(); ctx.moveTo(0,0);
      ctx.arc(0,0,Math.max(W,H)*1.2,a0,a1); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    for(let i=0;i<7;i++){
      const y=(((t*0.10+i/7)%1)*1.25-0.12)*H;
      ctx.fillStyle=`hsla(${(i*51+t*95)%360},80%,56%,.11)`;
      ctx.beginPath(); ctx.moveTo(0,y);
      for(let x=0;x<=W;x+=W/10) ctx.lineTo(x,y+Math.sin(x*0.022+t*1.5+i)*H*0.014);
      ctx.lineTo(W,y+H*0.075); ctx.lineTo(0,y+H*0.075);
      ctx.closePath(); ctx.fill();
    }
  }

  /* Trip layer painted IN FRONT: shapes drifting up the screen. */
  function drawTripFloaters(W,H){
    const t=g.t;
    for(let i=0;i<10;i++){
      const s0=nrnd(i*7+1), s1=nrnd(i*7+2), s2=nrnd(i*7+3);
      const p=(t*(0.05+s1*0.09)+s0)%1;
      const alpha=Math.sin(p*Math.PI)*0.55;
      if(alpha<=0.02) continue;
      const x=W*(0.06+s0*0.88)+Math.sin(t*1.05+i*1.7)*W*0.055;
      const y=H*1.05-p*H*1.15;
      const sz=W*(0.026+s2*0.042);
      const hue=(t*125+i*47)%360;
      ctx.save();
      ctx.globalAlpha=alpha;
      ctx.translate(x,y); ctx.rotate(t*(0.6+s1)*(i%2?1:-1));
      ctx0=ctx;
      if(i%3===0){ ctx.fillStyle=`hsl(${hue},88%,66%)`; drawStar(0,0,sz); }
      else if(i%3===1){
        ctx.strokeStyle=`hsl(${hue},88%,66%)`; ctx.lineWidth=sz*0.22; ctx.lineCap='round';
        ctx.beginPath();
        for(let k=0;k<=36;k++){
          const f=k/36, a=f*TAU*2.2, rr=sz*1.1*f;
          const px=Math.cos(a)*rr, py=Math.sin(a)*rr;
          k?ctx.lineTo(px,py):ctx.moveTo(px,py);
        }
        ctx.stroke();
      }
      else drawMushroom(0,0,sz);
      ctx.restore();
    }
  }

  function drawSwirlFx(bx,capY,W,H){
    for(let i=0;i<3;i++){
      const rad=((g.t*70+i*90)%(W*0.9));
      ctx.strokeStyle=`hsla(${(g.t*100+i*120)%360},85%,65%,${clamp(0.5-rad/(W*1.4),0,0.5)})`;
      ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(bx,capY,rad*0.5+10,0,TAU); ctx.stroke();
    }
    for(let i=0;i<7;i++){
      const a=g.t*0.8+i*(TAU/7), r=H*0.30+Math.sin(g.t*1.3+i)*H*0.08;
      const px=bx+Math.cos(a)*r*0.6, py=capY+H*0.18+Math.sin(a)*r*0.4;
      ctx.fillStyle=`hsl(${(g.t*140+i*50)%360},85%,68%)`;
      ctx.save(); ctx.translate(px,py); ctx.rotate(g.t*2+i);
      for(let k=0;k<4;k++){ ctx.rotate(Math.PI/2); ctx.beginPath(); ctx.moveTo(0,-5); ctx.lineTo(1.6,0); ctx.lineTo(0,5); ctx.lineTo(-1.6,0); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
  }

  /* ================= the barrel ================= */
  function draw(){
    const W=g.W,H=g.H;
    ctx.save();
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#10142a'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='rgba(255,255,255,.02)';
    for(let y=0;y<H;y+=W*0.13) ctx.fillRect(0,y,W,1);

    /* Trip visuals bracket the scene: the background layer goes down
       first, then everything gets a gentle sway (applied AFTER the base
       fill, so no transform can expose an unpainted corner), then the
       floaters and rings land on top. */
    if(tripping()){
      drawTripBg(W,H);
      ctx.translate(W/2,H/2);
      ctx.rotate(Math.sin(g.t*0.7)*0.022);
      const sc=1+Math.sin(g.t*1.3)*0.012;
      ctx.scale(sc,sc);
      ctx.translate(-W/2,-H/2);
    }

    /* capRY and the toilet's height are pinned to W, not H, so they keep
       their drawn proportions no matter how tall the canvas is — only the
       barrel body's window (bodyTop..bodyBot) grows with the extra
       height, which is what actually buys more visible runway. */
    const bx=W*0.60, capY=H*0.09, capRX=W*0.155, capRY=capRX*0.605;
    const bodyTop=capY+capRY*0.3, winY=H*0.55, bodyBot=H*0.7125;
    const sheetPx=(capRX*2)*sheetShrink();
    const trip=tripping();

    const grad=ctx.createLinearGradient(bx-capRX,0,bx+capRX,0);
    grad.addColorStop(0,'rgba(0,0,0,.30)'); grad.addColorStop(0.5,'rgba(255,255,255,.10)'); grad.addColorStop(1,'rgba(0,0,0,.30)');

    const cur=curIdx();
    ctx.save();
    roundRect(bx-capRX,bodyTop,capRX*2,bodyBot-bodyTop,capRX*0.18); ctx.clip();
    ctx.fillStyle=COLORS.paper; ctx.fillRect(bx-capRX,bodyTop,capRX*2,bodyBot-bodyTop);
    for(let k=Math.ceil((bodyBot-bodyTop)/sheetPx)+1;k>=-1;k--){
      const idx=cur+k;
      if(idx<0||idx>=g.lvl.squares.length) continue;
      const y=winY+(g.dist-idx)*sheetPx;
      const top=y-sheetPx, bot=y;
      if(top>bodyBot||bot<bodyTop-sheetPx) continue;
      const sq=g.lvl.squares[idx];
      ctx.fillStyle=squareFill(sq);
      ctx.beginPath();
      ctx.moveTo(bx-capRX,top);
      ctx.quadraticCurveTo(bx,top-sheetPx*0.16,bx+capRX,top);
      ctx.lineTo(bx+capRX,bot);
      ctx.quadraticCurveTo(bx,bot-sheetPx*0.16,bx-capRX,bot);
      ctx.closePath(); ctx.fill();
      if(trip){ ctx.fillStyle=`hsla(${(idx*38+g.t*125)%360},90%,60%,.22)`; ctx.fill(); }
      ctx.strokeStyle='rgba(20,24,48,.16)'; ctx.lineWidth=1; ctx.stroke();
      if(sq.kind!=='plain'&&sq.kind!=='spent') squareIconAt(sq,bx,(top+bot)/2,sheetPx*0.30);
    }
    ctx.fillStyle=grad; ctx.fillRect(bx-capRX,bodyTop,capRX*2,bodyBot-bodyTop);
    ctx.restore();
    drawSpeedLines(bx,bodyTop+sheetPx*0.3,capRX*2,g.vel);

    ctx.save();
    ctx.beginPath(); ctx.ellipse(bx,capY,capRX,capRY,0,0,TAU); ctx.clip();
    ctx.fillStyle=COLORS.paper; ctx.fillRect(bx-capRX,capY-capRY,capRX*2,capRY*2);
    ctx.strokeStyle=COLORS.paperLine; ctx.lineWidth=Math.max(1,capRX*0.06);
    for(let i=0;i<5;i++){ ctx.beginPath(); ctx.ellipse(bx,capY,capRX*(0.30+i*0.15),capRY*(0.30+i*0.15),0,0,TAU); ctx.stroke(); }
    ctx.fillStyle='#8a7d55'; ctx.beginPath(); ctx.ellipse(bx,capY,capRX*0.28,capRY*0.28,0,0,TAU); ctx.fill();
    ctx.fillStyle=COLORS.surface2; ctx.beginPath(); ctx.ellipse(bx,capY,capRX*0.10,capRY*0.10,0,0,TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle='rgba(20,24,48,.30)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.ellipse(bx,capY,capRX,capRY,0,0,TAU); ctx.stroke();

    ctx.strokeStyle=COLORS.surface2; ctx.lineWidth=W*0.045; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(bx-capRX*1.3,capY); ctx.lineTo(bx+capRX*1.3,capY); ctx.stroke();

    drawSelector(bx,winY,capRX*2,(capRX*2)*SEL_FRAC);
    if(trip) drawSwirlFx(bx,capY,W,H);

    const groundY=H*0.90, toiletCX=W*0.24;
    const lidY=drawToilet(toiletCX,groundY,W*0.26,W*0.25);
    /* Sheet falling from the roll into the stack — full roll width, so
       it reads as the same paper coming off the same roll. */
    const pm=pileMetrics();
    if(pm.count>0) drawStrand(bx,bodyBot-2,groundY-pm.stackH+2,capRX*2);
    drawPileFolds(bx,groundY,W,capRX*2);
    ctx.save();
    if(trip) ctx.filter='hue-rotate('+((g.t*110)%360)+'deg) saturate(1.5)';
    drawCat(toiletCX,lidY,W*0.20,bx-capRX*0.85,winY);
    ctx.restore();
    if(trip) drawTripFloaters(W,H);

    if(g.toastT>0){
      ctx.save(); ctx.globalAlpha=Math.min(1,g.toastT*2);
      ctx.fillStyle=g.toastColor;
      ctx.font='700 '+(W*0.058)+'px "Space Grotesk",sans-serif'; ctx.textAlign='center';
      ctx.fillText(g.toastText, bx, winY-capRX*0.55);
      ctx.restore();
    }

    if(trip){
      ctx.save(); const hue=(g.t*150)%360;
      ctx.fillStyle=`hsla(${hue},85%,60%,0.10)`; ctx.fillRect(0,0,W,H);
      ctx.restore();
    }

    ctx.restore();
    if(g.shake>0) g.shake=Math.max(0,g.shake-0.05);
  }

  /* ---------------- input: the one mechanic ----------------
     Whether a press builds speed or brakes is decided by how LONG this
     press lasts, not by timing since the last release — a quick tap
     always adds speed (chain + kick), a press held past TAP_MAX_DUR
     always brakes, however recently you were last mashing. That's a
     reliable, unconditional way to stop: just hold. */
  function down(e){
    e.preventDefault();
    if(g.overshootPending) return;
    /* A press during the between-level hold just skips the wait. */
    if(g.status==='win'||g.status==='lose'){ resume(); return; }
    if(g.status==='over') return;
    g.downAt=g.t;
    if(g.vel>BRAKE_ENGAGE){
      g.pressWhileMoving=true; // could be a tap (kick) or a hold (brake) — step() decides
      g.holding=false;
    } else {
      g.holding=true; g.holdStart=g.t-rampTimeFor(g.vel); g.pressWhileMoving=false;
    }
    try{ cv.setPointerCapture && e.pointerId!=null && cv.setPointerCapture(e.pointerId); }catch{}
  }
  function up(){
    if(g.pressWhileMoving && g.status==='play'){
      g.vel=Math.min(P.VMAX, g.vel+(P.TAP_KICK||0));
      g.decay=releaseDecayFor(g.vel);
    } else if(g.holding && g.status==='play'){
      const f=clamp((g.t-g.holdStart)/P.RAMP,0,1);
      g.vel=holdV(f);
      g.decay=releaseDecayFor(g.vel);
    }
    g.holding=false;
    g.pressWhileMoving=false;
  }
  cv.addEventListener('pointerdown',down);
  addEventListener('pointerup',up);
  cv.addEventListener('touchstart',down,{passive:false});
  addEventListener('touchend',up);

  function loop(){
    if(!g.running) return;
    const now=performance.now(), dt=Math.min(0.033,(now-(g.__last||now))/1000);
    g.__last=now;
    step(dt);
    g.raf=requestAnimationFrame(loop);
  }
  function start(){ if(g.running) return; g.running=true; g.__last=performance.now(); loop(); }
  function stop(){ g.running=false; if(g.raf) cancelAnimationFrame(g.raf); }

  reset(true);
  return { g, resize, start, stop, reset, syncHud,
           render(){ draw(); },
           setOnEnd(f){ onEnd=f; } };
}

/* ================= this game's board =================
   Mechanics live in js/leaderboard.js, shared with the other six; only the
   store id and the local key are per-game, which is what keeps the boards
   independent of one another. */
const game = makeGame();
const Board = makeBoard({
  id: 'ff808181a067127101a068f7474705c5',
  localKey: 'onaroll-board',
  storeName: 'schrodingerscards-onaroll-highscores'
});
const boardUI = attachBoardUI(Board, () => game.g.score);

/* ================= wiring ================= */
const $ = id => document.getElementById(id);

function newRun(){
  game.reset(true);
  $('overlay').hidden = true;
  $('ov-final').hidden = true;
  $('entry').hidden = true;
  boardUI.closePeek();
  game.start();
  $('stage').focus({ preventScroll:true });
}

game.setOnEnd(why => {
  game.stop();
  const cleared = game.g.level - 1;
  $('ov-title').textContent = cleared >= 1
    ? cleared + ' level' + (cleared === 1 ? '' : 's') + ' deep'
    : 'Not even one';
  $('ov-body').textContent = why + ' ' + (cleared >= 1
    ? 'You cleared ' + cleared + ' level' + (cleared === 1 ? '' : 's') + ' before it got away from you.'
    : 'The first roll got the better of you.');
  $('final-score').textContent = game.g.score;
  $('ov-final').hidden = false;
  $('go').textContent = 'Again';
  $('go').onclick = newRun;
  $('overlay').hidden = false;
  boardUI.finish();
});

/* The start screen. One mode, so this only ever resets it. */
function toStart(){
  game.stop();
  game.reset(true);
  $('ov-title').textContent = 'On a Roll';
  $('ov-body').textContent = 'Hold to spin the roll, tap to get it moving faster, and hold again to stop it. Find the square carrying the symbol and stop dead on it.';
  $('ov-final').hidden = true;
  $('entry').hidden = true;
  $('board').hidden = true;
  $('go').textContent = 'Start';
  $('go').onclick = newRun;
  $('overlay').hidden = false;
  game.syncHud();
  game.render();
}

addEventListener('resize', () => { game.resize(); if(!game.g.running) game.render(); });
game.resize();
toStart();
})();
