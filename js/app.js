import {
  state, load, live, get, upsert, remove, uid, onChange, saveSettings, COLLECTIONS,
} from './store.js';
import { syncNow, isConfigured, isSyncing, testConnection } from './sync.js';
import {
  parseIngredient, formatQty, scaleQty, convert, addQuantities, namesMatch, normalizeName, tidy,
  UNITS, stepFor, setDecimalSeparator,
} from './parse.js';
import { t, setLang, getLang, LANGS, unitLabel, unitOptionLabel, detectLang } from './i18n.js';
import { addPhoto, addScan, addUpload, hydrate, prefetchAll, coverOf, isRepoPhoto } from './photos.js';
import { daysUntil, expiryState, todayStr } from './expiry.js';
import { getOrCreateVapidPublicKey } from './sync.js';
import { scanBarcode } from './scanner.js';
import { parseRecipeText, detectLang as textLang } from './recipe-text.js';
import { findDishImage } from './dish-image.js';
import { tagsOf, minutesOf, rankByPantry, pantryCoverage, autoTags, AUTO_TAGS, COURSE_TAGS, isOriginTag, isBasic as isBasicName } from './recipe-tools.js';
import { originOf, flagOf, CONTINENTS, CONTINENT_ICON } from './geo.js';
import { planBookFix, booksOf } from './book-fix.js';
// shared with Everyday, copied unchanged: the list's views, search and departments
import { availableModes, currentMode, saveModeTarget, groupItems, itemMatches, addedOf, fold, DRAG_MODES, GROUPED_MODES, byItemOrder, recipeGroupOf } from './shoplist.js';
import { DEPTS, DEPT_IDS, deptIcon, deptOf } from './depts.js';
import { shopStatus } from './shop-status.js';
import { CATEGORIES, CATEGORY_IDS, categoryIcon, categorize, categoryOf } from './categories.js';
import { lookupProduct } from './products.js';
import { isDragging, reorderSubset, byOrder } from './sortable.js';
import { nutritionOf, estimateNutrition } from './nutrition.js';
import { recipeTimes, formatMinutes } from './times.js';
import { photoCandidates, creditFor, testKey, mealdbSearch, rankOnline, searchTerms } from './online.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const round = (x) => Math.round(x * 1000) / 1000;
const num = (v) => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };

const view = $('#view');
const modal = $('#modal');
const ui = { servings: {}, search: '', prefillUrl: '', connMsg: '', edit: null };

// Preferences shared by all devices (data/prefs.json): one record per setting.
function pref(id, fallback) { const p = get('prefs', id); return p && p.value !== undefined ? p.value : fallback; }
function setPref(id, value) { upsert('prefs', { id, value }, { silent: true }); }

// "People" chosen for every recipe at once in the Recipes view (0 = as each recipe says).
function globalPeople() { const n = Number(pref('people', 0)); return Number.isFinite(n) && n > 0 ? Math.round(n) : 0; }
function servingsFor(r) { return ui.servings[r.id] || globalPeople() || r.servings || 4; }

// <img> for a cover: repo photos are loaded from IndexedDB/GitHub, web images directly.
function photoTag(src, { fallback = '', cls = '' } = {}) {
  if (!src) return '';
  if (isRepoPhoto(src)) {
    return `<img class="${cls}" data-photo="${esc(src)}" ${fallback ? `data-fallback="${esc(fallback)}"` : ''} alt="">`;
  }
  return `<img class="${cls}" src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`;
}

// ---------- helpers ----------

function qtyText(qty, unit) {
  if (qty == null) return '';
  const tt = tidy(qty, unit || '');
  const q = formatQty(tt.qty, tt.unit);
  return [q, unitLabel(tt.unit, tt.qty)].filter(Boolean).join(' ');
}

function ingredientsOf(r) {
  return (r.ingredients || []).map((i) => (i.name == null ? parseIngredient(i.raw || '') : i));
}

// A pantry item can carry several barcodes (e.g. two brands of milk).
function codesOf(p) { return [...new Set([...(p.barcodes || []), ...(p.barcode ? [p.barcode] : [])])]; }
function hasCode(p, code) { return codesOf(p).includes(code); }
function withCode(p, code) { const codes = [...new Set([...codesOf(p), code])]; return { barcode: codes[0], barcodes: codes }; }
function pantryByCode(code) { return live('pantry').find((p) => hasCode(p, code)); }

function findPantry(name) { return live('pantry').find((p) => namesMatch(p.name, name)); }

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
}

function route() {
  const h = location.hash.replace(/^#\/?/, '') || 'recipes';
  const [name, id] = h.split('/');
  return { name, id: id && decodeURIComponent(id) };
}

const TAB_OF = { import: 'import', putaway: 'list', recipes: 'recipes', folder: 'recipes', suggest: 'recipes', recipe: 'recipes', edit: 'recipes', list: 'list', pantry: 'pantry', settings: 'settings' };

// ---------- folders ----------

const byTitle = (a, b) => (a.name || a.title || '').localeCompare(b.name || b.title || '', undefined, { sensitivity: 'base' });

function folderOf(id) { return id ? get('folders', id) : null; }

function currentFolderId() {
  const r = route();
  return r.name === 'folder' && folderOf(r.id) ? r.id : null;
}

// Where new recipes go: the Import tab has its own folder choice, elsewhere the folder being viewed.
function targetFolderId() {
  if (route().name === 'import') return folderOf(state.settings.importFolder) ? state.settings.importFolder : null;
  return currentFolderId();
}

function childFolders(parentId) {
  return live('folders').filter((f) => (f.parentId || null) === (parentId || null)).sort(byTitle);
}

function folderPath(id) {
  const path = [];
  const seen = new Set();
  let f = folderOf(id);
  while (f && !seen.has(f.id)) { seen.add(f.id); path.unshift(f); f = folderOf(f.parentId); }
  return path;
}

function descendantIds(id) {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of live('folders')) if (f.parentId && out.has(f.parentId) && !out.has(f.id)) { out.add(f.id); grew = true; }
  }
  return out;
}

function recipeFolderId(r) { return r.folderId && folderOf(r.folderId) ? r.folderId : null; }

function countIn(folderId) {
  const ids = descendantIds(folderId);
  return live('recipes').filter((r) => ids.has(recipeFolderId(r))).length;
}

// <option>s for every folder, indented by depth.
function folderOptions(selected, exclude = new Set()) {
  const out = [`<option value="">${esc(t('noFolder'))}</option>`];
  const walk = (parentId, depth) => {
    for (const f of childFolders(parentId)) {
      if (exclude.has(f.id)) continue;
      out.push(`<option value="${esc(f.id)}" ${f.id === selected ? 'selected' : ''}>${'\u00a0\u00a0'.repeat(depth)}${depth ? '└ ' : ''}${esc(f.name)}</option>`);
      walk(f.id, depth + 1);
    }
  };
  walk(null, 0);
  return out.join('');
}

function folderHref(id) { return id ? `#/folder/${encodeURIComponent(id)}` : '#/recipes'; }

// ---------- shopping / pantry logic ----------

function addToShopping({ name, qty, unit, note, shops }, source) {
  const existing = live('shopping').find((s) => !s.checked && !s.auto && namesMatch(s.name, name)
    && addQuantities(s, { qty, unit }) !== null);
  if (existing) {
    const sum = addQuantities(existing, { qty, unit });
    const sources = [...new Set([...(existing.sources || []), source].filter(Boolean))];
    // merged: the union of both items' shops, the first item's order first
    const merged = [...new Set([...(existing.shops || []), ...(shops || [])])];
    upsert('shopping', { ...existing, qty: sum.qty == null ? null : round(sum.qty), unit: sum.unit, sources, ...(merged.length ? { shops: merged } : {}), addedAt: Math.min(addedOf(existing) || Date.now(), Date.now()) }, { silent: true });
  } else {
    upsert('shopping', {
      id: uid(), name, qty: qty == null ? null : round(qty), unit: unit || '', note: note || '',
      checked: false, sources: source ? [source] : [], addedAt: Date.now(), cat: newItemCat(name), ...(shops && shops.length ? { shops } : {}),
    }, { silent: true });
  }
}

function lowInfo(p) {
  const min = num(p.min);
  if (min == null) return null;
  const qty = num(p.qty) || 0;
  if (qty > min) return null;
  const tgt = num(p.target);
  const target = tgt != null && tgt > min ? tgt : Math.max(min * 2, min + stepFor(p.unit));
  return { buy: round(target - qty) };
}

function remindDefault() {
  const d = num(state.settings.remindDays);
  return d == null ? 3 : d;
}

function expiringItems() {
  return live('pantry')
    .map((p) => ({ p, st: expiryState(p, remindDefault()), d: daysUntil(p.expires) }))
    .filter((x) => x.st === 'soon' || x.st === 'expired')
    .sort((a, b) => a.d - b.d);
}

function expiryText(d) {
  if (d < 0) return t('expiredAgo', -d);
  if (d === 0) return t('expiresToday');
  if (d === 1) return t('expiresTomorrow');
  return t('expiresIn', d);
}

function shortDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(getLang(), { day: 'numeric', month: 'short' });
}

function updatePantryBadge() {
  const n = expiringItems().length;
  const a = document.querySelector('nav.tabs a[data-tab=pantry]');
  if (!a) return;
  let b = a.querySelector('.count');
  if (!n) { b?.remove(); return; }
  if (!b) { b = document.createElement('span'); b.className = 'count'; a.querySelector('.ico').append(b); }
  b.textContent = n;
}

function ensureLowItems() {
  for (const p of state.pantry) {
    const id = `low_${p.id}`;
    const cur = state.shopping.find((s) => s.id === id);
    const low = p.deleted ? null : lowInfo(p);
    if (low) {
      if (!cur || cur.deleted) {
        upsert('shopping', { id, name: p.name, qty: low.buy, unit: p.unit || '', checked: false, auto: true, pantryId: p.id, sources: [], addedAt: Date.now(), cat: categoryOf(p) }, { silent: true });
      } else if (!cur.checked && cur.qty !== low.buy || cur.name !== p.name || cur.unit !== (p.unit || '')) {
        upsert('shopping', { ...cur, name: p.name, qty: low.buy, unit: p.unit || '' }, { silent: true });
      }
    } else if (cur && !cur.deleted && !cur.checked) {
      remove('shopping', id);
    }
  }
}

function setChecked(id, checked) {
  const it = get('shopping', id);
  if (!it) return;
  let stocked = it.stocked || null;
  // (older versions added to the pantry on check; undo that if unchecked)
  if (!checked && stocked) {
    const p = get('pantry', stocked.pantryId);
    if (p) upsert('pantry', { ...p, qty: Math.max(0, round((num(p.qty) || 0) - stocked.amount)) }, { silent: true });
    stocked = null;
  }
  upsert('shopping', { ...it, checked, stocked }, { silent: true });
  ensureLowItems();
  changed();
}

function planForRecipe(r, n, usePantry) {
  const base = r.servings || 4;
  return ingredientsOf(r).map((ing, idx) => {
    const need = scaleQty(ing.qty, base, n);
    let buy = need; let covered = false; let have = null;
    if (usePantry) {
      const p = findPantry(ing.name);
      if (p) {
        have = p;
        const pq = num(p.qty) || 0;
        if (need == null) covered = pq > 0;
        else {
          const avail = convert(pq, p.unit, ing.unit);
          if (avail != null) { buy = Math.max(0, need - avail); covered = buy <= 1e-9; }
        }
      }
    }
    return { idx, name: ing.name, unit: ing.unit, note: ing.note, need, buy, covered, have };
  });
}

function cook(r, n) {
  const base = r.servings || 4;
  let count = 0;
  upsert('recipes', { ...r, cookedCount: (r.cookedCount || 0) + 1, lastCooked: Date.now() }, { silent: true });
  for (const ing of ingredientsOf(r)) {
    if (ing.qty == null) continue;
    const p = findPantry(ing.name);
    if (!p) continue;
    const sub = convert(scaleQty(ing.qty, base, n), ing.unit, p.unit);
    if (sub == null) continue;
    upsert('pantry', { ...p, qty: Math.max(0, round((num(p.qty) || 0) - sub)) }, { silent: true });
    count++;
  }
  ensureLowItems();
  changed();
  toast(t('pantryUpdated', count));
}

// After a sync: parse freshly imported recipes, tidy the import queue.
function postSync() {
  let imported = 0;
  for (const r of live('recipes')) {
    if (r.parsed === false) {
      const q = state.queue.find((x) => x.recipeId === r.id || `r_${x.id}` === r.id);
      upsert('recipes', {
        ...r, parsed: true, folderId: r.folderId || q?.folderId || null,
        ingredients: (r.ingredients || []).map((i) => parseIngredient(i.raw || '')),
      }, { silent: true });
      imported++;
    }
  }
  for (const q of live('queue')) {
    if (q.status === 'done' && q.type !== 'book' && q.type !== 'search' && Date.now() - (q.updatedAt || 0) > 60_000) remove('queue', q.id);
    if (q.type === 'image' && q.status === 'error' && Date.now() - (q.updatedAt || 0) > 86_400_000) remove('queue', q.id);
  }
  // pictures for recipes that have none: the GitHub job looks for them, a batch at a time
  if (pref('autoPhotos', true) !== false && isConfigured()
    && live('recipes').some((r) => !(r.photos || []).length && !r.image && !r.photoTried)
    && !live('queue').some((q) => q.type === 'autophoto' && q.status === 'pending')) {
    upsert('queue', { id: `ap${uid().slice(0, 8)}`, type: 'autophoto', status: 'pending', addedAt: Date.now() }, { silent: true });
  }
  ensureLowItems();
  if (imported) toast(t('importedN', imported));
  prefetchAll();
  if (live('pantry').some((p) => p.lookupPending)) resolvePendingProducts();
}

// ---------- sync scheduling ----------

let syncTimer = null;
function changed() {
  render();
  clearTimeout(syncTimer);
  syncTimer = setTimeout(runSync, 1500);
}

async function runSync() {
  if (!isConfigured()) { updateSyncBadge(); return; }
  updateSyncBadge(true);
  await syncNow();
  postSync();
  updateSyncBadge();
  if (state.meta.dirty) { clearTimeout(syncTimer); syncTimer = setTimeout(runSync, 1500); }
}

function updateSyncBadge(syncing = isSyncing()) {
  const b = $('#sync');
  let st;
  if (!isConfigured()) st = 'local';
  else if (syncing) st = 'syncing';
  else if (!navigator.onLine) st = 'offline';
  else if (state.meta.lastError && state.meta.lastError !== 'network') st = 'error';
  else if (state.meta.lastError === 'network') st = 'offline';
  else if (state.meta.dirty) st = 'pending';
  else st = 'synced';
  b.className = `sync ${st}`;
  b.title = t(`st_${st}`);
  b.setAttribute('aria-label', b.title);
  $('#sync-label').textContent = t(`st_${st}`);
}

// ---------- views ----------

// queue entries the user put there (links, photos, books) — not the app's own jobs
const USER_QUEUE = (q) => !['search', 'image', 'autophoto'].includes(q.type);

function viewImport() {
  const queue = live('queue').filter((q) => USER_QUEUE(q) && (q.status !== 'done' || q.type === 'book')).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  const recent = live('recipes').filter((r) => r.createdAt).sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
  const folder = folderOf(state.settings.importFolder) ? state.settings.importFolder : '';
  return `
  <h1>${esc(t('tabImport'))}</h1>
  <form class="import" id="import-form">
    <input type="url" name="url" id="import-url" required placeholder="${esc(t('pasteLink'))}" inputmode="url" autocomplete="off">
    <button class="btn primary">${esc(t('import'))}</button>
  </form>
  <div class="import-tools">
    <button class="btn photo-import" data-action="photo-import">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.5" r="3.5"/></svg>
      ${esc(t('fromPhoto'))}</button>
    <button class="btn" data-action="new-recipe">✍️ ${esc(t('manualLong'))}</button>
    <button class="btn book-import" data-action="book-import">📚 ${esc(t('wholeBook'))} <small>PDF · EPUB</small></button>
  </div>
  <label class="import-folder">📁 ${esc(t('saveIn'))}
    <select id="import-folder">${folderOptions(folder)}</select></label>
  <p class="hint">${esc(t('importHint'))}</p>
  ${!isConfigured() && queue.length ? `<p class="hint">${esc(t('importNeedsGithub'))}</p>` : ''}
  ${queue.length ? `<h2>${esc(t('importQueue'))}</h2>${queue.map(queueItem).join('')}` : ''}
  ${recent.length ? `<h2>${esc(t('recentlyAdded'))}</h2>${recipeCards(recent, new Map(), true)}` : ''}`;
}

function pinnedBar() {
  const pins = pinnedTags().filter((tg) => tagCount().has(tg));
  if (!pins.length) return '';
  const f = filters();
  return `<div class="pin-bar" role="toolbar" aria-label="${esc(t('pinnedTags'))}">${pins.map((tg) => chip(tagLabel(tg), 'f-tag', tg, f.tags.includes(tg))).join('')}</div>`;
}

function viewRecipes() {
  const folderId = currentFolderId();
  const path = folderPath(folderId);
  const queueN = live('queue').filter((q) => USER_QUEUE(q) && q.status !== 'done').length;
  const booksDone = live('queue').filter((q) => q.type === 'book' && q.status === 'done').length;
  return `
  ${queueN ? `<a class="queue-note" href="#/import">⏳ ${esc(t('importsWaiting', queueN))}</a>` : booksDone ? `<a class="queue-note done" href="#/import">📚 ${esc(t('booksImported', booksDone))}</a>` : ''}
  <div class="row">
    <input type="search" id="search" placeholder="${esc(t('search'))}" value="${esc(ui.search)}">
  </div>
  ${pinnedBar()}
  <div class="toolbar">
    <label class="sort">⇅ <select id="sort" aria-label="${esc(t('sortBy'))}">${SORTS.map((k) => `<option value="${k}" ${k === sortKey() ? 'selected' : ''}>${esc(t(`sort_${k}`))}</option>`).join('')}</select></label>
    <label class="people-pick ${globalPeople() ? 'on' : ''}" title="${esc(t('peopleAllHint'))}">👥 <span class="pp-label">${esc(t('peopleAll'))}</span> <select id="people" aria-label="${esc(t('peopleAll'))}">
      <option value="0" ${globalPeople() ? '' : 'selected'}>${esc(t('peopleAsRecipe'))}</option>
      ${[1, 2, 3, 4, 5, 6, 8, 10, 12].map((k) => `<option value="${k}" ${globalPeople() === k ? 'selected' : ''}>${esc(t('people', k))}</option>`).join('')}
    </select></label>
    <button class="btn small ${ui.showFilters || filterCount() ? 'on' : ''}" data-action="toggle-filters">⚲ ${esc(t('filters'))}${filterCount() ? ` (${filterCount()})` : ''}</button>
    <a class="btn small primary" href="#/suggest">🍳 ${esc(t('whatToCook'))}</a>
  </div>
  ${ui.showFilters ? filterPanel() : ''}
  <div class="folder-bar">
    <div class="crumbs">
      <a href="#/recipes">${esc(t('allRecipes'))}</a>
      ${path.map((f) => `<span>›</span><a href="${folderHref(f.id)}">${esc(f.name)}</a>`).join('')}
    </div>
    <div class="folder-actions">
      ${folderId ? `<button class="btn small ghost" data-action="folder-edit" data-id="${esc(folderId)}">✎ ${esc(t('edit'))}</button>
      <button class="btn small ghost danger" data-action="folder-delete" data-id="${esc(folderId)}">🗑 ${esc(t('delete'))}</button>` : ''}
      <button class="btn small" data-action="folder-new">+ ${esc(t('folder'))}</button>
      <button class="btn small" data-action="new-recipe">+ ${esc(t('manual'))}</button>
    </div>
  </div>
  ${folderId ? bookFixBanner(folderId) : ''}
  <div id="cards">${cardsHtml()}</div>`;
}

// ---------- tidying up books imported by an older version ----------

function bookFixPlans(folderId) {
  const inFolder = live('recipes').filter((r) => r.folderId === folderId);
  return Object.entries(booksOf(inFolder)).map(([bookId]) => {
    // the whole book (its recipes may have been moved to other folders since)
    const all = live('recipes').filter((r) => (r.bookId || '') === bookId || String(r.id).startsWith(`r_${bookId}_`));
    return { bookId, ...planBookFix(all) };
  }).filter((p) => p.remove.length || p.changes.length);
}

function bookFixBanner(folderId) {
  const plans = bookFixPlans(folderId);
  if (!plans.length) return '';
  const nRemove = plans.reduce((a, p) => a + p.remove.length, 0);
  const nFix = plans.reduce((a, p) => a + p.changes.length, 0);
  return `<div class="book-fix"><span>🧹 ${esc(t('bookFixBanner', nRemove, nFix))}</span>
    <button class="btn small primary" data-action="book-fix" data-id="${esc(folderId)}">${esc(t('bookFixGo'))}</button></div>`;
}

function openBookFix(folderId) {
  const plans = bookFixPlans(folderId);
  if (!plans.length) return;
  const toRemove = plans.flatMap((p) => p.remove);
  const changes = plans.flatMap((p) => p.changes);
  const what = (c) => [c.patch.times && `⏱ ${t('bookFixTimes')}`, c.patch.nutrition && `🔥 ${t('bookFixNutrition')}`, c.patch.steps && `🧽 ${t('bookFixSteps')}`].filter(Boolean).join(' · ');
  openModal(`
    <h2>🧹 ${esc(t('bookFixTitle'))}</h2>
    ${toRemove.length ? `<h3>${esc(t('bookFixRemove'))}</h3><p class="hint small">${esc(t('bookFixRemoveHint'))}</p>
    <ul class="fix-list">${toRemove.map((x) => `<li><label class="check"><input type="checkbox" name="rm" value="${esc(x.id)}" ${x.sure ? 'checked' : ''}>
      <span><strong>${esc(x.title || '—')}</strong><br><small>${esc(t(`bookFixWhy_${x.reason}`))}</small></span></label></li>`).join('')}</ul>` : ''}
    ${changes.length ? `<h3>${esc(t('bookFixChange'))}</h3><ul class="fix-list">${changes.map((c) => `<li><strong>${esc(c.title)}</strong><br><small>${esc(what(c))}</small></li>`).join('')}</ul>` : ''}
    <div class="button-row">
      <button class="btn primary" value="ok">${esc(t('bookFixApply'))}</button>
      <button class="btn" value="cancel" formnovalidate>${esc(t('cancel'))}</button>
    </div>`, (form) => {
    const picked = new Set([...form.querySelectorAll('input[name=rm]:checked')].map((x) => x.value));
    for (const x of toRemove) {
      if (picked.has(x.id)) remove('recipes', x.id);
      // kept on purpose: don't ask again
      else { const r = get('recipes', x.id); if (r) upsert('recipes', { ...r, bookFixOk: true }, { silent: true }); }
    }
    for (const c of changes) {
      const r = get('recipes', c.id);
      if (r) upsert('recipes', { ...r, ...c.patch }, { silent: true });
    }
    changed();
    toast(t('bookFixDone', picked.size, changes.length));
  });
}

// ---------- sorting, filters, tags ----------

const SORTS = ['new', 'old', 'az', 'za', 'quick', 'active', 'fewest', 'kcal', 'protein', 'cooked', 'recent', 'pantry'];
function sortKey() { return SORTS.includes(state.settings.sort) ? state.settings.sort : 'new'; }

function filters() { return (ui.filters ||= { tags: [], source: '', maxTime: 0, maxActive: 0, ready: '', maxKcal: 0, minProt: 0 }); }
function filterCount() { const f = filters(); return f.tags.length + (f.source ? 1 : 0) + (f.maxTime ? 1 : 0) + (f.maxActive ? 1 : 0) + (f.ready ? 1 : 0) + (f.maxKcal ? 1 : 0) + (f.minProt ? 1 : 0); }

function tagDefs() { return live('tagdefs'); }
function tagDef(id) { return tagDefs().find((d) => d.id === id); }
function autoLabel(id) { const d = tagDef(id); return (d && (d.label || d.name)) || originLabel(id) || t(`tag_${id}`); }
// 🇮🇹 Italia / 🌍 Europa — country names come from the browser, in the app language
function countryName(code) {
  try { return new Intl.DisplayNames([getLang()], { type: 'region' }).of(code.toUpperCase()) || code.toUpperCase(); } catch { return code.toUpperCase(); }
}
function originLabel(id) {
  if (id.startsWith('geo_')) return `${flagOf(id.slice(4))} ${countryName(id.slice(4))}`;
  if (id.startsWith('cont_')) return `${CONTINENT_ICON[id.slice(5)] || '🌐'} ${t(`cont_${id.slice(5)}`)}`;
  return '';
}
function tagLabel(tag) { return tag.startsWith('auto:') ? autoLabel(tag.slice(5)) : tag; }

