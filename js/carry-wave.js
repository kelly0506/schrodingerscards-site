/* ============================================================
   "What We Carry" — wave function collapse

   Each tile's description sits under a pair of superposed waves.
   Hovering (or tapping, or focusing) is the measurement: the two
   curves flatten into a single line, that line blooms and goes,
   and the text snaps in.

   Progressive enhancement: the markup ships with the text plainly
   visible. This script adds .wave-on, which is what hides it. If
   the script never runs, the section reads exactly as it did
   before — no blank tiles, and nothing hidden from search engines.
   The text also stays in the DOM at all times, so screen readers
   get it regardless of the animation.
   ============================================================ */
(() => {
  const grid = document.getElementById('carry-grid');
  if (!grid) return;

  const cards = [...grid.querySelectorAll('.carry-card')]
    .map((card) => {
      const canvas = card.querySelector('canvas');
      if (!canvas) return null;
      return {
        card,
        canvas,
        ctx: canvas.getContext('2d'),
        phase: Math.random() * Math.PI * 2,
        drift: 0.82 + Math.random() * 0.36,   // each tile evolves at its own rate
        p: 0,                                 // raw progress, 0 = superposed
        amp: 1,                               // wave amplitude
        lineAlpha: 1,                         // line opacity, independent of amplitude
        flash: 0,
        lastReveal: -1,
        measured: false
      };
    })
    .filter(Boolean);

  if (!cards.length) return;
  grid.classList.add('wave-on');

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- sizing ---------- */
  function size(c) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = c.canvas.getBoundingClientRect();
    if (!r.width) return;
    c.canvas.width = Math.round(r.width * dpr);
    c.canvas.height = Math.round(r.height * dpr);
    c.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.w = r.width;
    c.h = r.height;
  }
  const sizeAll = () => cards.forEach(size);
  sizeAll();
  addEventListener('resize', sizeAll);

  /* ---------- drawing ---------- */
  /* Three components summed. The beat between them is what stops it
     looking like a screensaver sine wave. */
  const PARTS = [
    { k: 0.052, s: 1.00, a: 1.00 },
    { k: 0.089, s: -0.58, a: 0.54 },
    { k: 0.137, s: 1.62, a: 0.29 }
  ];

  function draw(c, t) {
    const { ctx, h, w } = c;
    if (!w || c.lineAlpha <= 0.002) { if (w) ctx.clearRect(0, 0, w, h); return; }
    ctx.clearRect(0, 0, w, h);

    const mid = h * 0.46;
    const A = h * 0.30 * c.amp;
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#7dd8ff');
    g.addColorStop(1, '#b48bff');

    const at = (x) => PARTS.reduce((s, p) =>
      s + p.a * Math.sin(x * p.k + t * p.s * c.drift + c.phase), 0) / 1.83;

    if (c.amp > 0.01) {
      for (const [sign, alpha] of [[1, 0.14], [-1, 0.08]]) {
        ctx.beginPath();
        ctx.moveTo(0, mid);
        for (let x = 0; x <= w; x += 2) ctx.lineTo(x, mid + sign * at(x) * A);
        ctx.lineTo(w, mid);
        ctx.closePath();
        ctx.globalAlpha = alpha * c.amp * c.lineAlpha;
        ctx.fillStyle = g;
        ctx.fill();
      }
    }

    /* Two curves of near-equal weight, so they read as a pair oscillating
       around each other. As amplitude goes to zero they converge onto one
       line — and the opacity deliberately does NOT fall with it, so that
       line stays visible instead of quietly dissolving. */
    const boost = 1 + c.flash * 0.9;
    for (const [sign, alpha, width] of [[1, 0.90, 1.7], [-1, 0.62, 1.5]]) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 1.5) {
        const y = mid + sign * at(x) * A;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.globalAlpha = Math.min(1, alpha * c.lineAlpha * boost);
      ctx.strokeStyle = g;
      ctx.lineWidth = width * (1 + c.flash * 0.5);
      ctx.stroke();
    }

    if (c.flash > 0.002) {
      ctx.globalAlpha = c.flash * 0.5;
      ctx.fillStyle = g;
      ctx.fillRect(0, mid - 1.2, w, 2.4);
      ctx.globalAlpha = c.flash * 0.16;
      ctx.fillRect(0, mid - 5, w, 10);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- timing ----------
     Two beats. Up to MERGE the curves flatten into a single line while
     staying fully visible; after it, that line blooms and vanishes and
     the text snaps in. Nothing cross-fades. */
  const COLLAPSE_MS = 840;
  const RESTORE_MS = 900;
  const MERGE = 0.76;
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeOutQuint = (x) => 1 - Math.pow(1 - x, 5);

  let running = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => { running = es.some((e) => e.isIntersecting); },
      { threshold: 0 }).observe(grid);
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (running) {
      const t = now / 1000;
      for (const c of cards) {
        const target = c.measured ? 1 : 0;
        const dur = (c.measured ? COLLAPSE_MS : RESTORE_MS) / 1000;
        if (c.p !== target) {
          const step = dt / dur;
          c.p = c.measured ? Math.min(1, c.p + step) : Math.max(0, c.p - step);
        }

        c.amp = 1 - easeInOut(clamp01(c.p / MERGE));
        const after = clamp01((c.p - MERGE) / (1 - MERGE));
        c.lineAlpha = 1 - easeOutQuint(after);
        c.flash = c.p <= MERGE ? 0 : Math.sin(clamp01(after / 0.85) * Math.PI);

        const reveal = easeOutQuint(after);
        if (reveal !== c.lastReveal) {
          c.card.style.setProperty('--reveal', reveal.toFixed(3));
          c.card.style.setProperty('--reveal-blur', ((1 - reveal) * 3.5).toFixed(2) + 'px');
          c.card.style.setProperty('--reveal-y', ((1 - reveal) * 3).toFixed(2) + 'px');
          c.lastReveal = reveal;
        }
        draw(c, reduced ? 0 : t);
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------- interaction ---------- */
  function setMeasured(c, on) {
    if (c.measured === on) return;
    c.measured = on;
    c.card.classList.toggle('measured', on);
    if (reduced) c.p = on ? 1 : 0;
  }

  cards.forEach((c) => {
    if (canHover) {
      c.card.addEventListener('pointerenter', () => setMeasured(c, true));
      c.card.addEventListener('pointerleave', () => setMeasured(c, false));
    }
    c.card.addEventListener('focus', () => setMeasured(c, true));
    c.card.addEventListener('blur', () => setMeasured(c, false));
    /* Tap always works, so touch screens are not left out. */
    c.card.addEventListener('click', () => setMeasured(c, !c.measured));
    c.card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMeasured(c, !c.measured); }
    });
  });
})();
