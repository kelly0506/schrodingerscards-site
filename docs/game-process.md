# How we build a game

The cadence that produced the nine games in the arcade. Written down on
2026-09-07 so it stops being re-derived every session.

The shape of it: **three cheap mockups → iterate on the one she likes → a
look pass → ship it**. Nothing enters the repo until stage 4.

---

## Stage 0 — before anything

Read `docs/games.md`. It has the file layout, the leaderboard API, the shared
page skeleton and the copy budget. It exists so this stage costs almost nothing.

---

## Stage 1 — three mockups, in one Artifact

**Model: Sonnet.** This stage is throwaway breadth, not polish. Spending Opus
here buys nothing, because at least two of the three are going in the bin.

- **Three takes on the same idea, never one.** Kelly picks by comparison. A
  single mockup gets "it's fine", three gets "Take C is easily my favourite,
  but…", which is the useful answer.
- **One self-contained HTML file, all three playable side by side**, published
  as a **private Artifact**. She reviews in the artifact, not in the repo.
- **Mirror the file to disk** at
  `~/.claude/projects/-Users-kelly-Desktop-Schrodingers-Cards-Website/prototypes/<name>.html`
  so it survives a cleared context.
- Vary the **mechanic**, not the paint. Three control schemes for the same game
  is a good set; three colour schemes is a wasted round.
- Expose game state deliberately for testing — `window.__games.p1` etc. holding
  `S`, `cfg` and the key derived values. **These get stripped at stage 4.**

Hand back the artifact link and stop. Do not start stage 2 unsolicited.

---

## Stage 2 — iterate and actually test

Still Sonnet. This is the long stage and the one that decides whether the game
is any good.

**Update the same Artifact by passing its `url`.** Publishing without it makes a
second link and the review history splits in two.

### Test by measuring, not by looking

Every real problem in the arcade was found by instrumenting a run, not by
watching one. Play the game headlessly and print numbers: what does a run where
the player does *nothing* score? What does perfect play score? If those two are
close, the game is broken regardless of how it looks.

### Driving an animated canvas under CDP

`requestAnimationFrame` **does not fire while CDP is evaluating**. Awaiting a
rAF promise hangs until the timeout; `setTimeout` returns but the game never
advances, so readouts go stale and look like broken game logic. Drive frames by
hand:

```js
window.__begin = () => { window.__raf = window.requestAnimationFrame;
                         window.requestAnimationFrame = () => 0; };
window.__frame = () => { RIGS.forEach(p => p.live = true); loop(last + 16.7); };
window.__end   = () => { window.requestAnimationFrame = window.__raf;
                         window.__raf(loop); };
```

- **Keep one continuous fake clock.** Seeding each pump from `performance.now()`
  makes the clock jump backwards between calls, giving negative `dt` that
  rewinds state.
- **`IntersectionObserver` idles off-screen canvases** — set `live = true`
  inside the pump loop, not once before it.
- `python3 -m http.server` serves no charset, so em-dashes look like mojibake
  locally. That is the harness, not the file. Do not "fix" it.

### Traps that have bitten us more than once

- **Duty cycle beats magnitude.** If threats are 3–6s apart and each is
  dangerous for ~1s, the player is safe ~84% of the time and any healing rate
  tuned by feel will make doing nothing a winning strategy. Re-check the regen
  rate whenever spawn gap or hazard width changes.
- **Judge each event on what it is responsible for**, not on total state at that
  instant — otherwise a perfectly handled threat is failed because its neighbour
  overlapped it.
- **Judge on the peak of a passage, not one sample**, or things pass by luck at
  a zero crossing.
- **Cap per-event damage**, or one bad moment empties the whole bar and the
  interesting gamble becomes unplayable.
- **Ramp anything that switches on.** Going from zero to full amplitude between
  two frames reads as an infinite rate of change to any velocity-based measure.
- **Verify multi-`sub()` patch scripts as a whole.** A script that prints
  several `ok:` lines and *then* asserts has written nothing. Build every
  replacement, assert every count, write only at the end. Then re-read the file.

### Working with Kelly at this stage

- She answers **in conversation, in prose** — lay the options out in the message,
  do not reach for the option picker.
- When two games share a verb, **name them explicitly every time**. Calling one
  of two matching games "that matching game" once made her think an unfinished
  prototype had gone live.
- Her stated preferences are settled, not opening positions. If she says keep
  both dials, keep both dials.

---

## Stage 3 — the look pass

**Model: Opus.** Only now, and only once the mechanic is settled — a look pass
on a game that is still changing shape gets thrown away.

What this stage is for:

- Making it look like the rest of the site. Tokens from `css/styles.css`, Space
  Grotesk for headings and Sora for body, the existing dark palette.
- Readability of the play field: does the thing you are meant to watch read
  instantly at a glance, at phone size, in a dark room.
- Motion and feedback — the small satisfying stuff that a mechanics pass skips.
- **Phone.** Every game is played on a phone. Touch targets, a control scheme
  that works with a thumb over the screen, and a canvas that fits without
  scrolling.

Still an Artifact, still not in the repo.

---

## Stage 4 — ship it

Now it enters the repo. Split into the three files (`<slug>.html`,
`js/<slug>.js`, `css/<slug>.css`) per `docs/games.md` §1 and §3.

Checklist:

- [ ] **Strip the debug hooks** (`window.__games`, `window.__rigs`, and friends).
- [ ] Page built from the shared skeleton — header, footer, overlay ids, script
      order. Copy `fits.html`.
- [ ] **Copy written to budget** (`docs/games.md` §5): `#ov-body` two sentences,
      `p.note` two sentences, no lede paragraph. Write these last, when you know
      what the game actually is.
- [ ] New leaderboard object created, fresh `id`, own `localKey` and
      `storeName`. Never reuse another game's.
- [ ] `attachBoardUI(Board, () => …)` returns the number the player sees.
- [ ] **Arcade tile** added to `arcade.html` — `data-art` key, kind + length
      line, title, 1–2 sentence blurb — and a matching `art<Name>` function
      registered in the `ART` map in `js/arcade.js`.
- [ ] Arcade header count updated ("Nine small games…").
- [ ] **`?v=` bumped** on every file touched, in every page referencing it.
- [ ] Played on a phone.
- [ ] Committed and **pushed**. A change Kelly cannot see on the live site reads
      as not done.
- [ ] Told her it is live, by name.

---

## Handoff notes

Write one at the end of every stage, not just at the end of the build — `/handoff`.
A stage boundary is exactly where context tends to get cleared.

A good note carries: where things stand, what is *verified* rather than assumed,
Kelly's settled preferences, the artifact URLs (with the reminder that updating
needs the `url` parameter), the local mirror paths, current tuning constants, and
the gotchas that cost time. Reality beats the note — verify before trusting it.

---

## Why the model split

Stage 1 is breadth and gets discarded; stage 2 is measurement and iteration
volume; both are Sonnet work. Stage 3 is taste, and stage 4 is care with a live
site — Opus. Roughly: cheap while the answer is still unknown, careful once it
is.
