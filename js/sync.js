// Two-way sync of local collections with JSON files in a GitHub repository.
import {
  state, COLLECTIONS, mergeLists, purgeTombstones, serialize, replaceCollection, saveMeta, kvGet, kvSet, kvDel, kvKeys,
} from './store.js';

export const PATHS = {
  recipes: 'data/recipes.json',
  pantry: 'data/pantry.json',
  shopping: 'data/shopping.json',
  queue: 'data/import-queue.json',
  folders: 'data/folders.json',
  devices: 'push/devices.json',
  tagdefs: 'data/tags.json',
  prefs: 'data/prefs.json',
  // shared with Everyday (same format): where things can be bought
  shops: 'data/shops.json',
};
const VAPID_PATH = 'push/vapid.json';

// Data contract with Everyday (handoff Nov 2026): the highest version of the shared files this app understands.
// The version is the prefs record {id: 'contract', value}. If another app raised it, this one keeps reading
// but doesn't write the shared files until it's updated.
export const CONTRACT = 1;
const SHARED_FILES = ['shopping', 'shops', 'prefs', 'pantry'];
export function contractInData() {
  const rec = (state.prefs || []).find((p) => p && p.id === 'contract' && !p.deleted);
  return Number(rec?.value) || 0;
}

export function isConfigured() {
  const s = state.settings;
  return Boolean(s.owner && s.repo && s.token);
}

function branch() { return state.settings.branch || 'main'; }

function api(path, init = {}) {
  const s = state.settings;
  const url = `https://api.github.com/repos/${encodeURIComponent(s.owner.trim())}/${encodeURIComponent(s.repo.trim())}${path ? '/' + path : ''}`;
  return fetch(url, {
    ...init,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${s.token.trim()}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers || {}),
    },
  });
}

class SyncError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}

function fail(res) {
  if (res.status === 401) return new SyncError('auth', 401);
  if (res.status === 403) return new SyncError('forbidden', 403);
  if (res.status === 404) return new SyncError('notfound', 404);
  return new SyncError('http', res.status);
}

