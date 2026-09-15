/* ============================================================
   Product tile update — run by hand, no credentials needed.

   Reads the link-shared "Product Images" Drive folder, downloads
   each photo, and writes assets/products/<SKU>.webp at the same
   800x800 tile format the existing images use.

     node scripts/update-products.mjs
     node scripts/update-products.mjs --dry      (list matches, write nothing)
     node scripts/update-products.mjs --keep     (also keep a full-size copy)

   Same approach as update-gallery.mjs, and the same caveat: the
   public folder view is undocumented, so this is a run-by-hand
   script rather than anything unattended.

   Naming: a file is matched to a SKU by its title. Either name the
   file after the product ("Surging Sparks Booster Pack.HEIC") or
   after the stock number ("63.jpg") -- both work. Anything that
   does not match a known product is reported and skipped, never
   guessed at.
   ============================================================ */

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import { liftBackdrop } from './lib-backdrop.mjs';

const FOLDER_ID = process.env.PRODUCT_FOLDER_ID || '1m5iuVWBUEKLpwF6iNZTzDnYJBMjk0aSx';
const OUT_DIR = 'assets/products';
const FULL_DIR = 'assets/products/_full';

const SIZE = 800;          // tile is square
const PAD = 48;            // breathing room inside the tile
const TILE_BG = { r: 0x16, g: 0x12, b: 0x19, alpha: 1 };

const DRY = process.argv.includes('--dry');
const KEEP_FULL = process.argv.includes('--keep');

/* Title -> SKU. Keys are normalised (lowercase, alphanumerics only,
   single spaces), so punctuation and capitalisation in the filename
   do not matter. Several spellings per product on purpose. */
const ALIASES = {
  // English
  'surging sparks booster pack': '63',
  'white flare booster pack': '78',
  'black bolt booster pack': '79',
  'chaos rising booster pack': '121',
  'destined rivals booster pack': '122',
  'journey together booster pack': '123',
  'twilight masquerade booster pack': '124',
  'pitch black booster pack': '125',
  'perfect order booster pack': '131',
  'pitch black blister pack': '126',
  'pitch black slowpoke blister pack': '126',
  'first partner illustration collection series 2': '140',
  'first partner illustration collection series 3': '146',
  // as typed on the uploaded files, missing the second "t"
  'first partner illustraion collection series 2': '140',
  'first partner illustraion collection series 3': '146',

  // Simplified Chinese
  'chasing glory slim booster pack': '155',
  'chasing glory together slim booster pack': '155',
  'stellar crystal slim booster pack': '160',
  'brilliant fantasy slim booster pack': '162',
  'brilliant fantasy jumbo booster pack': '159',
  'sharp blade awakening slim booster pack': '166',
  'sharp blade awakening jumbo booster pack': '157',
  'black crystal blazing slim booster pack': '167',
  'mystic void slim booster pack': '169',
  'vivid portrayals slim booster pack': '133',
  'venusaur jumbo booster pack': '154A',
  'primordial arts venusaur jumbo booster pack': '154A',
  'blastoise jumbo booster pack': '154B',
  'primordial arts blastoise jumbo booster pack': '154B',
  'gem box volume 4 booster pack': '132',
  'gem box volume 5 booster pack': '164',
  'gem box volume 6 booster pack': '152',
  // uploaded as "Gem Pack Volume 6"; the line is Gem Box, so this is 152
  'gem pack volume 6 booster pack': '152',
  'chasing glory slim booster box': '59',
  'chasing glory together slim booster box': '59',
  'stellar crystal slim booster box': '149',
  'brilliant fantasy slim booster box': '161',
  'brilliant fantasy jumbo booster box': '158',
  'sharp blade awakening slim booster box': '165',
  'sharp blade awakening jumbo booster box': '156',
  'black crystal blazing slim booster box': '39',
  'mystic void slim booster box': '168',
  'venusaur jumbo booster box': '153A',
  'primordial arts venusaur jumbo booster box': '153A',
  'blastoise jumbo booster box': '153B',
  'primordial arts blastoise jumbo booster box': '153B',
  'pikachu v union gift box': '170',
  '30th anniversary special art card set vol 1': '171',
  '30th anniversary special art card set vol 2': '172',
  '30th anniversary special art card set vol 3': '173',

  // The sealed Gem Box is itself called a box, so both spellings point
  // at the box and only the single pack takes the "Pack" suffix.
  'gem box volume 4': '135',
  'gem box volume 4 booster box': '135',
  'gem box volume 5': '163',
  'gem box volume 5 booster box': '163',
  'gem box volume 6': '150',
  'gem box volume 6 booster box': '150',
};

