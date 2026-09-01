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

  /* ---- What a reseller realistically pays, as a share of
     tracked "market" value (Collectr / TCGplayer style). The
     owner's rule of thumb is ~50% at Near Mint, scaling down
     hard with condition. VERIFY against your own buy rates. ---- */
  resellerPayout: {
    nm: [0.45, 0.55],
    lp: [0.35, 0.45],
    mp: [0.22, 0.32],
    hp: [0.10, 0.20],
    mixed: [0.28, 0.42],
    dk: [0.20, 0.50]
  },

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
  confidenceFloor: 62,

  /* ---- The collapsed "Testing view" at the bottom of the results,
     showing the raw scores and which rules fired. Useful while tuning
     the numbers above, but not something customers should see.

     'auto'  -> shown when opened locally (localhost or a file:// path),
                hidden on the live site. This is the default: you keep the
                panel while testing without having to remember to switch
                it off before deploying.
     true    -> always shown, live site included.
     false   -> never shown, anywhere. ---- */
  showTestingPanel: 'auto'
};

/* Is this a local copy rather than the live site? */
function isLocalPreview() {
  const h = location.hostname;
  return location.protocol === 'file:' ||
         h === 'localhost' || h === '127.0.0.1' || h === '::1' ||
         h === '' || h.endsWith('.local');
}

function showTestingPanel() {
  return CONFIG.showTestingPanel === 'auto'
    ? isLocalPreview()
    : Boolean(CONFIG.showTestingPanel);
}

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
   screen is shown at all, so the flow adapts: a singles-only user
   never sees the sealed questions. ------------------------------- */

const hasSingles = (s) => s.holdings === 'singles' || s.holdings === 'both';
const hasSealed  = (s) => s.holdings === 'sealed'  || s.holdings === 'both';

