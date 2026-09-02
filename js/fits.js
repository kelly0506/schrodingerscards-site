/* ================= If I Fits I Sits =================
   Pick the vessel the cat fills most exactly. The cat is then lowered in,
   and the whole trick is that it never changes size: it is a column of
   material, and a slice squeezed narrower is made proportionally taller, so
   the area it encloses is the same cat throughout.

   The animation settled after a long round of comparisons:
     - a slice is held to the wall the moment it crosses the rim, so the part
       inside is contorted while the part still above is untouched;
     - how far it then spreads is set by how close it is to the FLOOR, so the
       vessel fills from the bottom and the level visibly climbs;
     - the width eases down to the size of the mouth over a short band above
       the rim, which stops the cat growing a square shoulder on the rim line;
     - the tail is judged by its own root, not by where the head is, so it is
       drawn in as the rear goes under rather than dangling outside.
   Those four are FILL/NECK/TAIL below. Changing them changes the feel of the
   whole game, so they are named rather than scattered. */
const FILL_DEPTH = 0.75;                 // how close to the floor before a slice spreads
const NECK       = 1.3;                  // neck band above the rim, in head-radii
const TAIL       = { rate:1.2, hi:0.88 };// tucks in at this rate, runs this far up the wall

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smoothstep=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a);
const pickOne=a=>a[Math.floor(Math.random()*a.length)];

/* ================= vessels =================
   Half-width profile and bending centreline over t (0 = floor, 1 = rim).
   `hole` is an optional inner radius: the slice becomes a ring and the cat
   has to fit around a post. */
const DEFS = [
  { key:'bowl',   name:'Cereal bowl', short:'Bowl',   h:0.62, half:t=>0.52+0.46*t,                     cx:()=>0 },
  { key:'jar',    name:'Jam jar', short:'Jar',       h:1.05, half:t=>0.52-0.04*Math.max(0,t-0.86)*6,  cx:()=>0 },
  { key:'mug',    name:'Big mug', short:'Mug',       h:0.92, half:()=>0.50,                           cx:()=>0, handle:true },
  { key:'box',    name:'Cardboard box', short:'Box', h:0.80, half:()=>0.78,                           cx:()=>0 },
  { key:'vase',   name:'Vase', short:'Vase',          h:1.30, half:t=>0.30+0.42*Math.sin(Math.PI*Math.min(1,t*1.15))+0.10*t, cx:()=>0 },
  { key:'fish',   name:'Fishbowl', short:'Fishbowl',      h:0.96, half:t=>0.72*Math.sqrt(Math.max(0,1-Math.pow(2*(t*0.92)-0.92,2))), cx:()=>0 },
  { key:'glass',  name:'Wine glass', short:'Wine',    h:0.86, half:t=>0.16+0.52*t,                     cx:()=>0, stem:true },
  { key:'tube',   name:'Test tube', short:'Tube',     h:1.45, half:()=>0.21,                           cx:()=>0 },
  { key:'tub',    name:'Bathtub', short:'Bath',       h:0.44, half:()=>1.02,                           cx:()=>0 },
  { key:'boot',   name:'Wellington', short:'Boot',    h:1.15, half:t=>t<0.30?0.34:0.30,                cx:t=>t<0.30?-0.42+1.4*t:0 },
  { key:'kettle', name:'Kettle', short:'Kettle',        h:0.90, half:t=>0.60-0.18*Math.pow(t,3),         cx:()=>0, spout:true },
  { key:'sink',   name:'Sink', short:'Sink',          h:0.58, half:t=>0.80+0.16*t,                     cx:()=>0 },
  { key:'pot',    name:'Plant pot', short:'Pot',     h:0.78, half:t=>0.42+0.26*t,                     cx:()=>0 },
  { key:'flask',  name:'Erlenmeyer', short:'Flask',    h:1.12, half:t=>t<0.70?0.74-0.56*(t/0.70):0.18,  cx:()=>0 },
  { key:'zig',    name:'Zigzag jar', short:'Zigzag',    h:1.00, half:t=>0.30+0.20*(Math.floor(t*5)%2),   cx:()=>0 },
  { key:'step',   name:'Step tower', short:'Steps',    h:1.10, half:t=>0.66-0.13*Math.floor(t*4),       cx:()=>0 },
  { key:'martini',name:'Martini glass', short:'Martini', h:0.74, half:t=>0.06+0.84*t,                     cx:()=>0, stem:true },
  { key:'booster',name:'Booster box', short:'Booster', h:1.02, half:()=>0.46,                           cx:()=>0 },
  { key:'deck',   name:'Deck box', short:'Deck',      h:0.64, half:()=>0.40,                           cx:()=>0 },
  { key:'binder', name:'Card binder', short:'Binder',   h:0.90, half:()=>0.66,                           cx:()=>0 },
  { key:'ball',   name:'Poke ball', short:'Ball',     h:0.92, half:t=>0.66*Math.sqrt(Math.max(0,1-Math.pow(2*(t*0.94)-0.94,2))), cx:()=>0 },
  { key:'funnel', name:'Funnel', short:'Funnel',        h:0.98, half:t=>t<0.55?0.10:0.10+0.72*((t-0.55)/0.45), cx:()=>0 },
  { key:'trophy', name:'Trophy cup', short:'Trophy',    h:0.88, half:t=>0.22+0.50*Math.pow(t,0.55),      cx:()=>0, stem:true },
  { key:'hour',   name:'Hourglass', short:'Hourglass',     h:1.20, half:t=>0.24+0.42*Math.abs(2*t-1),       cx:()=>0 },
  { key:'donut',  name:'Donut vase', short:'Donut',    h:1.22,
      half:t=>{ const c=0.20+0.46*Math.sqrt(Math.max(0,1-Math.pow(clamp((t-0.42)/0.48,-1,1),2)));
                return t<0.74 ? c : lerp(c,0.17,clamp((t-0.74)/0.26,0,1)); },
      hole:t=>0.26*Math.sqrt(Math.max(0,1-Math.pow(clamp((t-0.42)/0.26,-1,1),2))),
      cx:()=>0 }
];
DEFS.forEach(d=>{ if(!d.hole) d.hole=()=>0; });
const STEPS=240;
/* Capacity counts material width, so a ring only holds what fits round the post. */
const volumeOf=d=>{let a=0;for(let i=0;i<STEPS;i++){const t=(i+0.5)/STEPS;
  a+=2*Math.max(0,d.half(t)-d.hole(t))*(d.h/STEPS);} return a;};
