/* ================= Catastrophe =================
   Lives at catastrophe.html. Depends on js/leaderboard.js for the score board.
*/

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);
const TAU=Math.PI*2;
const G=1500, AIR=0.9985, REST=0.34, FLOOR_F=0.80;

/* Domino, the temperament that won: cats wake at the slightest thing and stay
   up a long time, so the room comes apart gradually, one perch at a time. */
/* Domino, opened up. The first pass topped out around 'Respectable' whatever
   you did: the chain stopped before it had crossed the room. The fit is kept
   deliberately SHORT — a long one left cats running in mid air well after the
   point was made — so the damage comes from the chain reaching more cats
   rather than each one thrashing for longer: a low wake threshold and a hard
   shove. Median damage 67%, floor still 8%, and about one run in fourteen
   gets past 90%. Swept, not guessed. */
const P={ launch:[260,449], kick:[156,328], rate:8, spazT:4.1,
          wake:28, catWake:2.4, force:760, dmg:1.0 };

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
const STANCES=['loaf','sit','sprawl','stand'];

const ITEMS={
  vase:{r:14,mass:1.3,hp:2,tough:24,col:'#7dd8ff'}, lamp:{r:17,mass:1.7,hp:2,tough:28,col:'#ffd88a'},
  mug:{r:10,mass:0.7,hp:1,tough:20,col:'#eef0fb'},  plant:{r:17,mass:2.0,hp:2,tough:33,col:'#8fe3b0'},
  books:{r:13,mass:1.8,hp:2,tough:37,col:'#b48bff'},boxes:{r:18,mass:2.4,hp:2,tough:35,col:'#e0ac48'},
  frame:{r:12,mass:0.9,hp:1,tough:18,col:'#d9c49b'},bowl:{r:15,mass:1.5,hp:2,tough:23,col:'#7dd8ff'},
  clock:{r:11,mass:1.1,hp:1,tough:22,col:'#ff8fd0'},bottle:{r:9,mass:0.6,hp:1,tough:17,col:'#8fe3b0'},
  candle:{r:8,mass:0.5,hp:1,tough:17,col:'#ffd88a'},teapot:{r:13,mass:1.4,hp:2,tough:23,col:'#ff9d9d'},
  globe:{r:14,mass:1.6,hp:2,tough:26,col:'#4fb4e0'},trophy:{r:12,mass:1.2,hp:1,tough:21,col:'#e0ac48'},
  jar:{r:12,mass:1.1,hp:1,tough:19,col:'#b48bff'},  radio:{r:15,mass:2.2,hp:2,tough:37,col:'#a8adcf'},
  cup:{r:9,mass:0.6,hp:1,tough:18,col:'#ff8fd0'},   ball:{r:9,mass:0.5,hp:0,tough:1e9,col:'#ff9d9d'},
  /* kitchen */
  plate:{r:12,mass:0.9,hp:1,tough:17,col:'#eef0fb'},pan:{r:15,mass:2.4,hp:2,tough:42,col:'#8b93bb'},
  kettle:{r:14,mass:1.8,hp:2,tough:29,col:'#a8adcf'},
  /* the shop */
  pack:{r:11,mass:0.8,hp:1,tough:19,col:'#7dd8ff'}, binder:{r:16,mass:1.9,hp:2,tough:34,col:'#b48bff'},
  slab:{r:12,mass:1.0,hp:1,tough:22,col:'#ffd88a'},
  /* the greenhouse */
  pot:{r:15,mass:1.8,hp:2,tough:25,col:'#c98f6a'},  fern:{r:18,mass:1.6,hp:2,tough:24,col:'#8fe3b0'},
  glassjar:{r:13,mass:1.0,hp:1,tough:16,col:'#8fe3b0'},
  /* downtown */
  car:{r:16,mass:3.2,hp:2,tough:32,col:'#ff9d9d'},  bus:{r:22,mass:5.0,hp:2,tough:43,col:'#ffd88a'},
  tank:{r:15,mass:2.6,hp:2,tough:30,col:'#8b93bb'}, sign:{r:13,mass:1.2,hp:1,tough:20,col:'#7dd8ff'},
  tree:{r:15,mass:1.7,hp:2,tough:27,col:'#8fe3b0'},
  pole:{r:11,mass:1.4,hp:1,tough:22,col:'#a8adcf'},
  hydrant:{r:9,mass:1.2,hp:1,tough:19,col:'#ff9d9d'},
  bin:{r:11,mass:1.0,hp:1,tough:20,col:'#8fe3b0'},
  chandelier:{r:26,mass:4.0,hp:3,tough:32,col:'#ffd88a'}
};

/* ================= the five levels ================= */
const LEVELS=[
  { name:'The Living Room', blurb:'Bookcase, desk, table, bed. Somebody has to start it.',
    mult:1.0, cats:8, floorItems:14, catR:17,
    pool:['vase','lamp','mug','plant','books','boxes','frame','bowl','clock','bottle','candle','teapot','globe','trophy','jar','radio','cup'],
    chandelier:true,
    furn:[{k:'bookcase',x:0.015,y:0.30,w:0.145,h:0.60,shelves:[0.02,0.28,0.54,0.80]},
          {k:'shelf',x:0.215,y:0.30,w:0.165,h:0.018},
          {k:'desk',x:0.195,y:0.640,w:0.185,h:0.26},
          {k:'chair',x:0.405,y:0.700,w:0.085,h:0.20},
          {k:'shelf',x:0.430,y:0.415,w:0.180,h:0.018},
          {k:'table',x:0.520,y:0.605,w:0.180,h:0.295},
          {k:'shelf',x:0.735,y:0.330,w:0.185,h:0.018},
          {k:'bed',x:0.720,y:0.690,w:0.265,h:0.21}] },

  { name:'The Kitchen', blurb:'Every surface is a hard surface and every plate is a plate.',
    mult:1.4, cats:8, floorItems:13, catR:17,
    pool:['plate','pan','kettle','mug','cup','bottle','jar','bowl','teapot','candle','vase','clock'],
    chandelier:false,
    furn:[{k:'cabinet',x:0.03,y:0.24,w:0.24,h:0.16},
          {k:'cabinet',x:0.60,y:0.24,w:0.26,h:0.16},
          {k:'counter',x:0.02,y:0.615,w:0.30,h:0.285},
          {k:'stove',x:0.345,y:0.615,w:0.145,h:0.285},
          {k:'counter',x:0.515,y:0.615,w:0.24,h:0.285},
          {k:'fridge',x:0.785,y:0.400,w:0.185,h:0.50},
          {k:'island',x:0.30,y:0.760,w:0.34,h:0.14}] },

  { name:"Booth 151", blurb:'A card booth. Mind the display case.',
    mult:1.9, cats:8, floorItems:13, catR:17,
    pool:['pack','binder','slab','boxes','books','frame','trophy','mug','clock','jar'],
    chandelier:false,
    furn:[{k:'rack',x:0.02,y:0.26,w:0.20,h:0.62,shelves:[0.02,0.26,0.50,0.74]},
          {k:'shelf',x:0.255,y:0.300,w:0.185,h:0.018},
          {k:'shelf',x:0.255,y:0.470,w:0.185,h:0.018},
          {k:'case',x:0.245,y:0.640,w:0.22,h:0.26},
          {k:'case',x:0.500,y:0.640,w:0.22,h:0.26},
          {k:'shelf',x:0.500,y:0.330,w:0.190,h:0.018},
          {k:'rack',x:0.760,y:0.300,w:0.215,h:0.58,shelves:[0.02,0.30,0.58,0.86]}] },

  { name:'The Greenhouse', blurb:'Terracotta, glass and a great deal of gravity.',
    mult:2.5, cats:9, floorItems:14, catR:17,
    pool:['pot','fern','glassjar','plant','bottle','bowl','vase','jar','candle','trophy'],
    chandelier:false,
    furn:[{k:'bench',x:0.02,y:0.640,w:0.28,h:0.26},
          {k:'tier',x:0.34,y:0.360,w:0.26,h:0.54,shelves:[0.02,0.34,0.66]},
          {k:'bench',x:0.645,y:0.640,w:0.235,h:0.26},
          {k:'shelf',x:0.03,y:0.360,w:0.24,h:0.018},
          {k:'shelf',x:0.645,y:0.300,w:0.245,h:0.018},
          {k:'shelf',x:0.645,y:0.470,w:0.245,h:0.018},
          {k:'bench',x:0.895,y:0.760,w:0.09,h:0.14}] },

  { name:'Downtown', blurb:'The cats are the size of buildings. One of them is worse.',
    mult:4.0, cats:7, floorItems:16, catR:30, city:true,
    pool:['car','bus','tank','sign','tree','pole','hydrant','bin'],
    chandelier:false,
    /* Buildings are not scenery here. Each one has health, takes visible
       damage, and comes down when it runs out. */
    /* A skyline with a proper silhouette: two low blocks, three middling and
       two towers. Rooftops land at very different heights, so cats sitting on
       them are not all in a row along the top of the picture. */
    /* Six blocks with real streets between them. The first pass had seven
       towers tiling the entire width, so a cat placed at street level was
       standing inside a building and the solid pushed it up onto a roof —
       every cat ended up along the top of the picture. */
    furn:[{k:'tower',x:0.015,y:0.62,w:0.105,h:0.28,hp:2},
          {k:'tower',x:0.192,y:0.17,w:0.105,h:0.73,hp:4},
          {k:'tower',x:0.369,y:0.44,w:0.105,h:0.46,hp:3},
          {k:'tower',x:0.546,y:0.28,w:0.105,h:0.62,hp:4},
          {k:'tower',x:0.723,y:0.58,w:0.105,h:0.32,hp:2},
          {k:'tower',x:0.900,y:0.34,w:0.095,h:0.56,hp:3}] }
];


/* ================= the world ================= */
const cv=document.getElementById('stage'), ctx=cv.getContext('2d');
const w={ W:0,H:0,S:1, floorY:0, ceilY:0, L:LEVELS[0], lvl:0,
  bodies:[], shards:[], puffs:[], perches:[], furn:[], chand:null, nuke:null,
  started:false, over:false, settling:false, elapsed:0, quiet:0, shake:0 };

