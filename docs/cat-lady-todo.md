# Cat Lady! — to-do

Ideas agreed but not built yet. The game is live at
<https://schrodingerscards.com/cat-lady.html>; everything below is a change to
the **pageant sequence** at the end of a run, which lives in `drawPageant()` and
`pageantTick()` in `js/cat-lady.js`.

Add to this list rather than starting a new one, so there is one place to look.

---

## 1. Bring the cat lady out on stage during the pageant

Right now she disappears the moment judging starts — the sequence is cats,
curtains and a disembodied verdict. She should be **on stage with each cat**,
presenting it: standing to one side of the spotlight while the cat is walked
out, and reacting as the score lands.

- She already draws at any size via `drawLady(ctx, mood)`, so this is a
  placement and timing job, not a new drawing job.
- Worth deciding: does she walk on once and stay for all five, or come out
  with each cat? Staying is calmer and cheaper; coming out each time gives
  five reaction beats instead of one.

## 2. A five-judge panel that lifts the stars

Replace the stars that currently just pop in at the bottom of the screen with
**five judges seated along the front**, each holding up a card.

- One judge per star: the score decides how many of the five raise their card.
- The lift should be staggered — judges raising one after another is the beat
  the current pop-up has no room for.
- The score number then resolves out of the raised cards rather than appearing
  on its own.
- Judges can be simple: shoulders, a head, a card. They are a row of silhouettes
  at the bottom of the frame, not characters.

## 3. Give her a face for every score

While she is on stage (item 1), her expression should track **that cat's
score**, not just the run total.

- `drawLady()` currently takes three moods: `excited`, `pleased`, `horrified`.
  This needs a fuller set, roughly one per star band — the five bands already
  exist in `JUDGE` in `js/cat-lady.js`, so they can key off the same thing.
- Suggested range, worst to best: devastated / wincing / braced / delighted /
  vindicated. The last one matters — five stars should read as *smug*, not just
  happy.
- Her face changing before the number appears is the tell that makes the score
  reveal land.

---

## Notes for whoever picks this up

- The pageant is drawn entirely on the game canvas at 600 × 640. There is no
  DOM in it, so layout is real estate: cats currently occupy the middle band and
  the judge line sits at y≈546. A judge panel wants the bottom ~120px, which
  means the presented cat and the verdict text both have to move up.
- `?preview=1` on the URL jumps straight to the judging with five randomly
  scored cats. Use it — do not play five rounds to test a timing change.
- Timings are the three constants at the top of `pageantTick`: `PG_TITLE`,
  `PG_CAT`, `PG_TOTAL`. Adding judges means `PG_CAT` almost certainly grows.
