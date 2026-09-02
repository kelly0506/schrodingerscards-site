/* ================= Hat in the Cat =================
   Lives at hats.html. Depends on js/leaderboard.js for the score board.
*/

/* ================= Hat in the Cat =================
   The cursor is a small x-ray lens. Everything inside the cat is drawn only
   where the lens is, so the whole game is a search: sweep, recognise the
   silhouette, commit to a hold. */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const TAU=Math.PI*2;

/* The six rarities from the other games, so it is the same animal throughout. */
const BREEDS=[
  { key:'common',   fur:'#9aa3bd', mark:'#7c86a4', ear:'round', tail:'stub', eye:'sleepy' },
  { key:'uncommon', fur:'#d9c49b', mark:'#b9a274', ear:'point', tail:'long', eye:'normal' },
  { key:'holo',     fur:'#7dd8ff', mark:'#4fb4e0', ear:'tall',  tail:'long', eye:'wide'   },
  { key:'ultra',    fur:'#b48bff', mark:'#8a63d6', ear:'point', tail:'curl', eye:'huge'   },
  { key:'sir',      fur:'#ff8fd0', mark:'#e05fa8', ear:'tuft',  tail:'poof', eye:'normal' },
  { key:'gold',     fur:'#ffd88a', mark:'#e0ac48', ear:'crown', tail:'flow', eye:'derp'   }
];

/* ================= what is inside a cat =================
   Every shape is drawn in a unit frame and scaled by its own radius, so one
   routine covers the legend, the lens and the little celebration. Hats are
   not coloured differently from the clutter — if they were, the game would
   be over the moment one crossed the lens. */
/* Shape functions build a path and nothing else. They used to stroke
   themselves, which meant the new hats — written with poly() and no stroke of
   their own — came out as dim unstroked silhouettes while everything around
   them was bright. Stroking and filling is the caller's job now, so every
   shape is drawn the same way and none of them can be told apart by how they
   are rendered. */
const poly=(c,pts,close=true)=>{
  c.beginPath();
  pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));
  if(close) c.closePath();
};
/* Hats as solid silhouettes rather than sketches — a brim you can see and a
   crown sitting on it. The first pass read as "some shape" at small sizes,
   which is the wrong kind of difficulty: the hat should be unmistakable once
   the lens is on it, and hard only because you have to find it. */