function allTags() {
  const count = new Map();
  for (const r of live('recipes')) for (const tg of tagsOf(r, tagDefs())) count.set(tg, (count.get(tg) || 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || tagLabel(a[0]).localeCompare(tagLabel(b[0])));
}
function tagCount() { return new Map(allTags()); }

// Pinned tags (shared by all devices): shown first in the filters and as quick chips above the recipes.
function pinnedTags() { const v = pref('pinnedTags', []); return Array.isArray(v) ? v : []; }
function isPinned(tg) { return pinnedTags().includes(tg); }
function togglePin(tg) {
  const pins = pinnedTags();
  setPref('pinnedTags', pins.includes(tg) ? pins.filter((x) => x !== tg) : [...pins, tg]);
  changed();
}
function renamePin(from, to) {
  const pins = pinnedTags();
  if (pins.includes(from)) setPref('pinnedTags', [...new Set(pins.map((x) => (x === from ? to : x)))]);
}
function unpin(tg) { if (isPinned(tg)) setPref('pinnedTags', pinnedTags().filter((x) => x !== tg)); }

function chip(label, action, value, on, extra = '') {
  return `<button type="button" class="chip ${on ? 'on' : ''}" data-action="${action}" data-value="${esc(value)}">${esc(label)}${extra}</button>`;
}

const DIET_TAGS = ['veg', 'vegan', 'meat', 'fish'];
const TAGS_SHOWN = 8;

function filterPanel() {
  const f = filters();
  const tags = allTags();
  const editing = ui.pinEdit;
  const pins = pinnedTags();
  const tagChip = ([tg, n]) => editing
    ? `<button type="button" class="chip pin-chip ${pins.includes(tg) ? 'on' : ''}" data-action="pin-toggle" data-value="${esc(tg)}" aria-pressed="${pins.includes(tg)}">${pins.includes(tg) ? '📌 ' : ''}${esc(tagLabel(tg))}</button>`
    : chip(tagLabel(tg), 'f-tag', tg, f.tags.includes(tg), ` <small>${n}</small>`);
  const pinned = pins.map((tg) => tags.find((x) => x[0] === tg)).filter(Boolean);
  const rest = editing ? tags : tags.filter(([tg]) => !pins.includes(tg));
  const kind = (tg) => {
    const id = tg.startsWith('auto:') ? tg.slice(5) : null;
    if (id && COURSE_TAGS.includes(id)) return 'course';
    if (id && DIET_TAGS.includes(id)) return 'diet';
    if (id && isOriginTag(id)) return 'origin';
    return 'other';
  };
  const byKind = (k) => rest.filter(([tg]) => kind(tg) === k);
  const other = byKind('other');
  // keep selected tags visible even when the list is collapsed
  const otherShown = ui.allTags ? other : other.filter(([tg], i) => i < TAGS_SHOWN || f.tags.includes(tg));
  const group = (label, list, extra = '') => (list.length ? `<div class="f-group"><div class="f-sub">${esc(label)}</div><div class="f-chips">${list.map(tagChip).join('')}${extra}</div></div>` : '');
  const sec = (label, chips) => `<section class="f-sec"><h4 class="f-head">${esc(label)}</h4><div class="f-chips">${chips}</div></section>`;
  return `<div class="filter-panel ${editing ? 'pin-editing' : ''}">
    <section class="f-sec">
      <div class="f-head-row">
        <h4 class="f-head">${esc(t('tags'))}</h4>
        ${tags.length ? `<button type="button" class="link-btn" data-action="pin-edit" aria-pressed="${Boolean(editing)}">${editing ? `✓ ${esc(t('done'))}` : `📌 ${esc(t('pinTags'))}`}</button>` : ''}
      </div>
      ${editing ? `<p class="hint small">${esc(t('pinHint'))}</p>` : ''}
      ${!tags.length ? `<small class="hint">${esc(t('noTagsYet'))}</small>` : ''}
      ${!editing && pinned.length ? `<div class="f-group pinned"><div class="f-sub">📌 ${esc(t('pinnedTags'))}</div><div class="f-chips">${pinned.map(tagChip).join('')}</div></div>` : ''}
      ${group(t('tagGroupCourse'), byKind('course'))}
      ${group(t('tagGroupDiet'), byKind('diet'))}
      ${group(t('tagGroupOrigin'), [...byKind('origin')].sort(([a], [b]) => (b.includes('cont_') - a.includes('cont_'))))}
      ${group(t('tagGroupOther'), otherShown, other.length > otherShown.length
        ? `<button type="button" class="chip more" data-action="tags-more">+ ${esc(t('moreN', other.length - otherShown.length))}</button>`
        : ui.allTags && other.length > TAGS_SHOWN ? `<button type="button" class="chip more" data-action="tags-more">${esc(t('showLess'))}</button>` : '')}
    </section>
    ${editing ? '' : `
    ${sec(t('sourceLabel'), [['web', `🌐 ${t('srcWeb')}`], ['book', `📖 ${t('srcBook')}`], ['note', `✍️ ${t('srcNote')}`]].map(([v, l]) => chip(l, 'f-source', v, f.source === v)).join(''))}
    ${sec(t('time'), `<div class="f-group"><div class="f-sub">⏱ ${esc(t('totalTimeLabel'))}</div><div class="f-chips">${[15, 30, 60].map((m) => chip(`≤ ${m} min`, 'f-time', m, f.maxTime === m)).join('')}</div></div>
      <div class="f-group"><div class="f-sub">🔪 ${esc(t('activeTimeLabel'))}</div><div class="f-chips">${[10, 20, 30].map((m) => chip(`≤ ${m} min`, 'f-active', m, f.maxActive === m)).join('')}</div></div>`)}
    ${sec(`${t('nutrition')} · ${t('perPerson')}`, `<div class="f-group"><div class="f-sub">🔥 ${esc(t('calories'))}</div><div class="f-chips">${[400, 600, 800].map((k) => chip(`≤ ${k} kcal`, 'f-kcal', k, f.maxKcal === k)).join('')}</div></div>
      <div class="f-group"><div class="f-sub">💪 ${esc(t('protein'))}</div><div class="f-chips">${[15, 25, 35].map((g) => chip(`≥ ${g} g`, 'f-prot', g, f.minProt === g)).join('')}</div></div>`)}
    ${sec(t('tabPantry'), chip(t('readyNow'), 'f-ready', 'all', f.ready === 'all') + chip(t('missingAtMost2'), 'f-ready', 'two', f.ready === 'two'))}
    ${filterCount() ? `<div class="f-foot"><button type="button" class="btn small ghost" data-action="f-clear">✕ ${esc(t('clearFilters'))}</button></div>` : ''}`}
  </div>`;
}

function expiringIds() { return new Set(expiringItems().map((x) => x.p.id)); }

function cardsHtml() {
  const filtering = Boolean(normalizeName(ui.search)) || filterCount() > 0;
  const { list, coverage } = recipeList();
  const head = filtering ? `<p class="result-count">${esc(t('nRecipes', list.length))}</p>` : '';
  return (filtering ? '' : folderTiles(childFolders(currentFolderId()))) + head + recipeCards(list, coverage, filtering);
}

function recipeList() {
  const q = normalizeName(ui.search);
  const f = filters();
  const filtering = Boolean(q) || filterCount() > 0;
  const folderId = currentFolderId();
  const needCoverage = f.ready || sortKey() === 'pantry';
  const pantry = live('pantry');
  const exp = expiringIds();
  const coverage = new Map();
  const cov = (r) => { if (!coverage.has(r.id)) coverage.set(r.id, pantryCoverage(r, pantry, { basics: state.settings.basics !== false, expiringIds: exp, servings: globalPeople() || undefined })); return coverage.get(r.id); };
  // Searching or filtering looks through every folder; otherwise show this folder's recipes.
  let list = live('recipes').filter((r) => {
    if (!filtering) return recipeFolderId(r) === folderId;
    if (q && !(normalizeName(r.title).includes(q) || normalizeName(r.source?.book).includes(q)
      || tagsOf(r, tagDefs()).some((tg) => normalizeName(tagLabel(tg)).includes(q))
      || ingredientsOf(r).some((i) => normalizeName(i.name).includes(q)))) return false;
    if (f.tags.length) { const tg = tagsOf(r, tagDefs()); if (!f.tags.every((x) => tg.includes(x))) return false; }
    if (f.source && (r.source?.type || 'web') !== f.source) return false;
    if (f.maxTime && timesOf(r).total > f.maxTime) return false;
    if (f.maxActive && timesOf(r).active > f.maxActive) return false;
    if (f.maxKcal || f.minProt) {
      const nu = nutritionOf(r);
      if (!nu) return false;
      if (f.maxKcal && nu.perServing.kcal > f.maxKcal) return false;
      if (f.minProt && nu.perServing.protein < f.minProt) return false;
    }
    if (f.ready) { const c = cov(r); if (!c.total || c.missing.length > (f.ready === 'all' ? 0 : 2)) return false; }
    return true;
  });
  const title = (r) => String(r.title || '');
  const sorters = {
    new: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
    old: (a, b) => (a.createdAt || 0) - (b.createdAt || 0),
    az: (a, b) => title(a).localeCompare(title(b), getLang()),
    za: (a, b) => title(b).localeCompare(title(a), getLang()),
    quick: (a, b) => (timesOf(a).total || 1e9) - (timesOf(b).total || 1e9),
    active: (a, b) => (timesOf(a).active || 1e9) - (timesOf(b).active || 1e9) || (timesOf(a).total - timesOf(b).total),
    fewest: (a, b) => (a.ingredients || []).length - (b.ingredients || []).length,
    kcal: (a, b) => (nutritionOf(a)?.perServing.kcal ?? Infinity) - (nutritionOf(b)?.perServing.kcal ?? Infinity) || title(a).localeCompare(title(b)),
    protein: (a, b) => (nutritionOf(b)?.perServing.protein ?? -1) - (nutritionOf(a)?.perServing.protein ?? -1) || title(a).localeCompare(title(b)),
    cooked: (a, b) => (b.cookedCount || 0) - (a.cookedCount || 0) || title(a).localeCompare(title(b)),
    recent: (a, b) => (b.lastCooked || 0) - (a.lastCooked || 0) || title(a).localeCompare(title(b)),
  };
  if (sortKey() === 'pantry') {
    const ranked = rankByPantry(list, pantry, { basics: state.settings.basics !== false, expiringIds: exp, servings: globalPeople() || undefined });
    for (const x of ranked) coverage.set(x.r.id, x.c);
    const rankedIds = new Set(ranked.map((x) => x.r.id));
    list = [...ranked.map((x) => x.r), ...list.filter((r) => !rankedIds.has(r.id))];
  } else {
    list.sort(sorters[sortKey()]);
  }
  if (needCoverage) for (const r of list) cov(r);
  return { list, coverage };
}

function coverageBadge(c) {
  if (!c || !c.total) return '';
  if (!c.missing.length) return `<span class="have-all">✓ ${esc(t('haveAll'))}</span>`;
  return `<span class="missing">${esc(t('missingN', c.missing.length))}</span>`;
}

function recipeCards(list, coverage, filtering) {
  const folderId = currentFolderId();
  if (!list.length) {
    if (filtering) return `<p class="empty">${esc(t('noMatches'))}</p>`;
    if (folderId) return childFolders(folderId).length ? '' : `<p class="empty">${esc(t('folderEmpty'))}</p>`;
    return live('recipes').length || childFolders(null).length ? '' : `<p class="empty">${esc(t('noRecipes'))}</p>`;
  }
  return `<div class="cards">${list.map((r) => {
    const tags = tagsOf(r, tagDefs()).slice(0, 3);
    return `
    <a class="card" href="#/recipe/${encodeURIComponent(r.id)}">
      <div class="thumb">${photoTag(coverOf(r), { fallback: r.image })}<span>${esc((r.title || '?').charAt(0))}</span></div>
      <div class="card-body">
        <div class="card-title">${esc(r.title)}</div>
        <div class="card-meta">${sourceIcon(r)}${esc(t('people', servingsFor(r)))}${timesOf(r).total ? ` · ⏱ ${timesOf(r).estimated ? '≈' : ''}${esc(fmtMin(timesOf(r).total))}` : ''}</div>
        ${cardNutrition(r)}
        ${coverage.has(r.id) ? `<div class="card-meta">${coverageBadge(coverage.get(r.id))}</div>` : ''}
        ${tags.length ? `<div class="card-tags">${tags.map((tg) => `<span class="tag ${tg.startsWith('auto:') ? 'auto' : ''}">${esc(tagLabel(tg))}</span>`).join('')}</div>` : ''}
        ${filtering && recipeFolderId(r) ? `<div class="card-meta">📁 ${esc(folderPath(r.folderId).map((x) => x.name).join(' › '))}</div>` : ''}
      </div>
    </a>`;
  }).join('')}</div>`;
}


// ---------- times: active work and waiting ----------

const timesCache = new Map();
function timesOf(r) {
  const key = `${r.id}|${r.updatedAt || ''}`;
  if (!timesCache.has(key)) { if (timesCache.size > 3000) timesCache.clear(); timesCache.set(key, recipeTimes(r)); }
  return timesCache.get(key);
}
const fmtMin = (m) => formatMinutes(m, { day: t('dayShort') });

function timesLine(r) {
  const tm = timesOf(r);
  if (!tm.total) return '';
  const est = tm.estimated ? '≈ ' : '';
  return `<span class="times" title="${esc(tm.estimated ? t('timesEstimated') : t('timesFromRecipe'))}">⏱ ${est}${esc(fmtMin(tm.total))}
    <small>🔪 ${esc(fmtMin(tm.active))} ${esc(t('activeTime'))}${tm.waiting ? ` · ⏳ ${esc(fmtMin(tm.waiting))} ${esc(t('waitTime'))}` : ''}${tm.estimated ? ` · ${esc(t('estimateShort'))}` : ''}</small></span>`;
}

// ---------- calories and protein ----------

const kcalText = (x) => `${Math.round(x).toLocaleString(getLang())}`;
const protText = (x) => (x < 10 ? Math.round(x * 10) / 10 : Math.round(x)).toLocaleString(getLang());

function nutritionBox(r, n) {
  const nu = nutritionOf(r);
  if (!nu) return `<p class="hint small nutri-none">🔥 ${esc(t('nutriNone'))}</p>`;
  const base = nu.servings;
  const f = n / base;
  return `<section class="nutri" id="nutri" aria-label="${esc(t('nutrition'))}">
    <div class="nutri-main">
      <span class="nutri-kcal"><strong>${nu.stated ? '' : '≈ '}${kcalText(nu.perServing.kcal)}</strong> kcal</span>
      <span class="nutri-prot"><strong>${protText(nu.perServing.protein)} g</strong> ${esc(t('protein'))}</span>
      <small>${esc(t('perPerson'))}${nu.stated ? ` · ${esc(t(r.source?.type === 'book' ? 'nutriFromBook' : 'nutriFromSource'))}` : ''}</small>
    </div>
    <div class="nutri-total">${esc(t('nutriTotal', n))}: <strong>${kcalText(nu.kcal * f)} kcal</strong> · <strong>${protText(nu.protein * f)} g</strong> ${esc(t('protein'))}</div>
    ${nu.partial ? `<p class="hint small warn">${esc(t('nutriPartial', nu.unknown.join(', ')))}</p>` : ''}
    ${nu.stated ? '' : `<details class="nutri-details"><summary>${esc(t('nutriHow'))}</summary>
      <ul>${nu.items.map((i) => `<li><span>${esc(i.name)}</span><small>${esc(qtyText(Math.round(i.grams * f), 'g'))}</small><span>${kcalText(i.kcal * f)} kcal</span><span>${protText(i.protein * f)} g</span></li>`).join('')}</ul>
      <p class="hint small">${esc(t('nutriExplain'))}${nu.skipped ? ` ${esc(t('nutriSkipped', nu.skipped))}` : ''}</p>
    </details>`}
  </section>`;
}

function nutritionPreview(servings, text) {
  const ingredients = String(text || '').split('\n').map((x) => x.trim()).filter(Boolean).map((raw) => parseIngredient(raw));
  const nu = estimateNutrition({ servings: Math.max(1, Number(servings) || 4), ingredients });
  if (!nu) return `🔥 ${esc(t('nutriNone'))}`;
  return `🔥 ≈ <strong>${kcalText(nu.perServing.kcal)} kcal</strong> · <strong>${protText(nu.perServing.protein)} g</strong> ${esc(t('protein'))} ${esc(t('perPerson'))}${nu.partial ? ` <small class="warn">(${esc(t('nutriUnknownShort', nu.unknown.length))})</small>` : ''}`;
}

function cardNutrition(r) {
  const nu = nutritionOf(r);
  if (!nu) return '';
  return `<div class="card-nutri" title="${esc(t('perPerson'))}">🔥 ${kcalText(nu.perServing.kcal)} kcal · 💪 ${protText(nu.perServing.protein)} g</div>`;
}

// ---------- what can I cook? ----------

const SUGGEST_SORTS = ['have', 'expiring'];
function suggestSort() { return SUGGEST_SORTS.includes(state.settings.suggestSort) ? state.settings.suggestSort : 'have'; }

function suggestions(by = suggestSort()) {
  return rankByPantry(live('recipes'), live('pantry'), {
    basics: state.settings.basics !== false, expiringIds: expiringIds(), by, daysLeft: (p) => daysUntil(p.expires), servings: globalPeople() || undefined,
  });
}

// pantry items with a date that this recipe would use, soonest first
function datedUses(c) {
  return c.matched.map((p) => ({ p, d: daysUntil(p.expires) })).filter((x) => x.d != null).sort((a, b) => a.d - b.d);
}

function missingText(m) {
  if (m.have > 0 && m.need != null) return `${m.name} (${t('haveOf', qtyText(m.have, m.unit), qtyText(m.need, m.unit))})`;
  return m.name;
}

function viewSuggest() {
  const pantryEmpty = !live('pantry').some((p) => (num(p.qty) || 0) > 0);
  const by = suggestSort();
  const ranked = pantryEmpty ? [] : suggestions(by).slice(0, 40);
  const expSoon = new Map(expiringItems().map((x) => [x.p.id, x.d]));
  const noDates = by === 'expiring' && !pantryEmpty && !live('pantry').some((p) => p.expires && (num(p.qty) || 0) > 0);
  let divider = false;
  const item = ({ r, c }) => {
    let head = '';
    if (by === 'expiring' && c.soonest == null && !divider) { divider = true; head = `<li class="s-divider">${esc(t('noDatedIngredients'))}</li>`; }
    const dated = by === 'expiring' ? datedUses(c).slice(0, 4) : [];
    return `${head}
    <li>
      <a class="s-main" href="#/recipe/${encodeURIComponent(r.id)}">
        <span class="s-thumb">${photoTag(coverOf(r), { fallback: r.image })}<span>${esc((r.title || '?').charAt(0))}</span></span>
        <span class="s-text">
          <strong>${esc(r.title)}</strong>
          <span class="s-meter" title="${esc(t('haveShare', c.have.length, c.total))}"><span style="width:${Math.round(c.ratio * 100)}%"></span></span>
          ${c.missing.length ? `<span class="missing">${esc(t('missingN', c.missing.length))}: ${esc(c.missing.map(missingText).join(', '))}</span>`
            : `<span class="have-all">✓ ${esc(t('haveAll'))}</span>`}
          ${dated.length ? `<span class="uses">⏳ ${esc(dated.map((x) => `${x.p.name} (${expiryText(x.d)})`).join(', '))}</span>`
            : c.uses.length ? `<span class="uses">♻️ ${esc(t('usesExpiring'))}: ${esc(c.uses.map((p) => `${p.name} (${expiryText(expSoon.get(p.id) ?? 0)})`).join(', '))}</span>` : ''}
        </span>
      </a>
      ${c.missing.length ? `<button class="btn small" data-action="add-missing" data-id="${esc(r.id)}">🛒 ${esc(t('addMissing'))}</button>` : ''}
    </li>`;
  };
  return `
  <a class="back" href="#/recipes">← ${esc(t('allRecipes'))}</a>
  <h1>🍳 ${esc(t('whatToCook'))}</h1>
  <div class="seg" role="radiogroup" aria-label="${esc(t('sortBy'))}">
    ${SUGGEST_SORTS.map((k) => `<button type="button" role="radio" aria-checked="${k === by}" class="${k === by ? 'on' : ''}" data-action="suggest-sort" data-value="${k}">${esc(t(`suggest_${k}`))}</button>`).join('')}
  </div>
  <p class="hint">${esc(t(`suggestHint_${by}`))}${globalPeople() ? ` ${esc(t('suggestForPeople', globalPeople()))}` : ''}</p>
  <label class="check"><input type="checkbox" id="basics" ${state.settings.basics !== false ? 'checked' : ''}> ${esc(t('basicsAlways'))}</label>
  ${onlineSection()}
  <h2>📒 ${esc(t('fromYourRecipes'))}</h2>
  ${noDates ? `<p class="hint warn">${esc(t('noExpiryDates'))}</p>` : ''}
  ${pantryEmpty ? `<p class="empty">${esc(t('pantryEmptyForSuggest'))}<br><a class="btn" href="#/pantry">${esc(t('tabPantry'))}</a></p>` : ''}
  ${!pantryEmpty && !ranked.length ? `<p class="empty">${esc(t('noRecipes'))}</p>` : ''}
  <ul class="suggest">${ranked.map(item).join('')}</ul>`;
}

function addMissingToList(id) {
  const r = get('recipes', id);
  if (!r) return;
  const c = pantryCoverage(r, live('pantry'), { basics: state.settings.basics !== false, servings: globalPeople() || undefined });
  for (const m of c.missing) addToShopping({ name: m.name, qty: m.short == null ? null : round(m.short), unit: m.unit }, r.title);
  changed();
  toast(t('addedToList', c.missing.length));
}

// Folder cover: chosen photo, otherwise the newest recipe photo inside the folder.
function folderCover(f) {
  if (f.cover) return f.cover;
  const ids = descendantIds(f.id);
  const r = live('recipes').filter((x) => ids.has(recipeFolderId(x)) && coverOf(x)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  return r ? coverOf(r) : '';
}

function folderTiles(folders) {
  if (!folders.length) return '';
  return `<div class="folders">${folders.map((f) => {
    const cover = folderCover(f);
    return `
    <a class="folder-card" href="${folderHref(f.id)}">
      <div class="f-thumb">${cover ? photoTag(cover) : ''}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></div>
      <div class="f-body"><span class="folder-name">${esc(f.name)}</span><small>${esc(t('nRecipes', countIn(f.id)))}</small></div>
      <button type="button" class="f-menu" data-action="folder-edit" data-id="${esc(f.id)}" aria-label="${esc(t('editFolder'))}">⋯</button>
    </a>`;
  }).join('')}</div>`;
}

function sourceIcon(r) {
  if (r.source?.type === 'book') return '<span class="src-ico" title="book">📖</span> ';
  if (r.source?.type === 'note') return '<span class="src-ico" title="note">✍️</span> ';
  return '';
}

function sourceLabel(src) {
  if (!src) return '';
  if (src.type === 'book') return `📖 ${src.book || t('fromBook')}${src.page ? `, ${t('pageShort')} ${src.page}` : ''}`;
  if (src.type === 'note') return `✍️ ${t('fromNote')}`;
  return '';
}

const PHOTO_ERRORS = { no_text: 'errNoText', not_a_recipe: 'errNotRecipe', ocr_unavailable: 'errOcr' };

const BOOK_ERRORS = { no_recipes_found: 'errBookNoRecipes', no_text: 'errBookNoText', unsupported_format: 'errBookFormat', job_failed: 'errBookJob' };

function bookItem(q) {
  const name = q.bookTitle || q.book || q.file?.split('/').pop() || '';
  if (q.status === 'done') {
    return `<div class="queue done book">
      <div class="q-main"><span class="q-book">📚</span><div><strong>${esc(t('bookDone', q.count || 0))}</strong><br><small>${esc(name)}</small></div></div>
      <div class="actions">
        ${q.bookFolder && folderOf(q.bookFolder) ? `<button class="btn small primary" data-action="open-book" data-id="${esc(q.bookFolder)}">${esc(t('openFolder'))}</button>` : ''}
        <button class="btn small ghost" data-action="q-remove" data-id="${esc(q.id)}">${esc(t('ok'))}</button>
      </div></div>`;
  }
  if (q.status === 'error') {
    return `<div class="queue error book">
      <div class="q-main"><span class="q-book">📚</span><div><strong>${esc(t(BOOK_ERRORS[q.error] || 'errBook'))}</strong><br><small>${esc(name)}</small></div></div>
      <div class="actions">
        <button class="btn small" data-action="q-retry" data-id="${esc(q.id)}">${esc(t('retry'))}</button>
        <button class="btn small ghost" data-action="q-remove" data-id="${esc(q.id)}">${esc(t('remove'))}</button>
      </div></div>`;
  }
  const waiting = !isConfigured() || !navigator.onLine || state.meta.dirty;
  const pr = q.progress && q.progress.pages ? q.progress : null;
  const pct = pr ? Math.min(100, Math.round((pr.page / pr.pages) * 100)) : 0;
  return `<div class="queue pending book">
    <div class="q-main"><span class="q-book">📚</span><div><span class="spinner"></span> ${esc(t(waiting ? 'bookUploading' : 'bookReading'))}<br><small>${esc(name)}</small>
      ${pr && !waiting ? `<div class="book-progress"><progress max="100" value="${pct}" aria-label="${esc(t('bookProgress', pr.page, pr.pages))}"></progress><small>${esc(t('bookProgress', pr.page, pr.pages))}</small></div>` : ''}
      <small class="hint">${esc(t('bookReadingHint'))}</small></div></div>
    <div class="actions"><button class="btn small ghost" data-action="q-remove" data-id="${esc(q.id)}">${esc(t('remove'))}</button></div></div>`;
}

function queueItem(q) {
  if (q.type === 'book') return bookItem(q);
  let host = q.url;
  try { host = new URL(q.url).hostname.replace(/^www\./, ''); } catch { /* keep url */ }
  const isPhoto = q.type === 'photo';
  const thumb = isPhoto && q.scans?.[0] ? `<span class="q-thumb">${photoTag(q.scans[0])}</span>` : '';
  if (isPhoto) host = sourceLabel({ type: q.kind, book: q.book, page: q.page });
  if (q.status === 'error') {
    const why = isPhoto ? t(PHOTO_ERRORS[q.error] || 'photoFailed') : t('importFailed');
    return `<div class="queue error">
      <div class="q-main">${thumb}<div><strong>${esc(why)}</strong><br><small>${esc(host)}</small></div></div>
      <div class="actions">
        <button class="btn small" data-action="q-retry" data-id="${esc(q.id)}">${esc(t('retry'))}</button>
        <button class="btn small" data-action="q-manual" data-id="${esc(q.id)}">${esc(t('addManually'))}</button>
        <button class="btn small ghost" data-action="q-remove" data-id="${esc(q.id)}">${esc(t('remove'))}</button>
      </div></div>`;
  }
  const msg = isConfigured() && navigator.onLine && !state.meta.dirty ? t(isPhoto ? 'readingPhoto' : 'importing') : t('importQueuedOffline');
  return `<div class="queue pending">
    <div class="q-main">${thumb}<div><span class="spinner"></span> ${esc(msg)}<br><small>${esc(host)}</small></div></div>
    <div class="actions"><button class="btn small ghost" data-action="q-remove" data-id="${esc(q.id)}">${esc(t('remove'))}</button></div></div>`;
}

function viewRecipe(id) {
  const r = get('recipes', id);
  if (!r) return `<p class="empty">${esc(t('notFound'))}</p><a class="btn" href="#/recipes">${esc(t('back'))}</a>`;
  const base = r.servings || 4;
  const n = servingsFor(r);
  const ings = ingredientsOf(r);
  return `
  <a class="back" href="${folderHref(recipeFolderId(r))}">← ${esc(recipeFolderId(r) ? folderOf(r.folderId).name : t('allRecipes'))}</a>
  ${coverOf(r) ? `<div class="hero">${photoTag(coverOf(r), { fallback: r.image })}</div>` : ''}
  ${r.imageCredit && coverOf(r) === (r.imageCredit.photo || (r.photos || [])[0]) ? `<p class="credit">${esc(t('photoBy'))} <a href="${esc(r.imageCredit.url)}" target="_blank" rel="noopener">${esc([r.imageCredit.creator, r.imageCredit.license].filter(Boolean).join(', ') || r.imageCredit.title || '↗')}</a></p>` : ''}
  ${(r.photos || []).length > 1 ? `<div class="gallery">${r.photos.slice(1).map((p) => `<button class="shot" data-action="view-photo" data-src="${esc(p)}">${photoTag(p)}</button>`).join('')}</div>` : ''}
  <h1>${esc(r.title)}</h1>
  <div class="meta-line">
    ${sourceLabel(r.source) ? `<span class="src">${esc(sourceLabel(r.source))}</span>` : ''}
    ${timesLine(r)}
    ${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(t('source'))} ↗</a>` : ''}
  </div>
  ${r.review ? `<div class="review"><span>${esc(t('reviewBanner'))}</span><a class="btn small primary" href="#/edit/${encodeURIComponent(id)}">${esc(t('reviewCheck'))}</a></div>` : ''}
  <div class="tag-row">
    ${tagsOf(r, tagDefs()).map((tg) => `<span class="tag ${tg.startsWith('auto:') ? 'auto' : ''}">${esc(tagLabel(tg))}<button type="button" class="tag-x" data-action="tag-remove" data-id="${esc(id)}" data-value="${esc(tg)}" aria-label="${esc(t('remove'))}">×</button></span>`).join('')}
    <form class="tag-form" id="tag-form" data-id="${esc(id)}"><input name="tag" id="tag-input" list="all-tags" placeholder="+ ${esc(t('addTag'))}" autocomplete="off" maxlength="30"></form>
    <datalist id="all-tags">${[...new Set(live('recipes').flatMap((x) => x.tags || []))].sort().map((tg) => `<option value="${esc(tg)}">`).join('')}</datalist>
  </div>
  <label class="move">📁 <select data-action="move-recipe" data-id="${esc(id)}" aria-label="${esc(t('folder'))}">${folderOptions(recipeFolderId(r))}</select></label>
  <div class="servings">
    <button class="round" data-action="srv-dec" data-id="${esc(id)}" aria-label="−">−</button>
    <span>${esc(t('people', n))}</span>
    <button class="round" data-action="srv-inc" data-id="${esc(id)}" aria-label="+">+</button>
  </div>
  ${n !== base ? `<p class="hint small srv-note">${esc(t('scaledFrom', base))}${ui.servings[id] ? ` · <button type="button" class="link-btn" data-action="srv-reset" data-id="${esc(id)}">${esc(t('reset'))}</button>` : ''}</p>` : ''}
  ${nutritionBox(r, n)}
  <h2>${esc(t('ingredients'))}</h2>
  <ul class="ingredients">
    ${ings.map((i) => {
      const q = qtyText(scaleQty(i.qty, base, n), i.unit);
      return `<li><span class="q">${esc(q)}</span><span>${esc(i.name)}${i.note ? ` <small>${esc(i.note)}</small>` : ''}</span></li>`;
    }).join('')}
  </ul>
  <div class="button-row">
    <button class="btn primary" data-action="to-list" data-id="${esc(id)}">🛒 ${esc(t('addToList'))}</button>
    <button class="btn" data-action="cooked" data-id="${esc(id)}">✓ ${esc(t('cooked'))}</button>
  </div>
  ${(r.steps || []).length ? `<h2>${esc(t('steps'))}</h2><ol class="steps">${r.steps.map((s) => (/^[^.!?:]{3,60}:$/.test(s.trim()) ? `<li class="step-head">${esc(s)}</li>` : `<li>${esc(s)}</li>`)).join('')}</ol>` : ''}
  ${r.notes ? `<h2>${esc(t('notes'))}</h2><p class="notes">${esc(r.notes)}</p>` : ''}
  ${(r.sourcePhotos || []).length ? `<h2>${esc(t(r.source?.type === 'book' ? 'originalPage' : 'originalNote'))}</h2>
    <div class="gallery">${r.sourcePhotos.map((p) => `<button class="shot page" data-action="view-photo" data-src="${esc(p)}">${photoTag(p)}</button>`).join('')}</div>` : ''}
  <div class="button-row subtle">
    <a class="btn" href="#/edit/${encodeURIComponent(id)}">${esc(t('edit'))}</a>
    <button class="btn danger" data-action="delete-recipe" data-id="${esc(id)}">${esc(t('delete'))}</button>
  </div>`;
}

function photoStrip() {
  const photos = ui.edit?.photos || [];
  return `${photos.map((p, i) => `<div class="shot">
      ${photoTag(p)}
      ${i === 0 ? `<span class="badge cover">${esc(t('cover'))}</span>` : `<button type="button" class="mini" data-action="photo-cover" data-i="${i}">${esc(t('makeCover'))}</button>`}
      <button type="button" class="mini x" data-action="photo-remove" data-i="${i}" aria-label="${esc(t('remove'))}">×</button>
    </div>`).join('')}
    <label class="shot add">
      <input type="file" accept="image/*" multiple id="photo-input" hidden>
      <span>＋<br>${esc(t('addPhoto'))}</span>
    </label>
    ${ui.edit?.busy ? `<div class="shot busy"><span class="spinner"></span></div>` : ''}`;
}

function refreshPhotoStrip() {
  const el = $('#photo-strip');
  if (!el) return;
  el.innerHTML = photoStrip();
  hydrate(el);
}

function viewEdit(id) {
  const isNew = id === 'new';
  const r = isNew ? { title: '', url: ui.prefillUrl, servings: 4, ingredients: [], steps: [], folderId: ui.newFolder || null, ...(ui.prefillSource || {}) } : get('recipes', id);
  if (!r) return `<p class="empty">${esc(t('notFound'))}</p>`;
  if (!ui.edit || ui.edit.route !== id) {
    ui.edit = { route: id, id: isNew ? uid() : id, photos: [...(r.photos || [])], busy: false, imageCredit: r.imageCredit || null };
    if (isNew && ui.prefillSource?.findImageFor) lookForDishPhoto(ui.edit, ui.prefillSource.findImageFor, ui.prefillSource.lang);
  }
  const ingText = ingredientsOf(r).map((i) => i.raw || [formatQty(i.qty, i.unit), unitLabel(i.unit, i.qty), i.name].filter(Boolean).join(' ')).join('\n');
  return `
  <a class="back" href="${isNew ? folderHref(ui.newFolder) : `#/recipe/${encodeURIComponent(id)}`}">← ${esc(t('back'))}</a>
  <h1>${esc(t(isNew ? 'newRecipe' : 'editRecipe'))}</h1>
  ${(r.sourcePhotos || ui.prefillSource?.sourcePhotos || []).length ? `<div class="field-label">${esc(t('originalForCheck'))}</div>
    <div class="gallery">${(r.sourcePhotos || ui.prefillSource.sourcePhotos).map((p) => `<button type="button" class="shot page" data-action="view-photo" data-src="${esc(p)}">${photoTag(p)}</button>`).join('')}</div>` : ''}
  <form id="edit-form" class="form" data-id="${esc(id)}">
    <div class="field-label">${esc(t('photos'))} <button type="button" class="link-btn" data-action="photo-search">🔍 ${esc(t('searchPhotoOnline'))}</button></div>
    <div class="photo-strip" id="photo-strip">${photoStrip()}</div>
    <label>${esc(t('title'))}<input name="title" required value="${esc(r.title)}"></label>
    <label>${esc(t('folder'))}<select name="folderId">${folderOptions(recipeFolderId(r))}</select></label>
    <label>${esc(t('url'))}<input name="url" type="url" value="${esc(r.url || '')}"></label>
    <div class="source-fields ${r.source?.type === 'book' ? 'is-book' : ''}">
      <label>${esc(t('sourceLabel'))}<select name="sourceType">
        <option value="">${esc(t('srcWeb'))}</option>
        <option value="book" ${r.source?.type === 'book' ? 'selected' : ''}>📖 ${esc(t('srcBook'))}</option>
        <option value="note" ${r.source?.type === 'note' ? 'selected' : ''}>✍️ ${esc(t('srcNote'))}</option>
      </select></label>
      <div class="two book-only">
        <label>${esc(t('bookTitle'))}<input name="book" value="${esc(r.source?.book || '')}" list="books"></label>
        <label>${esc(t('page'))}<input name="page" value="${esc(r.source?.page || '')}" inputmode="numeric"></label>
      </div>
    </div>
    ${booksDatalist()}
    <div class="two">
      <label>${esc(t('servingsLabel'))}<input name="servings" type="number" min="1" step="1" value="${esc(r.servings || 4)}"></label>
      <label>${esc(t('totalTimeLabel'))}<input name="time" value="${esc(r.time || '')}" placeholder="${esc(t('timePh'))}"></label>
    </div>
    ${(() => { const est = recipeTimes({ ...r, prepMin: undefined, waitMin: undefined }); return `<div class="two times-edit">
      <label>🔪 ${esc(t('activeTimeLabel'))} <small>(min)</small><input name="prepMin" id="prep-min" type="number" min="0" step="1" inputmode="numeric" value="${Number.isFinite(r.prepMin) ? r.prepMin : ''}" placeholder="${est.active}"></label>
      <label>⏳ ${esc(t('waitTimeLabel'))} <small>(min)</small><input name="waitMin" id="wait-min" type="number" min="0" step="1" inputmode="numeric" value="${Number.isFinite(r.waitMin) ? r.waitMin : ''}" placeholder="${est.waiting}"></label>
    </div>
    <p class="hint small">${esc(t('timesEditHint'))}</p>`; })()}
    <label>${esc(t('ingredients'))}<textarea name="ingredients" rows="10" placeholder="${esc(t('ingredientsHelp'))}">${esc(ingText)}</textarea></label>
    <p class="nutri-preview" id="nutri-preview" aria-live="polite">${nutritionPreview(r.servings || 4, ingText)}</p>
    <label>${esc(t('steps'))}<textarea name="steps" rows="8" placeholder="${esc(t('stepsHelp'))}">${esc((r.steps || []).join('\n'))}</textarea></label>
    <label>${esc(t('notes'))}<textarea name="notes" rows="3">${esc(r.notes || '')}</textarea></label>
    ${(() => { const o = originOf({ ...r, cuisine: '' }); const guess = o ? (o.country ? countryName(o.country) : t(`cont_${o.continent}`)) : t('originUnknown'); return `<label>🌍 ${esc(t('originLabel'))}<input name="cuisine" value="${esc([].concat(r.cuisine || []).join(', '))}" placeholder="${esc(t('originPh', guess))}" autocomplete="off"><small>${esc(t('originHint'))}</small></label>`; })()}
    <label>${esc(t('image'))}<input name="image" type="url" value="${esc(r.image || '')}"></label>
    <button class="btn primary">${esc(t('save'))}</button>
  </form>`;
}

// ---------- shopping list: the same views, search and layout as Everyday (shoplist.js, depts.js) ----------

// The view: the device's own choice (Shops, A–Z, Newest, Oldest) or the shared one in prefs (Departments, Recipes, My order)
function hasShops() { return live('shops').length > 0; }
function listMode() { return currentMode({ local: state.settings.listModeLocal, shared: pref('listMode', 'dept'), hasShops: hasShops() }); }
function setListMode(mode) {
  const to = saveModeTarget(mode);
  saveSettings({ listModeLocal: to.local });
  if (to.shared) setPref('listMode', to.shared); // never shop / alpha / newest / oldest in the shared prefs
}

const GRIP = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>';
function grip(id, label) {
  return `<button type="button" class="drag-handle" id="${esc(id)}" aria-label="${esc(t('dragToMove', label))}" title="${esc(t('dragHint'))}">${GRIP}</button>`;
}

function shopNamesOf(i) { return itemShopIds(i).map((x) => shopById(x).name); }
function addedDay(i) {
  const ts = addedOf(i);
  if (!ts) return '';
  const d = new Date(ts); const today = new Date();
  const days = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  return days === 0 ? t('addedToday') : days === 1 ? t('addedYesterday') : d.toLocaleDateString(getLang(), { day: 'numeric', month: 'short' });
}

/** A row: ⠿, the box (in the cart), the item (opens its dialog), ×. */
function itemRow(i, { drag = false, mode = listMode() } = {}) {
  const selecting = ui.sel && !i.checked; // choosing several items (shops for all of them at once)
  const extra = i.auto ? ` <span class="badge">${esc(t('fromPantry'))}</span>`
    : mode !== 'recipe' && (i.sources || []).length ? ` <small>${esc(i.sources.join(', '))}</small>` : '';
  const shops = mode !== 'shop' ? shopNamesOf(i) : [];
  const body = `${i.qty != null || i.unit ? `<span class="q">${esc(qtyText(i.qty, i.unit))}</span> ` : ''}${esc(i.name)}${i.note ? ` <small class="inline">(${esc(i.note)})</small>` : ''}${extra}${shops.length ? ` <span class="item-shops">🏪 ${esc(shops.join(', '))}</span>` : ''}${(mode === 'newest' || mode === 'oldest') && addedDay(i) ? ` <small>＋ ${esc(addedDay(i))}</small>` : ''}`;
  if (i.checked) {
    return `<li class="checked">
    <input type="checkbox" id="tk-${esc(i.id)}" data-action="toggle" data-id="${esc(i.id)}" checked>
    <label class="shop-main item-text" for="tk-${esc(i.id)}">${body}</label>
    <button type="button" class="icon" data-action="del-item" data-id="${esc(i.id)}" aria-label="${esc(t('remove'))}">×</button>
  </li>`;
  }
  if (selecting) {
    return `<li>
    <input type="checkbox" class="sel-box" data-action="sel" data-id="${esc(i.id)}" ${ui.sel.has(i.id) ? 'checked' : ''} aria-label="${esc(t('selectItem', i.name))}">
    <button type="button" class="shop-main" data-action="sel-row" data-id="${esc(i.id)}">${body}</button>
  </li>`;
  }
  return `<li ${drag ? `data-sort-key="${esc(i.id)}"` : ''}>
    ${drag ? grip(`h-${i.id}`, i.name) : ''}
    <input type="checkbox" data-action="toggle" data-id="${esc(i.id)}" aria-label="${esc(t('tickItem', i.name))}">
    <button type="button" class="shop-main" data-action="item-edit" data-id="${esc(i.id)}" title="${esc(t('itemEdit'))}">${body}</button>
    <button type="button" class="icon" data-action="del-item" data-id="${esc(i.id)}" aria-label="${esc(t('remove'))}">×</button>
  </li>`;
}

function recipeGroupLabel(k) { return k === '__pantry' ? `🔁 ${t('restock')}` : k === '__other' ? `🧺 ${t('otherItems')}` : `🍽 ${k}`; }

function deptOrder() { return byOrder(DEPT_IDS, pref('deptOrder', [])); }
function deptLabel(id) { return `${deptIcon(id)} ${t(`cat_${id}`)}`; }

/** Open items grouped as the list shows them: [[key, label, items, kind]] (kind 'all' = one unnamed group). */
function listGroups(open, mode = listMode()) {
  const groups = groupItems(open, mode, { deptOf, deptOrder: deptOrder(), recipeOrder: pref('recipeOrder', []), shops: shopsSorted(), lang: getLang() });
  return groups.map(({ key, kind, items }) => [key,
    kind === 'dept' ? deptLabel(key) : kind === 'recipe' ? recipeGroupLabel(key) : kind === 'shop' ? `🏪 ${shopById(key)?.name || ''}` : kind === 'anyShop' ? `🛒 ${t('anyShop')}` : '',
    items, kind]);
}

const SEARCH_ICO = '<svg class="search-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>';
const CLEAR_ICO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';

function viewList() {
  const items = live('shopping');
  const mode = listMode();
  const q = (ui.listQ || '').trim();
  const match = (i) => !q || itemMatches(i, q, shopNamesOf(i));
  const allOpen = items.filter((i) => !i.checked);
  const open = allOpen.filter(match);
  const done = items.filter((i) => i.checked && match(i)).sort(byItemOrder);
  const groups = listGroups(open, mode);
  const grouped = GROUPED_MODES.includes(mode);
  const drag = DRAG_MODES.includes(mode) && !q && !ui.sel;
  const groupHead = ([k, label, list, kind]) => `<h3 class="dept-h" ${kind === 'dept' ? `id="dept-${esc(k)}"` : ''}>${drag && kind !== 'anyShop' ? grip(`g-${mode}-${k}`, label) : ''}<span>${esc(label)}</span>${kind === 'shop' ? shopHead(k) : ''}${ui.sel ? `<button type="button" class="link-btn sel-group" data-action="sel-group" data-value="${esc(k)}">${esc(t(list.every((i) => ui.sel.has(i.id)) ? 'selectNone' : 'selectAll'))}</button>` : `<small>${list.length}</small>`}</h3>`;
  const ul = (key, list) => `<ul class="list shop" ${drag ? `data-sortable="items" data-group="${esc(key)}"` : ''}>${list.map((i) => itemRow(i, { drag, mode })).join('')}</ul>`;
  const body = grouped
    ? `<div class="groups" ${drag ? `data-sortable="groups" data-group="${mode}"` : ''}>${groups.map((g) => `
      <section class="grp" ${g[3] === 'anyShop' ? '' : `data-sort-key="${esc(g[0])}"`}>${groupHead(g)}${ul(g[0], g[2])}</section>`).join('')}</div>`
    : ul('all', groups[0]?.[2] || []);
  const nothing = q && !open.length && !done.length;
  return `
  <h1>${esc(t('tabList'))}</h1>
  <p class="hint">${esc(t('listIntro'))}</p>
  <form id="add-item" class="row">
    <input name="item" id="add-item-input" required placeholder="${esc(t('addItemPh'))}" autocomplete="off">
    <button class="btn primary" aria-label="+">+</button>
  </form>
  <div class="task-tools">
    <div class="search-box">${SEARCH_ICO}
      <input type="search" id="shop-q" value="${esc(ui.listQ || '')}" placeholder="${esc(t('searchListPh'))}" autocomplete="off" enterkeyhint="search" aria-label="${esc(t('searchListPh'))}">
      <button type="button" class="search-clear" data-action="shop-q-clear" aria-label="${esc(t('clearSearch'))}">${CLEAR_ICO}</button>
    </div>
    <label class="sort-pick">⇅ <select id="list-mode" aria-label="${esc(t('listView'))}">${availableModes(hasShops()).map((m) => `<option value="${m}" ${m === mode ? 'selected' : ''}>${esc(t(`listMode_${m}`))}</option>`).join('')}</select></label>
  </div>
  ${nothing ? `<p class="empty">${esc(t('noListMatch'))}</p>` : `
  ${open.length ? `${body}
    ${drag ? `<p class="hint small">${esc(t(grouped ? 'dragHintGroups' : 'dragHintItems'))}</p>` : ''}
    <p class="hint small">${esc(t('tapItemHint'))}</p>
    ${ui.sel ? selBar(allOpen) : `<div class="button-row">
      <button class="btn" data-action="sel-start">☑ ${esc(t('selectMany'))}</button>
      <button class="btn" data-action="share-list">${esc(t('share'))}</button>
    </div>`}` : q ? '' : `<p class="empty">${esc(t('listEmpty'))}</p>`}
  ${done.length ? `<h2>${esc(t('inCart'))} (${done.length})</h2><ul class="list shop done">${done.map((i) => itemRow(i, { mode })).join('')}</ul>
    <div class="button-row">
      <button class="btn primary" data-action="put-away">📦 ${esc(t('putAway'))}</button>
      <button class="btn" data-action="clear-checked">${esc(t('clearChecked'))}</button>
    </div>
    <p class="hint small">${esc(t('putAwayExplain'))}</p>` : ''}`}`;
}

// After a drag: save the new order of the items, or of the groups.
function onSorted({ kind, group, keys }) {
  if (kind === 'items') {
    const open = live('shopping').filter((i) => !i.checked);
    const flat = listGroups(open).flatMap(([k, , list]) => (k === group ? keys.map((id) => list.find((i) => i.id === id)).filter(Boolean) : list));
    flat.forEach((i, n) => { if (i.order !== n) upsert('shopping', { ...i, order: n }, { silent: true }); });
    changed();
  } else if (kind === 'groups') {
    if (group === 'dept') setPref('deptOrder', reorderSubset(deptOrder(), keys));
    else if (group === 'shop') {
      // dragging shop groups reorders the shops (as in Everyday)
      const ids = reorderSubset(shopsSorted().map((x) => x.id), keys.filter((k) => k !== '__any'));
      ids.forEach((sid, n) => { const sh = shopById(sid); if (sh && sh.order !== n) upsert('shops', { ...sh, order: n }, { silent: true }); });
    } else if (group === 'recipe') {
      const saved = pref('recipeOrder', []);
      setPref('recipeOrder', reorderSubset(saved, keys).slice(-200));
    }
    changed();
  } else if (kind === 'shops-settings') {
    // the order of the shops is the user's preference (Everyday reads it too)
    keys.forEach((sid, n) => { const sh = shopById(sid); if (sh && sh.order !== n) upsert('shops', { ...sh, order: n }, { silent: true }); });
    changed();
    render();
  } else if (kind === 'dept-settings') {
    setPref('deptOrder', keys);
    changed();
    render();
  }
}

function bestRowFor(productName, rows) {
  const words = (x) => normalizeName(x).split(' ').filter((w) => w.length >= 4);
  let best = -1, bestScore = 0;
  rows.forEach((r, i) => {
    if (r.barcode) return;
    let score = 0;
    if (namesMatch(r.name, productName)) score = 3;
    else if (words(productName).some((w) => words(r.name).map(singular).includes(singular(w)))) score = 1;
    if (score > bestScore) { best = i; bestScore = score; }
  });
  return best;
}

async function putAwayScan() {
  const P = ui.putaway;
  if (!P) return;
  const code = await scanBarcode($('#scanner'), tt);
  if (!code || ui.putaway !== P) return;
  const rows = P.rows;
  let idx = rows.findIndex((r) => r.barcode === code);
  if (idx >= 0) {
    // the same product again = one more pack
    const r = rows[idx];
    const add = r.packQty ? convert(r.packQty, r.packUnit || '', r.unit || '') : (r.unit ? null : 1);
    if (add != null) r.qty = round((num(r.qty) || 0) + add);
    r.include = true;
  } else {
    const known = pantryByCode(code);
    if (known) idx = rows.findIndex((r) => !r.barcode && (r.pantryId === known.id || normalizeName(r.name) === normalizeName(known.name) || namesMatch(r.name, known.name)));
    let product = null;
    if (!known && navigator.onLine) { try { product = await lookupProduct(code, getLang()); } catch { product = null; } }
    if (ui.putaway !== P) return;
    if (idx < 0 && product?.found) idx = bestRowFor(product.name, rows);
    if (idx >= 0) {
      const r = rows[idx];
      Object.assign(r, { barcode: code, include: true });
      if (known) r.pantryId = r.pantryId || known.id;
      if (product?.found) Object.assign(r, { brand: product.brand || '', packQty: product.qty, packUnit: product.unit, cat: product.cat || r.cat });
    } else {
      const name = known?.name || (product?.found ? product.name : t('productCode', code));
      rows.push({
        itemId: null, include: true, name, expires: '', barcode: code, pantryId: known?.id || null,
        qty: known?.packQty || (product?.found ? product.qty : 1), unit: known?.packUnit || (product?.found ? product.unit : '') || '',
        brand: product?.brand || known?.brand || '', packQty: product?.qty || known?.packQty, packUnit: product?.unit || known?.packUnit,
        cat: product?.cat || null, lookupPending: !known && !product?.found && !navigator.onLine, nameFromCode: !known && !product?.found,
      });
      idx = rows.length - 1;
    }
  }
  P.flash = idx;
  render();
  document.getElementById(`pa-expires-${idx}`)?.focus();
  toast(`🏷️ ${rows[idx].name}`);
}

function commitPutAway() {
  const P = ui.putaway;
  if (!P) return;
  let n = 0;
  for (const r of P.rows.filter((x) => x.include && x.name.trim())) {
    const tg = pantryTargetFor(r);
    const qty = num(r.qty);
    const unit = r.unit || '';
    if (tg) {
      const before = num(tg.qty) || 0;
      const wasEmpty = before <= 0;
      let newQty = before;
      let newUnit = tg.unit || '';
      if (!r.stocked && qty != null) {
        const add = convert(qty, unit, newUnit);
        if (add != null) newQty = round(before + add);
        else if (wasEmpty) { newQty = qty; newUnit = unit; }
      }
      upsert('pantry', {
        ...tg, qty: newQty, unit: newUnit,
        expires: r.expires ? (wasEmpty ? r.expires : earlier(tg.expires, r.expires)) : (wasEmpty ? null : tg.expires || null),
        ...(r.barcode ? withCode(tg, r.barcode) : {}),
        brand: tg.brand || r.brand || '', packQty: tg.packQty || r.packQty || null, packUnit: tg.packQty ? tg.packUnit : (r.packUnit || null),
        cat: tg.cat || r.cat || null,
      }, { silent: true });
    } else {
      upsert('pantry', {
        id: uid(), name: r.name.trim(), qty: qty ?? 1, unit, expires: r.expires || null, min: null, target: null,
        ...(r.barcode ? { barcode: r.barcode, barcodes: [r.barcode] } : {}), brand: r.brand || '', packQty: r.packQty || null, packUnit: r.packUnit || null,
        cat: r.cat || null, lookupPending: Boolean(r.lookupPending), nameFromCode: Boolean(r.nameFromCode),
      }, { silent: true });
    }
    if (r.itemId) remove('shopping', r.itemId);
    n++;
  }
  ui.putaway = null;
  ensureLowItems();
  location.hash = '#/pantry';
  changed();
  toast(t('putAwayDone', n));
}

// The department of a list item: its own `cat`, else the shared rules (depts.js; household and personal care too)
function shopCat(i) { return deptOf(i); }
// A new item's department: the pantry's department for things you keep, else the shared rules
function newItemCat(name) {
  const p = live('pantry').find((x) => normalizeName(x.name) === normalizeName(name));
  return p && p.cat ? categoryOf(p) : deptOf({ name });
}

function groupByDept(items, catOf) {
  const groups = new Map(deptOrder().map((c) => [c, []]));
  for (const i of items) groups.get(catOf(i)).push(i);
  return [...groups.entries()].filter(([, list]) => list.length);
}

// ---------- putting the shopping away ----------

const singular = (s) => normalizeName(s).replace(/(?:es|s|e|i)$/, '');

function pantryTargetFor(row) {
  const pantry = live('pantry');
  return (row.pantryId && get('pantry', row.pantryId))
    || (row.barcode && pantry.find((p) => hasCode(p, row.barcode)))
    || pantry.find((p) => normalizeName(p.name) === normalizeName(row.name))
    || pantry.find((p) => singular(p.name) === singular(row.name))
    || null;
}

function startPutAway() {
  const rows = live('shopping').filter((i) => i.checked).map((i) => {
    const row = { itemId: i.id, include: true, name: i.name, qty: i.qty, unit: i.unit || '', expires: '', pantryId: i.pantryId || null, stocked: Boolean(i.stocked) };
    if (row.qty == null) {
      const tg = pantryTargetFor(row);
      if (tg?.packQty) { row.qty = tg.packQty; row.unit = tg.packUnit || ''; } else { row.qty = 1; row.unit = tg?.unit || ''; }
    }
    return row;
  });
  ui.putaway = { rows, flash: -1 };
  location.hash = '#/putaway';
}

function viewPutAway() {
  const P = ui.putaway;
  if (!P) return `<a class="back" href="#/list">← ${esc(t('tabList'))}</a><p class="empty">${esc(t('putAwayEmpty'))}</p>`;
  const n = P.rows.filter((r) => r.include).length;
  return `
  <a class="back" href="#/list">← ${esc(t('tabList'))}</a>
  <h1>📦 ${esc(t('putAway'))}</h1>
  <p class="hint">${esc(t('putAwayHint'))}</p>
  <button class="btn scan-btn" type="button" data-action="pa-scan">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M7 8v8M10 8v8M12.5 8v8M15 8v8M17 8v8"/></svg>
    ${esc(t('putAwayScan'))}</button>
  <form id="putaway-form">
    <ul class="putaway">${P.rows.map((r, i) => {
      const tg = pantryTargetFor(r);
      const where = tg ? t('addsTo', tg.name, qtyText(num(tg.qty) || 0, tg.unit) || '0') : t('newIn', `${categoryIcon(r.cat || categorize(r.name))} ${t(`cat_${r.cat || categorize(r.name)}`)}`);
      return `<li class="${i === P.flash ? 'flash' : ''} ${r.include ? '' : 'off'}">
        <input type="checkbox" class="pa-inc" id="pa-include-${i}" data-pa="include" data-i="${i}" ${r.include ? 'checked' : ''} aria-label="${esc(r.name)}">
        <div class="pa-main">
          <input class="pa-name" id="pa-name-${i}" data-pa="name" data-i="${i}" value="${esc(r.name)}" aria-label="${esc(t('name'))}">
          <div class="pa-fields">
            <input class="pa-qty" id="pa-qty-${i}" data-pa="qty" data-i="${i}" inputmode="decimal" value="${esc(r.qty ?? '')}" aria-label="${esc(t('quantity'))}">
            <select id="pa-unit-${i}" data-pa="unit" data-i="${i}" aria-label="${esc(t('unit'))}">${UNITS.map((u) => `<option value="${u}" ${u === (r.unit || '') ? 'selected' : ''}>${esc(unitOptionLabel(u))}</option>`).join('')}</select>
            <label class="pa-exp"><span>${esc(t('expires'))}</span><input type="date" id="pa-expires-${i}" data-pa="expires" data-i="${i}" value="${esc(r.expires || '')}"></label>
          </div>
          <small>→ ${esc(where)}${r.barcode ? ` · 🏷️ ${esc(r.brand || r.barcode)}` : ''}${r.stocked ? ` · ${esc(t('alreadyCounted'))}` : ''}</small>
        </div>
      </li>`;
    }).join('')}</ul>
    <div class="button-row">
      <button class="btn primary" ${n ? '' : 'disabled'}>📦 ${esc(t('putAwayConfirm', n))}</button>
      <a class="btn" href="#/list">${esc(t('cancel'))}</a>
    </div>
  </form>`;
}

function pantryRow(p) {
  const low = lowInfo(p);
  const st = expiryState(p, remindDefault());
  const d = daysUntil(p.expires);
  let exp = '';
  if (st === 'expired' || st === 'soon') exp = ` <span class="badge ${st === 'expired' ? 'bad' : 'warn'}">${esc(expiryText(d))}</span>`;
  else if (st === 'ok') exp = ` <small class="exp">${esc(t('expiresOn', shortDate(p.expires)))}</small>`;
  const out = (num(p.qty) || 0) <= 0;
  return `<li class="${low || out ? 'low' : ''} ${st === 'expired' ? 'expired' : ''}">
    <button class="name" data-action="p-edit" data-id="${esc(p.id)}">${esc(p.name)}${p.brand ? ` <small>${esc(p.brand)}</small>` : ''}${p.lookupPending ? ' <span class="spinner"></span>' : ''}${out ? ` <span class="badge bad">${esc(t('outOfStock'))}</span>` : low ? ` <span class="badge warn">${esc(t('low'))}</span>` : ''}${exp}</button>
    <div class="stepper">
      <button class="round" data-action="p-dec" data-id="${esc(p.id)}" aria-label="−">−</button>
      <span class="q">${esc(qtyText(num(p.qty) || 0, p.unit) || '0')}</span>
      <button class="round" data-action="p-inc" data-id="${esc(p.id)}" aria-label="+">+</button>
    </div></li>`;
}

function viewPantry() {
  const expiring = expiringItems().map((x) => x.p);
  const isOut = (p) => (num(p.qty) || 0) <= 0;
  const rank = (p) => (isOut(p) ? 0 : lowInfo(p) ? 1 : 2);
  const depts = groupByDept(live('pantry'), categoryOf).map(([c, items]) => [c, items.sort((a, b) => rank(a) - rank(b) || normalizeName(a.name).localeCompare(normalizeName(b.name)))]);
  const counts = (items) => ({ out: items.filter(isOut).length, low: items.filter((p) => !isOut(p) && lowInfo(p)).length });
  return `
  <form id="add-pantry" class="row">
    <input name="item" id="add-pantry-input" required placeholder="${esc(t('addPantryPh'))}" autocomplete="off">
    <button class="btn primary" aria-label="+">+</button>
  </form>
  <button class="btn scan-btn" data-action="scan">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M7 8v8M10 8v8M12.5 8v8M15 8v8M17 8v8"/></svg>
    ${esc(t('scan'))}</button>
  <a class="btn suggest-link" href="#/suggest">🍳 ${esc(t('whatCanICook'))}</a>
  <p class="hint">${esc(t('pantryHint'))}</p>
  ${depts.length ? `<div class="dept-overview">${depts.map(([c, items]) => {
    const n = counts(items);
    return `<button type="button" class="dept-chip ${n.out ? 'bad' : n.low ? 'warn' : ''}" data-action="dept-jump" data-value="${c}">${categoryIcon(c)} ${esc(t(`cat_${c}`))} <small>${items.length}</small>${n.out + n.low ? ` <b>${n.out + n.low}</b>` : ''}</button>`;
  }).join('')}</div>` : ''}
  ${expiring.length ? `<h2>${esc(t('expiringTitle'))}</h2><ul class="list pantry expiring">${expiring.map(pantryRow).join('')}</ul>` : ''}
  ${depts.map(([c, items]) => {
    const n = counts(items);
    return `<section class="dept-sec" id="dept-${c}">
      <h3 class="dept-h">${categoryIcon(c)} ${esc(t(`cat_${c}`))} <small>${items.length}</small>
        ${n.out ? `<span class="badge bad">${esc(t('deptOut', n.out))}</span>` : ''}${n.low ? `<span class="badge warn">${esc(t('deptLow', n.low))}</span>` : ''}</h3>
      <ul class="list pantry">${items.map(pantryRow).join('')}</ul></section>`;
  }).join('')}
  ${!depts.length ? `<p class="empty">${esc(t('pantryEmpty'))}</p>` : ''}`;
}

// Connected = a token that worked. The token itself is never put back on screen.
function isConnected() {
  const s = state.settings;
  if (!isConfigured()) return false;
  if (['auth', 'forbidden', 'notfound'].includes(state.meta.lastError)) return false;
  return s.verified === true || Boolean(state.meta.lastSync);
}

function maskToken(tk) {
  const v = String(tk || '');
  if (!v) return '';
  return `${v.slice(0, Math.min(v.indexOf('_', 7) > 0 ? v.indexOf('_', 7) + 1 : 4, 12))}••••••${v.slice(-4)}`;
}

function viewSettings() {
  const s = state.settings;
  const last = state.meta.lastSync ? new Date(state.meta.lastSync).toLocaleString(getLang()) : t('never');
  return `
  <h1>${esc(t('tabSettings'))}</h1>
  <form class="form" id="lang-form">
    <label>${esc(t('language'))}
      <select name="lang">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${k === getLang() ? 'selected' : ''}>${v}</option>`).join('')}</select>
    </label>
  </form>
  <h2>${esc(t('sync'))}</h2>
  ${isConnected() && !ui.ghEdit ? `
  <div class="gh-card">
    <p class="conn good">✓ ${esc(t('connectedTo'))} <strong>${esc(s.owner)}/${esc(s.repo)}</strong>${s.branch && s.branch !== 'main' ? ` (${esc(s.branch)})` : ''}</p>
    <p class="hint">${esc(t('token'))}: <code>${esc(maskToken(s.token))}</code> · ${esc(t('tokenHint'))}</p>
    ${ui.connMsg && ui.connMsg.startsWith('err') ? `<p class="conn bad">${esc(t(ui.connMsg))}</p>` : ''}
    <div class="button-row">
      <button type="button" class="btn" data-action="sync-now">${esc(t('syncNow'))}</button>
      <button type="button" class="btn ghost" data-action="gh-edit">${esc(t('editConnection'))}</button>
      <button type="button" class="btn ghost danger" data-action="gh-disconnect">${esc(t('disconnect'))}</button>
    </div>
    <p class="hint">${esc(t('lastSync'))}: ${esc(last)}</p>
  </div>` : `
  <form class="form" id="gh-form">
    <div class="two">
      <label>${esc(t('owner'))}<input name="owner" value="${esc(s.owner)}" autocapitalize="off" autocomplete="off" spellcheck="false"></label>
      <label>${esc(t('repo'))}<input name="repo" value="${esc(s.repo)}" placeholder="ricette" autocapitalize="off" autocomplete="off" spellcheck="false"></label>
    </div>
    <label>${esc(t('token'))}<input name="token" type="password" value="" autocomplete="off" spellcheck="false" placeholder="${esc(s.token ? t('tokenKeep', maskToken(s.token)) : 'github_pat_…')}">
      <small>${esc(t('tokenHint'))}</small></label>
    <label>${esc(t('branch'))}<input name="branch" value="${esc(s.branch || 'main')}" autocapitalize="off"></label>
    ${ui.connMsg ? `<p class="conn ${ui.connMsg.startsWith('err') ? 'bad' : 'good'}">${esc(t(ui.connMsg))}</p>` : ''}
    <div class="button-row">
      <button class="btn primary">${esc(t('saveTest'))}</button>
      ${isConnected() ? `<button type="button" class="btn" data-action="gh-cancel">${esc(t('cancel'))}</button>` : ''}
    </div>
    <p class="hint">${esc(t('setupHelp'))}</p>
  </form>`}
  ${listSettings()}
  ${shopSettings()}
  ${onlineSettings()}
  ${tagSettings()}
  <h2>${esc(t('reminders'))}</h2>
  <form class="form" id="remind-form">
    <label>${esc(t('remindDefault'))}<input name="remindDays" type="number" min="0" step="1" inputmode="numeric" value="${esc(remindDefault())}"></label>
  </form>
  ${notifySection()}
  <h2>${esc(t('backup'))}</h2>
  <button class="btn" data-action="export">${esc(t('exportData'))}</button>
  <p class="hint">${esc(t('installHint'))}</p>`;
}


// ---------- photos from the web ----------

const PHOTO_KEYS = { pixabay: 'pixabayKey', pexels: 'pexelsKey' };
function photoKey(svc) { return String(pref(PHOTO_KEYS[svc], '') || ''); }
function photoKeys() { return { pixabay: photoKey('pixabay'), pexels: photoKey('pexels') }; }
const SRC_LABEL = { wikipedia: 'Wikipedia', pixabay: 'Pixabay', pexels: 'Pexels', openverse: 'Openverse' };

async function usePickedPhoto(edit, c, credit) {
  try {
    const res = await fetch(c.url);
    if (!res.ok) throw new Error('img');
    const blob = await res.blob();
    if (!/^image\//.test(blob.type)) throw new Error('img');
    const path = await addPhoto(edit.id, blob);
    edit.photos.unshift(path);
    edit.imageCredit = credit ? { ...credit, photo: path } : null;
    edit.pendingImage = null;
    return true;
  } catch {
    // the picture's server doesn't let apps download it: show it from its address, GitHub saves a copy
    const inp = document.querySelector('#edit-form input[name=image]');
    if (inp) inp.value = c.url;
    edit.imageCredit = credit ? { ...credit, photo: c.url } : null;
    edit.pendingImage = { url: c.url, credit, referer: credit?.url || '' };
    return false;
  }
}

function openPhotoSearch() {
  const edit = ui.edit;
  if (!edit) return;
  const form = $('#edit-form');
  const title = form?.title.value.trim() || '';
  let found = [];
  const lang = textLang(`${title} ${form?.ingredients.value || ''}`) || getLang();
  const grid = () => found.length
    ? found.map((c, i) => `<button type="button" class="pick" data-i="${i}" title="${esc(c.title || '')}"><img src="${esc(c.thumb || c.url)}" alt="" loading="lazy" referrerpolicy="no-referrer"><span class="pick-src">${SRC_LABEL[c.source] || c.source}</span></button>`).join('')
    : '';
  const draw = (state, note = '') => {
    const el = modal.querySelector('#pick-grid');
    if (!el) return;
    el.innerHTML = state === 'busy' ? `<p class="hint"><span class="spinner"></span> ${esc(t('searching'))}</p>` : (grid() || `<p class="hint">${esc(t('noPhotosFound'))}</p>`);
    modal.querySelector('#pick-note').innerHTML = note;
  };
  const search = async (q) => {
    draw('busy');
    const keys = photoKeys();
    const r = await photoCandidates(q, { lang, keys });
    found = r.list;
    const note = r.errors.includes('pixabay_key') ? `<span class="warn">${esc(t('photoKeyBad', 'Pixabay'))}</span>`
      : r.errors.includes('pexels_key') ? `<span class="warn">${esc(t('photoKeyBad', 'Pexels'))}</span>`
        : !keys.pixabay && !keys.pexels ? esc(t('pixabayHintNoKey')) : '';
    draw('ok', note);
  };
  openModal(`
    <h2>🔍 ${esc(t('searchPhotoOnline'))}</h2>
    <div class="row"><input id="pick-q" value="${esc(title)}" autocomplete="off" placeholder="${esc(t('title'))}"><button type="button" class="btn" id="pick-go">🔍 ${esc(t('searchBtn'))}</button></div>
    <div class="pick-grid" id="pick-grid"></div>
    <p class="hint small" id="pick-note"></p>
    <div class="button-row"><button class="btn" value="cancel" formnovalidate>${esc(t('cancel'))}</button></div>`, () => {});
  modal.onclick = async (e) => {
    if (e.target.closest('#pick-go')) { search(modal.querySelector('#pick-q').value.trim() || title); return; }
    const b = e.target.closest('.pick');
    if (!b) return;
    const c = found[+b.dataset.i];
    b.classList.add('busy');
    const credit = await creditFor(c);
    const stored = await usePickedPhoto(edit, c, credit);
    if (modal.open) modal.close();
    refreshPhotoStrip();
    toast(t(stored ? 'photoAdded' : 'photoLinked'));
  };
  modal.querySelector('#pick-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); search(e.target.value.trim() || title); } });
  if (navigator.onLine) search(title || '');
  else draw('ok', esc(t('offline')));
}

// ---------- recipe ideas from the web ----------

const SITE_NAMES = { mealdb: 'TheMealDB', giallozafferano: 'GialloZafferano', cucchiaio: "Il Cucchiaio d'Argento", chefkoch: 'Chefkoch', bbcgoodfood: 'BBC Good Food' };
const ALL_SITES = ['giallozafferano', 'cucchiaio', 'chefkoch', 'bbcgoodfood'];
function onlineSources() {
  const v = pref('onlineSources', null) || {};
  return { mealdb: v.mealdb !== false, github: v.github !== false, sites: Array.isArray(v.sites) ? v.sites.filter((x) => ALL_SITES.includes(x)) : [...ALL_SITES] };
}
function maxMissing() { const n = Number(pref('maxMissing', 3)); return Number.isFinite(n) && n >= 0 ? Math.round(n) : 3; }
function lastSearch() { return live('queue').filter((q) => q.type === 'search').sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))[0] || null; }

function onlineState() {
  if (!ui.online) {
    const last = lastSearch();
    const exp = expiringItems().map((x) => x.p.name);
    ui.online = { selected: last?.ingredients ? [...last.ingredients] : exp.slice(0, 3), extra: [], mealdb: null, mealdbStatus: '', showHidden: false };
  }
  return ui.online;
}

function onlineIngredientChoices() {
  const o = onlineState();
  const exp = new Set(expiringItems().map((x) => x.p.id));
  const items = live('pantry').filter((p) => (num(p.qty) || 0) > 0 && !isBasicName(p.name))
    .sort((a, b) => (exp.has(b.id) - exp.has(a.id)) || normalizeName(a.name).localeCompare(normalizeName(b.name)));
  const names = [...new Set([...items.map((p) => p.name), ...o.extra])];
  return { names, expiring: new Set(items.filter((p) => exp.has(p.id)).map((p) => p.name)) };
}

function onlineResults() {
  const o = onlineState();
  const src = onlineSources();
  const last = lastSearch();
  const site = last && last.status === 'done' && src.github ? (last.results || []).filter((r) => src.sites.includes(r.source)) : [];
  const all = [...(src.mealdb ? o.mealdb || [] : []), ...site];
  return rankOnline(all, { pantry: live('pantry'), selected: o.selected, maxMissing: maxMissing(), basics: state.settings.basics !== false });
}

function onlineCard(r) {
  const saved = live('recipes').find((x) => x.url && x.url === r.url);
  const key = esc(r.url || r.id);
  return `<li class="online-item">
    <a class="s-main" href="${esc(r.url)}" target="_blank" rel="noopener">
      <span class="s-thumb">${r.image ? `<img src="${esc(r.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}<span>${esc((r.title || '?').charAt(0))}</span></span>
      <span class="s-text">
        <strong>${esc(r.title)}</strong>
        <span class="src-badge">${esc(SITE_NAMES[r.source] || r.source)}${r.lang ? ` · ${esc(r.lang.toUpperCase())}` : ''}</span>
        ${r.usesSelected.length ? `<span class="uses">✓ ${esc(t('usesYours'))}: ${esc(r.usesSelected.join(', '))}</span>` : ''}
        ${r.c.missing.length ? `<span class="missing">${esc(t('missingN', r.c.missing.length))}: ${esc(r.c.missing.map((m) => m.name).join(', '))}</span>` : `<span class="have-all">✓ ${esc(t('haveAll'))}</span>`}
      </span>
    </a>
    ${saved ? `<a class="btn small" href="#/recipe/${encodeURIComponent(saved.id)}">✓ ${esc(t('alreadySaved'))}</a>` : `<button class="btn small primary" data-action="online-import" data-value="${key}">＋ ${esc(t('saveRecipe'))}</button>`}
  </li>`;
}

function onlineSection() {
  const o = onlineState();
  const src = onlineSources();
  const { names, expiring } = onlineIngredientChoices();
  const last = lastSearch();
  const waiting = last && last.status === 'pending';
  const anySource = src.mealdb || (src.github && src.sites.length);
  const ranked = (o.mealdb || last) ? onlineResults() : null;
  const statusLine = () => {
    const parts = [];
    if (src.mealdb && o.mealdbStatus) parts.push(`${SITE_NAMES.mealdb}: ${o.mealdbStatus === 'busy' ? '<span class="spinner"></span>' : esc(t(`os_${o.mealdbStatus}`, (o.mealdb || []).length))}`);
    if (src.github && last) {
      if (waiting) parts.push(`<span class="spinner"></span> ${esc(t(isConfigured() ? 'searchingSites' : 'searchNeedsGithub', (last.sites || []).map((k) => SITE_NAMES[k]).join(', ')))}`);
      else for (const [k, st] of Object.entries(last.siteStatus || {})) parts.push(`${esc(SITE_NAMES[k] || k)}: ${esc(t(`os_${st}`, (last.results || []).filter((r) => r.source === k).length))}`);
    }
    return parts.length ? `<p class="online-status">${parts.join(' · ')}</p>` : '';
  };
  return `<section class="online-box" id="online">
    <h2>🌐 ${esc(t('onlineIdeas'))}</h2>
    ${!anySource ? `<p class="hint">${esc(t('onlineOff'))} <a href="#/settings">${esc(t('tabSettings'))}</a></p>` : `
    <p class="hint small">${esc(t('onlinePick'))}</p>
    <div class="f-chips online-chips">${names.map((n) => `<button type="button" class="chip ${o.selected.includes(n) ? 'on' : ''}" data-action="online-toggle" data-value="${esc(n)}">${expiring.has(n) ? '⏳ ' : ''}${esc(n)}</button>`).join('')}
      <form id="online-add-form" class="chip-add"><input id="online-add" placeholder="+ ${esc(t('otherIngredient'))}" autocomplete="off"></form></div>
    <div class="button-row">
      <button type="button" class="btn primary" data-action="online-search" ${o.selected.length && navigator.onLine ? '' : 'disabled'}>✨ ${esc(t('suggestRecipes'))}</button>
      ${o.selected.length ? `<button type="button" class="btn ghost small" data-action="online-clear">${esc(t('clearSelection'))}</button>` : ''}
    </div>
    <p class="hint small">${esc(t('onlineMax', maxMissing()))} · <a href="#/settings">${esc(t('change'))}</a></p>
    ${statusLine()}
    ${ranked ? `<ul class="suggest online-list">${ranked.shown.map(onlineCard).join('')}</ul>
      ${!ranked.shown.length && !waiting && o.mealdbStatus !== 'busy' ? `<p class="empty">${esc(t('noOnlineMatch'))}</p>` : ''}
      ${ranked.hidden.length ? `<button type="button" class="btn ghost small" data-action="online-hidden">${esc(t(o.showHidden ? 'hideMoreMissing' : 'showMoreMissing', ranked.hidden.length, maxMissing()))}</button>
        ${o.showHidden ? `<ul class="suggest online-list more">${ranked.hidden.map(onlineCard).join('')}</ul>` : ''}` : ''}` : ''}`}
  </section>`;
}

async function runOnlineSearch() {
  const o = onlineState();
  const src = onlineSources();
  if (!o.selected.length) return;
  // the sites, via the GitHub job (about a minute)
  if (src.github && src.sites.length) {
    for (const q of live('queue').filter((x) => x.type === 'search')) remove('queue', q.id);
    upsert('queue', {
      id: `s${uid().slice(0, 10)}`, type: 'search', ingredients: [...o.selected], terms: searchTerms(o.selected),
      sites: src.sites, status: 'pending', addedAt: Date.now(),
    }, { silent: true });
    changed();
  }
  // TheMealDB, straight from here (a few seconds)
  if (src.mealdb) {
    o.mealdb = [];
    o.mealdbStatus = 'busy';
    render();
    try {
      o.mealdb = await mealdbSearch(o.selected);
      o.mealdbStatus = o.mealdb.length ? 'ok' : 'none';
    } catch {
      o.mealdbStatus = 'unreachable';
    }
  }
  render();
}

function saveOnlineRecipe(key) {
  const r = [...onlineResults().shown, ...onlineResults().hidden].find((x) => (x.url || x.id) === key);
  if (!r) return;
  const id = uid();
  const credit = r.image ? { title: SITE_NAMES[r.source] || r.source, creator: '', license: '', url: r.url } : null;
  upsert('recipes', {
    id, title: r.title, servings: r.servings || 4, time: r.time || '', url: r.url,
    image: r.image || '', photos: [], imageCredit: credit ? { ...credit, photo: r.image } : null,
    ingredients: (r.ingredients || []).map((raw) => parseIngredient(typeof raw === 'string' ? raw : raw.raw || '')),
    steps: r.steps || [], notes: '', cuisine: r.area && !/unknown/i.test(r.area) ? r.area : (r.cuisine || ''), source: null, folderId: folderOf(state.settings.importFolder) ? state.settings.importFolder : null,
    parsed: true, review: false, createdAt: Date.now(), photoTried: Date.now(),
  }, { silent: true });
  if (r.image && isConfigured()) {
    upsert('queue', { id: `im${uid().slice(0, 8)}`, type: 'image', recipeId: id, url: r.image, referer: r.url, credit, status: 'pending', addedAt: Date.now() }, { silent: true });
  }
  changed();
  toast(t('recipeSaved'));
}

// ---------- settings: online ----------

function keyBlock(svc) {
  const key = photoKey(svc);
  const name = SRC_LABEL[svc];
  const msg = ui.keyMsg && ui.keyMsg.svc === svc ? ui.keyMsg.r : '';
  const msgText = msg ? t(`key_${msg}`, name) : '';
  if (key && ui.keyEdit !== svc) {
    return `<div class="gh-card key-card" data-svc="${svc}">
      <p class="conn good">✓ ${esc(t('keySaved', name))} <code>${esc(maskToken(key))}</code></p>
      ${msg ? `<p class="conn ${msg === 'ok' ? 'good' : 'bad'}">${esc(msgText)}</p>` : ''}
      <div class="button-row">
        <button type="button" class="btn small" data-action="key-test" data-value="${svc}">${esc(t('test'))}</button>
        <button type="button" class="btn small ghost" data-action="key-edit" data-value="${svc}">${esc(t('change'))}</button>
        <button type="button" class="btn small ghost danger" data-action="key-remove" data-value="${svc}">${esc(t('remove'))}</button>
      </div></div>`;
  }
  return `<form class="form key-form" id="${svc}-form" data-svc="${svc}">
      <label>${esc(t(`${svc}Key`))}<input name="key" id="${svc}-key" type="password" autocomplete="off" spellcheck="false" placeholder="${esc(t('keyPh'))}"></label>
      ${msg && msg !== 'ok' ? `<p class="conn bad">${esc(msgText)}</p>` : ''}
      <div class="button-row"><button class="btn primary">${esc(t('saveTest'))}</button>${key ? `<button type="button" class="btn" data-action="key-cancel" data-value="${svc}">${esc(t('cancel'))}</button>` : ''}</div>
      ${svc === 'pixabay' ? `<details class="howto"><summary>${esc(t('pixabayHow'))}</summary><ol>
        <li>${t('pixabayStep1')}</li><li>${t('pixabayStep2')}</li><li>${esc(t('pixabayStep3', t('saveTest')))}</li>
      </ol><p class="hint small">${esc(t('keyWhere'))}</p></details>` : ''}
    </form>`;
}

function onlineSettings() {
  const src = onlineSources();
  return `
  <h2 id="online-settings">🌐 ${esc(t('onlineTitle'))}</h2>
  <div class="field-label">${esc(t('photosOnline'))}</div>
  <label class="check"><input type="checkbox" data-pref="autoPhotos" ${pref('autoPhotos', true) !== false ? 'checked' : ''}> <span>${esc(t('autoPhotos'))}<small>${esc(t('autoPhotosHint'))}</small></span></label>
  ${keyBlock('pixabay')}
  <p class="hint small">${esc(t('photoSourcesFree'))}</p>
  ${photoKey('pexels') || ui.keyEdit === 'pexels' ? keyBlock('pexels') : `<details class="howto"><summary>${esc(t('pexelsHaveKey'))}</summary>${keyBlock('pexels')}</details>`}
  <div class="field-label">${esc(t('onlineRecipes'))}</div>
  <label class="check"><input type="checkbox" data-src="mealdb" ${src.mealdb ? 'checked' : ''}> <span>TheMealDB<small>${esc(t('srcMealdbHint'))}</small></span></label>
  <label class="check"><input type="checkbox" data-src="github" ${src.github ? 'checked' : ''}> <span>${esc(t('srcSites'))}<small>${esc(t('srcSitesHint'))}</small></span></label>
  ${src.github ? `<div class="site-list">${ALL_SITES.map((k) => `<label class="check"><input type="checkbox" data-site="${k}" ${src.sites.includes(k) ? 'checked' : ''}> <span>${esc(SITE_NAMES[k])}</span></label>`).join('')}</div>` : ''}
  <label class="inline-num">${esc(t('maxMissingLabel'))} <input type="number" id="max-missing" min="0" max="20" step="1" inputmode="numeric" value="${maxMissing()}"></label>
  <p class="hint small">${esc(t('maxMissingHint'))}</p>`;
}

// ---------- shopping list settings ----------

function listSettings() {
  const mode = listMode();
  const custom = pref('deptOrder', []).length > 0;
  return `
  <h2>${esc(t('tabList'))}</h2>
  <div class="field-label">${esc(t('listView'))}</div>
  <label class="sort-pick">⇅ <select id="settings-list-mode" aria-label="${esc(t('listView'))}">${availableModes(hasShops()).map((m) => `<option value="${m}" ${m === mode ? 'selected' : ''}>${esc(t(`listMode_${m}`))}</option>`).join('')}</select></label>
  <p class="hint small">${esc(t('listViewHint'))}</p>
  <div class="field-label">${esc(t('deptOrderTitle'))}</div>
  <p class="hint small">${esc(t('deptOrderHint'))}</p>
  <ul class="dept-order" data-sortable="dept-settings">${deptOrder().map((c) => `<li data-sort-key="${esc(c)}">${grip(`d-${c}`, t(`cat_${c}`))}<span>${esc(deptLabel(c))}</span></li>`).join('')}</ul>
  ${custom ? `<button type="button" class="btn small ghost" data-action="dept-reset">↺ ${esc(t('resetOrder'))}</button>` : ''}`;
}

// ---------- shops (shared with Everyday: data/shops.json, same format) ----------

function shopsSorted() {
  return live('shops').slice().sort((a, b) => (Number.isFinite(a.order) ? a.order : 1e9) - (Number.isFinite(b.order) ? b.order : 1e9) || String(a.name).localeCompare(String(b.name)));
}
function shopById(id) { return live('shops').find((x) => x.id === id); }
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const toMin = (v) => { const m = /^(\d{1,2}):(\d{2})/.exec(v || ''); return m ? +m[1] * 60 + +m[2] : null; };
// ISO weekday 1 = Monday … 7 = Sunday (1 Jan 2024 was a Monday)
function weekdayName(d, style = 'short') { return new Date(2024, 0, d).toLocaleDateString(getLang(), { weekday: style }); }
function daysText(days) {
  const ds = [...new Set(days)].sort((a, b) => a - b);
  const runs = [];
  for (const d of ds) { const r = runs[runs.length - 1]; if (r && d === r[1] + 1) r[1] = d; else runs.push([d, d]); }
  return runs.map(([a, b]) => (a === b ? weekdayName(a) : b === a + 1 ? `${weekdayName(a)}, ${weekdayName(b)}` : `${weekdayName(a)}–${weekdayName(b)}`)).join(', ');
}
function dateText(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(getLang(), { weekday: 'short', day: 'numeric', month: 'short' });
}
/** "Mon–Fri 08:00–12:30, 15:30–19:30 · Sat 08:00–12:00" */
function hoursText(shop) {
  const rows = (shop.hours || []).filter((h) => Number.isFinite(h.from) && Number.isFinite(h.to));
  if (!rows.length) return t('shopAlwaysOpen');
  const groups = new Map();
  for (const h of rows) {
    const key = h.date ? `d:${h.date}` : `w:${[...new Set(h.days || [])].sort().join(',')}`;
    if (!groups.has(key)) groups.set(key, { label: h.date ? dateText(h.date) : daysText(h.days || []), ranges: [] });
    groups.get(key).ranges.push([h.from, h.to]);
  }
  return [...groups.values()].map((g) => `${g.label} ${g.ranges.sort((a, b) => a[0] - b[0]).map(([a, b]) => `${hhmm(a)}–${hhmm(b)}`).join(', ')}`).join(' · ');
}

function shopSettings() {
  const shops = shopsSorted();
  return `
  <h2>🏪 ${esc(t('shopsTitle'))}</h2>
  <p class="hint">${esc(t('shopsHint'))}</p>
  ${shops.length ? `<ul class="shop-list" data-sortable="shops-settings">${shops.map((sh) => `<li data-sort-key="${esc(sh.id)}">
      ${grip(`s-${sh.id}`, sh.name)}
      <div class="shop-info"><strong>${esc(sh.name)}</strong><small>${esc(hoursText(sh))}${sh.minutes ? ` · ⏱ ${esc(t('shopVisit', sh.minutes))}` : ''}</small>${sh.place ? `<small>📍 ${esc(sh.place)}</small>` : ''}</div>
      <button type="button" class="btn small ghost" data-action="shop-edit" data-id="${esc(sh.id)}" aria-label="${esc(t('shopEdit'))}">✎</button>
    </li>`).join('')}</ul><p class="hint small">${esc(t('shopsOrderHint'))}</p>` : `<p class="hint">${esc(t('shopsNone'))}</p>`}
  <button type="button" class="btn" data-action="shop-new">+ ${esc(t('shopNew'))}</button>`;
}

function hoursRowsHtml(rows) {
  return rows.map((h, i) => `<div class="hours-row" data-i="${i}">
    ${h.date != null
      ? `<label class="hours-date">${esc(t('shopOnDate'))}<input type="date" name="date${i}" value="${esc(h.date)}" required></label>`
      : `<div class="day-chips" role="group" aria-label="${esc(t('shopDays'))}">${[1, 2, 3, 4, 5, 6, 7].map((d) => `<button type="button" class="chip ${(h.days || []).includes(d) ? 'on' : ''}" data-h="day" data-i="${i}" data-d="${d}" aria-pressed="${(h.days || []).includes(d)}" title="${esc(weekdayName(d, 'long'))}">${esc(weekdayName(d, 'narrow'))}</button>`).join('')}</div>`}
    <div class="hours-times">
      <input type="time" name="from${i}" value="${Number.isFinite(h.from) ? hhmm(h.from) : ''}" required aria-label="${esc(t('shopFrom'))}">
      <span>–</span>
      <input type="time" name="to${i}" value="${Number.isFinite(h.to) ? hhmm(h.to) : ''}" required aria-label="${esc(t('shopTo'))}">
      <button type="button" class="icon" data-h="del" data-i="${i}" aria-label="${esc(t('remove'))}">×</button>
    </div>
  </div>`).join('');
}

function openShopEdit(id) {
  const existing = id ? shopById(id) : null;
  const shops = shopsSorted();
  const draft = existing ? JSON.parse(JSON.stringify(existing))
    : { id: uid(), name: '', minutes: 30, hours: [], place: '', link: '', order: shops.length ? Math.max(...shops.map((x) => x.order || 0)) + 1 : 0 };
  draft.hours ||= [];
  openModal(`
    <h2>🏪 ${esc(t(existing ? 'shopEdit' : 'shopNew'))}</h2>
    <label>${esc(t('shopName'))}<input name="name" value="${esc(draft.name)}" required autocomplete="off"></label>
    <label>${esc(t('shopMinutes'))}<input name="minutes" type="number" min="1" step="1" inputmode="numeric" value="${esc(draft.minutes ?? 30)}"></label>
    <div class="field-label">${esc(t('shopHours'))}</div>
    <p class="hint small">${esc(t('shopHoursHint'))}</p>
    <div id="shop-hours">${hoursRowsHtml(draft.hours)}</div>
    <div class="button-row">
      <button type="button" class="btn small" data-h="add-days">+ ${esc(t('shopAddDays'))}</button>
      <button type="button" class="btn small" data-h="add-date">+ ${esc(t('shopAddDate'))}</button>
    </div>
    <label>${esc(t('shopPlace'))}<input name="place" value="${esc(draft.place || '')}" autocomplete="off"></label>
    <label>${esc(t('shopLink'))}<input name="link" type="url" value="${esc(draft.link || '')}" placeholder="https://maps.app.goo.gl/…"></label>
    <div class="button-row">
      <button class="btn primary" value="ok">${esc(t('save'))}</button>
      <button class="btn" value="cancel" formnovalidate>${esc(t('cancel'))}</button>
      ${existing ? `<button class="btn danger" value="delete" formnovalidate>${esc(t('delete'))}</button>` : ''}
    </div>`, (form, action) => {
    if (action === 'delete') {
      if (!confirm(t('shopDeleteConfirm', draft.name))) return;
      remove('shops', draft.id); // items still naming it count it as gone (spec: deleted shops are ignored)
      changed();
      return;
    }
    readHours(form, draft);
    const hours = draft.hours
      .filter((h) => Number.isFinite(h.from) && Number.isFinite(h.to) && h.to > h.from && (h.date || (h.days || []).length))
      .map((h) => (h.date ? { date: h.date, from: h.from, to: h.to } : { days: [...new Set(h.days)].sort((a, b) => a - b), from: h.from, to: h.to }));
    const minutes = Math.round(Number(form.minutes.value));
    upsert('shops', {
      ...draft, name: form.name.value.trim(), minutes: minutes > 0 ? minutes : 30, hours,
      place: form.place.value.trim(), link: form.link.value.trim(),
    }, { silent: true });
    changed();
  });
  const form = modal.querySelector('form');
  const box = modal.querySelector('#shop-hours');
  const redraw = () => { readHours(form, draft); box.innerHTML = hoursRowsHtml(draft.hours); validateHours(form, draft); };
  modal.onclick = (e) => {
    const b = e.target.closest('[data-h]');
    if (!b) return;
    const i = Number(b.dataset.i);
    if (b.dataset.h === 'day') { readHours(form, draft); const ds = new Set(draft.hours[i].days || []); const d = Number(b.dataset.d); if (ds.has(d)) ds.delete(d); else ds.add(d); draft.hours[i].days = [...ds]; box.innerHTML = hoursRowsHtml(draft.hours); validateHours(form, draft); }
    else if (b.dataset.h === 'del') { readHours(form, draft); draft.hours.splice(i, 1); box.innerHTML = hoursRowsHtml(draft.hours); validateHours(form, draft); }
    else if (b.dataset.h === 'add-days') { readHours(form, draft); draft.hours.push({ days: [1, 2, 3, 4, 5], from: 480, to: 1140 }); redraw(); }
    else if (b.dataset.h === 'add-date') { readHours(form, draft); draft.hours.push({ date: todayStr(), from: 540, to: 720 }); redraw(); }
  };
  modal.oninput = () => validateHours(form, draft);
}

function readHours(form, draft) {
  draft.hours.forEach((h, i) => {
    const f = form.elements[`from${i}`]; const to = form.elements[`to${i}`]; const d = form.elements[`date${i}`];
    if (f) h.from = toMin(f.value);
    if (to) h.to = toMin(to.value);
    if (d) h.date = d.value;
  });
}
// "to" before "from", or a weekday row without days: the browser won't let the form be saved
function validateHours(form, draft) {
  draft.hours.forEach((h, i) => {
    const f = form.elements[`from${i}`]; const to = form.elements[`to${i}`];
    if (!f || !to) return;
    const a = toMin(f.value); const b = toMin(to.value);
    to.setCustomValidity(a != null && b != null && b <= a ? t('shopToAfterFrom') : '');
    if (h.date == null) f.setCustomValidity((h.days || []).length ? '' : t('shopPickDays'));
  });
}

// ---------- several items at once ----------

function selBar(open) {
  const n = [...ui.sel].filter((id) => open.some((i) => i.id === id)).length;
  return `<div class="sel-bar" role="toolbar" aria-label="${esc(t('selectMany'))}">
    <div class="sel-top">
      <span class="sel-n">${esc(t('selectedN', n))}</span>
      <button type="button" class="link-btn" data-action="sel-all">${esc(t(n === open.length ? 'selectNone' : 'selectAll'))}</button>
      <button type="button" class="btn small" data-action="sel-done">${esc(t('done'))}</button>
    </div>
    <div class="sel-actions">
      <button type="button" class="btn small primary" data-action="sel-shops" ${n ? '' : 'disabled'}>🏪 ${esc(t('itemShopsShort'))}</button>
      <button type="button" class="btn small ghost danger" data-action="sel-delete" ${n ? '' : 'disabled'} aria-label="${esc(t('delete'))}">🗑 ${esc(t('delete'))}</button>
    </div>
  </div>`;
}

function selectedItems() { return [...(ui.sel || [])].map((id) => get('shopping', id)).filter((i) => i && !i.checked); }

function openShopsForMany() {
  const items = selectedItems();
  const shops = shopsSorted();
  if (!items.length) return;
  if (!shops.length) { toast(t('shopsNone')); return; }
  let picked = [];
  const has = (sid) => items.filter((i) => itemShopIds(i).includes(sid)).length;
  const chips = () => shops.map((sh) => { const n = picked.indexOf(sh.id); const k = has(sh.id); return `<button type="button" class="chip ${n >= 0 ? 'on' : ''}" data-pick="${esc(sh.id)}" aria-pressed="${n >= 0}">${n >= 0 && picked.length > 1 ? `<b>${n + 1}</b> ` : ''}${esc(sh.name)}${k ? ` <small>${k}/${items.length}</small>` : ''}</button>`; }).join('');
  openModal(`
    <h2>🏪 ${esc(t('shopsForN', items.length))}</h2>
    <p class="hint small">${esc(items.map((i) => i.name).slice(0, 8).join(', '))}${items.length > 8 ? ' …' : ''}</p>
    <div class="f-chips shop-chips" id="many-shops">${chips()}</div>
    <p class="hint small">${esc(t('manyShopsHint'))}</p>
    <div class="seg" role="radiogroup" aria-label="${esc(t('shopsHow'))}">
      <label><input type="radio" name="how" value="add" checked> ${esc(t('shopsHowAdd'))}</label>
      <label><input type="radio" name="how" value="replace"> ${esc(t('shopsHowReplace'))}</label>
    </div>
    <div class="button-row">
      <button class="btn primary" value="ok">${esc(t('apply'))}</button>
      <button class="btn" value="cancel" formnovalidate>${esc(t('cancel'))}</button>
      <button class="btn ghost" value="delete" formnovalidate>${esc(t('shopsClearMany'))}</button>
    </div>`, (form, action) => {
    const how = form.how.value;
    for (const it of selectedItems()) {
      let shopsNew;
      if (action === 'delete') shopsNew = []; // any shop
      else if (how === 'replace') shopsNew = picked;
      else shopsNew = [...(it.shops || []), ...picked.filter((x) => !(it.shops || []).includes(x))];
      // everything else on the item (Everyday's fields too) stays as it is
      upsert('shopping', { ...it, shops: shopsNew }, { silent: true });
    }
    toast(t('shopsSetN', items.length));
    ui.sel = null;
    changed();
  });
  modal.onclick = (e) => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    const sid = b.dataset.pick;
    picked = picked.includes(sid) ? picked.filter((x) => x !== sid) : [...picked, sid];
    modal.querySelector('#many-shops').innerHTML = chips();
  };
}

// "open until 12:30" / "opens at 15:30" / "opens Mon 08:00", next to a shop's name on the list
function shopHead(id) {
  const sh = shopById(id);
  if (!sh) return '';
  const st = shopStatus(sh);
  const txt = st.state === 'always' ? '' : st.state === 'open' ? t('shopOpenUntil', hhmm(st.until))
    : st.state === 'later' ? t('shopOpensAt', hhmm(st.at)) : st.state === 'next' ? t('shopOpensOn', dateText(st.date).split(' ')[0].replace(/,$/, ''), hhmm(st.at)) : t('shopClosedWeek');
  const link = sh.link ? ` <a class="shop-link" href="${esc(sh.link)}" target="_blank" rel="noopener" aria-label="${esc(sh.place || sh.link)}">📍</a>` : '';
  return txt || link ? `<span class="shop-status ${st.state}">${esc(txt)}${link}</span>` : '';
}

// An item's own shops that still exist, in its order of preference
function itemShopIds(i) { return (i.shops || []).filter((id) => shopById(id)); }

function openItemEdit(id) {
  const it = get('shopping', id);
  if (!it) return;
  let picked = itemShopIds(it);
  const startCat = shopCat(it);
  const units = UNITS.includes(it.unit || '') ? UNITS : [...UNITS, it.unit];
  // the same dialog as Everyday's: name, amount, department, note, the shops that sell it
  const chips = () => shopsSorted().map((sh) => { const on = picked.includes(sh.id); return `<button type="button" class="chip shop-chip ${on ? 'on' : ''}" data-pick="${esc(sh.id)}" role="checkbox" aria-checked="${on}">${esc(sh.name)}</button>`; }).join('');
  const shopsHint = () => t(hasShops() ? 'itemShopsHint' : 'itemShopsNoneYet');
  openModal(`
    <h2>${esc(it.name)}</h2>
    <label>${esc(t('name'))}<input name="name" value="${esc(it.name)}" required autocomplete="off"></label>
    <div class="two">
      <label>${esc(t('quantity'))}<input name="qty" inputmode="decimal" value="${esc(it.qty ?? '')}"></label>
      <label>${esc(t('unit'))}<select name="unit">${units.map((u) => `<option value="${esc(u)}" ${u === (it.unit || '') ? 'selected' : ''}>${esc(u === '' ? '—' : unitOptionLabel(u))}</option>`).join('')}</select></label>
    </div>
    <label>${esc(t('department'))}<select name="cat">${DEPTS.map((c) => `<option value="${c.id}" ${c.id === startCat ? 'selected' : ''}>${c.icon} ${esc(t(`cat_${c.id}`))}</option>`).join('')}</select></label>
    <label>${esc(t('notes'))}<input name="note" value="${esc(it.note || '')}" autocomplete="off"></label>
    <div class="field-label">🏪 ${esc(t('itemShops'))}</div>
    <div class="f-chips shop-chips" id="item-shops">${chips()}</div>
    <div class="row new-shop">
      <input id="new-shop-name" placeholder="${esc(t('newShopPh'))}" autocomplete="off" aria-label="${esc(t('shopName'))}">
      <button type="button" class="btn small" data-new-shop>+ ${esc(t('newShop'))}</button>
    </div>
    <p class="hint small" id="item-shops-hint">${esc(shopsHint())}</p>
    ${(it.sources || []).length ? `<p class="hint small">${esc(t('forRecipes', it.sources.join(', ')))}</p>` : ''}
    <div class="button-row sep">
      <button class="btn primary" value="ok">${esc(t('save'))}</button>
      <button class="btn" value="cancel" formnovalidate>${esc(t('cancel'))}</button>
      <button class="btn danger" value="delete" formnovalidate>${esc(t('delete'))}</button>
    </div>`, (form, action) => {
    if (action === 'delete') { remove('shopping', id); changed(); return; }
    const raw = form.qty.value.trim().replace(',', '.');
    const qty = raw === '' ? null : Number(raw);
    const cur = get('shopping', id) || it;
    // every other field (Everyday's too) stays as it is; the department only changes if you changed it
    const next = { ...cur, name: form.name.value.trim() || it.name, qty: Number.isFinite(qty) ? qty : null, unit: form.unit.value, note: form.note.value.trim(), shops: picked };
    if (form.cat.value !== startCat) next.cat = form.cat.value;
    upsert('shopping', next, { silent: true });
    changed();
  });
  const addShop = () => {
    const input = modal.querySelector('#new-shop-name');
    const nm = input.value.trim();
    if (!nm) { input.focus(); return; }
    // the same name (case and accents ignored) is the same shop
    const existing = shopsSorted().find((x) => fold(x.name).trim() === fold(nm));
    let sid = existing?.id;
    if (!sid) {
      const all = shopsSorted();
      sid = uid();
      upsert('shops', { id: sid, name: nm, minutes: 30, hours: [], place: '', link: '', order: all.length ? Math.max(...all.map((x) => x.order || 0)) + 1 : 0 }, { silent: true });
    }
    if (!picked.includes(sid)) picked = [...picked, sid];
    input.value = '';
    modal.querySelector('#item-shops').innerHTML = chips();
    modal.querySelector('#item-shops-hint').textContent = shopsHint();
  };
  modal.onclick = (e) => {
    if (e.target.closest('[data-new-shop]')) { addShop(); return; }
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    const sid = b.dataset.pick;
    picked = picked.includes(sid) ? picked.filter((x) => x !== sid) : [...picked, sid];
    modal.querySelector('#item-shops').innerHTML = chips();
  };
  // Enter in the new-shop field adds the shop instead of saving the item
  modal.querySelector('#new-shop-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addShop(); } });
}

// ---------- tag settings ----------

function autoTagIds() {
  return [...AUTO_TAGS, ...tagDefs().filter((d) => d.custom).map((d) => d.id)];
}
// origin tags: every continent, then the countries found in the recipes (or given keywords/switched off)
function originTagIds(auto) {
  const countries = new Set([...auto.keys(), ...tagDefs().filter((d) => !d.deleted).map((d) => d.id)].filter((id) => id.startsWith('geo_')));
  return [...CONTINENTS.map((c) => `cont_${c}`),
    ...[...countries].sort((a, b) => (auto.get(b) || 0) - (auto.get(a) || 0) || autoLabel(a).localeCompare(autoLabel(b), getLang()))];
}

function tagCounts() {
  // count as if every tag were switched on, so a disabled tag still shows how many it would cover
  const defs = tagDefs().map((d) => ({ ...d, enabled: true }));
  const auto = new Map();
  const own = new Map();
  for (const r of live('recipes')) {
    for (const a of autoTags(r, defs)) auto.set(a, (auto.get(a) || 0) + 1);
    for (const m of r.tags || []) if (m) own.set(m, (own.get(m) || 0) + 1);
  }
  return { auto, own };
}

function tagSettings() {
  const { auto, own } = tagCounts();
  const row = (id) => {
    const d = tagDef(id) || {};
    const on = d.enabled !== false;
    const kw = (d.keywords || []).join(', ');
    return `<li class="tagdef ${on ? '' : 'off'}">
      <label class="switch" title="${esc(t(on ? 'tagOn' : 'tagOff'))}"><input type="checkbox" id="tagdef-${esc(id)}" data-tagdef="${esc(id)}" ${on ? 'checked' : ''}><span></span></label>
      <div class="tagdef-main">
        <span class="tagdef-name">${esc(autoLabel(id))}</span>${d.custom ? '' : ''}
        <small>${esc(t('nRecipes', auto.get(id) || 0))}${kw ? ` · ${esc(t('tagKeywordsShort'))}: ${esc(kw)}` : ''}</small>
      </div>
      ${pinBtn(`auto:${id}`, autoLabel(id))}
      <button type="button" class="btn small ghost" data-action="tagdef-edit" data-value="${esc(id)}" aria-label="${esc(t('editTag'))}">✎</button>
    </li>`;
  };
  const ownTags = [...own.entries()].sort((a, b) => a[0].localeCompare(b[0], getLang()));
  return `
  <h2>${esc(t('tagsTitle'))}</h2>
  <p class="hint">${esc(t('tagsHint'))}</p>
  <h3>${esc(t('autoTagsTitle'))}</h3>
  <ul class="tagdefs" id="tagdefs">${autoTagIds().map(row).join('')}</ul>
  <button type="button" class="btn" data-action="tagdef-new">+ ${esc(t('newAutoTag'))}</button>
  <h3>${esc(t('originTagsTitle'))}</h3>
  <p class="hint small">${esc(t('originTagsHint'))}</p>
  <ul class="tagdefs" id="origintags">${originTagIds(auto).map(row).join('')}</ul>
  <h3>${esc(t('ownTagsTitle'))}</h3>
  ${ownTags.length ? `<ul class="tagdefs" id="owntags">${ownTags.map(([name, n]) => `<li class="tagdef">
      <div class="tagdef-main"><span class="tagdef-name">${esc(name)}</span><small>${esc(t('nRecipes', n))}</small></div>
      ${pinBtn(name, name)}
      <button type="button" class="btn small ghost" data-action="owntag-rename" data-value="${esc(name)}" aria-label="${esc(t('renameTag'))}">✎</button>
      <button type="button" class="btn small ghost danger" data-action="owntag-delete" data-value="${esc(name)}" aria-label="${esc(t('delete'))}">×</button>
    </li>`).join('')}</ul>` : `<p class="hint">${esc(t('noOwnTags'))}</p>`}`;
}

function pinBtn(tg, label) {
  const on = isPinned(tg);
  return `<button type="button" class="btn small ghost pin ${on ? 'on' : ''}" data-action="pin-toggle" data-value="${esc(tg)}" aria-pressed="${on}" aria-label="${esc(t(on ? 'unpinTag' : 'pinTag', label))}" title="${esc(t(on ? 'unpinTag' : 'pinTag', label))}">📌</button>`;
}

function splitKeywords(text) {
  return [...new Set(String(text || '').split(/[,;\n]/).map((x) => x.trim()).filter(Boolean))];
}

function saveTagDef(id, patch) {
  const d = tagDef(id) || { id };
  upsert('tagdefs', { ...d, ...patch, id }, { silent: true });
  changed();
}

function openTagDefEdit(id) {
  const isNew = !id;
  const d = isNew ? { id: `c_${uid()}`, custom: true, enabled: true, keywords: [] } : (tagDef(id) || { id });
  const builtIn = !d.custom;
  openModal(`
    <h2>${esc(t(isNew ? 'newAutoTag' : 'editTag'))}</h2>
    <label>${esc(t('tagName'))}<input name="label" id="tagdef-label" value="${esc(builtIn ? (d.label || '') : (d.name || ''))}" ${builtIn ? `placeholder="${esc(originLabel(d.id) || t(`tag_${d.id}`))}"` : 'required'} autocomplete="off"></label>
    <label>${esc(t('tagKeywords'))}<textarea name="keywords" rows="3" placeholder="${esc(t('tagKeywordsPh'))}">${esc((d.keywords || []).join(', '))}</textarea>
      <small>${esc(t(builtIn ? 'tagKeywordsHintAuto' : 'tagKeywordsHint'))}</small></label>
    <label class="check"><input type="checkbox" name="enabled" ${d.enabled !== false ? 'checked' : ''}> ${esc(t('tagOn'))}</label>
    <div class="button-row">
      <button class="btn primary" value="ok">${esc(t('save'))}</button>
      <button class="btn" value="cancel" formnovalidate>${esc(t('cancel'))}</button>
      ${builtIn && (d.label || (d.keywords || []).length || d.enabled === false) ? `<button class="btn ghost" value="delete" formnovalidate>${esc(t('tagReset'))}</button>` : ''}
      ${!builtIn && !isNew ? `<button class="btn danger" value="delete" formnovalidate>${esc(t('delete'))}</button>` : ''}
    </div>`, (form, action) => {
    if (action === 'delete') {
      if (!builtIn && !confirm(t('confirmDeleteTag', d.name))) return;
      if (!builtIn) unpin(`auto:${d.id}`);
      remove('tagdefs', d.id);
      for (const r of live('recipes').filter((x) => (x.hiddenTags || []).includes(d.id))) {
        upsert('recipes', { ...r, hiddenTags: r.hiddenTags.filter((x) => x !== d.id) }, { silent: true });
      }
      changed();
      return;
    }
    const label = form.label.value.trim();
    const keywords = splitKeywords(form.keywords.value);
    const enabled = form.enabled.checked;
    if (builtIn) saveTagDef(d.id, { label, keywords, enabled });
    else {
      if (!label) return;
      saveTagDef(d.id, { custom: true, name: label, keywords, enabled });
    }
  });
}

function sameTag(a, b) { return String(a).toLocaleLowerCase() === String(b).toLocaleLowerCase(); }

function renameOwnTag(from, to) {
  renamePin(from, to);
  for (const r of live('recipes')) {
    if (!(r.tags || []).includes(from)) continue;
    const tags = [];
    for (const x of r.tags.map((x) => (x === from ? to : x))) if (x && !tags.some((y) => sameTag(x, y))) tags.push(x);
    upsert('recipes', { ...r, tags }, { silent: true });
  }
  changed();
}

function openOwnTagRename(name) {
  openModal(`
    <h2>${esc(t('renameTag'))}</h2>
    <label>${esc(t('tagName'))}<input name="name" id="owntag-name" required value="${esc(name)}" autocomplete="off"></label>
    <p class="hint">${esc(t('renameTagHint'))}</p>
    <div class="button-row">
      <button class="btn primary" value="ok">${esc(t('save'))}</button>
      <button class="btn" value="cancel" formnovalidate>${esc(t('cancel'))}</button>
    </div>`, (form) => {
    const to = form.name.value.trim().replace(/\s+/g, ' ');
    if (to && to !== name) renameOwnTag(name, to);
  });
}

// ---------- rendering ----------

function renderShell() {
  document.title = t('appName');
  $('#app-title').textContent = t('appName');
  $('#app-title').title = t('toRecipes');
  for (const a of document.querySelectorAll('nav.tabs a')) {
    a.querySelector('.label').textContent = t(`tab${a.dataset.tab.charAt(0).toUpperCase()}${a.dataset.tab.slice(1)}`);
  }
  updateSyncBadge();
}

let lastRendered = '';
function render() {
  const r = route();
  // a background re-render (sync, another tab) keeps the place on the page
  const here = location.hash || '#/recipes';
  const keepY = here === lastRendered ? window.scrollY : null;
  lastRendered = here;
  const active = document.activeElement;
  const focusId = active && active.id;
  const typed = focusId && active.tagName === 'INPUT' ? active.value : null;
  let sel = null;
  try { sel = focusId && active.selectionStart != null ? [active.selectionStart, active.selectionEnd] : null; } catch { sel = null; }
  for (const a of document.querySelectorAll('nav.tabs a')) a.classList.toggle('active', a.dataset.tab === TAB_OF[r.name]);
  let html;
  switch (r.name) {
    case 'import': html = viewImport(); break;
    case 'recipe': html = viewRecipe(r.id); break;
    case 'folder': html = viewRecipes(); break;
    case 'suggest': html = viewSuggest(); break;
    case 'putaway': html = viewPutAway(); break;
    case 'edit': html = viewEdit(r.id); break;
    case 'list': html = viewList(); break;
    case 'pantry': html = viewPantry(); break;
    case 'settings': html = viewSettings(); break;
    default: html = viewRecipes();
  }
  view.innerHTML = html;
  hydrate(view);
  updatePantryBadge();
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) { if (typed != null && el.tagName === 'INPUT') el.value = typed; el.focus({ preventScroll: true }); if (sel) try { el.setSelectionRange(...sel); } catch { /* not a text input */ } }
  }
  if (keepY != null && Math.abs(window.scrollY - keepY) > 1) window.scrollTo(0, keepY);
  updateSyncBadge();
}

// Background changes shouldn't wipe a form the user is typing in.
function renderIfSafe() {
  // never swap the page under a finger: the tap would be lost; redraw right after it instead
  if (isDragging() || ui.pointerDown) { ui.renderLater = true; return; }
  const r = route();
  if (r.name === 'edit' || r.name === 'settings' || r.name === 'putaway' || modal.open) return;
  render();
}

// ---------- dialogs ----------

function openModal(html, onSubmit) {
  modal.onchange = null;
  modal.onclick = null;
  modal.oninput = null;
  modal.innerHTML = `<form method="dialog" class="form">${html}</form>`;
  const form = modal.querySelector('form');
  form.addEventListener('submit', (e) => {
    const submitter = e.submitter;
    if (submitter && submitter.value === 'cancel') return;
    if (submitter && submitter.value === 'delete') { onSubmit(form, 'delete'); return; }
    onSubmit(form, 'ok');
  });
  if (!modal.open) modal.showModal();
}

modal.addEventListener('close', () => {
  // a new dialog may already have been opened before this event arrived
  if (!modal.open) { modal.innerHTML = ''; modal.onchange = null; modal.onclick = null; }
  // the edit form holds unsaved typing: only refresh its photos
  if (route().name === 'edit') refreshPhotoStrip(); else render();
});

function openAddToList(r) {
  const n = servingsFor(r);
  const draw = (usePantry) => {
    const plan = planForRecipe(r, n, usePantry);
    return `<h2>${esc(t('addToListTitle', n))}</h2>
    <label class="check"><input type="checkbox" name="usePantry" ${usePantry ? 'checked' : ''}> ${esc(t('usePantry'))}</label>
    <ul class="plan">${plan.map((p) => `<li><label class="check">
      <input type="checkbox" name="i${p.idx}" ${p.covered ? '' : 'checked'}>
      <span><span class="q">${esc(qtyText(p.covered ? p.need : p.buy, p.unit))}</span> ${esc(p.name)}
      ${p.have ? `<small>${esc(p.covered ? t('haveEnough') : `${t('inPantry')}: ${qtyText(num(p.have.qty) || 0, p.have.unit)}`)}</small>` : ''}</span>
    </label></li>`).join('')}</ul>
    <div class="button-row">
      <button class="btn primary" value="ok">🛒 ${esc(t('addToList'))}</button>
      <button class="btn" value="cancel" formnovalidate>${esc(t('cancel'))}</button>
    </div>`;
  };
  let usePantry = live('pantry').length > 0;
  openModal(draw(usePantry), (form) => {
    const plan = planForRecipe(r, n, form.usePantry.checked);
    let count = 0;
    for (const p of plan) {
      if (!form[`i${p.idx}`]?.checked) continue;
      addToShopping({ name: p.name, qty: p.covered ? p.need : p.buy, unit: p.unit, note: p.note }, r.title);
      count++;
    }
    changed();
    toast(t('addedToList', count));
  });
  modal.onchange = (e) => {
    if (e.target.name !== 'usePantry') return;
    usePantry = e.target.checked;
    modal.querySelector('form').innerHTML = draw(usePantry);
  };
}

function openPantryEdit(p) {
  let codes = codesOf(p);
  const codesHtml = () => `${codes.map((c, i) => `<span class="tag">🏷️ ${esc(c)}<button type="button" class="tag-x" data-action="code-remove" data-i="${i}" aria-label="${esc(t('remove'))}">×</button></span>`).join('')}
    <button type="button" class="btn small" data-action="code-add">📷 ${esc(t('linkBarcode'))}</button>`;
  openModal(`
    <h2>${esc(p.name)}</h2>
    <label>${esc(t('name'))}<input name="name" required value="${esc(p.name)}"></label>
    <label>${esc(t('department'))}<select name="cat">${CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === categoryOf(p) ? 'selected' : ''}>${c.icon} ${esc(t(`cat_${c.id}`))}</option>`).join('')}</select></label>
    <div class="field-label">${esc(t('barcodes'))}</div>
    <div class="code-row" id="code-row"></div>
    <div class="two">
      <label>${esc(t('quantity'))}<input name="qty" inputmode="decimal" value="${esc(p.qty ?? '')}"></label>
      <label>${esc(t('unit'))}<select name="unit">${UNITS.map((u) => `<option value="${u}" ${u === (p.unit || '') ? 'selected' : ''}>${esc(unitOptionLabel(u))}</option>`).join('')}</select></label>
    </div>
    <div class="two">
      <label>${esc(t('expires'))}<input name="expires" type="date" value="${esc(p.expires || '')}"></label>
      <label>${esc(t('remindBefore'))}<input name="remindDays" type="number" min="0" step="1" inputmode="numeric" value="${esc(p.remindDays ?? '')}" placeholder="${esc(remindDefault())}"></label>
    </div>
    <small class="hint-small">${esc(t('remindHint', remindDefault()))}</small>
    <label>${esc(t('minQty'))}<input name="min" inputmode="decimal" value="${esc(p.min ?? '')}"><small>${esc(t('minHint'))}</small></label>
    <label>${esc(t('target'))}<input name="target" inputmode="decimal" value="${esc(p.target ?? '')}"><small>${esc(t('targetHint'))}</small></label>
    <div class="button-row">
      <button class="btn primary" value="ok">${esc(t('save'))}</button>
      <button class="btn" value="cancel" formnovalidate>${esc(t('cancel'))}</button>
      <button class="btn danger" value="delete" formnovalidate>${esc(t('delete'))}</button>
    </div>`, (form, action) => {
    if (action === 'delete') { remove('pantry', p.id); ensureLowItems(); changed(); return; }
    // a barcode belongs to one item only
    for (const other of live('pantry').filter((x) => x.id !== p.id && codesOf(x).some((c) => codes.includes(c)))) {
      const rest = codesOf(other).filter((c) => !codes.includes(c));
      upsert('pantry', { ...other, barcode: rest[0] || null, barcodes: rest }, { silent: true });
    }
    upsert('pantry', {
      ...p, name: form.name.value.trim(), qty: num(form.qty.value) ?? 0, unit: form.unit.value,
      cat: form.cat.value === categorize(form.name.value) && !p.cat ? null : form.cat.value,
      barcode: codes[0] || null, barcodes: codes,
      min: num(form.min.value), target: num(form.target.value),
      expires: form.expires.value || null,
      remindDays: form.remindDays.value === '' ? null : Math.max(0, parseInt(form.remindDays.value, 10) || 0),
    }, { silent: true });
    ensureLowItems();
    changed();
  });
  const row = () => { const el = modal.querySelector('#code-row'); if (el) el.innerHTML = codesHtml(); };
  row();
  modal.onclick = async (e) => {
    const rm = e.target.closest('[data-action=code-remove]');
    if (rm) { codes.splice(+rm.dataset.i, 1); row(); return; }
    if (!e.target.closest('[data-action=code-add]')) return;
    const code = await scanBarcode($('#scanner'), tt);
    if (code && !codes.includes(code)) {
      const owner = live('pantry').find((x) => x.id !== p.id && hasCode(x, code));
      if (owner) toast(t('barcodeMoved', owner.name));
      codes.push(code);
      row();
    }
  };
}