/* Every stock number the site knows about, so a file named "154A.jpg"
   is accepted without needing an alias. */
const KNOWN_SKUS = new Set([
  '39', '59', '63', '78', '79', '121', '122', '123', '124', '125', '126',
  '131', '132', '133', '135', '140', '146', '149', '150', '152', '153A',
  '153B', '154A', '154B', '155', '156', '157', '158', '159', '160', '161',
  '162', '163', '164', '165', '166', '167', '168', '169', '170', '171',
  '172', '173',
]);

const norm = (s) =>
  s.replace(/\.[a-z0-9]+$/i, '')          // drop extension
   .replace(/^\s*(chinese|english)\s+/i, '')   // language lives in the row, not the filename
   .replace(/[^a-z0-9]+/gi, ' ')          // punctuation -> space
   .trim()
   .replace(/\s+/g, ' ')
   .toLowerCase();

function skuFor(title) {
  const n = norm(title);
  if (ALIASES[n]) return ALIASES[n];
  const upper = n.toUpperCase().replace(/\s+/g, '');
  if (KNOWN_SKUS.has(upper)) return upper;
  return null;
}

const folderView = (id) => `https://drive.google.com/embeddedfolderview?id=${id}#list`;

async function listFolder(id) {
  const res = await fetch(folderView(id));
  if (!res.ok) throw new Error(`Folder ${id} returned HTTP ${res.status}`);
  const html = await res.text();
  if (/sign in|request access|need permission/i.test(html)) {
    throw new Error(
      `Folder ${id} is not publicly readable — set it to "Anyone with the link".`
    );
  }
  const ids = [...new Set(html.match(/\/file\/d\/[A-Za-z0-9_-]{20,}/g) || [])]
    .map((m) => m.split('/').pop());
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };
  const titles = [...html.matchAll(/flip-entry-title["']?\s*>\s*([^<]+)/g)]
    .map((m) => m[1].trim().replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => entities[e]));
  if (ids.length !== titles.length) {
    throw new Error(
      `Folder listing mismatch: ${ids.length} files but ${titles.length} titles. ` +
      `The public folder view may have changed shape.`
    );
  }
  return ids.map((fileId, i) => ({ fileId, title: titles[i] }));
}

async function download(fileId) {
  const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${fileId}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.subarray(0, 200).toString('utf8').includes('<!DOCTYPE html')) {
    throw new Error(`Got an HTML page instead of an image for ${fileId}`);
  }
  return buf;
}

function isHeic(buf) {
  // ISO-BMFF brand sits at bytes 8..12
  const brand = buf.subarray(8, 12).toString('latin1');
  return ['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'].includes(brand);
}

async function toRaster(buf) {
  if (!isHeic(buf)) return buf;
  const out = await heicConvert({ buffer: buf, format: 'JPEG', quality: 0.96 });
  return Buffer.from(out);
}

/* Below this, the cut-out is not trustworthy: the matte has eaten into
   the artwork rather than just removing the sheet behind it. Measured
   with the hull repair in place a healthy cut-out scores 0.86 and up. The
   one photo that cannot be cut out (a pale pack nearly filling its frame,
   so its white artwork reads as sheet) scores 0.66 even after repair, and
   looks worse cut out than left alone -- hence the gap between them. */
const MIN_SOLIDITY = 0.80;

/* Occasional per-photo corrections. Keep this list short, and say why each
   one is here -- a tweak without a reason is impossible to revisit later. */
const TWEAKS = {
  /* Both First Partner boxes are sold on a hang tab. The tab's hanger slot is
     a real hole, so it punches through to the dark tile and the tab's corners
     get clipped, which reads as damage rather than packaging. Cropping the tab
     off gives a clean top edge and loses nothing a buyer needs to see. */
  '140': { cropTop: 0.09, cropBottom: 0.07 },  // bottom: sheet in a warm shadow, too saturated to read as backdrop
  '146': { cropTop: 0.11 },   // a touch more: 9% left a sliver of the tab
};

/* Two passes on purpose. sharp honours only ONE resize per pipeline, so
   chaining resize -> extend -> resize silently drops the first one and
   pads the full-size image instead, landing on 896px rather than 800.
   Rendering the inner image to a buffer first keeps the two steps
   independent: fit the product inside 704, then centre that on the
   800x800 tile, which leaves exactly PAD of breathing room. */