const HATS={
  top:(c,r)=>{
    poly(c,[[-r,r*.44],[r,r*.44],[r,r*.22],[r*.52,r*.22],[r*.52,-r*.98],
            [-r*.52,-r*.98],[-r*.52,r*.22],[-r,r*.22]]);
    c.moveTo(-r*.52,-r*.34); c.lineTo(r*.52,-r*.34); },
  bowler:(c,r)=>{
    c.beginPath();
    c.moveTo(-r,r*.40); c.lineTo(r,r*.40); c.lineTo(r,r*.20); c.lineTo(r*.64,r*.20);
    c.bezierCurveTo(r*.70,-r*.96,-r*.70,-r*.96,-r*.64,r*.20);
    c.lineTo(-r,r*.20); c.closePath();
    c.moveTo(-r*.62,-r*.14); c.lineTo(r*.62,-r*.14); },
  party:(c,r)=>{
    poly(c,[[-r*.66,r*.74],[0,-r*.80],[r*.66,r*.74]]);
    c.moveTo(-r*.38,r*.16); c.lineTo(r*.30,-r*.02);
    c.moveTo(-r*.18,-r*.24); c.lineTo(r*.20,-r*.40);
    c.moveTo(r*.17,-r*.94); c.arc(0,-r*.94,r*.17,0,TAU); },
  wizard:(c,r)=>{
    c.beginPath();
    c.moveTo(-r,r*.62); c.quadraticCurveTo(0,r*.28,r,r*.62);
    c.quadraticCurveTo(0,r*.92,-r,r*.62); c.closePath();
    c.moveTo(-r*.50,r*.52);
    c.quadraticCurveTo(-r*.40,-r*.44,r*.26,-r*1.00);
    c.quadraticCurveTo(r*.14,-r*.14,r*.52,r*.46);
    c.closePath();
    c.moveTo(-r*.06,-r*.16); c.lineTo(r*.10,-r*.30); },
  fez:(c,r)=>{
    poly(c,[[-r*.54,r*.62],[-r*.42,-r*.54],[r*.42,-r*.54],[r*.54,r*.62]]);
    c.moveTo(r*.42,-r*.54);
    c.quadraticCurveTo(r*.98,-r*.20,r*.78,r*.44);
    c.moveTo(r*.86,r*.44); c.arc(r*.78,r*.44,r*.14,0,TAU); }
};
const JUNK={
  yarn:(c,r)=>{ c.beginPath(); c.arc(0,0,r*.80,0,TAU);
    c.moveTo(-r*.66,-r*.34); c.quadraticCurveTo(0,r*.20,r*.66,-r*.30);
    c.moveTo(-r*.60,r*.36); c.quadraticCurveTo(r*.10,-r*.30,r*.58,r*.40);
    c.moveTo(r*.80,0); c.quadraticCurveTo(r*1.20,r*.30,r*.92,r*.72); },
  bone:(c,r)=>{ c.beginPath(); c.moveTo(-r*.76,0); c.lineTo(r*.60,0);
    for(const f of [-.42,-.06,.30]){ c.moveTo(r*f,-r*.46); c.lineTo(r*f,r*.46); }
    c.moveTo(r*.60,0); c.lineTo(r*.94,-r*.34); c.moveTo(r*.60,0); c.lineTo(r*.94,r*.34);
    c.moveTo(-r*.76,0); c.arc(-r*.86,0,r*.22,0,TAU); },
  sock:(c,r)=>{ c.beginPath(); c.moveTo(-r*.34,-r*.86); c.lineTo(r*.20,-r*.86);
    c.lineTo(r*.24,r*.20); c.quadraticCurveTo(r*.30,r*.80,-r*.44,r*.76);
    c.quadraticCurveTo(-r*.80,r*.68,-r*.42,r*.16); c.closePath();
    c.moveTo(-r*.34,-r*.52); c.lineTo(r*.22,-r*.52); },
  mouse:(c,r)=>{ c.beginPath(); c.ellipse(0,0,r*.72,r*.46,0,0,TAU);
    c.moveTo(r*.72,0); c.quadraticCurveTo(r*1.20,r*.10,r*1.00,r*.60);
    c.moveTo(-r*.40,-r*.34); c.arc(-r*.46,-r*.44,r*.26,0,TAU); },
  bell:(c,r)=>{ c.beginPath(); c.moveTo(-r*.72,r*.44); c.quadraticCurveTo(-r*.66,-r*.72,0,-r*.72);
    c.quadraticCurveTo(r*.66,-r*.72,r*.72,r*.44); c.closePath();
    c.moveTo(-r*.30,r*.44); c.arc(0,r*.44,r*.30,0,Math.PI); },
  spring:(c,r)=>{ c.beginPath();
    for(let i=0;i<=28;i++){const t=i/28,y=-r*.86+r*1.72*t; const x=Math.sin(t*Math.PI*5)*r*.56;
      i?c.lineTo(x,y):c.moveTo(x,y);} },
  feather:(c,r)=>{ c.beginPath(); c.moveTo(-r*.62,r*.80); c.quadraticCurveTo(r*.24,-r*.10,r*.42,-r*.90);
    for(let i=1;i<6;i++){const t=i/6; const x=lerp(-r*.42,r*.36,t), y=lerp(r*.52,-r*.62,t);
      c.moveTo(x,y); c.lineTo(x-r*.34,y-r*.16); c.moveTo(x,y); c.lineTo(x+r*.22,y+r*.26);} },
  key:(c,r)=>{ c.beginPath(); c.arc(-r*.50,0,r*.34,0,TAU);
    c.moveTo(-r*.16,0); c.lineTo(r*.86,0);
    c.moveTo(r*.46,0); c.lineTo(r*.46,r*.40); c.moveTo(r*.72,0); c.lineTo(r*.72,r*.34); },
  coin:(c,r)=>{ c.beginPath(); c.arc(0,0,r*.74,0,TAU); c.moveTo(r*.40,0); c.arc(0,0,r*.40,0,TAU);
    c.moveTo(-r*.18,-r*.20); c.lineTo(r*.18,r*.20); },
  pack:(c,r)=>{ c.beginPath(); c.rect(-r*.50,-r*.82,r,r*1.64);
    c.moveTo(-r*.50,-r*.48); c.lineTo(r*.50,-r*.48);
    c.moveTo(-r*.26,-r*.14); c.lineTo(r*.26,-r*.14);
    c.moveTo(-r*.26,r*.18); c.lineTo(r*.26,r*.18); },
  sleeve:(c,r)=>{ c.beginPath(); c.rect(-r*.56,-r*.78,r*1.12,r*1.56);
    c.moveTo(-r*.34,-r*.54); c.lineTo(r*.34,-r*.54); c.lineTo(r*.34,r*.54); c.lineTo(-r*.34,r*.54); c.closePath(); },
  marble:(c,r)=>{ c.beginPath(); c.arc(0,0,r*.66,0,TAU);
    c.moveTo(-r*.34,-r*.30); c.quadraticCurveTo(0,0,r*.34,r*.30); },
  hairball:(c,r)=>{ c.beginPath();
    for(let i=0;i<=40;i++){const t=i/40*TAU; const rr=r*(.62+.16*Math.sin(t*5)+.08*Math.sin(t*9));
      const x=Math.cos(t)*rr,y=Math.sin(t)*rr; i?c.lineTo(x,y):c.moveTo(x,y);} c.closePath(); },
  fish:(c,r)=>{ c.beginPath(); c.ellipse(-r*.10,0,r*.70,r*.42,0,0,TAU);
    c.moveTo(r*.58,0); c.lineTo(r*.98,-r*.36); c.lineTo(r*.98,r*.36); c.closePath();
    c.moveTo(-r*.44,-r*.10); c.arc(-r*.48,-r*.12,r*.09,0,TAU); }
};
/* From the third cat on, things that read as a hat for half a second. */
const DECOYS={
  mug:(c,r)=>{ c.beginPath(); c.moveTo(-r*.52,-r*.62); c.lineTo(-r*.44,r*.64); c.lineTo(r*.44,r*.64);
    c.lineTo(r*.52,-r*.62); c.closePath();
    c.moveTo(r*.52,-r*.34); c.quadraticCurveTo(r*1.02,-r*.10,r*.48,r*.28); },
  bucket:(c,r)=>{ c.beginPath(); c.moveTo(-r*.72,-r*.56); c.lineTo(-r*.48,r*.66);
    c.lineTo(r*.48,r*.66); c.lineTo(r*.72,-r*.56); c.closePath();
    c.moveTo(-r*.72,-r*.56); c.quadraticCurveTo(0,-r*1.10,r*.72,-r*.56); },
  lamp:(c,r)=>{ c.beginPath(); c.moveTo(-r*.86,r*.52); c.lineTo(-r*.40,-r*.62);
    c.lineTo(r*.40,-r*.62); c.lineTo(r*.86,r*.52); c.closePath();
    c.moveTo(-r*.62,0); c.lineTo(r*.62,0); }
};
const POWERS={
  time:(c,r)=>{ c.beginPath(); c.arc(0,r*.06,r*.72,0,TAU);
    c.moveTo(0,r*.06); c.lineTo(0,-r*.38); c.moveTo(0,r*.06); c.lineTo(r*.34,r*.20);
    c.moveTo(-r*.28,-r*.72); c.lineTo(r*.28,-r*.72); },
  lens:(c,r)=>{ c.beginPath(); c.arc(-r*.14,-r*.14,r*.56,0,TAU);
    c.moveTo(r*.26,r*.26); c.lineTo(r*.82,r*.82);
    c.moveTo(-r*.44,-r*.14); c.lineTo(r*.16,-r*.14);
    c.moveTo(-r*.14,-r*.44); c.lineTo(-r*.14,r*.16); }
};
const SHAPES=Object.assign({},HATS,JUNK,DECOYS,POWERS);
/* Shapes whose outline encloses something get a faint fill so the silhouette
   reads at a glance. Spread across hats, junk and decoys deliberately — if
   only hats were filled, filling would give them away. */