function layout(){
  w.floorY=w.H*0.90; w.ceilY=w.H*0.03;
  const keep=w.furn&&w.furn.length===w.L.furn.length;
  w.furn=w.L.furn.map((f,i)=>({...f,X:f.x*w.W,Y:f.y*w.H,Wd:f.w*w.W,Ht:f.h*w.H,
    hp:keep?w.furn[i].hp:Math.round((f.hp||1)*TW_HP), maxHp:Math.round((f.hp||1)*TW_HP), gone:keep?w.furn[i].gone:false,
    collapsing:keep?w.furn[i].collapsing:false, fall:keep?w.furn[i].fall:0,
    tilt:keep?w.furn[i].tilt:0}));
  surfaces();
}
/* Recomputes what is standing without rebuilding the furniture itself.
   collapse() used to call layout(), which replaced w.furn mid-loop — so the
   blast marked the first tower and then wrote the rest onto objects that had
   already been thrown away, and four of seven survived a nuclear weapon. */
function surfaces(){
  w.perches=[]; w.solids=[];
  for(const f of w.furn){
    if(f.gone||f.collapsing) continue;
    const top=t=>w.perches.push({x:f.X,y:f.Y+t,w:f.Wd,h:Math.max(4,w.H*0.016)});
    if(f.shelves) f.shelves.forEach(s=>top(f.Ht*s));
    else if(f.k==='bed') top(w.H*0.020);
    else top(0);
    /* A tower is solid all the way down, so a cat hits the side of it rather
       than sailing through and landing neatly on the roof. */
    if(f.k==='tower') w.solids.push({f,x:f.X,y:f.Y,w:f.Wd,h:f.Ht});
  }
}
function resize(){
  const dpr=Math.min(devicePixelRatio||1,2), r=cv.getBoundingClientRect();
  w.W=r.width; w.H=r.height;
  cv.width=Math.round(w.W*dpr); cv.height=Math.round(w.H*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  w.S=Math.min(w.W/620,w.H/413);
  layout();
  for(const b of w.bodies){ b.x=b.fx*w.W; b.y=b.fy*w.H; b.r=b.fr*w.S; }
}
addEventListener('resize',resize);

function add(kind,type,fx,fy,extra={}){
  const spec = kind==='cat' ? {r:(extra.big?w.L.catR*1.35:w.L.catR),mass:extra.big?5.2:2.8,hp:0,tough:1e9} : ITEMS[type];
  const b={kind,type,fx,fy,fr:spec.r,r:spec.r*w.S,x:fx*w.W,y:fy*w.H,
    vx:0,vy:0,rot:0,vr:0,mass:spec.mass,hp:spec.hp,maxHp:spec.hp,tough:spec.tough,
    broken:false,...extra};
  w.bodies.push(b); return b;
}
function buildLevel(i,seed){
  w.lvl=i; w.L=LEVELS[i]; w.nuke=null; w.nuked=false; w.furn=[];
  w.bodies=[]; w.shards=[]; w.puffs=[];
  let s=(seed+i*7919)*9301+49297;
  const R=()=>{ s=(s*9301+49297)%233280; return s/233280; };
  resize();
  const pool=w.L.pool;
  w.perches.forEach(p=>{
    const n=3+Math.floor(R()*3.4);
    for(let k=0;k<n;k++){
      const key=pool[Math.floor(R()*pool.length)];
      const fx=(p.x+p.w*(0.12+0.76*((k+0.5)/n))+(R()-0.5)*p.w*0.10)/w.W;
      add('item',key,fx,(p.y-ITEMS[key].r*w.S-1)/w.H);
    }
  });
  for(let k=0;k<w.L.floorItems;k++){
    const key=pool[Math.floor(R()*pool.length)];
    add('item',key,0.05+0.90*((k+0.5)/w.L.floorItems)+(R()-0.5)*0.04,
        (w.floorY-ITEMS[key].r*w.S-1)/w.H);
  }
  /* Lamp posts along the pavement, with the wires strung between them. Both
     are breakable, and a wire goes as soon as either end does. */
  if(w.L.city){
    w.poles=[];
    for(const gx of [0.156,0.333,0.510,0.687,0.864]){
      const p=add('item','pole',gx,(w.floorY-ITEMS.pole.r*w.S*2.6)/w.H,{tall:true});
      w.poles.push(p);
    }
  } else w.poles=[];
  if(w.L.chandelier)
    w.chand=add('item','chandelier',0.505,(w.ceilY+w.H*0.215)/w.H,
      {hang:{x:0.505*w.W,y:w.ceilY,len:w.H*0.215},lit:true});
  else w.chand=null;
  /* cats spread over the surfaces, then the floor if there are more cats
     than places to put them */
  const spots=[];
  w.perches.forEach((p,pi)=>{ if(pi%1===0) spots.push({p}); });
  /* On the city they are placed by hand — some on roofs, some in the street,
     spread right across it — so they are not all queued up on the left in the
     same pose the way an even spread over the perch list put them. */
  /* Three on roofs of noticeably different heights, four down in the street,
     spread across the width. */
  const CITY_SPOTS=[{roof:1},{street:0.156},{roof:0},{street:0.510},
                    {roof:3},{street:0.687},{street:0.864}];
  for(let k=0;k<w.L.cats;k++){
    let fx,fy;
    if(w.L.city){
      const cs=CITY_SPOTS[k%CITY_SPOTS.length];
      if(cs.roof!==undefined && w.perches[cs.roof]){
        const p=w.perches[cs.roof];
        fx=(p.x+p.w*(0.20+0.55*R()))/w.W; fy=(p.y-w.L.catR*w.S-1)/w.H;
      } else { fx=(cs.street??0.5)+(R()-0.5)*0.05; fy=(w.floorY-w.L.catR*w.S-1)/w.H; }
    } else {
      const st = k<spots.length ? spots[(k*3+1)%spots.length] : null;
      if(st){ const p=st.p; fx=(p.x+p.w*(0.14+0.24*R()))/w.W; fy=(p.y-w.L.catR*w.S-1)/w.H; }
      else { fx=0.12+0.76*R(); fy=(w.floorY-w.L.catR*w.S-1)/w.H; }
    }
    const B=BREEDS[k%BREEDS.length];
    /* the last level hides one cat that should not be poked, or should be,
       depending on how you feel about the neighbourhood */
    const special = w.L.city && k===w.L.cats-1;
    add('cat',B.key,fx,fy,{B,state:'calm',stance:STANCES[Math.floor(R()*STANCES.length)],
      spazT:0,woken:false,legs:[0,0,0,0],legV:[0,0,0,0],tail:[0,0,0,0,0],puff:0,seed:R()*9,
      special, big:special});
  }
  w.settling=true;
  for(let k=0;k<220;k++) step(1/60,true);
  w.settling=false;
  for(const b of w.bodies){
    b.vx=b.vy=b.vr=0; b.rot=b.kind==='cat'?0:b.rot*0.2;
    b.hp=b.maxHp; b.broken=false;
    b.fx=b.x/w.W; b.fy=b.y/w.H; b.home={x:b.x,y:b.y};
    if(b.kind==='cat'){ b.state='calm'; b.woken=false; b.puff=0; }
  }
  if(w.chand){ w.chand.x=w.chand.hang.x; w.chand.y=w.chand.hang.y+w.chand.hang.len;
    w.chand.fx=w.chand.x/w.W; w.chand.fy=w.chand.y/w.H;
    w.chand.home={x:w.chand.x,y:w.chand.y}; w.chand.lit=true; }
  w.shards=[]; w.puffs=[]; w.started=false; w.over=false; w.elapsed=0; w.quiet=0; w.shake=0;
}
function spazz(c,byHand){
  c.state='spaz'; c.spazT=P.spazT*rand(0.85,1.18)*(c.special?1.0:1); c.woken=true;
  const a=rand(0,TAU), sp=rand(P.launch[0],P.launch[1])*(c.special?1.5:1);
  c.vx+=Math.cos(a)*sp; c.vy+=Math.sin(a)*sp*0.9-sp*0.35;
  c.vr+=rand(-13,13);
  w.shake=Math.min(14,w.shake+2.6);
  /* Only a deliberate poke lights the fuse. If the chain merely wakes it, it
     panics like any other cat — otherwise level five ends the same way every
     time and picking it is not a decision. */
  if(c.special && byHand && c.fuse===undefined) c.fuse=2.6;
}
function hit(b,impact,at,from){
  if(w.settling) return;
  if(b.kind==='cat'){
    const need=(from&&from.kind==='cat')?P.wake*P.catWake:P.wake;
    if(b.state==='calm'&&impact>need) spazz(b);
    return;
  }
  if(b.hp<=0||b.broken||impact<b.tough) return;
  b.hp -= 1+(impact>b.tough*2?1:0);
  if(b.hp<=0) shatter(b,at);
}
function shatter(b,at){
  b.broken=true;
  w.shake=Math.min(18,w.shake+5.5);
  const col=ITEMS[b.type].col, px=at?at.x:b.x, py=at?at.y:b.y;
  const big=b.type==='chandelier'?3:1;
  for(let i=0;i<22*big;i++){ const a=rand(0,TAU), sp=rand(70,470);
    w.shards.push({x:px,y:py,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-rand(40,220),
      r:rand(1.3,3.2)*w.S*big,life:rand(0.7,2.0),age:0,col,rot:rand(0,TAU),vr:rand(-16,16),shape:0}); }
  for(let i=0;i<6*big;i++){ const a=rand(0,TAU), sp=rand(60,300);
    w.shards.push({x:px,y:py,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-rand(60,240),
      r:rand(3.6,7.5)*w.S*big,life:rand(1.0,2.4),age:0,col,rot:rand(0,TAU),vr:rand(-11,11),shape:1}); }
  for(let i=0;i<5*big;i++)
    w.puffs.push({x:px+rand(-8,8)*w.S,y:py+rand(-8,8)*w.S,r:rand(5,13)*w.S*big,
      grow:rand(26,70)*w.S,life:rand(0.4,0.85),age:0});
  if(b.type==='chandelier'){ b.lit=false; b.hang=null; }
}
/* ================= knocking a building down =================
   A cat hitting a tower hard enough takes a storey off it: windows go out,
   the concrete cracks, and rubble comes off the impact. Enough of that and
   the whole thing goes, taking whatever was standing on it with it. */
/* Found by sweeping, not by eye. A poor choice of cat leaves the skyline
   standing; a good one takes down five of the seven; only the special cat
   flattens all of it. Loose values here and every cat levels the city, which
   is spectacular exactly once and then it is not a game. */
const TW_MIN=420, TW_HP=3.0, TW_SPAZ=120;
function hitTower(f,impact,at){
  if(w.settling||f.gone||f.collapsing) return;
  if(impact<TW_MIN) return;
  f.hp -= impact>TW_MIN*2.7?2:1;
  w.shake=Math.min(22,w.shake+4);
  const px=at?at.x:f.X+f.Wd/2, py=at?at.y:f.Y;
  for(let i=0;i<16;i++){ const a=rand(0,TAU), sp=rand(80,420);
    w.shards.push({x:px,y:py,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-rand(60,240),
      r:rand(1.8,5.0)*w.S,life:rand(0.6,1.6),age:0,col:'#3b4470',rot:rand(0,TAU),vr:rand(-14,14),shape:1}); }
  for(let i=0;i<4;i++)
    w.puffs.push({x:px+rand(-14,14)*w.S,y:py+rand(-14,14)*w.S,r:rand(8,18)*w.S,
      grow:rand(40,100)*w.S,life:rand(0.5,1.0),age:0});
  if(f.hp<=0) collapse(f);
}
function collapse(f){
  f.collapsing=true; f.fall=0; f.tilt=rand(-0.45,0.45);
  w.shake=Math.min(30,w.shake+14);
  const cx=f.X+f.Wd/2;
  /* the whole storey's worth of concrete, all at once */
  for(let i=0;i<70;i++){ const a=rand(0,TAU), sp=rand(60,520);
    w.shards.push({x:cx+rand(-f.Wd/2,f.Wd/2),y:f.Y+rand(0,f.Ht),
      vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-rand(80,340),
      r:rand(2.2,8.0)*w.S,life:rand(1.2,3.0),age:0,
      col:i%3?'#3b4470':'#2a3057',rot:rand(0,TAU),vr:rand(-13,13),shape:i%2}); }
  for(let i=0;i<22;i++)
    w.puffs.push({x:cx+rand(-f.Wd*0.8,f.Wd*0.8),y:f.Y+rand(0,f.Ht),
      r:rand(12,30)*w.S,grow:rand(70,190)*w.S,life:rand(0.9,2.0),age:0});
  /* anything standing on it loses its footing, and the neighbours feel it */
  for(const b of w.bodies){
    if(b.x>f.X-b.r&&b.x<f.X+f.Wd+b.r&&b.y<f.Y+f.Ht&&b.y>f.Y-b.r*3){
      b.vx+=rand(-160,160)+f.tilt*420; b.vy-=rand(40,220);
      if(b.kind==='cat'&&b.state==='calm') spazz(b);
      else if(b.kind==='item') hit(b,900,{x:b.x,y:b.y});
    }
  }
  surfaces();
}

/* ================= total annihilation =================
   The special cat rattles about like any other for a couple of seconds, and
   then removes the argument entirely. */
function detonate(c){
  w.nuke={x:c.x,y:c.y,age:0,life:3.4}; w.nuked=true;
  w.shake=26;
  for(const b of w.bodies){
    if(b.kind==='cat'){ if(b.state==='calm') spazz(b); b.woken=true;
      const a=Math.atan2(b.y-c.y,b.x-c.x);
      b.vx+=Math.cos(a)*rand(300,760); b.vy+=Math.sin(a)*rand(300,760)-260; b.vr+=rand(-24,24); }
    else if(!b.broken&&b.maxHp>0){
      const a=Math.atan2(b.y-c.y,b.x-c.x);
      b.vx+=Math.cos(a)*rand(260,720); b.vy+=Math.sin(a)*rand(260,720)-220;
      shatter(b,{x:b.x,y:b.y});
    }
  }
  for(const f of w.furn) if(f.k==='tower'&&!f.gone&&!f.collapsing) collapse(f);
  c.state='gone';
}



/* ================= physics ================= */
function step(dt,settling){
  const calm=(!settling&&w.elapsed>7)?Math.pow(0.5,w.elapsed-7):1;
  for(const b of w.bodies){
    if(b.kind==='cat'){
      if(b.state==='spaz'){
        b.spazT-=dt; b.puff=Math.min(1,b.puff+dt*7);
        if(!settling && Math.random()<dt*P.rate){
          const a=rand(0,TAU);
          b.vx+=Math.cos(a)*rand(P.kick[0],P.kick[1]);
          b.vy-=rand(P.kick[0]*0.4,P.kick[1]*0.85);
          b.vr+=rand(-10,10);
        }
        if(b.spazT<=0) b.state='dazed';
        if(b.fuse!==undefined && b.state!=='gone'){
          b.fuse-=dt; b.spazT=Math.max(b.spazT,0.2);
          if(b.fuse<=0) detonate(b);
        }
      } else {
        b.puff=Math.max(0,b.puff-dt*2.4);
        if(b.state==='dazed'&&Math.hypot(b.vx,b.vy)<40) b.state='flat';
      }
      /* The legs wind down over the back half of the fit rather than cycling
         at full tilt right up to the last frame, which is what made a cat look
         like it was still running in mid air long after the point. */
      const wind = b.state==='spaz' ? clamp(b.spazT/(P.spazT*0.55),0,1) : 1;
      const drive=b.state==='spaz'?wind:b.state==='dazed'?0.28:0;
      for(let i=0;i<4;i++){
        const target=drive?Math.sin(w.elapsed*23+i*1.9+b.seed)*1.5*drive:restLeg(b,i);
        b.legV[i]+=(target-b.legs[i])*dt*(drive?46:9);
        b.legV[i]*=0.86; b.legs[i]+=b.legV[i];
      }
      for(let i=0;i<5;i++)
        b.tail[i]=Math.sin(w.elapsed*(drive?17:2.1)-i*0.85+b.seed)*(drive?0.9*drive:0.16);
    }
    /* the chandelier swings on its chain until the chain is no longer there */
    if(b.hang){
      const dx=b.x-b.hang.x, dy=b.y-b.hang.y, d=Math.hypot(dx,dy)||1;
      const nx=dx/d, ny=dy/d;
      b.vy+=G*dt;
      b.x=b.hang.x+nx*b.hang.len; b.y=b.hang.y+ny*b.hang.len;
      const vn=b.vx*nx+b.vy*ny;
      b.vx-=vn*nx; b.vy-=vn*ny;
      b.vx*=0.995; b.vy*=0.995;
      b.x+=b.vx*dt; b.y+=b.vy*dt; b.rot+=b.vr*dt; b.vr*=0.97;
      continue;
    }
    b.vy+=G*dt;
    b.x+=b.vx*dt; b.y+=b.vy*dt; b.rot+=b.vr*dt;
    b.vx*=AIR*calm; b.vy*=AIR; b.vr*=0.985*calm;
    const sp=Math.hypot(b.vx,b.vy);
    if(sp<24*w.S){ const k=Math.pow(0.02,dt); b.vx*=k; b.vy*=k; b.vr*=k; }
    if(calm<1){ const k=Math.pow(calm,dt*2.2); b.vx*=k; b.vy*=k; b.vr*=k; }
    if(sp<3.5*w.S&&Math.abs(b.vr)<0.25){ b.vx=0; b.vy=0; b.vr=0; }
    if(b.y+b.r>w.floorY){ b.y=w.floorY-b.r; b.sup=true;
      if(b.vy>40){ hit(b,Math.abs(b.vy)*b.mass*0.5,{x:b.x,y:b.y+b.r}); b.vy*=-REST; } else b.vy=0;
      b.vx*=FLOOR_F; b.vr*=0.9; }
    if(b.x<b.r){ b.x=b.r; b.vx=Math.abs(b.vx)*REST; }
    if(b.x>w.W-b.r){ b.x=w.W-b.r; b.vx=-Math.abs(b.vx)*REST; }
    if(b.y<b.r+w.ceilY){ b.y=b.r+w.ceilY; b.vy=Math.abs(b.vy)*REST; }
    for(const sq of (w.solids||[])){
      const cx=clamp(b.x,sq.x,sq.x+sq.w), cy=clamp(b.y,sq.y,sq.y+sq.h);
      let dx=b.x-cx, dy=b.y-cy, d=Math.hypot(dx,dy);
      if(d>=b.r) continue;
      if(d===0){ dy=-1; d=1; }
      const nx=dx/d, ny=dy/d;
      b.x+=nx*(b.r-d); b.y+=ny*(b.r-d);
      const vn=b.vx*nx+b.vy*ny;
      if(vn<0){
        const force=Math.abs(vn)*b.mass*0.5+(b.kind==='cat'&&b.state==='spaz'?TW_SPAZ:0);
        if(ny<-0.5) b.sup=true;
        hitTower(sq.f,force,{x:cx,y:cy});
        if(b.kind!=='cat') hit(b,Math.abs(vn)*b.mass*0.45,{x:cx,y:cy});
        b.vx-=(1+REST)*vn*nx; b.vy-=(1+REST)*vn*ny;
        if(Math.abs(ny)>0.6){ b.vx*=FLOOR_F; b.vr*=0.9; }
      }
    }
    for(const p of w.perches){
      const cx=clamp(b.x,p.x,p.x+p.w), cy=clamp(b.y,p.y,p.y+p.h);
      let dx=b.x-cx, dy=b.y-cy, d=Math.hypot(dx,dy);
      if(d>=b.r) continue;
      if(d===0){ dy=-1; d=1; }
      const nx=dx/d, ny=dy/d;
      b.x+=nx*(b.r-d); b.y+=ny*(b.r-d);
      const vn=b.vx*nx+b.vy*ny;
      if(vn<0){
        if(ny<-0.5) b.sup=true;
        if(Math.abs(vn)>60) hit(b,Math.abs(vn)*b.mass*0.45,{x:cx,y:cy});
        b.vx-=(1+REST)*vn*nx; b.vy-=(1+REST)*vn*ny;
        if(Math.abs(ny)>0.6){ b.vx*=FLOOR_F; b.vr*=0.9; }
      }
    }
  }
  for(let i=0;i<w.bodies.length;i++) for(let j=i+1;j<w.bodies.length;j++){
    const a=w.bodies[i], b=w.bodies[j];
    const dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy), min=a.r+b.r;
    if(d>=min||d===0) continue;
    const nx=dx/d, ny=dy/d, ov=min-d;
    const ma=a.hang?1e6:a.mass, mb=b.hang?1e6:b.mass, tot=ma+mb;
    if(!a.hang){ a.x-=nx*ov*(mb/tot); a.y-=ny*ov*(mb/tot); }
    if(!b.hang){ b.x+=nx*ov*(ma/tot); b.y+=ny*ov*(ma/tot); }
    const sep=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
    if(sep>0) continue;
    const imp=-(1+REST)*sep/(1/ma+1/mb);
    a.vx-=imp*nx/ma; a.vy-=imp*ny/ma; b.vx+=imp*nx/mb; b.vy+=imp*ny/mb;
    if(ny>0.5) a.sup=true;          // a is resting on b
    if(ny<-0.5) b.sup=true;         // b is resting on a
    if(!settling){ a.vr+=rand(-1,1)*Math.abs(sep)*0.02; b.vr+=rand(-1,1)*Math.abs(sep)*0.02; }
    const spazzing=(a.kind==='cat'&&a.state==='spaz')||(b.kind==='cat'&&b.state==='spaz');
    const force=Math.abs(sep)*Math.min(a.mass,b.mass)*0.9+(spazzing?P.force:0);
    const at={x:a.x+nx*a.r,y:a.y+ny*a.r};
    hit(a,force,at,b); hit(b,force,at,a);
  }
  for(const s of w.shards){ s.age+=dt; s.vy+=G*0.7*dt; s.x+=s.vx*dt; s.y+=s.vy*dt; s.rot+=s.vr*dt;
    if(s.y>w.floorY){ s.y=w.floorY; s.vy*=-0.28; s.vx*=0.72; } }
  w.shards=w.shards.filter(s=>s.age<s.life);
  /* Anything holding still on top of something else has gravity taken off it.
     Without this a body resting on a PILE — not the floor — kept accruing
     25 units of downward velocity every frame and shuffling for ever: the
     city was taking twenty-three seconds to settle and eighteen of those
     were a heap of rubble quietly vibrating. */
  for(const b of w.bodies){
    if(b.sup && Math.hypot(b.vx,b.vy)<62*w.S){ b.vy=0; b.vx*=0.55; b.vr*=0.7; }
  }
  for(const f of w.furn) if(f.collapsing&&!f.gone){
    f.fall+=dt/0.9; if(f.fall>=1){ f.fall=1; f.gone=true; }
  }
  for(const p of w.puffs) p.age+=dt;
  w.puffs=w.puffs.filter(p=>p.age<p.life);
  w.shake*=Math.pow(0.06,dt);
}
function restLeg(b,i){
  switch(b.stance){
    case 'stand':  return i<2?0.06:-0.06;
    case 'sit':    return i<2?0.55:-0.10;
    case 'sprawl': return i<2?1.25:-1.15;
    default:       return i<2?0.30:-0.25;   // loaf: tucked under
  }
}
function topSpeed(){ let m=0; for(const b of w.bodies) m=Math.max(m,Math.hypot(b.vx,b.vy)); return m; }
function anySpaz(){ return w.bodies.some(b=>b.kind==='cat'&&b.state==='spaz'); }
function parts(){
  const towers=w.furn.filter(f=>f.k==='tower');
  const down=towers.filter(f=>f.collapsing||f.gone).length;
  const items=w.bodies.filter(b=>b.kind==='item');
  const br=items.filter(b=>b.maxHp>0);
  const cats=w.bodies.filter(b=>b.kind==='cat');
  return {towers:towers.length,down,broken:br.filter(b=>b.broken).length,breakable:br.length,
    moved:items.filter(b=>b.home&&Math.hypot(b.x-b.home.x,b.y-b.home.y)>60*w.S).length,
    items:items.length,woken:cats.filter(c=>c.woken).length,cats:cats.length};
}
function chaosOf(){
  /* Nothing survives a mushroom cloud, so the arithmetic does not get a vote. */
  if(w.nuked) return 100;
  const p=parts();
  /* Where there are buildings, knocking them down is most of the point. */
  /* The 1.1 lets a genuinely exceptional run reach 100 without every single
     ornament having to break — a few always end up somewhere nothing reaches.
     A poor run is barely moved by it. */
  const raw = p.towers
    ? 0.46*p.down/p.towers + 0.34*p.broken/Math.max(1,p.breakable) + 0.20*p.woken/Math.max(1,p.cats)
    : 0.66*p.broken/Math.max(1,p.breakable) + 0.21*p.woken/Math.max(1,p.cats)
      + 0.13*p.moved/Math.max(1,p.items);
  return Math.min(100, Math.round(raw*110)); }