const SCREENS = [
  {
    id: 'holdings',
    title: 'What do you have?',
    sub: 'Sealed product and loose cards behave like two different markets, so we handle them separately.',
    fields: [{
      key: 'holdings', type: 'single',
      options: [
        { v: 'singles', t: 'Individual cards', d: 'Loose singles, sleeved or in binders, boxes or stacks.' },
        { v: 'sealed', t: 'Sealed product', d: 'Unopened packs, boxes, ETBs, tins, collection boxes.' },
        { v: 'both', t: 'Both', d: 'A mix of loose cards and sealed product.' }
      ]
    }]
  },

  {
    id: 'goal',
    title: 'What are you hoping to get out of it?',
    sub: 'There is no wrong answer here — it just changes which trade-offs we weigh more heavily.',
    fields: [{
      key: 'goal', type: 'single',
      options: [
        { v: 'cash', t: 'Cash, reasonably quickly', d: 'Convenience matters more to me than squeezing out the last dollar.' },
        { v: 'max', t: 'As much money as is reasonable', d: "I'll do more work if it means a meaningfully better return." },
        { v: 'grade', t: 'Maximize what my best cards are worth', d: "I'd spend money and wait months if the upside justifies it." },
        { v: 'unsure', t: "I'm not sure yet", d: 'I want to understand what I have before I decide anything.' }
      ]
    }]
  },

  {
    id: 'size',
    title: 'Roughly how big is the collection?',
    sub: 'A ballpark is fine. This mostly tells us whether selling piece by piece is even practical.',
    fields: [{
      key: 'size', type: 'single',
      hint: 'For sealed product, count each sealed item as one.',
      options: [
        { v: 'u50', t: 'Under 50 items' },
        { v: 's50_250', t: '50 – 250' },
        { v: 's250_1k', t: '250 – 1,000' },
        { v: 's1k_5k', t: '1,000 – 5,000' },
        { v: 's5k', t: '5,000+' },
        { v: 'dk', t: "I don't know" }
      ]
    }]
  },

  {
    id: 'condition',
    title: 'What kind of condition is it in?',
    sub: "Condition moves value more than almost anything else, and it's the easiest thing to be too generous about. If you're not sure, say so — we'd rather give you an honest answer than a flattering one.",
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
      }
    ]
  },

  {
    id: 'singlesTypes',
    title: "What's actually in there?",
    sub: 'Pick everything that applies. Rarity and era decide whether collectors compete for your cards or ignore them.',
    when: hasSingles,
    fields: [{
      key: 'typesSingles', type: 'multi',
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
    }]
  },

  {
    id: 'singlesTop',
    title: 'Your best cards',
    sub: 'One or two strong cards often change the whole recommendation, so it matters more than the total.',
    when: hasSingles,
    fields: [
      {
        key: 'topCard100', type: 'single',
        label: 'Do you have any individual cards worth roughly $100 or more?',
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
          { v: 'yes', t: 'Yes, I have cards collectors actively look for' },
          { v: 'no', t: 'Not really — valuable, but common enough' },
          { v: 'dk', t: "I don't know" }
        ]
      }
    ]
  },

  {
    id: 'sealedTypes',
    title: 'What sealed product do you have?',
    sub: 'Pick everything that applies.',
    when: hasSealed,
    fields: [{
      key: 'typesSealed', type: 'multi',
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
    }]
  },

  {
    id: 'sealedDetail',
    title: 'A few things about the sealed product',
    sub: 'Sealed is its own asset class. These four answers do most of the work.',
    when: hasSealed,
    fields: [
      {
        key: 'sealedFactory', type: 'single',
        label: 'Is it all still unopened and factory sealed?',
        options: [
          { v: 'yes', t: 'Yes, all of it' },
          { v: 'mixed', t: 'Some is, some has been opened or resealed' },
          { v: 'no', t: 'No' },
          { v: 'dk', t: "I don't know" }
        ]
      },
      {
        key: 'sealedOutOfPrint', type: 'single',
        label: 'Is any of it older or out of print?',
        hint: 'Out-of-print sealed is the part that tends to appreciate.',
        options: [
          { v: 'yes', t: 'Yes' },
          { v: 'no', t: 'No, it’s all current product' },
          { v: 'dk', t: "I don't know" }
        ]
      },
      {
        key: 'sealedScarce', type: 'single',
        label: 'Is any of it particularly hard to find?',
        options: [
          { v: 'yes', t: 'Yes, I believe so' },
          { v: 'no', t: 'No' },
          { v: 'dk', t: "I don't know" }
        ]
      },
      {
        key: 'sealedOpening', type: 'single',
        label: 'Are you thinking about opening any of it?',
        options: [
          { v: 'yes', t: "Yes, I've been tempted" },
          { v: 'no', t: 'No, I plan to keep it sealed' },
          { v: 'unsure', t: "I'm not sure" }
        ]
      }
    ]
  },

  {
    id: 'value',
    title: 'Any sense of what it might be worth?',
    sub: 'A guess is fine. We weight it by how you arrived at it.',
    fields: [
      {
        key: 'value', type: 'single',
        label: 'Estimated total value',
        hint: 'No idea? Pick "I have no idea" — we will show you how to work it out at the end.',
        options: [
          { v: 'u100', t: 'Under $100' },
          { v: 'v100_500', t: '$100 – $500' },
          { v: 'v500_1k', t: '$500 – $1,000' },
          { v: 'v1k_5k', t: '$1,000 – $5,000' },
          { v: 'v5k_10k', t: '$5,000 – $10,000' },
          { v: 'v10k', t: '$10,000+' },
          { v: 'dk', t: "I have no idea" }
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
      }
    ]
  },

  {
    id: 'concentration',
    title: 'Where is the value sitting?',
    sub: 'This is one of the strongest signals in the whole questionnaire.',
    fields: [{
      key: 'concentration', type: 'single',
      options: [
        { v: 'few', t: 'In a handful of items', d: 'A few pieces are worth far more than everything else combined.' },
        { v: 'spread', t: 'Spread across the collection', d: 'Lots of cards that individually are not worth much.' },
        { v: 'dk', t: "I don't know" }
      ]
    }]
  },

  {
    id: 'work',
    title: 'How much of the work do you want to do?',
    sub: 'Be honest with yourself here. Half-finished listings are the most common way people lose money.',
    fields: [
      {
        key: 'effort', type: 'single',
        label: 'Time and effort you’re willing to put in',
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
      }
    ]
  },

  {
    id: 'invest',
    title: 'One last question',
    sub: 'Grading costs real money up front, and the grade you get back is never guaranteed.',
    when: (s) => hasSingles(s) &&
                 ['nm', 'lp', 'mixed', 'dk'].includes(s.condSingles) &&
                 (s.topCard100 === 'yes' || s.topCard100 === 'dk' ||
                  ['v1k_5k', 'v5k_10k', 'v10k'].includes(s.value)),
    fields: [{
      key: 'investWilling', type: 'single',
      label: 'Would you spend money up front for a shot at a higher return?',
      hint: 'Grading fees, supplies, insured shipping both ways, and months of waiting — with no guarantee of the grade you want.',
      options: [
        { v: 'yes', t: 'Yes, if the math works' },
        { v: 'maybe', t: 'Maybe, show me the numbers' },
        { v: 'no', t: 'No, I’d rather not spend anything' }
      ]
    }]
  }
];