const CLOSED=new Set(['top','bowler','party','wizard','fez',
  'yarn','sock','mouse','bell','coin','pack','sleeve','marble','hairball','fish',
  'mug','bucket','lamp','time']);
const HAT_KEYS=Object.keys(HATS), JUNK_KEYS=Object.keys(JUNK), DECOY_KEYS=Object.keys(DECOYS);


/* Six builds and five faces on top of six coats, so a cat turns up looking
   like a different animal each level rather than the same ellipse repainted.
   The build changes how much room there is inside, which the placement code
   already copes with by shrinking things until they fit. */
const BUILDS=[
  { key:'loaf',   bw:.335, bh:.235, hr:.146, gap:.80 },
  { key:'chonk',  bw:.320, bh:.290, hr:.150, gap:.88 },
  { key:'lean',   bw:.250, bh:.280, hr:.138, gap:.90 },
  { key:'kitten', bw:.262, bh:.222, hr:.166, gap:.78 },
  { key:'tall',   bw:.238, bh:.310, hr:.134, gap:.92 },
  { key:'round',  bw:.300, bh:.268, hr:.156, gap:.84 }
];
const FACES=['plain','wide','sleepy','smug','derp'];

/* ================= the cat ================= */
const cv=document.getElementById('stage'), ctx=cv.getContext('2d');
let W=0,H=0,S=1,TS=1;
function resize(){
  const dpr=Math.min(devicePixelRatio||1,2), r=cv.getBoundingClientRect();
  W=r.width; H=r.height;
  cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  S=Math.min(W/760,H/570);
  TS=clamp(S,0.88,1.12);   // type does not shrink with the board
  if(cat) placeCat();
}
addEventListener('resize',()=>{resize();});

let cat=null, objs=[], hat=null;
function placeCat(){
  /* A sitting cat: one body ellipse and a head, which is also the region
     things can be hidden in. Kept as plain geometry so containment and
     scattering are exact rather than sampled off a picture. */
  const k=Math.min(W,H*1.28), b=cat.build;
  cat.k=k;
  cat.bw=k*b.bw*cat.jw; cat.bh=k*b.bh*cat.jh;
  cat.cx=W*0.5;  cat.by=H*0.615;
  cat.hr=k*b.hr*cat.jr; cat.hy=cat.by-cat.bh*b.gap-cat.hr*0.52;
  /* Everything hidden inside is held relative to the cat, so resizing the
     window moves the contents with it instead of leaving them behind. */
  for(const o of objs){
    if(o.ox===undefined) continue;
    o.x=cat.cx+o.ox*k; o.y=cat.by+o.oy*k; o.r=o.orr*k;
  }
}
const inBody=(x,y,pad=0)=>{
  const a=cat.bw-pad, b=cat.bh-pad;
  if(a>0&&b>0&&((x-cat.cx)/a)**2+((y-cat.by)/b)**2<=1) return true;
  const hr=cat.hr-pad;
  return hr>0 && (x-cat.cx)**2+(y-cat.hy)**2<=hr*hr;
};
function catPath(c){
  c.beginPath();
  c.ellipse(cat.cx,cat.by,cat.bw,cat.bh,0,0,TAU);
  c.moveTo(cat.cx+cat.hr,cat.hy);
  c.arc(cat.cx,cat.hy,cat.hr,0,TAU);
}
function drawEars(c,x,y,R,B,fur,inner,mood){
  const ear=(sgn,tall,wide,lean)=>{
    const bx=x+sgn*R*0.58, tipx=x+sgn*R*(0.58+lean), tipy=y-R*tall;
    c.fillStyle=fur; c.beginPath();
    c.moveTo(bx-sgn*R*wide,y-R*0.52);
    c.quadraticCurveTo(x+sgn*R*(0.54+lean*.6),y-R*(tall*.72),tipx,tipy);
    c.quadraticCurveTo(x+sgn*R*(0.90+lean*.5),y-R*(tall*.54),bx+sgn*R*wide,y-R*0.22);
    c.closePath(); c.fill();
    c.fillStyle=inner; c.beginPath();
    c.moveTo(bx-sgn*R*wide*.42,y-R*0.50);
    c.quadraticCurveTo(x+sgn*R*(0.57+lean*.6),y-R*(tall*.66),tipx-sgn*R*.04,tipy+R*.20);
    c.quadraticCurveTo(x+sgn*R*(0.79+lean*.4),y-R*(tall*.50),bx+sgn*R*wide*.42,y-R*0.28);
    c.closePath(); c.fill();
  };
  if(B.ear==='crown'){ const m=mood==='sad'?.62:mood==='happy'?1.14:1;
    ear(-1,1.34*m,.32,mood==='sad'?.62:.10); ear(1,1.34*m,.32,mood==='sad'?.62:.10);
    c.fillStyle=fur; c.beginPath(); c.moveTo(x-R*.18,y-R*.84*m); c.lineTo(x,y-R*1.60*m);
    c.lineTo(x+R*.18,y-R*.84*m); c.closePath(); c.fill(); return; }
  let tall=B.ear==='tall'?1.66:B.ear==='round'?1.00:1.30;
  let lean=.16, wide=B.ear==='round'?.40:.33;
  /* perked when pleased, flattened out sideways when not */
  if(mood==='happy'){ tall*=1.14; lean=.10; }
  else if(mood==='sad'){ tall*=.58; lean=.66; }
  ear(-1,tall,wide,lean); ear(1,tall,wide,lean);
  if(B.ear==='tuft'){ c.fillStyle=fur; c.beginPath();
    c.arc(x-R*.94,y-R*.56,R*.18,0,TAU); c.arc(x+R*.94,y-R*.56,R*.18,0,TAU); c.fill(); }
}
/* Five resting faces, plus the two that matter: delighted when the hat comes
   out, crushed when you pull out a sock. */
