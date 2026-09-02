/* ============================================================
   Collection Guide — recommendation engine
   ------------------------------------------------------------
   The tool scores five variables (Value, Condition, Desirability,
   Patience, Effort) from the user's answers, then scores four
   possible paths against them. It is not a rigid tree: the same
   answer can push different directions depending on the rest.

   EVERYTHING TUNABLE LIVES IN CONFIG BELOW. Change numbers there,
   not in the logic. Items marked VERIFY should be checked against
   current market/PSA reality before this goes live.
   ============================================================ */

const CONFIG = {

  /* ---- Grading economics. Checked September 2026.
     IMPORTANT: PSA paused its Value, Value Bulk, Value Plus and Value Max
     tiers on 2 June 2026 to work down a backlog that peaked around 14M
     cards. Regular at $79.99 is currently the cheapest tier you can
     actually order. PSA has not announced a reopening date; the stated
     condition is getting the backlog under 5M. If the Value tiers reopen
     (~$25-33/card), drop feePerCard back down — it roughly halves the
     break-even below. RECHECK THIS BEFORE LAUNCH. ---- */
  grading: {
    feePerCard: 79.99,       // PSA Regular tier, cheapest currently orderable
    suppliesPerCard: 1.5,    // card savers, sleeves, bags
    shipPerSubmission: 45,   // insured out + return, split across cards
    cardsPerSubmission: 10,
    turnaroundMonths: '3-6', // 20-50 business days quoted; the backlog stretches it
    minRawToBother: 200,     // below this, fees reliably eat the upside
    valueTiersPaused: true   // set false (and lower feePerCard) if they reopen
  },

  /* ---- Grade premiums as a MULTIPLE of raw Near Mint value.
     Directional ranges, not price data — what a grade is worth swings
     enormously by set and card. Sourced Sept 2026 from market write-ups;
     tune from your own sales as you get them.

     The important asymmetry: on MODERN cards a PSA 9 is often worth
     roughly the same as raw or slightly less, because the grade tells
     buyers the card was examined under magnification and found flawed.
     Only the 10 reliably pays. On VINTAGE, even an 8 carries a real
     premium because authentication itself is worth something. ---- */
  gradeMultipliers: {
    modern:  { 8: [0.7, 1.0],  9: [0.9, 1.3],  10: [2.0, 4.0] },
    vintage: { 8: [1.8, 3.0],  9: [2.5, 4.0],  10: [5.0, 12.0] }
  },

  /* ---- Rough outcome odds for a card the submitter believes is Near
     Mint. PSA's own H1-2025 figures put the TCG category near a 50% gem
     rate, but that is dominated by experienced submitters who pre-screen
     hard; a first-time self-assessor should not plan on it. Vintage
     pre-1980 gems at under 1%, which is why the two sets differ so much. ---- */
  gradeOdds: {
    modern:  { 10: 0.28, 9: 0.40, 8: 0.22, low: 0.10 },
    vintage: { 10: 0.04, 9: 0.16, 8: 0.32, low: 0.48 }
  },

  /* ---- Online marketplace selling fees, checked September 2026.
     eBay: 13.25% final value fee on the total (item + shipping + tax),
     plus $0.40 per order; singles selling for $1,000+ get 50% off the
     final value fee. TCGplayer: 10.75% commission + 2.5% + $0.30
     payment processing, which lands in the same place. ---- */
  fees: {
    ebayPct: 13.25,
    ebayPerOrder: 0.40,
    ebayHighValueThreshold: 1000,
    tcgplayerPct: 13.25,     // 10.75% commission + 2.5% processing
    rangeLow: 12,
    rangeHigh: 15,
    shipPerOrder: 1.5        // plain envelope with a toploader; boxes cost far more
  },

  /* ---- Collectr reports portfolio estimates rather than realised sold
     prices, and does not ask the user to assess condition — so its totals
     run high. The booth's own observation is 10-15% above what the same
     cards fetch on eBay; independent app-to-app comparisons find spreads
     in the same direction. Applied as a haircut to any Collectr figure. ---- */
  collectrHaircut: 0.125,      // midpoint of the observed range below
  collectrRangeLow: 10,        // the booth's own observation, shown to users
  collectrRangeHigh: 15,

  /* ---- Below this confidence (0-100) we stop showing dollar
     figures and steer harder toward "get it evaluated". ---- */
  confidenceFloor: 62
};

/* ---------- Score tables ---------- */

const SCORES = {
  value: { u100: 8, v100_500: 22, v500_1k: 38, v1k_5k: 58, v5k_10k: 78, v10k: 92, dk: 32 },
  condSingles: { nm: 95, lp: 72, mp: 45, hp: 20, mixed: 58, dk: 50 },
  condSealed: { factory: 95, minor: 74, noticeable: 46, damaged: 20, mixed: 58, dk: 50 },
  patience: { asap: 5, weeks: 28, months: 58, sixplus: 85, none: 95 },
  effort: { little: 12, some: 52, alot: 90 },
  singleType: {
    sir_sar: 26, serialized: 26, first_ed: 24, vintage: 22, chase: 20,
    promo: 12, older_modern: 9, modern: 5, recent: 3, commons: -22, dk: 0
  },
  sealedType: {
    booster_box: 14, etb: 8, packs: 6, tins: 3, collection_box: 5, blister: 2, other: 3, dk: 0
  }
};

/* ---------- Screens ----------
   Each screen holds one or more fields. `when` decides whether the
   screen (or a single field) is shown, so the flow adapts: a
   singles-only user never sees the sealed questions.

   GROUPING IS DELIBERATE. An earlier version asked the same things
   across ten separate screens. Every extra Continue press is a place
   to abandon a funnel, so related questions now share a screen: five
   screens for a singles- or sealed-only collection, six for a mix.
   Adding a field to an existing screen is nearly free; adding a
   screen is not. ------------------------------------------------- */

const hasSingles = (s) => s.holdings === 'singles' || s.holdings === 'both';
const hasSealed  = (s) => s.holdings === 'sealed'  || s.holdings === 'both';

