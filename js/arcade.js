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

  document.querySelectorAll('canvas.tile-art').forEach(cv=>{
    const ctx=cv.getContext('2d'), W=cv.width, H=cv.height;
    ctx.clearRect(0,0,W,H);
    (cv.dataset.art==='cats' ? artCats : artFits)(ctx,W,H);
  });
})();