function drawItem(b){
  if(b.type==='chandelier'){ drawChandelier(b); return; }
  const S=w.S, c=ITEMS[b.type].col, r=b.r;
  ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(b.rot);
  ctx.globalAlpha=b.broken?0.4:1;
  ctx.fillStyle=c; ctx.strokeStyle='rgba(10,13,24,.35)'; ctx.lineWidth=1.6*S;
  const box=(ww,hh,rr=3)=>{ctx.beginPath();ctx.roundRect(-ww/2,-hh/2,ww,hh,rr*S);ctx.fill();ctx.stroke();};
  switch(b.type){
    case 'sofa': ctx.fillStyle='#4a5180'; box(r*2.0,r*1.0,7);
      ctx.fillStyle='#5b64a0'; ctx.beginPath(); ctx.roundRect(-r*0.95,-r*0.72,r*1.9,r*0.45,5*S); ctx.fill(); break;
    case 'tv': ctx.fillStyle='#2b3157'; box(r*1.9,r*1.15,3);
      ctx.fillStyle=b.broken?'#3a4170':'#7dd8ff'; ctx.globalAlpha*=0.55;
      ctx.fillRect(-r*0.76,-r*0.44,r*1.52,r*0.86); break;
    case 'stool': box(r*1.5,r*0.24,3); ctx.fillRect(-r*0.6,0,r*0.14,r*0.85); ctx.fillRect(r*0.46,0,r*0.14,r*0.85); break;
    case 'vase': ctx.beginPath(); ctx.moveTo(-r*0.32,-r*0.9); ctx.lineTo(r*0.32,-r*0.9);
      ctx.quadraticCurveTo(r*0.85,0,r*0.28,r*0.9); ctx.lineTo(-r*0.28,r*0.9);
      ctx.quadraticCurveTo(-r*0.85,0,-r*0.32,-r*0.9); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case 'lamp': ctx.beginPath(); ctx.moveTo(-r*0.7,-r*0.1); ctx.lineTo(-r*0.34,-r*0.85);
      ctx.lineTo(r*0.34,-r*0.85); ctx.lineTo(r*0.7,-r*0.1); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#3a4170'; ctx.fillRect(-r*0.07,-r*0.1,r*0.14,r*0.95); break;
    case 'mug': box(r*1.1,r*1.2,3); ctx.strokeStyle=c; ctx.lineWidth=2.6*S;
      ctx.beginPath(); ctx.arc(r*0.64,0,r*0.34,-1.2,1.2); ctx.stroke(); break;
    case 'plant': ctx.fillStyle='#b9834a'; box(r*0.9,r*0.7,2); ctx.fillStyle=c;
      for(const a of [-1.1,-0.5,0,0.5,1.1]){ ctx.beginPath();
        ctx.ellipse(Math.sin(a)*r*0.45,-r*0.55-Math.cos(a)*r*0.22,r*0.18,r*0.5,a,0,TAU); ctx.fill(); } break;
    case 'books': for(let i=0;i<3;i++){ ctx.fillStyle=['#b48bff','#7dd8ff','#ff8fd0'][i];
      ctx.beginPath(); ctx.roundRect(-r*0.8+i*r*0.55,-r*0.5,r*0.46,r*1.0,2*S); ctx.fill(); ctx.stroke(); } break;
    case 'boxes': for(let i=0;i<2;i++){ ctx.fillStyle=i?'#e0ac48':'#c9932f';
      ctx.beginPath(); ctx.roundRect(-r*0.7,-r*0.9+i*r*0.85,r*1.4,r*0.78,2*S); ctx.fill(); ctx.stroke(); } break;
    case 'frame': box(r*1.2,r*1.5,2); ctx.fillStyle='#2b3157'; ctx.fillRect(-r*0.42,-r*0.58,r*0.84,r*1.16); break;
    case 'bowl': ctx.beginPath(); ctx.arc(0,0,r*0.8,0.15*Math.PI,0.85*Math.PI,true); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case 'clock': ctx.beginPath(); ctx.arc(0,0,r*0.85,0,TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle='#141830'; ctx.lineWidth=2*S; ctx.beginPath();
      ctx.moveTo(0,0); ctx.lineTo(0,-r*0.5); ctx.moveTo(0,0); ctx.lineTo(r*0.34,r*0.2); ctx.stroke(); break;
    case 'bottle': ctx.beginPath(); ctx.roundRect(-r*0.34,-r*0.3,r*0.68,r*1.2,2*S); ctx.fill(); ctx.stroke();
      ctx.fillRect(-r*0.15,-r*0.9,r*0.3,r*0.6); break;
    case 'candle': ctx.beginPath(); ctx.roundRect(-r*0.26,-r*0.5,r*0.52,r*1.3,2*S); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#ff9d9d'; ctx.beginPath(); ctx.ellipse(0,-r*0.68,r*0.16,r*0.3,0,0,TAU); ctx.fill(); break;
    case 'teapot': ctx.beginPath(); ctx.ellipse(0,0,r*0.8,r*0.62,0,0,TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r*0.7,-r*0.1); ctx.quadraticCurveTo(-r*1.15,-r*0.3,-r*1.0,r*0.2);
      ctx.strokeStyle=c; ctx.lineWidth=3*S; ctx.stroke();
      ctx.fillStyle=c; ctx.fillRect(-r*0.16,-r*0.85,r*0.32,r*0.3); break;
    case 'globe': ctx.beginPath(); ctx.arc(0,-r*0.1,r*0.72,0,TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle='rgba(10,13,24,.35)'; ctx.beginPath(); ctx.ellipse(0,-r*0.1,r*0.32,r*0.72,0,0,TAU); ctx.stroke();
      ctx.fillStyle='#b9834a'; ctx.fillRect(-r*0.3,r*0.6,r*0.6,r*0.2); break;
    case 'trophy': ctx.beginPath(); ctx.moveTo(-r*0.5,-r*0.7); ctx.lineTo(r*0.5,-r*0.7);
      ctx.quadraticCurveTo(r*0.3,r*0.2,0,r*0.3); ctx.quadraticCurveTo(-r*0.3,r*0.2,-r*0.5,-r*0.7);
      ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillRect(-r*0.34,r*0.3,r*0.68,r*0.22); break;
    case 'ball': ctx.beginPath(); ctx.arc(0,0,r*0.9,0,TAU); ctx.fill(); ctx.stroke(); break;
    case 'jar': ctx.beginPath(); ctx.roundRect(-r*0.5,-r*0.5,r*1.0,r*1.3,3*S); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#8d6b48'; ctx.fillRect(-r*0.42,-r*0.72,r*0.84,r*0.26); break;
    case 'radio': ctx.beginPath(); ctx.roundRect(-r*0.85,-r*0.5,r*1.7,r*1.0,3*S); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#2b3157'; ctx.beginPath(); ctx.arc(-r*0.36,0,r*0.28,0,TAU); ctx.fill();
      ctx.fillRect(r*0.05,-r*0.28,r*0.62,r*0.56); break;
    case 'plate': ctx.beginPath(); ctx.ellipse(0,0,r*0.9,r*0.30,0,0,TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0,0,r*0.55,r*0.16,0,0,TAU); ctx.stroke(); break;
    case 'pan': ctx.beginPath(); ctx.arc(0,0,r*0.72,0,Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle=c; ctx.lineWidth=3.4*S; ctx.beginPath(); ctx.moveTo(r*0.7,r*0.1); ctx.lineTo(r*1.5,-r*0.1); ctx.stroke(); break;
    case 'kettle': ctx.beginPath(); ctx.ellipse(0,r*0.05,r*0.75,r*0.62,0,0,TAU); ctx.fill(); ctx.stroke();
      ctx.fillRect(-r*0.16,-r*0.9,r*0.32,r*0.34);
      ctx.strokeStyle=c; ctx.lineWidth=3*S; ctx.beginPath(); ctx.arc(0,-r*0.5,r*0.5,Math.PI,TAU); ctx.stroke(); break;
    case 'pack': ctx.beginPath(); ctx.roundRect(-r*0.42,-r*0.72,r*0.84,r*1.44,2*S); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#0a0d18'; ctx.fillRect(-r*0.30,-r*0.30,r*0.60,r*0.50); break;
    case 'binder': ctx.beginPath(); ctx.roundRect(-r*0.62,-r*0.78,r*1.24,r*1.56,2*S); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#0a0d18'; ctx.fillRect(-r*0.44,-r*0.6,r*0.16,r*1.2); break;
    case 'slab': ctx.beginPath(); ctx.roundRect(-r*0.42,-r*0.7,r*0.84,r*1.4,3*S); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#0a0d18'; ctx.fillRect(-r*0.28,-r*0.44,r*0.56,r*0.86); break;
    case 'pot': ctx.beginPath(); ctx.moveTo(-r*0.62,-r*0.5); ctx.lineTo(r*0.62,-r*0.5);
      ctx.lineTo(r*0.44,r*0.66); ctx.lineTo(-r*0.44,r*0.66); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillRect(-r*0.68,-r*0.62,r*1.36,r*0.20); break;
    case 'fern': ctx.fillStyle='#c98f6a'; ctx.beginPath(); ctx.roundRect(-r*0.4,r*0.15,r*0.8,r*0.6,2*S); ctx.fill();
      ctx.fillStyle=c; for(const a of [-1.2,-0.6,0,0.6,1.2]){ ctx.beginPath();
        ctx.ellipse(Math.sin(a)*r*0.5,-r*0.25-Math.cos(a)*r*0.35,r*0.14,r*0.58,a,0,TAU); ctx.fill(); } break;
    case 'glassjar': ctx.globalAlpha*=0.75; ctx.beginPath(); ctx.roundRect(-r*0.46,-r*0.6,r*0.92,r*1.2,4*S);
      ctx.fill(); ctx.stroke(); ctx.globalAlpha/=0.75; break;
    case 'car': ctx.beginPath(); ctx.roundRect(-r*0.95,-r*0.2,r*1.9,r*0.62,3*S); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(-r*0.5,-r*0.62,r*1.0,r*0.46,3*S); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#141830'; ctx.beginPath(); ctx.arc(-r*0.52,r*0.42,r*0.20,0,TAU);
      ctx.arc(r*0.52,r*0.42,r*0.20,0,TAU); ctx.fill(); break;
    case 'bus': ctx.beginPath(); ctx.roundRect(-r*1.05,-r*0.55,r*2.1,r*1.0,3*S); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#141830'; for(let i=0;i<4;i++) ctx.fillRect(-r*0.86+i*r*0.48,-r*0.38,r*0.34,r*0.36);
      ctx.beginPath(); ctx.arc(-r*0.6,r*0.5,r*0.19,0,TAU); ctx.arc(r*0.6,r*0.5,r*0.19,0,TAU); ctx.fill(); break;
    case 'tank': ctx.beginPath(); ctx.ellipse(0,-r*0.1,r*0.6,r*0.7,0,0,TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle=c; ctx.lineWidth=2.6*S;
      ctx.beginPath(); ctx.moveTo(-r*0.5,r*0.55); ctx.lineTo(-r*0.3,r*0.05);
      ctx.moveTo(r*0.5,r*0.55); ctx.lineTo(r*0.3,r*0.05); ctx.stroke(); break;
    case 'sign': ctx.beginPath(); ctx.roundRect(-r*0.7,-r*0.75,r*1.4,r*0.8,2*S); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#141830'; ctx.fillRect(-r*0.08,r*0.05,r*0.16,r*0.7); break;
    case 'tree': ctx.fillStyle='#7a5c3e'; ctx.fillRect(-r*0.12,r*0.1,r*0.24,r*0.7);
      ctx.fillStyle=c; ctx.beginPath(); ctx.arc(0,-r*0.25,r*0.62,0,TAU); ctx.fill(); ctx.stroke(); break;
    case 'pole': ctx.fillStyle='#6d7299'; ctx.fillRect(-r*0.11,-r*1.5,r*0.22,r*3.0);
      ctx.beginPath(); ctx.moveTo(-r*0.11,-r*1.5); ctx.quadraticCurveTo(r*0.5,-r*1.85,r*0.72,-r*1.5);
      ctx.lineWidth=r*0.20; ctx.strokeStyle='#6d7299'; ctx.stroke();
      ctx.fillStyle=b.broken?'#5b6390':'#ffe9a8';
      ctx.beginPath(); ctx.ellipse(r*0.72,-r*1.42,r*0.26,r*0.16,0,0,TAU); ctx.fill();
      ctx.fillStyle='#4c5479'; ctx.fillRect(-r*0.3,r*1.35,r*0.6,r*0.2); break;
    case 'hydrant': ctx.beginPath(); ctx.roundRect(-r*0.34,-r*0.5,r*0.68,r*1.1,3*S); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0,-r*0.56,r*0.30,Math.PI,TAU); ctx.fill();
      ctx.fillRect(-r*0.62,-r*0.22,r*1.24,r*0.2); break;
    case 'bin': ctx.beginPath(); ctx.moveTo(-r*0.5,-r*0.6); ctx.lineTo(r*0.5,-r*0.6);
      ctx.lineTo(r*0.38,r*0.7); ctx.lineTo(-r*0.38,r*0.7); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillRect(-r*0.58,-r*0.76,r*1.16,r*0.18); break;
    case 'cup': ctx.beginPath(); ctx.moveTo(-r*0.44,-r*0.42); ctx.lineTo(r*0.44,-r*0.42);
      ctx.lineTo(r*0.30,r*0.5); ctx.lineTo(-r*0.30,r*0.5); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
  }
  ctx.globalAlpha=1; ctx.restore();
}

/* ================= the cat =================
   Articulated on purpose. A cat coming apart is legs going in four directions
   at once, a tail whipping, ears flat to the skull and every hair standing
   up — none of which a plain ellipse can do. Limb angles are integrated in
   the physics step so they keep flailing while the body is in the air; this
   only reads them. */
function drawCat(b,t){
  const {S}=w, B=b.B, R=b.r, fur=b.special?'#ffe58a':B.fur, puff=b.puff;
  /* The special one is bigger, warmer and quietly humming. Findable if you
     look, rather than hidden — the decision should be whether to poke it, not
     whether you spotted it. */
  if(b.special){
    const pulse=0.5+0.5*Math.sin(t*3.1);
    b.spotty=true;
    const g=ctx.createRadialGradient(b.x,b.y,R*0.4,b.x,b.y,R*(2.3+0.35*pulse));
    g.addColorStop(0,`rgba(255,214,110,${0.26+0.16*pulse})`);
    g.addColorStop(1,'rgba(255,214,110,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(b.x,b.y,R*(2.3+0.35*pulse),0,TAU); ctx.fill();
    if(b.fuse!==undefined && b.fuse>0){
      ctx.strokeStyle=`rgba(255,157,157,${0.5+0.5*Math.sin(t*26)})`; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(b.x,b.y,R*(1.5+0.5*(1-b.fuse/2.6)),0,TAU); ctx.stroke();
    }
  }
  const spaz=b.state==='spaz';
  ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(b.rot);
  if(b.state==='flat') ctx.scale(1.18,0.72);
  else if(b.state==='calm'){
    /* how a cat is asleep changes its outline, not only its legs */
    if(b.stance==='loaf')   ctx.scale(1.06,0.86);
    if(b.stance==='sprawl') ctx.scale(1.30,0.70);
    if(b.stance==='stand')  ctx.scale(1.02,0.94);
    if(b.stance==='sit')    ctx.scale(0.90,1.10);
  }

  /* tail: five segments, whipping when it all kicks off */
  ctx.strokeStyle=B.mark; ctx.lineCap='round';
  ctx.lineWidth=R*(0.22+0.10*puff);
  ctx.beginPath();
  let tx=-R*0.78, ty=R*0.10, ang=Math.PI;
  ctx.moveTo(tx,ty);
  for(let i=0;i<5;i++){
    ang += b.tail[i]*(spaz?1:0.6) + (spaz?0:-0.20);
    tx += Math.cos(ang)*R*0.34; ty += Math.sin(ang)*R*0.34;
    ctx.lineTo(tx,ty);
  }
  ctx.stroke();

  /* legs: two per side, hips and shoulders, each with a knee */
  ctx.strokeStyle=fur; ctx.lineWidth=R*0.20; ctx.lineCap='round';
  const hips=[[-R*0.44,R*0.34],[-R*0.16,R*0.42],[R*0.20,R*0.42],[R*0.48,R*0.34]];
  hips.forEach((h,i)=>{
    const a=Math.PI/2 + b.legs[i];
    const kx=h[0]+Math.cos(a)*R*0.42, ky=h[1]+Math.sin(a)*R*0.42;
    const a2=a + b.legs[i]*0.8 + (spaz?Math.sin(t*30+i*2+b.seed)*0.7:0.25);
    const px=kx+Math.cos(a2)*R*0.36, py=ky+Math.sin(a2)*R*0.36;
    ctx.beginPath(); ctx.moveTo(h[0],h[1]); ctx.lineTo(kx,ky); ctx.lineTo(px,py); ctx.stroke();
    ctx.fillStyle=fur; ctx.beginPath(); ctx.arc(px,py,R*0.13,0,TAU); ctx.fill();
  });

  /* body: a spiky silhouette when the fur is up, smooth when it is not */
  ctx.fillStyle=fur;
  ctx.beginPath();
  const N=26;
  for(let i=0;i<=N;i++){
    const a=(i/N)*TAU;
    const spike = puff>0.02 ? (i%2? 1+0.30*puff : 1-0.05*puff) : 1;
    const rx=R*0.92*spike, ry=R*0.72*spike;
    const x=Math.cos(a)*rx, y=Math.sin(a)*ry+R*0.06;
    i?ctx.lineTo(x,y):ctx.moveTo(x,y);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(10,13,24,.26)'; ctx.lineWidth=1.6*S; ctx.stroke();
  /* The one that ends the level wears spots, so you can pick it out at a
     glance rather than squinting at the glow. */
  if(b.special){
    ctx.fillStyle='rgba(60,40,10,.55)';
    for(const [sx,sy,sr] of [[-0.42,-0.10,0.20],[-0.05,0.24,0.17],[0.34,-0.04,0.19],
                             [0.10,-0.30,0.14],[-0.60,0.26,0.13],[0.60,0.28,0.15]]){
      ctx.beginPath(); ctx.ellipse(R*sx,R*sy+R*0.06,R*sr,R*sr*0.78,sx,0,TAU); ctx.fill();
    }
  }

  /* head: ears flat back when panicking, up when asleep */
  const hx=R*0.52, hy=-R*0.46, hr=R*0.52;
  ctx.fillStyle=fur;
  const tall=B.ear==='tall'?1.5:B.ear==='round'?0.95:1.2;
  for(const s of [-1,1]){
    const lean = spaz ? s*0.85 : 0;
    ctx.beginPath();
    ctx.moveTo(hx+s*hr*0.30,hy-hr*0.44);
    ctx.quadraticCurveTo(hx+s*hr*(0.75+lean),hy-hr*tall*(spaz?0.55:1),
                         hx+s*hr*(1.0+lean*1.4),hy-hr*(spaz?0.25:tall*0.55));
    ctx.quadraticCurveTo(hx+s*hr*0.85,hy-hr*0.25,hx+s*hr*0.55,hy-hr*0.12);
    ctx.closePath(); ctx.fill();
  }
  ctx.beginPath(); ctx.arc(hx,hy,hr,0,TAU); ctx.fill();
  ctx.strokeStyle='rgba(10,13,24,.26)'; ctx.lineWidth=1.5*S; ctx.stroke();
  /* face */
  const ink='#141830';
  const er=hr*(spaz?0.40:0.26)*(B.eye==='huge'?1.2:B.eye==='wide'?1.1:1);
  const ex=hr*0.34, ey=-hr*0.06;
  if(b.state==='calm'){
    ctx.strokeStyle=ink; ctx.lineWidth=hr*0.13; ctx.lineCap='round';
    for(const s of [-1,1]){ ctx.beginPath(); ctx.arc(hx+s*ex,hy+ey,er*0.95,Math.PI*1.12,Math.PI*1.88); ctx.stroke(); }
  } else {
    for(const s of [-1,1]){
      ctx.fillStyle='#ffd25e'; ctx.beginPath(); ctx.arc(hx+s*ex,hy+ey,er,0,TAU); ctx.fill();
      ctx.fillStyle=ink; ctx.beginPath();
      ctx.arc(hx+s*ex,hy+ey,er*(spaz?0.52:0.34),0,TAU); ctx.fill();
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(hx+s*ex+er*0.28,hy+ey-er*0.32,er*0.2,0,TAU); ctx.fill();
    }
  }
  ctx.fillStyle='#ff9db8'; ctx.beginPath();
  ctx.moveTo(hx,hy+hr*0.30); ctx.lineTo(hx-hr*0.11,hy+hr*0.16); ctx.lineTo(hx+hr*0.11,hy+hr*0.16);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle=ink; ctx.lineWidth=hr*0.08; ctx.lineCap='round'; ctx.beginPath();
  if(spaz) ctx.ellipse(hx,hy+hr*0.52,hr*0.20,hr*0.26,0,0,TAU);
  else if(b.state==='calm'){ ctx.arc(hx-hr*0.09,hy+hr*0.40,hr*0.12,1.75*Math.PI,0.6*Math.PI);
    ctx.arc(hx+hr*0.09,hy+hr*0.40,hr*0.12,0.4*Math.PI,1.25*Math.PI); }
  else ctx.arc(hx,hy+hr*0.5,hr*0.22,1.15*Math.PI,1.85*Math.PI);
  ctx.stroke();
  ctx.strokeStyle='rgba(20,24,48,.4)'; ctx.lineWidth=hr*0.06;
  for(const g of [-1,1]) for(const dy of [-0.04,0.10]){
    ctx.beginPath(); ctx.moveTo(hx+g*hr*0.36,hy+hr*dy); ctx.lineTo(hx+g*hr*0.95,hy+hr*(dy+0.04)); ctx.stroke(); }
  ctx.restore();

  /* fright lines, so a cat going up reads instantly even at this size */
  if(spaz){
    ctx.strokeStyle='rgba(255,216,138,'+(0.35+0.3*Math.sin(t*24+b.seed))+')';
    ctx.lineWidth=2;
    for(let i=0;i<5;i++){ const a=(i/5)*TAU+t*3+b.seed;
      ctx.beginPath();
      ctx.moveTo(b.x+Math.cos(a)*R*1.35,b.y+Math.sin(a)*R*1.15);
      ctx.lineTo(b.x+Math.cos(a)*R*1.75,b.y+Math.sin(a)*R*1.5); ctx.stroke(); }
  }
  if(!w.started && b.state==='calm'){
    ctx.strokeStyle=b.special?'rgba(255,216,138,.75)':'rgba(125,216,255,.5)';
    ctx.lineWidth=b.special?2.4:1.8; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.arc(b.x,b.y,R*1.5,0,TAU); ctx.stroke(); ctx.setLineDash([]);
  }
}


/* ================= the five environments ================= */
function drawRoom(){
  const {W,H,floorY,ceilY}=w, city=w.L.city;
  if(city){
    const g=ctx.createLinearGradient(0,0,0,floorY);
    g.addColorStop(0,'#161c3d'); g.addColorStop(1,'#2a2145');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,floorY);
    ctx.fillStyle='rgba(255,216,138,.10)';
    ctx.beginPath(); ctx.arc(W*0.80,H*0.16,H*0.075,0,TAU); ctx.fill();
    ctx.fillStyle='#ffd88a'; ctx.beginPath(); ctx.arc(W*0.80,H*0.16,H*0.045,0,TAU); ctx.fill();
    ctx.fillStyle='#1b2040'; ctx.fillRect(0,floorY,W,H-floorY);
    ctx.strokeStyle='#3a4170'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(0,floorY); ctx.lineTo(W,floorY); ctx.stroke();
    ctx.strokeStyle='rgba(255,216,138,.30)'; ctx.setLineDash([W*0.03,W*0.03]);
    ctx.beginPath(); ctx.moveTo(0,floorY+(H-floorY)*0.55); ctx.lineTo(W,floorY+(H-floorY)*0.55); ctx.stroke();
    ctx.setLineDash([]);
  } else {
    ctx.fillStyle='#151a33'; ctx.fillRect(0,0,W,floorY);
    ctx.fillStyle='#12172f'; ctx.fillRect(0,0,W,ceilY);
    ctx.fillStyle='#1b2040'; ctx.fillRect(0,floorY,W,H-floorY);
    ctx.strokeStyle='#2a2f52'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(0,floorY); ctx.lineTo(W,floorY); ctx.stroke();
    ctx.fillStyle='#232949'; ctx.fillRect(0,floorY-H*0.022,W,H*0.022);
    ctx.strokeStyle='#242a4d';
    ctx.beginPath(); ctx.moveTo(0,H*0.20); ctx.lineTo(W,H*0.20); ctx.stroke();
    if(w.lvl===0){
      ctx.fillStyle='#0e1330'; ctx.fillRect(W*0.615,H*0.075,W*0.105,H*0.115);
      ctx.strokeStyle='#333a63'; ctx.lineWidth=2.5; ctx.strokeRect(W*0.615,H*0.075,W*0.105,H*0.115);
      ctx.fillStyle='#1a2044';
      ctx.beginPath(); ctx.ellipse(W*0.45,floorY+(H-floorY)*0.4,W*0.30,(H-floorY)*0.45,0,0,TAU); ctx.fill();
    }
    if(w.lvl===3){   // greenhouse: glass roof
      ctx.strokeStyle='rgba(143,227,176,.18)'; ctx.lineWidth=2;
      for(let i=0;i<9;i++){ ctx.beginPath();
        ctx.moveTo(W*i/8,ceilY); ctx.lineTo(W*0.5,H*0.18); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(0,H*0.18); ctx.lineTo(W,H*0.18); ctx.stroke();
    }
  }
  const wood='#7a5c3e', wood2='#8d6b48', dark='#2f3560';
  for(const f of w.furn){
    const sh=Math.max(4,H*0.016);
    switch(f.k){
      case 'bookcase': case 'rack': case 'tier':
        ctx.fillStyle=f.k==='rack'?'#2b3157':'#2a3057'; ctx.fillRect(f.X,f.Y,f.Wd,f.Ht);
        ctx.fillStyle='#1d2246'; ctx.fillRect(f.X+3,f.Y+3,f.Wd-6,f.Ht-6);
        ctx.fillStyle=f.k==='tier'?'#3d4a2f':dark;
        f.shelves.forEach(s=>ctx.fillRect(f.X,f.Y+f.Ht*s,f.Wd,sh));
        ctx.fillStyle='#2a3057'; ctx.fillRect(f.X,f.Y,5,f.Ht); ctx.fillRect(f.X+f.Wd-5,f.Y,5,f.Ht); break;
      case 'shelf':
        ctx.fillStyle=dark; ctx.fillRect(f.X,f.Y,f.Wd,sh);
        ctx.fillStyle='#262c52'; ctx.fillRect(f.X,f.Y+sh,f.Wd,sh*0.6);
        ctx.fillStyle='#232949';
        ctx.fillRect(f.X+f.Wd*0.08,f.Y+sh*1.6,f.Wd*0.05,H*0.03);
        ctx.fillRect(f.X+f.Wd*0.87,f.Y+sh*1.6,f.Wd*0.05,H*0.03); break;
      case 'desk':
        ctx.fillStyle=wood2; ctx.fillRect(f.X,f.Y,f.Wd,sh*1.2);
        ctx.fillStyle=wood; ctx.fillRect(f.X+f.Wd*0.02,f.Y+sh*1.2,f.Wd*0.34,f.Ht-sh*1.2);
        ctx.fillStyle='#6a4f34';
        for(let i=0;i<3;i++) ctx.fillRect(f.X+f.Wd*0.05,f.Y+sh*2+i*(f.Ht*0.22),f.Wd*0.28,f.Ht*0.14);
        ctx.fillStyle=wood; ctx.fillRect(f.X+f.Wd*0.90,f.Y+sh*1.2,f.Wd*0.07,f.Ht-sh*1.2); break;
      case 'chair':
        ctx.fillStyle=wood2; ctx.fillRect(f.X,f.Y,f.Wd,sh);
        ctx.fillStyle=wood; ctx.fillRect(f.X+f.Wd*0.80,f.Y-f.Ht*0.55,f.Wd*0.16,f.Ht*0.58);
        ctx.fillRect(f.X+f.Wd*0.06,f.Y+sh,f.Wd*0.10,f.Ht-sh);
        ctx.fillRect(f.X+f.Wd*0.82,f.Y+sh,f.Wd*0.10,f.Ht-sh); break;
      case 'table': case 'bench':
        ctx.fillStyle=f.k==='bench'?'#5e6a4a':wood2; ctx.fillRect(f.X,f.Y,f.Wd,sh*1.2);
        ctx.fillStyle=f.k==='bench'?'#4a543b':wood;
        ctx.fillRect(f.X+f.Wd*0.06,f.Y+sh*1.2,f.Wd*0.09,f.Ht-sh*1.2);
        ctx.fillRect(f.X+f.Wd*0.85,f.Y+sh*1.2,f.Wd*0.09,f.Ht-sh*1.2); break;
      case 'bed':
        ctx.fillStyle='#3c4472'; ctx.fillRect(f.X,f.Y+sh*1.2,f.Wd,f.Ht-sh*1.2);
        ctx.fillStyle='#5b64a0'; ctx.fillRect(f.X,f.Y,f.Wd,sh*1.6);
        ctx.fillStyle='#6e78b8';
        ctx.beginPath(); ctx.roundRect(f.X+f.Wd*0.72,f.Y-H*0.030,f.Wd*0.24,H*0.038,5); ctx.fill();
        ctx.fillStyle='#2a3057'; ctx.fillRect(f.X+f.Wd*0.97,f.Y-f.Ht*0.42,f.Wd*0.05,f.Ht*0.5); break;
      case 'counter': case 'island':
        ctx.fillStyle='#8b93bb'; ctx.fillRect(f.X,f.Y,f.Wd,sh*1.1);
        ctx.fillStyle='#3a4170'; ctx.fillRect(f.X,f.Y+sh*1.1,f.Wd,f.Ht-sh*1.1);
        ctx.strokeStyle='#2a2f52'; ctx.lineWidth=2;
        for(let i=1;i<3;i++){ ctx.beginPath(); ctx.moveTo(f.X+f.Wd*i/3,f.Y+sh*1.1);
          ctx.lineTo(f.X+f.Wd*i/3,f.Y+f.Ht); ctx.stroke(); } break;
      case 'cabinet':
        ctx.fillStyle='#3a4170'; ctx.fillRect(f.X,f.Y,f.Wd,f.Ht);
        ctx.strokeStyle='#2a2f52'; ctx.lineWidth=2; ctx.strokeRect(f.X,f.Y,f.Wd,f.Ht);
        ctx.beginPath(); ctx.moveTo(f.X+f.Wd/2,f.Y); ctx.lineTo(f.X+f.Wd/2,f.Y+f.Ht); ctx.stroke();
        ctx.fillStyle='#8b93bb'; ctx.fillRect(f.X+f.Wd*0.44,f.Y+f.Ht*0.42,f.Wd*0.04,f.Ht*0.18);
        ctx.fillRect(f.X+f.Wd*0.52,f.Y+f.Ht*0.42,f.Wd*0.04,f.Ht*0.18); break;
      case 'stove':
        ctx.fillStyle='#8b93bb'; ctx.fillRect(f.X,f.Y,f.Wd,sh*1.1);
        ctx.fillStyle='#2b3157'; ctx.fillRect(f.X,f.Y+sh*1.1,f.Wd,f.Ht-sh*1.1);
        ctx.fillStyle='#ff9d9d'; ctx.globalAlpha=.5;
        ctx.beginPath(); ctx.arc(f.X+f.Wd*0.30,f.Y+sh*0.55,sh*0.5,0,TAU);
        ctx.arc(f.X+f.Wd*0.70,f.Y+sh*0.55,sh*0.5,0,TAU); ctx.fill(); ctx.globalAlpha=1; break;
      case 'fridge':
        ctx.fillStyle='#9aa3bd'; ctx.fillRect(f.X,f.Y,f.Wd,f.Ht);
        ctx.strokeStyle='#6d7299'; ctx.lineWidth=2; ctx.strokeRect(f.X,f.Y,f.Wd,f.Ht);
        ctx.beginPath(); ctx.moveTo(f.X,f.Y+f.Ht*0.34); ctx.lineTo(f.X+f.Wd,f.Y+f.Ht*0.34); ctx.stroke();
        ctx.fillStyle='#6d7299'; ctx.fillRect(f.X+f.Wd*0.82,f.Y+f.Ht*0.12,f.Wd*0.05,f.Ht*0.16);
        ctx.fillRect(f.X+f.Wd*0.82,f.Y+f.Ht*0.42,f.Wd*0.05,f.Ht*0.22); break;
      case 'case':
        ctx.fillStyle='rgba(125,216,255,.10)'; ctx.fillRect(f.X,f.Y,f.Wd,f.Ht);
        ctx.strokeStyle='#4a5180'; ctx.lineWidth=2.5; ctx.strokeRect(f.X,f.Y,f.Wd,f.Ht);
        ctx.fillStyle='#8b93bb'; ctx.fillRect(f.X,f.Y,f.Wd,sh*0.8);
        ctx.strokeStyle='#3a4170'; ctx.lineWidth=1.6;
        ctx.beginPath(); ctx.moveTo(f.X,f.Y+f.Ht*0.55); ctx.lineTo(f.X+f.Wd,f.Y+f.Ht*0.55); ctx.stroke();
        for(let i=1;i<4;i++){ ctx.beginPath(); ctx.moveTo(f.X+f.Wd*i/4,f.Y);
          ctx.lineTo(f.X+f.Wd*i/4,f.Y+f.Ht); ctx.stroke(); } break;
      case 'tower': {
        if(f.gone){   // a heap where a building used to be
          ctx.fillStyle='#262c52';
          ctx.beginPath();
          ctx.moveTo(f.X-f.Wd*0.12,f.Y+f.Ht);
          ctx.lineTo(f.X+f.Wd*0.20,f.Y+f.Ht-f.Ht*0.10);
          ctx.lineTo(f.X+f.Wd*0.62,f.Y+f.Ht-f.Ht*0.055);
          ctx.lineTo(f.X+f.Wd*1.10,f.Y+f.Ht);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle='#1d2246';
          for(let i=0;i<7;i++) ctx.fillRect(f.X+f.Wd*(0.05+0.13*i),f.Y+f.Ht-f.Ht*0.05-((i*37)%9)*w.S,
            f.Wd*0.10,f.Ht*0.035);
          break;
        }
        ctx.save();
        if(f.collapsing){
          /* it sits down into its own footprint and leans as it goes */
          const k=f.fall;
          ctx.translate(f.X+f.Wd/2,f.Y+f.Ht);
          ctx.rotate(f.tilt*k*0.5);
          ctx.scale(1+k*0.10,1-k*0.92);
          ctx.translate(-(f.X+f.Wd/2),-(f.Y+f.Ht));
          ctx.globalAlpha=1-k*0.25;
        }
        const hurt = f.maxHp ? 1-f.hp/f.maxHp : 0;
        ctx.fillStyle='#232a52'; ctx.fillRect(f.X,f.Y,f.Wd,f.Ht);
        ctx.fillStyle='#2e3660'; ctx.fillRect(f.X,f.Y,f.Wd,sh*0.9);
        const cols=Math.max(2,Math.round(f.Wd/(w.S*13))), rows=Math.max(3,Math.round(f.Ht/(w.S*22)));
        for(let cx=0;cx<cols;cx++) for(let ry=0;ry<rows;ry++){
          const seedy=(cx*7+ry*13+Math.round(f.X));
          /* the lights go out from the top down as it takes damage */
          const out = (seedy%10)/10 < hurt*1.15;
          const lit = !out && (seedy%5)<2;
          ctx.fillStyle=lit?'rgba(255,216,138,.55)':out?'rgba(10,13,24,.55)':'rgba(125,216,255,.10)';
          ctx.fillRect(f.X+f.Wd*(0.12+0.76*cx/cols), f.Y+sh*1.6+f.Ht*0.86*ry/rows,
                       f.Wd*0.52/cols, f.Ht*0.5/rows);
        }
        if(hurt>0.01){   // cracks
          ctx.strokeStyle=`rgba(10,13,24,${0.35+0.4*hurt})`; ctx.lineWidth=2;
          const n=Math.ceil(hurt*4);
          for(let i=0;i<n;i++){
            const sx=f.X+f.Wd*(0.2+0.6*((i*37)%10)/10), sy=f.Y+f.Ht*(0.1+0.7*((i*53)%10)/10);
            ctx.beginPath(); ctx.moveTo(sx,sy);
            ctx.lineTo(sx+f.Wd*0.22*(i%2?1:-1),sy+f.Ht*0.16);
            ctx.lineTo(sx+f.Wd*0.06*(i%2?1:-1),sy+f.Ht*0.30); ctx.stroke();
          }
        }
        ctx.globalAlpha=1; ctx.restore();
        break; }
    }
  }
}
/* Wires run post to post and vanish the moment either end comes down. */
function drawWires(){
  if(!w.poles||!w.poles.length) return;
  const up=w.poles.filter(p=>!p.broken).sort((a,b)=>a.x-b.x);
  ctx.strokeStyle='rgba(10,13,24,.55)'; ctx.lineWidth=Math.max(1.4,1.8*w.S);
  for(let i=0;i<up.length-1;i++){
    const a=up[i], b=up[i+1];
    if(Math.abs(a.x-b.x)>w.W*0.34) continue;      // too far apart to be strung
    const ay=a.y-a.r*1.42, by=b.y-b.r*1.42;
    ctx.beginPath(); ctx.moveTo(a.x+a.r*0.72,ay);
    ctx.quadraticCurveTo((a.x+b.x)/2,Math.max(ay,by)+w.H*0.035,b.x+b.r*0.72,by);
    ctx.stroke();
  }
}
function drawChandelier(b){
  const r=b.r;
  if(b.hang){ ctx.strokeStyle='#3a4170'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(b.hang.x,b.hang.y); ctx.lineTo(b.x,b.y); ctx.stroke(); }
  ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(b.rot);
  if(b.lit){ const g=ctx.createRadialGradient(0,0,r*0.2,0,0,r*3.2);
    g.addColorStop(0,'rgba(255,216,138,.22)'); g.addColorStop(1,'rgba(255,216,138,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,r*3.2,0,TAU); ctx.fill(); }
  ctx.globalAlpha=b.broken?0.4:1;
  ctx.strokeStyle='#ffd88a'; ctx.lineWidth=2.4;
  ctx.beginPath(); ctx.moveTo(-r*0.9,0); ctx.quadraticCurveTo(0,r*0.55,r*0.9,0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,-r*0.6); ctx.lineTo(0,r*0.1); ctx.stroke();
  for(const dx of [-0.9,-0.3,0.3,0.9]){
    ctx.beginPath(); ctx.moveTo(r*dx,0); ctx.lineTo(r*dx,r*0.34); ctx.stroke();
    ctx.fillStyle=b.lit?'#fff3cf':'#5b6390';
    ctx.beginPath(); ctx.ellipse(r*dx,r*0.48,r*0.15,r*0.22,0,0,TAU); ctx.fill();
  }
  ctx.globalAlpha=1; ctx.restore();
}
/* the mushroom cloud, which is the last thing that happens in this game */
function drawNuke(){
  const n=w.nuke, k=n.age/n.life, {W,H}=w;
  ctx.save();
  ctx.globalAlpha=Math.max(0,1-Math.pow(k,2.4));
  const flash=Math.max(0,1-k*7);
  if(flash>0){ ctx.fillStyle=`rgba(255,247,214,${flash*0.9})`; ctx.fillRect(0,0,W,H); }
  const rise=Math.min(1,k*1.7), grow=Math.min(1,k*1.35);
  const stemH=H*0.52*rise, capY=n.y-stemH, capR=H*0.20*grow;
  const g=ctx.createRadialGradient(n.x,capY,capR*0.15,n.x,capY,capR*1.5);
  g.addColorStop(0,'rgba(255,236,182,.95)'); g.addColorStop(0.45,'rgba(255,157,157,.75)');
  g.addColorStop(1,'rgba(120,90,140,0)');
  ctx.fillStyle=g;
  ctx.beginPath(); ctx.ellipse(n.x,capY,capR*1.28,capR*0.86,0,0,TAU); ctx.fill();
  for(let i=0;i<7;i++){ const a=(i/7)*TAU+k*1.6;
    ctx.beginPath(); ctx.arc(n.x+Math.cos(a)*capR*0.9,capY+Math.sin(a)*capR*0.42,capR*0.42,0,TAU); ctx.fill(); }
  const sg=ctx.createLinearGradient(n.x,n.y,n.x,capY);
  sg.addColorStop(0,'rgba(255,216,138,.75)'); sg.addColorStop(1,'rgba(255,157,157,.55)');
  ctx.fillStyle=sg;
  ctx.beginPath();
  ctx.moveTo(n.x-capR*0.30,n.y); ctx.quadraticCurveTo(n.x-capR*0.16,capY+stemH*0.4,n.x-capR*0.22,capY);
  ctx.lineTo(n.x+capR*0.22,capY); ctx.quadraticCurveTo(n.x+capR*0.16,capY+stemH*0.4,n.x+capR*0.30,n.y);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle=`rgba(255,247,214,${Math.max(0,0.7-k*1.4)})`; ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(n.x,n.y,H*0.9*k,0,TAU); ctx.stroke();
  ctx.restore();
}


/* ================= the game ================= */
const $=id=>document.getElementById(id);
let seed=Math.floor(Math.random()*1e6), total=0, runs=[], playing=false;
const pointsFor=(chaos,lvl)=>Math.round(chaos*10*LEVELS[lvl].mult);

function pips(){
  const box=$('pips'); box.innerHTML='';
  LEVELS.forEach((L,i)=>{ const d=document.createElement('div');
    d.className='pip'+(i<runs.length?' done':i===runs.length&&playing?' now':''); box.appendChild(d); });
}
function hud(){
  const c=chaosOf();
  $('lvl').textContent=(w.lvl+1)+'/5';
  $('chaos').textContent=c+'%';
  $('lvlscore').textContent=w.started?pointsFor(c,w.lvl):0;
  $('total').textContent=total;
  $('fill').style.width=c+'%';
}
function startLevel(i){
  buildLevel(i,seed); playing=true;
  $('overlay').hidden=true; pips(); hud();
  cv.focus({preventScroll:true});
}
function endLevel(){
  w.over=true;
  const c=chaosOf(), pts=pointsFor(c,w.lvl), p=parts();
  total+=pts; runs.push({name:w.L.name,chaos:c,pts});
  $('f-chaos').textContent=c+'%';
  $('f-cats').textContent=p.woken+'/'+p.cats;
  $('f-broken').textContent=p.broken+'/'+p.breakable;
  $('f-points').textContent='+'+pts;
  $('ov-score').hidden=false;
  hud(); pips();
  const last=w.lvl>=LEVELS.length-1;
  if(last) return finish();
  $('ov-title').textContent = c>=70?'Comprehensive':c>=40?'Respectable':'Mostly intact';
  $('ov-body').textContent = LEVELS[w.lvl+1].name+' — '+LEVELS[w.lvl+1].blurb+
    ' Worth ×'+LEVELS[w.lvl+1].mult+'.';
  $('go').textContent='Next level';
  $('go').onclick=()=>startLevel(w.lvl+1);
  $('overlay').hidden=false;
}
function finish(){
  playing=false;
  $('ov-title').textContent = total>=9000?'The neighbourhood is gone':'That will do';
  $('ov-body').textContent = 'Five levels, five pokes.';
  $('ov-score').hidden=true;
  $('final-score').textContent=total;
  $('runs').innerHTML=runs.map(r=>`<div><span>${r.name}</span><b>${r.chaos}% &middot; ${r.pts}</b></div>`).join('');
  $('ov-final').hidden=false;
  $('go').textContent='Play again';
  $('go').onclick=newGame;
  $('overlay').hidden=false;
  boardUI.finish();
}
function newGame(){
  seed=Math.floor(Math.random()*1e6); total=0; runs=[];
  $('ov-final').hidden=true; $('entry').hidden=true; $('board').hidden=true; $('ov-score').hidden=true;
  startLevel(0);
}

/* This game's board. Mechanics live in js/leaderboard.js, shared with the
   other three; only the store id and the local key are per-game, which is what
   keeps the four boards independent.

   The id is empty because api.restful-api.dev meters anonymous callers at 50
   requests a day and the allowance was exhausted when this shipped, so the
   store could not be created. With no id the shared module skips the network
   entirely and keeps scores in this browser under "Your best runs" — which is
   the same thing it does for any visitor whose allowance has run out. Drop the
   id in when there is one and it becomes a shared board with no other change. */
const Board = makeBoard({
  id: '',
  localKey: 'catastrophe-board',
  storeName: 'schrodingerscards-catastrophe-highscores'
});
const boardUI = attachBoardUI(Board, () => total);

cv.addEventListener('pointerdown',e=>{
  if(!playing||w.started||w.over) return;
  const r=cv.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top;
  let best=null,bd=1e9;
  for(const b of w.bodies){ if(b.kind!=='cat') continue;
    const d=Math.hypot(b.x-x,b.y-y); if(d<b.r*2.0&&d<bd){bd=d;best=b;} }
  if(!best) return;
  w.started=true; w.elapsed=0; w.quiet=0; spazz(best,true);
});
$('go').onclick=newGame;

let last=performance.now();
function frame(now){
  const dt=clamp((now-last)/1000,0,0.033); last=now;
  const t=now/1000;
  ctx.save();
  if(w.shake>0.4) ctx.translate(rand(-w.shake,w.shake),rand(-w.shake,w.shake));
  drawRoom();
  if(w.started&&!w.over){
    step(dt,false); w.elapsed+=dt;
    if(w.nuke){ w.nuke.age+=dt; if(w.nuke.age>=w.nuke.life) endLevel(); }
    else if(topSpeed()<40*w.S&&!anySpaz()){ w.quiet+=dt; if(w.quiet>0.7) endLevel(); }
    else w.quiet=0;
    hud();
  }
  for(const b of w.bodies) if(b.kind==='item') drawItem(b);
  drawWires();
  for(const p of w.puffs){ const k=p.age/p.life;
    ctx.globalAlpha=(1-k)*0.32; ctx.fillStyle='#cdd4f5';
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r+p.grow*k,0,TAU); ctx.fill(); }
  ctx.globalAlpha=1;
  for(const s of w.shards){
    ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(s.rot);
    ctx.globalAlpha=Math.max(0,1-Math.pow(s.age/s.life,2)); ctx.fillStyle=s.col;
    if(s.shape){ ctx.beginPath(); ctx.moveTo(-s.r,-s.r*0.5); ctx.lineTo(s.r,-s.r*0.2);
      ctx.lineTo(s.r*0.4,s.r*0.7); ctx.closePath(); ctx.fill(); }
    else ctx.fillRect(-s.r,-s.r*0.55,s.r*2,s.r*1.1);
    ctx.restore();
  }
  ctx.globalAlpha=1;
  for(const b of w.bodies) if(b.kind==='cat'&&b.state!=='gone') drawCat(b,t);
  if(w.nuke) drawNuke();
  ctx.restore();
  requestAnimationFrame(frame);
}
resize(); buildLevel(0,seed); pips(); requestAnimationFrame(frame);