const SCREENS = [
  {
    id: 'start',
    title: 'Start with the basics',
    sub: 'Two quick ones. Sealed product and loose cards behave like different markets, so we handle them separately from here.',
    fields: [
      {
        key: 'holdings', type: 'single',
        label: 'What do you have?',
        options: [
          { v: 'singles', t: 'Individual cards', d: 'Loose singles, sleeved or in binders, boxes or stacks.' },
          { v: 'sealed', t: 'Sealed product', d: 'Unopened packs, boxes, ETBs, tins, collection boxes.' },
          { v: 'both', t: 'Both', d: 'A mix of loose cards and sealed product.' }
        ]
      },
      {
        key: 'goal', type: 'single',
        label: 'What are you hoping to get out of it?',
        hint: 'No wrong answer — it just changes which trade-offs we weigh more heavily.',
        options: [
          { v: 'cash', t: 'Cash, reasonably quickly', d: 'Convenience matters more than the last dollar.' },
          { v: 'max', t: 'As much money as is reasonable', d: "I'll do more work for a better return." },
          { v: 'grade', t: 'Maximize what my best cards are worth', d: "I'd spend money and wait months if it pays." },
          { v: 'unsure', t: "I'm not sure yet", d: 'I want to understand what I have first.' }
        ]
      }
    ]
  },

  {
    id: 'condition',
    title: 'What kind of condition is it in?',
    sub: "Condition moves value more than anything else here, and it is the easiest thing to be too generous about. If you're not sure, say so — we'd rather give you an honest answer than a flattering one.",
    showHelp: true,
    fields: [
      {
        key: 'condSingles', type: 'single', when: hasSingles,
        label: 'Your individual cards',
        options: [
          { v: 'nm', t: 'Near Mint / Mint', d: 'Sharp corners, clean edges, no scratches or creases.' },
          { v: 'lp', t: 'Lightly Played', d: 'Minor wear you have to look for. Still presents well.' },
          { v: 'mp', t: 'Moderately Played', d: 'Obvious whitening, rounded corners, light scuffing.' },
          { v: 'hp', t: 'Heavily Played / Damaged', d: 'Creases, bends, water damage, writing, tears.' },
          { v: 'mixed', t: 'Genuinely mixed', d: 'Some great, some rough — no single answer fits.' },
          { v: 'dk', t: "I don't know how to judge this" }
        ]
      },
      {
        key: 'condSealed', type: 'single', when: hasSealed,
        label: 'Your sealed product',
        hint: 'Sealed does not automatically mean mint — judge the box the way you would judge a card.',
        options: [
          { v: 'factory', t: 'Factory sealed, excellent', d: 'Clean shrink, square corners, no fading or dents.' },
          { v: 'minor', t: 'Minor packaging wear', d: 'Slight shelf wear, small dings, nothing structural.' },
          { v: 'noticeable', t: 'Noticeable wear', d: 'Dented corners, creased boxes, scuffed or loose shrink.' },
          { v: 'damaged', t: 'Significant damage', d: 'Crushed, water damaged, sun faded, torn or resealed.' },
          { v: 'mixed', t: 'Genuinely mixed' },
          { v: 'dk', t: "I don't know how to judge this" }
        ]
      },
      {
        key: 'sealedFactory', type: 'single', when: hasSealed,
        label: 'Is it all still unopened and factory sealed?',
        options: [
          { v: 'yes', t: 'Yes, all of it' },
          { v: 'mixed', t: 'Some has been opened or resealed' },
          { v: 'no', t: 'No' },
          { v: 'dk', t: "I don't know" }
        ]
      }
    ]
  },

  {
    id: 'singles',
    title: "What's in the collection?",
    sub: 'Rarity and era decide whether collectors compete for your cards or ignore them — and one or two strong cards often change the whole recommendation.',
    when: hasSingles,
    fields: [
      {
        key: 'typesSingles', type: 'multi',
        label: 'What kinds of cards are in there?',
        options: [
          { v: 'vintage', t: 'Vintage', d: 'Base Set, Jungle, Fossil, Team Rocket — the WotC years, roughly 1999–2003.' },
          { v: 'older_modern', t: 'Older modern', d: 'Roughly the 2000s through mid-2010s.' },
          { v: 'modern', t: 'Modern', d: 'Recent-ish sets that are out of print.' },
          { v: 'recent', t: 'Current releases', d: 'Sets still on shelves right now.' },
          { v: 'sir_sar', t: 'SIRs, SARs, Alt Arts, Full Arts', d: 'The chase pulls with special artwork.' },
          { v: 'first_ed', t: 'First Edition or shadowless' },
          { v: 'serialized', t: 'Serialized / numbered cards', d: 'Cards stamped like 07/99.' },
          { v: 'promo', t: 'Promos and exclusives' },
          { v: 'chase', t: 'Known chase cards', d: 'The specific cards people hunt for in a set.' },
          { v: 'commons', t: 'Mostly commons and uncommons', d: 'Bulk — the everyday cards that fill a binder.' },
          { v: 'dk', t: "I don't know what I have" }
        ]
      },
      {
        key: 'topCard100', type: 'single',
        label: 'Any individual cards worth roughly $100 or more?',
        options: [
          { v: 'yes', t: 'Yes' },
          { v: 'no', t: 'No' },
          { v: 'dk', t: "I don't know" }
        ]
      },
      {
        key: 'topCardRare', type: 'single',
        when: (s) => s.topCard100 !== 'no',
        label: 'Are any of them genuinely rare or sought after?',
        hint: 'SIRs · SARs · Alt Arts · vintage holos · First Edition · promos · serialized · major chase cards',
        options: [
          { v: 'yes', t: 'Yes, cards collectors actively look for' },
          { v: 'no', t: 'Not really — valuable, but common enough' },
          { v: 'dk', t: "I don't know" }
        ]
      }
    ]
  },

  {
    id: 'sealed',
    title: 'About the sealed product',
    sub: 'Sealed is its own asset class, and scarcity is what separates the part that appreciates from the part that does not.',
    when: hasSealed,
    fields: [
      {
        key: 'typesSealed', type: 'multi',
        label: 'What have you got?',
        options: [
          { v: 'booster_box', t: 'Booster boxes' },
          { v: 'packs', t: 'Loose booster packs' },
          { v: 'etb', t: 'Elite Trainer Boxes' },
          { v: 'tins', t: 'Tins' },
          { v: 'collection_box', t: 'Collection or specialty boxes' },
          { v: 'blister', t: 'Blisters and three-pack hangers' },
          { v: 'other', t: 'Something else' },
          { v: 'dk', t: "I don't know" }
        ]
      },
      {
        key: 'sealedScarcity', type: 'single',
        label: 'Is any of it out of print or hard to find?',
        hint: 'This is the single biggest question for sealed. In-print product does not appreciate while it is still being made.',
        options: [
          { v: 'yes_scarce', t: 'Yes — and some of it is genuinely hard to find', d: 'Out of print, and not easy to turn up even if you go looking.' },
          { v: 'yes_oop', t: 'Yes, some of it is out of print', d: 'Older sets you can no longer buy new.' },
          { v: 'no', t: "No, it's all current product", d: 'Sets still on shelves right now.' },
          { v: 'dk', t: "I don't know" }
        ]
      }
    ]
  },

  {
    id: 'worth',
    title: 'What is it worth, roughly?',
    sub: 'A guess is completely fine — we weight it by how you arrived at it. Where the value sits matters at least as much as the total.',
    fields: [
      {
        key: 'value', type: 'single',
        label: 'Estimated total value',
        hint: 'No idea? Say so — we will show you how to work it out at the end.',
        options: [
          { v: 'u100', t: 'Under $100' },
          { v: 'v100_500', t: '$100 – $500' },
          { v: 'v500_1k', t: '$500 – $1,000' },
          { v: 'v1k_5k', t: '$1,000 – $5,000' },
          { v: 'v5k_10k', t: '$5,000 – $10,000' },
          { v: 'v10k', t: '$10,000+' },
          { v: 'dk', t: 'I have no idea' }
        ]
      },
      {
        key: 'valueSource', type: 'single',
        when: (s) => s.value && s.value !== 'dk',
        label: 'How did you land on that number?',
        hint: '"$5,000 according to Collectr" and "I feel like it’s $5,000" are different starting points.',
        options: [
          { v: 'collectr', t: 'Collectr' },
          { v: 'tcgplayer', t: 'TCGplayer' },
          { v: 'ebay_sold', t: 'eBay sold listings' },
          { v: 'pricecharting', t: 'PriceCharting or Cardmarket' },
          { v: 'ebay_asking', t: 'eBay asking prices' },
          { v: 'guess', t: 'I mostly guessed' }
        ]
      },
      {
        key: 'concentration', type: 'single',
        label: 'Where is the value sitting?',
        options: [
          { v: 'few', t: 'In a handful of items', d: 'A few pieces are worth more than everything else combined.' },
          { v: 'spread', t: 'Spread across the collection', d: 'Lots of cards that individually are not worth much.' },
          { v: 'dk', t: "I don't know" }
        ]
      },
      {
        key: 'size', type: 'single',
        label: 'Roughly how big is it?',
        hint: 'A ballpark. This mostly tells us whether selling piece by piece is even practical. Count each sealed item as one.',
        options: [
          { v: 'u50', t: 'Under 50 items' },
          { v: 's50_250', t: '50 – 250' },
          { v: 's250_1k', t: '250 – 1,000' },
          { v: 's1k_5k', t: '1,000 – 5,000' },
          { v: 's5k', t: '5,000+' },
          { v: 'dk', t: "I don't know" }
        ]
      }
    ]
  },

  {
    id: 'you',
    title: 'Last one: how do you want to do this?',
    sub: 'Be honest with yourself here. Half-finished listings are the most common way people lose money on a collection.',
    fields: [
      {
        key: 'effort', type: 'single',
        label: 'Time and effort you are willing to put in',
        options: [
          { v: 'little', t: 'Very little', d: 'I want this handled with minimal hassle.' },
          { v: 'some', t: 'Some', d: "I'll list and ship a reasonable number of items." },
          { v: 'alot', t: 'A lot', d: "I'll photograph, research, list, negotiate and ship individually." }
        ]
      },
      {
        key: 'timeline', type: 'single',
        label: 'How soon do you want the money?',
        options: [
          { v: 'asap', t: 'As soon as possible' },
          { v: 'weeks', t: 'Days to weeks' },
          { v: 'months', t: 'A few months is fine', d: "I'll wait for the right buyer." },
          { v: 'sixplus', t: 'Six months or more', d: "I'm comfortable holding or grading." },
          { v: 'none', t: 'No timeline at all', d: "I'm focused purely on value." }
        ]
      },
      {
        key: 'investWilling', type: 'single',
        when: (s) => hasSingles(s) &&
                     ['nm', 'lp', 'mixed', 'dk'].includes(s.condSingles) &&
                     (s.topCard100 === 'yes' || s.topCard100 === 'dk' ||
                      ['v1k_5k', 'v5k_10k', 'v10k'].includes(s.value)),
        label: 'Would you spend money up front for a shot at a higher return?',
        hint: 'Grading fees, supplies, insured shipping both ways, and months of waiting — with no guarantee of the grade you want.',
        options: [
          { v: 'yes', t: 'Yes, if the math works' },
          { v: 'maybe', t: 'Maybe, show me the numbers' },
          { v: 'no', t: "No, I'd rather not spend anything" }
        ]
      }
    ]
  }
];

/* ============================================================
   SCORING
   ============================================================ */

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const has = (arr, v) => Array.isArray(arr) && arr.includes(v);

const HIGH_TIER_TYPES = ['sir_sar', 'serialized', 'first_ed', 'vintage', 'chase'];