function drawFace(c,x,y,R,B,variant,mood){
  const ink='#141830';
  const base=R*.28*(B.eye==='huge'?1.24:B.eye==='wide'?1.12:B.eye==='sleepy'?.94:1.02);
  const ex=R*.38;
  if(mood==='happy'){
    c.strokeStyle=ink; c.lineWidth=R*.085; c.lineCap='round';
    for(const s of [-1,1]){ c.beginPath();
      c.arc(x+s*ex,y-R*.02,base*1.02,Math.PI*1.12,Math.PI*1.88); c.stroke(); }
    c.fillStyle='rgba(255,157,184,.45)';
    for(const s of [-1,1]){ c.beginPath(); c.ellipse(x+s*R*.72,y+R*.24,R*.17,R*.11,0,0,TAU); c.fill(); }
  } else if(mood==='sad'){
    for(const s of [-1,1]){
      c.fillStyle='#ffd25e'; c.beginPath();
      c.ellipse(x+s*ex,y+R*.02,base*.94,base*.72,0,0,TAU); c.fill();
      c.fillStyle=ink; c.beginPath();
      c.ellipse(x+s*ex,y+R*.10,base*.30,base*.46,0,0,TAU); c.fill();
      c.fillStyle=B.fur; c.beginPath();          // heavy lid, dragged down
      c.ellipse(x+s*ex,y-base*.52,base*1.10,base*.62,0,0,TAU); c.fill();
      c.strokeStyle=ink; c.lineWidth=R*.05; c.beginPath();
      c.moveTo(x+s*ex-base*.9,y-base*.14); c.lineTo(x+s*ex+base*.9,y-base*.30+s*base*.16); c.stroke();
    }
    c.fillStyle='rgba(125,216,255,.75)';        // one small tear
    c.beginPath(); c.ellipse(x+ex+base*1.05,y+R*.30,R*.055,R*.085,0,0,TAU); c.fill();
  } else {
    for(const s of [-1,1]){
      const big = variant==='wide'?1.20 : variant==='derp' ? (s<0?1.18:0.86) : 1;
      const dy  = variant==='derp' ? (s<0?-R*.05:R*.05) : 0;
      const nar = variant==='smug' && s>0 ? .58 : 1;
      const er=base*big;
      c.fillStyle='#ffd25e'; c.beginPath(); c.ellipse(x+s*ex,y-R*.04+dy,er,er*1.06*nar,0,0,TAU); c.fill();
      c.fillStyle=ink; c.beginPath(); c.ellipse(x+s*ex,y-R*.04+dy,er*.32,er*.92*nar,0,0,TAU); c.fill();
      c.fillStyle='#fff'; c.beginPath(); c.arc(x+s*ex+er*.30,y-R*.04+dy-er*.36,er*.19,0,TAU); c.fill();
      if(variant==='sleepy'){                    // half a lid over each eye
        c.fillStyle=B.fur; c.beginPath();
        c.ellipse(x+s*ex,y-R*.04+dy-er*.66,er*1.12,er*.66,0,0,TAU); c.fill();
      }
    }
  }
  /* nose and mouth */
  c.fillStyle='#ff9db8'; c.beginPath();
  c.moveTo(x,y+R*.42); c.lineTo(x-R*.11,y+R*.28); c.lineTo(x+R*.11,y+R*.28); c.closePath(); c.fill();
  c.strokeStyle=ink; c.lineWidth=R*.05; c.lineCap='round'; c.beginPath();
  if(mood==='happy'){                            // open, delighted
    c.moveTo(x-R*.26,y+R*.46); c.quadraticCurveTo(x,y+R*.86,x+R*.26,y+R*.46);
    c.quadraticCurveTo(x,y+R*.62,x-R*.26,y+R*.46);
  } else if(mood==='sad'){
    c.moveTo(x-R*.22,y+R*.66); c.quadraticCurveTo(x,y+R*.42,x+R*.22,y+R*.66);
  } else if(variant==='smug'){
    c.moveTo(x-R*.20,y+R*.52); c.quadraticCurveTo(x+R*.06,y+R*.60,x+R*.24,y+R*.44);
  } else if(variant==='derp'){
    c.moveTo(x-R*.16,y+R*.50); c.lineTo(x+R*.16,y+R*.50);
    c.moveTo(x,y+R*.50); c.lineTo(x,y+R*.62);
  } else {
    c.arc(x-R*.11,y+R*.50,R*.12,1.75*Math.PI,.62*Math.PI);
    c.arc(x+R*.11,y+R*.50,R*.12,.38*Math.PI,1.25*Math.PI);
  }
  c.stroke();
  c.strokeStyle='rgba(20,24,48,.40)'; c.lineWidth=R*.04;
  for(const g of [-1,1]) for(const dy of [-.02,.12,.26]){
    c.beginPath(); c.moveTo(x+g*R*.44,y+R*dy); c.lineTo(x+g*R*1.02,y+R*(dy+.04)); c.stroke(); }
}
function drawCat(t){
  const B=cat.B;
  /* Only ever moved during a celebration. The rest of the time the drawn cat
     has to sit exactly where the hidden items think it is. */
  const bounce = celebrate ? -Math.abs(Math.sin(celebrate.t*7.6))*cat.hr*0.22*(1-celebrate.t/CHEER) : 0;
  ctx.save(); if(bounce) ctx.translate(0,bounce);
  /* tail, laid out beside the body */
  ctx.strokeStyle=B.mark; ctx.lineCap='round'; ctx.lineWidth=cat.hr*0.30;
  const sw=Math.sin(t*1.3+cat.flick)*cat.hr*0.30;
  ctx.beginPath();
  ctx.moveTo(cat.cx+cat.bw*0.78, cat.by+cat.bh*0.52);
  ctx.bezierCurveTo(cat.cx+cat.bw*1.42, cat.by+cat.bh*0.62,
                    cat.cx+cat.bw*1.50+sw, cat.by-cat.bh*0.34,
                    cat.cx+cat.bw*0.96+sw, cat.by-cat.bh*0.72);
  ctx.stroke();
  drawEars(ctx,cat.cx,cat.hy,cat.hr,B,B.fur,'#ff9db8',cat.mood);
  ctx.fillStyle=B.fur; catPath(ctx); ctx.fill();
  /* a couple of markings so the six read as different animals */
  ctx.save(); catPath(ctx); ctx.clip();
  ctx.fillStyle=B.mark; ctx.globalAlpha=.35;
  ctx.beginPath(); ctx.ellipse(cat.cx-cat.bw*.44,cat.by-cat.bh*.30,cat.bw*.26,cat.bh*.20,-.4,0,TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cat.cx+cat.bw*.40,cat.by+cat.bh*.34,cat.bw*.22,cat.bh*.17,.3,0,TAU); ctx.fill();
  ctx.restore();
  ctx.strokeStyle='rgba(10,13,24,.26)'; ctx.lineWidth=2.4*S; catPath(ctx); ctx.stroke();
  /* front paws, so it is sitting rather than floating */
  ctx.fillStyle=B.fur;
  for(const s of [-1,1]){
    ctx.beginPath(); ctx.ellipse(cat.cx+s*cat.bw*.30, cat.by+cat.bh*.92, cat.bw*.17, cat.bh*.13,0,0,TAU); ctx.fill();
  }
  drawFace(ctx,cat.cx,cat.hy,cat.hr,B,cat.face,cat.mood);
  ctx.restore();
}


