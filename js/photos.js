// Recipe photos: resized on the device, kept in IndexedDB (so they work offline)
// and stored in the data repo under images/.
import { kvGet, kvSet, uid, live } from './store.js';
import { fetchPhotoBlob } from './sync.js';

const MAX_SIDE = 1600;
const urls = new Map();
const inflight = new Map();

export const isRepoPhoto = (src) => typeof src === 'string' && src.startsWith('images/');

async function loadImage(file) {
  if (globalThis.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* fall back */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

// Shrink to max 1600 px and re-encode as JPEG (a phone photo goes from ~4 MB to ~250 KB).
export async function resize(file, maxSide = MAX_SIDE, quality = 0.82) {
  const img = await loadImage(file);
  const w = img.width, h = img.height;
  const k = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * k);
  canvas.height = Math.round(h * k);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', quality));
}

// Store locally now; it's uploaded with the next sync.
export async function addPhoto(recipeId, file) {
  return storePhoto(`images/${recipeId}-${uid().slice(0, 8)}.jpg`, await resize(file));
}

// Photos of cookbook pages / notes: a bit larger and sharper so small print stays readable.
export async function addScan(captureId, file) {
  return storePhoto(`images/scans/${captureId}-${uid().slice(0, 6)}.jpg`, await resize(file, 2000, 0.86));
}

async function storePhoto(path, blob) {
  await kvSet(`img:${path}`, blob);
  const pending = (await kvGet('pendingPhotos')) || [];
  pending.push(path);
  await kvSet('pendingPhotos', pending);
  urls.set(path, URL.createObjectURL(blob));
  return path;
}

export async function photoUrl(path) {
  if (!isRepoPhoto(path)) return path || null;
  if (urls.has(path)) return urls.get(path);
  if (inflight.has(path)) return inflight.get(path);
  const p = (async () => {
    let blob = await kvGet(`img:${path}`);
    if (!blob && navigator.onLine !== false) {
      try { blob = await fetchPhotoBlob(path); } catch { blob = null; }
      if (blob) await kvSet(`img:${path}`, blob);
    }
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    urls.set(path, url);
    return url;
  })();
  inflight.set(path, p);
  try { return await p; } finally { inflight.delete(path); }
}

// Fill in <img data-photo="images/..."> after a render.
export function hydrate(root) {
  for (const img of root.querySelectorAll('img[data-photo]')) {
    const path = img.dataset.photo;
    const known = urls.get(path);
    if (known) { img.src = known; continue; }
    photoUrl(path).then((url) => {
      if (url) img.src = url;
      else if (img.dataset.fallback) img.src = img.dataset.fallback;
      else img.remove();
    });
  }
}

// Download every photo once, so they're all available offline.
export async function prefetchAll() {
  const all = [...live('recipes').flatMap((r) => [...(r.photos || []), ...(r.sourcePhotos || [])]), ...live('folders').map((f) => f.cover).filter(Boolean)];
  for (const r of [{ photos: all }]) {
    for (const path of r.photos.filter(isRepoPhoto)) {
      if (urls.has(path)) continue;
      if (navigator.onLine === false) return;
      await photoUrl(path);
    }
  }
}

export function coverOf(r) {
  return (r.photos && r.photos[0]) || r.image || '';
}