// ---------- events ----------

view.addEventListener('submit', (e) => {
  const form = e.target;
  e.preventDefault();
  if (form.id === 'import-form') {
    const url = form.url.value.trim();
    form.url.value = '';
    queueImport(url);
  } else if (form.id === 'add-item') {
    const ing = parseIngredient(form.item.value);
    form.item.value = '';
    addToShopping(ing, '');
    changed();
    $('#add-item-input')?.focus();
  } else if (form.id === 'add-pantry') {
    const ing = parseIngredient(form.item.value);
    form.item.value = '';
    const existing = findPantry(ing.name);
    if (existing) {
      const add = ing.qty == null ? 0 : convert(ing.qty, ing.unit, existing.unit);
      upsert('pantry', { ...existing, qty: round((num(existing.qty) || 0) + (add ?? 0)) }, { silent: true });
      ensureLowItems();
      changed();
    } else {
      const p = upsert('pantry', { id: uid(), name: ing.name, qty: ing.qty ?? 1, unit: ing.unit, min: null, target: null }, { silent: true });
      changed();
      openPantryEdit(p);
    }
  } else if (form.id === 'putaway-form') {
    commitPutAway();
  } else if (form.id === 'tag-form') {
    const r = get('recipes', form.dataset.id);
    const tag = form.tag.value.trim().replace(/\s+/g, ' ');
    if (r && tag) {
      const auto = autoTags({ ...r, hiddenTags: [] }, tagDefs()).find((a) => autoLabel(a).toLowerCase() === tag.toLowerCase());
      if (auto) upsert('recipes', { ...r, hiddenTags: (r.hiddenTags || []).filter((x) => x !== auto) }, { silent: true });
      else if (!(r.tags || []).some((x) => x.toLowerCase() === tag.toLowerCase())) upsert('recipes', { ...r, tags: [...(r.tags || []), tag] }, { silent: true });
      changed();
      $('#tag-input')?.focus();
    }
  } else if (form.id === 'online-add-form') {
    const v = $('#online-add').value.trim();
    if (v) { const o = onlineState(); if (!o.extra.includes(v)) o.extra.push(v); if (!o.selected.includes(v)) o.selected.push(v); }
    render();
    $('#online-add')?.focus();
  } else if (form.classList.contains('key-form')) {
    const svc = form.dataset.svc;
    const key = form.key.value.trim();
    if (!key) return;
    ui.keyMsg = null;
    testKey(svc, key).then((r) => {
      if (r === 'ok' || r === 'limit') { setPref(PHOTO_KEYS[svc], key); ui.keyEdit = ''; ui.keyMsg = { svc, r: 'ok' }; changed(); }
      else { ui.keyMsg = { svc, r }; render(); }
    });
  } else if (form.id === 'edit-form') {
    saveRecipe(form);
  } else if (form.id === 'gh-form') {
    saveGithub(form);
  }
});

