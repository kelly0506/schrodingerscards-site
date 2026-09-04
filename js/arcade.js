/* ================= arcade tile art =================
   A still from each game, drawn rather than shipped as images so the two
   tiles stay in step with the palette and with how the cats actually look.
   Deliberately its own small renderer: loading either game's script here
   would start that game looking for its canvas. */
(function(){
  const FUR = ['#9aa3bd','#d9c49b','#7dd8ff','#b48bff','#ff8fd0','#ffd88a'];
  const INK = '#141830';

  function head(ctx,x,y,r,fur,ear){
    ctx.fillStyle=fur;
    const tri=(sgn,tall)=>{ ctx.beginPath();
      ctx.moveTo(x+sgn*r*0.22, y-r*0.52);
      ctx.quadraticCurveTo(x+sgn*r*0.76, y-r*tall, x+sgn*r*0.98, y-r*(tall*0.62));
      ctx.quadraticCurveTo(x+sgn*r*0.94, y-r*0.34, x+sgn*r*0.96, y-r*0.20);
      ctx.closePath(); ctx.fill(); };
    tri(-1, ear); tri(1, ear);
    ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
    /* gold eyes with upright pupils — the detail that reads as cat */
    for(const s of [-1,1]){
      ctx.fillStyle='#ffd25e';
      ctx.beginPath(); ctx.ellipse(x+s*r*0.40,y-r*0.05,r*0.30,r*0.32,0,0,7); ctx.fill();
      ctx.fillStyle=INK;
      ctx.beginPath(); ctx.ellipse(x+s*r*0.40,y-r*0.05,r*0.11,r*0.28,0,0,7); ctx.fill();
      ctx.fillStyle='#fff';
      ctx.beginPath(); ctx.arc(x+s*r*0.49,y-r*0.15,r*0.06,0,7); ctx.fill();
    }
    ctx.fillStyle='#ff9db8';
    ctx.beginPath(); ctx.moveTo(x,y+r*0.42); ctx.lineTo(x-r*0.11,y+r*0.28); ctx.lineTo(x+r*0.11,y+r*0.28);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(20,24,48,.42)'; ctx.lineWidth=r*0.045; ctx.lineCap='round';
    for(const s of [-1,1]) for(const dy of [-0.02,0.12,0.26]){
      ctx.beginPath(); ctx.moveTo(x+s*r*0.46,y+r*dy); ctx.lineTo(x+s*r*1.06,y+r*(dy+0.04)); ctx.stroke(); }
  }

  /* Schrodinger's Cats: a few cats and the wave ring closing on one. */
  function artCats(ctx,W,H){
    const cats=[[0.20,0.62,26,0],[0.52,0.36,21,2],[0.79,0.66,30,3],[0.36,0.80,18,1]];
    for(const [fx,fy,r,ci] of cats){
      const x=W*fx, y=H*fy;
      ctx.fillStyle=FUR[ci];
      ctx.beginPath(); ctx.ellipse(x,y+r*0.86,r*0.92,r*0.66,0,0,7); ctx.fill();
      head(ctx,x,y,r*0.72,FUR[ci],1.42);
    }
    const cx=W*0.79, cy=H*0.66;
    ctx.strokeStyle='rgba(125,216,255,.85)'; ctx.lineWidth=2.4;
    ctx.beginPath(); ctx.arc(cx,cy,46,0,7); ctx.stroke();
    ctx.strokeStyle='rgba(180,139,255,.55)'; ctx.lineWidth=1.6;
    ctx.beginPath(); ctx.arc(cx,cy,62,0,7); ctx.stroke();
  }

  /* If I Fits I Sits: the test tube, which is the vessel that shows the joke
     best — it is the narrowest one in the game, so the cat has to go absurdly
     tall and thin to hold the same volume. Rounded at the bottom and open at
     the top, with the cat poured in and his head sticking out. */
  function artFits(ctx,W,H){
    const cx=W*0.5, rimY=H*0.09, floorY=H*0.94;
    const hw=W*0.085;                       // the tube is genuinely narrow
    const bulb=hw;                          // the round bottom
    const bodyBot=floorY-bulb;

    /* the glass, as one closed path: straight sides, half-round base */
    const glass=()=>{
      ctx.beginPath();
      ctx.moveTo(cx-hw,rimY);
      ctx.lineTo(cx-hw,bodyBot);
      ctx.arc(cx,bodyBot,bulb,Math.PI,0,true);
      ctx.lineTo(cx+hw,rimY);
    };

    /* the cat, filling it: a column that stops just under the rim, with the
       same round bottom so he reads as poured in rather than dropped in */
    const fillTop=rimY+H*0.155;
    ctx.save();
    glass(); ctx.closePath(); ctx.clip();
    ctx.fillStyle=FUR[3];
    ctx.fillRect(cx-hw,fillTop,hw*2,floorY-fillTop);
    /* paw pads pressed flat against the glass */
    ctx.fillStyle='rgba(255,197,212,.9)';
    for(const s of [-1,1]){
      const px=cx+s*hw*0.46, py=fillTop+H*0.20;
      ctx.beginPath(); ctx.ellipse(px,py,5.4,4.4,0,0,7); ctx.fill();
      for(const [dx,dy] of [[-0.68,-0.52],[-0.22,-0.82],[0.22,-0.82],[0.68,-0.52]]){
        ctx.beginPath(); ctx.arc(px+dx*7,py+dy*7,1.9,0,7); ctx.fill(); }
    }
    /* the tail, curled against the inside of the glass */
    ctx.strokeStyle=FUR[3]; ctx.lineWidth=hw*0.42; ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(cx+hw*0.30,floorY-H*0.10);
    ctx.quadraticCurveTo(cx-hw*0.85,floorY-H*0.05,cx-hw*0.10,floorY-H*0.015);
    ctx.stroke();
    ctx.restore();

    /* his head, up out of the open top and far too big for the tube */
    head(ctx,cx,fillTop-H*0.062,W*0.074,FUR[3],1.42);

    /* the glass over the top of him: a highlight down one side, a soft
       tint, then the outline and the rim */
    ctx.save();
    glass(); ctx.closePath(); ctx.clip();
    ctx.fillStyle='rgba(190,225,255,.13)';
    ctx.fillRect(cx-hw,rimY,hw*2,floorY-rimY);
    ctx.fillStyle='rgba(255,255,255,.30)';
    ctx.fillRect(cx-hw*0.72,rimY,hw*0.34,floorY-rimY);
    ctx.restore();

    ctx.strokeStyle='rgba(198,228,255,.80)'; ctx.lineWidth=2.6;
    ctx.lineJoin='round'; ctx.lineCap='round';
    glass(); ctx.stroke();
    /* the rolled lip at the mouth of the tube */
    ctx.lineWidth=3.4;
    ctx.beginPath();
    ctx.ellipse(cx,rimY,hw*1.12,hw*0.30,0,0,7);
    ctx.stroke();
  }

  /* On a Roll: the roll seen as the cylinder it is, the sheet coming off it,
     and the cat who did this looking pleased about it. */
  function artRoll(ctx,W,H){
    const bx=W*0.66, capY=H*0.17, rx=W*0.105, ry=H*0.075;
    const bodyTop=capY, bodyBot=H*0.70;
    const PAPER='#f3ecd9', SHADE='#dccca1';

    /* the body of the roll, with the shading that makes it read round */
    ctx.fillStyle=PAPER;
    ctx.fillRect(bx-rx,bodyTop,rx*2,bodyBot-bodyTop);
    const g=ctx.createLinearGradient(bx-rx,0,bx+rx,0);
    g.addColorStop(0,'rgba(0,0,0,.30)');
    g.addColorStop(0.5,'rgba(255,255,255,.10)');
    g.addColorStop(1,'rgba(0,0,0,.30)');
    ctx.fillStyle=g; ctx.fillRect(bx-rx,bodyTop,rx*2,bodyBot-bodyTop);
    /* the perforations, and the one square that matters */
    ctx.strokeStyle='rgba(20,24,48,.20)'; ctx.lineWidth=1.4;
    for(let i=1;i<4;i++){
      const y=bodyTop+(bodyBot-bodyTop)*i/4;
      ctx.beginPath(); ctx.moveTo(bx-rx,y); ctx.quadraticCurveTo(bx,y+6,bx+rx,y); ctx.stroke();
    }
    const tY=bodyTop+(bodyBot-bodyTop)*0.52;
    ctx.fillStyle='#ffd88a';
    ctx.beginPath();
    ctx.moveTo(bx-rx,tY-16); ctx.quadraticCurveTo(bx,tY-10,bx+rx,tY-16);
    ctx.lineTo(bx+rx,tY+16); ctx.quadraticCurveTo(bx,tY+22,bx-rx,tY+16);
    ctx.closePath(); ctx.fill();
    /* the star on it */
    ctx.fillStyle=INK;
    ctx.beginPath();
    for(let i=0;i<10;i++){
      const a=-Math.PI/2+i*Math.PI/5, r=i%2?5:12;
      ctx.lineTo(bx+Math.cos(a)*r, tY+Math.sin(a)*r);
    }
    ctx.closePath(); ctx.fill();
    /* the selector sitting on it */
    ctx.strokeStyle='#fff'; ctx.lineWidth=2.4;
    ctx.strokeRect(bx-rx,tY-15,rx*2,30);

    /* the end cap: the spiral that says this is a roll and not a pipe */
    ctx.save();
    ctx.beginPath(); ctx.ellipse(bx,capY,rx,ry,0,0,7); ctx.clip();
    ctx.fillStyle=PAPER; ctx.fillRect(bx-rx,capY-ry,rx*2,ry*2);
    ctx.strokeStyle='#b8a06a'; ctx.lineWidth=Math.max(1,rx*0.10);
    for(let i=0;i<4;i++){ ctx.beginPath(); ctx.ellipse(bx,capY,rx*(0.34+i*0.20),ry*(0.34+i*0.20),0,0,7); ctx.stroke(); }
    ctx.fillStyle='#8a7d55'; ctx.beginPath(); ctx.ellipse(bx,capY,rx*0.26,ry*0.26,0,0,7); ctx.fill();
    ctx.restore();
    ctx.strokeStyle='rgba(20,24,48,.32)'; ctx.lineWidth=1.6;
    ctx.beginPath(); ctx.ellipse(bx,capY,rx,ry,0,0,7); ctx.stroke();

    /* the sheet coming off the bottom, and the folded heap it lands in */
    ctx.fillStyle=PAPER;
    ctx.beginPath();
    ctx.moveTo(bx-rx,bodyBot);
    ctx.quadraticCurveTo(bx-rx+7,H*0.80,bx-rx-2,H*0.885);
    ctx.lineTo(bx+rx-2,H*0.885);
    ctx.quadraticCurveTo(bx+rx+7,H*0.80,bx+rx,bodyBot);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(20,24,48,.18)'; ctx.lineWidth=1.2; ctx.stroke();
    for(let i=0;i<5;i++){
      const y=H*0.885+i*5.2, w=rx*(1.02+i*0.05), sk=(i%2?1:-1)*w*0.09;
      ctx.fillStyle=i%2?PAPER:SHADE;
      ctx.beginPath();
      ctx.moveTo(bx-w+sk,y+5); ctx.lineTo(bx+w+sk,y+5);
      ctx.lineTo(bx+w-sk,y); ctx.lineTo(bx-w-sk,y);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle='rgba(20,24,48,.16)'; ctx.lineWidth=1; ctx.stroke();
    }

    /* the culprit, reaching for the roll */
    const cx=W*0.24, cy=H*0.70, r=40, fur=FUR[3];
    ctx.fillStyle=fur;
    ctx.beginPath(); ctx.ellipse(cx,cy+r*0.34,r*0.86,r*0.70,0,0,7); ctx.fill();
    ctx.strokeStyle=fur; ctx.lineWidth=r*0.17; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(cx-r*0.80,cy+r*0.50);
    ctx.quadraticCurveTo(cx-r*1.40,cy+r*0.16,cx-r*1.20,cy-r*0.36); ctx.stroke();
    /* the paw up on the paper */
    ctx.lineWidth=r*0.16;
    ctx.beginPath(); ctx.moveTo(cx+r*0.60,cy-r*0.12);
    ctx.quadraticCurveTo(bx-rx*1.5,cy-r*0.70,bx-rx-4,tY+18); ctx.stroke();
    ctx.fillStyle=fur; ctx.beginPath(); ctx.arc(bx-rx-4,tY+18,r*0.15,0,7); ctx.fill();
    head(ctx,cx+r*0.30,cy-r*0.52,r*0.50,fur,1.36);
  }

  /* Hat in the Cat: a cat with the lens over it, hat showing through. */
  function artHats(ctx,W,H){
    const cx=W*0.44, cy=H*0.62, r=Math.min(W,H)*0.30;
    ctx.fillStyle=FUR[4];
    ctx.beginPath(); ctx.ellipse(cx,cy+r*0.55,r*1.15,r*0.92,0,0,7); ctx.fill();
    head(ctx,cx,cy-r*0.42,r*0.72,FUR[4],1.42);
    const lx=W*0.70, ly=H*0.62, lr=Math.min(W,H)*0.20;
    ctx.save();
    ctx.beginPath(); ctx.arc(lx,ly,lr,0,7); ctx.clip();
    ctx.fillStyle='#071a22';
    ctx.beginPath(); ctx.ellipse(cx,cy+r*0.55,r*1.15,r*0.92,0,0,7); ctx.fill();
    ctx.strokeStyle='rgba(141,240,216,.10)'; ctx.lineWidth=1;
    for(let y=ly-lr;y<ly+lr;y+=4){ ctx.beginPath(); ctx.moveTo(lx-lr,y); ctx.lineTo(lx+lr,y); ctx.stroke(); }
    /* a top hat, drawn the way the lens draws it */
    const hr=lr*0.52, hx=lx-lr*0.10, hy=ly+lr*0.05;
    const path=()=>{ ctx.beginPath();
      ctx.moveTo(hx-hr,hy+hr*.44); ctx.lineTo(hx+hr,hy+hr*.44); ctx.lineTo(hx+hr,hy+hr*.22);
      ctx.lineTo(hx+hr*.52,hy+hr*.22); ctx.lineTo(hx+hr*.52,hy-hr*.98);
      ctx.lineTo(hx-hr*.52,hy-hr*.98); ctx.lineTo(hx-hr*.52,hy+hr*.22);
      ctx.lineTo(hx-hr,hy+hr*.22); ctx.closePath();
      ctx.moveTo(hx-hr*.52,hy-hr*.34); ctx.lineTo(hx+hr*.52,hy-hr*.34); };
    ctx.lineJoin='round'; ctx.lineCap='round';
    ctx.strokeStyle='rgba(141,240,216,.22)'; ctx.lineWidth=Math.max(5,hr*.30); path(); ctx.stroke();
    ctx.fillStyle='rgba(141,240,216,.20)'; path(); ctx.fill();
    ctx.strokeStyle='#a9f7e4'; ctx.lineWidth=Math.max(1.7,hr*.11); path(); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle='#ffd88a'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(lx,ly,lr,0,7); ctx.stroke();
    ctx.strokeStyle='rgba(255,216,138,.30)'; ctx.lineWidth=9;
    ctx.beginPath(); ctx.arc(lx,ly,lr+5,0,7); ctx.stroke();
  }

  /* Catastrophe: a cat coming apart on a shelf, with the crockery on its way
     to the floor. */
  function artChaos(ctx,W,H){
    const floorY=H*0.86;
    ctx.fillStyle='#1b2040'; ctx.fillRect(0,floorY,W,H-floorY);
    ctx.strokeStyle='#2a2f52'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(0,floorY); ctx.lineTo(W,floorY); ctx.stroke();
    ctx.fillStyle='#2f3560';
    ctx.fillRect(W*0.06,H*0.40,W*0.34,8); ctx.fillRect(W*0.58,H*0.30,W*0.34,8);
    /* things in the air */
    const flying=[[0.30,0.60,'#7dd8ff',9],[0.46,0.34,'#ffd88a',7],[0.62,0.62,'#8fe3b0',8],
                  [0.20,0.24,'#ff8fd0',6],[0.80,0.55,'#b48bff',8]];
    for(const [fx,fy,col,r] of flying){
      ctx.fillStyle=col; ctx.beginPath(); ctx.arc(W*fx,H*fy,r,0,7); ctx.fill();
    }
    ctx.fillStyle='#3b4470';
    for(let i=0;i<26;i++){ const a=(i*2.7)%7;
      ctx.save(); ctx.translate(W*(0.12+0.76*((i*13)%17)/17),H*(0.20+0.62*((i*7)%13)/13));
      ctx.rotate(a); ctx.fillRect(-3,-1.6,6,3.2); ctx.restore(); }
    /* the cat that started it, mid-panic */
    const cx=W*0.40, cy=H*0.30, r=26, fur=FUR[4];
    ctx.fillStyle=fur; ctx.beginPath();
    for(let i=0;i<=26;i++){ const a=(i/26)*7, sp=i%2?1.30:0.95;
      const x=cx+Math.cos(a)*r*0.92*sp, y=cy+Math.sin(a)*r*0.72*sp;
      i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle=FUR[4]; ctx.lineWidth=5; ctx.lineCap='round';
    for(const [dx,dy] of [[-0.9,0.9],[-0.3,1.2],[0.4,1.15],[1.0,0.8]]){
      ctx.beginPath(); ctx.moveTo(cx+dx*r*0.5,cy+dy*r*0.3);
      ctx.lineTo(cx+dx*r*1.15,cy+dy*r*0.85); ctx.stroke(); }
    head(ctx,cx+r*0.5,cy-r*0.5,r*0.55,fur,1.3);
    ctx.strokeStyle='rgba(255,216,138,.8)'; ctx.lineWidth=2.5;
    for(let i=0;i<6;i++){ const a=(i/6)*7;
      ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*r*1.5,cy+Math.sin(a)*r*1.25);
      ctx.lineTo(cx+Math.cos(a)*r*1.95,cy+Math.sin(a)*r*1.6); ctx.stroke(); }
  }

  /* Static Cats: a charged cat with the balloons already clinging to it.
     The spikes are the same trick as artChaos — alternate vertices pushed
     out — because in both games the puffed silhouette is the whole read. */
  function artStatic(ctx,W,H){
    const cx=W*0.40, cy=H*0.60, r=30, fur=FUR[3];
    /* the field it sits in */
    const g=ctx.createRadialGradient(cx,cy,r*0.5,cx,cy,r*3.1);
    g.addColorStop(0,'rgba(125,216,255,.22)');
    g.addColorStop(1,'rgba(125,216,255,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,r*3.1,0,7); ctx.fill();
    /* balloons, three on strings and two still loose */
    const tied=[[0.30,0.20,'#ff8fd0'],[0.44,0.13,'#7dd8ff'],[0.57,0.22,'#ffd88a']];
    ctx.strokeStyle='rgba(205,212,245,.4)'; ctx.lineWidth=1.6;
    for(const [fx,fy] of tied){
      ctx.beginPath(); ctx.moveTo(W*fx,H*fy+18); ctx.lineTo(cx,cy-r*0.3); ctx.stroke();
    }
    const all=tied.concat([[0.78,0.34,'#b48bff'],[0.88,0.66,'#8fe3b0']]);
    for(const [fx,fy,col] of all){
      const x=W*fx, y=H*fy;
      ctx.fillStyle=col; ctx.beginPath(); ctx.ellipse(x,y,14,17,0,0,7); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.35)';
      ctx.beginPath(); ctx.ellipse(x-5,y-6,3.4,4.8,-0.5,0,7); ctx.fill();
    }
    /* the cat, fur fully up */
    ctx.fillStyle=fur; ctx.beginPath();
    for(let i=0;i<=26;i++){ const a=(i/26)*7, sp=i%2?1.42:0.95;
      const x=cx+Math.cos(a)*r*0.92*sp, y=cy+Math.sin(a)*r*0.72*sp;
      i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
    ctx.closePath(); ctx.fill();
    /* tail straight up, which is the tell */
    ctx.strokeStyle=FUR[3]; ctx.lineWidth=6; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(cx-r*0.8,cy+r*0.1);
    ctx.quadraticCurveTo(cx-r*1.5,cy-r*0.5,cx-r*1.35,cy-r*1.3); ctx.stroke();
    ctx.lineWidth=5;
    for(const [dx,dy] of [[-0.9,0.9],[-0.3,1.2],[0.4,1.15],[1.0,0.8]]){
      ctx.beginPath(); ctx.moveTo(cx+dx*r*0.5,cy+dy*r*0.3);
      ctx.lineTo(cx+dx*r*1.1,cy+dy*r*0.9); ctx.stroke(); }
    head(ctx,cx+r*0.5,cy-r*0.5,r*0.55,fur,1.35);
    /* arcs crawling off it */
    ctx.strokeStyle='rgba(125,216,255,.85)'; ctx.lineWidth=2.4;
    for(let i=0;i<7;i++){ const a=(i/7)*7+0.4;
      ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*r*1.45,cy+Math.sin(a)*r*1.2);
      ctx.lineTo(cx+Math.cos(a+0.3)*r*1.9,cy+Math.sin(a+0.3)*r*1.55); ctx.stroke(); }
  }

  /* Chonk: an enormous cat, and the hole taking a cow off him. */
  function artChonk(ctx,W,H){
    const hx=W*0.74, hy=H*0.52, hr=26;
    /* the hole's reach, drawn as the fall-off it actually is */
    const g=ctx.createRadialGradient(hx,hy,hr,hx,hy,hr*3.4);
    g.addColorStop(0,'rgba(180,139,255,.30)');
    g.addColorStop(1,'rgba(180,139,255,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(hx,hy,hr*3.4,0,7); ctx.fill();

    /* the cow, mid-swallow: wound round, squeezed thin, most of the way gone */
    ctx.save();
    ctx.translate(hx-hr*1.15,hy-hr*0.55);
    ctx.rotate(-0.62);
    ctx.fillStyle='#f2d9c4';
    ctx.beginPath(); ctx.ellipse(0,0,26,7,0,0,7); ctx.fill();
    ctx.fillStyle='rgba(20,24,48,.20)';
    ctx.beginPath(); ctx.ellipse(4,-1,7,3,0,0,7); ctx.fill();
    ctx.restore();
    /* and the strand it leaves behind */
    ctx.strokeStyle='rgba(242,217,196,.5)'; ctx.lineWidth=2; ctx.lineCap='round';
    ctx.beginPath(); ctx.arc(hx,hy,hr*1.75,-2.5,-0.9); ctx.stroke();
    ctx.strokeStyle='rgba(242,217,196,.22)'; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.arc(hx,hy,hr*2.35,-2.2,-1.2); ctx.stroke();

    /* the hole itself: black, with a hot rim */
    ctx.fillStyle='#05060c'; ctx.beginPath(); ctx.arc(hx,hy,hr,0,7); ctx.fill();
    ctx.strokeStyle='rgba(255,216,138,.85)'; ctx.lineWidth=2.6;
    ctx.beginPath(); ctx.arc(hx,hy,hr,0,7); ctx.stroke();

    /* the cat, far too big, leaning away from it */
    const cx=W*0.30, cy=H*0.60, r=52, fur=FUR[1];
    ctx.fillStyle=fur;
    ctx.beginPath(); ctx.ellipse(cx,cy+r*0.30,r*0.98,r*0.76,0,0,7); ctx.fill();
    /* stubby legs, lost in the bulk of him */
    for(const lx of [-0.52,-0.18,0.18,0.52]){
      ctx.beginPath();
      ctx.ellipse(cx+lx*r*0.92,cy+r*0.94,r*0.13,r*0.16,0,0,7); ctx.fill();
    }
    /* tail */
    ctx.strokeStyle=fur; ctx.lineWidth=r*0.17; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(cx-r*0.92,cy+r*0.38);
    ctx.quadraticCurveTo(cx-r*1.55,cy+r*0.10,cx-r*1.38,cy-r*0.48); ctx.stroke();
    head(ctx,cx+r*0.44,cy-r*0.36,r*0.46,fur,1.34);
  }

  /* Catwalk: a winding beam climbing off toward the rooftops, with the cat
     mid-teeter partway up it. */
  function artCatwalk(ctx,W,H){
    const g=ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#3a5a8c'); g.addColorStop(1,'#8fb8dc');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

    /* chimneys, far background */
    ctx.fillStyle='rgba(36,52,74,.5)';
    ctx.fillRect(W*0.78,H*0.14,W*0.05,H*0.20);
    ctx.fillRect(W*0.762,H*0.11,W*0.086,H*0.045);
    ctx.fillRect(W*0.06,H*0.08,W*0.042,H*0.15);
    ctx.fillRect(W*0.045,H*0.055,W*0.072,H*0.038);

    /* a bird, the same trick as a wave: two shallow arcs */
    ctx.strokeStyle='rgba(20,24,48,.4)'; ctx.lineWidth=2.2;
    ctx.beginPath();
    ctx.moveTo(W*0.56,H*0.12);
    ctx.quadraticCurveTo(W*0.585,H*0.085,W*0.61,H*0.12);
    ctx.quadraticCurveTo(W*0.635,H*0.085,W*0.66,H*0.12);
    ctx.stroke();

    /* the beam: a winding ribbon built from a centerline and a half-width at
       each point, filled as one polygon exactly the way the game draws it */
    const pts=[
      [0.14,0.95,0.115],[0.16,0.80,0.105],[0.24,0.66,0.095],
      [0.34,0.58,0.088],[0.30,0.42,0.078],[0.20,0.32,0.068],
      [0.26,0.18,0.06],[0.42,0.10,0.052],[0.60,0.05,0.046]
    ];
    const left=[],right=[];
    for(const [fx,fy,fhw] of pts){ left.push([fx-fhw,fy]); right.push([fx+fhw,fy]); }
    ctx.beginPath();
    ctx.moveTo(left[0][0]*W,left[0][1]*H);
    for(const [x,y] of left) ctx.lineTo(x*W,y*H);
    for(let i=right.length-1;i>=0;i--) ctx.lineTo(right[i][0]*W,right[i][1]*H);
    ctx.closePath();
    const bg=ctx.createLinearGradient(0,0,W,0);
    bg.addColorStop(0,'#8a7860'); bg.addColorStop(0.5,'#c7ab86'); bg.addColorStop(1,'#8a7860');
    ctx.fillStyle=bg; ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.25)'; ctx.lineWidth=1.6; ctx.stroke();

    /* plank seams, so it reads as a beam rather than a ribbon of paper */
    ctx.strokeStyle='rgba(0,0,0,.18)'; ctx.lineWidth=1.4;
    for(let i=1;i<pts.length-1;i++){
      const [fx,fy,fhw]=pts[i];
      ctx.beginPath();
      ctx.moveTo((fx-fhw+0.01)*W,fy*H);
      ctx.lineTo((fx+fhw-0.01)*W,fy*H);
      ctx.stroke();
    }

    /* the cat, leaning into a teeter partway up */
    const cx=W*0.27, cy=H*0.545, r=30, fur='#e2793b';
    ctx.save();
    ctx.translate(cx,cy);
    ctx.rotate(-0.18);
    ctx.fillStyle=fur;
    ctx.beginPath(); ctx.ellipse(0,4,r*0.55,r*0.38,0,0,7); ctx.fill();
    ctx.fillStyle='#f7dcc0';
    ctx.beginPath(); ctx.ellipse(0,7,r*0.3,r*0.22,0,0,7); ctx.fill();
    ctx.strokeStyle=fur; ctx.lineWidth=6; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-r*0.5,2); ctx.quadraticCurveTo(-r*1.05,-6,-r*0.85,-r*0.7); ctx.stroke();
    ctx.restore();
    head(ctx,cx+r*0.42,cy-r*0.32,r*0.42,fur,1.4);
  }

  const ART={cats:artCats,fits:artFits,hats:artHats,chaos:artChaos,static:artStatic,
             chonk:artChonk,roll:artRoll,catwalk:artCatwalk};
  document.querySelectorAll('canvas.tile-art').forEach(cv=>{
    const ctx=cv.getContext('2d'), W=cv.width, H=cv.height;
    ctx.clearRect(0,0,W,H);
    (ART[cv.dataset.art]||artFits)(ctx,W,H);
  });
})();