function computeFactors(state) {
  const unknowns = [];
  const notes = [];
  const mark = (k) => { if (!unknowns.includes(k)) unknowns.push(k); };

  /* ---- Value ---- */
  let V = SCORES.value[state.value] ?? 32;
  if (state.value === 'dk') mark('total value');

  const sourceAdj = { collectr: -5, tcgplayer: 0, ebay_sold: 2, pricecharting: 0, ebay_asking: -8, guess: -6 };
  if (state.valueSource && sourceAdj[state.valueSource]) {
    V += sourceAdj[state.valueSource];
    if (state.valueSource === 'collectr') {
      notes.push('Collectr total discounted ~' + Math.round(CONFIG.collectrHaircut * 100) + '% — it reports portfolio estimates, not sold prices, and never asks about condition.');
    } else if (sourceAdj[state.valueSource] < 0) {
      notes.push('Value estimate discounted — asking prices and gut estimates both run high.');
    }
  }
  if (state.topCard100 === 'no') {
    V = Math.min(V, 42);
    notes.push('No single card breaks $100, so the ceiling on any per-card strategy is capped.');
  }
  if (state.topCard100 === 'yes' && state.concentration === 'few') V += 6;
  if (state.topCard100 === 'dk') mark('best card value');
  V = clamp(V);

  /* ---- Condition (tracked per side so mixed collections split cleanly) ---- */
  let cSingles = null, cSealed = null;
  if (hasSingles(state)) {
    cSingles = SCORES.condSingles[state.condSingles] ?? 50;
    if (state.condSingles === 'dk') mark('card condition');
  }
  if (hasSealed(state)) {
    cSealed = SCORES.condSealed[state.condSealed] ?? 50;
    if (state.condSealed === 'dk') mark('sealed condition');
  }
  const condParts = [cSingles, cSealed].filter((x) => x !== null);
  const C = clamp(condParts.reduce((a, b) => a + b, 0) / condParts.length);

  /* ---- Desirability ---- */
  let dSingles = null, dSealed = null;
  if (hasSingles(state)) {
    let d = 22;
    const types = state.typesSingles || [];
    types.forEach((t) => { d += SCORES.singleType[t] || 0; });
    if (has(types, 'dk')) mark('what cards you have');
    if (has(types, 'commons') && !types.some((t) => HIGH_TIER_TYPES.includes(t))) {
      d -= 12;
      notes.push('Bulk with nothing premium behind it — collectors will not compete for this.');
    }
    if (state.topCardRare === 'yes') d += 18;
    if (state.topCardRare === 'no') d -= 6;
    if (state.topCardRare === 'dk') mark('rarity of your best cards');
    dSingles = clamp(d);
  }
  if (hasSealed(state)) {
    let d = 26;
    (state.typesSealed || []).forEach((t) => { d += SCORES.sealedType[t] || 0; });
    if (has(state.typesSealed, 'dk')) mark('what sealed product you have');
    /* One merged scarcity question replaced two near-identical ones
       ("out of print?" and "hard to find?"), which users conflated
       anyway. The combined weight matches the old pair. */
    if (state.sealedScarcity === 'yes_scarce') { d += 40; notes.push('Out-of-print sealed that is genuinely hard to find is the part of the market that actually appreciates.'); }
    if (state.sealedScarcity === 'yes_oop') { d += 24; notes.push('Out-of-print sealed is the part of the market that actually appreciates.'); }
    if (state.sealedScarcity === 'no') d -= 8;
    if (state.sealedScarcity === 'dk') mark('whether the sealed product is out of print');
    if (state.sealedFactory === 'no') { d -= 26; notes.push('Sealed product that has been opened or resealed loses most of its sealed premium.'); }
    if (state.sealedFactory === 'mixed') d -= 10;
    if (state.sealedFactory === 'dk') mark('whether product is still factory sealed');
    dSealed = clamp(d);
  }
  const desParts = [dSingles, dSealed].filter((x) => x !== null);
  const D = clamp(desParts.reduce((a, b) => a + b, 0) / desParts.length);

  /* ---- Patience & Effort ---- */
  const T = SCORES.patience[state.timeline] ?? 40;
  const E = SCORES.effort[state.effort] ?? 40;

  /* ---- Confidence ---- */
  let confidence = 100 - unknowns.length * 11;
  if (state.valueSource === 'guess') confidence -= 10;
  if (state.valueSource === 'ebay_asking') confidence -= 7;
  if (state.size === 'dk') confidence -= 4;
  if (state.concentration === 'dk') { confidence -= 6; mark('where the value sits'); }
  confidence = clamp(confidence, 22, 100);

  return { V, C, D, T, E, cSingles, cSealed, dSingles, dSealed, confidence, unknowns, notes };
}

function gradingGate(state, f) {
  const types = state.typesSingles || [];
  const checks = {
    singles: {
      ok: hasSingles(state),
      fail: 'Grading only applies to individual cards.'
    },
    value: {
      ok: state.topCard100 === 'yes' ||
          ['v5k_10k', 'v10k'].includes(state.value) ||
          (state.value === 'v1k_5k' && state.concentration === 'few'),
      fail: 'A card generally needs to be worth around $' + CONFIG.grading.minRawToBother +
            '+ raw before grading fees, shipping and months of waiting are worth it.'
    },
    condition: {
      ok: ['nm', 'lp', 'mixed'].includes(state.condSingles),
      fail: state.condSingles === 'dk'
        ? "We'd need a real read on condition first — this is the single biggest input, and grading a card that isn't what you think it is loses money."
        : 'Cards with visible play wear will not grade high enough to earn back the fees.'
    },
    demand: {
      ok: state.topCardRare === 'yes' || types.some((t) => HIGH_TIER_TYPES.includes(t)),
      fail: 'Grading pays off when collectors are already competing for the card. A high grade on a card nobody wants is still a card nobody wants.'
    },
    patience: {
      ok: f.T >= 55,
      fail: 'Value-tier grading runs ' + CONFIG.grading.turnaroundMonths + ' months. Your cards are gone that whole time.'
    },
    willing: {
      ok: state.investWilling === 'yes' || state.investWilling === 'maybe',
      fail: 'Grading means paying up front with no guaranteed grade in return.'
    }
  };
  const blockers = Object.entries(checks).filter(([, c]) => !c.ok).map(([k, c]) => ({ key: k, msg: c.fail }));
  return { passed: blockers.length === 0, blockers, checks };
}

function scorePaths(state, f) {
  const { V, C, D, T, E, confidence } = f;
  const rules = [];
  const fire = (msg) => rules.push(msg);

  const bulky = ['s1k_5k', 's5k'].includes(state.size);

  /* ---- Sell to a reseller ---- */
  let reseller = 28 + (100 - E) * 0.30 + (100 - T) * 0.26 + (100 - V) * 0.10;
  if (C < 45) { reseller += 10; fire('Condition is weak → reseller +10'); }
  if (D < 35) { reseller += 8; fire('Low collector demand → reseller +8'); }
  if (bulky && state.concentration === 'spread') { reseller += 12; fire('Large collection, value spread thin → reseller +12'); }
  if (V > 75 && T > 55) { reseller -= 10; fire('High value plus patience → reseller −10'); }

  /* ---- Sell individually ---- */
  let individual = 10 + E * 0.34 + T * 0.18 + V * 0.20 + D * 0.24;
  if (state.concentration === 'few') { individual += 8; fire('Value concentrated in few items → individual +8'); }
  if (C < 40) { individual -= 10; fire('Poor condition → individual −10'); }
  if (bulky && state.concentration === 'spread') { individual -= 14; fire('Too many low-value items to list one by one → individual −14'); }
  if (E <= 12) { individual -= 12; fire('User wants minimal work → individual −12'); }

  /* ---- Grade selectively ---- */
  const gate = gradingGate(state, f);
  let grade = 8 + V * 0.26 + C * 0.28 + D * 0.24 + T * 0.18 +
              (state.investWilling === 'yes' ? 12 : state.investWilling === 'maybe' ? 5 : 0);
  if (!gate.passed) {
    grade = Math.min(grade, 32);
    fire('Grading gate failed (' + gate.blockers.map((b) => b.key).join(', ') + ') → grading capped at 32');
  }

  /* ---- Evaluate & hold ---- */
  let evaluate = 18 + (100 - confidence) * 0.45 + f.unknowns.length * 4;
  if (state.goal === 'unsure') { evaluate += 28; fire('Stated goal is "not sure yet" → evaluate +28'); }
  if (V >= 58 && confidence < 70) { evaluate += 12; fire('Potentially valuable but poorly understood → evaluate +12'); }
  if (state.condSingles === 'dk' || state.condSealed === 'dk') { evaluate += 10; fire('Condition unknown → evaluate +10'); }

  /* ---- Stated goal gets a nudge, never a veto ---- */
  const goalMap = { cash: 'reseller', max: 'individual', grade: 'grade', unsure: 'evaluate' };
  const bias = { reseller, individual, grade, evaluate };
  if (goalMap[state.goal]) {
    bias[goalMap[state.goal]] += 9;
    fire('Stated goal → ' + goalMap[state.goal] + ' +9');
  }
  if (goalMap[state.goal] === 'grade' && !gate.passed) {
    bias.grade = Math.min(bias.grade, 34);
    fire('User asked about grading but does not clear the gate → still capped');
  }

  /* ---- Hard override: do not sell what you cannot assess ---- */
  let forced = null;
  const condUnknown = state.condSingles === 'dk' || state.condSealed === 'dk';
  if (condUnknown && ['v1k_5k', 'v5k_10k', 'v10k'].includes(state.value)) {
    forced = 'evaluate';
    fire('OVERRIDE: potentially $1,000+ with unknown condition → evaluate forced to primary');
  }
  if (state.value === 'dk' && confidence < 50) {
    forced = forced || 'evaluate';
    fire('OVERRIDE: value unknown and confidence low → evaluate forced to primary');
  }

  /* Rank on the raw totals, not the clamped ones — clamping first collapses
     genuinely different fits into a tie and lets key order pick the winner. */
  const raw = bias;
  let ranked = Object.entries(raw)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ key: k, raw: v, score: Math.round(clamp(v)) }));

  if (forced) {
    const top = ranked[0];
    const f2 = ranked.find((r) => r.key === forced);
    if (f2 && f2 !== top) {
      /* A forced path must also *display* as the strongest, or the results page
         contradicts itself by showing a lower-scoring primary recommendation. */
      f2.score = Math.min(100, top.score + 2);
      ranked = [f2, ...ranked.filter((r) => r.key !== forced)];
    }
  }
  const scores = Object.fromEntries(ranked.map((r) => [r.key, r.score]));
  return { scores, ranked, gate, rules, forced };
}