view.addEventListener('sorted', (e) => onSorted(e.detail));
document.addEventListener('pointerdown', () => { ui.pointerDown = true; }, true);
const pointerReleased = () => setTimeout(() => {
  ui.pointerDown = false;
  if (ui.renderLater && !isDragging()) { ui.renderLater = false; renderIfSafe(); }
}, 50);
document.addEventListener('pointerup', pointerReleased, true);
document.addEventListener('pointercancel', pointerReleased, true);

view.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.action === 'toggle') setChecked(el.dataset.id, el.checked);
  if (el.id === 'list-mode' || el.id === 'settings-list-mode') { setListMode(el.value); changed(); render(); return; }
  if (el.dataset.action === 'sel' && ui.sel) { if (el.checked) ui.sel.add(el.dataset.id); else ui.sel.delete(el.dataset.id); render(); }
  if (el.dataset.tagdef) saveTagDef(el.dataset.tagdef, { enabled: el.checked });
  if (el.dataset.pa && ui.putaway) {
    const row = ui.putaway.rows[+el.dataset.i];
    row[el.dataset.pa] = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.pa === 'name') { row.pantryId = null; row.cat = null; }
    render();
  }
  if (el.dataset.pref === 'autoPhotos') { setPref('autoPhotos', el.checked); changed(); }
  if (el.dataset.src || el.dataset.site) {
    const cur = onlineSources();
    if (el.dataset.src) cur[el.dataset.src] = el.checked;
    if (el.dataset.site) cur.sites = el.checked ? [...new Set([...cur.sites, el.dataset.site])] : cur.sites.filter((x) => x !== el.dataset.site);
    setPref('onlineSources', cur);
    changed();
    render();
  }
  if (el.id === 'max-missing') { setPref('maxMissing', Math.max(0, Math.min(20, parseInt(el.value, 10) || 0))); changed(); }
  if (el.id === 'people') { setPref('people', +el.value || 0); ui.servings = {}; changed(); }
  if (el.id === 'import-folder') saveSettings({ importFolder: el.value || '' });
  if (el.id === 'sort') { saveSettings({ sort: el.value }); $('#cards').innerHTML = cardsHtml(); hydrate($('#cards')); }
  if (el.id === 'basics') { saveSettings({ basics: el.checked }).then(render); }
  if (el.name === 'sourceType') el.closest('.source-fields')?.classList.toggle('is-book', el.value === 'book');
  if (el.dataset.action === 'move-recipe') {
    const r = get('recipes', el.dataset.id);
    upsert('recipes', { ...r, folderId: el.value || null }, { silent: true });
    changed();
    toast(t('movedTo', el.value ? folderOf(el.value).name : t('allRecipes')));
  }
  if (el.id === 'photo-input' && el.files.length && ui.edit) addPhotos([...el.files]);
  if (el.name === 'lang' && el.form?.id === 'lang-form') {
    saveSettings({ lang: el.value }).then(() => { if (thisDevice()) saveDevice({}); });
    applyLang(el.value);
    renderShell();
    render();
  }
  if (el.name === 'remindDays' && el.form?.id === 'remind-form') {
    const v = Math.max(0, parseInt(el.value, 10) || 0);
    saveSettings({ remindDays: v }).then(() => { if (thisDevice()) saveDevice({}); else render(); });
  }
});

