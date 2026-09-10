# The arcade — reference

Everything you need to edit a game without reading it first. Ten games live at
`schrodingerscards.com`, reachable only from `arcade.html`, which is reachable
only from the logo mark in the top-left of every page.

If a fact here disagrees with the code, the code is right — fix this file.

---

## 1. The naming rule

A game called `foo` is always exactly three files plus one arcade tile:

| | path |
|---|---|
| page | `foo.html` |
| logic | `js/foo.js` |
| styles | `css/foo.css` |
| tile | a `<a class="game-tile">` block in `arcade.html` |

No exceptions. There is no build step, no bundler, no framework, no
`node_modules`. Files are served exactly as they sit in the repo, and GitHub
Pages publishes `main` on push.

---

## 2. The ten games

Ordered as they appear in `arcade.html`.

| Game | slug | js lines | leaderboard id | localKey | tile art key |
|---|---|---|---|---|---|
| Schrödinger's Cats | `cats` | 568 | `ff808181a058d43f01a0602bfe69182a` | `scats-board` | `cats` |
| Hat in the Cat | `hats` | 708 | `ff808181a061cdc401a06344df6e05d8` | `shats-board` | `hats` |
| CATastrophe | `catastrophe` | 1446 | `ff808181a061cdc401a064bc867108de` | `catastrophe-board` | `chaos` |
| Catstatic | `catstatic` | 1264 | `ff808181a061cdc401a064da78860902` | `catstatic-board` | `static` |
| Chonk | `chonk` | 1474 | `ff808181a061cdc401a065ceb1c70d29` | `chonk-board` | `chonk` |
| On a Roll | `on-a-roll` | 1137 | `ff808181a067127101a068f7474705c5` | `onaroll-board` | `roll` |
| If I Fits I Sits | `fits` | 712 | `ff808181a061cdc401a06344dd7a05d7` | `sfits-board` | `fits` |
| Catwalk | `catwalk` | 1503 | `ff808181a067127101a06ad5c6cf0c0c` | `catwalk-board` | `catwalk` |
| Cat Lady! | `cat-lady` | 1896 | `ff808181a067127101a06e6e91c314ae` | `cat-lady-board` | `shed` |
| CATamaran | `catamaran` | 1362 | `ff808181a067127101a08cda63186a82` | `catamaran-board` | `catamaran` |

Notes on the odd ones:

- **`best-in-shed.html`** is not a game. It is a redirect stub kept alive
  because Cat Lady! was called Best in Shed for about an hour. The pageant
  *inside* the game is still called Best in Shed.
- **Cat Lady!** is the only game wrapped in an IIFE, the only one whose
  `#ov-body` is written by JS rather than sitting in the HTML, and the only one
  with a story intro (a `STORY` array) and a multi-cat ending. Its `!` is an
  inline SVG cat mask, duplicated in `cat-lady.html` and in its arcade tile —
  the two `<mask id>` values must stay different (`bangCat`, `bangCatTile`).
- **`cats.html`** is the oldest and has no section dividers in its JS.
- Scores are read via `attachBoardUI(Board, () => <expr>)`. The expression
  differs per game: `score`, `total`, `w.score`, `game.g.score`,
  `Math.round(game.distanceTotal / 10)`, `finalTotal`.

---

## 3. The shared page skeleton

Every game page is the same document. Copy `fits.html` when starting a new one —
it is the smallest complete example. In order:

1. `<head>` — charset, viewport, title `NAME — a game | Schrödinger's Cards`,
   meta description, `noindex` is **not** set on game pages (only `arcade.html`
   has it), Google Fonts preconnect + Space Grotesk/Sora, favicons, then
   stylesheets in this order: `styles.css` → `board.css` → `<slug>.css`.
2. `.skip-link`
3. `header.site-header` — identical on all pages, including the logo mark that
   links to `arcade.html` with `aria-label="Games"` and no visible label.