DEFS.forEach(d=>d.baseVol=volumeOf(d));
const maxHalf=d=>{let m=0;for(let i=0;i<=80;i++)m=Math.max(m,d.half(i/80));return m;};

/* The six rarities from Schrodinger's Cats, so it is the same animal in both. */
const BREEDS=[
  { key:'common',   name:'Common',     fur:'#9aa3bd', mark:'#7c86a4', asp:1.10, hr:1.00, ear:'round', tail:'stub', eye:'sleepy' },
  { key:'uncommon', name:'Uncommon',   fur:'#d9c49b', mark:'#b9a274', asp:1.28, hr:1.02, ear:'point', tail:'long', eye:'normal' },
  { key:'holo',     name:'Holo',       fur:'#7dd8ff', mark:'#4fb4e0', asp:1.02, hr:1.04, ear:'tall',  tail:'long', eye:'wide' },
  { key:'ultra',    name:'Ultra rare', fur:'#b48bff', mark:'#8a63d6', asp:0.98, hr:1.20, ear:'point', tail:'curl', eye:'huge' },
  { key:'sir',      name:'Sir',        fur:'#ff8fd0', mark:'#e05fa8', asp:1.16, hr:1.08, ear:'tuft',  tail:'poof', eye:'normal' },
  { key:'gold',     name:'Gold',       fur:'#ffd88a', mark:'#e0ac48', asp:1.06, hr:1.08, ear:'crown', tail:'flow', eye:'derp' }
];

/* The cat as a column of material, bottom (rear) to top (shoulders). Every
   animator below works on this same column and every one of them conserves
   its area exactly, because a slice squeezed narrow is made proportionally
   taller and nothing else is ever touched. */
const NM=110;
function bodyShape(v){
  const q=Math.abs((v-0.36)/0.64);
  return 0.44+0.56*Math.pow(Math.max(0,1-Math.pow(q,2.4)),0.55);
}
function natural(B, A){
  const w=[]; let s=0;
  for(let i=0;i<=NM;i++){ const x=bodyShape(i/NM)*B.asp*0.5; w.push(x); }
  for(let i=0;i<NM;i++) s+=w[i]+w[i+1];
  s*=1/NM;                                  // area for height 1
  const h=Math.sqrt(A/s), f=h;              // uniform scale keeps the build
  return { w:w.map(x=>x*f), h, N:NM };
}
/* Walk the column from a starting edge, letting something else decide how
   wide each slice is allowed to be. Thickness is set by conservation, so the
   cat comes out the same size whatever the width rule does. */
function walk(nat, i0, i1, startY, widthAt){
  const ys=[],ws=[],cxs=[],hs=[],dm=1/nat.N; let y=startY; let anyHole=false;
  for(let i=i0;i<=i1;i++){
    const wn=nat.w[i], r=widthAt(y,wn,i/nat.N);
    const w=Math.max(r.w,0.5);
    ys.push(y); ws.push(w); cxs.push(r.cx||0); hs.push(r.hole||0);
    if(r.hole>0.01) anyHole=true;
    if(i<i1) y-=(wn/w)*dm*nat.h;
  }
  return {ys,ws,cxs,hs,anyHole,top:ys[ys.length-1]};
}
/* The body is one outer silhouette with the post punched out of it, rather
   than two bands drawn side by side. The bands version left a seam straight
   down the middle wherever the hole closed — both the fill join and, worse,
   the outline stroke tracing the two inner edges. Punching a hole leaves the
   centre circle floating, which is what it should look like. */
function pathOf(ctx, seg, x0){
  const n=seg.ys.length;
  ctx.beginPath();
  for(let i=0;i<n;i++){ const x=x0+seg.cxs[i]-(seg.hs[i]+seg.ws[i]);
    i?ctx.lineTo(x,seg.ys[i]):ctx.moveTo(x,seg.ys[i]); }
  for(let i=n-1;i>=0;i--) ctx.lineTo(x0+seg.cxs[i]+seg.hs[i]+seg.ws[i], seg.ys[i]);
  ctx.closePath();
}
/* Adds the hole as a second subpath, over only the stretch where it is
   actually open. Tracing its degenerate ends is what drew the stray lines. */
function addHole(ctx, seg, x0){
  const n=seg.ys.length; let lo=-1,hi=-1;
  for(let i=0;i<n;i++) if(seg.hs[i]>0.4){ if(lo<0) lo=i; hi=i; }
  if(lo<0||hi<=lo) return false;
  ctx.moveTo(x0+seg.cxs[lo]-seg.hs[lo], seg.ys[lo]);
  for(let i=lo;i<=hi;i++) ctx.lineTo(x0+seg.cxs[i]-seg.hs[i], seg.ys[i]);
  for(let i=hi;i>=lo;i--) ctx.lineTo(x0+seg.cxs[i]+seg.hs[i], seg.ys[i]);
  ctx.closePath(); return true;
}
function widthNear(seg, y){
  let best=0,bd=1e9;
  for(let i=0;i<seg.ys.length;i++){const d=Math.abs(seg.ys[i]-y); if(d<bd){bd=d;best=seg.ws[i];}}
  return best;
}
/* ================= drawing a cat =================
   The last pass drifted into mouse territory: circular ears, shut eyes, a
   grey body and pads dotted over the belly. The fixes are all cat-signals —
   pointed ears, big open eyes with upright pupils, a muzzle, and above all a
   tail, which is the single strongest thing that says cat and had been
   hidden inside the body where nobody could see it. */