/* ============================================================
   SCORING
   ============================================================ */

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const has = (arr, v) => Array.isArray(arr) && arr.includes(v);

const VALUE_MID = { u100: 60, v100_500: 300, v500_1k: 750, v1k_5k: 3000, v5k_10k: 7500, v10k: 12000 };
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
    if (state.sealedOutOfPrint === 'yes') { d += 24; notes.push('Out-of-print sealed is the part of the market that actually appreciates.'); }
    if (state.sealedOutOfPrint === 'no') d -= 8;
    if (state.sealedOutOfPrint === 'dk') mark('whether sealed is out of print');
    if (state.sealedScarce === 'yes') d += 20;
    if (state.sealedScarce === 'dk') mark('how scarce the sealed product is');
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

function resellerEstimate(state, f) {
  if (f.confidence < CONFIG.confidenceFloor) return null;
  if (state.value === 'dk') return null;
  let mid = VALUE_MID[state.value];
  if (!mid) return null;
  if (state.valueSource === 'collectr') mid *= (1 - CONFIG.collectrHaircut);
  const condKey = hasSingles(state) ? (state.condSingles || 'dk') : (state.condSealed === 'factory' ? 'nm' : state.condSealed === 'minor' ? 'lp' : state.condSealed === 'noticeable' ? 'mp' : state.condSealed === 'damaged' ? 'hp' : state.condSealed || 'dk');
  const band = CONFIG.resellerPayout[condKey] || CONFIG.resellerPayout.dk;
  return { lo: mid * band[0], hi: mid * band[1], plus: state.value === 'v10k' };
}

function primaryCopy(state, f, p) {
  const key = p.ranked[0].key;
  const est = resellerEstimate(state, f);
  const both = state.holdings === 'both';

  /* Sealed-only collections get their own voice — the singles copy talks about
     photographing and grading cards, which is nonsense for a stack of boxes. */
  if (state.holdings === 'sealed' && key !== 'evaluate') return sealedPrimary(state, f, key, est);

  if (key === 'reseller') {
    const paras = [];
    paras.push('Given how quickly you want this done and how much work you want to put in, selling the collection as a lot is the honest answer. You will not get top dollar — nobody selling this way does — but you will get a single number, one transaction, and no listings to manage.');
    if (est) {
      paras.push('Expect somewhere around <strong>' + money(est.lo) + ' – ' + money(est.hi) + (est.plus ? '+' : '') + '</strong>. That reflects roughly half of tracked market value at Near Mint, scaled down for the condition you described. A buyer has to resell everything you hand them, absorb the pieces that do not move, and carry that inventory in the meantime.');
    } else {
      paras.push('As a rule of thumb, a reseller pays around half of tracked market value for Near Mint material, and meaningfully less as condition drops. We are not putting a number on yours because too much of what you told us was a guess — that is worth fixing before you sell.');
    }
    if (f.C < 55) paras.push('Condition is doing most of the damage here. Played cards are not a small discount off Near Mint — they are frequently worth a fraction of it, and that gap is why the offer will feel low.');
    paras.push('One thing worth doing first: pull out anything you suspect is genuinely valuable and price those separately. Bulk pricing on a collection that quietly contains a $400 card is how people lose the most money on this path.');
    paras.push('For what it is worth, the gap between this and selling it yourself is smaller than it looks. Online marketplaces take ' + CONFIG.fees.rangeLow + '–' + CONFIG.fees.rangeHigh + '% of every sale before shipping, and the cards that never sell still cost you the time you spent listing them.');
    return { title: 'Sell it as a lot to a reseller', paras };
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
    return { title: 'Sell the good pieces individually', paras };
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
    return { title: 'Grade selectively — your best cards only', paras };
  }

  const paras = [];
  paras.push("Nothing you have told us points cleanly at a sale yet, and that is a perfectly reasonable place to be. The most expensive decisions in this hobby get made by people who sold before they understood what they had.");
  if (p.forced === 'evaluate' && (state.condSingles === 'dk' || state.condSealed === 'dk')) {
    paras.push('The specific problem is condition. You may be sitting on something worth real money, and condition is the single largest factor in what it is worth — <strong>a Near Mint card and a Moderately Played copy of the same card are not close in price.</strong> Any number anyone quotes you before that is settled, including ours, is a guess.');
  }
  paras.push('In the meantime, protect what you have. Penny sleeves inside toploaders or a proper binder, stored upright, somewhere dry and out of direct sunlight, at a stable temperature. Cards degrade quietly — sun fading, humidity warping and corner dings all happen slowly enough that you do not notice until the value is gone.');
  paras.push('Cataloguing is genuinely worth doing, and most people find it more enjoyable than they expect. Working through the collection card by card is also how you discover the pieces you did not know mattered. There is a section below on the apps we use to price things, and how much to trust each one.');
  return { title: 'Get it evaluated before you decide anything', paras };
}

