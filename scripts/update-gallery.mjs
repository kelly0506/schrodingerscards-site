/* ============================================================
   Gallery update — run by hand, no credentials needed.

   Reads the link-shared Google Drive folder's public listing,
   downloads anything new, converts to WebP at two sizes, and
   rewrites assets/gallery/photos.json.

     node scripts/update-gallery.mjs

   Why no API key: the Drive API needs a Google Cloud project even
   for a public folder. The public folder view does not. That view
   is undocumented and could change without warning, which would be
   unacceptable for an unattended cron job -- it would fail silently
   and leave the page stale. Run by hand it is fine: if it breaks,
   whoever ran it sees the error and can fall back to dropping the
   image files into assets/gallery/<lane>/ directly.

   (An API-key version of this lived at scripts/sync-gallery.mjs and
   is in git history if automation is ever wanted again.)

   Behaviour worth knowing:
   - The Drive file id is a photo's identity, so re-running is
     idempotent and already-processed photos are not re-downloaded.
   - "published" is set the first time a photo is seen. Expiry for
     the Now lane is applied by the page, not here.
   - A photo removed from the Drive folder is removed from the site.
   ============================================================ */

import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import heicConvert from 'heic-convert';

const ROOT = process.env.GDRIVE_FOLDER_ID || '1wAA6g6j5ZNbCpeRgjDvln9dZ71UJPy2o';
const OUT_DIR = 'assets/gallery';
const MANIFEST = path.join(OUT_DIR, 'photos.json');
const LANES = { Evergreen: 'evergreen', Now: 'now' };

const FULL_WIDTH = 1600;
const THUMB_WIDTH = 640;
const EXPIRY_DAYS = 7;

const folderView = (id) => `https://drive.google.com/embeddedfolderview?id=${id}#list`;