function b64decode(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function b64encode(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function getFile(path) {
  const ref = encodeURIComponent(branch());
  const res = await api(`contents/${path}?ref=${ref}`);
  if (res.status === 404) return { sha: null, data: [], text: '[]', size: 0 };
  if (!res.ok) throw fail(res);
  const meta = await res.json();
  let text;
  if (meta.content) text = b64decode(meta.content);
  else {
    // Files over 1 MB come without inline content.
    const raw = await api(`contents/${path}?ref=${ref}`, { headers: { Accept: 'application/vnd.github.raw' } });
    if (!raw.ok) throw fail(raw);
    text = await raw.text();
  }
  let data = [];
  try { data = JSON.parse(text); } catch { data = []; }
  return { sha: meta.sha, data: Array.isArray(data) ? data : [], size: meta.size ?? text.length };
}

// Returns the new file's sha, or null when someone else wrote first.
async function putFile(path, text, sha) {
  const body = { message: `app: update ${path}`, content: b64encode(text), branch: branch() };
  if (sha) body.sha = sha;
  const res = await api(`contents/${path}`, {
    method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  });
  if (res.status === 409 || res.status === 422) return null; // someone else wrote first
  if (!res.ok) throw fail(res);
  let out = {};
  try { out = await res.json(); } catch { /* no body */ }
  return out?.content?.sha || 'unknown';
}

// What each data file looked like on GitHub at our last sync (sha + content), per repository and branch,
// so a sync only downloads files whose sha changed. One directory listing per folder tells us the shas.
const CACHE_PREFIX = 'gh:';
function cacheKey(path) {
  const s = state.settings;
  return `${CACHE_PREFIX}${String(s.owner || '').trim().toLowerCase()}/${String(s.repo || '').trim().toLowerCase()}@${branch()}:${path}`;
}
export async function clearFileCache() {
  for (const k of await kvKeys(CACHE_PREFIX)) await kvDel(k);
}

async function listFiles() {
  const ref = encodeURIComponent(branch());
  const dirs = [...new Set(Object.values(PATHS).map((p) => p.slice(0, p.lastIndexOf('/'))))];
  const files = new Map();
  const listed = new Set();
  for (const dir of dirs) {
    const res = await api(`contents/${dir}?ref=${ref}`);
    if (res.status === 404) continue; // folder not there (yet): those files are fetched one by one
    if (!res.ok) throw fail(res);
    const list = await res.json();
    if (!Array.isArray(list)) continue;
    listed.add(dir);
    for (const f of list) if (f && f.type === 'file') files.set(f.path, { sha: f.sha, size: f.size });
  }
  return { files, listed };
}

const byteLength = (text) => new TextEncoder().encode(text).length;

async function syncCollection(c, listing, sizes, readOnly = false) {
  const path = PATHS[c];
  for (let attempt = 0; attempt < 4; attempt++) {
    let remote = null;
    if (attempt === 0 && listing && listing.listed.has(path.slice(0, path.lastIndexOf('/')))) {
      const info = listing.files.get(path);
      if (!info) remote = { sha: null, data: [], size: 0 };
      else {
        const cached = await kvGet(cacheKey(path));
        if (cached && cached.sha === info.sha) {
          try { remote = { sha: info.sha, data: JSON.parse(cached.text), size: info.size, cached: true }; } catch { remote = null; }
        }
      }
    }
    if (!remote) remote = await getFile(path);
    const merged = purgeTombstones(mergeLists(remote.data, state[c]));
    const text = serialize(merged);
    const remoteText = serialize(remote.data);
    if (text !== remoteText && !readOnly) {
      const sha = await putFile(path, text, remote.sha);
      if (!sha) continue;
      await kvSet(cacheKey(path), { sha, text });
      sizes[path] = byteLength(text);
    } else {
      if (!remote.cached && remote.sha) await kvSet(cacheKey(path), { sha: remote.sha, text: remoteText });
      if (remote.sha) sizes[path] = remote.size ?? byteLength(remoteText);
    }
    // Merge again with whatever changed locally while we were talking to GitHub.
    await replaceCollection(c, mergeLists(merged, state[c]));
    return;
  }
  throw new SyncError('conflict');
}

async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// Photos taken/added on this device wait in IndexedDB until they're uploaded.
async function uploadPendingPhotos() {
  const pending = (await kvGet('pendingPhotos')) || [];
  const left = [];
  for (const path of pending) {
    const blob = await kvGet(`img:${path}`);
    if (!blob) continue;
    const res = await api(`contents/${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `app: add ${path}`, content: await blobToBase64(blob), branch: branch() }),
    });
    // 422 = file already there (e.g. uploaded before a crash): fine.
    if (res.ok || res.status === 422) {
      if (path.startsWith('books/')) await kvDel(`img:${path}`); // books are only kept until they're on GitHub
      continue;
    }
    left.push(path);
    if (res.status === 401 || res.status === 403) { await kvSet('pendingPhotos', left.concat(pending.slice(pending.indexOf(path) + 1))); throw fail(res); }
  }
  await kvSet('pendingPhotos', left);
}

export async function fetchPhotoBlob(path) {
  if (!isConfigured()) return null;
  const res = await api(`contents/${path}?ref=${encodeURIComponent(branch())}`, { headers: { Accept: 'application/vnd.github.raw' } });
  if (!res.ok) return null;
  return res.blob();
}

let running = null;
let again = false;

export function syncNow() {
  if (!isConfigured()) return Promise.resolve({ skipped: true });
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve({ offline: true });
  if (running) { again = true; return running; }
  running = (async () => {
    try {
      do {
        again = false;
        await uploadPendingPhotos();
        let listing = null;
        try { listing = await listFiles(); } catch (e) { if (e instanceof SyncError && (e.code === 'auth' || e.code === 'forbidden')) throw e; listing = null; }
        const sizes = {};
        let newer = contractInData() > CONTRACT;
        for (const c of COLLECTIONS) {
          await syncCollection(c, listing, sizes, newer && SHARED_FILES.includes(c));
          if (c === 'prefs') newer = contractInData() > CONTRACT; // the prefs just arrived: check again
        }
        // still dirty if another sync was requested (local edit) meanwhile
        await saveMeta({ dirty: again, lastSync: Date.now(), lastError: null, fileSizes: sizes, contractNewer: newer });
      } while (again);
      return { ok: true };
    } catch (e) {
      const code = e instanceof SyncError ? e.code : (e instanceof TypeError ? 'network' : 'unknown');
      await saveMeta({ lastError: code });
      return { error: code };
    } finally {
      running = null;
    }
  })();
  return running;
}

// Keys that identify this app to browser push services. Created once by the
// first device that turns on notifications, stored in the (private) repo.
function b64url(bytes) {
  let bin = '';
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function getOrCreateVapidPublicKey() {
  const ref = encodeURIComponent(branch());
  const res = await api(`contents/${VAPID_PATH}?ref=${ref}`);
  if (res.ok) {
    const meta = await res.json();
    return JSON.parse(b64decode(meta.content)).publicKey;
  }
  if (res.status !== 404) throw fail(res);
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicKey = b64url(await crypto.subtle.exportKey('raw', pair.publicKey));
  const privateKey = (await crypto.subtle.exportKey('jwk', pair.privateKey)).d;
  const text = JSON.stringify({ publicKey, privateKey, subject: 'mailto:ricette@users.noreply.github.com' }, null, 1) + '\n';
  const put = await api(`contents/${VAPID_PATH}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'app: create notification keys', content: b64encode(text), branch: branch() }),
  });
  if (put.status === 422 || put.status === 409) return getOrCreateVapidPublicKey(); // another device was faster
  if (!put.ok) throw fail(put);
  return publicKey;
}

export function isSyncing() { return Boolean(running); }

export async function testConnection() {
  if (!isConfigured()) return { error: 'missing' };
  try {
    const res = await api('');
    if (!res.ok) return { error: fail(res).code };
    const repo = await res.json();
    if (!repo.permissions?.push) return { error: 'readonly' };
    return { ok: true, private: repo.private };
  } catch {
    return { error: 'network' };
  }
}