/* ============================================================
   RESULT COPY
   ============================================================ */

const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
/* Sub-dollar fees round away to "$0" with money(), so show cents when it matters. */
const money2 = (n) => n < 10 && n % 1 !== 0
  ? '$' + n.toFixed(2)
  : '$' + Math.round(n).toLocaleString('en-US');

const PATH_META = {
  reseller:   { label: 'Sell to a reseller',      short: 'Fastest and easiest, but you take the lowest number.' },
  individual: { label: 'Sell individually',       short: 'More money, considerably more work and time.' },
  grade:      { label: 'Grade selectively',       short: 'Highest ceiling on your best cards, months of waiting, real risk.' },
  evaluate:   { label: 'Evaluate and hold',       short: 'Understand what you have before committing to anything.' }
};

function primaryCopy(state, f, p) {
  const key = p.ranked[0].key;
  const both = state.holdings === 'both';

  /* Sealed-only collections get their own voice — the singles copy talks about
     photographing and grading cards, which is nonsense for a stack of boxes. */
  if (state.holdings === 'sealed' && key !== 'evaluate') return sealedPrimary(state, f, key);

  if (key === 'reseller') {
    const paras = [];
    paras.push('Given how quickly you want this done and how much work you want to put in, selling the collection as a lot is the honest answer. You will not get top dollar — nobody selling this way does — but you will get a single number, one transaction, and no listings to manage.');
    paras.push('As a rule of thumb, expect a reseller to offer somewhere around half of a collection\'s tracked market value for Near Mint material, and meaningfully less as condition drops. <strong>We are deliberately not putting a dollar figure on yours</strong> — a handful of questions cannot tell us what you actually have, and getting a real number means somebody looking at the cards.');
    paras.push('The reason the offer is a share rather than the whole is simple enough: a buyer has to resell everything you hand them, absorb the pieces that never move, and carry that inventory in the meantime.');
    if (f.C < 55) paras.push('Condition is doing most of the damage here. Played cards are not a small discount off Near Mint — they are frequently worth a fraction of it, and that gap is why the offer will feel low.');
    paras.push('One thing worth doing first: pull out anything you suspect is genuinely valuable and price those separately. Bulk pricing on a collection that quietly contains a $400 card is how people lose the most money on this path.');
    paras.push('For what it is worth, the gap between this and selling it yourself is smaller than it looks. Online marketplaces take ' + CONFIG.fees.rangeLow + '–' + CONFIG.fees.rangeHigh + '% of every sale before shipping, and the cards that never sell still cost you the time you spent listing them.');
    return { title: 'Sell it as a lot to a reseller', paras, lede: 2 };
  }

  if (key === 'individual') {
    const paras = [];
    paras.push('You have material collectors actually want, and you have told us you are willing to do the work. Selling piece by piece is where the money is — but it is genuinely work, and it is worth being clear about how much.');
    paras.push('Realistically that means photographing each item, researching what it has recently <em>sold</em> for rather than what people are asking, writing listings, answering questions, packing properly, and shipping. Budget <strong>' + CONFIG.fees.rangeLow + '–' + CONFIG.fees.rangeHigh + '% to marketplace fees</strong> before you count shipping, and expect a collection like yours to take weeks or months to clear. There is more on the fee math further down.');
    if (state.concentration === 'few') {
      paras.push('Your value is concentrated, which makes this much easier than it sounds. <strong>Do not list everything.</strong> List the pieces carrying the value individually, then move the remainder as a single lot. The long tail of low-value cards will cost you more in time and shipping than it returns.');
    } else {
      paras.push('Your value is spread out, which is the harder version of this path. Listing hundreds of individually cheap cards rarely pays for the hours involved. Consider selling in themed lots — by set, by type, by era — rather than one card at a time.');
    }
    if (both) paras.push('Treat your sealed product as a separate decision. It sells to a different buyer, on a different timeline, for different reasons.');
    return { title: 'Sell the good pieces individually', paras, lede: 2 };
  }

  if (key === 'grade') {
    const paras = [];
    paras.push('You have the combination that actually justifies grading: cards with real value, condition that can support a high grade, demand from collectors, and the patience to wait for it. That combination is not common, and it is the only situation where grading reliably makes sense.');
    paras.push('<strong>We would not recommend grading everything.</strong> Grade the specific cards where the spread between raw value and graded value is wide enough to cover the fees, the shipping, the insurance, the months of waiting, and the real chance you get back a lower grade than you expected.');
    paras.push('This path is especially strong if you have held these cards a long time and paid far less than they are worth today. Your cost basis is low, the cards are already yours, and the only new money at risk is the grading itself.');
    paras.push('Be clear-eyed about the risk: a card you are certain is flawless can come back a 9 because of centering you never noticed. Centering alone caps grades, and it is the thing self-assessors miss most often.');
    if (CONFIG.grading.valueTiersPaused) {
      paras.push('One timing note that matters right now. <strong>PSA paused its cheap Value tiers in June 2026</strong> to work through a record backlog, so the cheapest tier you can currently order is Regular at ' + money(CONFIG.grading.feePerCard) + ' — roughly three times what bulk grading used to cost. That pushes the break-even up sharply. Since you already told us you are not in a rush, simply waiting for those tiers to reopen is a legitimate strategy in itself.');
    }
    return { title: 'Grade selectively — your best cards only', paras, lede: 2 };
  }

  const paras = [];
  paras.push("Nothing you have told us points cleanly at a sale yet, and that is a perfectly reasonable place to be. The most expensive decisions in this hobby get made by people who sold before they understood what they had.");
  let ledeN = 1;
  if (p.forced === 'evaluate' && (state.condSingles === 'dk' || state.condSealed === 'dk')) {
    paras.push('The specific problem is condition. You may be sitting on something worth real money, and condition is the single largest factor in what it is worth — <strong>a Near Mint card and a Moderately Played copy of the same card are not close in price.</strong> Any number anyone quotes you before that is settled, including ours, is a guess.');
    ledeN = 2;
  }
  paras.push('In the meantime, protect what you have. Penny sleeves inside toploaders or a proper binder, stored upright, somewhere dry and out of direct sunlight, at a stable temperature. Cards degrade quietly — sun fading, humidity warping and corner dings all happen slowly enough that you do not notice until the value is gone.');
  paras.push('Cataloguing is genuinely worth doing, and most people find it more enjoyable than they expect. Working through the collection card by card is also how you discover the pieces you did not know mattered. There is a section below on the apps we use to price things, and how much to trust each one.');
  return { title: 'Get it evaluated before you decide anything', paras, lede: ledeN };
}