async function place(pipeline) {
  const inner = await pipeline
    .resize(SIZE - PAD * 2, SIZE - PAD * 2, { fit: 'inside' })
    .toBuffer();
  return sharp(inner)
    .resize(SIZE, SIZE, { fit: 'contain', background: TILE_BG })
    .flatten({ background: TILE_BG })
    .webp({ quality: 86 })
    .toBuffer();
}

/* A file that already carries transparency has been cut out by hand, and that
   beats anything this script can infer. Use it as it is. */
async function alreadyCutOut(raster) {
  const meta = await sharp(raster).metadata();
  if (!meta.hasAlpha) return false;
  const stats = await sharp(raster).stats();
  const alpha = stats.channels[stats.channels.length - 1];
  return alpha.min < 250;          // genuinely transparent somewhere
}

async function makeTile(buf, sku) {
  const raster = await toRaster(buf);

  if (await alreadyCutOut(raster)) {
    const tile = await place(sharp(raster).trim({ threshold: 2 }));
    return { tile, raster, how: 'used as supplied (already cut out)' };
  }

  const matte = await liftBackdrop(raster);

  if (matte.solidity >= MIN_SOLIDITY) {
    let shape = await sharp(matte.cut).trim({ threshold: 2 }).toBuffer();
    const tweak = TWEAKS[sku] || {};
    const cropTop = tweak.cropTop || 0;
    const cropBottom = tweak.cropBottom || 0;
    if (cropTop || cropBottom) {
      const m = await sharp(shape).metadata();
      const top = Math.round(m.height * cropTop);
      shape = await sharp(shape).extract({
        left: 0, top,
        width: m.width,
        height: Math.round(m.height * (1 - cropTop - cropBottom)),
      }).toBuffer();
    }
    const parts = [];
    if (cropTop) parts.push(`top ${Math.round(cropTop * 100)}%`);
    if (cropBottom) parts.push(`bottom ${Math.round(cropBottom * 100)}%`);
    const note = parts.length ? `, ${parts.join(' and ')} cropped` : '';
    return {
      tile: await place(sharp(shape)), raster,
      how: `cut out (solidity ${matte.solidity.toFixed(2)}${note})`,
    };
  }

  /* Fall back to trimming the uniform border and leaving the photo as
     shot. Less tidy against the dark tile, but it never mangles the
     product -- and a photo that fills its frame has little sheet to
     remove anyway. */
  const tile = await place(sharp(raster).rotate().trim({ threshold: 14 }));
  return {
    tile, raster,
    how: `trimmed only (solidity ${matte.solidity.toFixed(2)}, too low to cut out)`,
  };
}

async function main() {
  console.log(`Reading Drive folder ${FOLDER_ID}\n`);
  const entries = await listFolder(FOLDER_ID);
  console.log(`${entries.length} file(s) in the folder\n`);

  const matched = [];
  const unmatched = [];
  for (const e of entries) {
    const sku = skuFor(e.title);
    (sku ? matched : unmatched).push({ ...e, sku });
  }

  for (const m of matched) console.log(`  ${String(m.sku).padEnd(5)} <- ${m.title}`);
  if (unmatched.length) {
    console.log('\nNot matched to a product (skipped):');
    for (const u of unmatched) console.log(`  ?     <- ${u.title}`);
    console.log('  Add an alias in scripts/update-products.mjs, or rename the file.');
  }

  const dupes = matched
    .map((m) => m.sku)
    .filter((s, i, a) => a.indexOf(s) !== i);
  if (dupes.length) {
    throw new Error(`Two files map to the same stock number: ${[...new Set(dupes)].join(', ')}`);
  }

  if (DRY) {
    console.log('\n--dry: nothing written.');
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });
  if (KEEP_FULL) await mkdir(FULL_DIR, { recursive: true });

  console.log('');
  for (const m of matched) {
    const raw = await download(m.fileId);
    const { tile, raster, how } = await makeTile(raw, m.sku);
    const dest = path.join(OUT_DIR, `${m.sku}.webp`);
    await writeFile(dest, tile);
    if (KEEP_FULL) {
      await writeFile(path.join(FULL_DIR, `${m.sku}.jpg`), raster);
    }
    console.log(`  ${m.sku.padEnd(5)} ${(tile.length / 1024).toFixed(0).padStart(3)}KB  ${how}`);
  }

  console.log(`\nDone. ${matched.length} tile(s) written to ${OUT_DIR}.`);
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