function sealedPrimary(state, f, key, est) {
  const desirable = state.sealedOutOfPrint === 'yes' || state.sealedScarce === 'yes';
  const goodCond = (f.cSealed ?? 50) >= 70;
  const sealedIntact = state.sealedFactory === 'yes';

  if (key === 'reseller') {
    const paras = [];
    paras.push('You want this handled quickly and with minimal fuss, and sealed product is straightforward to move as a lot. One transaction, one number, done.');
    if (est) {
      paras.push('Expect roughly <strong>' + money(est.lo) + ' – ' + money(est.hi) + (est.plus ? '+' : '') + '</strong>. Sealed usually earns a better share of market value than loose cards do, because a buyer can resell it without sorting, grading or describing anything — but it is still a wholesale number, not a retail one.');
    }
    if (!sealedIntact) {
      paras.push('Be upfront about anything that has been opened or resealed. Buyers check, and a collection that gets returned costs you far more than the honest price would have.');
    }
    paras.push('Packaging condition is worth two minutes of your time before you get an offer. Crushed corners, dented lids, scuffed shrink and sun fading all move the number, and a buyer will spot every one of them.');
    return { title: 'Sell the sealed product as a lot', paras };
  }

  if (key === 'grade') {
    return { title: 'Get the sealed product valued properly',
      paras: ['Grading applies to individual cards, not sealed boxes. What your product needs is an accurate current valuation — and if you are considering opening any of it, that valuation should come first.'] };
  }

  const paras = [];
  if (desirable && goodCond && f.T >= 70) {
    paras.push('This is the good version of a sealed collection. Out-of-print product in clean condition is the closest thing this hobby has to a real asset: the supply is fixed, it cannot be reprinted, and it shrinks every time someone opens a box. You also told us you are in no hurry, which is the one thing that makes holding a strategy rather than just procrastinating.');
    paras.push('<strong>Our recommendation is to hold what is genuinely scarce and sell the rest selectively.</strong> Where you do sell, sell to collectors — individual listings or direct to buyers who know exactly what the product is. Do not put desirable out-of-print sealed into a bulk offer; you will be paid a bulk number for something that is not bulk.');
    paras.push('Storage matters more than people expect for sealed. Keep boxes upright and unstacked, away from sunlight and humidity, at a stable temperature. Shrink wrap yellows, cardboard warps, and a box that quietly degrades in a garage loses the exact premium you were holding it for.');
    return { title: 'Hold the scarce pieces, sell the rest to collectors', paras };
  }

  if (desirable && !goodCond) {
    paras.push('The product itself is desirable, but the packaging condition is working against you — and unlike a market, condition never recovers. Time is not on your side here the way it would be with a clean copy.');
    paras.push('Sell it individually, photograph the wear honestly, and price it against comparable copies in similar shape rather than against pristine ones. Collectors will still want it; they just want to know what they are getting.');
    return { title: 'Sell it individually, sooner rather than later', paras };
  }

  paras.push('Your sealed product is current, in-print material, and that changes the calculus completely. In-print product does not appreciate — there is no scarcity story while it is still being manufactured, and every week that passes there is more of it in the world, not less.');
  paras.push('Sell it at or near retail, individually or in small lots. The buyers are there and the pricing is well understood, so this is one of the easier things in the hobby to move. What you should not do is sit on it waiting for an increase that only happens after a set goes out of print — and even then, only for some sets.');
  return { title: 'Sell it near retail — holding will not help', paras };
}