function sealedPrimary(state, f, key) {
  const desirable = state.sealedScarcity === 'yes_scarce' || state.sealedScarcity === 'yes_oop';
  const goodCond = (f.cSealed ?? 50) >= 70;
  const sealedIntact = state.sealedFactory === 'yes';

  if (key === 'reseller') {
    const paras = [];
    paras.push('You want this handled quickly and with minimal fuss, and sealed product is straightforward to move as a lot. One transaction, one number, done.');
    paras.push('Sealed usually earns a better share of market value than loose cards do, because a buyer can resell it without sorting, grading or describing anything — but it is still a wholesale number, not a retail one. We are not going to guess at a figure for yours; that needs someone to actually see the product.');
    if (!sealedIntact) {
      paras.push('Be upfront about anything that has been opened or resealed. Buyers check, and a collection that gets returned costs you far more than the honest price would have.');
    }
    paras.push('Packaging condition is worth two minutes of your time before you get an offer. Crushed corners, dented lids, scuffed shrink and sun fading all move the number, and a buyer will spot every one of them.');
    return { title: 'Sell the sealed product as a lot', paras, lede: 2 };
  }

  if (key === 'grade') {
    return { title: 'Get the sealed product valued properly',
      paras: ['Grading applies to individual cards, not sealed boxes. What your product needs is an accurate current valuation — and if you are considering opening any of it, that valuation should come first.'], lede: 1 };
  }

  const paras = [];
  if (desirable && goodCond && f.T >= 70) {
    paras.push('This is the good version of a sealed collection. Out-of-print product in clean condition is the closest thing this hobby has to a real asset: the supply is fixed, it cannot be reprinted, and it shrinks every time someone opens a box. You also told us you are in no hurry, which is the one thing that makes holding a strategy rather than just procrastinating.');
    paras.push('<strong>Our recommendation is to hold what is genuinely scarce and sell the rest selectively.</strong> Where you do sell, sell to collectors — individual listings or direct to buyers who know exactly what the product is. Do not put desirable out-of-print sealed into a bulk offer; you will be paid a bulk number for something that is not bulk.');
    paras.push('Storage matters more than people expect for sealed. Keep boxes upright and unstacked, away from sunlight and humidity, at a stable temperature. Shrink wrap yellows, cardboard warps, and a box that quietly degrades in a garage loses the exact premium you were holding it for.');
    return { title: 'Hold the scarce pieces, sell the rest to collectors', paras, lede: 2 };
  }

  if (desirable && !goodCond) {
    paras.push('The product itself is desirable, but the packaging condition is working against you — and unlike a market, condition never recovers. Time is not on your side here the way it would be with a clean copy.');
    paras.push('Sell it individually, photograph the wear honestly, and price it against comparable copies in similar shape rather than against pristine ones. Collectors will still want it; they just want to know what they are getting.');
    return { title: 'Sell it individually, sooner rather than later', paras, lede: 2 };
  }

  paras.push('Your sealed product is current, in-print material, and that changes the calculus completely. In-print product does not appreciate — there is no scarcity story while it is still being manufactured, and every week that passes there is more of it in the world, not less.');
  paras.push('Sell it at or near retail, individually or in small lots. The buyers are there and the pricing is well understood, so this is one of the easier things in the hobby to move. What you should not do is sit on it waiting for an increase that only happens after a set goes out of print — and even then, only for some sets.');
  return { title: 'Sell it near retail — holding will not help', paras, lede: 2 };
}

function sealedStrategy(state, f) {
  if (state.sealedFactory === 'no') {
    return { title: 'Sell it as opened product',
      body: 'Once a box has been opened or resealed, the sealed premium is gone and it is not coming back. Price it on the cards inside, not on what a sealed copy sells for.' };
  }
  const desirable = state.sealedScarcity === 'yes_scarce' || state.sealedScarcity === 'yes_oop';
  const goodCond = (f.cSealed ?? 50) >= 70;
  if (desirable && goodCond) {
    return { title: 'Hold it, or sell it to collectors directly',
      body: 'Out-of-print sealed product in clean condition is the part of this hobby that behaves most like an asset. It is finite, it cannot be reprinted, and the supply only ever shrinks as people open it. If you can wait, waiting has historically been rewarded. If you sell, sell to collectors rather than into a bulk offer.' };
  }
  if (desirable && !goodCond) {
    return { title: 'Sell it individually, and sooner rather than later',
      body: 'The product is desirable, but the packaging condition is working against you and will not improve sitting in a closet. Photograph the wear honestly, price accordingly, and sell to collectors who know what they are looking at.' };
  }
  return { title: 'Sell it near retail — do not hold it',
    body: 'Current, in-print product does not appreciate while it is still on shelves. There is no scarcity story yet, and every week it stays sealed is a week the market has more of it than you do. Move it at or near retail.' };
}

function singlesStrategy(state, f) {
  const d = f.dSingles ?? 50, c = f.cSingles ?? 50;
  if (d >= 62 && c >= 70 && state.topCard100 === 'yes') {
    return { title: 'Split it three ways',
      body: 'Pull the handful of cards that could support a grade. List the next tier individually. Move everything below that as a single bulk lot — the tail is not worth your evenings.' };
  }
  if (d >= 55) {
    return { title: 'List the good ones, bulk the rest',
      body: 'There is enough here that collectors will compete for the top slice. Sell those individually and stop there; the rest earns more as one lot than as hundreds of listings.' };
  }
  return { title: 'Sell as a lot',
    body: 'Nothing in the singles is carrying enough weight to justify individual listings. A single bulk transaction is the right call for this half.' };
}

function gradingCalcHTML(state) {
  const g = CONFIG.grading;
  const perCard = g.feePerCard + g.suppliesPerCard + (g.shipPerSubmission / g.cardsPerSubmission);
  const era = has(state.typesSingles, 'vintage') || has(state.typesSingles, 'first_ed') ? 'vintage' : 'modern';
  return `
    <div class="calc">
      <div class="calc-input-row">
        <div>
          <label for="raw-value">What is one card worth raw, in Near Mint?</label>
          <input type="number" id="raw-value" value="250" min="0" step="10">
        </div>
        <p class="field-hint-inline" style="margin:0 0 12px">Using <strong>${era}</strong> multiples, based on what you told us.</p>
      </div>
      <div class="calc-scroll"><table class="calc-table" id="calc-table"></table></div>
      <p class="calc-foot">
        All-in cost assumed at <strong>${money(perCard)} per card</strong> —
        ${money(g.feePerCard)} grading, ${money(g.suppliesPerCard)} supplies, and insured shipping both ways split across a
        ${g.cardsPerSubmission}-card submission. Turnaround runs <strong>${g.turnaroundMonths} months</strong>.
        ${g.valueTiersPaused ? `<br><br>
        <strong>Grading got a lot more expensive this year.</strong> PSA paused its cheap Value tiers in June 2026 to work
        down a record backlog, so Regular at ${money(g.feePerCard)} is currently the cheapest tier you can actually order —
        roughly triple what the Value tier cost. There is no announced reopening date. If you are not in a hurry, waiting for
        those tiers to come back is itself a strategy.` : ''}
        <br><br>
        ${era === 'modern' ? `Note the shape of the modern numbers: <strong>only the PSA 10 reliably pays.</strong> A modern PSA 9
        often sells for about what the raw card does, or slightly less — the grade tells buyers the card was examined closely and
        found flawed. You are essentially paying ${money(perCard)} for a coin flip on the 10.`
        : `On vintage, even a PSA 8 carries a real premium, because authentication itself is worth something on cards old enough
        to be faked or trimmed. The trade-off is that vintage gems are genuinely rare — under 1% of pre-1980 cards grade a 10.`}
        <br><br>
        These multiples are directional ranges, not price data. What a grade is actually worth varies enormously by set and by card,
        and the odds assume you judged the card correctly in the first place — which is where most submissions go wrong.
        Check recent sold listings for your exact card in your target grade before you commit.
      </p>
    </div>`;
}

function renderCalcTable(state) {
  const input = document.getElementById('raw-value');
  const table = document.getElementById('calc-table');
  if (!input || !table) return;
  const raw = Math.max(0, Number(input.value) || 0);
  const g = CONFIG.grading;
  const perCard = g.feePerCard + g.suppliesPerCard + (g.shipPerSubmission / g.cardsPerSubmission);
  const era = has(state.typesSingles, 'vintage') || has(state.typesSingles, 'first_ed') ? 'vintage' : 'modern';
  const m = CONFIG.gradeMultipliers[era];
  const odds = CONFIG.gradeOdds[era];

  const row = (label, mult, chance) => {
    const lo = raw * mult[0], hi = raw * mult[1];
    const net = raw * ((mult[0] + mult[1]) / 2) - raw - perCard;
    return `<tr>
      <td>${label}</td>
      <td>${Math.round(chance * 100)}%</td>
      <td>${money(lo)} – ${money(hi)}</td>
      <td class="${net >= 0 ? 'net-pos' : 'net-neg'}">${net >= 0 ? '+' : '−'}${money(Math.abs(net))}</td>
    </tr>`;
  };

  const evMult = odds[10] * ((m[10][0] + m[10][1]) / 2) +
                 odds[9] * ((m[9][0] + m[9][1]) / 2) +
                 odds[8] * ((m[8][0] + m[8][1]) / 2) +
                 odds.low * 0.7;
  const ev = raw * evMult - raw - perCard;

  table.innerHTML = `
    <thead><tr><th>Outcome</th><th>Rough odds</th><th>Estimated value</th><th>Net vs. selling raw</th></tr></thead>
    <tbody>
      ${row('PSA 10', m[10], odds[10])}
      ${row('PSA 9', m[9], odds[9])}
      ${row('PSA 8', m[8], odds[8])}
      <tr><td>PSA 7 or lower</td><td>${Math.round(odds.low * 100)}%</td><td>below raw</td>
          <td class="net-neg">−${money(raw * 0.3 + perCard)}</td></tr>
      <tr><td><strong>Weighted average</strong></td><td>—</td><td>${money(raw * evMult)}</td>
          <td class="${ev >= 0 ? 'net-pos' : 'net-neg'}">${ev >= 0 ? '+' : '−'}${money(Math.abs(ev))}</td></tr>
    </tbody>`;
}