async function listFolder(id) {
  const res = await fetch(folderView(id));
  if (!res.ok) throw new Error(`Folder ${id} returned HTTP ${res.status}`);
  const html = await res.text();
  if (/sign in|request access|need permission/i.test(html)) {
    throw new Error(`Folder ${id} is not publicly readable — set it to "Anyone with the link".`);
  }
  const files = [...new Set(html.match(/\/file\/d\/[A-Za-z0-9_-]{20,}/g) || [])]
    .map((m) => m.split('/').pop());
  const subfolders = [...new Set(html.match(/folders\/[A-Za-z0-9_-]{20,}/g) || [])]
    .map((m) => m.split('/').pop())
    .filter((f) => f !== id);
  const titles = [...html.matchAll(/flip-entry-title["']?\s*>\s*([^<]+)/g)].map((m) => m[1].trim());
  return { files, subfolders, titles, html };
}

/* The folder view does not label subfolders inline, so fetch each one
   and read its own <title> to find out which lane it is. */
async function resolveLanes() {
  const root = await listFolder(ROOT);
  const out = {};
  for (const sub of root.subfolders) {
    const res = await fetch(folderView(sub));
    const html = await res.text();
    const name = (html.match(/<title>([^<]*)<\/title>/) || [, ''])[1].trim();
    for (const [label, lane] of Object.entries(LANES)) {
      if (name.toLowerCase() === label.toLowerCase()) out[lane] = sub;
    }
  }
  for (const label of Object.keys(LANES)) {
    if (!out[LANES[label]]) console.warn(`! No "${label}" subfolder found — skipping that lane.`);
  }
  return out;
}

async function download(id) {
  const res = await fetch(`https://drive.google.com/uc?export=download&id=${id}`, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  /* A virus-scan interstitial comes back as a small HTML page, not an image. */
  if (buf.length < 5000) throw new Error(`only ${buf.length} bytes — likely an interstitial, not the image`);
  return buf;
}

async function toProcessable(buf) {
  /* iPhones shoot HEIC; sharp's prebuilt libvips cannot decode it. */
  const isHeic = buf.slice(4, 12).toString('latin1').includes('ftyp') &&
                 /hei[cf]|mif1|msf1/i.test(buf.slice(8, 24).toString('latin1'));
  if (isHeic) {
    console.log('     converting HEIC -> JPEG');
    return Buffer.from(await heicConvert({ buffer: buf, format: 'JPEG', quality: 0.92 }));
  }
  return buf;
}

async function processImage(buf, lane, id) {
  const source = await toProcessable(buf);
  const laneDir = path.join(OUT_DIR, lane);
  await mkdir(laneDir, { recursive: true });
  const base = sharp(source, { failOn: 'none' }).rotate();   // honour EXIF orientation

  const full = await base.clone()
    .resize({ width: FULL_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  await writeFile(path.join(laneDir, `${id}.webp`), full.data);

  await writeFile(path.join(laneDir, `${id}-thumb.webp`), await base.clone()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: 74 }).toBuffer());

  return {
    full: `${OUT_DIR}/${lane}/${id}.webp`,
    thumb: `${OUT_DIR}/${lane}/${id}-thumb.webp`,
    w: full.info.width,
    h: full.info.height,
    bytes: full.data.length
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const prev = existsSync(MANIFEST)
    ? JSON.parse(await readFile(MANIFEST, 'utf8'))
    : { photos: [] };
  const byId = new Map((prev.photos || []).map((p) => [p.id, p]));

  const lanes = await resolveLanes();
  if (!Object.keys(lanes).length) throw new Error('No Evergreen or Now subfolder found.');

  const seen = new Set();
  const photos = [];
  let added = 0;

  for (const [lane, folderId] of Object.entries(lanes)) {
    const { files } = await listFolder(folderId);
    console.log(`${lane}: ${files.length} image(s) in Drive`);

    for (const id of files) {
      seen.add(id);
      const existing = byId.get(id);
      if (existing && existsSync(existing.full) && existsSync(existing.thumb)) {
        photos.push({ ...existing, lane });     // let the lane follow a moved photo
        continue;
      }
      process.stdout.write(`  + ${id} `);
      try {
        const img = await processImage(await download(id), lane, id);
        photos.push({
          id, lane,
          published: existing?.published || new Date().toISOString(),
          full: img.full, thumb: img.thumb, w: img.w, h: img.h,
          caption: existing?.caption || ''
        });
        added++;
        console.log(`-> ${img.w}x${img.h}, ${(img.bytes / 1024).toFixed(0)}KB`);
      } catch (err) {
        console.log(`FAILED: ${err.message}`);
      }
    }
  }

  let removed = 0;
  for (const [id, p] of byId) {
    if (seen.has(id)) continue;
    for (const f of [p.full, p.thumb]) if (f && existsSync(f)) await unlink(f);
    removed++;
    console.log(`  - removed ${id} (no longer in Drive)`);
  }

  const referenced = new Set(photos.flatMap((p) => [p.full, p.thumb]));
  for (const lane of Object.values(LANES)) {
    const dir = path.join(OUT_DIR, lane);
    if (!existsSync(dir)) continue;
    for (const name of await readdir(dir)) {
      const rel = `${dir}/${name}`;
      if (!referenced.has(rel)) { await unlink(rel); console.log(`  - swept orphan ${name}`); }
    }
  }

  photos.sort((a, b) => new Date(b.published) - new Date(a.published));
  await writeFile(MANIFEST, JSON.stringify({
    generated: new Date().toISOString(),
    expiryDays: EXPIRY_DAYS,
    photos
  }, null, 2) + '\n');

  const now = photos.filter((p) => p.lane === 'now').length;
  console.log(`\n${photos.length} photo(s) in manifest (${photos.length - now} evergreen, ${now} now) — ${added} added, ${removed} removed.`);
  if (now) console.log(`Now photos hide themselves after ${EXPIRY_DAYS} days.`);
}

main().catch((err) => { console.error('\n' + err.message); process.exit(1); });