4. `main.game-main > .game-wrap` — **the one-screen box** (see §6):
   - `header.game-head` — `p.eyebrow` ("A small diversion") + `<h1>`. **No lede
     paragraph.**
   - `.hud` — `.stat` blocks; whatever the game counts.
   - any meter (`.charge`, `.timer-track`, `.statusRow`, …).
   - `.stage-wrap` — `<canvas id="stage">` + `.overlay#overlay`.

   The three newest games (On a Roll, Catwalk, Cat Lady!) wrap the hud, the
   meters and the stage in a `.play` div. Both shapes work — the shared CSS
   grows whichever box holds the stage — but `.play` is preferred for new games.
5. `main.game-main > .game-extra` — **below the fold**: `p.note`, and a
   reference `.legend` if the game has one. Sibling of `.game-wrap`, not a child.
   Hat in the Cat is the exception: its legend is played from, so it stays
   inside `.game-wrap`, above the stage.
6. `footer.site-footer` — identical on all pages.
7. Scripts, in this order: `script.js` → `leaderboard.js` → `<slug>.js`.

The overlay markup inside `#overlay` is **load-bearing** — `attachBoardUI()`
finds its elements by id and will not wire up without them:

```
#ov-title  #ov-body  #ov-score>#final-score  #entry>#initials,#submit-score
#board>#board-title,#board-list  .ov-actions>#start,#see-board
```

Shared files: `js/script.js` (nav toggle, footer year, mall-map dialog),
`js/leaderboard.js`, `css/styles.css` (tokens + header/footer),
`css/board.css` (leaderboard panel).

---

## 4. Leaderboards

`js/leaderboard.js` exposes two functions, both global (classic scripts, no
modules anywhere on the site):

```js
const Board = makeBoard({ id, localKey, storeName });
const boardUI = attachBoardUI(Board, () => currentScore);
```

- Ten **independent** boards, one JSON document each on
  `https://api.restful-api.dev/objects`. A score in one can never reach another.
- **No auth, and deliberately forgeable.** A browser game cannot prove a score.
  Accepted trade — do not "fix" it.
- **The free store meters anonymous callers at 50 requests/day.** A heavy
  testing session exhausts it, after which the board silently falls back to this
  browser's own `localStorage` scores. That fallback is a feature, not a bug: an
  outage degrades rather than breaks. Caching in `leaderboard.js` already takes
  a round from ~7 calls to ~3. **Every avoidable request matters.**
- Initials are `[A-Z0-9]{1,3}`, re-sanitised on write *and* on read, with a
  `BLOCKED` set of three-letter words.

To add a board for a new game, POST a new object to the store to get a fresh
`id`; never reuse another game's.

### Never change a shipped board's id, localKey or storeName

Changing any of the three orphans every score already on that board — the old
document is still on the store but nothing points at it any more, and the
players who set those scores have no way to get them back. There is no admin UI
and no undo.

This matters because layout and copy work touches the same files. Renaming
things is fine *around* a `makeBoard({...})` call; the three strings inside it
are frozen once a game is live. After any refactor, confirm nothing moved:

```sh
git diff -- js/ | grep -E '^[-+].*(makeBoard|localKey|storeName|ff808181)'
```

Empty output means every board still points where it did.

---

## 5. Where the player-facing copy lives

Four slots, and that is all. Kept deliberately short — as of 2026-09-07 the nine
games total **2,398 characters** of instruction, down from ~13,200. CATamaran
adds a fifth slot of its own: a three-card tutorial behind a **How it works**
button in the overlay, off by default and skippable at every step, because the
cancellation idea is the one thing in this arcade that play alone does not
teach. Start never leaves the overlay while the tutorial is open.

| Slot | Where | Budget |
|---|---|---|
| Arcade tile blurb | `arcade.html`, `.tile-body > p` | 1–2 sentences, enticement not instruction |
| `#ov-title` | game HTML overlay | a short hook |
| `#ov-body` | game HTML overlay | **two sentences**: what you are doing, and the control |
| `p.note` | game HTML, below the canvas | **two sentences**: only what play alone will not teach |

Rules that produced the current copy:

- The mechanics reveal themselves through play. Nobody reads 1,500 characters
  before a small browser game, and a wall of rules makes it look like homework.
- The `note` is for the non-discoverable thing only — usually the scoring hook
  ("a fast clear beats a careful one") or one hidden interaction ("one cat is
  glowing"). If play teaches it in ten seconds, cut it.
- **No lede paragraph under the `<h1>`.** All nine dropped it on 2026-09-07.
- Voice: dry, concrete, second person, no exclamation marks, em-dashes as
  `&mdash;`. Say the number if there is one ("four seconds", "900kg", "fifty
  commons").

### The trap: `#ov-body` is written in two places

**Catstatic, Chonk, On a Roll and Catwalk rebuild the intro overlay from JS**
(`$('ov-body').textContent = '…'`, near the bottom of the file, in the reset or
init function). That assignment runs on load and on every restart, so it
**silently overrides the HTML**. Editing only the HTML looks correct in the file
and changes nothing in the browser.

Cats, Hat in the Cat, CATastrophe and If I Fits I Sits write `#ov-body` only on
*game over*, so their HTML intro copy stands. Cat Lady! has no HTML intro copy at
all — its overlay is the `STORY` array plus an icon legend built in `ovKey`.

When changing intro copy, `grep -n "ov-body" js/<slug>.js` first, and make both
copies say the same thing. All eight currently agree; keep it that way.

---

## 6. The phone layout standard

**Most play happens on a phone.** The rule is that the play area, the HUD above
it and any meter are on screen together, without scrolling. Anything the player
reads rather than plays goes below the fold.

It is implemented once, in `css/styles.css` under `@media (max-width: 640px)`.
Individual games do not implement layout — they only declare their shape.

How it works:

- `.game-wrap` becomes a flex column exactly one viewport tall
  (`calc(100dvh - var(--header-h) - 24px)`, with a `100vh` line above it as
  fallback).
- Everything in it keeps its natural height; only the stage flexes.
  `min-height: 0` on `.stage-wrap` is load-bearing — without it a flex item
  refuses to shrink below its content and the canvas pushes off the bottom of
  the screen.
- The canvas is sized `width:auto; height:auto; max-width:100%; max-height:100%`
  — the "contain" pattern. It shrinks to fit and keeps the `aspect-ratio` the
  game's own stylesheet sets, so the element box always matches the drawn area
  and pointer maths stays correct.
- The eyebrow is hidden and the `<h1>` drops to 1.35rem. That alone is worth
  about 50px of play area.
- `.game-extra` (note + reference legend) sits after `.game-wrap` and scrolls
  below the fold.

**What a new game must declare:** an `aspect-ratio` on `canvas#stage`, and
optionally a different one inside `@media (max-width:640px)` if a portrait shape
suits the phone better. That is all.

### The landscape hole, and which game falls in it

The shared rule keys on `max-width: 640px`. **A phone turned sideways is about
844x390 — wider than 640 — so it gets the desktop layout**, which is built for a
tall window. Nine of the ten games are portrait-friendly and never notice.
CATamaran is 760x250 and has to be played sideways, and measured at 844x390 it
put the canvas on screen at 67% and dropped the wave buttons and the verdict
line off the bottom.

`css/catamaran.css` therefore carries its own
`@media (orientation: landscape) and (max-height: 600px)` block repeating the
same one-column technique. That is deliberate: widening the shared rule to catch
landscape phones would change the layout of nine live games to fix the tenth.
If a second landscape game ever turns up, that is the moment to promote it into
`styles.css` — not before.

### Two mistakes to not repeat

- **Do not hand-measure the chrome.** Six games used to size the stage with
  `calc(100dvh - 404px)` and similar. Every one of those numbers was measured by
  hand, and every one went stale the moment a HUD row changed. Three other games
  had no height awareness at all and simply ran off the bottom of the screen.
  The browser measures the chrome now; we do not.
- **Do not set `height: 100%` on the canvas.** It looks equivalent to `auto` and
  is not: `max-width` then clamps the width without reducing the height to
  match, which silently breaks the aspect ratio on any square or landscape
  board. It shipped that way for about ten minutes and was caught by measuring,
  not by looking.

### Measuring it

Fit is a number, not an opinion. In the console on a phone-width viewport:

```js
const c = document.querySelector('canvas#stage').getBoundingClientRect();
({ fits: c.bottom <= innerHeight + 1,
   hOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
   pctOfScreen: Math.round(c.height / innerHeight * 100) })
```

`fits` must be true and `hOverflow` must be 0 on every game. As of 2026-09-07
the play area is 43–73% of the screen (If I Fits I Sits is the low one — its
landscape row of five vessels is width-bound on a phone).

## 7. Conventions inside a game's JS

- One classic `<script>`, no modules, no imports. Top-level `const`/`let` are
  therefore reachable by name from the console and from CDP — which the test
  harness relies on.
- **Tuning constants are ALL-CAPS `const` at the top of the file**, above the
  drawing code, with a trailing comment where the number is not obvious. This is
  where to look first for any "make it easier/slower/bigger" request.
- Section dividers: `/* ================= name ================= */`. Most games
  have 3–15; `cats.js` has none.
- Canvas draw code is hand-rolled 2D — no sprites, no image assets. Cats are
  drawn from `BREEDS` tables (build, coat, face) that most games define near the
  top.
- Arcade tile art lives in `js/arcade.js` as a per-game `art*` function,
  registered in the `ART` map around line 487.

### Canvas performance rules, learned the hard way

- **Never call `getBoundingClientRect()` or write `canvas.width` every frame.**
  Cache in a `WeakMap`; recompute only on a real resize.
- **`putImageData` ignores the canvas transform** and writes device pixels.
  Render low-res fields to an offscreen canvas and `drawImage` it scaled.
- Guard against negative/huge `dt` — floor it at 0 and cap it, or a backgrounded
  tab returns and the physics explodes.

---

## 8. Cache busting

Every `<link>` and `<script>` carries `?v=N`. **Bumping it is not optional** —
GitHub Pages serves these with long cache lifetimes and Kelly will not see the
change otherwise.

Current versions:

```
styles.css v13   board.css v2    arcade.css v1    script.js v9
leaderboard.js v2                arcade.js v6     carry-wave.js v3
cats 8/8   hats 3/2   catastrophe 6/6   catstatic 3/5   chonk 3/3
on-a-roll 3/3   fits 4/3   catwalk 2/2   cat-lady 2/1
catamaran 1/1                                        (css/js)
```

When you edit `css/foo.css` or `js/foo.js`, bump `?v=` for that file in
**every** HTML page that references it. `styles.css`, `script.js` and
`board.css` are referenced by most pages — `grep -l` first.

---

## 9. Common edits, and where they go

| Ask | Go straight to |
|---|---|
| "too hard / too fast / too short" | the ALL-CAPS consts at the top of `js/<slug>.js` |
| "reword the instructions" | `#ov-body` and `p.note` in `<slug>.html` (§5) |
| "change the arcade blurb or tile" | `arcade.html` tile block; art in `js/arcade.js` `ART` map |
| "the score is wrong" | the `attachBoardUI(Board, () => …)` expression |
| "colours look off" | tokens in `css/styles.css` `/* Tokens */`, then `css/<slug>.css` |
| "it breaks on my phone" | §6 first — layout is shared now, not per-game |
| "the play area is too small" | §6; then the game's `aspect-ratio` on `canvas#stage` |
| "add a new game" | `docs/game-process.md` |

---

## 10. Outstanding

- `docs/cat-lady-todo.md` — three unbuilt pageant items.
- Kelly's phone playtest of Cat Lady! (outstanding across several sessions).
- Kelly's phone playtest of CATamaran. It is the only game that wants landscape,
  so this one matters more than usual.
- The other nine games are still on the pre-facelift palette and are hardcoded
  hex throughout — 769 values across `js/`, none reading a CSS variable.
  CATamaran is the only one wearing the neon palette.