/* ---------- Contact, placed directly under the recommendation ----------
   This used to be a single link at the very bottom of a long page. Anyone
   whose answer is "sell it to a shop" had to scroll past every other
   section to find out how to reach one. The form posts to the same
   endpoint as the one on the home page, and carries a summary of what the
   tool concluded so we open the email already knowing the shape of the
   collection. ---------------------------------------------------------- */

const CONTACT = {
  email: 'booth151.jtx@gmail.com',
  ebay: 'https://www.ebay.com/usr/nottheorphans',
  action: 'https://formsubmit.co/booth151.jtx@gmail.com',
  next: 'https://schrodingerscards.com/thanks.html'
};

const CONTACT_PITCH = {
  reseller: {
    h: 'We are the other side of this transaction',
    p: 'Selling as a lot means selling to a shop, and that is what we do. Tell us roughly what you have and we will come back with a real number — or tell you honestly when you would do better selling it yourself. No obligation either way.',
    btn: 'Send us the details'
  },
  evaluate: {
    h: 'This is the part we can help with',
    p: 'Working out what a collection actually is, before deciding anything, is exactly what we spent months doing with our own. Tell us roughly what you have and we will help you place it — free, and with no expectation that you sell it to us.',
    btn: 'Ask us to take a look'
  },
  individual: {
    h: 'Happy to be a second opinion',
    p: 'Selling it yourself is the right call here, and we are not going to talk you out of it. If you want a sanity check on a price, a read on condition, or somewhere to move the bulk you do not want to list, just ask.',
    btn: 'Ask us a question'
  },
  grade: {
    h: 'Get a second look before you submit',
    p: 'Grading is the one decision here you cannot undo cheaply, and the most common way it goes wrong is a card that was not the grade its owner thought. If you want another set of eyes on your candidates first, send them over.',
    btn: 'Ask us about your cards'
  }
};

/* A short machine-written précis of the run, sent with the form so the
   reply can start from something concrete instead of "tell me more". */
function answerSummary(state, p) {
  const label = (map, v) => map[v] || v || 'not answered';
  const bits = [
    'Recommendation: ' + PATH_META[p.ranked[0].key].label,
    'Holdings: ' + label({ singles: 'individual cards', sealed: 'sealed product', both: 'both' }, state.holdings),
    'Goal: ' + label({ cash: 'cash reasonably quickly', max: 'as much money as reasonable', grade: 'maximize best cards', unsure: 'not sure yet' }, state.goal),
    'Size: ' + label({ u50: 'under 50 items', s50_250: '50-250', s250_1k: '250-1,000', s1k_5k: '1,000-5,000', s5k: '5,000+', dk: 'unknown' }, state.size),
    'Stated value: ' + label({ u100: 'under $100', v100_500: '$100-500', v500_1k: '$500-1,000', v1k_5k: '$1,000-5,000', v5k_10k: '$5,000-10,000', v10k: '$10,000+', dk: 'no idea' }, state.value)
  ];
  if (hasSingles(state)) {
    bits.push('Card condition: ' + label({ nm: 'Near Mint', lp: 'Lightly Played', mp: 'Moderately Played', hp: 'Heavily Played', mixed: 'mixed', dk: 'unknown' }, state.condSingles));
    bits.push('Card worth $100+: ' + label({ yes: 'yes', no: 'no', dk: 'unknown' }, state.topCard100));
  }
  if (hasSealed(state)) {
    bits.push('Sealed condition: ' + label({ factory: 'factory sealed, excellent', minor: 'minor wear', noticeable: 'noticeable wear', damaged: 'significant damage', mixed: 'mixed', dk: 'unknown' }, state.condSealed));
    bits.push('Sealed scarcity: ' + label({ yes_scarce: 'out of print and hard to find', yes_oop: 'some out of print', no: 'all current product', dk: 'unknown' }, state.sealedScarcity));
  }
  return bits.join(' | ');
}

function contactBlock(state, f, p) {
  const key = p.ranked[0].key;
  const pitch = CONTACT_PITCH[key] || CONTACT_PITCH.evaluate;
  const summary = answerSummary(state, p);
  const subject = 'Collection guide — ' + PATH_META[key].label;

  return `<section class="rec-contact" id="rec-contact">
    <div class="rec-contact-copy">
      <p class="eyebrow">Talk to us</p>
      <h2>${pitch.h}</h2>
      <p>${pitch.p}</p>
      <ul class="rec-contact-list">
        <li><span>Email</span><a href="mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}">${CONTACT.email}</a></li>
        <li><span>In person</span>Booth 151, Treasure Cove Mall<br>118 E Commerce St, Jacksonville, TX<br>Tuesday&ndash;Saturday, 10am&ndash;5pm</li>
        <li><span>Buying instead?</span><a href="${CONTACT.ebay}" target="_blank" rel="noopener">Our eBay store</a></li>
      </ul>
    </div>

    <form class="rec-contact-form" action="${CONTACT.action}" method="POST">
      <input type="hidden" name="_subject" value="${subject}">
      <input type="hidden" name="_template" value="table">
      <input type="hidden" name="_next" value="${CONTACT.next}">
      <input type="text" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true" class="hp-field">
      <input type="hidden" name="guide_result" value="${summary.replace(/"/g, '&quot;')}">

      <p class="rec-form-note">Your answers come with the message, so you do not have to repeat any of it.</p>

      <label for="rc-name">Name</label>
      <input type="text" id="rc-name" name="name" required>

      <label for="rc-email">Your email address</label>
      <input type="email" id="rc-email" name="email" required>

      <label for="rc-message">Anything you want to add</label>
      <textarea id="rc-message" name="message" rows="4" placeholder="Which sets or eras, anything already graded, and photos if you have them — all useful, none of it required."></textarea>

      <button type="submit" class="btn btn-primary">${pitch.btn}</button>
    </form>
  </section>`;
}

/* A collapsed section. Everything that is genuinely reference material
   lives in one of these: available to anyone who wants it, invisible to
   anyone who does not. */
function fold(summary, note, body, open) {
  return `<details class="rec-fold"${open ? ' open' : ''}>
    <summary><span class="fold-title">${summary}</span>${note ? `<span class="fold-note">${note}</span>` : ''}</summary>
    <div class="fold-body">${body}</div>
  </details>`;
}

/* ============================================================
   RESULTS PAGE
   ============================================================ */