view.addEventListener('input', (e) => {
  if (e.target.dataset.pa && ui.putaway && e.target.type !== 'checkbox') ui.putaway.rows[+e.target.dataset.i][e.target.dataset.pa] = e.target.value;
  if (e.target.closest('#edit-form') && (e.target.name === 'ingredients' || e.target.name === 'servings')) {
    const form = e.target.form;
    const el = $('#nutri-preview');
    if (el && form) el.innerHTML = nutritionPreview(form.servings.value, form.ingredients.value);
  }
  // searching the shopping list: not saved, lasts while the screen is open
  if (e.target.id === 'shop-q') { ui.listQ = e.target.value; render(); return; }
  if (e.target.id === 'search') {
    ui.search = e.target.value;
    $('#cards').innerHTML = cardsHtml();
    hydrate($('#cards'));
  }
});

// the ✕ in the list's search: keep the phone's keyboard open; Esc does the same as ✕
view.addEventListener('pointerdown', (e) => { if (e.target.closest('.search-clear')) e.preventDefault(); });
view.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && e.target.id === 'shop-q' && e.target.value) {
    e.preventDefault();
    ui.listQ = '';
    e.target.value = '';
    render();
    document.getElementById('shop-q')?.focus({ preventScroll: true });
  }
});

view.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn || btn.dataset.action === 'toggle') return;
  const { action, id } = btn.dataset;
  switch (action) {
    case 'srv-dec':
    case 'srv-inc': {
      const r = get('recipes', id);
      const n = servingsFor(r);
      ui.servings[id] = Math.max(1, n + (action === 'srv-inc' ? 1 : -1));
      render();
      break;
    }
    case 'to-list': openAddToList(get('recipes', id)); break;
    case 'cooked': {
      const r = get('recipes', id);
      const n = servingsFor(r);
      if (confirm(t('cookedConfirm', n))) cook(r, n);
      break;
    }
    case 'delete-recipe':
      if (confirm(t('confirmDelete'))) { remove('recipes', id); location.hash = '#/recipes'; changed(); }
      break;
    case 'q-retry': { const q = get('queue', id); upsert('queue', { ...q, status: 'pending', error: '' }, { silent: true }); changed(); break; }
    case 'q-remove': remove('queue', id); changed(); break;
    case 'q-manual': {
      const q = get('queue', id);
      ui.prefillUrl = q.url || '';
      ui.prefillSource = q.type === 'photo' ? { source: { type: q.kind, book: q.book || '', page: q.page || '' }, sourcePhotos: q.scans || [] } : null;
      ui.newFolder = q.folderId || null;
      ui.edit = null;
      remove('queue', id);
      location.hash = '#/edit/new';
      break;
    }
    case 'del-item': remove('shopping', id); changed(); break;
    case 'item-edit': openItemEdit(id); break;
    case 'sel-start': ui.sel = new Set(); render(); break;
    case 'sel-done': ui.sel = null; render(); break;
    case 'sel-all': {
      const open = live('shopping').filter((i) => !i.checked);
      ui.sel = open.every((i) => ui.sel.has(i.id)) ? new Set() : new Set(open.map((i) => i.id));
      render();
      break;
    }
    case 'sel-group': {
      const g = listGroups(live('shopping').filter((i) => !i.checked)).find(([k]) => k === btn.dataset.value);
      if (g) { const all = g[2].every((i) => ui.sel.has(i.id)); for (const i of g[2]) { if (all) ui.sel.delete(i.id); else ui.sel.add(i.id); } }
      render();
      break;
    }
    case 'sel-shops': openShopsForMany(); break;
    case 'sel-delete': {
      const items = selectedItems();
      if (!items.length || !confirm(t('deleteSelectedConfirm', items.length))) break;
      for (const i of items) remove('shopping', i.id);
      ui.sel = null;
      changed();
      break;
    }
    case 'shop-new': openShopEdit(null); break;
    case 'shop-edit': openShopEdit(id); break;
    case 'clear-checked':
      for (const i of live('shopping').filter((x) => x.checked)) remove('shopping', i.id);
      changed();
      break;
    case 'share-list': shareList(); break;
    case 'p-inc':
    case 'p-dec': {
      const p = get('pantry', id);
      const pack = p.packQty ? convert(p.packQty, p.packUnit || '', p.unit || '') : null;
      const step = pack && pack > 0 ? pack : stepFor(p.unit);
      const qty = Math.max(0, round((num(p.qty) || 0) + (action === 'p-inc' ? step : -step)));
      upsert('pantry', { ...p, qty }, { silent: true });
      ensureLowItems();
      changed();
      break;
    }
    case 'p-edit': openPantryEdit(get('pantry', id)); break;
    case 'folder-new': openFolderEdit(null, currentFolderId()); break;
    case 'scan': startScan(); break;
    case 'photo-import': openPhotoCapture(); break;
    case 'book-import': openBookImport(); break;
    case 'photo-search': openPhotoSearch(); break;
    case 'online-toggle': { const o = onlineState(); const v = btn.dataset.value; o.selected = o.selected.includes(v) ? o.selected.filter((x) => x !== v) : [...o.selected, v]; render(); break; }
    case 'online-clear': onlineState().selected = []; render(); break;
    case 'online-search': runOnlineSearch(); break;
    case 'online-hidden': { const o = onlineState(); o.showHidden = !o.showHidden; render(); break; }
    case 'online-import': saveOnlineRecipe(btn.dataset.value); break;
    case 'key-edit': ui.keyEdit = btn.dataset.value; ui.keyMsg = null; render(); break;
    case 'key-cancel': ui.keyEdit = ''; ui.keyMsg = null; render(); break;
    case 'key-remove': if (confirm(t('keyRemoveConfirm', SRC_LABEL[btn.dataset.value]))) { setPref(PHOTO_KEYS[btn.dataset.value], ''); ui.keyMsg = null; changed(); } break;
    case 'key-test': { const svc = btn.dataset.value; testKey(svc, photoKey(svc)).then((r) => { ui.keyMsg = { svc, r }; render(); }); break; }
    case 'book-fix': openBookFix(id); break;
    case 'open-book': ui.search = ''; ui.filters = null; ui.showFilters = false; location.hash = folderHref(id); break;
    case 'put-away': startPutAway(); break;
    case 'pa-scan': putAwayScan(); break;
    case 'dept-jump': document.getElementById(`dept-${btn.dataset.value}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); break;
    case 'toggle-filters': ui.showFilters = !ui.showFilters; render(); break;
    case 'f-tag': { const f = filters(); const v = btn.dataset.value; f.tags = f.tags.includes(v) ? f.tags.filter((x) => x !== v) : [...f.tags, v]; render(); break; }
    case 'f-source': { const f = filters(); f.source = f.source === btn.dataset.value ? '' : btn.dataset.value; render(); break; }
    case 'f-time': { const f = filters(); const v = +btn.dataset.value; f.maxTime = f.maxTime === v ? 0 : v; render(); break; }
    case 'f-active': { const f = filters(); const v = +btn.dataset.value; f.maxActive = f.maxActive === v ? 0 : v; render(); break; }
    case 'f-kcal': { const f = filters(); const v = +btn.dataset.value; f.maxKcal = f.maxKcal === v ? 0 : v; render(); break; }
    case 'f-prot': { const f = filters(); const v = +btn.dataset.value; f.minProt = f.minProt === v ? 0 : v; render(); break; }
    case 'srv-reset': delete ui.servings[id]; render(); break;
    case 'f-ready': { const f = filters(); f.ready = f.ready === btn.dataset.value ? '' : btn.dataset.value; render(); break; }
    case 'f-clear': ui.filters = null; render(); break;
    case 'tag-remove': {
      const r = get('recipes', id);
      const v = btn.dataset.value;
      if (v.startsWith('auto:')) upsert('recipes', { ...r, hiddenTags: [...new Set([...(r.hiddenTags || []), v.slice(5)])] }, { silent: true });
      else upsert('recipes', { ...r, tags: (r.tags || []).filter((x) => x !== v) }, { silent: true });
      changed();
      break;
    }
    case 'add-missing': addMissingToList(id); break;
    case 'notify-on': enableNotifications(); break;
    case 'notify-off': disableNotifications(); break;
    case 'notify-test': {
      const items = expiringItems();
      showLocal(t('notifyTitle'), items.length ? reminderBody(items) : t('notifyTestBody')).catch(() => {});
      break;
    }
    case 'folder-edit': e.preventDefault(); openFolderEdit(get('folders', id)); break;
    case 'pin-edit': ui.pinEdit = !ui.pinEdit; render(); break;
    case 'pin-toggle': togglePin(btn.dataset.value); break;
    case 'tags-more': ui.allTags = !ui.allTags; render(); break;
    case 'list-mode': setListMode(btn.dataset.value); changed(); render(); break;
    case 'shop-q-clear': {
      ui.listQ = '';
      const f = document.getElementById('shop-q');
      if (f) f.value = ''; // the redraw keeps what's typed in the focused field
      render();
      document.getElementById('shop-q')?.focus({ preventScroll: true });
      break;
    }
    case 'sel-row': { if (ui.sel.has(id)) ui.sel.delete(id); else ui.sel.add(id); render(); break; }
    case 'dept-reset': setPref('deptOrder', []); changed(); render(); break;
    case 'suggest-sort': saveSettings({ suggestSort: btn.dataset.value }).then(render); break;
    case 'folder-delete': openFolderDelete(get('folders', id)); break;
    case 'new-recipe':
      ui.newFolder = targetFolderId();
      ui.prefillSource = null;
      ui.prefillUrl = '';
      ui.edit = null;
      location.hash = '#/edit/new';
      break;
    case 'photo-remove':
      ui.edit.photos.splice(+btn.dataset.i, 1);
      refreshPhotoStrip();
      break;
    case 'photo-cover': {
      const [p] = ui.edit.photos.splice(+btn.dataset.i, 1);
      ui.edit.photos.unshift(p);
      refreshPhotoStrip();
      break;
    }
    case 'view-photo': {
      const img = btn.querySelector('img');
      if (img?.src) openModal(`<img class="full" src="${esc(img.src)}" alt=""><div class="button-row"><button class="btn" value="cancel">${esc(t('back'))}</button></div>`, () => {});
      break;
    }
    case 'tagdef-edit': openTagDefEdit(btn.dataset.value); break;
    case 'tagdef-new': openTagDefEdit(null); break;
    case 'owntag-rename': openOwnTagRename(btn.dataset.value); break;
    case 'owntag-delete': {
      const name = btn.dataset.value;
      if (!confirm(t('confirmDeleteTag', name))) break;
      unpin(name);
      for (const r of live('recipes').filter((x) => (x.tags || []).includes(name))) upsert('recipes', { ...r, tags: r.tags.filter((x) => x !== name) }, { silent: true });
      changed();
      break;
    }
    case 'gh-edit': ui.ghEdit = true; ui.connMsg = ''; render(); break;
    case 'gh-cancel': ui.ghEdit = false; ui.connMsg = ''; render(); break;
    case 'gh-disconnect':
      if (confirm(t('confirmDisconnect'))) {
        saveSettings({ token: '', verified: false }).then(() => { ui.ghEdit = false; ui.connMsg = ''; render(); updateSyncBadge(); });
      }
      break;
    case 'sync-now': runSync().then(() => { ui.connMsg = state.meta.lastError ? `err_${state.meta.lastError}` : ''; render(); }); break;
    case 'export': exportData(); break;
    default: break;
  }
});

// ---------- notifications ----------

const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function thisDevice() { return state.settings.deviceId ? get('devices', state.settings.deviceId) : null; }
function pushOn() { const d = thisDevice(); return Boolean(d && d.enabled && d.subscription); }

function notifySection() {
  let body;
  if (!pushSupported()) {
    body = `<p class="hint">${esc(t(isIOS() && !isStandalone() ? 'notifyIOS' : 'notifyUnsupported'))}</p>`;
  } else if (!isConfigured()) {
    body = `<p class="hint">${esc(t('notifyNeedsGithub'))}</p>`;
  } else if (pushOn() && Notification.permission === 'granted') {
    body = `<p class="conn good">${esc(t('notifyOn'))}</p>
      <div class="button-row">
        <button class="btn" data-action="notify-test">${esc(t('notifyTest'))}</button>
        <button class="btn ghost" data-action="notify-off">${esc(t('notifyDisable'))}</button>
      </div>`;
  } else if (Notification.permission === 'denied') {
    body = `<p class="conn bad">${esc(t('notifyDenied'))}</p>`;
  } else {
    body = `<p class="hint">${esc(t('notifyExplain'))}</p>
      <button class="btn primary" data-action="notify-on">🔔 ${esc(t('notifyEnable'))}</button>`;
  }
  return `<div id="notify">${ui.notifyMsg ? `<p class="conn bad">${esc(ui.notifyMsg)}</p>` : ''}${body}</div>`;
}

function urlBase64ToUint8Array(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function deviceName() {
  const ua = navigator.userAgent;
  if (/iphone/i.test(ua)) return 'iPhone';
  if (/ipad/i.test(ua) || isIOS()) return 'iPad';
  if (/android/i.test(ua)) return 'Android';
  if (/mac/i.test(ua)) return 'Mac';
  if (/windows/i.test(ua)) return 'Windows';
  return 'Linux';
}

async function saveDevice(patch) {
  let id = state.settings.deviceId;
  if (!id) { id = uid(); await saveSettings({ deviceId: id }); }
  const prev = get('devices', id) || { id, name: deviceName() };
  upsert('devices', {
    ...prev, ...patch,
    lang: getLang(),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    remindDays: remindDefault(),
  }, { silent: true });
  changed();
}

async function enableNotifications() {
  ui.notifyMsg = '';
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { render(); return; }
    const key = await getOrCreateVapidPublicKey();
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    const keyBytes = urlBase64ToUint8Array(key);
    // A subscription made with different keys (e.g. from an old setup) must be replaced.
    if (sub && sub.options?.applicationServerKey) {
      const cur = new Uint8Array(sub.options.applicationServerKey);
      if (cur.length !== keyBytes.length || cur.some((b, i) => b !== keyBytes[i])) { await sub.unsubscribe(); sub = null; }
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes });
    await saveDevice({ enabled: true, subscription: sub.toJSON() });
    toast(t('notifyOn'));
  } catch (e) {
    ui.notifyMsg = `${t('notifyFailed')} (${e.code || e.name || e.message})`;
    render();
  }
}

async function disableNotifications() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch { /* ignore */ }
  await saveDevice({ enabled: false, subscription: null });
}

function reminderBody(items) {
  const lines = items.slice(0, 4).map((x) => `${x.p.name}: ${expiryText(x.d)}`);
  if (items.length > 4) lines.push(t('andMore', items.length - 4));
  return lines.join('\n');
}

async function showLocal(title, body) {
  const reg = await navigator.serviceWorker?.ready;
  const opts = { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'expiry', data: { url: './#/pantry' } };
  if (reg?.showNotification) return reg.showNotification(title, opts);
  return new Notification(title, opts);
}

// When this device doesn't get push reminders (e.g. no GitHub or no push
// support), remind once a day while the app is open.
async function localReminder() {
  const items = expiringItems();
  if (!items.length || pushOn()) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const today = todayStr();
  if (state.settings.lastLocalReminder === today) return;
  await saveSettings({ lastLocalReminder: today });
  try { await showLocal(t('notifyTitle'), reminderBody(items)); } catch { /* ignore */ }
}

// ---------- recipe from a photo (cookbook page or note) ----------

function booksDatalist() {
  const books = [...new Set(live('recipes').map((r) => r.source?.book).filter(Boolean))].sort();
  return `<datalist id="books">${books.map((b) => `<option value="${esc(b)}">`).join('')}</datalist>`;
}

function captureStrip(c) {
  return `${c.scans.map((p, i) => `<div class="shot page">${photoTag(p)}
      <span class="badge cover">${i + 1}</span>
      <button type="button" class="mini x" data-action="scan-remove" data-i="${i}" aria-label="${esc(t('remove'))}">×</button></div>`).join('')}
    <label class="shot add page">
      <input type="file" accept="image/*" multiple id="scan-input" hidden>
      <span>＋<br>${esc(t(c.scans.length ? 'addPage' : 'takePhoto'))}</span>
    </label>
    ${c.busy ? '<div class="shot page busy"><span class="spinner"></span></div>' : ''}`;
}

function refreshCapture() {
  const c = ui.capture;
  const strip = modal.querySelector('#scan-strip');
  if (!c || !strip) return;
  strip.innerHTML = captureStrip(c);
  hydrate(strip);
  const pasted = modal.querySelector('textarea[name=pasted]')?.value.trim();
  modal.querySelector('button[value=ok]').disabled = (!c.scans.length && !pasted) || c.busy;
}

// Text copied from the photo (iPhone Live Text, Google Lens) → read here on the device → edit form to check.
function openParsedText(text, kind, form, c) {
  const r = parseRecipeText(text);
  ui.prefillUrl = '';
  ui.newFolder = targetFolderId();
  ui.prefillSource = {
    title: r.title, servings: r.servings, time: r.time, notes: r.notes, steps: r.steps,
    ingredients: r.ingredients.map((i) => parseIngredient(i.raw)),
    source: { type: kind, book: kind === 'book' ? form.book.value.trim() : '', page: kind === 'book' ? form.page.value.trim() : '' },
    sourcePhotos: [...c.scans],
    findImageFor: r.title, lang: r.lang,
  };
  ui.edit = null;
  ui.capture = null;
  location.hash = '#/edit/new';
  if (route().name === 'edit') render();
}

// Look up a photo of the dish on Wikipedia and offer it as the cover.
async function lookForDishPhoto(edit, title, lang) {
  if (!title || !navigator.onLine) return;
  let found;
  try { found = await findDishImage(title, lang || getLang()); } catch { return; }
  if (!found || ui.edit !== edit || edit.photos.length) return;
  try {
    const res = await fetch(found.url);
    if (!res.ok) throw new Error('img');
    const path = await addPhoto(edit.id, await res.blob());
    if (ui.edit !== edit || edit.photos.length) return;
    edit.photos.push(path);
    edit.imageCredit = { ...found.credit, photo: path };
    refreshPhotoStrip();
    toast(t('photoFromWiki'));
  } catch {
    // the picture can't be downloaded from here: link it instead
    const inp = document.querySelector('#edit-form input[name=image]');
    if (ui.edit === edit && inp && !inp.value) {
      inp.value = found.url;
      edit.imageCredit = { ...found.credit, photo: found.url };
      toast(t('photoFromWiki'));
    }
  }
}

function openPhotoCapture() {
  const c = ui.capture = { id: uid(), kind: 'book', scans: [], busy: false };
  openModal(`
    <h2>${esc(t('fromPhoto'))}</h2>
    <div class="seg" role="radiogroup">
      <label><input type="radio" name="kind" value="book" checked> 📖 ${esc(t('srcBook'))}</label>
      <label><input type="radio" name="kind" value="note"> ✍️ ${esc(t('srcNote'))}</label>
    </div>
    <div class="photo-strip" id="scan-strip"></div>
    <p class="hint">${esc(t('captureHint'))}</p>
    <div class="two book-only">
      <label>${esc(t('bookTitle'))}<input name="book" list="books" autocomplete="off" placeholder="${esc(t('optional'))}"></label>
      <label>${esc(t('page'))}<input name="page" inputmode="numeric" autocomplete="off" placeholder="${esc(t('optional'))}"></label>
    </div>
    ${booksDatalist()}
    <details class="paste" ${c.pasteOpen ? 'open' : ''}>
      <summary>${esc(t('pasteText'))}</summary>
      <p class="hint small">${esc(t('pasteHint'))}</p>
      <textarea name="pasted" rows="7" placeholder="${esc(t('pasteTextPh'))}"></textarea>
    </details>
    <p class="hint small">${esc(t(isConfigured() ? 'captureFree' : 'importNeedsGithub'))}</p>
    <div class="button-row">
      <button class="btn primary" value="ok" disabled>${esc(t('readRecipe'))}</button>
      <button class="btn" value="cancel" formnovalidate>${esc(t('cancel'))}</button>
    </div>`, (form) => {
    const kind = form.kind.value;
    const pasted = form.pasted.value.trim();
    if (pasted) { openParsedText(pasted, kind, form, c); return; }
    if (!c.scans.length) return;
    upsert('queue', {
      id: c.id, type: 'photo', kind, scans: [...c.scans], status: 'pending', addedAt: Date.now(), folderId: targetFolderId(),
      book: kind === 'book' ? form.book.value.trim() : '', page: kind === 'book' ? form.page.value.trim() : '',
    }, { silent: true });
    ui.capture = null;
    changed();
  });
  modal.querySelector('form').classList.add('capture', 'is-book');
  refreshCapture();
  modal.onchange = async (e) => {
    const el = e.target;
    if (el.name === 'kind') modal.querySelector('form').classList.toggle('is-book', el.value === 'book');
    if (el.id === 'scan-input' && el.files.length) {
      const files = [...el.files];
      c.busy = true; refreshCapture();
      for (const f of files) {
        try { c.scans.push(await addScan(c.id, f)); } catch { toast(t('photoError')); }
      }
      c.busy = false; refreshCapture();
    }
  };
  modal.oninput = (e) => { if (e.target.name === 'pasted') refreshCapture(); };
  modal.onclick = (e) => {
    const b = e.target.closest('[data-action=scan-remove]');
    if (!b) return;
    c.scans.splice(+b.dataset.i, 1);
    refreshCapture();
  };
}

// ---------- barcode scanning ----------

const tt = (k, ...a) => esc(t(k, ...a));

function packText(p) {
  return p.packQty ? qtyText(p.packQty, p.packUnit) : '';
}

async function startScan() {
  const code = await scanBarcode($('#scanner'), tt);
  if (!code) return;
  const known = pantryByCode(code);
  if (known) openScanKnown(known);
  else openScanNew(code);
}

function earlier(a, b) { if (!a) return b || null; if (!b) return a; return a < b ? a : b; }

function openScanKnown(p) {
  const pack = p.packQty ? convert(p.packQty, p.packUnit || '', p.unit || '') : null;
  const step = pack && pack > 0 ? pack : 1;
  openModal(`
    <h2>${esc(p.name)}</h2>
    <p class="hint">${tt('alreadyInPantry', qtyText(num(p.qty) || 0, p.unit) || '0')}${p.packQty ? ` · ${tt('packSize')}: ${esc(packText(p))}` : ''}</p>
    <label>${tt('expiresNewPack')}<input name="expires" type="date"></label>
    <div class="button-row">
      <button class="btn primary" value="ok">＋ ${tt('addPack')}</button>
      <button class="btn" value="delete" formnovalidate>－ ${tt('usedPack')}</button>
      <button class="btn ghost" value="cancel" formnovalidate>${tt('cancel')}</button>
    </div>`, (form, action) => {
    if (action === 'delete') {
      upsert('pantry', { ...p, qty: Math.max(0, round((num(p.qty) || 0) - step)) }, { silent: true });
    } else {
      upsert('pantry', { ...p, qty: round((num(p.qty) || 0) + step), expires: earlier(p.expires, form.expires.value) }, { silent: true });
    }
    ensureLowItems();
    changed();
  });
}

// Pantry items (without this barcode) that look like the scanned product: "Latte" for "Latte intero UHT".
function linkCandidates(name, code) {
  if (!name) return [];
  const words = (x) => normalizeName(x).split(' ').filter((w) => w.length >= 4).map(singular);
  const pw = words(name);
  return live('pantry')
    .filter((p) => !hasCode(p, code))
    .map((p) => ({ p, score: namesMatch(p.name, name) ? 3 : words(p.name).filter((w) => pw.includes(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (codesOf(a.p).length - codesOf(b.p).length))
    .slice(0, 3)
    .map((x) => x.p);
}

function scanForm(code, info, state2) {
  const note = state2 === 'loading' ? `<p class="hint"><span class="spinner"></span> ${tt('lookingUp')}</p>`
    : state2 === 'notfound' ? `<p class="hint">${tt('notFoundOff')}</p>`
    : state2 === 'offline' ? `<p class="hint">${tt('offlineLookup')}</p>` : '';
  const u = info.unit || '';
  return `
    <h2>${tt('newProduct')}</h2>
    <p class="hint barcode-no">${info.brand ? `<strong>${esc(info.brand)}</strong> · ` : ''}${tt('barcode')}: ${esc(code)}</p>
    ${note}
    ${(() => {
      const cands = state2 === 'found' ? linkCandidates(info.name, code) : [];
      return cands.length ? `<div class="link-cands"><p>${tt('isItOneOfThese')}</p>${cands.map((p) => `<button type="button" class="btn small" data-action="link-cand" data-id="${esc(p.id)}">🔗 ${esc(p.name)} <small>${esc(qtyText(num(p.qty) || 0, p.unit) || '0')}</small></button>`).join('')}<p class="hint small">${tt('orNewProduct')}</p></div>` : '';
    })()}
    <label>${tt('name')}<input name="name" ${state2 === 'offline' ? '' : 'required'} value="${esc(info.name || '')}" autocomplete="off"></label>
    ${info.brand ? `<input type="hidden" name="brand" value="${esc(info.brand)}">` : '<input type="hidden" name="brand" value="">'}
    <div class="two">
      <label>${tt('packSize')}<input name="qty" inputmode="decimal" value="${esc(info.qty ?? 1)}"></label>
      <label>${tt('unit')}<select name="unit">${UNITS.map((x) => `<option value="${x}" ${x === u ? 'selected' : ''}>${esc(unitOptionLabel(x))}</option>`).join('')}</select></label>
    </div>
    <div class="two">
      <label>${tt('expires')}<input name="expires" type="date"></label>
      <label>${tt('minQty')}<input name="min" inputmode="decimal" placeholder="—"></label>
    </div>
    ${info.found ? `<p class="attrib">${tt('offAttribution')} <a href="https://world.openfoodfacts.org/product/${esc(code)}" target="_blank" rel="noopener">Open Food Facts</a></p>` : ''}
    <div class="button-row">
      <button class="btn primary" value="ok" ${state2 === 'loading' ? 'disabled' : ''}>${tt('addToPantry')}</button>
      <button class="btn" value="cancel" formnovalidate>${tt('cancel')}</button>
    </div>`;
}

function openScanNew(code) {
  let info = { qty: 1, unit: '' };
  let status = 'loading';
  openModal(scanForm(code, info, status), (form) => {
    const nameTyped = form.name.value.trim();
    const pending = status === 'offline' && !nameTyped;
    const name = nameTyped || t('productCode', code);
    const qty = num(form.qty.value) ?? 1;
    const unit = form.unit.value;
    const expires = form.expires.value || null;
    // Same product already in the pantry under that name (added by hand)? Attach the barcode to it.
    const twin = !pending && live('pantry').find((p) => !p.barcode && normalizeName(p.name) === normalizeName(name));
    if (twin) {
      const add = convert(qty, unit, twin.unit || '');
      upsert('pantry', {
        ...twin, ...withCode(twin, code), packQty: qty, packUnit: unit, cat: twin.cat || info.cat || null,
        qty: round((num(twin.qty) || 0) + (add ?? 0)), expires: earlier(twin.expires, expires),
      }, { silent: true });
      toast(t('mergedInto', twin.name));
    } else {
      upsert('pantry', {
        id: uid(), name, brand: form.brand.value || '', qty, unit, packQty: qty, packUnit: unit, barcode: code, barcodes: [code],
        expires, min: num(form.min.value), target: null, lookupPending: pending, nameFromCode: !nameTyped, cat: info.cat || null,
      }, { silent: true });
      toast(t('addedToPantry', name));
    }
    ensureLowItems();
    changed();
  });
  if (!navigator.onLine) { status = 'offline'; modal.querySelector('form').innerHTML = scanForm(code, info, status); return; }
  lookupProduct(code, getLang()).then((r) => {
    if (r.found) { info = r; status = 'found'; } else status = 'notfound';
  }).catch(() => { status = 'offline'; }).finally(() => {
    const f = modal.open && modal.querySelector('form');
    if (!f) return;
    // keep anything the user already typed
    const typed = { expires: f.expires?.value, min: f.min?.value };
    f.innerHTML = scanForm(code, info, status);
    if (typed.expires) f.expires.value = typed.expires;
    if (typed.min) f.min.value = typed.min;
    f.querySelector(status === 'found' ? 'input[name=expires]' : 'input[name=name]')?.focus();
  });
  modal.onclick = (e) => {
    const b = e.target.closest('[data-action=link-cand]');
    if (!b) return;
    const p = get('pantry', b.dataset.id);
    if (!p) return;
    const linked = upsert('pantry', {
      ...p, ...withCode(p, code), brand: p.brand || info.brand || '', cat: p.cat || info.cat || null,
      packQty: p.packQty || info.qty || null, packUnit: p.packQty ? p.packUnit : (info.unit || null),
    }, { silent: true });
    changed();
    toast(t('barcodeLinked', p.name));
    openScanKnown(linked);
  };
}

// Products scanned offline get their name once we're back online.
let resolving = false;
async function resolvePendingProducts() {
  if (resolving || !navigator.onLine) return;
  resolving = true;
  try {
    for (const p of live('pantry').filter((x) => x.lookupPending && x.barcode)) {
      let r;
      try { r = await lookupProduct(p.barcode, getLang()); } catch { break; }
      const cur = get('pantry', p.id);
      if (!cur) continue;
      if (r.found && cur.nameFromCode) {
        const unitOk = !cur.unit && r.unit;
        upsert('pantry', {
          ...cur, name: r.name, brand: r.brand || cur.brand || '', lookupPending: false, nameFromCode: false,
          ...(unitOk ? { qty: round((num(cur.qty) || 1) * r.qty), unit: r.unit, packQty: r.qty, packUnit: r.unit } : {}),
        }, { silent: true });
      } else {
        upsert('pantry', { ...cur, lookupPending: false }, { silent: true });
      }
    }
  } finally { resolving = false; }
  ensureLowItems();
  changed();
}

function openFolderEdit(folder, parentId = null) {
  const isNew = !folder;
  const f = folder || { id: uid(), name: '', parentId };
  let cover = f.cover || null;
  const coverBox = () => {
    const shown = cover || folderCover({ ...f, cover: null });
    return `${shown ? photoTag(shown) : '<span class="no-cover">📁</span>'}
      <div class="cover-actions">
        <label class="btn small"><input type="file" accept="image/*" id="folder-cover-input" hidden>${esc(t('chooseCover'))}</label>
        ${cover ? `<button type="button" class="btn small ghost" data-action="cover-auto">${esc(t('autoCover'))}</button>` : `<small>${esc(t('autoCoverHint'))}</small>`}
      </div>`;
  };
  const refreshCover = () => { const el = modal.querySelector('#cover-box'); if (el) { el.innerHTML = coverBox(); hydrate(el); } };
  openModal(`
    <h2>${esc(t(isNew ? 'newFolder' : 'editFolder'))}</h2>
    <div class="field-label">${esc(t('cover'))}</div>
    <div class="cover-box" id="cover-box"></div>
    <label>${esc(t('name'))}<input name="name" required value="${esc(f.name)}" autocomplete="off"></label>
    <label>${esc(t('insideFolder'))}<select name="parentId">${folderOptions(f.parentId || '', isNew ? new Set() : descendantIds(f.id))}</select></label>
    <div class="button-row">
      <button class="btn primary" value="ok">${esc(t('save'))}</button>
      <button class="btn" value="cancel" formnovalidate>${esc(t('cancel'))}</button>
      ${isNew ? '' : `<button class="btn danger" value="delete" formnovalidate>${esc(t('delete'))}</button>`}
    </div>`, (form, action) => {
    if (action === 'delete') { setTimeout(() => openFolderDelete(f), 0); return; }
    const name = form.name.value.trim();
    if (!name) return;
    upsert('folders', { ...f, name, parentId: form.parentId.value || null, cover }, { silent: true });
    changed();
  });
  refreshCover();
  modal.onchange = async (e) => {
    if (e.target.id !== 'folder-cover-input' || !e.target.files.length) return;
    try { cover = await addPhoto(`folder-${f.id}`, e.target.files[0]); } catch { toast(t('photoError')); }
    refreshCover();
  };
  modal.onclick = (e) => { if (e.target.closest('[data-action=cover-auto]')) { cover = null; refreshCover(); } };
  setTimeout(() => modal.querySelector('input[name=name]')?.focus(), 50);
}

function openFolderDelete(f) {
  const ids = descendantIds(f.id);
  const recipes = live('recipes').filter((r) => ids.has(recipeFolderId(r)));
  const subs = live('folders').filter((x) => x.id !== f.id && ids.has(x.id));
  const parent = f.parentId && folderOf(f.parentId) ? f.parentId : null;
  const parentName = parent ? folderOf(parent).name : t('allRecipes');
  openModal(`
    <h2>${esc(t('deleteFolderTitle', f.name))}</h2>
    <p>${esc(t('folderHolds', recipes.length, subs.length))}</p>
    ${recipes.length || subs.length ? `
    <label class="check"><input type="radio" name="mode" value="keep" checked> <span>${esc(t('deleteKeep', parentName))}</span></label>
    <label class="check"><input type="radio" name="mode" value="all"> <span>${esc(t('deleteAll', recipes.length))}</span></label>` : ''}
    <div class="button-row">
      <button class="btn danger" value="ok">🗑 ${esc(t('delete'))}</button>
      <button class="btn" value="cancel" formnovalidate>${esc(t('cancel'))}</button>
    </div>`, (form) => {
    const all = form.mode?.value === 'all';
    const inside = ids.has(currentFolderId());
    if (all) {
      if (recipes.length && !confirm(t('confirmDeleteRecipes', recipes.length))) return;
      for (const r of recipes) remove('recipes', r.id);
      for (const x of subs) remove('folders', x.id);
    } else {
      for (const r of live('recipes').filter((x) => x.folderId === f.id)) upsert('recipes', { ...r, folderId: parent }, { silent: true });
      for (const c of live('folders').filter((x) => x.parentId === f.id)) upsert('folders', { ...c, parentId: parent }, { silent: true });
    }
    if (state.settings.importFolder && (state.settings.importFolder === f.id || (all && ids.has(state.settings.importFolder)))) saveSettings({ importFolder: '' });
    remove('folders', f.id);
    if (inside) location.hash = folderHref(parent);
    changed();
    toast(t('folderDeleted'));
  });
}

const MAX_BOOK = 50 * 1024 * 1024;

function openBookImport() {
  let file = null;
  const folder = folderOf(state.settings.importFolder) ? state.settings.importFolder : '';
  openModal(`
    <h2>📚 ${esc(t('wholeBook'))}</h2>
    <p class="hint">${esc(t('bookIntro'))}</p>
    <label class="btn file-pick">${esc(t('chooseBook'))}<input type="file" id="book-input" accept=".pdf,.epub,application/pdf,application/epub+zip" hidden></label>
    <p class="book-file" id="book-file" aria-live="polite"></p>
    <label>${esc(t('bookTitle'))}<input name="title" id="book-title" autocomplete="off" placeholder="${esc(t('bookTitleAuto'))}"></label>
    <label>📁 ${esc(t('saveIn'))}<select name="folderId">${folderOptions(folder)}</select></label>
    <label class="check"><input type="checkbox" name="makeFolder" checked> <span>${esc(t('bookMakeFolder'))}</span></label>
    ${!isConfigured() ? `<p class="hint warn">${esc(t('bookNeedsGithub'))}</p>` : ''}
    <p class="hint small">${esc(t('bookHow'))}</p>
    <div class="button-row">
      <button class="btn primary" value="ok" disabled>${esc(t('bookStart'))}</button>
      <button class="btn" value="cancel" formnovalidate>${esc(t('cancel'))}</button>
    </div>`, async (form) => {
    if (!file) return;
    const ext = /\.epub$/i.test(file.name) || file.type === 'application/epub+zip' ? 'epub' : 'pdf';
    const id = `b${uid().slice(0, 10)}`;
    const path = `books/${id}.${ext}`;
    await addUpload(path, file);
    upsert('queue', {
      id, type: 'book', file: path, book: form.title.value.trim(), fileName: file.name,
      folderId: form.folderId.value || null, makeFolder: form.makeFolder.checked,
      status: 'pending', addedAt: Date.now(),
    }, { silent: true });
    changed();
    toast(t('bookQueued'));
  });
  modal.onchange = (e) => {
    if (e.target.id !== 'book-input') return;
    const f = e.target.files[0];
    const info = modal.querySelector('#book-file');
    const ok = modal.querySelector('button[value=ok]');
    file = null;
    ok.disabled = true;
    if (!f) { info.textContent = ''; return; }
    if (!/\.(pdf|epub)$/i.test(f.name) && !/pdf|epub/.test(f.type)) { info.innerHTML = `<span class="warn">${esc(t('errBookFormat'))}</span>`; return; }
    if (f.size > MAX_BOOK) { info.innerHTML = `<span class="warn">${esc(t('bookTooBig', Math.round(f.size / 1048576)))}</span>`; return; }
    file = f;
    info.textContent = `${f.name} · ${(f.size / 1048576).toFixed(1).replace('.', getLang() === 'en' ? '.' : ',')} MB`;
    const title = modal.querySelector('#book-title');
    if (!title.value) title.value = f.name.replace(/\.(pdf|epub)$/i, '').replace(/[-_]+/g, ' ').trim();
    ok.disabled = false;
  };
}

async function addPhotos(files) {
  const edit = ui.edit;
  edit.busy = true;
  refreshPhotoStrip();
  for (const f of files) {
    try { edit.photos.push(await addPhoto(edit.id, f)); } catch { toast(t('photoError')); }
  }
  edit.busy = false;
  if (ui.edit === edit) refreshPhotoStrip();
}

function queueImport(url) {
  if (!/^https?:\/\//i.test(url)) return;
  upsert('queue', { id: uid(), url, status: 'pending', addedAt: Date.now(), folderId: targetFolderId() }, { silent: true });
  changed();
}

function saveRecipe(form) {
  const id = ui.edit?.id || (form.dataset.id === 'new' ? uid() : form.dataset.id);
  const prev = get('recipes', id) || { createdAt: Date.now() };
  const lines = (v) => v.split('\n').map((s) => s.trim()).filter(Boolean);
  upsert('recipes', {
    ...prev, id,
    title: form.title.value.trim(),
    url: form.url.value.trim(),
    servings: Math.max(1, parseInt(form.servings.value, 10) || 4),
    time: form.time.value.trim(),
    prepMin: form.prepMin.value.trim() === '' ? undefined : Math.max(0, Math.round(+form.prepMin.value)),
    waitMin: form.waitMin.value.trim() === '' ? undefined : Math.max(0, Math.round(+form.waitMin.value)),
    image: form.image.value.trim(),
    ingredients: lines(form.ingredients.value).map(parseIngredient),
    steps: lines(form.steps.value),
    notes: form.notes.value.trim(),
    cuisine: form.cuisine ? form.cuisine.value.trim() : prev.cuisine,
    folderId: form.folderId.value || null,
    source: form.sourceType.value ? {
      type: form.sourceType.value,
      book: form.sourceType.value === 'book' ? form.book.value.trim() : '',
      page: form.sourceType.value === 'book' ? form.page.value.trim() : '',
    } : null,
    sourcePhotos: prev.sourcePhotos || ui.prefillSource?.sourcePhotos || [],
    imageCredit: ui.edit?.imageCredit || null,
    photoTried: prev.photoTried || (ui.edit?.photos?.length ? Date.now() : undefined),
    review: false,
    photos: [...(ui.edit?.photos || [])],
    parsed: true,
  }, { silent: true });
  // a picture from the web the phone couldn't download: the GitHub job keeps a copy
  const pend = ui.edit?.pendingImage;
  if (pend && form.image.value.trim() === pend.url && isConfigured()) {
    upsert('queue', { id: `im${uid().slice(0, 8)}`, type: 'image', recipeId: id, url: pend.url, referer: pend.referer || '', credit: pend.credit || null, status: 'pending', addedAt: Date.now() }, { silent: true });
  }
  ui.prefillUrl = '';
  ui.prefillSource = null;
  ui.edit = null;
  delete ui.servings[id];
  location.hash = `#/recipe/${encodeURIComponent(id)}`;
  changed();
}

async function saveGithub(form) {
  const typed = form.token.value.trim();
  await saveSettings({
    owner: form.owner.value.trim(), repo: form.repo.value.trim(),
    token: typed || state.settings.token, branch: form.branch.value.trim() || 'main', verified: false,
  });
  const res = await testConnection();
  ui.connMsg = res.ok ? 'connected' : `err_${res.error}`;
  if (res.ok) { await saveSettings({ verified: true }); ui.ghEdit = false; }
  render();
  if (res.ok) {
    await runSync();
    ui.connMsg = state.meta.lastError ? `err_${state.meta.lastError}` : 'connected';
    render();
  }
}

async function shareList() {
  const line = (i) => `• ${[qtyText(i.qty, i.unit), i.name].filter(Boolean).join(' ')}`;
  const text = listGroups(live('shopping').filter((i) => !i.checked))
    .map(([, label, items]) => [label, ...items.map(line)].filter(Boolean).join('\n')).join('\n\n');
  if (navigator.share) {
    try { await navigator.share({ title: t('tabList'), text }); return; } catch { /* cancelled */ return; }
  }
  try { await navigator.clipboard.writeText(text); toast(t('copied')); } catch { /* ignore */ }
}

function exportData() {
  const data = {};
  for (const c of COLLECTIONS) data[c] = state[c];
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ricette-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function applyLang(code) {
  setLang(code || detectLang());
  setDecimalSeparator(getLang() === 'en' ? '.' : ',');
}

// Links shared to the installed app (Android share sheet) arrive as ?url= or ?text=
function handleShareTarget() {
  const params = new URLSearchParams(location.search);
  const candidate = params.get('url') || params.get('text') || '';
  const match = candidate.match(/https?:\/\/\S+/);
  if (match) {
    queueImport(match[0]);
    history.replaceState(null, '', location.pathname + '#/import');
  }
}

// ---------- start ----------

// Served from https://<user>.github.io/<repo>/ → the data lives in that same repo.
async function autoConfigure() {
  const s = state.settings;
  if (s.owner && s.repo) return;
  const host = location.hostname;
  if (!host.endsWith('.github.io')) return;
  const owner = host.slice(0, -'.github.io'.length);
  const repo = location.pathname.split('/').filter(Boolean)[0] || `${owner}.github.io`;
  await saveSettings({ owner: s.owner || owner, repo: s.repo || repo });
}

async function start() {
  await load();
  await autoConfigure();
  applyLang(state.settings.lang);
  renderShell();
  render();
  handleShareTarget();
  ensureLowItems();
  onChange((kind) => { if (COLLECTIONS.includes(kind) || kind === 'meta') renderIfSafe(); else if (kind === 'meta-time') updateSyncBadge(); });
  window.addEventListener('hashchange', () => {
    if (route().name !== 'edit') ui.edit = null;
    if (route().name !== 'list') { ui.sel = null; ui.listQ = ''; }
    window.scrollTo(0, 0);
    render();
  });
  window.addEventListener('online', () => { runSync(); resolvePendingProducts(); });
  window.addEventListener('offline', () => updateSyncBadge());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') runSync(); });
  $('#sync').addEventListener('click', runSync);
  // the name at the top: back to all recipes (already there: back to the top, filters kept)
  $('#app-title').addEventListener('click', (e) => {
    if ((location.hash || '#/recipes') === '#/recipes') { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
  runSync().then(localReminder);
  resolvePendingProducts();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') localReminder(); });
  // Poll: every minute, every 15 s while imports are pending.
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    const pending = live('queue').some((q) => q.status === 'pending');
    const now = Date.now();
    if (pending || now - (start.lastPoll || 0) > 60_000) { start.lastPoll = now; runSync(); }
  }, 15_000);
  setupUpdates();
}

// ---------- app updates ----------

function showUpdateBar(worker) {
  let bar = $('#update-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'update-bar';
    bar.setAttribute('role', 'status');
    document.body.append(bar);
  }
  bar.innerHTML = `<span>${esc(t('updateReady'))}</span><button class="btn small primary" type="button">${esc(t('updateNow'))}</button>`;
  bar.querySelector('button').onclick = () => {
    bar.querySelector('button').disabled = true;
    ui.reloadOnUpdate = true;
    worker.postMessage({ type: 'SKIP_WAITING' });
  };
}

async function setupUpdates() {
  if (!('serviceWorker' in navigator)) return;
  let reg;
  try { reg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }); } catch { return; }
  const watch = (w) => {
    if (!w) return;
    const ready = () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdateBar(w); };
    ready();
    w.addEventListener('statechange', ready);
  };
  if (reg.waiting && navigator.serviceWorker.controller) {
    // opened from scratch while a new version was waiting: use it straight away
    ui.reloadOnUpdate = true;
    reg.waiting.postMessage({ type: 'SKIP_IF_ALONE' });
  }
  watch(reg.waiting);
  watch(reg.installing);
  reg.addEventListener('updatefound', () => watch(reg.installing));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (ui.reloadOnUpdate) { ui.reloadOnUpdate = false; location.reload(); }
  });
  // An installed app can stay open for days: look for a new version now and then.
  const check = () => { if (navigator.onLine) reg.update().catch(() => {}); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  setInterval(check, 30 * 60 * 1000);
}

start();
