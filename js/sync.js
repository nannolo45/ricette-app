// Two-way sync of local collections with JSON files in a GitHub repository.
import {
  state, COLLECTIONS, mergeLists, purgeTombstones, serialize, replaceCollection, saveMeta, kvGet, kvSet,
} from './store.js';

export const PATHS = {
  recipes: 'data/recipes.json',
  pantry: 'data/pantry.json',
  shopping: 'data/shopping.json',
  queue: 'data/import-queue.json',
};

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
  if (res.status === 404) return { sha: null, data: [] };
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
  return { sha: meta.sha, data: Array.isArray(data) ? data : [] };
}

async function putFile(path, text, sha) {
  const body = { message: `app: update ${path}`, content: b64encode(text), branch: branch() };
  if (sha) body.sha = sha;
  const res = await api(`contents/${path}`, {
    method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  });
  if (res.status === 409 || res.status === 422) return false; // someone else wrote first
  if (!res.ok) throw fail(res);
  return true;
}

async function syncCollection(c) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const remote = await getFile(PATHS[c]);
    const merged = purgeTombstones(mergeLists(remote.data, state[c]));
    const text = serialize(merged);
    if (text !== serialize(remote.data)) {
      const ok = await putFile(PATHS[c], text, remote.sha);
      if (!ok) continue;
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
    if (res.ok || res.status === 422) continue;
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
        for (const c of COLLECTIONS) await syncCollection(c);
        // still dirty if another sync was requested (local edit) meanwhile
        await saveMeta({ dirty: again, lastSync: Date.now(), lastError: null });
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
