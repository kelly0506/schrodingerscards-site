/* ================= shared leaderboard =================

   Scores are shared: everyone who plays reads and writes the same list,
   with no account for anyone. It is one JSON document per game on a free
   public store that needs no key, fetched and rewritten by the page.

   Each game passes its own store id and its own local-storage key, so the
   boards are completely independent of one another — a score in one game
   can never appear on another's board.

   Two things this deliberately does not do:
   - It cannot stop someone forging a score. A browser game has no way to
     prove a number was earned. That is an accepted trade.
   - It does not trust what comes back. Anything could be in that document,
     so names are re-sanitised on the way in AND on the way out before they
     are ever put on the page.

   If the store is unreachable the board quietly falls back to this browser's
   own scores, so a service outage degrades rather than breaks. That fallback
   matters: as of 2026-09-02 the free store meters anonymous callers at 50
   requests a day, so a heavy session can exhaust it and the board will show
   this browser's own runs until the allowance resets. Every request is
   therefore worth avoiding — hence the caching below, which takes a round
   from roughly seven calls down to three. */
const SCORES_API = 'https://api.restful-api.dev/objects';
const BOARD_SIZE = 10;

/* Three letters is enough to spell something we would not want sitting on
   the site. Names are A-Z and 0-9 only, and these are refused outright. */
const BLOCKED = new Set([
  'ASS','FUK','FUC','FCK','CUM','TIT','SEX','FAG','JEW','NIG','KKK',
  'CNT','DIK','DIC','PIS','SHT','WTF','GAY','HOE','NAZ','POO','PEE'
]);
function cleanName(v){
  const n = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3);
  if (!n) return null;
  return BLOCKED.has(n) ? null : n;
}
function cleanRow(r){
  if (!r || typeof r !== 'object') return null;
  const name = cleanName(r.name);
  const score = Number(r.score);
  if (!name || !Number.isFinite(score) || score <= 0 || score > 1e6) return null;
  return { name, score: Math.floor(score), at: Number(r.at) || 0 };
}

function makeBoard({ id, localKey, storeName }){
  return {
    shared: false,
    rows: null,            // last list read from the store
    url(){ return id ? `${SCORES_API}/${id}` : null; },
    async init(){
      this.shared = false;
      if (!this.url()) return false;
      try {
        /* One request does both jobs: proves the store is reachable and
           gives us the list, instead of spending a call on each. */
        this.rows = await this.fetchShared();
        this.shared = true;
      } catch { this.shared = false; this.rows = null; }
      return this.shared;
    },
    localRows(){
      try { return JSON.parse(localStorage.getItem(localKey) || '[]'); } catch { return []; }
    },
    async fetchShared(){
      const res = await fetch(this.url(), { cache:'no-store' });
      if (!res.ok) throw new Error(res.status);
      const body = await res.json();
      const raw = (body && body.data && body.data.scores) || [];
      return raw.map(cleanRow).filter(Boolean).sort((a,b)=>b.score-a.score);
    },
    async top(refresh){
      if (this.shared){
        if (!refresh && this.rows) return this.rows.slice(0, BOARD_SIZE);
        try { this.rows = await this.fetchShared(); return this.rows.slice(0, BOARD_SIZE); }
        catch { this.shared = false; }
      }
      return this.localRows().map(cleanRow).filter(Boolean)
        .sort((a,b)=>b.score-a.score).slice(0, BOARD_SIZE);
    },
    /* Takes the list it was given rather than fetching its own copy. */
    qualifies(score, rows){
      if (score <= 0) return false;
      return rows.length < BOARD_SIZE || score > rows[rows.length-1].score;
    },
    async submit(name, score){
      const row = cleanRow({ name, score, at: Date.now() });
      if (!row) return null;
      if (this.shared){
        try {
          /* Re-read immediately before writing, so two people finishing at
             once are unlikely to overwrite each other. Not airtight — the
             store has no compare-and-set — but the window is tiny and the
             stakes are a cat game. */
          const current = await this.fetchShared();
          const next = [...current, row].sort((a,b)=>b.score-a.score).slice(0, 50);
          this.rows = next;
          const res = await fetch(this.url(), {
            method:'PUT',
            headers:{ 'Content-Type':'application/json' },
            body: JSON.stringify({ name: storeName, data:{ scores: next } })
          });
          if (res.ok) return row;
        } catch { /* fall through to local */ }
      }
      const rows = this.localRows();
      rows.push(row);
      localStorage.setItem(localKey, JSON.stringify(rows.sort((a,b)=>b.score-a.score).slice(0,50)));
      return row;
    }
  };
}

