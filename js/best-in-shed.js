/* ================= Best in Shed =================

   Five cats, one pageant, one clock each. The whole game is one canvas:
   the cats, the snarls, the woman heckling from the bottom of the screen
   and the judging sequence at the end are all drawn here rather than
   assembled out of images.

   Two things worth knowing before changing anything:

   - Every cat is parametric. Head, body, tail, ears, face and eyes come
     out of the entry in CATS, and the snarl positions are generated from
     that cat's own body ellipse. That is why the long cat spreads its
     snarls end to end and the round one clusters them, and it is why
     adding a sixth cat is a data change rather than a drawing job.

   - The score is deliberately invisible until the judging. Coat condition,
     bald patches and accessories all feed in quietly during play; the only
     number the player ever sees is the total at the very end, which is
     what goes to the shared board in js/leaderboard.js. */
(() => {
  'use strict';

  const W = 600, H = 640;
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

  /* ---------------- tools & snarls ---------------- */
  const TOOLS = {
    brush: { name: 'Wide brush', best: 'fluff', hint: 'Beats fluff', col: '#f0b46a', speed: 1.00, risk: 0.85, tol: 0.78 },
    comb:  { name: 'Fine comb',  best: 'mat',   hint: 'Beats mats',  col: '#b48bff', speed: 1.35, risk: 1.40, tol: 0.34 },
    mitt:  { name: 'Rubber mitt',best: 'burr',  hint: 'Beats burrs', col: '#7dd8ff', speed: 0.74, risk: 0.32, tol: 0.60 }
  };
  const TOOL_KEYS = ['brush', 'comb', 'mitt'];
  const SNARLS = {
    fluff: { label: 'Fluff', tool: 'brush', note: 'Loose and airy', col: '#f0b46a', core: '#efe2cc', edge: '#c9ab7e' },
    mat:   { label: 'Mat',   tool: 'comb',  note: 'Dense and felted', col: '#b48bff', core: '#7a5b9e', edge: '#3e2b58' },
    burr:  { label: 'Burr',  tool: 'mitt',  note: 'Full of debris', col: '#7dd8ff', core: '#6ba6c2', edge: '#2f5c72' }
  };
  const PRIZES = [
    { id: 'hat', name: 'Top hat' }, { id: 'bow', name: 'Bow tie' },
    { id: 'crown', name: 'Flower crown' }, { id: 'shades', name: 'Tiny shades' },
    { id: 'pearls', name: 'Pearls' }, { id: 'monocle', name: 'Monocle' },
    { id: 'tiara', name: 'Tiara' }, { id: 'bandana', name: 'Bandana' },
    { id: 'party', name: 'Party hat' }
  ];

  /* ---------------- the cast ----------------
     Every cat is a different silhouette. Snarl positions are generated from the
     body ellipse, so the shape genuinely changes how a round plays. */
  const CATS = [
    {
      name: 'Marmalade', breed: 'Orange tabby, allegedly',
      bio: 'Marmalade has been to one pageant before. He was disqualified for eating a rosette — not his rosette. He maintains that he won that day, and no amount of paperwork has changed his mind.',
      fact: 'Has never once landed on his feet. Has never stopped trying.',
      fact2: 'Considers the vacuum cleaner a personal rival. Has fought it four times and lost four times.',
      time: 45, count: 6, clusters: 1, depth: 2, spin: 0.55, heat: 0.40, retighten: 0, furLen: 11,
      mix: ['fluff','fluff','fluff','fluff','mat','burr'],
      coat: { base:'#f0b46a', deep:'#bd7c31', ear:'#d99a4c', belly:'#f6e3c4', stripe:'rgba(150,92,32,0.5)', tail:'#c98940', tailStripe:'#b06f2e', eye:'#8fce3f', line:'#6b3d16' },
      shape: { head:{x:300,y:250,rx:100,ry:92}, body:{x:300,y:414,rx:166,ry:132,rot:0.03},
               belly:{x:302,y:462,rx:92,ry:74}, ruff:null, stripes:5,
               tail:{x0:452,y0:478,cx:566,cy:470,x1:520,y1:348,w:36},
               ear:{len:88,spread:36,tilt:0.18}, face:{lr:24,rr:19,eyes:'googly',tongue:true,fang:true} }
    },
    {
      name: 'Biscuit', breed: 'Grey tabby, structurally',
      bio: 'Biscuit is not overweight, he is "in coat". He has been in coat since 2019. He navigates the house by leaning in a direction and waiting to see what happens.',
      fact: 'Once slept nineteen hours, woke up, looked at a wall, and went back to sleep.',
      fact2: 'Has a favourite square of carpet. Will not be moved from it. Has outlasted two sofas.',
      time: 45, count: 8, clusters: 2, depth: 2, spin: 0.85, heat: 0.44, retighten: 0, furLen: 12,
      mix: ['fluff','fluff','fluff','mat','mat','burr','burr','fluff'],
      coat: { base:'#b8bccd', deep:'#7d8296', ear:'#a6aabb', belly:'#e8ebf4', stripe:'rgba(62,68,90,0.5)', tail:'#a6aabb', tailStripe:'#6d7286', eye:'#f0b46a', line:'#3c4056' },
      shape: { head:{x:300,y:276,rx:88,ry:82}, body:{x:300,y:446,rx:206,ry:142,rot:0},
               belly:{x:300,y:492,rx:120,ry:80}, ruff:null, stripes:6,
               tail:{x0:492,y0:504,cx:556,cy:498,x1:540,y1:430,w:34},
               ear:{len:54,spread:32,tilt:0.1}, face:{lr:22,rr:22,eyes:'sleepy',tongue:true,fang:false} }
    },
    {
      name: 'Nutmeg', breed: 'Tuxedo, lengthwise',
      bio: 'Nutmeg is roughly the length of an ironing board and about twice as unhelpful. He does not enter rooms so much as slowly arrive in them, in stages, over the course of an afternoon.',
      fact: 'Nose to tail he measures 41 inches. Measured by attitude he is considerably longer.',
      fact2: 'Can open one specific kitchen cupboard and has never once shown interest in what is inside it.',
      time: 42, count: 9, clusters: 2, depth: 3, spin: 1.15, heat: 0.48, retighten: 0, furLen: 10,
      mix: ['mat','mat','fluff','fluff','burr','mat','fluff','burr','mat'],
      coat: { base:'#454b66', deep:'#272c42', ear:'#5a6180', belly:'#f2f3f8', stripe:'rgba(18,21,34,0.5)', tail:'#3a4059', tailStripe:'#1e2234', eye:'#8fce3f', line:'#121524' },
      shape: { head:{x:172,y:262,rx:88,ry:84}, body:{x:328,y:414,rx:226,ry:96,rot:-0.05},
               belly:{x:330,y:446,rx:170,ry:52}, ruff:null, stripes:4,
               tail:{x0:544,y0:404,cx:590,cy:330,x1:520,y1:268,w:28},
               ear:{len:78,spread:32,tilt:0.22}, face:{lr:24,rr:22,eyes:'slits',brow:'raised',tongue:false,fang:true} }
    },
    {
      name: 'Pickle', breed: 'Cream point, upright',
      bio: 'Pickle screams. Not at anything — Pickle screams at 4am at a patch of wall where nothing has ever happened. Three vets have found nothing wrong with him. The wall has been repainted twice.',
      fact: 'Holds the household record for consecutive nights spent inside a paper bag: eleven.',
      fact2: 'Once swept a full glass off a table while maintaining direct eye contact for nine seconds.',
      time: 40, count: 11, clusters: 3, depth: 3, spin: 1.5, heat: 0.52, retighten: 0, furLen: 9,
      mix: ['mat','burr','mat','fluff','mat','burr','fluff','mat','burr','fluff','mat'],
      coat: { base:'#eadfc9', deep:'#bda88a', ear:'#8a6a52', belly:'#fbf5e8', stripe:'rgba(140,110,80,0.4)', tail:'#8a6a52', tailStripe:'#6b4f3c', eye:'#7dd8ff', line:'#6b5540' },
      shape: { head:{x:300,y:212,rx:84,ry:82}, body:{x:300,y:428,rx:112,ry:150,rot:0.02},
               belly:{x:300,y:462,rx:70,ry:96}, ruff:null, stripes:3,
               tail:{x0:392,y0:500,cx:494,cy:452,x1:462,y1:318,w:20},
               ear:{len:124,spread:30,tilt:0.26}, face:{lr:28,rr:27,eyes:'terror',tongue:true,fang:true} }
    },
    {
      name: 'Duchess', breed: 'Silver longhair, four-time champion',
      bio: 'Duchess has won this pageant four times and has not been gracious about it once. She travels with her own cushion. She does not acknowledge the other four, and has never been photographed looking directly at a human being.',
      fact: 'Her registered show name is "Silverwind Moonlit Aristocrat of Ravensbourne". She answers to "oi".',
      fact2: 'Has been photographed roughly 1,400 times and is looking away in every single one.',
      time: 38, count: 12, clusters: 3, depth: 3, spin: 1.9, heat: 0.56, retighten: 0.035, furLen: 19,
      mix: ['mat','mat','burr','mat','burr','mat','fluff','mat','burr','mat','fluff','burr'],
      coat: { base:'#d8dae6', deep:'#9ba0b8', ear:'#c2c6d6', belly:'#f4f5fa', stripe:'rgba(110,116,142,0.42)', tail:'#c2c6d6', tailStripe:'#8b90a8', eye:'#b48bff', line:'#4a4f68' },
      shape: { head:{x:300,y:238,rx:98,ry:92}, body:{x:300,y:428,rx:178,ry:136,rot:0},
               belly:{x:300,y:466,rx:104,ry:80}, ruff:{x:300,y:306,rx:150,ry:104}, stripes:3,
               tail:{x0:456,y0:486,cx:596,cy:452,x1:548,y1:296,w:52},
               ear:{len:80,spread:34,tilt:0.12}, face:{lr:21,rr:21,eyes:'lidded',tongue:false,fang:false} }
    }
  ];

  /* ---------------- the heckling ---------------- */
  const BARKS = {
    hurt: ['She will forgive you. She will not forget, but she will forgive you.',
      'That is the angry tail. I know the angry tail.',
      'Gentle! She is a show cat as of Tuesday!',
      'Oh, she felt that one in her ancestors.',
      'You have made an enemy and she has all day.'],
    tear: ['Well. We will comb something over it.',
      'That patch has a name now and the name is your fault.',
      'The judges have seen worse. The judges have not, actually.',
      'That is coming out of somebody’s deposit.'],
    locked: ['Not that one — it is pinned under the other. Top first.',
      'You cannot dig under a knot, love, it only tightens.',
      'Wrong end. Take the one sitting on it.'],
    combo: ['Look at you go!', 'That is the wrist! That is exactly the wrist!',
      'Ooh, she likes that. She will never admit it.'],
    clear: ['One down. Do not get cocky.', 'Lovely. Next.', 'See? She is under there somewhere.'],
    low: ['Judges are lining up! Move!', 'No time, no time, no time —',
      'Thirty seconds and she still looks like a mop!'],
    heat: ['Leave it a moment, it is red raw.', 'That spot has had enough. Go somewhere else.']
  };
  const CLEAR_LINES = {
    perfect: ['"That is a rosette. That is a rosette and a photograph."', '"Oh she is GLEAMING. Look at her."', '"Not a knot on her. I could weep."'],
    scuffed: ['"We do not mention the bald bit. Put something shiny on her."', '"Chin up. Nobody looks that closely. They do, but chin up."'],
    timeout: ['"Time! She goes up as she is, God help us."', '"Well. She has character. Judges like character."', '"That is not a cat, that is a draught excluder."'],
    feral: ['"What have you DONE to her."', '"I have seen roadkill with better structure."', '"She is going to sit on your keyboard forever now."']
  };
  const PAIN_WORDS = ['MRRP!', 'HSSS!', 'YOWL!', 'RUDE.', 'EXCUSE ME', 'NNGH!'];

  const STORY = [
    { mood: 'excited', title: 'Somewhere in a house that smells of tuna and ambition',
      text: 'A woman has entered five cats into a beauty pageant. She did not ask the cats. The cats would have said no.' },
    { mood: 'horrified', title: 'None of them are ready',
      text: 'Two are matted to the skin. One is structurally a loaf. One screams at walls. The reigning champion refuses to look at anybody. Judging is in four minutes.' },
    { mood: 'excited', title: 'You are the groomer',
      text: 'Brush the snarls out before the buzzer. Pull too hard and she yelps and you lose seconds. Pull harder than that and the fur comes out for good, and it stays out all the way to judging.' }
  ];

  const JUDGE = [
    { min: 245, line: 'Best in show material. Frankly a relief.', stars: 5 },
    { min: 205, line: 'Very tidy. Very tidy indeed.', stars: 4 },
    { min: 160, line: 'Adequate. The judges have seen worse.', stars: 3 },
    { min: 110, line: 'The judges would like a word.', stars: 2 },
    { min: -999, line: 'The judges are calling someone.', stars: 1 }
  ];

  /* ---------------- state ---------------- */
  let LV = 0, phase = 'story', storyStep = 0, tutDone = false;
  let tool = 'brush';
  let tangles = [], patches = [], floats = [], sparks = [];
  let timeLeft = 45, shake = 0, tint = 0, combo = 0, comboTimer = 0;
  let prizeChosen = null, finishedOnTime = false;
  let catLayer = null, lastT = 0;
  let mood = 'calm', moodTimer = 0, earFlat = 0, blink = 0, blinkTimer = 2;
  let tutBeat = 0, tutCaption = '', tutYelped = false, tutHold = -1, tutUnlocked = false;
  let bark = '', barkTimer = 0, lowWarned = false, lastBark = '', lockNag = 0;
  let run = [null, null, null, null, null];
  let pg = null;

  const cat = () => CATS[LV];
  const shape = () => CATS[LV].shape;

  /* ---------------- shape helpers ---------------- */
  function inEll(x, y, e) {
    if (!e) return false;
    const rot = e.rot || 0, cs = Math.cos(-rot), sn = Math.sin(-rot);
    const dx = x - e.x, dy = y - e.y;
    const lx = dx * cs - dy * sn, ly = dx * sn + dy * cs;
    return (lx / e.rx) ** 2 + (ly / e.ry) ** 2 < 1;
  }
  function onCat(x, y, S) { return inEll(x, y, S.body) || inEll(x, y, S.head) || inEll(x, y, S.ruff); }
  function headClear(x, y, S) {
    const h = S.head;
    return (x - h.x) ** 2 / (h.rx * 1.06) ** 2 + (y - h.y) ** 2 / (h.ry * 1.06) ** 2 > 1;
  }
  function placeable(x, y) {
    const S = shape();
    return headClear(x, y, S) && (inEll(x, y, S.body) || inEll(x, y, S.ruff));
  }

  /* Snarl anchors are generated from this cat's own body, so a long cat spreads
     them end to end and a round one clusters them. */
  function genAnchors(rnd, want) {
    const S = shape(), B = S.body;
    const cands = [];
    for (let i = 0; i < 900; i++) {
      const u = Math.sqrt(rnd()), a = rnd() * Math.PI * 2;
      const lx = Math.cos(a) * u * B.rx * 0.84, ly = Math.sin(a) * u * B.ry * 0.84;
      const cs = Math.cos(B.rot || 0), sn = Math.sin(B.rot || 0);
      const x = B.x + lx * cs - ly * sn, y = B.y + lx * sn + ly * cs;
      if (headClear(x, y, S)) cands.push({ x, y });
    }
    if (S.ruff) for (let i = 0; i < 200; i++) {
      const u = Math.sqrt(rnd()), a = rnd() * Math.PI * 2;
      const x = S.ruff.x + Math.cos(a) * u * S.ruff.rx * 0.86;
      const y = S.ruff.y + Math.sin(a) * u * S.ruff.ry * 0.86;
      if (headClear(x, y, S)) cands.push({ x, y });
    }
    const out = [];
    let sep = Math.min(B.rx, B.ry) * 0.62 + 30;
    while (out.length < want && sep > 34) {
      for (const c of cands) {
        if (out.length >= want) break;
        if (out.every(o => Math.hypot(o.x - c.x, o.y - c.y) > sep)) out.push(c);
      }
      sep *= 0.82;
    }
    return out;
  }

  /* ---------------- fur & body ---------------- */
  function buildCatCanvas(lv, patchList, seed) {
    const C = CATS[lv], S = C.shape, K = C.coat;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const rnd = mulberry(seed);

    const pool = c.createRadialGradient(300, 520, 20, 300, 520, 300);
    pool.addColorStop(0, 'rgba(240,180,106,0.15)'); pool.addColorStop(1, 'rgba(240,180,106,0)');
    c.fillStyle = pool; c.fillRect(0, 240, W, H - 240);
    c.fillStyle = 'rgba(0,0,0,0.32)';
    c.beginPath(); c.ellipse(S.body.x, S.body.y + S.body.ry + 12, S.body.rx * 1.06, 26, 0, 0, Math.PI * 2); c.fill();

    // tail
    const T = S.tail;
    c.strokeStyle = K.tail; c.lineCap = 'round'; c.lineWidth = T.w;
    c.beginPath(); c.moveTo(T.x0, T.y0); c.quadraticCurveTo(T.cx, T.cy, T.x1, T.y1); c.stroke();
    c.strokeStyle = K.tailStripe; c.lineWidth = Math.max(6, T.w * 0.26);
    for (let i = 0; i < 4; i++) {
      const t = 0.26 + i * 0.18;
      const px = (1 - t) ** 2 * T.x0 + 2 * (1 - t) * t * T.cx + t * t * T.x1;
      const py = (1 - t) ** 2 * T.y0 + 2 * (1 - t) * t * T.cy + t * t * T.y1;
      c.beginPath(); c.moveTo(px - T.w * 0.42, py - T.w * 0.3); c.lineTo(px + T.w * 0.42, py + T.w * 0.3); c.stroke();
    }

    const grad = c.createLinearGradient(S.body.x - S.body.rx, S.body.y - S.body.ry, S.body.x + S.body.rx, S.body.y + S.body.ry);
    grad.addColorStop(0, K.base); grad.addColorStop(1, K.deep);

    // a big fluffy ruff, for the one cat who has one
    if (S.ruff) {
      c.fillStyle = K.base;
      c.beginPath();
      for (let i = 0; i <= 60; i++) {
        const a = (i / 60) * Math.PI * 2;
        const spike = 1 + 0.13 * Math.sin(a * 13);
        const x = S.ruff.x + Math.cos(a) * S.ruff.rx * spike;
        const y = S.ruff.y + Math.sin(a) * S.ruff.ry * spike;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.closePath(); c.fill();
    }

    c.fillStyle = grad;
    c.save(); c.translate(S.body.x, S.body.y); c.rotate(S.body.rot || 0);
    c.beginPath(); c.ellipse(0, 0, S.body.rx, S.body.ry, 0, 0, Math.PI * 2); c.fill();
    c.restore();
    c.beginPath(); c.ellipse(S.head.x, S.head.y, S.head.rx, S.head.ry, 0, 0, Math.PI * 2); c.fill();

    c.fillStyle = K.belly; c.globalAlpha = 0.74;
    c.beginPath(); c.ellipse(S.belly.x, S.belly.y, S.belly.rx, S.belly.ry, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(S.head.x, S.head.y + S.head.ry * 0.46, S.head.rx * 0.56, S.head.ry * 0.42, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;

    // tabby stripes, laid along whatever shape the body actually is
    c.strokeStyle = K.stripe; c.lineCap = 'round'; c.lineWidth = Math.max(8, S.body.ry * 0.085);
    c.save(); c.translate(S.body.x, S.body.y); c.rotate(S.body.rot || 0);
    for (let i = 0; i < S.stripes; i++) {
      const fy = S.body.ry * (-0.52 + i * (1.04 / Math.max(1, S.stripes - 1)));
      const hw = S.body.rx * Math.sqrt(Math.max(0, 1 - (fy / S.body.ry) ** 2));
      if (hw < 40) continue;
      c.beginPath(); c.moveTo(-hw * 0.96, fy);
      c.quadraticCurveTo(-hw * 0.6, fy - S.body.ry * 0.15, -hw * 0.26, fy - S.body.ry * 0.03); c.stroke();
      c.beginPath(); c.moveTo(hw * 0.96, fy);
      c.quadraticCurveTo(hw * 0.6, fy - S.body.ry * 0.15, hw * 0.26, fy - S.body.ry * 0.03); c.stroke();
    }
    c.restore();
    // forehead stripes
    c.lineWidth = Math.max(6, S.head.ry * 0.09);
    for (let i = -1; i <= 1; i++) {
      c.beginPath();
      c.moveTo(S.head.x + i * S.head.rx * 0.3, S.head.y - S.head.ry * 0.86);
      c.lineTo(S.head.x + i * S.head.rx * 0.38, S.head.y - S.head.ry * 0.56);
      c.stroke();
    }

    // fur texture
    c.lineWidth = 1.7; c.lineCap = 'round';
    for (let i = 0; i < 1900; i++) {
      let x = 0, y = 0, ok = false, tries = 0;
      while (!ok && tries++ < 12) {
        x = 60 + rnd() * 500; y = 90 + rnd() * 480;
        ok = onCat(x, y, S);
      }
      if (!ok) continue;
      const ang = Math.atan2(y - S.body.y, x - S.body.x) + (rnd() - 0.5) * 1.1;
      const l = 5 + rnd() * C.furLen, sh = rnd();
      c.strokeStyle = sh > 0.72 ? 'rgba(255,255,255,0.22)' : sh > 0.4 ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.19)';
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(ang) * l, y + Math.sin(ang) * l); c.stroke();
    }

    (patchList || []).forEach(p => {
      c.beginPath();
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const rr = p.r * (0.78 + 0.34 * Math.abs(Math.sin(a * 3 + p.seed)));
        const px = p.x + Math.cos(a) * rr, py = p.y + Math.sin(a) * rr * 0.86;
        i ? c.lineTo(px, py) : c.moveTo(px, py);
      }
      c.closePath();
      c.fillStyle = '#f2b8b0'; c.fill();
      c.strokeStyle = 'rgba(120,60,50,0.55)'; c.lineWidth = 2; c.stroke();
      c.fillStyle = 'rgba(190,120,110,0.5)';
      for (let i = 0; i < 5; i++) {
        const a = p.seed + i * 1.3;
        c.beginPath(); c.arc(p.x + Math.cos(a) * p.r * 0.4, p.y + Math.sin(a) * p.r * 0.35, 2.4, 0, Math.PI * 2); c.fill();
      }
    });
    return cv;
  }

  const cleanCache = [];
  function cleanLayer(lv) {
    if (!cleanCache[lv]) cleanCache[lv] = buildCatCanvas(lv, [], 4242 + lv * 17);
    return cleanCache[lv];
  }

  /* ---------------- ears ---------------- */
  function drawEars(c, lv, flat) {
    const C = CATS[lv], S = C.shape, K = C.coat, E = S.ear, h = S.head;
    [-1, 1].forEach(side => {
      const a1 = side < 0 ? 3.578 : -0.436, a2 = side < 0 ? 4.363 : -1.222;
      const p1 = { x: h.x + Math.cos(a1) * h.rx, y: h.y + Math.sin(a1) * h.ry };
      const p2 = { x: h.x + Math.cos(a2) * h.rx, y: h.y + Math.sin(a2) * h.ry };
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      const ang = (side > 0 ? E.tilt : -E.tilt * 0.3) + side * flat * 1.05;
      const tl = { x: side * E.spread, y: -E.len };
      const cs = Math.cos(ang), sn = Math.sin(ang);
      const tip = { x: mx + tl.x * cs - tl.y * sn, y: my + tl.x * sn + tl.y * cs };
      c.fillStyle = K.ear; c.strokeStyle = K.deep; c.lineWidth = 3; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(p1.x, p1.y); c.lineTo(tip.x, tip.y); c.lineTo(p2.x, p2.y); c.closePath();
      c.fill(); c.stroke();
      c.fillStyle = 'rgba(242,184,176,0.9)';
      c.beginPath();
      c.moveTo(p1.x + (mx - p1.x) * 0.34, p1.y + (my - p1.y) * 0.34);
      c.lineTo(mx + (tip.x - mx) * 0.72, my + (tip.y - my) * 0.72);
      c.lineTo(p2.x + (mx - p2.x) * 0.34, p2.y + (my - p2.y) * 0.34);
      c.closePath(); c.fill();
      c.strokeStyle = K.belly; c.lineWidth = 2.2; c.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const t = 0.3 + i * 0.2;
        const bx = p1.x + (tip.x - p1.x) * t, by = p1.y + (tip.y - p1.y) * t;
        c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + side * 12, by + 5); c.stroke();
      }
    });
  }

  function almondPath(c, rx, ry) {
    c.beginPath();
    c.moveTo(-rx, 0);
    c.quadraticCurveTo(0, -ry * 1.6, rx, 0);
    c.quadraticCurveTo(0, ry * 1.6, -rx, 0);
    c.closePath();
  }

  /* Every cat gets her own eyes. No two share a treatment — it is the fastest
     read on a personality, and a shared one made half of them look identical. */
  function drawEyes(c, K, F, L, R, m, time, open) {
    const slit = m === 'hiss', droop = m === 'sad';
    const jit = reduce ? 0 : 1;
    [L, R].forEach((e, i) => {
      const t2 = time * (i ? 1.7 : 1.1) + i * 2.3;
      c.save();
      c.translate(e.x, e.y);
      c.scale(1, open);

      if (F.eyes === 'googly') {
        // Marmalade — perfectly round, mismatched, and never pointing the same way
        c.fillStyle = '#f8fbe8';
        c.beginPath(); c.arc(0, 0, e.r, 0, Math.PI * 2); c.fill();
        const dx = Math.cos(t2 * 0.9) * e.r * 0.34 * jit;
        const dy = Math.sin(t2 * 1.35) * e.r * 0.28 * jit;
        c.fillStyle = K.eye;
        c.beginPath(); c.arc(dx, dy, e.r * 0.54, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#12160f';
        c.beginPath(); c.arc(dx, dy, e.r * (slit ? 0.19 : 0.3), 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.92)';
        c.beginPath(); c.arc(dx - e.r * 0.2, dy - e.r * 0.22, e.r * 0.15, 0, Math.PI * 2); c.fill();
        c.strokeStyle = K.line; c.lineWidth = 2.4;
        c.beginPath(); c.arc(0, 0, e.r, 0, Math.PI * 2); c.stroke();
      }

      else if (F.eyes === 'sleepy') {
        // Biscuit — long half-moons under a heavy lid, with a bag underneath
        const rx = e.r * 1.2, ry = e.r * 0.66;
        c.save();
        c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); c.clip();
        c.fillStyle = '#f8fbe8'; c.fillRect(-rx, -ry, rx * 2, ry * 2);
        const gx = (i ? -1 : 1) * e.r * 0.12;
        c.fillStyle = K.eye;
        c.beginPath(); c.arc(gx, e.r * 0.2, e.r * 0.58, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#12160f';
        c.beginPath(); c.ellipse(gx, e.r * 0.2, e.r * 0.17, e.r * 0.32, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = K.base;
        const lidTo = (m === 'work' || droop) ? -e.r * 0.22 : -e.r * 0.04;
        c.fillRect(-rx, -ry * 1.2, rx * 2, ry * 1.2 + lidTo);
        c.restore();
        c.strokeStyle = K.line; c.lineWidth = 3; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-rx, -e.r * 0.02); c.lineTo(rx, -e.r * 0.08); c.stroke();
        c.strokeStyle = 'rgba(0,0,0,0.24)'; c.lineWidth = 2.2;
        c.beginPath(); c.moveTo(-rx * 0.7, ry * 1.02); c.quadraticCurveTo(0, ry * 1.5, rx * 0.7, ry * 1.02); c.stroke();
      }

      else if (F.eyes === 'slits') {
        // Nutmeg — sharp almonds, both pupils narrow vertical slits, unbothered
        const tilt = i ? -0.13 : 0.13;
        c.rotate(tilt);
        const rx = e.r * 1.16, ry = e.r * 0.74;
        almondPath(c, rx, ry); c.fillStyle = '#f8fbe8'; c.fill();
        c.save(); almondPath(c, rx, ry); c.clip();
        c.fillStyle = K.eye;
        c.beginPath(); c.arc(0, 0, e.r * 0.74, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#12160f';
        c.beginPath(); c.ellipse(0, 0, slit ? 1.5 : 2.7, e.r * 0.78, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.55)';
        c.beginPath(); c.arc(-e.r * 0.34, -e.r * 0.22, e.r * 0.1, 0, Math.PI * 2); c.fill();
        c.restore();
        almondPath(c, rx, ry); c.strokeStyle = K.line; c.lineWidth = 2.8; c.stroke();
      }

      else if (F.eyes === 'terror') {
        // Pickle — enormous, pupils blown to the rim, permanently vibrating
        c.fillStyle = '#f8fbe8';
        c.beginPath(); c.arc(0, 0, e.r, 0, Math.PI * 2); c.fill();
        const tr = Math.sin(time * 24 + i * 3) * 1.1 * jit;
        c.fillStyle = K.eye;
        c.beginPath(); c.arc(tr, tr * 0.5, e.r * 0.87, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#12160f';
        c.beginPath(); c.arc(tr, tr * 0.5, e.r * (slit ? 0.4 : 0.66), 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.95)';
        c.beginPath(); c.arc(-e.r * 0.3, -e.r * 0.34, e.r * 0.17, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(e.r * 0.26, e.r * 0.24, e.r * 0.08, 0, Math.PI * 2); c.fill();
        c.strokeStyle = K.line; c.lineWidth = 2.6;
        c.beginPath(); c.arc(0, 0, e.r, 0, Math.PI * 2); c.stroke();
      }

      else {
        // Duchess — tilted almonds, a straight lid, lashes, looking anywhere but at you
        const tilt = i ? -0.22 : 0.22;
        c.rotate(tilt);
        const rx = e.r * 1.26, ry = e.r * 0.8;
        almondPath(c, rx, ry); c.fillStyle = '#f8fbe8'; c.fill();
        c.save(); almondPath(c, rx, ry); c.clip();
        const look = -e.r * (i ? 0.4 : 0.46);
        c.fillStyle = K.eye;
        c.beginPath(); c.arc(look, e.r * 0.06, e.r * 0.62, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#12160f';
        c.beginPath(); c.ellipse(look, e.r * 0.06, slit ? e.r * 0.12 : e.r * 0.21, e.r * 0.5, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = K.base;
        c.fillRect(-rx * 1.1, -ry * 1.6, rx * 2.2, ry * 1.6 - e.r * 0.16);
        c.restore();
        c.strokeStyle = K.line; c.lineWidth = 3; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-rx * 0.98, -e.r * 0.14); c.lineTo(rx * 0.98, -e.r * 0.2); c.stroke();
        c.lineWidth = 2.4;
        const dir = i ? 1 : -1;
        for (let k = 0; k < 3; k++) {
          const bx = dir * e.r * (0.82 + k * 0.17), by = -e.r * 0.18;
          c.beginPath(); c.moveTo(bx, by);
          c.lineTo(bx + dir * e.r * 0.3, by - e.r * 0.36 + k * e.r * 0.07); c.stroke();
        }
      }
      c.restore();
    });
  }

  /* ---------------- faces ----------------
     Drawn in a reference head space (104 × 96) and scaled onto whatever head
     this cat actually has, so every silhouette gets the same expressions. */
  function drawFace(c, lv, m, time, blinkAmt) {
    const C = CATS[lv], S = C.shape, K = C.coat, F = S.face, h = S.head;
    c.save();
    c.translate(h.x, h.y);
    c.scale(h.rx / 104, h.ry / 96);
    c.lineCap = 'round'; c.lineJoin = 'round';

    const L = { x: -38, y: -8, r: F.lr }, R = { x: 40, y: -14, r: F.rr };
    const shut = m === 'ouch' || m === 'happy', slit = m === 'hiss', droop = m === 'sad';

    if (shut) {
      c.strokeStyle = K.line; c.lineWidth = 5;
      [L, R].forEach(e => {
        c.beginPath();
        if (m === 'happy') c.arc(e.x, e.y + 5, e.r * 0.85, Math.PI * 1.15, Math.PI * 1.85);
        else {
          c.moveTo(e.x - e.r, e.y - e.r * 0.5); c.lineTo(e.x + e.r, e.y + e.r * 0.5);
          c.moveTo(e.x - e.r, e.y + e.r * 0.5); c.lineTo(e.x + e.r, e.y - e.r * 0.5);
        }
        c.stroke();
      });
    } else {
      drawEyes(c, K, F, L, R, m, time, blinkAmt > 0 ? 0.12 : 1);
    }

    c.strokeStyle = K.deep; c.lineWidth = 5;
    if (F.brow === 'raised' && !slit && m !== 'work' && !droop) {
      c.beginPath(); c.moveTo(L.x - 22, L.y - 30); c.lineTo(L.x + 20, L.y - 26); c.stroke();
      c.beginPath(); c.moveTo(R.x + 20, R.y - 44); c.lineTo(R.x - 18, R.y - 34); c.stroke();
    } else if (slit || m === 'work') {
      c.beginPath(); c.moveTo(L.x - 24, L.y - (slit ? 30 : 34)); c.lineTo(L.x + 20, L.y - (slit ? 22 : 26)); c.stroke();
      c.beginPath(); c.moveTo(R.x + 22, R.y - (slit ? 28 : 32)); c.lineTo(R.x - 18, R.y - (slit ? 20 : 24)); c.stroke();
    } else if (droop) {
      c.beginPath(); c.moveTo(L.x - 24, L.y - 26); c.lineTo(L.x + 18, L.y - 34); c.stroke();
      c.beginPath(); c.moveTo(R.x + 22, R.y - 24); c.lineTo(R.x - 16, R.y - 32); c.stroke();
    }

    c.fillStyle = '#e0857f';
    c.beginPath(); c.moveTo(-12, 38); c.lineTo(13, 38); c.lineTo(0, 53); c.closePath(); c.fill();

    if (m === 'ouch') {
      c.fillStyle = '#8c3346';
      c.beginPath(); c.ellipse(0, 78, 24, 20, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ef8fa2';
      c.beginPath(); c.ellipse(0, 86, 13, 10, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#9ed7ff';
      [[-52, 10], [52, 4]].forEach(([tx, ty], i) => {
        c.beginPath(); c.ellipse(tx, ty + Math.sin(time * 6 + i) * 3, 6, 9, 0, 0, Math.PI * 2); c.fill();
      });
    } else if (m === 'hiss') {
      c.fillStyle = '#8c3346';
      c.beginPath(); c.moveTo(-32, 64); c.quadraticCurveTo(0, 110, 32, 64); c.closePath(); c.fill();
      c.fillStyle = '#fffdf2';
      c.beginPath(); c.moveTo(-24, 66); c.lineTo(-15, 90); c.lineTo(-8, 66); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(8, 66); c.lineTo(15, 90); c.lineTo(24, 66); c.closePath(); c.fill();
    } else if (m === 'happy') {
      c.fillStyle = '#8c3346';
      c.beginPath(); c.moveTo(-34, 62); c.quadraticCurveTo(0, 104, 34, 62); c.closePath(); c.fill();
      c.fillStyle = '#ef8fa2';
      c.beginPath(); c.ellipse(0, 86, 15, 9, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,140,150,0.32)';
      c.beginPath(); c.arc(-68, 30, 20, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(70, 26, 20, 0, Math.PI * 2); c.fill();
    } else if (m === 'sad') {
      c.strokeStyle = K.line; c.lineWidth = 4;
      c.beginPath(); c.moveTo(-20, 80); c.quadraticCurveTo(0, 66, 20, 80); c.stroke();
    } else {
      // resting derp: tongue drawn first, lips over the top so it emerges from the mouth
      if (F.tongue) {
        c.fillStyle = '#ef8fa2'; c.strokeStyle = '#c96f80'; c.lineWidth = 2;
        c.beginPath();
        c.moveTo(-16, 62);
        c.quadraticCurveTo(-26, 82, -14, 89);
        c.quadraticCurveTo(-1, 92, -1, 68);
        c.closePath(); c.fill(); c.stroke();
        c.strokeStyle = 'rgba(196,104,122,0.75)'; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(-10, 69); c.lineTo(-13, 84); c.stroke();
      }
      if (F.fang) {
        c.fillStyle = '#fffdf2';
        c.beginPath(); c.moveTo(11, 61); c.lineTo(15, 77); c.lineTo(20, 61); c.closePath(); c.fill();
      }
      c.strokeStyle = K.line; c.lineWidth = 4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, 53); c.lineTo(0, 60); c.stroke();
      c.beginPath(); c.moveTo(0, 60); c.quadraticCurveTo(-12, 73, -28, 63); c.stroke();
      c.beginPath(); c.moveTo(0, 60); c.quadraticCurveTo(16, 76, 34, 68); c.stroke();
    }

    c.strokeStyle = 'rgba(255,250,240,0.66)'; c.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const y = 40 + i * 11;
      c.beginPath(); c.moveTo(-34, y); c.quadraticCurveTo(-94, y - 9 + i * 7, -138, y - 15 + i * 13); c.stroke();
      c.beginPath(); c.moveTo(36, y); c.quadraticCurveTo(94, y - 7 + i * 7, 138, y - 12 + i * 13); c.stroke();
    }
    c.restore();
  }

  /* ---------------- the cat lady ---------------- */
  function drawLady(c, ladyMood) {
    const w = c.canvas.width, h = c.canvas.height;
    c.clearRect(0, 0, w, h);
    c.save();
    c.translate(w / 2, h);
    const s = h / 420; c.scale(s, s); c.translate(0, -380);
    c.lineCap = 'round'; c.lineJoin = 'round';
    const HY = 150;

    c.fillStyle = '#3d6b63';
    c.beginPath(); c.moveTo(-46, 214); c.lineTo(46, 214);
    c.quadraticCurveTo(104, 250, 112, 380); c.lineTo(-112, 380);
    c.quadraticCurveTo(-104, 250, -46, 214); c.closePath(); c.fill();
    c.fillStyle = '#2f5651';
    c.beginPath(); c.moveTo(0, 216); c.lineTo(30, 380); c.lineTo(-30, 380); c.closePath(); c.fill();
    c.fillStyle = 'rgba(240,180,106,0.5)';
    for (let i = 0; i < 16; i++) {
      const fx = -100 + (i * 53) % 200, fy = 250 + ((i * 37) % 120);
      for (let p = 0; p < 5; p++) {
        const pa = (p / 5) * Math.PI * 2;
        c.beginPath(); c.arc(fx + Math.cos(pa) * 5, fy + Math.sin(pa) * 5, 4, 0, Math.PI * 2); c.fill();
      }
    }
    c.strokeStyle = 'rgba(246,227,196,0.55)'; c.lineWidth = 1.6;
    for (let i = 0; i < 40; i++) {
      const fx = -105 + (i * 71) % 210, fy = 232 + ((i * 53) % 140);
      c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx + 9, fy - 5); c.stroke();
    }
    c.fillStyle = '#5b988c';
    c.beginPath(); c.moveTo(-48, 214); c.lineTo(0, 250); c.lineTo(48, 214); c.lineTo(20, 208); c.lineTo(-20, 208); c.closePath(); c.fill();

    c.strokeStyle = '#3d6b63'; c.lineWidth = 26;
    c.beginPath(); c.moveTo(60, 250); c.quadraticCurveTo(122, 216, 116, 150); c.stroke();
    c.strokeStyle = '#f0cfa8'; c.lineWidth = 20;
    c.beginPath(); c.moveTo(116, 152); c.lineTo(116, 136); c.stroke();
    c.save(); c.translate(116, 118); c.rotate(-0.25);
    c.fillStyle = '#a8763f'; c.beginPath(); c.roundRect(-24, -10, 48, 19, 6); c.fill();
    c.fillStyle = '#7a5230'; c.beginPath(); c.roundRect(-9, 7, 18, 16, 5); c.fill();
    c.strokeStyle = '#eef0fb'; c.lineWidth = 3;
    for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(-20 + i * 8, -10); c.lineTo(-20 + i * 8, -26); c.stroke(); }
    c.restore();

    c.strokeStyle = '#c9ccdd';
    for (let i = 0; i < 74; i++) {
      const a = -Math.PI * 1.02 + (i / 73) * Math.PI * 1.04;
      const len = 74 + ((i * 37) % 46);
      const bx = Math.cos(a) * 52, by = HY + Math.sin(a) * 50;
      const ex = Math.cos(a) * (52 + len), ey = HY + Math.sin(a) * (50 + len * 0.86);
      const kink = ((i % 3) - 1) * 26;
      c.lineWidth = 2 + (i % 3);
      c.beginPath(); c.moveTo(bx, by);
      c.quadraticCurveTo((bx + ex) / 2 + kink, (by + ey) / 2 - 18, ex, ey); c.stroke();
    }
    [[-64, 62], [10, 40], [66, 66], [-22, 34]].forEach(([cx, cy], i) => {
      c.fillStyle = ['#ff9ec4', '#ffd76b', '#9ec4ff', '#a8e6a1'][i];
      c.beginPath(); c.ellipse(cx, cy, 15, 11, i * 0.5, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 2;
      for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(cx + k * 7, cy - 9); c.lineTo(cx + k * 7, cy + 9); c.stroke(); }
    });

    c.fillStyle = '#f0cfa8';
    c.beginPath(); c.ellipse(0, HY, 54, 70, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(-22, 210); c.lineTo(22, 210); c.lineTo(16, 226); c.lineTo(-16, 226); c.closePath(); c.fill();

    const eyeL = { x: -23, y: 134 }, eyeR = { x: 25, y: 131 };
    c.fillStyle = '#fffdf2';
    c.beginPath(); c.arc(eyeL.x, eyeL.y, 26, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(eyeR.x, eyeR.y, 26, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#12160f';
    if (ladyMood === 'horrified') {
      c.beginPath(); c.arc(eyeL.x, eyeL.y, 9, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(eyeR.x, eyeR.y, 9, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#12160f'; c.lineWidth = 3;
      c.beginPath(); c.arc(eyeL.x, eyeL.y, 15, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(eyeR.x, eyeR.y, 15, 0, Math.PI * 2); c.stroke();
    } else if (ladyMood === 'pleased') {
      c.strokeStyle = '#12160f'; c.lineWidth = 4;
      c.beginPath(); c.arc(eyeL.x, eyeL.y + 4, 12, Math.PI * 1.12, Math.PI * 1.88); c.stroke();
      c.beginPath(); c.arc(eyeR.x, eyeR.y + 4, 12, Math.PI * 1.12, Math.PI * 1.88); c.stroke();
    } else {
      c.beginPath(); c.arc(eyeL.x, eyeL.y, 11, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(eyeR.x, eyeR.y, 12, 4, 0, 0, Math.PI * 2); c.fill();
    }
    c.strokeStyle = '#1b2040'; c.lineWidth = 6;
    c.beginPath(); c.arc(eyeL.x, eyeL.y, 26, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(eyeR.x, eyeR.y, 26, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 5;
    c.beginPath(); c.moveTo(eyeL.x + 26, eyeL.y); c.lineTo(eyeR.x - 26, eyeR.y); c.stroke();
    c.beginPath(); c.moveTo(eyeL.x - 26, eyeL.y - 4); c.lineTo(-56, 125); c.stroke();
    c.beginPath(); c.moveTo(eyeR.x + 26, eyeR.y - 4); c.lineTo(58, 123); c.stroke();
    c.strokeStyle = 'rgba(125,216,255,0.5)'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(eyeL.x - 15, eyeL.y + 12); c.lineTo(eyeL.x + 6, eyeL.y - 14); c.stroke();

    // nose: a short vertical bridge, well clear of the mouth
    c.strokeStyle = '#d8ab84'; c.lineWidth = 3.4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(1, 156); c.quadraticCurveTo(5, 166, -2, 170); c.stroke();
    c.fillStyle = '#d8ab84';
    c.beginPath(); c.ellipse(-2, 171, 6.5, 4.6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(150,105,80,0.65)';
    c.beginPath(); c.ellipse(-6, 173, 1.8, 1.3, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(2, 173, 1.8, 1.3, 0, 0, Math.PI * 2); c.fill();

    if (ladyMood === 'horrified') {
      c.fillStyle = '#7d2f3f';
      c.beginPath(); c.ellipse(0, 192, 15, 18, 0, 0, Math.PI * 2); c.fill();
    } else if (ladyMood === 'pleased') {
      c.strokeStyle = '#7d2f3f'; c.lineWidth = 5;
      c.beginPath(); c.arc(0, 182, 17, 0.2, Math.PI - 0.2); c.stroke();
    } else {
      c.fillStyle = '#7d2f3f';
      c.beginPath(); c.moveTo(-28, 186); c.quadraticCurveTo(0, 212, 28, 186); c.closePath(); c.fill();
      c.fillStyle = '#fffdf2';
      c.beginPath(); c.rect(-26, 186, 21, 9); c.fill();
      c.beginPath(); c.rect(2, 186, 24, 9); c.fill();
    }
    c.fillStyle = 'rgba(255,140,150,0.3)';
    c.beginPath(); c.arc(-40, 178, 13, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(42, 176, 13, 0, Math.PI * 2); c.fill();

    miniCat(c, -6, 44, 0.62, '#e8a95c', ladyMood === 'horrified' ? 'wide' : 'calm');
    miniCat(c, -78, 236, 0.56, '#6d7299', 'calm');
    c.restore();
  }
  function miniCat(c, x, y, s, col, m) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = col;
    c.beginPath(); c.moveTo(-30, -14); c.lineTo(-38, -48); c.lineTo(-6, -28); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(30, -14); c.lineTo(38, -48); c.lineTo(6, -28); c.closePath(); c.fill();
    c.beginPath(); c.ellipse(0, 0, 34, 30, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#12160f';
    const er = m === 'wide' ? 8 : 5;
    c.beginPath(); c.arc(-13, -3, er, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(13, -3, er * 0.8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e0857f';
    c.beginPath(); c.moveTo(-5, 8); c.lineTo(5, 8); c.lineTo(0, 15); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.6;
    for (let i = -1; i <= 1; i++) {
      c.beginPath(); c.moveTo(-14, 8 + i * 4); c.lineTo(-34, 4 + i * 7); c.stroke();
      c.beginPath(); c.moveTo(14, 8 + i * 4); c.lineTo(34, 4 + i * 7); c.stroke();
    }
    c.restore();
  }

  /* ---------------- snarls ---------------- */
  function newTangle(x, y, r, type, rnd) {
    rnd = rnd || Math.random;
    return { x, y, r, type, progress: 0, strain: 0, heat: 0, done: false,
      grain: rnd() * Math.PI, flash: 0, lockedBy: null, unlockPop: 0,
      inStroke: false, travel: 0, sumA: 0, sumN: 0, idle: 0,
      seed: rnd() * 100, wob: rnd() * 6.28 };
  }
  function offsetOnCat(x, y, dist, rnd) {
    for (let i = 0; i < 16; i++) {
      const a = rnd() * Math.PI * 2;
      const nx = x + Math.cos(a) * dist, ny = y + Math.sin(a) * dist * 0.85;
      if (placeable(nx, ny)) return { x: nx, y: ny };
    }
    return null;
  }
  function makeTangles() {
    const C = cat();
    const rnd = mulberry(1337 + LV * 977);
    const pool = genAnchors(rnd, C.count + 2);
    const mix = C.mix.slice();
    const out = [];
    const takeAnchor = () => pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    const takeType = () => mix.length ? mix.splice(Math.floor(rnd() * mix.length), 1)[0] : 'fluff';

    for (let ci = 0; ci < C.clusters && pool.length && out.length < C.count - 1; ci++) {
      const a = takeAnchor();
      const depth = Math.min(C.depth, 1 + Math.floor(rnd() * C.depth));
      let cx = a.x, cy = a.y;
      const stack = [];
      for (let d = 0; d < depth + 1; d++) {
        stack.push(newTangle(cx, cy, (35 - d * 2) + rnd() * 6, takeType(), rnd));
        const p = offsetOnCat(cx, cy, 25 + rnd() * 10, rnd);
        if (!p) break;
        cx = p.x; cy = p.y;
      }
      const base = out.length;
      stack.forEach((t, i) => { if (i < stack.length - 1) t.lockedBy = base + i + 1; out.push(t); });
    }
    while (out.length < C.count && pool.length) {
      const a = takeAnchor();
      out.push(newTangle(a.x, a.y, 29 + rnd() * 10, takeType(), rnd));
    }
    tangles = out;
  }
  const isLocked = t => t.lockedBy != null && tangles[t.lockedBy] && tangles[t.lockedBy].progress < 1;

  function drawPadlock(c, r) {
    c.save(); c.translate(0, -r - 4);
    c.strokeStyle = '#eef0fb'; c.lineWidth = 3.4;
    c.beginPath(); c.arc(0, -6, 6, Math.PI, 0); c.stroke();
    c.fillStyle = '#eef0fb';
    c.beginPath(); c.roundRect(-9, -6, 18, 14, 3); c.fill();
    c.fillStyle = '#0a0d18';
    c.beginPath(); c.arc(0, 1, 2.4, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  function drawTangle(c, t, time) {
    if (t.progress >= 1) return;
    const S = SNARLS[t.type];
    const r = t.r * (0.4 + 0.6 * (1 - t.progress));
    const locked = isLocked(t), right = TOOLS[tool].best === t.type;
    c.save(); c.translate(t.x, t.y);
    if (locked) c.globalAlpha = 0.55;

    if (right && !locked) {
      c.globalAlpha = 0.22 + (reduce ? 0.08 : Math.sin(time * 3 + t.wob) * 0.08);
      c.fillStyle = S.col;
      c.beginPath(); c.arc(0, 0, r * 1.7, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
    }
    if (t.unlockPop > 0) {
      c.globalAlpha = t.unlockPop * 0.7; c.strokeStyle = '#6ee7a8'; c.lineWidth = 5;
      c.beginPath(); c.arc(0, 0, r * (1.3 + (1 - t.unlockPop) * 1.2), 0, Math.PI * 2); c.stroke();
      c.globalAlpha = locked ? 0.55 : 1;
    }
    if (t.flash > 0) {
      c.globalAlpha = t.flash * 0.5; c.fillStyle = '#fff';
      c.beginPath(); c.arc(0, 0, r * 1.5, 0, Math.PI * 2); c.fill();
      c.globalAlpha = locked ? 0.55 : 1;
    }

    const prevA = c.globalAlpha;
    c.strokeStyle = locked ? '#6d7299' : S.col; c.lineWidth = 2.6; c.lineCap = 'round';
    c.globalAlpha = prevA * (right && !locked ? 0.95 : 0.5);
    const spikes = t.type === 'burr' ? 17 : 12;
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2 + t.seed;
      const wig = reduce ? 0 : Math.sin(time * 2 + i + t.wob) * 2.5;
      const len = r * (t.type === 'burr' ? 1.55 : 1.3) + wig;
      c.beginPath(); c.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
      c.lineTo(Math.cos(a) * len, Math.sin(a) * len); c.stroke();
    }
    c.globalAlpha = prevA;

    const g = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.15, 0, 0, r);
    if (locked) { g.addColorStop(0, '#3a3f55'); g.addColorStop(1, '#22263a'); }
    else { g.addColorStop(0, S.core); g.addColorStop(1, S.edge); }
    c.fillStyle = g;
    c.beginPath();
    for (let i = 0; i <= 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const rr = r * (0.86 + 0.2 * Math.sin(a * 4 + t.seed));
      i ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath(); c.fill();
    c.strokeStyle = locked ? '#6d7299' : S.col; c.lineWidth = 3; c.stroke();

    if (locked) drawPadlock(c, r);
    else {
      c.save();
      c.beginPath(); c.arc(0, 0, r * 0.9, 0, Math.PI * 2); c.clip();
      c.rotate(t.grain);
      c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 3.4; c.lineCap = 'round';
      for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(-r, i * 9); c.lineTo(r, i * 9); c.stroke(); }
      c.restore();
      c.save(); c.rotate(t.grain);
      c.strokeStyle = '#fff'; c.lineWidth = 3.2;
      const ar = r * 1.42;
      [-1, 1].forEach(sg => {
        c.beginPath(); c.moveTo(sg * (ar - 10), -8); c.lineTo(sg * ar, 0); c.lineTo(sg * (ar - 10), 8); c.stroke();
      });
      c.restore();
    }

    if (t.heat > 0.05 && !locked) {
      c.globalAlpha = Math.min(0.55, t.heat * 0.5);
      c.fillStyle = t.heat >= 1 ? '#ff6b7d' : '#ffb057';
      c.beginPath(); c.arc(0, 0, r * 1.3, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
      c.strokeStyle = t.heat >= 1 ? '#ff6b7d' : '#ffb057'; c.lineWidth = 4;
      c.beginPath(); c.arc(0, 0, r + 17, -Math.PI / 2, -Math.PI / 2 + Math.min(1, t.heat) * Math.PI * 2); c.stroke();
    }
    if (t.strain > 0.05 && !locked) {
      const f = Math.min(1, t.strain);
      c.strokeStyle = f > 0.8 ? '#ff6b7d' : '#ffb057'; c.lineWidth = 5;
      c.beginPath(); c.arc(0, 0, r + 17, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); c.stroke();
    }
    c.strokeStyle = '#6ee7a8'; c.lineWidth = 4.5; c.lineCap = 'round';
    c.beginPath(); c.arc(0, 0, r + 9, -Math.PI / 2, -Math.PI / 2 + t.progress * Math.PI * 2); c.stroke();
    c.restore();
  }

  /* ---------------- feedback ---------------- */
  function setMood(m, secs) { mood = m; moodTimer = secs; }
  function say(pool) {
    let line = pick(pool);
    for (let i = 0; i < 3 && line === lastBark; i++) line = pick(pool);
    lastBark = line; bark = line; barkTimer = 2.6;
  }
  function yelp(t, cost, hiss) {
    timeLeft = Math.max(0, timeLeft - cost);
    shake = reduce ? 0 : 1; tint = 1;
    setMood(hiss ? 'hiss' : 'ouch', 1.1);
    earFlat = 1; tutYelped = true; say(BARKS.hurt);
    floats.push({ x: t.x, y: t.y - t.r - 18, text: pick(PAIN_WORDS), sub: '-' + cost + 's', life: 1.1, col: '#ff6b7d' });
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      sparks.push({ x: t.x, y: t.y, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110 - 40, life: 0.6, col: '#ffd8b0' });
    }
  }
  function tear(t) {
    patches.push({ x: t.x, y: t.y, r: t.r * 1.15, seed: t.seed });
    t.progress = 1; t.done = true;
    timeLeft = Math.max(0, timeLeft - 1);
    shake = reduce ? 0 : 1.5; tint = 1;
    setMood('hiss', 1.6); earFlat = 1; say(BARKS.tear);
    floats.push({ x: t.x, y: t.y - t.r - 18, text: 'FUR TORN', sub: 'permanent', life: 1.6, col: '#ff6b7d' });
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      sparks.push({ x: t.x, y: t.y, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190 - 60, life: 0.9, col: '#f0b46a' });
    }
    unlockFrom(t);
    catLayer = buildCatCanvas(LV, patches, 4242 + LV * 17);
    syncHud();
  }
  function unlockFrom(t) {
    const idx = tangles.indexOf(t);
    tangles.forEach(o => {
      if (o.lockedBy === idx && o.progress < 1) {
        o.unlockPop = 1; o.grain = Math.random() * Math.PI; tutUnlocked = true;
      }
    });
  }
  function cleared(t) {
    t.flash = 1; setMood('happy', 0.9);
    if (Math.random() < 0.4) say(BARKS.clear);
    floats.push({ x: t.x, y: t.y - t.r - 10, text: 'smooth', sub: '', life: 1.0, col: '#6ee7a8' });
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      sparks.push({ x: t.x, y: t.y, vx: Math.cos(a) * 130, vy: Math.sin(a) * 130 - 30, life: 0.7, col: '#6ee7a8' });
    }
    unlockFrom(t); syncHud();
  }

  /* ---------------- input ---------------- */
  let ptrDown = false, px = 0, py = 0, hasPrev = false;
  const active = () => phase === 'play' || phase === 'tutorial';
  function toLocal(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  }
  // Right-click, two-finger tap, long-press and drag-to-select are all disabled over
  // the stage — on a trackpad they were firing mid-stroke and opening menus.
  ['contextmenu', 'dragstart', 'selectstart'].forEach(ev =>
    document.querySelector('.stage-wrap').addEventListener(ev, e => {
      if (e.target && e.target.tagName === 'INPUT') return;   // the initials field still needs to work
      e.preventDefault();
    }));

  canvas.addEventListener('pointerdown', e => {
    if (!active()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;   // ignore anything but a left press
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const p = toLocal(e); px = p.x; py = p.y; ptrDown = true; hasPrev = true;
  });
  canvas.addEventListener('pointermove', e => {
    if (!active() || !ptrDown) return;
    e.preventDefault();
    const p = toLocal(e);
    if (hasPrev) stroke(px, py, p.x, p.y);
    px = p.x; py = p.y; hasPrev = true;
  });
  function endPtr() { tangles.forEach(t => { if (t.inStroke) closeStroke(t); }); ptrDown = false; hasPrev = false; }
  canvas.addEventListener('pointerup', endPtr);
  canvas.addEventListener('pointercancel', endPtr);

  function segDist(ax, ay, bx, by, cx, cy) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 ? ((cx - ax) * dx + (cy - ay) * dy) / l2 : 0;
    t = clamp(t, 0, 1);
    return Math.hypot(cx - (ax + dx * t), cy - (ay + dy * t));
  }
  function angDiff(a, b) { const d = Math.abs(a - b) % Math.PI; return d > Math.PI / 2 ? Math.PI - d : d; }

  function stroke(ax, ay, bx, by) {
    const dist = Math.hypot(bx - ax, by - ay);
    if (dist < 0.5) return;
    const ang = Math.atan2(by - ay, bx - ax);
    tangles.forEach(t => {
      if (t.progress >= 1) return;
      const inside = segDist(ax, ay, bx, by, t.x, t.y) < t.r * 1.2;
      if (isLocked(t)) {
        if (inside && lockNag <= 0) {
          lockNag = 1.6; say(BARKS.locked);
          floats.push({ x: t.x, y: t.y - t.r - 12, text: 'PINNED', sub: '', life: 0.9, col: '#a8adcf' });
        }
        return;
      }
      if (inside) {
        if (!t.inStroke) { t.inStroke = true; t.travel = 0; t.sumA = 0; t.sumN = 0; }
        t.travel += dist; t.sumA += ang; t.sumN++; t.idle = 0;
      } else if (t.inStroke) closeStroke(t);
    });
  }
  function closeStroke(t) {
    const travel = t.travel, n = t.sumN, avg = n ? t.sumA / n : 0;
    t.inStroke = false; t.travel = 0; t.sumA = 0; t.sumN = 0;
    if (travel < t.r || !n || t.progress >= 1 || isLocked(t)) return;
    const C = cat(), T = TOOLS[tool];
    const match = t.type === T.best ? 1 : 0.45;
    const err = angDiff(avg, t.grain);

    if (err > T.tol) { yelp(t, 1.5, true); combo = 0; t.strain += 0.6; if (t.strain >= 2.0) tear(t); return; }
    if (t.heat >= 1) {
      yelp(t, 1.5, false); combo = 0; t.heat += 0.34;
      if (Math.random() < 0.5) say(BARKS.heat);
      if (t.heat >= 1.9) tear(t);
      return;
    }
    combo = Math.min(6, combo + 1); comboTimer = 1.0;
    if (combo === 4) say(BARKS.combo);
    t.progress += 0.32 * match * T.speed * (1 - err / T.tol * 0.4) * (1 + combo * 0.20);
    t.heat += C.heat;
    const mag = (0.35 + Math.random() * 0.65) * C.spin;
    t.grain += (Math.random() < 0.5 ? -1 : 1) * mag;
    t.flash = 0.6;
    floats.push({ x: t.x, y: t.y - t.r - 8, text: combo > 1 ? '×' + combo : '', sub: '', life: 0.6, col: '#7dd8ff' });
    if (t.progress >= 1 && !t.done) { t.progress = 1; t.done = true; cleared(t); }
  }

  /* ---------------- tutorial ---------------- */
  let TUT = [];
  function buildTut() {
    TUT = [
      { cap: 'Match the colour. Purple snarl, purple comb — press 2 or tap the tool. Then stroke ALONG the white arrows, right across and out the other side.',
        make: () => [newTangle(258, 430, 40, 'mat')], done: ts => ts.every(t => t.progress >= 1) },
      { cap: 'Every stroke that lands kicks the grain a random way. Re-read the arrows before each stroke. Amber snarl, amber brush — press 1.',
        make: () => [newTangle(346, 424, 40, 'fluff')], done: ts => ts.every(t => t.progress >= 1) },
      { cap: 'This one is pinned under the other. It shows no grain and will not budge. Clear the top one first — then the one underneath opens up.',
        make: () => { const u = newTangle(276, 442, 36, 'burr'); u.lockedBy = 1; return [u, newTangle(322, 418, 34, 'fluff')]; },
        done: ts => tutUnlocked || ts.every(t => t.progress >= 1) },
      { cap: 'Last thing. Drag ACROSS the arrows on purpose. That is what hurting her feels like — she yelps, you lose seconds, and enough of it tears fur out for good.',
        make: () => [newTangle(300, 436, 44, 'burr')], done: ts => tutYelped || ts.every(t => t.progress >= 1) }
    ];
  }
  function startTutorial() { phase = 'tutorial'; tutBeat = 0; buildTut(); loadTutBeat(); hideOverlay(); }
  function loadTutBeat() {
    const b = TUT[tutBeat];
    tangles = b.make(); tutCaption = b.cap;
    tutYelped = false; tutUnlocked = false; tutHold = -1; combo = 0;
  }
  function tutorialTick(dt) {
    if (tutHold >= 0) {
      tutHold -= dt;
      if (tutHold <= 0) {
        tutHold = -1; tutBeat++;
        if (tutBeat >= TUT.length) { tutDone = true; showBio(); } else loadTutBeat();
      }
      return;
    }
    if (TUT[tutBeat].done(tangles)) tutHold = 1.1;
  }

  /* ---------------- scoring ---------------- */
  function scoreOf(res) {
    if (!res) return 0;
    let s = 200 - res.left * 22 - res.patches * 45;
    if (res.prize) s += 35;
    if (res.left === 0 && res.patches === 0) s += 30;
    return Math.max(0, Math.round(s));
  }
  function judgeFor(s) { return JUDGE.find(j => s >= j.min); }

  /* ---------------- the pageant ---------------- */
  function startPageant() {
    phase = 'pageant';
    hideOverlay();
    const cards = run.map((res, i) => {
      const r = res || { left: 0, patches: 0, prize: null };
      const s = scoreOf(r);
      return { lv: i, res: r, score: s, judge: judgeFor(s),
        canvas: (r.patchList && r.patchList.length) ? buildCatCanvas(i, r.patchList, 4242 + i * 17) : cleanLayer(i), shown: 0 };
    });
    pg = { step: 0, t: 0, cards, total: 0, tally: 0, typed: 0, done: false };
  }
  function previewPageant() {
    run = CATS.map((C, i) => {
      const nPatch = Math.random() < 0.45 ? 1 + Math.floor(Math.random() * 2) : 0;
      const left = Math.random() < 0.5 ? 0 : Math.floor(Math.random() * 4);
      const patchList = [];
      const rnd = mulberry(500 + i * 31);
      const spots = genAnchorsFor(i, rnd, nPatch);
      spots.forEach(sp => patchList.push({ x: sp.x, y: sp.y, r: 34, seed: rnd() * 100 }));
      return { left, patches: nPatch, patchList, prize: left === 0 ? pick(PRIZES).id : null };
    });
    startPageant();
  }
  // anchors for an arbitrary cat, used by the preview to scatter fake bald patches
  function genAnchorsFor(lv, rnd, want) {
    const keep = LV; LV = lv;
    const a = want > 0 ? genAnchors(rnd, want) : [];
    LV = keep;
    return a;
  }

  const PG_TITLE = 2.4, PG_CAT = 2.9, PG_TOTAL = 3.4;
  function pageantTick(dt) {
    pg.t += dt;
    if (pg.step === 0 && pg.t > PG_TITLE) { pg.step = 1; pg.t = 0; }
    else if (pg.step >= 1 && pg.step <= 5) {
      const card = pg.cards[pg.step - 1];
      card.shown = clamp(pg.t / 0.55, 0, 1);
      if (pg.t > PG_CAT) { pg.total += card.score; pg.step++; pg.t = 0; }
    } else if (pg.step === 6) {
      pg.tally = Math.round(pg.total * easeOut(pg.t / 1.9));
      if (pg.t > PG_TOTAL) { pg.step = 7; pg.t = 0; showBoard(); }
    }
  }

  function drawPageant(time) {
    const P = pg;
    // stage floor and back wall
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1a1230'); g.addColorStop(0.62, '#241a3e'); g.addColorStop(1, '#0d0a18');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(240,180,106,0.06)';
    ctx.beginPath(); ctx.moveTo(120, H); ctx.lineTo(200, 330); ctx.lineTo(400, 330); ctx.lineTo(480, H); ctx.closePath(); ctx.fill();

    // curtains, parting on the title beat
    const open = P.step === 0 ? easeOut(P.t / PG_TITLE) : 1;
    const cw = 250 - open * 190;
    [0, 1].forEach(side => {
      ctx.save();
      if (side) { ctx.translate(W, 0); ctx.scale(-1, 1); }
      const cg = ctx.createLinearGradient(0, 0, cw, 0);
      cg.addColorStop(0, '#5c1526'); cg.addColorStop(1, '#8a2038');
      ctx.fillStyle = cg; ctx.fillRect(0, 0, cw, H);
      ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 5;
      for (let i = 1; i < 7; i++) {
        const x = (cw / 7) * i;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 6, H); ctx.stroke();
      }
      ctx.restore();
    });
    // pelmet
    ctx.fillStyle = '#8a2038'; ctx.fillRect(0, 0, W, 46);
    ctx.fillStyle = '#5c1526';
    for (let i = 0; i < 10; i++) {
      ctx.beginPath(); ctx.arc(30 + i * 60, 46, 32, 0, Math.PI); ctx.fill();
    }
    ctx.fillStyle = '#f0b46a'; ctx.textAlign = 'center';
    ctx.font = '700 17px "Space Grotesk", sans-serif';
    ctx.fillText('THE 47TH ANNUAL BEST IN SHED', W / 2, 30);

    if (P.step === 0) {
      const a = clamp(P.t / 0.7, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#eef0fb'; ctx.font = '700 40px "Space Grotesk", sans-serif';
      ctx.fillText('JUDGING', W / 2, 300);
      ctx.fillStyle = '#a8adcf'; ctx.font = '300 19px Sora, sans-serif';
      ctx.fillText('Five cats. One rosette. No refunds.', W / 2, 336);
      ctx.globalAlpha = 1;
      return;
    }

    // cats already judged, waiting along the back
    const done = Math.min(5, P.step - 1);
    for (let i = 0; i < done; i++) {
      const card = P.cards[i];
      const x = 78 + i * 112, y = 452;
      ctx.save(); ctx.translate(x, y); ctx.scale(0.2, 0.2); ctx.translate(-300, -400);
      ctx.drawImage(card.canvas, 0, 0);
      drawEars(ctx, card.lv, 0);
      drawFace(ctx, card.lv, card.score >= 205 ? 'happy' : card.score < 120 ? 'sad' : 'calm', time, 0);
      if (card.res.prize) drawPrizeFor(ctx, card.lv, card.res.prize);
      ctx.restore();
      ctx.fillStyle = '#6d7299'; ctx.font = '600 10px "Space Grotesk", sans-serif';
      ctx.fillText(CATS[i].name.toUpperCase(), x, y + 30);
    }

    if (P.step >= 1 && P.step <= 5) {
      const card = P.cards[P.step - 1];
      const C = CATS[card.lv];
      const slide = easeOut(card.shown);
      const cx = -120 + slide * (W / 2 + 120);

      // spotlight
      ctx.save();
      const sp = ctx.createRadialGradient(W / 2, 300, 20, W / 2, 300, 250);
      sp.addColorStop(0, 'rgba(255,235,190,0.20)'); sp.addColorStop(1, 'rgba(255,235,190,0)');
      ctx.fillStyle = sp; ctx.beginPath(); ctx.ellipse(W / 2, 320, 230, 250, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(cx, 300); ctx.scale(0.46, 0.46); ctx.translate(-300, -360);
      ctx.drawImage(card.canvas, 0, 0);
      drawEars(ctx, card.lv, 0);
      drawFace(ctx, card.lv, card.score >= 205 ? 'happy' : card.score < 120 ? 'sad' : 'calm', time, 0);
      // whatever snarls she went up with
      for (let i = 0; i < card.res.left; i++) {
        const a = card.lv * 1.7 + i * 2.1;
        const S = CATS[card.lv].shape.body;
        ctx.save();
        ctx.translate(S.x + Math.cos(a) * S.rx * 0.5, S.y + Math.sin(a) * S.ry * 0.5);
        snarlIcon(ctx, ['fluff', 'mat', 'burr'][i % 3], 26);
        ctx.restore();
      }
      if (card.res.prize) drawPrizeFor(ctx, card.lv, card.res.prize);
      ctx.restore();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#eef0fb'; ctx.font = '700 30px "Space Grotesk", sans-serif';
      ctx.globalAlpha = slide;
      ctx.fillText(C.name.toUpperCase(), W / 2, 106);
      ctx.fillStyle = '#a8adcf'; ctx.font = '300 14px Sora, sans-serif';
      ctx.fillText(C.breed, W / 2, 128);
      ctx.globalAlpha = 1;

      // the judge's verdict types itself in
      if (P.t > 0.8) {
        const chars = Math.floor((P.t - 0.8) * 46);
        ctx.fillStyle = '#f0b46a'; ctx.font = 'italic 300 17px Sora, sans-serif';
        ctx.fillText(card.judge.line.slice(0, chars), W / 2, 546);
      }
      // stars land one at a time
      if (P.t > 1.5) {
        for (let i = 0; i < 5; i++) {
          const pop = clamp((P.t - 1.5 - i * 0.13) / 0.25, 0, 1);
          if (pop <= 0) continue;
          const lit = i < card.judge.stars;
          drawStar(ctx, W / 2 - 96 + i * 48, 588, 17 * easeOut(pop), lit ? '#ffd76b' : 'rgba(255,255,255,0.16)');
        }
      }
      // running total, top right
      ctx.textAlign = 'right';
      ctx.fillStyle = '#6d7299'; ctx.font = '600 12px "Space Grotesk", sans-serif';
      ctx.fillText('RUNNING TOTAL', W - 22, 74);
      ctx.fillStyle = '#7dd8ff'; ctx.font = '700 24px "Space Grotesk", sans-serif';
      ctx.fillText(String(P.total), W - 22, 100);
      ctx.textAlign = 'center';
    }

    if (P.step >= 6) {
      // all five on the bench
      for (let i = 0; i < 5; i++) {
        const card = P.cards[i];
        const x = 78 + i * 112, y = 400;
        const pop = easeOut(clamp((P.t - i * 0.1) / 0.5, 0, 1));
        ctx.save(); ctx.translate(x, y + (1 - pop) * 60); ctx.globalAlpha = pop;
        ctx.scale(0.24, 0.24); ctx.translate(-300, -400);
        ctx.drawImage(card.canvas, 0, 0);
        drawEars(ctx, card.lv, 0);
        drawFace(ctx, card.lv, card.score >= 205 ? 'happy' : card.score < 120 ? 'sad' : 'calm', time, 0);
        if (card.res.prize) drawPrizeFor(ctx, card.lv, card.res.prize);
        ctx.restore();
        ctx.globalAlpha = pop;
        ctx.fillStyle = '#6d7299'; ctx.font = '600 10px "Space Grotesk", sans-serif';
        ctx.fillText(CATS[i].name.toUpperCase(), x, y + 34);
        for (let s = 0; s < card.judge.stars; s++) drawStar(ctx, x - 18 + s * 9, y + 48, 4, '#ffd76b');
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = '#6d7299'; ctx.font = '600 13px "Space Grotesk", sans-serif';
      ctx.fillText('FINAL SCORE', W / 2, 528);
      ctx.fillStyle = '#eef0fb'; ctx.font = '700 62px "Space Grotesk", sans-serif';
      ctx.fillText(String(pg.tally), W / 2, 588);
    }
  }
  function drawStar(c, x, y, r, col) {
    c.save(); c.translate(x, y); c.fillStyle = col; c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const rr = i % 2 ? r * 0.45 : r;
      i ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath(); c.fill(); c.restore();
  }
  function drawPrizeFor(c, lv, id) {
    const h = CATS[lv].shape.head;
    c.save();
    c.translate(h.x, h.y); c.scale(h.rx / 104, h.ry / 96); c.translate(-300, -258);
    drawPrize(c, id); c.restore();
  }

  /* ---------------- loop ---------------- */
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - lastT) / 1000 || 0);
    lastT = now;
    const time = now / 1000;
    const C = cat();

    if (active()) {
      if (phase === 'play') timeLeft = Math.max(0, timeLeft - dt);
      lockNag = Math.max(0, lockNag - dt);
      tangles.forEach(t => {
        t.flash = Math.max(0, t.flash - dt * 2.5);
        t.unlockPop = Math.max(0, t.unlockPop - dt * 1.4);
        t.heat = Math.max(0, t.heat - 0.55 * dt);
        t.strain = Math.max(0, t.strain - 0.5 * dt);
        if (t.progress < 1 && !isLocked(t)) {
          t.idle += dt;
          if (phase === 'play' && C.retighten && t.idle > 3) t.progress = Math.max(0, t.progress - C.retighten * dt);
        }
      });
      comboTimer -= dt; if (comboTimer <= 0) combo = 0;
      if (phase === 'tutorial') { tutorialTick(dt); syncHud(); }
      else {
        if (!lowWarned && timeLeft <= 12 && tangles.some(t => t.progress < 1)) { lowWarned = true; say(BARKS.low); }
        if (tangles.every(t => t.progress >= 1)) finish(true);
        else if (timeLeft <= 0) finish(false);
        syncHud();
      }
    }
    if (phase === 'pageant' && pg && pg.step < 7) pageantTick(dt);

    moodTimer -= dt;
    if (moodTimer <= 0) mood = active() ? 'work' : 'calm';
    earFlat = Math.max(0, earFlat - dt * 1.6);
    blinkTimer -= dt;
    if (blinkTimer <= 0) { blink = 0.12; blinkTimer = 2.4 + Math.random() * 3; }
    blink = Math.max(0, blink - dt);
    barkTimer = Math.max(0, barkTimer - dt);
    shake = Math.max(0, shake - dt * 3.5);
    tint = Math.max(0, tint - dt * 2.2);
    floats.forEach(f => { f.life -= dt; f.y -= 26 * dt; });
    floats = floats.filter(f => f.life > 0);
    sparks.forEach(s => { s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 320 * dt; });
    sparks = sparks.filter(s => s.life > 0);

    draw(time);
  }

  function draw(time) {
    ctx.clearRect(0, 0, W, H);
    if ((phase === 'pageant' || phase === 'board') && pg) { drawPageant(time); return; }

    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 12, (Math.random() - 0.5) * shake * 12);
    if (catLayer) ctx.drawImage(catLayer, 0, 0);
    drawEars(ctx, LV, earFlat);
    drawFace(ctx, LV, mood, time, blink);
    tangles.forEach(t => drawTangle(ctx, t, time));
    if (prizeChosen) drawPrizeFor(ctx, LV, prizeChosen);
    ctx.restore();

    if (tint > 0) { ctx.fillStyle = 'rgba(255,107,125,' + (tint * 0.22).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
    sparks.forEach(s => {
      ctx.globalAlpha = Math.max(0, s.life); ctx.fillStyle = s.col;
      ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    floats.forEach(f => {
      ctx.globalAlpha = Math.min(1, f.life); ctx.textAlign = 'center'; ctx.fillStyle = f.col;
      ctx.font = '700 26px "Space Grotesk", sans-serif'; ctx.fillText(f.text, f.x, f.y);
      if (f.sub) { ctx.font = '600 17px "Space Grotesk", sans-serif'; ctx.fillText(f.sub, f.x, f.y + 22); }
    });
    ctx.globalAlpha = 1;

    if (combo > 1 && phase === 'play') {
      ctx.textAlign = 'left'; ctx.fillStyle = '#7dd8ff';
      ctx.font = '700 30px "Space Grotesk", sans-serif'; ctx.fillText('×' + combo, 20, 44);
      ctx.fillStyle = 'rgba(125,216,255,0.3)';
      ctx.fillRect(20, 54, 72 * Math.max(0, comboTimer), 4);
    }
    if (phase === 'play') {
      ctx.textAlign = 'right'; ctx.fillStyle = '#6d7299';
      ctx.font = '600 15px "Space Grotesk", sans-serif';
      ctx.fillText(cat().name.toUpperCase() + ' · CAT ' + (LV + 1) + ' OF 5', W - 20, 42);
    }
    if (phase === 'tutorial') drawStrip(tutCaption, 'LESSON ' + (tutBeat + 1) + ' OF ' + TUT.length, '#eef0fb');
    else if (barkTimer > 0) drawStrip(bark, null, '#f0b46a');
  }

  function drawStrip(text, label, col) {
    const pad = 16, boxW = W - 44;
    ctx.font = (label ? '400 17px Sora' : 'italic 400 17px Sora') + ', sans-serif';
    const lines = wrapLines(ctx, text, boxW - pad * 2 - (label ? 0 : 40));
    const boxH = lines.length * 24 + pad * 2 + (label ? 26 : 0);
    const bx = 22, by = H - boxH - 16;
    ctx.globalAlpha = label ? 1 : Math.min(1, barkTimer / 0.4);
    ctx.fillStyle = 'rgba(10,13,24,0.92)'; ctx.strokeStyle = '#2a2f52'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(bx, by, boxW, boxH, 14); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'left';
    let tx = bx + pad, ty = by + pad + 16;
    if (label) {
      ctx.fillStyle = '#6d7299'; ctx.font = '600 12px "Space Grotesk", sans-serif';
      ctx.fillText(label, bx + pad, by + pad + 6);
      ty = by + pad + 34;
    } else {
      ctx.strokeStyle = '#f0b46a'; ctx.lineWidth = 2.4;
      const gy = by + boxH / 2;
      ctx.beginPath(); ctx.arc(bx + pad + 8, gy, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(bx + pad + 26, gy, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx + pad + 16, gy); ctx.lineTo(bx + pad + 18, gy); ctx.stroke();
      tx = bx + pad + 42;
    }
    ctx.fillStyle = col;
    ctx.font = (label ? '400 17px Sora' : 'italic 400 17px Sora') + ', sans-serif';
    lines.forEach((l, i) => ctx.fillText(l, tx, ty + i * 24));
    ctx.globalAlpha = 1;
  }
  function wrapLines(c, text, maxW) {
    const words = text.split(' '); const out = []; let line = '';
    words.forEach(w => {
      const t = line ? line + ' ' + w : w;
      if (c.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    });
    if (line) out.push(line);
    return out;
  }

  /* ---------------- accessories ---------------- */
  function drawPrize(c, id) {
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    if (id === 'hat') {
      c.fillStyle = '#1b2040'; c.strokeStyle = '#2a2f52'; c.lineWidth = 3;
      c.beginPath(); c.ellipse(300, 172, 88, 17, -0.06, 0, Math.PI * 2); c.fill(); c.stroke();
      c.save(); c.translate(300, 130); c.rotate(-0.07);
      c.fillStyle = '#141830';
      c.beginPath(); c.rect(-42, -44, 84, 86); c.fill(); c.stroke();
      c.fillStyle = '#b48bff'; c.fillRect(-42, 16, 84, 15); c.restore();
    } else if (id === 'bow') {
      c.fillStyle = '#ff6b7d';
      c.beginPath(); c.moveTo(300, 366); c.lineTo(250, 340); c.lineTo(250, 392); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(300, 366); c.lineTo(350, 340); c.lineTo(350, 392); c.closePath(); c.fill();
      c.fillStyle = '#c9455a'; c.beginPath(); c.ellipse(300, 366, 13, 16, 0, 0, Math.PI * 2); c.fill();
    } else if (id === 'crown') {
      const cols = ['#ff9ec4', '#ffd76b', '#a8e6a1', '#9ec4ff', '#e0a8ff'];
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI * 0.94 + (i / 6) * Math.PI * 0.88;
        const fx = 300 + Math.cos(a) * 112, fy = 258 + Math.sin(a) * 104;
        c.fillStyle = cols[i % cols.length];
        for (let p = 0; p < 5; p++) {
          const pa = (p / 5) * Math.PI * 2;
          c.beginPath(); c.arc(fx + Math.cos(pa) * 8, fy + Math.sin(pa) * 8, 7, 0, Math.PI * 2); c.fill();
        }
        c.fillStyle = '#ffd76b'; c.beginPath(); c.arc(fx, fy, 5, 0, Math.PI * 2); c.fill();
      }
    } else if (id === 'shades') {
      c.fillStyle = '#12160f'; c.strokeStyle = '#12160f'; c.lineWidth = 6;
      c.beginPath(); c.roundRect(232, 228, 58, 40, 11); c.fill();
      c.beginPath(); c.roundRect(310, 224, 58, 40, 11); c.fill();
      c.beginPath(); c.moveTo(290, 244); c.lineTo(310, 242); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(242, 260); c.lineTo(262, 236); c.stroke();
      c.beginPath(); c.moveTo(320, 256); c.lineTo(340, 232); c.stroke();
    } else if (id === 'pearls') {
      c.fillStyle = '#f6e3c4'; c.strokeStyle = 'rgba(120,100,70,0.5)'; c.lineWidth = 1.5;
      for (let i = 0; i <= 13; i++) {
        const t = i / 13, x = 228 + t * 144, y = 352 + Math.sin(t * Math.PI) * 28;
        c.beginPath(); c.arc(x, y, 8.5, 0, Math.PI * 2); c.fill(); c.stroke();
      }
    } else if (id === 'monocle') {
      c.strokeStyle = '#ffd76b'; c.lineWidth = 5;
      c.beginPath(); c.arc(340, 244, 30, 0, Math.PI * 2); c.stroke();
      c.fillStyle = 'rgba(200,235,255,0.22)';
      c.beginPath(); c.arc(340, 244, 28, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(326, 256); c.lineTo(346, 232); c.stroke();
      c.strokeStyle = '#ffd76b'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(362, 262); c.quadraticCurveTo(392, 300, 372, 344); c.stroke();
    } else if (id === 'tiara') {
      c.fillStyle = '#ffd76b'; c.strokeStyle = '#c9a33f'; c.lineWidth = 2;
      c.beginPath();
      c.moveTo(238, 196); c.lineTo(258, 152); c.lineTo(276, 188);
      c.lineTo(300, 138); c.lineTo(324, 188); c.lineTo(342, 152);
      c.lineTo(362, 196); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#7dd8ff';
      [[258, 168], [300, 158], [342, 168]].forEach(([gx, gy]) => {
        c.beginPath(); c.arc(gx, gy, 7, 0, Math.PI * 2); c.fill();
      });
    } else if (id === 'bandana') {
      c.fillStyle = '#e05a4a';
      c.beginPath(); c.moveTo(236, 344); c.quadraticCurveTo(300, 372, 364, 344);
      c.lineTo(300, 412); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 8; i++) {
        const bx = 258 + (i % 4) * 28, by = 356 + Math.floor(i / 4) * 22;
        c.beginPath(); c.arc(bx, by, 4, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = '#b8412f'; c.beginPath(); c.ellipse(300, 348, 20, 12, 0, 0, Math.PI * 2); c.fill();
    } else if (id === 'party') {
      c.save(); c.translate(300, 0); c.rotate(0.14); c.translate(-300, 0);
      const gr = c.createLinearGradient(268, 100, 332, 190);
      gr.addColorStop(0, '#ff9ec4'); gr.addColorStop(1, '#b48bff');
      c.fillStyle = gr;
      c.beginPath(); c.moveTo(300, 88); c.lineTo(344, 194); c.lineTo(256, 194); c.closePath(); c.fill();
      c.strokeStyle = '#fffdf2'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(272, 160); c.lineTo(330, 148); c.stroke();
      c.beginPath(); c.moveTo(282, 130); c.lineTo(320, 122); c.stroke();
      c.fillStyle = '#ffd76b';
      for (let p = 0; p < 6; p++) {
        const pa = (p / 6) * Math.PI * 2;
        c.beginPath(); c.arc(300 + Math.cos(pa) * 10, 84 + Math.sin(pa) * 10, 9, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    }
    c.restore();
  }
  function snarlIcon(c, type, r) {
    const S = SNARLS[type];
    c.strokeStyle = S.col; c.lineWidth = 2.4; c.lineCap = 'round';
    const spikes = type === 'burr' ? 14 : 10;
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2;
      c.beginPath(); c.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
      c.lineTo(Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35); c.stroke();
    }
    const g = c.createRadialGradient(-5, -5, 3, 0, 0, r);
    g.addColorStop(0, S.core); g.addColorStop(1, S.edge);
    c.fillStyle = g;
    c.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2, rr = r * (0.86 + 0.2 * Math.sin(a * 4 + 2));
      i ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath(); c.fill();
    c.strokeStyle = S.col; c.lineWidth = 2.4; c.stroke();
  }

  /* ---------------- overlay ----------------
     One overlay does every screen — story cards, bios, the accessory pick and
     the leaderboard — so each screen shows the pieces it needs and hides the
     rest. The board, entry and final-score markup is the shared shape every
     game on the site uses, which is what lets attachBoardUI() wire itself up
     without knowing anything about this game. */
  const overlay   = document.getElementById('overlay');
  const ovScene   = document.getElementById('ov-scene');
  const ovTitle   = document.getElementById('ov-title');
  const ovSay     = document.getElementById('ov-say');
  const ovText    = document.getElementById('ov-body');
  const ovBio     = document.getElementById('ov-bio');
  const ovDots    = document.getElementById('ov-dots');
  const ovKey     = document.getElementById('ov-key');
  const ovPrizes  = document.getElementById('ov-prizes');
  const ovFinal   = document.getElementById('ov-final');
  const goBtn     = document.getElementById('go');
  const skipBtn   = document.getElementById('skip');
  const seeBoard  = document.getElementById('see-board');
  const ladyCtx   = document.getElementById('lady').getContext('2d');

  /* ?preview jumps straight to the judging with five random cats, so the
     ending can be looked at without playing five rounds. A preview run is
     never allowed to post a score — it did not earn one. */
  const PREVIEW = new URLSearchParams(location.search).has('preview');

  const board = makeBoard({
    id: 'ff808181a067127101a06e6e91c314ae',
    localKey: 'best-in-shed-board',
    storeName: 'Best in Shed high scores'
  });
  let finalTotal = 0;
  const ui = attachBoardUI(board, () => finalTotal);

  function showOverlay() { overlay.hidden = false; }
  function hideOverlay() { overlay.hidden = true; }
  function resetOverlay() {
    ovScene.hidden = true; ovBio.hidden = true; ovDots.hidden = true;
    ovKey.hidden = true; ovPrizes.hidden = true; ovFinal.hidden = true;
    document.getElementById('entry').hidden = true;
    goBtn.hidden = true; skipBtn.hidden = true; seeBoard.hidden = true;
    ui.closePeek();
    ovTitle.textContent = ''; ovSay.textContent = ''; ovText.innerHTML = '';
  }

  function showStory() {
    phase = 'story';
    resetOverlay();
    const s = STORY[storyStep];
    ovScene.hidden = false;
    ovTitle.textContent = s.title;
    ovText.textContent = s.text;
    drawLady(ladyCtx, s.mood);
    ovDots.hidden = false;
    ovDots.innerHTML = STORY.map((_, i) => '<i class="' + (i === storyStep ? 'on' : '') + '"></i>').join('');
    if (storyStep === STORY.length - 1) ovKey.hidden = false;
    goBtn.hidden = false;
    goBtn.textContent = storyStep === STORY.length - 1 ? 'Pick up the brush' : 'Go on';
    skipBtn.hidden = false; skipBtn.textContent = 'Skip the intro';
    seeBoard.hidden = false;
    showOverlay();
  }

  function showBio() {
    phase = 'bio';
    resetOverlay();
    const C = cat();
    timeLeft = C.time; patches = []; floats = []; sparks = [];
    prizeChosen = null; combo = 0; mood = 'calm'; bark = ''; barkTimer = 0; lowWarned = false;
    catLayer = cleanLayer(LV);
    makeTangles(); syncHud();

    ovBio.hidden = false;
    document.getElementById('bio-name').textContent = C.name;
    document.getElementById('bio-breed').textContent = 'Cat ' + (LV + 1) + ' of 5 · ' + C.breed;
    document.getElementById('bio-text').textContent = C.bio;
    document.getElementById('bio-fact').textContent = C.fact;
    document.getElementById('bio-fact2').textContent = C.fact2;
    portrait(document.getElementById('bio-cat').getContext('2d'), LV);
    goBtn.hidden = false; goBtn.textContent = 'Groom ' + C.name;
    showOverlay();
  }

  function portrait(c, lv) {
    const cw = c.canvas.width, ch = c.canvas.height;
    c.clearRect(0, 0, cw, ch);
    c.fillStyle = '#0f1326'; c.fillRect(0, 0, cw, ch);
    c.save();
    c.translate(cw / 2, ch / 2); c.scale(cw / 620, cw / 620); c.translate(-300, -360);
    c.drawImage(cleanLayer(lv), 0, 0);
    drawEars(c, lv, 0);
    drawFace(c, lv, 'calm', 0, 0);
    c.restore();
  }

  function startRound() {
    phase = 'play'; timeLeft = cat().time; lowWarned = false;
    makeTangles(); setMood('work', 0.5); hideOverlay(); syncHud();
    canvas.focus({ preventScroll: true });
  }

  function finish(onTime) {
    finishedOnTime = onTime;
    if (onTime) {
      phase = 'prize'; setMood('happy', 99);
      resetOverlay();
      ovScene.hidden = false;
      ovTitle.textContent = 'Every snarl out — pick her prize';
      ovSay.textContent = pick(patches.length ? CLEAR_LINES.scuffed : CLEAR_LINES.perfect);
      ovText.textContent = 'One accessory. It stays on her all the way to judging, and the judges do notice.';
      drawLady(ladyCtx, patches.length ? 'excited' : 'pleased');
      ovPrizes.hidden = false;
      showOverlay();
    } else showResult();
  }

  function showResult() {
    phase = 'result';
    const left = tangles.filter(t => t.progress < 1).length;
    run[LV] = { left, patches: patches.length, patchList: patches.slice(), prize: prizeChosen };
    let verdict, cls, lm, line;
    if (left === 0 && patches.length === 0) { verdict = 'Immaculate.'; cls = 'great'; lm = 'pleased'; line = pick(CLEAR_LINES.perfect); }
    else if (left === 0 && patches.length <= 1) { verdict = 'Presentable, if the judges stand back.'; cls = 'ok'; lm = 'excited'; line = pick(CLEAR_LINES.scuffed); }
    else if (left <= 2 && patches.length === 0) { verdict = 'A bit rough around the edges.'; cls = 'bad'; lm = 'excited'; line = pick(CLEAR_LINES.timeout); }
    else { verdict = 'Frankly feral.'; cls = 'grim'; lm = 'horrified'; line = pick(CLEAR_LINES.feral); }

    setMood(cls === 'great' || cls === 'ok' ? 'happy' : 'sad', 99);
    resetOverlay();
    drawLady(ladyCtx, lm);
    ovScene.hidden = false;
    ovTitle.textContent = finishedOnTime ? cat().name + ' heads to the bench' : 'Time. She goes up as she is.';
    ovSay.textContent = line;
    ovText.innerHTML = '<span class="verdict ' + cls + '">' + verdict + '</span><br>'
      + (left ? left + ' snarl' + (left === 1 ? '' : 's') + ' still in her coat. ' : 'Coat clear. ')
      + (patches.length ? patches.length + ' bald patch' + (patches.length === 1 ? '' : 'es') + '. ' : 'No fur lost. ')
      + (prizeChosen ? 'Wearing the ' + PRIZES.find(p => p.id === prizeChosen).name.toLowerCase() + '.' : 'No accessory earned.');
    goBtn.hidden = false;
    goBtn.textContent = LV < CATS.length - 1 ? 'Bring out ' + CATS[LV + 1].name : 'To the judging';
    showOverlay();
  }

  /* Called by the judging sequence once the totals have finished counting up.
     This is the only screen in the game that shows a number. */
  async function showBoard() {
    phase = 'board';
    finalTotal = pg.cards.reduce((a, c) => a + c.score, 0);
    resetOverlay();
    ovScene.hidden = false;
    ovTitle.textContent = finalTotal >= 1000 ? 'Best in Shed' : 'The judges have decided';
    ovSay.textContent = finalTotal >= 1000 ? '"We are getting a bigger shelf."'
      : finalTotal >= 750 ? '"Respectable. We will be back."'
      : '"Next year. Next year we start earlier."';
    ovText.textContent = PREVIEW
      ? 'Preview run — these five were scored at random, so nothing is going on the board.'
      : 'Five cats, one rosette, no refunds.';
    drawLady(ladyCtx, finalTotal >= 900 ? 'pleased' : finalTotal >= 600 ? 'excited' : 'horrified');
    ovFinal.hidden = false;
    document.getElementById('final-score').textContent = String(finalTotal);
    goBtn.hidden = false; goBtn.textContent = 'Play the whole thing again';
    seeBoard.hidden = false;
    showOverlay();
    if (PREVIEW) await ui.render();
    else await ui.finish();
  }

  function fullReset() {
    LV = 0; storyStep = 0; tutDone = false;
    run = [null, null, null, null, null];
    pg = null; finalTotal = 0;
    catLayer = cleanLayer(0); patches = []; makeTangles(); syncHud();
    showStory();
  }

  goBtn.addEventListener('click', () => {
    if (phase === 'story') {
      if (storyStep < STORY.length - 1) { storyStep++; showStory(); }
      else if (!tutDone) startTutorial();
      else showBio();
    } else if (phase === 'bio') startRound();
    else if (phase === 'result') {
      if (LV < CATS.length - 1) { LV++; showBio(); } else startPageant();
    } else if (phase === 'board') fullReset();
  });
  skipBtn.addEventListener('click', () => {
    if (phase === 'story') { storyStep = 0; tutDone = true; showBio(); }
  });

  /* ---------------- the tools ----------------
     Under the stage rather than beside it: this is mostly played with a thumb. */
  function buildTools() {
    const host = document.getElementById('toolbar');
    host.innerHTML = '';
    TOOL_KEYS.forEach((k, i) => {
      const T = TOOLS[k];
      const b = document.createElement('button');
      b.className = 'tool'; b.type = 'button';
      b.style.setProperty('--tc', T.col);
      b.setAttribute('aria-pressed', String(k === tool));
      b.dataset.tool = k;
      const cv = document.createElement('canvas'); cv.width = 72; cv.height = 72;
      drawToolIcon(cv.getContext('2d'), k);
      const txt = document.createElement('div');
      txt.innerHTML = '<b>' + T.name + '</b><em>' + T.hint + '</em>';
      b.append(cv, txt);
      b.addEventListener('click', () => setTool(k));
      host.appendChild(b);
    });
  }
  function setTool(k) {
    tool = k;
    document.querySelectorAll('.tool').forEach(el =>
      el.setAttribute('aria-pressed', String(el.dataset.tool === k)));
  }
  function drawToolIcon(c, k) {
    const T = TOOLS[k];
    c.clearRect(0, 0, 72, 72); c.lineCap = 'round'; c.lineJoin = 'round';
    c.fillStyle = T.col;
    if (k === 'brush') {
      c.beginPath(); c.roundRect(12, 32, 48, 19, 6); c.fill();
      c.beginPath(); c.roundRect(26, 49, 20, 15, 5); c.fill();
      c.strokeStyle = '#eef0fb'; c.lineWidth = 3.4;
      for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(16 + i * 8, 32); c.lineTo(16 + i * 8, 14); c.stroke(); }
    } else if (k === 'comb') {
      c.beginPath(); c.roundRect(10, 40, 52, 13, 4); c.fill();
      c.strokeStyle = '#eef0fb'; c.lineWidth = 2.4;
      for (let i = 0; i < 13; i++) { c.beginPath(); c.moveTo(13 + i * 4, 40); c.lineTo(13 + i * 4, 15); c.stroke(); }
    } else {
      c.beginPath(); c.roundRect(15, 20, 42, 37, 11); c.fill();
      c.fillStyle = '#0a0d18';
      for (let r = 0; r < 3; r++) for (let q = 0; q < 4; q++) {
        c.beginPath(); c.arc(24 + q * 8, 29 + r * 10, 2.8, 0, Math.PI * 2); c.fill();
      }
    }
  }

  function buildKey() {
    ovKey.innerHTML = '';
    Object.keys(SNARLS).forEach(k => {
      const S = SNARLS[k], T = TOOLS[S.tool];
      const row = document.createElement('div'); row.className = 'key-row';
      const c1 = document.createElement('canvas'); c1.width = 76; c1.height = 76;
      const g1 = c1.getContext('2d'); g1.translate(38, 38); snarlIcon(g1, k, 23);
      const d1 = document.createElement('div');
      d1.innerHTML = '<b>' + S.label + '</b><em>' + S.note + '</em>';
      const arw = document.createElement('div'); arw.className = 'arw'; arw.textContent = '→';
      const c2 = document.createElement('canvas'); c2.width = 76; c2.height = 76;
      const g2 = c2.getContext('2d'); g2.scale(76 / 72, 76 / 72); drawToolIcon(g2, S.tool);
      const d2 = document.createElement('div');
      d2.innerHTML = '<b style="color:' + T.col + '">' + T.name + '</b><em>key ' + (TOOL_KEYS.indexOf(S.tool) + 1) + '</em>';
      row.append(c1, d1, arw, c2, d2);
      ovKey.appendChild(row);
    });
  }

  function buildPrizes() {
    ovPrizes.innerHTML = '';
    PRIZES.forEach(p => {
      const b = document.createElement('button'); b.className = 'prize'; b.type = 'button';
      const cv = document.createElement('canvas'); cv.width = 116; cv.height = 92;
      const c = cv.getContext('2d');
      c.translate(58, 46); c.scale(0.29, 0.29); c.translate(-300, -244);
      c.fillStyle = '#d99a4c';
      c.beginPath(); c.ellipse(300, 258, 104, 96, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(246,227,196,0.7)';
      c.beginPath(); c.ellipse(300, 302, 58, 40, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#12160f';
      c.beginPath(); c.arc(262, 250, 10, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(340, 244, 3.4, 13, 0, 0, Math.PI * 2); c.fill();
      drawPrize(c, p.id);
      const label = document.createElement('b'); label.textContent = p.name;
      b.append(cv, label);
      b.addEventListener('click', () => { prizeChosen = p.id; showResult(); });
      ovPrizes.appendChild(b);
    });
  }

  function syncHud() {
    const T = cat().time;
    document.getElementById('hud-time').textContent = String(Math.ceil(timeLeft));
    document.getElementById('hud-time').classList.toggle('low', timeLeft <= 10);
    document.getElementById('timefill').style.width = (timeLeft / T * 100) + '%';
    document.getElementById('timebar').classList.toggle('low', timeLeft <= 10);
    document.getElementById('hud-left').textContent = String(tangles.filter(t => t.progress < 1).length);
    document.getElementById('hud-lock').textContent = String(tangles.filter(t => t.progress < 1 && isLocked(t)).length);
    document.getElementById('hud-patch').textContent = String(patches.length);
  }

  window.addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.key === '1') setTool('brush');
    if (e.key === '2') setTool('comb');
    if (e.key === '3') setTool('mitt');
    if (e.key === ' ' && !goBtn.hidden && !overlay.hidden) { e.preventDefault(); goBtn.click(); }
  });

  /* ---------------- boot ---------------- */
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  buildTools(); buildKey(); buildPrizes();
  catLayer = cleanLayer(0);
  makeTangles(); syncHud();
  if (PREVIEW) previewPageant(); else showStory();
  requestAnimationFrame(tick);
})();