function renderResults(state) {
  const f = computeFactors(state);
  const p = scorePaths(state, f);
  const primary = primaryCopy(state, f, p);
  const both = state.holdings === 'both';
  const ledeN = primary.lede || 1;
  const lede = primary.paras.slice(0, ledeN);
  const rest = primary.paras.slice(ledeN);
  let html = '';

  /* ---- The answer, and nothing else ---- */
  html += `<p class="result-eyebrow">Our recommendation</p>
    <div class="rec-primary">
      <h1>${primary.title}</h1>
      ${lede.map((t) => `<p class="rec-body">${t}</p>`).join('')}
    </div>`;

  /* ---- Then how to reach us, before anything else competes for attention ---- */
  html += contactBlock(state, f, p);

  /* ---- A mixed collection genuinely has two answers, so both stay visible ---- */
  if (both) {
    const sg = singlesStrategy(state, f), sl = sealedStrategy(state, f);
    html += `<section class="rec-section">
      <h2>Split it in two</h2>
      <p class="rec-section-sub">Your singles and your sealed product are different markets with different buyers. Forcing them into one decision costs money.</p>
      <div class="split-grid">
        <div class="split-col"><h3>Individual cards</h3><h4>${sg.title}</h4><p>${sg.body}</p></div>
        <div class="split-col"><h3>Sealed product</h3><h4>${sl.title}</h4><p>${sl.body}</p></div>
      </div>
    </section>`;
  } else if (hasSealed(state)) {
    const sl = sealedStrategy(state, f);
    html += `<section class="rec-section">
      <div class="card-stack"><div class="rec-card"><h3>${sl.title}</h3><p>${sl.body}</p></div></div>
    </section>`;
  }

  /* ---- Everything below here is reference, and folds away ---- */
  html += '<div class="rec-folds"><p class="rec-folds-head">More detail, if you want it</p>';

  if (rest.length) {
    html += fold('The rest of the reasoning', `${rest.length} more note${rest.length > 1 ? 's' : ''}`,
      rest.map((t) => `<p>${t}</p>`).join(''));
  }

  /* ---- Alternatives ---- */
  const alts = p.ranked.slice(1).filter((r) => !(r.key === 'grade' && !p.gate.passed));
  if (alts.length) {
    html += fold('Your other options', `${alts.length} ranked`,
      `<p class="fold-lede">Ranked by how well they fit what you told us. None of these are wrong — they just trade different things away.</p>
       <div class="card-stack">
        ${alts.map((r, i) => `<div class="rec-card">
          <h3>${PATH_META[r.key].label} <span class="tag ${i === 0 ? 'tag-mid' : ''}">${r.score}/100 fit</span></h3>
          <p>${PATH_META[r.key].short}</p>
        </div>`).join('')}
       </div>`);
  }

  /* ---- Opening sealed product ---- */
  if (hasSealed(state)) {
    html += fold('Thinking about opening any of the sealed product?', 'Read this first',
      `<p>Opening sealed product changes the equation completely. You are trading a known, finite, collectible object for a random assortment of cards — and on average, the cards inside a box are worth less than the sealed box itself. That is how the economics have to work; it is why sealed product exists as a category.</p>
       <p>The trade is irreversible. If your goal is value, find out what the sealed item is worth <strong>before</strong> you open it. If your goal is the fun of opening it, that is a completely legitimate reason — just make it a decision rather than an accident.</p>`);
  }

  /* ---- Grading ---- */
  if (hasSingles(state)) {
    if (p.gate.passed) {
      html += fold('Run the grading numbers', 'Interactive',
        `<p class="fold-lede">Grading is not automatically right for an expensive card. The spread has to be wide enough to cover the fees, the wait and the risk. Put in what one of your best cards is worth raw:</p>
         ${gradingCalcHTML(state)}`);
    } else if (p.gate.blockers.length && p.gate.blockers[0].key !== 'singles') {
      html += fold("Why we're not recommending grading", `${p.gate.blockers.length} reason${p.gate.blockers.length > 1 ? 's' : ''}`,
        `<p class="fold-lede">Grading needs several things to line up at once. Here's what isn't lining up for you:</p>
         <div class="card-stack">
          ${p.gate.blockers.map((b) => `<div class="rec-card"><h3>${gateLabel(b.key)}</h3><p>${b.msg}</p></div>`).join('')}
         </div>`);
    }
  }

  /* ---- What selling actually costs ---- */
  const topKey = p.ranked[0].key;
  if (topKey === 'individual' || topKey === 'reseller' || p.ranked[1]?.key === 'individual') {
    const fe = CONFIG.fees;
    const net100 = 100 - (100 * fe.ebayPct / 100) - fe.ebayPerOrder - fe.shipPerOrder;
    html += fold('What selling online actually costs', `${fe.rangeLow}–${fe.rangeHigh}% in fees`,
      `<p class="fold-lede">Every "it's worth $X" number you see is a gross figure. This is the part that surprises people, so it is worth seeing before you start listing.</p>
       <div class="card-stack">
        <div class="rec-card">
          <h3>Expect to lose ${fe.rangeLow}–${fe.rangeHigh}% to fees</h3>
          <p><strong>eBay</strong> takes a ${fe.ebayPct}% final value fee plus ${money2(fe.ebayPerOrder)} per order — and it is charged on the
             <em>total</em>, meaning the item price, the shipping you charged, and the sales tax the buyer paid. There is one useful exception:
             singles that sell for ${money(fe.ebayHighValueThreshold)} or more get 50% off that fee, which meaningfully changes the math on your best cards.</p>
          <p><strong>TCGplayer</strong> lands in the same place by a different route — 10.75% commission plus 2.5% and ${money2(0.30)} for payment processing, so about ${fe.tcgplayerPct}% all-in.</p>
          <p>As a worked example: on a hypothetical ${money(100)} sale, after fees and a plain shipped envelope, you would keep roughly <strong>${money(net100)}</strong>. Then subtract your time.</p>
        </div>
        <div class="rec-card">
          <h3>Why this changes the comparison</h3>
          <p>A reseller offer of half your collection's tracked value is not competing against the full sticker price — it is competing against
             that price minus ${fe.rangeLow}–${fe.rangeHigh}% in fees, minus shipping, minus the cards that never sell, minus however many
             evenings you spend listing. The gap between "sell it as a lot" and "sell it individually" is real, but it is narrower than the
             headline numbers suggest, and it narrows further the more low-value cards you are dragging along.</p>
          <p>This is also why bulk is worth handing to a buyer rather than listing: a ${money(4)} card loses most of its value to a fee, an
             envelope and fifteen minutes of your attention.</p>
        </div>
       </div>`);
  }

  /* ---- How to price it yourself ---- */
  html += fold('How to value it yourself', 'Four tools we actually use',
    `<p class="fold-lede">You do not need us to get a rough number. These are the tools we actually use, and what each one is good and bad at.</p>
     <div class="card-stack">
      <div class="rec-card">
        <h3>TCGplayer <span class="tag tag-good">Start here</span></h3>
        <p>The default price reference for singles in the US, and what most shops price against. Search the card, pick the right set and printing, and look at Market Price rather than the lowest listing — the cheapest copy is usually cheap for a reason. Free, and you do not need an account to look.</p>
      </div>
      <div class="rec-card">
        <h3>Collectr <span class="tag tag-mid">Best for cataloguing</span></h3>
        <p>Scan cards with your phone and it builds a running total as you go. For answering "what do I actually have?" across a big collection, nothing else is close, and it is genuinely enjoyable to use.</p>
        <p><strong>One caveat worth knowing.</strong> Collectr reports portfolio estimates rather than realised sold prices, and it never asks you to assess condition — so it quietly assumes everything is clean. In our experience its totals run <strong>${CONFIG.collectrRangeLow}–${CONFIG.collectrRangeHigh}% above</strong> what the same cards fetch on eBay. Treat the number as a ceiling, not a valuation.</p>
      </div>
      <div class="rec-card">
        <h3>eBay sold listings <span class="tag tag-good">The real answer</span></h3>
        <p>Search the card, then filter to <strong>Sold Items</strong>. This is the only source that shows what somebody actually paid rather than what a seller hopes to get. Active listings can sit unsold at fantasy prices forever; sold listings cannot lie. Match the condition and the grade when you compare, and ignore the outliers at both ends.</p>
      </div>
      <div class="rec-card">
        <h3>PriceCharting</h3>
        <p>Most useful for graded cards and sealed product, where it tracks prices by grade over time. Good for seeing whether something has been climbing or sliding rather than just where it sits today.</p>
      </div>
      <div class="rec-card">
        <h3>A ten-minute version</h3>
        <p>If you do nothing else: pull the <strong>ten cards you think are the best</strong>, look each one up on eBay sold listings, and add them up. That number tells you most of what you need to know, because value concentrates far more than people expect. Then assume the rest of the collection is worth less than you are hoping — that assumption is right more often than it is wrong.</p>
        <p>If your ten best come to more than a few hundred dollars, it is worth slowing down and doing this properly before you sell anything.</p>
      </div>
     </div>`);

  /* ---- Factor readout ---- */
  const factorRows = [
    ['Value at stake', f.V, 'How much is actually on the line.'],
    ['Condition', f.C, 'The single biggest multiplier on everything else.'],
    ['Collector demand', f.D, 'Whether people are competing for what you have.'],
    ['Your patience', f.T, 'How long you can leave money on the table.'],
    ['Your effort', f.E, 'How much of the selling work you will do yourself.']
  ];
  let drove = `<p class="fold-lede">Five variables decide every recommendation in this tool. Yours read like this:</p>
    <div class="factors">
      ${factorRows.map(([name, val, note]) => `
        <div class="factor-row">
          <span class="factor-name">${name}</span>
          <span class="factor-track"><span class="factor-fill" style="width:${Math.round(val)}%"></span></span>
          <p class="factor-note">${note}</p>
        </div>`).join('')}
    </div>`;
  if (f.confidence < CONFIG.confidenceFloor) {
    drove += `<div class="rec-card rec-card-warn" style="margin-top:24px">
      <h3>We're working with gaps</h3>
      <p>You answered "I don't know" on ${listify(f.unknowns)}. That is completely fine — but it means we have scaled our confidence down, and it is why we have not put firm numbers on anything. Closing those gaps is the highest-value thing you can do before making a decision.</p>
    </div>`;
  }
  html += fold('What drove this', f.confidence < CONFIG.confidenceFloor ? 'Working with gaps' : `${f.confidence}% confidence`, drove);

  /* ---- Reinforcement ---- */
  html += fold('Three things worth remembering', 'Whatever you decide',
    `<div class="card-stack">
      <div class="rec-card"><h3>Condition is the whole game</h3>
        <p>It is not a modifier on value — for a lot of cards it <em>is</em> the value. The same card can swing several times over between Near Mint and Moderately Played. Almost everyone grades their own cards too generously, so if you are on the fence between two tiers, the lower one is usually right.</p></div>
      <div class="rec-card"><h3>Rarity and age decide who is bidding</h3>
        <p>SIRs, SARs, alt arts, First Edition, serialized cards, promos and vintage holos are what collectors actively hunt. They are also the cards where grading is worth considering. Everything else competes with an enormous supply of identical copies.</p></div>
      <div class="rec-card"><h3>Store it properly regardless</h3>
        <p>Whatever you decide, do not let the collection degrade while you think about it. Sleeves and toploaders or a real binder, upright, dry, stable temperature, out of the sun. This costs almost nothing and protects everything.</p></div>
     </div>`);

  html += '</div>';

  html += `<div class="result-actions">
    <button type="button" class="btn btn-outline" id="restart-btn">Start over</button>
    <a class="btn btn-ghost" href="index.html">Back to the site</a>
  </div>`;

  const host = document.getElementById('guide-results');
  host.innerHTML = html;
  host.hidden = false;
  document.getElementById('guide-app').hidden = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  /* The calculator only exists once its fold has been opened, so wire it
     the first time that happens rather than up front. */
  const wireCalc = () => {
    const rawInput = document.getElementById('raw-value');
    if (!rawInput || rawInput.dataset.wired) return;
    rawInput.dataset.wired = '1';
    renderCalcTable(state);
    rawInput.addEventListener('input', () => renderCalcTable(state));
  };
  host.querySelectorAll('.rec-fold').forEach((d) => d.addEventListener('toggle', wireCalc));
  wireCalc();

  document.getElementById('restart-btn').addEventListener('click', restart);
}