/* ================= a level ================= */
const ROUND=60, PENALTY=4, BOOST=6, HOLD=1.8, HOLD_POWER=0.7;
let score=0, level=1, hats=0, timeLeft=ROUND, running=false, over=false;
let mx=-999, my=-999, lensR=1, lensBoost=0, holding=null, holdT=0, flash=null;
let fx=-999, fy=-999, touchMode=false, downNow=false, lastLx=0, lastLy=0;
let levelStart=0, misses=0, powers=0, celebrate=null;
const CHEER=1.05;   // how long the cat gets to enjoy itself
const baseLens=()=>Math.min(W,H)*0.115;

function newLevel(){
  objs=[]; hat=null;
  cat={ B:pick(BREEDS), build:pick(BUILDS), face:pick(FACES),
        jw:rand(0.94,1.07), jh:rand(0.94,1.07), jr:rand(0.95,1.06),
        flick:rand(0,6), mood:'idle', moodT:0 };
  placeCat();
  lensBoost=0;
  /* Difficulty comes from three things at once: how much is in there, how
     small the hat is, and how widely the other items vary in size — a cat
     full of same-sized lumps is easier to read than one with a jumble. */
  const n=Math.min(40, Math.round(8+level*2.6));
  const hatScale=Math.max(0.44, 1.0-(level-1)*0.052);
  const jMin=Math.max(0.022, 0.036-level*0.0011);
  const jMax=Math.min(0.086, 0.056+level*0.0026);
  const unit=Math.min(W,H);
  const fits=(x,y,r)=>{
    if(!inBody(x,y,r*1.05)) return false;
    return objs.every(o=>Math.hypot(o.x-x,o.y-y) > (o.r+r)*0.92);
  };
  const drop=(kind,r,tries=260)=>{
    for(let i=0;i<tries;i++){
      const x=rand(cat.cx-cat.bw,cat.cx+cat.bw), y=rand(cat.hy-cat.hr,cat.by+cat.bh);
      if(fits(x,y,r)){
        const o={kind,x,y,r,rot:rand(-0.5,0.5),gone:false,
                 ox:(x-cat.cx)/cat.k, oy:(y-cat.by)/cat.k, orr:r/cat.k};
        objs.push(o); return o;
      }
    }
    return null;
  };
  /* The hat goes in first, into an empty cat, so the only way it can fail is
     if it will not fit at all — and then it shrinks until it does. The last
     resort is the dead centre of the body, which is inside by definition.
     There is always a hat. */
  hat=null;
  for(let s=hatScale; s>0.28 && !hat; s*=0.86) hat=drop(pick(HAT_KEYS), unit*0.052*s, 400);
  if(!hat){
    const r=Math.min(cat.bw,cat.bh)*0.28;
    hat={kind:pick(HAT_KEYS),x:cat.cx,y:cat.by,r,rot:0,gone:false,
         ox:0,oy:0,orr:r/cat.k};
    objs.push(hat);
  }
  hat.isHat=true;
  /* one power-up most levels, two occasionally */
  const nPow = Math.random()<0.72 ? 1 : (level>3 && Math.random()<0.4 ? 2 : 0);
  for(let i=0;i<nPow;i++){ const o=drop(Math.random()<0.55?'time':'lens', unit*0.042); if(o) o.isPower=true; }
  for(let i=0;i<n;i++){
    const useDecoy = level>=3 && Math.random() < Math.min(0.34, 0.10+level*0.03);
    drop(useDecoy?pick(DECOY_KEYS):pick(JUNK_KEYS), unit*rand(jMin,jMax));
  }
  levelStart=timeLeft;
  document.getElementById('level').textContent=level;
}