/* The board panel and the initials box are the same markup in every game, so
   the wiring is shared too. `getScore` is called when it needs the number. */
function attachBoardUI(board, getScore){
  let justEntered = null;
  const $ = id => document.getElementById(id);
  async function render(rows){
    rows = rows || await board.top();
    const wrap = $('board'), list = $('board-list');
    if (!rows.length){ wrap.hidden = true; return; }
    $('board-title').textContent = board.shared ? 'High scores' : 'Your best runs';
    list.innerHTML = rows.map((r,i)=>{
      const mine = justEntered && r.name===justEntered.name && r.score===justEntered.score;
      return `<li class="${mine?'you':''}"><span class="rank">${i+1}</span>` +
             `<span class="who">${cleanName(r.name) || '???'}</span>` +
             `<span class="pts">${Number(r.score)||0}</span></li>`;
    }).join('');
    wrap.hidden = false;
  }
  async function submit(){
    const name = cleanName($('initials').value) || 'CAT';
    $('entry').hidden = true;
    justEntered = await board.submit(name, getScore());
    await render();
  }
  const initials = $('initials');
  initials.addEventListener('input', () => {
    initials.value = initials.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3);
  });
  initials.addEventListener('keydown', e => { if (e.key==='Enter') submit(); });
  $('submit-score').addEventListener('click', () => submit());
  /* Kept rather than discarded: a game that offers the board before the first
     round has to know when the store has answered, and awaiting this is what
     stops it either racing the answer or spending a second request to ask the
     same question. */
  const ready = board.init();
  /* Called at the end of a round: show the board, and offer the initials box
     only if the run actually made it. */
  async function finish(){
    const entry = $('entry');
    entry.hidden = true;
    /* One read at the end of a round, used for both the board and the
       does-this-make-it check. */
    const rows = await board.top(true);
    await render(rows);
    if (!board.qualifies(getScore(), rows)) return;
    entry.hidden = false;
    $('entry-msg').textContent = board.shared
      ? 'You made the board! Enter your initials.'
      : 'High score! Enter your initials.';
    initials.value = '';
    initials.focus();
  }
  /* ---- the board before you have played ----
     The board used to be reachable only by finishing a run, which left the
     people most likely to want it — anyone deciding whether the game is worth
     five minutes — unable to see it. Every game's start screen can carry a
     #see-board button; where the markup has one it is wired here, so the four
     games share the behaviour rather than four copies of it. Games without
     the button are unaffected. */
  const peek = $('see-board');
  function syncPeek(){
    if (!peek) return;
    const open = !$('board').hidden;
    peek.textContent = open ? 'Hide scores' : 'High scores';
    peek.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  /* Called when a run starts, so the peek does not sit there through the game
     as though it were part of the round. */
  function closePeek(){ $('board').hidden = true; syncPeek(); }
  async function togglePeek(){
    const panel = $('board');
    if (!panel.hidden){ panel.hidden = true; return syncPeek(); }
    peek.disabled = true;
    /* Awaited rather than repeated: this is the request the page already made
       at load, which matters when the store allows fifty a day. */
    await ready;
    const rows = await board.top();
    if (rows.length) await render(rows);
    else {
      /* render() hides an empty board, which is right at the end of a round
         and wrong here: a button that answers with nothing reads as broken. */
      $('board-title').textContent = board.shared ? 'High scores' : 'Your best runs';
      $('board-list').innerHTML =
        '<li class="board-empty">No scores yet. Yours could be the first.</li>';
      panel.hidden = false;
    }
    peek.disabled = false;
    syncPeek();
  }
  if (peek) peek.addEventListener('click', togglePeek);

  /* finish() opens the board on its own, so the button has to be told. */
  async function finishAndSync(){ await finish(); syncPeek(); }
  return { render, finish: finishAndSync, ready, closePeek, syncPeek };
}