function sealedStrategy(state, f) {
  if (state.sealedFactory === 'no') {
    return { title: 'Sell it as opened product',
      body: 'Once a box has been opened or resealed, the sealed premium is gone and it is not coming back. Price it on the cards inside, not on what a sealed copy sells for.' };
  }
  const desirable = state.sealedOutOfPrint === 'yes' || state.sealedScarce === 'yes';
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

/* ============================================================
   RESULTS PAGE
   ============================================================ */

function renderResults(state) {
  const f = computeFactors(state);
  const p = scorePaths(state, f);
  const primary = primaryCopy(state, f, p);
  const both = state.holdings === 'both';
  let html = '';

  /* ---- Primary ---- */
  html += `<p class="result-eyebrow">Our recommendation</p>
    <div class="rec-primary">
      <h1>${primary.title}</h1>
      ${primary.paras.map((t) => `<p class="rec-body">${t}</p>`).join('')}
    </div>`;

  /* ---- Mixed collection split ---- */
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
      <h2>Your sealed product</h2>
      <div class="card-stack"><div class="rec-card"><h3>${sl.title}</h3><p>${sl.body}</p></div></div>
    </section>`;
  }

  /* ---- Opening warning ---- */
  if (hasSealed(state) && (state.sealedOpening === 'yes' || state.sealedOpening === 'unsure')) {
    html += `<section class="rec-section">
      <div class="rec-card rec-card-warn">
        <h3>Before you open it</h3>
        <p>Opening sealed product changes the equation completely. You are trading a known, finite, collectible object for a random assortment of cards — and on average, the cards inside a box are worth less than the sealed box itself. That is how the economics have to work; it is why sealed product exists as a category.</p>
        <p>The trade is irreversible. If your goal is value, find out what the sealed item is worth <strong>before</strong> you open it. If your goal is the fun of opening it, that is a completely legitimate reason — just make it a decision rather than an accident.</p>
        <p><a class="btn btn-outline btn-sm" href="index.html#contact">I'd like help evaluating it first</a></p>
      </div>
    </section>`;
  }

  /* ---- Grading ---- */
  if (hasSingles(state)) {
    if (p.gate.passed) {
      html += `<section class="rec-section">
        <h2>Run the grading numbers</h2>
        <p class="rec-section-sub">Grading is not automatically right for an expensive card. The spread has to be wide enough to cover the fees, the wait and the risk. Put in what one of your best cards is worth raw:</p>
        ${gradingCalcHTML(state)}
      </section>`;
    } else if (p.gate.blockers.length && p.gate.blockers[0].key !== 'singles') {
      html += `<section class="rec-section">
        <h2>Why we're not recommending grading</h2>
        <p class="rec-section-sub">Grading needs several things to line up at once. Here's what isn't lining up for you:</p>
        <div class="card-stack">
          ${p.gate.blockers.map((b) => `<div class="rec-card"><h3>${gateLabel(b.key)}</h3><p>${b.msg}</p></div>`).join('')}
        </div>
      </section>`;
    }
  }

  /* ---- Alternatives ---- */
  const alts = p.ranked.slice(1).filter((r) => !(r.key === 'grade' && !p.gate.passed));
  if (alts.length) {
    html += `<section class="rec-section">
      <h2>Your other options</h2>
      <p class="rec-section-sub">Ranked by how well they fit what you told us. None of these are wrong — they just trade different things away.</p>
      <div class="card-stack">
        ${alts.map((r, i) => `<div class="rec-card">
          <h3>${PATH_META[r.key].label} <span class="tag ${i === 0 ? 'tag-mid' : ''}">${r.score}/100 fit</span></h3>
          <p>${PATH_META[r.key].short}</p>
        </div>`).join('')}
      </div>
    </section>`;
  }

  /* ---- What selling actually costs ---- */
  const topKey = p.ranked[0].key;
  if (topKey === 'individual' || topKey === 'reseller' || p.ranked[1]?.key === 'individual') {
    const fe = CONFIG.fees;
    const net100 = 100 - (100 * fe.ebayPct / 100) - fe.ebayPerOrder - fe.shipPerOrder;
    html += `<section class="rec-section">
      <h2>What selling online actually costs</h2>
      <p class="rec-section-sub">Every "it's worth $X" number you see is a gross figure. This is the part that surprises people, so it is worth seeing before you start listing.</p>
      <div class="card-stack">
        <div class="rec-card">
          <h3>Expect to lose ${fe.rangeLow}–${fe.rangeHigh}% to fees</h3>
          <p><strong>eBay</strong> takes a ${fe.ebayPct}% final value fee plus ${money2(fe.ebayPerOrder)} per order — and it is charged on the
             <em>total</em>, meaning the item price, the shipping you charged, and the sales tax the buyer paid. There is one useful exception:
             singles that sell for ${money(fe.ebayHighValueThreshold)} or more get 50% off that fee, which meaningfully changes the math on your best cards.</p>
          <p><strong>TCGplayer</strong> lands in the same place by a different route — 10.75% commission plus 2.5% and ${money2(0.30)} for payment processing, so about ${fe.tcgplayerPct}% all-in.</p>
          <p>On a ${money(100)} sale, after fees and a plain shipped envelope, you keep roughly <strong>${money(net100)}</strong>. Then subtract your time.</p>
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
      </div>
    </section>`;
  }

  /* ---- How to price it yourself ---- */
  html += `<section class="rec-section">
    <h2>How to value it yourself</h2>
    <p class="rec-section-sub">You do not need us to get a rough number. These are the tools we actually use, and what each one is good and bad at.</p>
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
    </div>

    <div class="rec-card" style="margin-top:16px">
      <h3>A ten-minute version</h3>
      <p>If you do nothing else: pull the <strong>ten cards you think are the best</strong>, look each one up on eBay sold listings, and add them up. That number tells you most of what you need to know, because value concentrates far more than people expect. Then assume the rest of the collection is worth less than you are hoping — that assumption is right more often than it is wrong.</p>
      <p>If your ten best come to more than a few hundred dollars, it is worth slowing down and doing this properly before you sell anything.</p>
    </div>
  </section>`;

  /* ---- Factor readout ---- */
  const factorRows = [
    ['Value at stake', f.V, 'How much is actually on the line.'],
    ['Condition', f.C, 'The single biggest multiplier on everything else.'],
    ['Collector demand', f.D, 'Whether people are competing for what you have.'],
    ['Your patience', f.T, 'How long you can leave money on the table.'],
    ['Your effort', f.E, 'How much of the selling work you will do yourself.']
  ];
  html += `<section class="rec-section">
    <h2>What drove this</h2>
    <p class="rec-section-sub">Five variables decide every recommendation in this tool. Yours read like this:</p>
    <div class="factors">
      ${factorRows.map(([name, val, note]) => `
        <div class="factor-row">
          <span class="factor-name">${name}</span>
          <span class="factor-track"><span class="factor-fill" style="width:${Math.round(val)}%"></span></span>
          <p class="factor-note">${note}</p>
        </div>`).join('')}
    </div>`;

  if (f.confidence < CONFIG.confidenceFloor) {
    html += `<div class="rec-card rec-card-warn" style="margin-top:24px">
      <h3>We're working with gaps</h3>
      <p>You answered "I don't know" on ${listify(f.unknowns)}. That is completely fine — but it means we have scaled our confidence down, and it is why we have not put firm numbers on anything. Closing those gaps is the highest-value thing you can do before making a decision.</p>
    </div>`;
  }
  html += `</section>`;

  /* ---- Reinforcement ---- */
  html += `<section class="rec-section">
    <h2>Three things worth remembering</h2>
    <div class="card-stack">
      <div class="rec-card"><h3>Condition is the whole game</h3>
        <p>It is not a modifier on value — for a lot of cards it <em>is</em> the value. The same card can swing several times over between Near Mint and Moderately Played. Almost everyone grades their own cards too generously, so if you are on the fence between two tiers, the lower one is usually right.</p></div>
      <div class="rec-card"><h3>Rarity and age decide who is bidding</h3>
        <p>SIRs, SARs, alt arts, First Edition, serialized cards, promos and vintage holos are what collectors actively hunt. They are also the cards where grading is worth considering. Everything else competes with an enormous supply of identical copies.</p></div>
      <div class="rec-card"><h3>Store it properly regardless</h3>
        <p>Whatever you decide, do not let the collection degrade while you think about it. Sleeves and toploaders or a real binder, upright, dry, stable temperature, out of the sun. This costs almost nothing and protects everything.</p></div>
    </div>
  </section>`;

  /* ---- CTA ---- */
  html += `<div class="rec-cta">
    <h2>Want us to take a closer look?</h2>
    <p>Everything above comes from a handful of answers. Actually going through the cards usually turns up things a questionnaire cannot — a card you did not know mattered, condition that is better or worse than you assumed, or one sealed item worth more than the rest combined. If you would like us to look properly, tell us what you have and we will take it from there.</p>
    <p class="rec-cta-detail">Useful things to mention: roughly how many cards, which sets or eras they are from, whether anything is graded, and a few photos if you have them. Assessments are arranged individually, so we will reply and sort out the details with you.</p>
    <a class="btn btn-primary" href="index.html#contact">Tell us about your collection</a>
  </div>

  <div class="result-actions">
    <button type="button" class="btn btn-outline" id="restart-btn">Start over</button>
    <a class="btn btn-ghost" href="index.html">Back to the site</a>
  </div>`;

  /* ---- Testing panel ---- */
  if (showTestingPanel()) {
  html += `<details class="debug"><summary>Testing view — how this was scored</summary>
    <div class="debug-body">
      <h4>Answers</h4><pre>${JSON.stringify(state, null, 2)}</pre>
      <h4>Factors</h4><pre>${JSON.stringify({
        value: Math.round(f.V), condition: Math.round(f.C), desirability: Math.round(f.D),
        patience: f.T, effort: f.E, confidence: f.confidence,
        condSingles: f.cSingles, condSealed: f.cSealed,
        desSingles: f.dSingles, desSealed: f.dSealed,
        unknowns: f.unknowns
      }, null, 2)}</pre>
      <h4>Path scores</h4><pre>${p.ranked.map((r) => r.key.padEnd(12) + r.score).join('\n')}</pre>
      <h4>Grading gate: ${p.gate.passed ? 'PASSED' : 'FAILED'}</h4>
      <pre>${Object.entries(p.gate.checks).map(([k, c]) => (c.ok ? '  ok  ' : ' FAIL ') + k).join('\n')}</pre>
      <h4>Rules that fired</h4>
      <ol>${p.rules.map((r) => `<li>${r}</li>`).join('') || '<li>None</li>'}</ol>
      ${f.notes.length ? `<h4>Engine notes</h4><ol>${f.notes.map((n) => `<li>${n}</li>`).join('')}</ol>` : ''}
    </div>
  </details>`;
  }

  const host = document.getElementById('guide-results');
  host.innerHTML = html;
  host.hidden = false;
  document.getElementById('guide-app').hidden = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const rawInput = document.getElementById('raw-value');
  if (rawInput) {
    renderCalcTable(state);
    rawInput.addEventListener('input', () => renderCalcTable(state));
  }
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

function renderScreen() {
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
  el('progress-bar').style.width = ((pos - 1) / vis.length * 100) + '%';
  el('progress-label').textContent = `Question ${pos} of about ${vis.length}`;

  el('next-btn').textContent = pos >= vis.length ? 'See my recommendation' : 'Continue';
  el('screen-host').querySelector('.opt input')?.focus({ preventScroll: true });
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
