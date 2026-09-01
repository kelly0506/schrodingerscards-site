/* ============================================================
   Gallery — reads assets/gallery/photos.json and renders a grid
   plus a lightbox.

   Expiry is enforced HERE, not in the sync job. Each "now" photo
   carries the date it was published to Drive, and anything older
   than expiryDays simply is not rendered. That way, if the sync
   ever stops running, stale stock photos drop off on their own
   rather than sitting on the page indefinitely.
   ============================================================ */

const MANIFEST = 'assets/gallery/photos.json';
const FALLBACK_EXPIRY_DAYS = 7;

const el = (id) => document.getElementById(id);
const statusEl = el('gallery-status');

let visible = [];   // flat list, in display order — drives the lightbox
let index = 0;

const daysSince = (iso) => (Date.now() - new Date(iso).getTime()) / 86400000;

function altFor(photo, i) {
  if (photo.caption) return photo.caption;
  return photo.lane === 'now'
    ? `Recent arrival at the Schrödinger's Cards booth (photo ${i + 1})`
    : `The Schrödinger's Cards booth at Treasure Cove Mall (photo ${i + 1})`;
}

function tile(photo, i) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'photo-tile';
  btn.style.aspectRatio = photo.w && photo.h ? `${photo.w} / ${photo.h}` : '4 / 3';

  const img = document.createElement('img');
  img.src = photo.thumb;
  img.alt = altFor(photo, i);
  img.loading = 'lazy';
  img.decoding = 'async';
  if (photo.w && photo.h) { img.width = photo.w; img.height = photo.h; }
  img.addEventListener('load', () => img.classList.add('loaded'));
  /* If it is already cached the load event may have fired before we listened. */
  if (img.complete) img.classList.add('loaded');
  btn.appendChild(img);

  if (photo.lane === 'now') {
    const badge = document.createElement('span');
    badge.className = 'tile-badge';
    badge.textContent = 'Just in';
    btn.appendChild(badge);
  }

  btn.addEventListener('click', () => openLightbox(photo.displayIndex));
  return btn;
}

function render(photos, expiryDays) {
  const now = photos.filter((p) => p.lane === 'now' && daysSince(p.published) < expiryDays);
  const evergreen = photos.filter((p) => p.lane === 'evergreen');

  visible = [...now, ...evergreen];
  visible.forEach((p, i) => { p.displayIndex = i; });

  if (!visible.length) {
    statusEl.className = 'gallery-status empty';
    statusEl.textContent = 'No photos up just yet — check back shortly, or come see the booth in person.';
    return;
  }
  statusEl.hidden = true;

  if (now.length) {
    const grid = el('grid-now');
    now.forEach((p, i) => grid.appendChild(tile(p, i)));
    el('section-now').hidden = false;
  }
  if (evergreen.length) {
    const grid = el('grid-evergreen');
    evergreen.forEach((p, i) => grid.appendChild(tile(p, i)));
    el('section-evergreen').hidden = false;
  }
}

/* ---------- Lightbox ---------- */

const lb = el('lightbox');
const lbImg = el('lb-img');
const lbCaption = el('lb-caption');
let lastFocused = null;

function show(i) {
  index = (i + visible.length) % visible.length;
  const p = visible[index];
  lbImg.src = p.full;
  lbImg.alt = altFor(p, index);
  lbCaption.textContent = p.caption || '';
  const solo = visible.length < 2;
  el('lb-prev').hidden = solo;
  el('lb-next').hidden = solo;
}

function openLightbox(i) {
  lastFocused = document.activeElement;
  show(i);
  lb.hidden = false;
  document.body.style.overflow = 'hidden';
  el('lb-close').focus();
}

function closeLightbox() {
  lb.hidden = true;
  lbImg.src = '';
  document.body.style.overflow = '';
  if (lastFocused) lastFocused.focus();
}

el('lb-close').addEventListener('click', closeLightbox);
el('lb-prev').addEventListener('click', () => show(index - 1));
el('lb-next').addEventListener('click', () => show(index + 1));
lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });

document.addEventListener('keydown', (e) => {
  if (lb.hidden) return;
  if (e.key === 'Escape') closeLightbox();
  else if (e.key === 'ArrowLeft') show(index - 1);
  else if (e.key === 'ArrowRight') show(index + 1);
  else if (e.key === 'Tab') {
    /* Keep focus inside the dialog while it is open. */
    const focusable = [...lb.querySelectorAll('button')].filter((b) => !b.hidden);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

/* Swipe on touch devices */
let touchX = null;
lb.addEventListener('touchstart', (e) => { touchX = e.changedTouches[0].clientX; }, { passive: true });
lb.addEventListener('touchend', (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 45) show(dx > 0 ? index - 1 : index + 1);
  touchX = null;
}, { passive: true });

/* ---------- Boot ---------- */

fetch(`${MANIFEST}?t=${Date.now()}`)
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then((data) => render(data.photos || [], data.expiryDays || FALLBACK_EXPIRY_DAYS))
  .catch(() => {
    statusEl.className = 'gallery-status empty';
    statusEl.textContent = 'We could not load the photos just now. Please try again in a moment.';
  });
