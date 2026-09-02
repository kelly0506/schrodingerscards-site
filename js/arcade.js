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

  /* If I Fits I Sits: a cat that has taken the shape of the jar it is in. */
  function artFits(ctx,W,H){
    const cx=W*0.5, floorY=H*0.90, hh=H*0.60, hw=W*0.15;
    const wall=t=>hw*(1-0.10*Math.max(0,t-0.86)*6);
    ctx.fillStyle=FUR[3];
    ctx.beginPath();
    for(let i=0;i<=40;i++){const t=i/40; ctx.lineTo(cx-wall(t), floorY-t*hh);}
    for(let i=40;i>=0;i--){const t=i/40; ctx.lineTo(cx+wall(t), floorY-t*hh);}
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(10,13,24,.28)'; ctx.lineWidth=2; ctx.stroke();
    /* paw pads pressed against the front */
    ctx.fillStyle='rgba(255,197,212,.9)';
    for(const s of [-1,1]){
      const px=cx+s*hw*0.42, py=floorY-hh*0.34;
      ctx.beginPath(); ctx.ellipse(px,py,7,5.6,0,0,7); ctx.fill();
      for(const [dx,dy] of [[-0.68,-0.50],[-0.22,-0.80],[0.22,-0.80],[0.68,-0.50]]){
        ctx.beginPath(); ctx.arc(px+dx*9,py+dy*9,2.4,0,7); ctx.fill(); }
    }
    head(ctx,cx,floorY-hh-6,30,FUR[3],1.42);
    ctx.strokeStyle='#3a4170'; ctx.lineWidth=3.2; ctx.lineJoin='round'; ctx.lineCap='round';
    ctx.beginPath();
    for(let i=40;i>=0;i--){const t=i/40,X=cx-wall(t),Y=floorY-t*hh; i===40?ctx.moveTo(X,Y):ctx.lineTo(X,Y);}
    for(let i=0;i<=40;i++){const t=i/40; ctx.lineTo(cx+wall(t), floorY-t*hh);}
    ctx.stroke();
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

  const ART={cats:artCats,fits:artFits,hats:artHats,chaos:artChaos,static:artStatic};
  document.querySelectorAll('canvas.tile-art').forEach(cv=>{
    const ctx=cv.getContext('2d'), W=cv.width, H=cv.height;
    ctx.clearRect(0,0,W,H);
    (ART[cv.dataset.art]||artFits)(ctx,W,H);
  });
})();