function headAt(seg, R, st){
  const topY=seg.top;
  const wTop=widthNear(seg, topY+R*0.55);
  const sink=smoothstep(clamp((wTop/R-0.52)/0.55,0,1));
  /* Sunk in where there is room for it; sitting on top where there is not.
     The old perch only lifted the head by 0.58R, which left it half inside a
     narrow neck and spilling out through both walls. */
  const cy=topY+R*(0.70*sink-0.88*(1-sink));
  return { y:cy, sink, w:widthNear(seg,cy) };
}
function drawEars(ctx,x,y,R,B,fur,inner){
  const ear=(sgn,tall,wide,lean)=>{
    const bx=x+sgn*R*0.60, tipx=x+sgn*R*(0.60+lean), tipy=y-R*tall;
    ctx.fillStyle=fur; ctx.beginPath();
    ctx.moveTo(bx-sgn*R*wide, y-R*0.44);
    ctx.quadraticCurveTo(x+sgn*R*(0.55+lean*0.6), y-R*(tall*0.72), tipx, tipy);
    ctx.quadraticCurveTo(x+sgn*R*(0.92+lean*0.5), y-R*(tall*0.55), bx+sgn*R*wide, y-R*0.24);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle=inner; ctx.beginPath();
    ctx.moveTo(bx-sgn*R*wide*0.42, y-R*0.42);
    ctx.quadraticCurveTo(x+sgn*R*(0.58+lean*0.6), y-R*(tall*0.66), tipx-sgn*R*0.04, tipy+R*0.20);
    ctx.quadraticCurveTo(x+sgn*R*(0.80+lean*0.4), y-R*(tall*0.50), bx+sgn*R*wide*0.42, y-R*0.28);
    ctx.closePath(); ctx.fill();
  };
  if(B.ear==='crown'){ ear(-1,1.42,0.34,0.10); ear(1,1.42,0.34,0.10);
    ctx.fillStyle=fur; ctx.beginPath();
    ctx.moveTo(x-R*0.20,y-R*0.86); ctx.lineTo(x,y-R*1.68); ctx.lineTo(x+R*0.20,y-R*0.86);
    ctx.closePath(); ctx.fill(); return; }
  const tall=B.ear==='tall'?1.72:B.ear==='round'?1.02:1.34;
  const wide=B.ear==='round'?0.42:0.34;
  ear(-1,tall,wide,0.16); ear(1,tall,wide,0.16);
  if(B.ear==='tuft'){ ctx.fillStyle=fur;
    ctx.beginPath(); ctx.arc(x-R*0.98,y-R*0.58,R*0.19,0,7); ctx.arc(x+R*0.98,y-R*0.58,R*0.19,0,7); ctx.fill(); }
}
function drawFace(ctx,S,x,y,R,B,face){
  const ink='#141830';
  const ex=R*0.40, ey=-R*0.06;
  const big=B.eye==='huge'?1.26:B.eye==='wide'?1.14:B.eye==='sleepy'?0.96:1.04;
  const er=R*0.30*big;
  /* muzzle: two cheek bumps. A cat has a face; a mouse has a snout. */
  ctx.fillStyle='rgba(255,255,255,.13)';
  ctx.beginPath(); ctx.ellipse(x-R*0.20,y+R*0.50,R*0.28,R*0.22,0,0,7);
  ctx.ellipse(x+R*0.20,y+R*0.50,R*0.28,R*0.22,0,0,7); ctx.fill();
  if(face==='bliss'){
    ctx.strokeStyle=ink; ctx.lineWidth=R*0.10; ctx.lineCap='round';
    for(const s of [-ex,ex]){ ctx.beginPath(); ctx.arc(x+s,y+ey,er*0.94,Math.PI*1.12,Math.PI*1.88); ctx.stroke(); }
  } else {
    for(const s of [-ex,ex]){
      ctx.fillStyle='#ffd25e'; ctx.beginPath(); ctx.ellipse(x+s,y+ey,er,er*1.06,0,0,7); ctx.fill();
      /* upright pupil — the most cat-like detail on the whole animal */
      ctx.fillStyle=ink;
      const pw=face==='alarm'?0.62:face==='squish'?0.70:0.34, ph=face==='flat'?0.34:0.94;
      ctx.beginPath(); ctx.ellipse(x+s,y+ey,er*pw,er*ph,0,0,7); ctx.fill();
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(x+s+er*0.30,y+ey-er*0.36,er*0.20,0,7); ctx.fill();
    }
  }
  ctx.fillStyle='#ff9db8';
  ctx.beginPath(); ctx.moveTo(x,y+R*0.46); ctx.lineTo(x-R*0.12,y+R*0.30); ctx.lineTo(x+R*0.12,y+R*0.30);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle=ink; ctx.lineWidth=R*0.06; ctx.lineCap='round';
  ctx.beginPath();
  if(face==='bliss') ctx.arc(x,y+R*0.44,R*0.22,0.12*Math.PI,0.88*Math.PI);
  else if(face==='alarm') ctx.ellipse(x,y+R*0.62,R*0.12,R*0.17,0,0,7);
  else { ctx.arc(x-R*0.12,y+R*0.54,R*0.13,1.75*Math.PI,0.62*Math.PI);
         ctx.arc(x+R*0.12,y+R*0.54,R*0.13,0.38*Math.PI,1.25*Math.PI); }
  ctx.stroke();
  ctx.lineWidth=R*0.045; ctx.strokeStyle='rgba(20,24,48,.42)';
  for(const g of [-1,1]) for(const [dy,ln,tl] of [[-0.02,0.62,-0.10],[0.12,0.68,0.02],[0.26,0.60,0.14]]){
    ctx.beginPath(); ctx.moveTo(x+g*R*0.46,y+R*dy); ctx.lineTo(x+g*R*(0.46+ln),y+R*(dy+tl)); ctx.stroke();
  }
}
function bez(p0,p1,p2,p3,s){
  const m=1-s;
  return [ m*m*m*p0[0]+3*m*m*s*p1[0]+3*m*s*s*p2[0]+s*s*s*p3[0],
           m*m*m*p0[1]+3*m*m*s*p1[1]+3*m*s*s*p2[1]+s*s*s*p3[1] ];
}
/* The tail, tucked in by its own root rather than by where the head is.
   That was the bug: "is this cat still in the open" was answered by looking
   at the top of the column, so the tail went on dangling outside the jar
   long after the rear of the cat was under the rim. It is now judged by the
   slice the tail is actually attached to, and the shape lerps from the curl
   it has in open air to the line it takes down the inside wall, so it visibly
   gets drawn in as the cat sinks. */
