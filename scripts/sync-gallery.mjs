/* ============================================================
   Gallery sync — Google Drive -> site

   Reads two subfolders ("Evergreen" and "Now") from a public
   Google Drive folder, converts anything new to WebP, writes the
   images into assets/gallery/, and regenerates photos.json.

   Design notes:
   - Read-only. Uses an API key against a link-shared folder, so
     this cannot alter or delete anything in Drive.
   - The Drive file id is the identity of a photo. Re-running is
     idempotent: already-processed ids are skipped.
   - "published" is Drive's createdTime, i.e. when the photo was
     put in the folder, not when the camera took it. Dropping a
     photo into Now is the publish action, so that is the clock
     the expiry should run on.
   - Deleting a photo from the Drive folder removes it from the
     site on the next run. That is the manual un-publish path.
   - Expiry is NOT applied here. The manifest carries the date and
     the page decides what to show, so if this job ever stops
     running the Now photos still age out on their own.
   ============================================================ */

import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import heicConvert from 'heic-convert';

const API = 'https://www.googleapis.com/drive/v3';
const KEY = process.env.GDRIVE_API_KEY;
/* The gallery folder is link-shared, so its id is not a secret. Hard-coding
   it means the only thing that has to be configured is the API key. */
const ROOT = process.env.GDRIVE_FOLDER_ID || '1wAA6g6j5ZNbCpeRgjDvln9dZ71UJPy2o';

const OUT_DIR = 'assets/gallery';
const MANIFEST = path.join(OUT_DIR, 'photos.json');

const LANES = { Evergreen: 'evergreen', Now: 'now' };

const FULL_WIDTH = 1600;
const THUMB_WIDTH = 640;
const EXPIRY_DAYS = 7;

if (!KEY) {
  console.error('Missing GDRIVE_API_KEY.');
  process.exit(1);
}

const q = (obj) => new URLSearchParams(obj).toString();

async function driveList(params) {
  const out = [];
  let pageToken;
  do {
    const url = `${API}/files?${q({
      ...params,
      key: KEY,
      pageSize: '200',
      fields: 'nextPageToken,files(id,name,mimeType,createdTime,size)',
      ...(pageToken ? { pageToken } : {})
    })}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Drive list failed ${res.status}: ${await res.text()}`);
    const json = await res.json();
    out.push(...(json.files || []));
    pageToken = json.nextPageToken;
  } while (pageToken);
  return out;
}

async function findSubfolders() {
  const kids = await driveList({
    q: `'${ROOT}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  });
  const found = {};
  for (const [name, lane] of Object.entries(LANES)) {
    const hit = kids.find((k) => k.name.trim().toLowerCase() === name.toLowerCase());
    if (hit) found[lane] = hit.id;
    else console.warn(`! No "${name}" subfolder found — skipping that lane.`);
  }
  return found;
}

async function download(id) {
  const res = await fetch(`${API}/files/${id}?alt=media&key=${KEY}`);
  if (!res.ok) throw new Error(`Download ${id} failed ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/* iPhones shoot HEIC and sharp's prebuilt libvips does not decode it,
   so convert to JPEG first when that is what turned up. */
async function toProcessable(buf, mimeType) {
  if (/hei[cf]/i.test(mimeType)) {
    console.log('   converting HEIC -> JPEG');
    return Buffer.from(await heicConvert({ buffer: buf, format: 'JPEG', quality: 0.92 }));
  }
  return buf;
}

async function processImage(buf, mimeType, lane, id) {
  const source = await toProcessable(buf, mimeType);
  const laneDir = path.join(OUT_DIR, lane);
  await mkdir(laneDir, { recursive: true });

  const base = sharp(source, { failOn: 'none' }).rotate(); // honour EXIF orientation
  const meta = await base.metadata();

  const fullPath = path.join(laneDir, `${id}.webp`);
  const thumbPath = path.join(laneDir, `${id}-thumb.webp`);

  const full = await base
    .clone()
    .resize({ width: FULL_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  await writeFile(fullPath, full.data);

  await writeFile(thumbPath, await base
    .clone()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: 74 })
    .toBuffer());

  return {
    full: fullPath,
    thumb: thumbPath,
    w: full.info.width,
    h: full.info.height,
    srcW: meta.width ?? null,
    srcH: meta.height ?? null
  };
}

async function loadManifest() {
  if (!existsSync(MANIFEST)) return { photos: [] };
  try { return JSON.parse(await readFile(MANIFEST, 'utf8')); }
  catch { return { photos: [] }; }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const prev = await loadManifest();
  const byId = new Map((prev.photos || []).map((p) => [p.id, p]));

  const folders = await findSubfolders();
  if (!Object.keys(folders).length) throw new Error('Neither subfolder was found. Check the folder is shared as "Anyone with the link".');

  const seen = new Set();
  const photos = [];
  let added = 0;

  for (const [lane, folderId] of Object.entries(folders)) {
    const files = await driveList({
      q: `'${folderId}' in parents and mimeType contains 'image/' and trashed=false`,
      orderBy: 'createdTime desc'
    });
    console.log(`${lane}: ${files.length} image(s) in Drive`);

    for (const f of files) {
      seen.add(f.id);
      const existing = byId.get(f.id);

      /* Already processed and the files are still on disk — reuse,
         but let the lane follow the photo if it was moved. */
      if (existing && existsSync(existing.full) && existsSync(existing.thumb)) {
        photos.push({ ...existing, lane });
        continue;
      }

      console.log(` + ${f.name} (${lane})`);
      try {
        const buf = await download(f.id);
        const img = await processImage(buf, f.mimeType, lane, f.id);
        photos.push({
          id: f.id,
          lane,
          published: f.createdTime,
          full: img.full,
          thumb: img.thumb,
          w: img.w,
          h: img.h,
          caption: ''       // filled in by hand if ever wanted; filenames are camera UUIDs
        });
        added++;
      } catch (err) {
        console.error(`   FAILED on ${f.name}: ${err.message}`);
      }
    }
  }

  /* Anything no longer in Drive gets removed from the site too. */
  let removed = 0;
  for (const [id, p] of byId) {
    if (seen.has(id)) continue;
    for (const f of [p.full, p.thumb]) {
      if (f && existsSync(f)) { await unlink(f); }
    }
    removed++;
    console.log(` - removed ${id} (gone from Drive)`);
  }

  /* Sweep any orphaned files not referenced by the manifest. */
  const referenced = new Set(photos.flatMap((p) => [p.full, p.thumb]));
  for (const lane of Object.values(LANES)) {
    const dir = path.join(OUT_DIR, lane);
    if (!existsSync(dir)) continue;
    for (const name of await readdir(dir)) {
      const rel = path.join(dir, name);
      if (!referenced.has(rel)) { await unlink(rel); console.log(` - swept orphan ${rel}`); }
    }
  }

  photos.sort((a, b) => new Date(b.published) - new Date(a.published));

  await writeFile(MANIFEST, JSON.stringify({
    generated: new Date().toISOString(),
    expiryDays: EXPIRY_DAYS,
    photos
  }, null, 2) + '\n');

  console.log(`\nDone. ${photos.length} photo(s) in manifest — ${added} added, ${removed} removed.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