/* ================= the lens ================= */
function drawXray(t){
  const R=lensR;
  ctx.save();
  ctx.beginPath(); ctx.arc(mx,my,R,0,TAU); ctx.clip();
  /* the inside of the cat: a flat radiograph, only where the lens is */
  catPath(ctx); ctx.fillStyle='#071a22'; ctx.fill();
  ctx.save(); catPath(ctx); ctx.clip();
  ctx.strokeStyle='rgba(141,240,216,.07)'; ctx.lineWidth=1;
  for(let y=Math.floor((my-R)/4)*4; y<my+R; y+=4){
    ctx.beginPath(); ctx.moveTo(mx-R,y); ctx.lineTo(mx+R,y); ctx.stroke();
  }
  for(const o of objs){
    if(o.gone) continue;
    if(Math.hypot(o.x-mx,o.y-my) > R+o.r*1.6) continue;
    ctx.save(); ctx.translate(o.x,o.y);
    /* Pick-ups shine. A pulsing halo and a few sparkles, which reads as
       "worth grabbing" without saying anything about where the hat is. */
    if(o.isPower){
      const p=0.5+0.5*Math.sin(t*3.6+o.r);
      ctx.save();
      const g=ctx.createRadialGradient(0,0,o.r*0.30,0,0,o.r*(1.75+0.18*p));
      g.addColorStop(0,`rgba(255,229,160,${0.30+0.16*p})`);
      g.addColorStop(1,'rgba(255,229,160,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,o.r*(1.75+0.18*p),0,TAU); ctx.fill();
      ctx.strokeStyle=`rgba(255,236,182,${0.70+0.30*p})`; ctx.lineWidth=Math.max(1.2,o.r*0.075);
      for(const [ax,ay,al] of [[-1.10,-0.90,0.34],[1.16,-0.52,0.24],[0.80,1.00,0.28]]){
        const s=o.r*al*(0.65+0.55*p);
        ctx.beginPath();
        ctx.moveTo(o.r*ax-s,o.r*ay); ctx.lineTo(o.r*ax+s,o.r*ay);
        ctx.moveTo(o.r*ax,o.r*ay-s); ctx.lineTo(o.r*ax,o.r*ay+s); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.rotate(o.rot);
    ctx.lineJoin='round'; ctx.lineCap='round';
    const tint=o.isPower?'255,236,182':'141,240,216';
    ctx.strokeStyle=`rgba(${tint},.22)`; ctx.lineWidth=Math.max(5,o.r*0.30);
    SHAPES[o.kind](ctx,o.r); ctx.stroke();
    if(CLOSED.has(o.kind)){
      ctx.fillStyle=`rgba(${tint},.20)`;
      SHAPES[o.kind](ctx,o.r); ctx.fill();
    }
    ctx.strokeStyle=o.isPower?'#ffecb6':'#a9f7e4'; ctx.lineWidth=Math.max(1.7,o.r*0.11);
    SHAPES[o.kind](ctx,o.r); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  ctx.restore();
  /* On touch, join the finger to the lens so the offset reads as deliberate. */
  if(touchMode && fy>-500){
    ctx.strokeStyle='rgba(169,247,228,.45)'; ctx.lineWidth=2; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(mx,my+R+4); ctx.lineTo(fx,fy-10); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle='rgba(169,247,228,.55)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(fx,fy,9,0,TAU); ctx.stroke();
  }
  /* the ring. It warms towards gold only when the hat is genuinely close —
     a confirmation you are in the right region, not a compass to follow. */
  const d=hat&&!hat.gone ? Math.hypot(hat.x-mx,hat.y-my) : 1e9;
  const warm=1-clamp((d-R*0.5)/(R*1.1),0,1);
  ctx.save();
  ctx.strokeStyle=`rgba(${Math.round(lerp(125,255,warm))},${Math.round(lerp(216,216,warm))},${Math.round(lerp(255,138,warm))},.95)`;
  ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(mx,my,R,0,TAU); ctx.stroke();
  ctx.globalAlpha=.30; ctx.lineWidth=9;
  ctx.beginPath(); ctx.arc(mx,my,R+5,0,TAU); ctx.stroke();
  ctx.globalAlpha=1;
  ctx.strokeStyle='rgba(169,247,228,.5)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(mx-R*.16,my); ctx.lineTo(mx+R*.16,my);
  ctx.moveTo(mx,my-R*.16); ctx.lineTo(mx,my+R*.16); ctx.stroke();
  /* Hold progress. Two things were wrong with the old ring: it was a single
     thin stroke laid straight onto the fur, so it vanished against a pale or
     gold cat — and it was COLOURED BY WHAT YOU WERE HOLDING. Gold for the
     hat, teal for a pick-up, blue for junk. That gave the answer away the
     instant you pressed: tap everything, read the colour, only commit when it
     went gold, and the four-second penalty never cost you anything.

     So: one colour for everything, and a dark casing under a near-white arc,
     which reads on any coat the cat happens to be wearing. */
  if(holding){
    const need=holding.isPower?HOLD_POWER:HOLD;
    const p=clamp(holdT/need,0,1), rr=R+14;
    ctx.lineCap='butt';
    ctx.strokeStyle='rgba(4,8,16,.88)'; ctx.lineWidth=11;
    ctx.beginPath(); ctx.arc(mx,my,rr,0,TAU); ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.14)'; ctx.lineWidth=15;
    ctx.beginPath(); ctx.arc(mx,my,rr,-Math.PI/2,-Math.PI/2+TAU*p); ctx.stroke();
    ctx.lineCap='round';
    ctx.strokeStyle='#f6f9ff'; ctx.lineWidth=6;
    ctx.beginPath(); ctx.arc(mx,my,rr,-Math.PI/2,-Math.PI/2+TAU*p); ctx.stroke();
    /* a tick at the top so there is a visible start and finish line */
    ctx.strokeStyle='rgba(246,249,255,.55)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(mx,my-rr-7); ctx.lineTo(mx,my-rr+7); ctx.stroke();
    if(p>0.86){                       // about to fire
      ctx.strokeStyle=`rgba(255,255,255,${0.25+0.25*Math.sin(t*22)})`; ctx.lineWidth=13;
      ctx.beginPath(); ctx.arc(mx,my,rr,0,TAU); ctx.stroke();
    }
  }
  ctx.restore();
}


/* ================= play ================= */
function objAt(x,y){
  let best=null,bd=1e9;
  for(const o of objs){
    if(o.gone) continue;
    const d=Math.hypot(o.x-x,o.y-y);
    if(d<o.r*0.95 && d<bd){bd=d;best=o;}
  }
  return best;
}
function say(text,tone){ flash={text,tone,t:0}; }

function resolve(o){
  if(o.isHat){
    const took=levelStart-timeLeft;
    const speed=Math.round(320*Math.max(0,1-took/14));
    const gain=460+level*45+speed;
    score+=gain; hats++; level++;
    document.getElementById('score').textContent=score;
    document.getElementById('hats').textContent=hats;
    say('HAT +'+gain,'good');
    /* The cat gets a moment to be pleased about it before the next one turns
       up. The clock stops for it, so the celebration is a reward and not a
       tax on the round. */
    cat.mood='happy'; cat.moodT=CHEER;
    celebrate={t:0, kind:o.kind, r:o.r};
  } else if(o.isPower){
    o.gone=true; powers++;
    if(o.kind==='time'){ timeLeft=Math.min(ROUND+15,timeLeft+BOOST); say('+'+BOOST+' SECONDS','good'); }
    else { lensBoost=Math.min(0.85,lensBoost+0.42); say('WIDER LENS','good'); }
  } else {
    o.gone=true; misses++;
    timeLeft=Math.max(0,timeLeft-PENALTY);
    cat.mood='sad'; cat.moodT=0.95;
    say('NOT A HAT  -'+PENALTY+'s','bad');
  }
  holding=null; holdT=0;
}

let last=performance.now();
function frame(now){
  const dt=Math.min((now-last)/1000,.05); last=now;
  const t=now/1000;
  ctx.clearRect(0,0,W,H);
  if(!running){ requestAnimationFrame(frame); return; }

  if(!celebrate) timeLeft=Math.max(0,timeLeft-dt);
  lensR=baseLens()*(1+lensBoost);

  if(cat.moodT>0){ cat.moodT-=dt; if(cat.moodT<=0) cat.mood='idle'; }

  drawCat(t);
  /* While the cat is celebrating the lens is put away and the hat it was
     hiding floats up out of its head, which is the whole point of the game
     made visible for a second. */
  if(celebrate){
    celebrate.t+=dt;
    const p=clamp(celebrate.t/CHEER,0,1), e=1-Math.pow(1-p,3);
    const r=celebrate.r*lerp(1,2.1,e);
    const y=cat.hy-cat.hr*1.15-cat.hr*1.5*e;
    ctx.save();
    ctx.globalAlpha=1-Math.pow(p,3);
    ctx.translate(cat.cx,y); ctx.rotate(Math.sin(p*6)*0.16);
    ctx.lineJoin='round'; ctx.lineCap='round';
    ctx.strokeStyle='rgba(255,216,138,.28)'; ctx.lineWidth=Math.max(6,r*0.30);
    SHAPES[celebrate.kind](ctx,r); ctx.stroke();
    ctx.fillStyle='rgba(255,216,138,.22)'; SHAPES[celebrate.kind](ctx,r); ctx.fill();
    ctx.strokeStyle='#ffd88a'; ctx.lineWidth=Math.max(2,r*0.11);
    SHAPES[celebrate.kind](ctx,r); ctx.stroke();
    ctx.restore();
    if(celebrate.t>=CHEER){ celebrate=null; newLevel(); }
  }
  else if(mx>-500) drawXray(t);

  /* Hold to pull something out, judged every frame rather than only at the
     moment of the press. On a phone the finger is both the lens and the
     button, so requiring a fresh press meant lifting off and stabbing at a
     spot you could no longer see. Now you sweep to it and hold still: the ring
     fills while the lens rests on one thing, and unwinds if you drift off. */
  if(downNow && !celebrate){
    const o=objAt(mx,my);
    const moved=Math.hypot(mx-lastLx,my-lastLy);
    if(o!==holding){ holding=o; holdT=0; }
    else if(holding){
      if(moved<=2.4) holdT+=dt;
      else holdT=Math.max(0,holdT-dt*2);
    }
    if(holding && holdT >= (holding.isPower?HOLD_POWER:HOLD)) resolve(holding);
  }
  lastLx=mx; lastLy=my;
  if(flash){
    flash.t+=dt;
    const a=1-clamp((flash.t-0.5)/0.6,0,1);
    if(a<=0) flash=null;
    else{
      ctx.save(); ctx.globalAlpha=a; ctx.textAlign='center';
      ctx.fillStyle=flash.tone==='good'?'#ffd88a':'#ff9d9d';
      ctx.font=`700 ${25*TS}px "Space Grotesk", system-ui, sans-serif`;
      ctx.fillText(flash.text, W/2, H*0.13);
      ctx.restore();
    }
  }
  const el=document.getElementById('time'); el.textContent=Math.ceil(timeLeft);
  const low=timeLeft<=10;
  document.getElementById('time-stat').classList.toggle('low',low);
  const fill=document.getElementById('timer-fill');
  fill.style.width=(100*clamp(timeLeft/ROUND,0,1))+'%';
  fill.classList.toggle('low',low);
  /* Never return without scheduling the next frame. `return endRound()` used
     to kill the animation loop outright, so the game froze at the end of a
     round and Play again reset the state with nothing left to draw it. */
  if(timeLeft<=0) endRound();
  requestAnimationFrame(frame);
}

function endRound(){
  running=false; over=true; holding=null;
  document.body.classList.remove('dragging');
  document.getElementById('ov-title').textContent = hats?'Time':'No hats';
  document.getElementById('ov-body').textContent = hats>=6
    ? 'That is a professional standard of rummaging.'
    : hats>=3 ? 'Solid. The trick is committing to the hold early.'
    : 'Sweep in lines rather than circles — you miss less that way.';
  document.getElementById('final-score').textContent=score;
  const tally=document.getElementById('tally');
  tally.innerHTML='';
  for(const [k,v] of [['Hats found',hats],['Cats reached',level],['Wrong holds',misses],['Pick-ups',powers]]){
    const d=document.createElement('div'); d.innerHTML=`<span>${k}</span><b>${v}</b>`; tally.appendChild(d);
  }
  document.getElementById('ov-score').hidden=false;
  document.getElementById('start').textContent='Play again';
  document.getElementById('overlay').hidden=false;
  boardUI.finish();
}
function start(){
  resize();
  score=0; level=1; hats=0; misses=0; powers=0;
  timeLeft=ROUND; running=true; over=false; holding=null; holdT=0; flash=null; celebrate=null; downNow=false;
  document.getElementById('score').textContent='0';
  document.getElementById('hats').textContent='0';
  document.getElementById('overlay').hidden=true;
  newLevel();
  cv.focus({preventScroll:true});
}

/* A fingertip covers the whole lens, so on touch the lens rides above the
   finger and a short leader joins the two. A mouse pointer is small enough to
   sit in the middle of it, so it keeps the lens under the cursor. */
const pos=e=>{
  const r=cv.getBoundingClientRect();
  fx=e.clientX-r.left; fy=e.clientY-r.top;
  touchMode = e.pointerType==='touch';
  const base = Math.max(62, lensR*1.30);
  /* The offset tapers away near the bottom edge. At full offset the lens can
     only reach 62px above wherever the finger can go, which left the bottom of
     the cat unreachable without sliding off the canvas entirely. */
  const off = touchMode ? base*clamp((H-fy)/base, 0, 1) : 0;
  mx=fx;
  my=touchMode ? Math.max(lensR+8, fy-off) : fy;
};
cv.addEventListener('pointermove',e=>{ pos(e); });
cv.addEventListener('pointerleave',()=>{ mx=my=fx=fy=-999; downNow=false; holding=null; holdT=0; });
/* Sweeping the lens with a trackpad would otherwise scroll the page and take
   the timer off screen mid-round. */
cv.addEventListener('wheel',e=>{ if(running) e.preventDefault(); },{passive:false});
cv.addEventListener('pointerdown',e=>{
  if(!running||celebrate) return;
  e.preventDefault();
  /* Capture keeps the lens following a finger that strays off the canvas, but
     it throws for a pointer the element does not own — and an exception here
     would abort the handler before the press is even registered. */
  try { cv.setPointerCapture?.(e.pointerId); } catch {}
  document.body.classList.add('dragging');
  pos(e);
  downNow=true; lastLx=mx; lastLy=my; holding=null; holdT=0;
});
const release=()=>{ downNow=false; holding=null; holdT=0; document.body.classList.remove('dragging'); };
cv.addEventListener('pointerup',release);
cv.addEventListener('pointercancel',release);
document.getElementById('start').addEventListener('click',start);

/* This game's own board. Same mechanics as the others, its own store, so a
   score here never turns up on another game's list. */
const Board = makeBoard({
  id: 'ff808181a061cdc401a06344df6e05d8',
  localKey: 'shats-board',
  storeName: 'schrodingerscards-hats-highscores'
});
const boardUI = attachBoardUI(Board, () => score);

/* ================= legend ================= */
(function(){
  const items=[['top','Hat','hold to pull it out'],['time','Time','a few seconds back'],
               ['lens','Wider lens','for the rest of the cat'],['mug','Not a hat','costs you four seconds']];
  const box=document.getElementById('legend');
  for(const [kind,name,sub] of items){
    const el=document.createElement('div'); el.className='lg';
    const c=document.createElement('canvas'); c.width=68; c.height=68;
    const x=c.getContext('2d'); x.setTransform(2,0,0,2,0,0); x.translate(17,17);
    x.lineJoin='round'; x.lineCap='round';
    const warm=(kind==='time'||kind==='lens');
    const tint=warm?'255,236,182':'141,240,216';
    x.strokeStyle=`rgba(${tint},.20)`; x.lineWidth=4; SHAPES[kind](x,13); x.stroke();
    if(CLOSED.has(kind)){ x.fillStyle=`rgba(${tint},.20)`; SHAPES[kind](x,13); x.fill(); }
    x.strokeStyle=warm?'#ffecb6':'#a9f7e4'; x.lineWidth=1.6; SHAPES[kind](x,13); x.stroke();
    const d=document.createElement('div'); d.innerHTML=`<b>${name}</b><span>${sub}</span>`;
    el.appendChild(c); el.appendChild(d); box.appendChild(el);
  }
})();
resize(); requestAnimationFrame(frame);
