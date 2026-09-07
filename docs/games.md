# The arcade — reference

Everything you need to edit a game without reading it first. Nine games live at
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

## 2. The nine games

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
4. `main.game-main > .game-wrap` containing:
   - `header.game-head` — `p.eyebrow` ("A small diversion") + `<h1>`. **No lede
     paragraph.**
   - `.hud` — `.stat` blocks; whatever the game counts.
   - `.stage-wrap` — `<canvas id="stage">` + `.overlay#overlay`.
   - `p.note` — see §5.
5. `footer.site-footer` — identical on all pages.
6. Scripts, in this order: `script.js` → `leaderboard.js` → `<slug>.js`.

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

- Nine **independent** boards, one JSON document each on
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

---

## 5. Where the player-facing copy lives

Four slots, and that is all. Kept deliberately short — as of 2026-09-07 the nine
games total **2,398 characters** of instruction, down from ~13,200.

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

## 6. Conventions inside a game's JS

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

## 7. Cache busting

Every `<link>` and `<script>` carries `?v=N`. **Bumping it is not optional** —
GitHub Pages serves these with long cache lifetimes and Kelly will not see the
change otherwise.

Current versions:

```
styles.css v11   board.css v2    arcade.css v1    script.js v9
leaderboard.js v2                arcade.js v5     carry-wave.js v3
cats 7/7   hats 2/2   catastrophe 5/6   catstatic 2/5   chonk 2/2
on-a-roll 2/3   fits 3/3   catwalk 1/2   cat-lady 1/1      (css/js)
```

When you edit `css/foo.css` or `js/foo.js`, bump `?v=` for that file in
**every** HTML page that references it. `styles.css`, `script.js` and
`board.css` are referenced by most pages — `grep -l` first.

---

## 8. Common edits, and where they go

| Ask | Go straight to |
|---|---|
| "too hard / too fast / too short" | the ALL-CAPS consts at the top of `js/<slug>.js` |
| "reword the instructions" | `#ov-body` and `p.note` in `<slug>.html` (§5) |
| "change the arcade blurb or tile" | `arcade.html` tile block; art in `js/arcade.js` `ART` map |
| "the score is wrong" | the `attachBoardUI(Board, () => …)` expression |
| "colours look off" | tokens in `css/styles.css` `/* Tokens */`, then `css/<slug>.css` |
| "it breaks on my phone" | the game's own CSS media queries; every game has them |
| "add a new game" | `docs/game-process.md` |

---

## 9. Outstanding

- `docs/cat-lady-todo.md` — three unbuilt pageant items.
- Kelly's phone playtest of Cat Lady! (outstanding across several sessions).
- A wave-interference game ("Cat Overboard") is in prototype and **has never
  shipped**. Prototypes live outside the repo, in
  `~/.claude/projects/-Users-kelly-Desktop-Schrodingers-Cards-Website/prototypes/`.