function drawTail(ctx,S,seg,x0,B,R,t,st,o){
  const n=seg.ys.length, M=22;
  const i0=Math.max(1,Math.round(n*0.20));
  const anchorY=seg.ys[i0];
  const u=st ? smoothstep(clamp((anchorY-st.rimY)/Math.max(R*o.rate,1),0,1)) : 0;
  const flick=Math.sin(t*1.7)*R*0.16;
  const bx=x0+seg.cxs[i0]+seg.ws[i0]*0.80, by=anchorY+R*0.10;
  const curl=(B.tail==='curl'||B.tail==='flow')?1:0.55;
  const P=[[bx,by],[bx+R*1.10,by+R*0.30],
           [bx+R*1.35,by-R*0.85*curl+flick],[bx+R*0.55,by-R*(1.25+0.45*curl)+flick]];
  const lo=Math.round(n*0.05), hi=Math.min(n-1,Math.round(n*o.hi));
  const w0=B.tail==='poof'?0.48:0.34, w1=B.tail==='poof'?0.32:0.22;
  const lw=Math.max(2*S, R*lerp(w0,w1,u));
  const pts=[];
  for(let j=0;j<M;j++){
    const s=j/(M-1);
    const air=bez(P[0],P[1],P[2],P[3],s);
    const i=Math.min(n-1,Math.round(lo+(hi-lo)*s));
    const wall=[ x0+seg.cxs[i]+seg.ws[i]*(0.80-0.34*Math.sin(s*Math.PI))+flick*0.25*s*(o.hi>0.75?1:0),
                 seg.ys[i] ];
    const p=[lerp(air[0],wall[0],u), lerp(air[1],wall[1],u)];
    /* Mid-tuck the curl can still swing wide of the glass. Bend it against
       the wall rather than letting the clip lop it off — a tail sliding down
       the inside reads far better than a tail with a bite out of it. */
    if(st && p[1]>=st.rimY){
      const tt=clamp((st.floorY-p[1])/(st.def.h*st.px),0,1);
      const hw=st.def.half(tt)*st.px, cxw=x0+st.def.cx(tt)*st.px;
      const inset=Math.min(hw*0.34, lw*0.55);
      p[0]=clamp(p[0], cxw-hw+inset, cxw+hw-inset);
    }
    pts.push(p);
  }
  ctx.save();
  if(o.fade) ctx.globalAlpha=1-0.94*smoothstep(clamp((u-0.35)/0.65,0,1));
  ctx.strokeStyle=B.mark; ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.lineWidth=lw;
  ctx.beginPath(); pts.forEach((p,j)=>j?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
  ctx.stroke();
  if(B.tail==='poof'){ const e=pts[M-1]; ctx.fillStyle=B.mark;
    ctx.beginPath(); ctx.arc(e[0],e[1],R*lerp(0.30,0.22,u),0,7); ctx.fill(); }
  ctx.restore();
}
/* Whatever the tail is doing, it may not leave through a wall. Above the rim
   there is nothing holding it in. */
function clipVessel(ctx, st){
  const {def,px,x0,floorY,rimY,W,H}=st, N=64;
  ctx.beginPath();
  for(let i=0;i<=N;i++){const t=i/N; ctx.lineTo(x0+(def.cx(t)-def.half(t))*px, floorY-t*def.h*px);}
  ctx.lineTo(x0-W,rimY); ctx.lineTo(x0-W,rimY-H); ctx.lineTo(x0+W,rimY-H); ctx.lineTo(x0+W,rimY);
  for(let i=N;i>=0;i--){const t=i/N; ctx.lineTo(x0+(def.cx(t)+def.half(t))*px, floorY-t*def.h*px);}
  ctx.closePath(); ctx.clip();
}
function drawPaws(ctx,S,seg,x0,R){
  const n=seg.ys.length, i=Math.round(n*0.46);
  const y=seg.ys[i], w=seg.ws[i], cx=seg.cxs[i], r=R*0.30;
  if(w<r*2.5) return;
  ctx.fillStyle='rgba(255,197,212,.9)';
  for(const s of [-1,1]){
    const px=x0+cx+s*r*1.05;
    ctx.beginPath(); ctx.ellipse(px,y+r*0.28,r*0.72,r*0.58,0,0,7); ctx.fill();
    if(r>5*S) for(const [dx,dy] of [[-0.68,-0.48],[-0.22,-0.78],[0.22,-0.78],[0.68,-0.48]]){
      ctx.beginPath(); ctx.arc(px+dx*r,y+dy*r,r*0.26,0,7); ctx.fill(); }
  }
}

function roomFn(st){
  return y=>{
    if (y < st.rimY-0.001) return null;
    const t=clamp((st.floorY-y)/(st.def.h*st.px),0,1);
    const hole=st.def.hole(t)*st.px;
    return { w:Math.max(st.def.half(t)*st.px-hole, 0.5), cx:st.def.cx(t)*st.px, hole };
  };
}
/* All four are "spreads as it sinks". A slice is held to the wall the moment
   it crosses the rim, and how soon it then fills out to the full width is
   decided by where that slice is — not by the clock. The variants differ in
   what "where" means and how quickly it counts. */
function loweredIn(st,k,o){
  const room=roomFn(st);
  const fall=o.fall||0.72;
  const descend=smoothstep(clamp(k/fall,0,1));
  const lead=lerp(st.startY,st.floorY,descend);
  const span=Math.max(st.def.h*st.px*o.grip, 1);
  const tail=o.tail ? smoothstep(clamp((k-o.tail)/Math.max(1-o.tail,1e-3),0,1)) : 0;
  /* Above the rim the cat used to be left at its full natural width, and
     below it snapped straight to the vessel's. That discontinuity is the
     blocky shoulder that appeared at the mouth as the cat went in — a shape
     that looked like a separate object plugging the jar. Easing the width
     down to the mouth over a band above the rim removes the step: the two
     sides now meet at exactly the same width, and the cat necks into the
     opening the way something soft actually does. */
  const rimHW=st.def.half(1)*st.px;
  const band=o.neck ? o.neck*st.R : 0;
  const seg=walk(st.nat,0,st.nat.N,lead,(y,wn)=>{
    const r=room(y);
    if(!r){
      if(!band) return {w:wn,cx:0,hole:0};
      const above=smoothstep(clamp((st.rimY-y)/band,0,1));
      return { w:Math.min(wn, lerp(rimHW,wn,above)), cx:0, hole:0 };
    }
    /* from the rim: how far this slice has sunk past the mouth.
       from the floor: how close it is to the bottom, so the vessel fills
       from the base upwards and the fill line climbs. */
    let rel = o.from==='floor'
      ? 1-smoothstep(clamp((st.floorY-y)/span,0,1))
      : smoothstep(clamp((y-st.rimY)/span,0,1));
    if(tail) rel=Math.max(rel,tail);
    return { w:lerp(Math.min(wn,r.w),r.w,rel), cx:r.cx, hole:r.hole };
  });
  return { pieces:[{seg,head:true,free:seg.top<st.rimY}] };
}
/* All four fill from the floor up, which is the one you picked. The only
   thing that differs is what the tail does on the way in. */


/* ================= the cat, assembled =================
   Split in two on purpose: the vessel outline is stroked between them. The
   body inside the vessel is exactly the vessel's shape, so the outline traces
   it and reads correctly, but the head is the one rigid part that can be
   wider than the vessel — stroking the walls across it drew the neck straight
   over the cat's face. */
function drawBody(ctx,S,st,seg,x0,B,R,t){
  pathOf(ctx,seg,x0);
  const holed=addHole(ctx,seg,x0);
  ctx.fillStyle=B.fur; ctx.fill(holed?'evenodd':'nonzero');
  ctx.save(); ctx.clip(holed?'evenodd':'nonzero');
  if(!seg.anyHole) drawPaws(ctx,S,seg,x0,R);      // never laid across the post
  ctx.restore();
  if(!seg.anyHole){
    ctx.save(); if(st) clipVessel(ctx,st);
    drawTail(ctx,S,seg,x0,B,R,t,st,TAIL); ctx.restore();
  }
  pathOf(ctx,seg,x0); ctx.strokeStyle='rgba(10,13,24,.28)'; ctx.lineWidth=2*S; ctx.stroke();
}
function drawHead(ctx,S,seg,x0,B,R,face){
  const hd=headAt(seg,R), hx=x0+(seg.cxs[seg.cxs.length-1]||0);
  drawEars(ctx,hx,hd.y,R,B,B.fur,'#ff9db8');
  ctx.fillStyle=B.fur; ctx.beginPath(); ctx.arc(hx,hd.y,R,0,7); ctx.fill();
  drawFace(ctx,S,hx,hd.y,R,B,face);
}
/* The cat in the open, before a vessel is chosen: no walls, so every slice
   simply takes its natural width. */
const freeSeg=(nat,bottomY)=>walk(nat,0,nat.N,bottomY,(y,wn)=>({w:wn,cx:0,hole:0}));

/* ================= scoring =================
   Purrfect is deliberately a narrow window — it should feel earned, and the
   drop to the next tier is steep so playing safe is not a strategy. */
function judge(fill){
  if (fill > 1.06) return { key:'over',  label:"Doesn't fit", life:-1 };
  if (fill >= 0.94) return { key:'perf', label:'Purrfect',    life:+1 };
  if (fill >= 0.82) return { key:'snug', label:'Snug',        life: 0 };
  if (fill >= 0.62) return { key:'roomy',label:'Roomy',       life: 0 };
  if (fill >= 0.38) return { key:'loose',label:'Rattling',    life:-1 };
  return                    { key:'swim', label:'Swimming',   life:-1 };
}
function pointsFor(f){
  if (f > 1.06) return 0;
  if (f >= 0.94) return Math.round(800 + 400*clamp((f-0.94)/0.12,0,1));
  if (f >= 0.82) return Math.round(300 + 150*((f-0.82)/0.12));
  if (f >= 0.62) return Math.round(110 +  90*((f-0.62)/0.20));
  if (f >= 0.38) return 40;
  return 10;
}
/* Said in cats, because that is something the eye can check. A percentage of
   volume never matched what the picture was doing. */
const QUIPS = {
  over: [
    ['over by a whisker, and a whisker counts', 0.12],
    ['a fifth of this cat is now furniture', 0.26],
    ['a third of him declined to participate', 0.42],
    ['half a cat is up there, judging you', 9]
  ],
  under: [
    ['not a whisker spare. Insufferable.', 0.05],
    ['a breath of air above the ears. He noticed.', 0.14],
    ['a bit of slack at the top. He is being gracious.', 0.28],
    ['room for another third of a cat, if you had one', 0.50],
    ['half a cat of spare room. He has begun sulking.', 0.85],
    ['you could fit a second cat in there. Please do not.', 2.2],
    ['this is not a vessel, it is a studio flat', 99]
  ]
};
function roomPhrase(fill){
  if (fill > 1.06){
    const outside = 1 - 1/fill;
    return (QUIPS.over.find(q=>outside < q[1]) || QUIPS.over[3])[0];
  }
  const spare = 1/fill - 1;
  return (QUIPS.under.find(q=>spare < q[1]) || QUIPS.under[6])[0];
}

/* This game's own board. Same mechanics as the others, its own store, so a
   score here never turns up on another game's list. */
const Board = makeBoard({
  id: 'ff808181a061cdc401a06344dd7a05d7',
  localKey: 'sfits-board',
  storeName: 'schrodingerscards-fits-highscores'
});

/* ================= the round ================= */
const cv=document.getElementById('stage'), ctx=cv.getContext('2d');
let W=0,H=0,S=1,TS=1,BASEPX=1;
function resize(){
  const dpr=Math.min(devicePixelRatio||1,2), r=cv.getBoundingClientRect();
  W=r.width; H=r.height;
  cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  S=Math.min(W/880,H/550);
  /* Geometry scales with the board, but text cannot: at 366px wide S is 0.42,
     which made the vessel labels 4.6px and the prompt 5.8px. Type gets its own
     scale with a floor under it. */
  TS=clamp(S,0.86,1.12);
}
addEventListener('resize',()=>{resize();layout();});

const MAX_LIVES=9;
let score=0, round=1, lives=MAX_LIVES, phase='idle', running=false;
let cat=null, slots=[], picked=null, result=null, anim=0, hoverIdx=-1;

const catArea=()=>cat.vol*BASEPX*BASEPX;

function newRound(){
  cat={ vol:rand(0.34,1.15), B:pickOne(BREEDS), face:'normal', homeX:0, homeY:0,
        flick:rand(0,6), nat:null, stage:null };
  const spread=Math.max(0.12,0.78-(round-1)*0.058);
  const good=rand(0.94,1.00);
  /* Five options: the right one, one just over, one just short, and two that
     are clearly wrong. The near misses make it a judgement rather than a
     lottery, and the gaps close as the rounds go on. */
  const targets=[good,
    Math.max(1.08, Math.min(1.9,  good + spread*0.55)),
    Math.min(0.92, Math.max(0.66, good - spread*0.42)),
    Math.min(0.76, Math.max(0.44, good - spread*0.92)),
    Math.min(0.48, Math.max(0.26, good - spread*1.70))];
  /* That last floor is a drawing constraint as much as a difficulty one. All
     five vessels share one pixel scale, so a decoy holding eight cats forces
     the scale down and every cat in the round gets drawn half-size. */
  const aspect = d => (2*maxHalf(d))/d.h;
  const chosen=[];
  const pool=DEFS.slice().sort(()=>Math.random()-0.5);
  slots=targets.map(fill=>{
    const want=cat.vol/fill;
    /* Prefer vessels that look different from each other, not just ones whose
       capacity is closest — five near-identical jars would make the guess
       impossible for the wrong reason. */
    const cost = d => Math.abs(d.baseVol-want)
      + chosen.reduce((acc,c)=>acc + (Math.abs(Math.log(aspect(d)/aspect(c)))<0.28 ? 0.40 : 0), 0);
    pool.sort((a,b)=>cost(a)-cost(b));
    const def=pool.shift(); chosen.push(def);
    return { def, scale:Math.sqrt(want/def.baseVol), capacity:want, fill };
  });
  phase='idle'; picked=null; result=null; anim=0; hoverIdx=-1;
  layout();
  document.getElementById('round').textContent=round;
}
function layout(){
  if(!slots.length) return;
  /* Vessel size is bound by width — five of them have to fit across — so the
     row is pushed out towards the edges for every pixel it can get, and the
     cat sits closer to them than it used to. That closes the dead band in the
     middle, which is what made the board look small on a phone. */
  const baseY=H*0.872, slotW=W*0.188, slotH=H*0.58;
  let px=Infinity;
  slots.forEach(s=>{ px=Math.min(px, slotW/(2*maxHalf(s.def)*s.scale), slotH/(s.def.h*s.scale)); });
  BASEPX=px;
  slots.forEach((s,i)=>{
    s.x=W*(0.112+i*0.194); s.y=baseY; s.px=px*s.scale;
    s.w=2*maxHalf(s.def)*s.px; s.hpx=s.def.h*s.px;
    s.span=W*0.194;          // centre to centre: what a label actually has to fit in
  });
  if(cat){
    cat.homeX=W/2; cat.homeY=H*0.170;
    cat.nat=natural(cat.B, catArea());
    cat.R=Math.sqrt(catArea())*0.30*cat.B.hr;
    if(cat.stage) cat.stage=stageFor(slots[picked]);
  }
}
/* Everything loweredIn needs about the chosen vessel, built once per pour. */
function stageFor(s){
  return { W, H, S, def:s.def, px:s.px, x0:s.x,
           floorY:s.y, rimY:s.y-s.def.h*s.px,
           nat:cat.nat, R:cat.R, grip:FILL_DEPTH,
           startY:cat.homeY+cat.nat.h*0.5 };
}

function drawPost(s){
  const d=s.def, N=96; let lo=-1,hi=-1;
  for(let i=0;i<=N;i++) if(d.hole(i/N)*s.px>0.4){ if(lo<0) lo=i; hi=i; }
  if(lo<0||hi<=lo) return;
  ctx.beginPath();
  for(let i=lo;i<=hi;i++){const t=i/N; ctx.lineTo(s.x+(d.cx(t)-d.hole(t))*s.px, s.y-t*d.h*s.px);}
  for(let i=hi;i>=lo;i--){const t=i/N; ctx.lineTo(s.x+(d.cx(t)+d.hole(t))*s.px, s.y-t*d.h*s.px);}
  ctx.closePath();
  ctx.fillStyle='#141830'; ctx.fill();
  ctx.strokeStyle='#3a4170'; ctx.lineWidth=3*S; ctx.lineJoin='round'; ctx.stroke();
}
function drawVessel(s,hover,behind){
  const d=s.def, N=64; ctx.save();
  if(behind){
    if(d.stem){ ctx.strokeStyle='#2a2f52'; ctx.lineWidth=5*S; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(s.x,s.y+22*S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s.x-16*S,s.y+22*S); ctx.lineTo(s.x+16*S,s.y+22*S); ctx.stroke(); }
    if(d.handle){ ctx.strokeStyle=hover?'#7dd8ff':'#3a4170'; ctx.lineWidth=6*S;
      ctx.beginPath(); ctx.arc(s.x+s.w/2+6*S,s.y-s.hpx*0.5,s.hpx*0.26,-1.25,1.25); ctx.stroke(); }
    if(d.spout){ ctx.strokeStyle=hover?'#7dd8ff':'#3a4170'; ctx.lineWidth=5*S; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(s.x-s.w/2+2*S,s.y-s.hpx*0.62);
      ctx.quadraticCurveTo(s.x-s.w/2-15*S,s.y-s.hpx*0.76,s.x-s.w/2-12*S,s.y-s.hpx*0.94); ctx.stroke(); }
    ctx.beginPath();
    for(let i=0;i<=N;i++){const t=i/N; ctx.lineTo(s.x+(d.cx(t)-d.half(t))*s.px, s.y-t*d.h*s.px);}
    for(let i=N;i>=0;i--){const t=i/N; ctx.lineTo(s.x+(d.cx(t)+d.half(t))*s.px, s.y-t*d.h*s.px);}
    ctx.closePath(); ctx.fillStyle='rgba(10,13,24,.6)'; ctx.fill();
  } else {
    ctx.strokeStyle=hover?'#7dd8ff':'#3a4170';
    ctx.lineWidth=(hover?4.5:3.5)*S; ctx.lineJoin='round'; ctx.lineCap='round';
    ctx.beginPath();
    for(let i=N;i>=0;i--){const t=i/N,X=s.x+(d.cx(t)-d.half(t))*s.px,Y=s.y-t*d.h*s.px; i===N?ctx.moveTo(X,Y):ctx.lineTo(X,Y);}
    for(let i=0;i<=N;i++){const t=i/N; ctx.lineTo(s.x+(d.cx(t)+d.half(t))*s.px, s.y-t*d.h*s.px);}
    ctx.stroke();
    ctx.fillStyle=hover?'#7dd8ff':'#6d7299';
    ctx.font=`600 ${11*TS}px "Space Grotesk", system-ui, sans-serif`;
    ctx.textAlign='center';
    /* The room a label has is the gap to the next vessel, not the width of
       the vessel it sits under — a wide box next to a narrow tube still only
       gets its own slot. Full name when it fits, short name when it does not,
       and only then does the type give any ground, down to a readable floor. */
    let label=d.name.toUpperCase();
    const room=s.span-6;
    if(ctx.measureText(label).width > room) label=(d.short||d.name).toUpperCase();
    let fs=11*TS;
    while(fs>8.2 && ctx.measureText(label).width > room){
      fs-=0.4; ctx.font=`600 ${fs}px "Space Grotesk", system-ui, sans-serif`;
    }
    ctx.fillText(label, s.x, s.y+(d.stem?40:22)*S);
  }
  ctx.restore();
}

/* ================= the drop =================
   The hoist carries the cat across at its own size; after that loweredIn
   owns the descent, because the shape and the depth have to move together. */
const T_LIFT=0.42, T_OOZE=2.95;

let last=performance.now();
function frame(now){
  const dt=Math.min((now-last)/1000,.05); last=now;
  const t=now/1000;
  ctx.clearRect(0,0,W,H);
  if(!running){ requestAnimationFrame(frame); return; }
  if(phase!=='idle') anim+=dt;

  slots.forEach((s,i)=>drawVessel(s, phase==='idle'&&i===hoverIdx, true));

  if(phase==='idle'){
    const y=cat.homeY+Math.sin(t*1.6)*4*S;
    const seg=freeSeg(cat.nat, y+cat.nat.h*0.5);
    drawBody(ctx,S,null,seg,cat.homeX,cat.B,cat.R,t);
    drawHead(ctx,S,seg,cat.homeX,cat.B,cat.R,cat.face);
    ctx.fillStyle='#a8adcf'; ctx.textAlign='center';
    ctx.font=`500 ${14*TS}px Sora, system-ui, sans-serif`;
    ctx.fillText('Which one does this cat fill?', W/2, H*0.315);
  } else {
    const st=cat.stage, s=slots[picked];
    let seg, x0, inVessel;
    if(anim<T_LIFT){
      const kk=anim/T_LIFT, e=1-Math.pow(1-kk,3);
      x0=cat.homeX+(s.x-cat.homeX)*e;
      seg=freeSeg(cat.nat, st.startY-16*S*Math.sin(kk*Math.PI));
      inVessel=false;
    } else {
      const k=clamp((anim-T_LIFT)/(T_OOZE-T_LIFT),0,1);
      seg=loweredIn(st,k,{grip:FILL_DEPTH,from:'floor',neck:NECK}).pieces[0].seg;
      x0=st.x0; inVessel=true;
    }
    drawBody(ctx,S,inVessel?st:null,seg,x0,cat.B,cat.R,t);
    slots.forEach((sl,i)=>drawVessel(sl,false,false));
    if(sl_hasHole(s)) drawPost(s);
    drawHead(ctx,S,seg,x0,cat.B,cat.R,cat.face);
    if(phase==='pour' && anim>=T_OOZE+0.45){
      /* Score and lives land when the result is revealed, not when the vessel
         is clicked — watching a life vanish before the cat had even gone in
         gave the answer away. */
      phase='result';
      score += result.pts;
      /* Nine is the ceiling, so a Purrfect at full health is its own reward.
         Only claim the bonus on screen when one is actually handed back. */
      result.gained = result.life>0 && lives<MAX_LIVES;
      if (result.gained) lives++;
      else if (result.life<0) lives--;
      renderLives();
      document.getElementById('score').textContent=score;
    }
    if(phase==='result') drawVerdict();
    requestAnimationFrame(frame);
    return;
  }

  slots.forEach((s,i)=>drawVessel(s, phase==='idle'&&i===hoverIdx, false));
  requestAnimationFrame(frame);
}
const sl_hasHole=s=>{ for(let i=0;i<=24;i++) if(s.def.hole(i/24)>0.001) return true; return false; };

function drawVerdict(){
  ctx.save(); ctx.textAlign='center';
  ctx.fillStyle = result.key==='perf'?'#ffd88a':result.life<0?'#ff9d9d':'#7dd8ff';
  ctx.font=`700 ${25*TS}px "Space Grotesk", system-ui, sans-serif`;
  ctx.fillText(result.label, W/2, H*0.11);
  ctx.fillStyle='#a8adcf'; ctx.font=`400 ${13.5*TS}px Sora, system-ui, sans-serif`;
  ctx.fillText(result.phrase, W/2, H*0.163);
  ctx.fillStyle='#eef0fb'; ctx.font=`700 ${17*TS}px "Space Grotesk", system-ui, sans-serif`;
  ctx.fillText((result.pts>0?'+'+result.pts:'no points') + (result.gained?'   +1 life':''), W/2, H*0.222);
  ctx.fillStyle='#6d7299'; ctx.font=`500 ${11.5*TS}px "Space Grotesk", system-ui, sans-serif`;
  ctx.fillText(lives>0?'CLICK ANYWHERE TO CONTINUE':'OUT OF LIVES', W/2, H*0.275);
  ctx.restore();
}
function hit(mx,my){
  for(let i=0;i<slots.length;i++){const s=slots[i];
    if(mx>s.x-s.w/2-12&&mx<s.x+s.w/2+12&&my>s.y-s.hpx-14&&my<s.y+26) return i;}
  return -1;
}
cv.addEventListener('pointermove',e=>{
  const r=cv.getBoundingClientRect();
  hoverIdx = phase==='idle' ? hit(e.clientX-r.left,e.clientY-r.top) : -1;
  cv.style.cursor = hoverIdx>=0?'pointer':'default';
});
cv.addEventListener('pointerleave',()=>{hoverIdx=-1;});
/* Playing means sweeping a pointer across the board; a stray trackpad gesture
   would otherwise scroll the page and take the timer off screen mid-round. */
cv.addEventListener('wheel',e=>{ if(running) e.preventDefault(); },{passive:false});
cv.addEventListener('pointerdown',e=>{
  if(!running) return;
  const r=cv.getBoundingClientRect();
  if(phase==='idle'){
    const i=hit(e.clientX-r.left,e.clientY-r.top);
    if(i<0) return;
    picked=i; phase='pour'; anim=0; hoverIdx=-1;
    cat.stage=stageFor(slots[i]);
    result=judge(slots[i].fill);
    result.phrase=roomPhrase(slots[i].fill);
    result.pts=pointsFor(slots[i].fill);
    cat.face={over:'squish',perf:'bliss',snug:'normal',roomy:'flat',loose:'flat',swim:'alarm'}[result.key];
  } else if(phase==='result'){
    if(lives<=0) return gameOver();
    round++; newRound();
  }
});
function renderLives(){
  const box=document.getElementById('lives'); box.innerHTML='';
  for(let i=0;i<MAX_LIVES;i++){
    const c=document.createElement('canvas'); c.width=36; c.height=36;
    c.className='life'+(i<lives?'':' gone');
    const x=c.getContext('2d'); x.setTransform(2,0,0,2,0,0);
    x.fillStyle=i<lives?'#f4eee4':'#6d7299';
    x.beginPath(); x.arc(9,10,6.4,0,Math.PI*2); x.fill();
    x.beginPath(); x.moveTo(3.6,5.6); x.lineTo(2.6,-0.4); x.lineTo(9,3.4); x.closePath();
    x.moveTo(14.4,5.6); x.lineTo(15.4,-0.4); x.lineTo(9,3.4); x.closePath(); x.fill();
    x.fillStyle='#141830';
    x.beginPath(); x.arc(6.7,9.5,1.4,0,Math.PI*2); x.fill();
    x.beginPath(); x.arc(11.3,9.5,1.4,0,Math.PI*2); x.fill();
    box.appendChild(c);
  }
}
function start(){
  resize(); score=0; round=1; lives=MAX_LIVES; running=true;
  document.getElementById('score').textContent='0';
  document.getElementById('overlay').hidden=true;
  renderLives(); newRound(); cv.focus({preventScroll:true});
}
function gameOver(){
  running=false;
  document.getElementById('ov-title').textContent='All nine used up';
  document.getElementById('ov-body').textContent = score>9000
    ? 'Genuinely good volumetric instincts, for a person and not a cat.'
    : 'Tall and narrow holds far less than it looks. That is the whole game.';
  document.getElementById('final-score').textContent=score;
  document.getElementById('ov-score').hidden=false;
  document.getElementById('start').textContent='Play again';
  document.getElementById('overlay').hidden=false;
  boardUI.finish();
}
document.getElementById('start').addEventListener('click',start);
const boardUI = attachBoardUI(Board, () => score);
resize(); renderLives(); requestAnimationFrame(frame);
