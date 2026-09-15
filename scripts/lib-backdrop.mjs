import sharp from 'sharp';

/* Flood fill inward from the frame edge, keeping only pixels that
   still look like the backdrop: bright and near-neutral. Connectivity
   is what protects the product -- a pale patch inside the artwork is
   never reached, because the fill cannot cross the coloured edge. */
export async function liftBackdrop(input, opts = {}) {
  const {
    minLum = 96,      // shadows on the backdrop stay above this
    maxSat = 46,      // backdrop is near-neutral; artwork is not
    maxDist = 118,    // and never far from the sampled backdrop colour
    feather = 1.0,
  } = opts;

  const work = sharp(input).rotate()
    .resize(1400, 1400, { fit: 'inside', withoutEnlargement: true });
  const { data, info } = await work.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  const R = (i) => data[i * 3], G = (i) => data[i * 3 + 1], B = (i) => data[i * 3 + 2];
  const lum = (i) => (R(i) + G(i) + B(i)) / 3;
  const sat = (i) => Math.max(R(i), G(i), B(i)) - Math.min(R(i), G(i), B(i));

  // backdrop reference: median of the frame edge
  const edge = [];
  for (let x = 0; x < w; x++) { edge.push(x); edge.push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { edge.push(y * w); edge.push(y * w + w - 1); }
  const med = (k) => {
    const v = edge.map((i) => data[i * 3 + k]).sort((a, b) => a - b);
    return v[v.length >> 1];
  };
  const ref = [med(0), med(1), med(2)];
  const dist = (i) =>
    Math.hypot(R(i) - ref[0], G(i) - ref[1], B(i) - ref[2]);

  const looksBackdrop = (i) =>
    lum(i) >= minLum && sat(i) <= maxSat && dist(i) <= maxDist;

  const isBg = new Uint8Array(w * h);
  const stack = [];
  for (const i of edge) if (!isBg[i] && looksBackdrop(i)) { isBg[i] = 1; stack.push(i); }

  while (stack.length) {
    const i = stack.pop();
    const x = i % w, y = (i / w) | 0;
    if (x > 0)     { const j = i - 1; if (!isBg[j] && looksBackdrop(j)) { isBg[j] = 1; stack.push(j); } }
    if (x < w - 1) { const j = i + 1; if (!isBg[j] && looksBackdrop(j)) { isBg[j] = 1; stack.push(j); } }
    if (y > 0)     { const j = i - w; if (!isBg[j] && looksBackdrop(j)) { isBg[j] = 1; stack.push(j); } }
    if (y < h - 1) { const j = i + w; if (!isBg[j] && looksBackdrop(j)) { isBg[j] = 1; stack.push(j); } }
  }

  /* Label the foreground, then decide what to discard. The fill can leak
     into bright, low-saturation highlights in the artwork and split the
     product into hundreds of islands; deleting those by size alone punches
     holes straight through the picture. So size only condemns a piece that
     also sits OUTSIDE the product -- a crumb on the sheet, a shadow in a
     corner. Anything within the main shape is artwork and is kept. */
  const label = new Int32Array(w * h).fill(-1);
  const sizes = [];
  const box = [];
  const mean = [];
  for (let s = 0; s < w * h; s++) {
    if (isBg[s] || label[s] !== -1) continue;
    const id = sizes.length;
    let n = 0, x0 = w, y0 = h, x1 = -1, y1 = -1, sr = 0, sg = 0, sb = 0;
    const q = [s];
    label[s] = id;
    while (q.length) {
      const i = q.pop(); n++;
      sr += R(i); sg += G(i); sb += B(i);
      const x = i % w, y = (i / w) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0     && !isBg[i - 1] && label[i - 1] === -1) { label[i - 1] = id; q.push(i - 1); }
      if (x < w - 1 && !isBg[i + 1] && label[i + 1] === -1) { label[i + 1] = id; q.push(i + 1); }
      if (y > 0     && !isBg[i - w] && label[i - w] === -1) { label[i - w] = id; q.push(i - w); }
      if (y < h - 1 && !isBg[i + w] && label[i + w] === -1) { label[i + w] = id; q.push(i + w); }
    }
    sizes.push(n);
    box.push([x0, y0, x1, y1]);
    mean.push([sr / n, sg / n, sb / n]);
  }

  const totalFg = sizes.reduce((a, b) => a + b, 0);
  const main = sizes.indexOf(Math.max(...sizes));
  const [mx0, my0, mx1, my1] = box[main];
  const inside = (b) => b[0] >= mx0 && b[1] >= my0 && b[2] <= mx1 && b[3] <= my1;
  const minKeep = totalFg * 0.02;
  /* A patch of sheet too bright for the fill to claim is still sheet. Judge
     it by its own colour, but only outside the product -- inside, a pale
     patch is artwork. */
  const sheetLike = (i) => {
    const [r, g, b] = mean[i];
    const l = (r + g + b) / 3;
    const sa = Math.max(r, g, b) - Math.min(r, g, b);
    return l >= minLum && sa <= maxSat &&
           Math.hypot(r - ref[0], g - ref[1], b - ref[2]) <= 150;
  };
  const keep = sizes.map((n, i) => {
    if (i === main) return true;
    if (inside(box[i])) return true;      // artwork within the product
    if (sheetLike(i)) return false;       // a stray piece of the backdrop
    return n >= minKeep;                  // a crumb on the table
  });
  for (let i = 0; i < w * h; i++) if (!isBg[i] && !keep[label[i]]) isBg[i] = 1;

  /* Reconstruct the product as a solid shape.

     Colour alone cannot always separate artwork from sheet: a pale, washed
     highlight inside a pack really is the same brightness and saturation as
     the grey card, so the fill walks in and shreds the picture. But every
     product photographed here is one convex object -- a pack, a box, a
     blister -- so its silhouette is its convex hull. Taking the hull of the
     main shape and filling it discards every interior leak at once, without
     needing to classify those pixels correctly in the first place. */
  {
    const rowMin = new Int32Array(h).fill(-1);
    const rowMax = new Int32Array(h).fill(-1);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (isBg[i] || label[i] !== main) continue;
        if (rowMin[y] < 0) rowMin[y] = x;
        rowMax[y] = x;
      }
    }
    const pts = [];
    for (let y = 0; y < h; y++) {
      if (rowMin[y] >= 0) { pts.push([rowMin[y], y]); pts.push([rowMax[y], y]); }
    }
    if (pts.length >= 3) {
      pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const cross = (o, a, b) =>
        (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const half = (src) => {
        const out = [];
        for (const pt of src) {
          while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], pt) <= 0) out.pop();
          out.push(pt);
        }
        return out;
      };
      const hull = half(pts).slice(0, -1).concat(half([...pts].reverse()).slice(0, -1));

      // scanline-fill the hull polygon
      const spanMin = new Int32Array(h).fill(w);
      const spanMax = new Int32Array(h).fill(-1);
      for (let k = 0; k < hull.length; k++) {
        const [x1, y1] = hull[k];
        const [x2, y2] = hull[(k + 1) % hull.length];
        if (y1 === y2) {
          const y = y1;
          spanMin[y] = Math.min(spanMin[y], x1, x2);
          spanMax[y] = Math.max(spanMax[y], x1, x2);
          continue;
        }
        const step = y2 > y1 ? 1 : -1;
        for (let y = y1; y !== y2 + step; y += step) {
          const x = Math.round(x1 + ((x2 - x1) * (y - y1)) / (y2 - y1));
          if (y < 0 || y >= h) continue;
          if (x < spanMin[y]) spanMin[y] = x;
          if (x > spanMax[y]) spanMax[y] = x;
        }
      }
      for (let y = 0; y < h; y++) {
        for (let x = Math.max(0, spanMin[y]); x <= Math.min(w - 1, spanMax[y]); x++) {
          isBg[y * w + x] = 0;
        }
      }
    }
  }

  /* The hull repairs the inside but overshoots the outside: where the product
     sits at a slight angle, the straight hull edge swallows a wedge of sheet
     (the tan bar under a tilted box). So sweep in from the border once more,
     this time with a much stricter test -- only unmistakable sheet, nothing
     merely pale. That shaves the overshoot back to the product's real edge
     while leaving the interior repairs untouched, because the washed
     highlights that caused the leaks are not this close to the sheet colour. */
  {
    const tightDist = 60, tightSat = 32;
    const tight = (i) =>
      lum(i) >= minLum && sat(i) <= tightSat && dist(i) <= tightDist;
    const st2 = [];
    for (const i of edge) if (!isBg[i] && tight(i)) { isBg[i] = 1; st2.push(i); }
    while (st2.length) {
      const i = st2.pop();
      const x = i % w, y = (i / w) | 0;
      if (x > 0)     { const j = i - 1; if (!isBg[j] && tight(j)) { isBg[j] = 1; st2.push(j); } }
      if (x < w - 1) { const j = i + 1; if (!isBg[j] && tight(j)) { isBg[j] = 1; st2.push(j); } }
      if (y > 0)     { const j = i - w; if (!isBg[j] && tight(j)) { isBg[j] = 1; st2.push(j); } }
      if (y < h - 1) { const j = i + w; if (!isBg[j] && tight(j)) { isBg[j] = 1; st2.push(j); } }
    }
  }

  const alpha = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = isBg[i] ? 0 : 255;
  // blur() promotes a single-channel raw image to sRGB, so force it
  // back to one channel before joining -- otherwise joinChannel reads
  // the wrong stride and the backdrop ghosts instead of clearing.
  const soft = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } })
    .blur(feather).toColourspace('b-w').raw().toBuffer();

  const cut = await sharp(data, { raw: { width: w, height: h, channels: 3 } })
    .joinChannel(soft, { raw: { width: w, height: h, channels: 1 } })
    .png().toBuffer();

  /* Solidity: how much of its own bounding box the kept shape fills.
     A pack or a box is close to solid. A matte that has eaten into the
     artwork is ragged and scores low, which is the signal that this
     photo is not safe to cut out. */
  let kept = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let i = 0; i < w * h; i++) {
    if (isBg[i]) continue;
    kept++;
    const x = i % w, y = (i / w) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const bbox = kept ? (x1 - x0 + 1) * (y1 - y0 + 1) : 1;
  return {
    cut,
    covered: kept / (w * h),
    solidity: kept / bbox,
    pieces: keep.filter(Boolean).length,
  };
}