function gateLabel(key) {
  return {
    value: 'The cards are not valuable enough',
    condition: 'Condition is not there (or is not known)',
    demand: 'Not enough collector demand',
    patience: 'You want the money sooner than grading takes',
    willing: 'You would rather not spend money up front',
    singles: 'Grading applies to individual cards'
  }[key] || key;
}

function listify(arr) {
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return arr[0] + ' and ' + arr[1];
  return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
}

/* ============================================================
   APP CONTROLLER
   ============================================================ */

const state = {};
let cursor = 0;

const el = (id) => document.getElementById(id);

const fieldsFor = (screen) => screen.fields.filter((fld) => !fld.when || fld.when(state));
const screenActive = (screen) =>
  (!screen.when || screen.when(state)) && fieldsFor(screen).length > 0;

function visibleScreens() { return SCREENS.filter(screenActive); }

function renderScreen(keepFocus) {
  const screen = SCREENS[cursor];
  const flds = fieldsFor(screen);

  let html = `<div class="screen"><h2>${screen.title}</h2>`;
  if (screen.sub) html += `<p class="screen-sub">${screen.sub}</p>`;
  html += '<div style="margin-top:26px">';

  flds.forEach((fld) => {
    html += '<div class="field">';
    if (fld.label) html += `<span class="field-label">${fld.label}</span>`;
    if (fld.hint) html += `<p class="field-hint">${fld.hint}</p>`;
    const multi = fld.type === 'multi';
    if (multi) html += `<p class="field-hint">Select all that apply.</p>`;
    html += `<div class="options${fld.options.length > 6 ? ' cols-2' : ''}">`;
    fld.options.forEach((o) => {
      const checked = multi
        ? has(state[fld.key], o.v)
        : state[fld.key] === o.v;
      html += `<label class="opt${multi ? ' opt-multi' : ''}">
        <input type="${multi ? 'checkbox' : 'radio'}" name="${fld.key}" value="${o.v}"${checked ? ' checked' : ''}>
        <span class="opt-box" aria-hidden="true"></span>
        <span class="opt-text">
          <span class="opt-title">${o.t}</span>
          ${o.d ? `<span class="opt-desc">${o.d}</span>` : ''}
        </span>
      </label>`;
    });
    html += '</div></div>';
  });
  html += '</div></div>';

  el('screen-host').innerHTML = html;
  el('validation-msg').hidden = true;
  el('help-rail').hidden = !screen.showHelp;
  el('back-btn').disabled = visibleScreens().indexOf(screen) === 0;

  const vis = visibleScreens();
  const pos = vis.indexOf(screen) + 1;
  /* On the very first screen `holdings` is still unset, so neither the
     singles nor the sealed screen counts as active and the total reads
     two short. Five is the floor for any real path. */
  const total = Math.max(vis.length, state.holdings ? vis.length : 5);
  el('progress-bar').style.width = ((pos - 1) / total * 100) + '%';
  el('progress-label').textContent = `Step ${pos} of ${state.holdings ? total : 'about ' + total}`;

  el('next-btn').textContent = pos >= vis.length ? 'See my recommendation' : 'Continue';
  if (!keepFocus) el('screen-host').querySelector('.opt input')?.focus({ preventScroll: true });
}

/* Reads the current screen's answers into state without validating, so a
   field whose `when` depends on a neighbour can be re-evaluated the moment
   that neighbour is answered. Grouping the questions onto fewer screens is
   what made this necessary: `valueSource` follows `value` on one screen now,
   and a screen rendered once would never show it. */
function softCollect() {
  const host = el('screen-host');
  SCREENS[cursor].fields.forEach((fld) => {
    const inputs = [...host.querySelectorAll(`input[name="${fld.key}"]`)];
    if (!inputs.length) return;
    if (fld.type === 'multi') {
      state[fld.key] = inputs.filter((i) => i.checked).map((i) => i.value);
    } else {
      const picked = inputs.find((i) => i.checked);
      if (picked) state[fld.key] = picked.value;
    }
  });
}

function collect() {
  const screen = SCREENS[cursor];
  const flds = fieldsFor(screen);
  const missing = [];
  flds.forEach((fld) => {
    const inputs = [...el('screen-host').querySelectorAll(`input[name="${fld.key}"]`)];
    if (fld.type === 'multi') {
      const vals = inputs.filter((i) => i.checked).map((i) => i.value);
      if (!vals.length) missing.push(fld.label || screen.title);
      else state[fld.key] = vals;
    } else {
      const picked = inputs.find((i) => i.checked);
      if (!picked) missing.push(fld.label || screen.title);
      else state[fld.key] = picked.value;
    }
  });
  return missing;
}

function advance(dir) {
  let i = cursor + dir;
  while (i >= 0 && i < SCREENS.length && !screenActive(SCREENS[i])) i += dir;
  return i;
}

function restart() {
  Object.keys(state).forEach((k) => delete state[k]);
  cursor = 0;
  el('guide-results').hidden = true;
  el('guide-results').innerHTML = '';
  el('guide-intro').hidden = false;
  el('guide-app').hidden = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------- Wiring ---------- */

el('start-btn').addEventListener('click', () => {
  el('guide-intro').hidden = true;
  el('guide-app').hidden = false;
  cursor = 0;
  renderScreen();
});

el('screen-host').addEventListener('change', () => {
  const screen = SCREENS[cursor];
  const before = fieldsFor(screen).map((f) => f.key);
  softCollect();
  const after = fieldsFor(screen).map((f) => f.key);
  if (before.join() === after.join()) return;
  /* A field that just disappeared must not leave its answer behind to be
     scored — the user has since contradicted it. */
  before.filter((k) => !after.includes(k)).forEach((k) => delete state[k]);
  renderScreen(true);
});

el('screen-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const missing = collect();
  if (missing.length) {
    const msg = el('validation-msg');
    msg.textContent = 'Please answer: ' + listify(missing) + '. Every question has an "I don\'t know" option if you\'re unsure.';
    msg.hidden = false;
    return;
  }
  const next = advance(1);
  if (next >= SCREENS.length) {
    renderResults(state);
  } else {
    cursor = next;
    renderScreen();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

el('back-btn').addEventListener('click', () => {
  collect();
  const prev = advance(-1);
  if (prev >= 0) { cursor = prev; renderScreen(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
});

/* ---------- Condition drawer ---------- */

const drawer = el('condition-drawer');
const backdrop = el('drawer-backdrop');
const openDrawer = () => { drawer.hidden = false; backdrop.hidden = false; el('drawer-close').focus(); };
const closeDrawer = () => { drawer.hidden = true; backdrop.hidden = true; };

el('condition-help-btn').addEventListener('click', openDrawer);
el('drawer-close').addEventListener('click', closeDrawer);
backdrop.addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.hidden) closeDrawer(); });
