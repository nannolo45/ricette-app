import {
  state, load, live, get, upsert, remove, uid, onChange, saveSettings, COLLECTIONS,
} from './store.js';
import { syncNow, isConfigured, isSyncing, testConnection } from './sync.js';
import {
  parseIngredient, formatQty, scaleQty, convert, addQuantities, namesMatch, normalizeName, tidy,
  UNITS, stepFor, setDecimalSeparator,
} from './parse.js';
import { t, setLang, getLang, LANGS, unitLabel, unitOptionLabel, detectLang } from './i18n.js';
import { addPhoto, addScan, hydrate, prefetchAll, coverOf, isRepoPhoto } from './photos.js';
import { daysUntil, expiryState, todayStr } from './expiry.js';
import { getOrCreateVapidPublicKey } from './sync.js';
import { scanBarcode } from './scanner.js';
import { parseRecipeText } from './recipe-text.js';
import { findDishImage } from './dish-image.js';
import { tagsOf, minutesOf, rankByPantry, pantryCoverage, autoTags } from './recipe-tools.js';
import { CATEGORIES, CATEGORY_IDS, categoryIcon, categorize, categoryOf } from './categories.js';
import { lookupProduct } from './products.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const round = (x) => Math.round(x * 1000) / 1000;
const num = (v) => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };

const view = $('#view');
const modal = $('#modal');
const ui = { servings: {}, search: '', prefillUrl: '', connMsg: '', edit: null };

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

const TAB_OF = { putaway: 'list', recipes: 'recipes', folder: 'recipes', suggest: 'recipes', recipe: 'recipes', edit: 'recipes', list: 'list', pantry: 'pantry', settings: 'settings' };

// ---------- folders ----------

const byTitle = (a, b) => (a.name || a.title || '').localeCompare(b.name || b.title || '', undefined, { sensitivity: 'base' });

function folderOf(id) { return id ? get('folders', id) : null; }

function currentFolderId() {
  const r = route();
  return r.name === 'folder' && folderOf(r.id) ? r.id : null;
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

function addToShopping({ name, qty, unit, note }, source) {
  const existing = live('shopping').find((s) => !s.checked && !s.auto && namesMatch(s.name, name)
    && addQuantities(s, { qty, unit }) !== null);
  if (existing) {
    const sum = addQuantities(existing, { qty, unit });
    const sources = [...new Set([...(existing.sources || []), source].filter(Boolean))];
    upsert('shopping', { ...existing, qty: sum.qty == null ? null : round(sum.qty), unit: sum.unit, sources }, { silent: true });
  } else {
    upsert('shopping', {
      id: uid(), name, qty: qty == null ? null : round(qty), unit: unit || '', note: note || '',
      checked: false, sources: source ? [source] : [], addedAt: Date.now(),
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
        upsert('shopping', { id, name: p.name, qty: low.buy, unit: p.unit || '', checked: false, auto: true, pantryId: p.id, sources: [] }, { silent: true });
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
    if (q.status === 'done' && Date.now() - (q.updatedAt || 0) > 60_000) remove('queue', q.id);
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

function viewRecipes() {
  const queue = live('queue').filter((q) => q.status !== 'done');
  const folderId = currentFolderId();
  const path = folderPath(folderId);
  return `
  <form class="import" id="import-form">
    <input type="url" name="url" required placeholder="${esc(t('pasteLink'))}" inputmode="url" autocomplete="off">
    <button class="btn primary">${esc(t('import'))}</button>
  </form>
  <button class="btn photo-import" data-action="photo-import">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.5" r="3.5"/></svg>
    ${esc(t('fromPhoto'))}</button>
  ${!isConfigured() && queue.length ? `<p class="hint">${esc(t('importNeedsGithub'))}</p>` : ''}
  ${queue.map(queueItem).join('')}
  <div class="row">
    <input type="search" id="search" placeholder="${esc(t('search'))}" value="${esc(ui.search)}">
  </div>
  <div class="toolbar">
    <label class="sort">⇅ <select id="sort" aria-label="${esc(t('sortBy'))}">${SORTS.map((k) => `<option value="${k}" ${k === sortKey() ? 'selected' : ''}>${esc(t(`sort_${k}`))}</option>`).join('')}</select></label>
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
      ${folderId ? `<button class="btn small ghost" data-action="folder-edit" data-id="${esc(folderId)}">${esc(t('edit'))}</button>` : ''}
      <button class="btn small" data-action="folder-new">+ ${esc(t('folder'))}</button>
      <button class="btn small" data-action="new-recipe">+ ${esc(t('manual'))}</button>
    </div>
  </div>
  <div id="cards">${cardsHtml()}</div>`;
}

// ---------- sorting, filters, tags ----------

const SORTS = ['new', 'old', 'az', 'za', 'quick', 'fewest', 'cooked', 'recent', 'pantry'];
function sortKey() { return SORTS.includes(state.settings.sort) ? state.settings.sort : 'new'; }

function filters() { return (ui.filters ||= { tags: [], source: '', maxTime: 0, ready: '' }); }
function filterCount() { const f = filters(); return f.tags.length + (f.source ? 1 : 0) + (f.maxTime ? 1 : 0) + (f.ready ? 1 : 0); }

function tagLabel(tag) { return tag.startsWith('auto:') ? t(`tag_${tag.slice(5)}`) : tag; }

function allTags() {
  const count = new Map();
  for (const r of live('recipes')) for (const tg of tagsOf(r)) count.set(tg, (count.get(tg) || 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || tagLabel(a[0]).localeCompare(tagLabel(b[0])));
}

function chip(label, action, value, on, extra = '') {
  return `<button type="button" class="chip ${on ? 'on' : ''}" data-action="${action}" data-value="${esc(value)}">${esc(label)}${extra}</button>`;
}

function filterPanel() {
  const f = filters();
  return `<div class="filter-panel">
    <div class="f-row"><span class="f-label">${esc(t('tags'))}</span>${allTags().map(([tg, n]) => chip(tagLabel(tg), 'f-tag', tg, f.tags.includes(tg), ` <small>${n}</small>`)).join('') || `<small>${esc(t('noTagsYet'))}</small>`}</div>
    <div class="f-row"><span class="f-label">${esc(t('sourceLabel'))}</span>${[['web', t('srcWeb')], ['book', `📖 ${t('srcBook')}`], ['note', `✍️ ${t('srcNote')}`]].map(([v, l]) => chip(l, 'f-source', v, f.source === v)).join('')}</div>
    <div class="f-row"><span class="f-label">${esc(t('time'))}</span>${[15, 30, 60].map((m) => chip(`≤ ${m} min`, 'f-time', m, f.maxTime === m)).join('')}</div>
    <div class="f-row"><span class="f-label">${esc(t('tabPantry'))}</span>${chip(t('readyNow'), 'f-ready', 'all', f.ready === 'all')}${chip(t('missingAtMost2'), 'f-ready', 'two', f.ready === 'two')}</div>
    ${filterCount() ? `<button type="button" class="btn small ghost" data-action="f-clear">${esc(t('clearFilters'))}</button>` : ''}
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
  const cov = (r) => { if (!coverage.has(r.id)) coverage.set(r.id, pantryCoverage(r, pantry, { basics: state.settings.basics !== false, expiringIds: exp })); return coverage.get(r.id); };
  // Searching or filtering looks through every folder; otherwise show this folder's recipes.
  let list = live('recipes').filter((r) => {
    if (!filtering) return recipeFolderId(r) === folderId;
    if (q && !(normalizeName(r.title).includes(q) || normalizeName(r.source?.book).includes(q)
      || tagsOf(r).some((tg) => normalizeName(tagLabel(tg)).includes(q))
      || ingredientsOf(r).some((i) => normalizeName(i.name).includes(q)))) return false;
    if (f.tags.length) { const tg = tagsOf(r); if (!f.tags.every((x) => tg.includes(x))) return false; }
    if (f.source && (r.source?.type || 'web') !== f.source) return false;
    if (f.maxTime) { const m = minutesOf(r.time); if (m == null || m > f.maxTime) return false; }
    if (f.ready) { const c = cov(r); if (!c.total || c.missing.length > (f.ready === 'all' ? 0 : 2)) return false; }
    return true;
  });
  const title = (r) => String(r.title || '');
  const sorters = {
    new: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
    old: (a, b) => (a.createdAt || 0) - (b.createdAt || 0),
    az: (a, b) => title(a).localeCompare(title(b), getLang()),
    za: (a, b) => title(b).localeCompare(title(a), getLang()),
    quick: (a, b) => (minutesOf(a.time) ?? 1e9) - (minutesOf(b.time) ?? 1e9),
    fewest: (a, b) => (a.ingredients || []).length - (b.ingredients || []).length,
    cooked: (a, b) => (b.cookedCount || 0) - (a.cookedCount || 0) || title(a).localeCompare(title(b)),
    recent: (a, b) => (b.lastCooked || 0) - (a.lastCooked || 0) || title(a).localeCompare(title(b)),
  };
  if (sortKey() === 'pantry') {
    const ranked = rankByPantry(list, pantry, { basics: state.settings.basics !== false, expiringIds: exp });
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
    const tags = tagsOf(r).slice(0, 3);
    return `
    <a class="card" href="#/recipe/${encodeURIComponent(r.id)}">
      <div class="thumb">${photoTag(coverOf(r), { fallback: r.image })}<span>${esc((r.title || '?').charAt(0))}</span></div>
      <div class="card-body">
        <div class="card-title">${esc(r.title)}</div>
        <div class="card-meta">${sourceIcon(r)}${esc(t('people', r.servings || 4))}${r.time ? ` · ${esc(r.time)}` : ''}</div>
        ${coverage.has(r.id) ? `<div class="card-meta">${coverageBadge(coverage.get(r.id))}</div>` : ''}
        ${tags.length ? `<div class="card-tags">${tags.map((tg) => `<span class="tag ${tg.startsWith('auto:') ? 'auto' : ''}">${esc(tagLabel(tg))}</span>`).join('')}</div>` : ''}
        ${filtering && recipeFolderId(r) ? `<div class="card-meta">📁 ${esc(folderPath(r.folderId).map((x) => x.name).join(' › '))}</div>` : ''}
      </div>
    </a>`;
  }).join('')}</div>`;
}

// ---------- what can I cook? ----------

function suggestions() {
  return rankByPantry(live('recipes'), live('pantry'), { basics: state.settings.basics !== false, expiringIds: expiringIds() });
}

function missingText(m) {
  if (m.have > 0 && m.need != null) return `${m.name} (${t('haveOf', qtyText(m.have, m.unit), qtyText(m.need, m.unit))})`;
  return m.name;
}

function viewSuggest() {
  const pantryEmpty = !live('pantry').some((p) => (num(p.qty) || 0) > 0);
  const ranked = pantryEmpty ? [] : suggestions().slice(0, 40);
  const expSoon = new Map(expiringItems().map((x) => [x.p.id, x.d]));
  return `
  <a class="back" href="#/recipes">← ${esc(t('allRecipes'))}</a>
  <h1>🍳 ${esc(t('whatToCook'))}</h1>
  <p class="hint">${esc(t('suggestHint'))}</p>
  <label class="check"><input type="checkbox" id="basics" ${state.settings.basics !== false ? 'checked' : ''}> ${esc(t('basicsAlways'))}</label>
  ${pantryEmpty ? `<p class="empty">${esc(t('pantryEmptyForSuggest'))}<br><a class="btn" href="#/pantry">${esc(t('tabPantry'))}</a></p>` : ''}
  ${!pantryEmpty && !ranked.length ? `<p class="empty">${esc(t('noRecipes'))}</p>` : ''}
  <ul class="suggest">${ranked.map(({ r, c }) => `
    <li>
      <a class="s-main" href="#/recipe/${encodeURIComponent(r.id)}">
        <span class="s-thumb">${photoTag(coverOf(r), { fallback: r.image })}<span>${esc((r.title || '?').charAt(0))}</span></span>
        <span class="s-text">
          <strong>${esc(r.title)}</strong>
          ${c.missing.length ? `<span class="missing">${esc(t('missingN', c.missing.length))}: ${esc(c.missing.map(missingText).join(', '))}</span>`
            : `<span class="have-all">✓ ${esc(t('haveAll'))}</span>`}
          ${c.uses.length ? `<span class="uses">♻️ ${esc(t('usesExpiring'))}: ${esc(c.uses.map((p) => `${p.name} (${expiryText(expSoon.get(p.id) ?? 0)})`).join(', '))}</span>` : ''}
        </span>
      </a>
      ${c.missing.length ? `<button class="btn small" data-action="add-missing" data-id="${esc(r.id)}">🛒 ${esc(t('addMissing'))}</button>` : ''}
    </li>`).join('')}</ul>`;
}

function addMissingToList(id) {
  const r = get('recipes', id);
  if (!r) return;
  const c = pantryCoverage(r, live('pantry'), { basics: state.settings.basics !== false });
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

function queueItem(q) {
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
  const n = ui.servings[id] || base;
  const ings = ingredientsOf(r);
  return `
  <a class="back" href="${folderHref(recipeFolderId(r))}">← ${esc(recipeFolderId(r) ? folderOf(r.folderId).name : t('allRecipes'))}</a>
  ${coverOf(r) ? `<div class="hero">${photoTag(coverOf(r), { fallback: r.image })}</div>` : ''}
  ${r.imageCredit && coverOf(r) === (r.imageCredit.photo || (r.photos || [])[0]) ? `<p class="credit">${esc(t('photoBy'))} <a href="${esc(r.imageCredit.url)}" target="_blank" rel="noopener">${esc([r.imageCredit.creator, r.imageCredit.license].filter(Boolean).join(', ') || r.imageCredit.title || '↗')}</a></p>` : ''}
  ${(r.photos || []).length > 1 ? `<div class="gallery">${r.photos.slice(1).map((p) => `<button class="shot" data-action="view-photo" data-src="${esc(p)}">${photoTag(p)}</button>`).join('')}</div>` : ''}
  <h1>${esc(r.title)}</h1>
  <div class="meta-line">
    ${sourceLabel(r.source) ? `<span class="src">${esc(sourceLabel(r.source))}</span>` : ''}
    ${r.time ? `<span>⏱ ${esc(r.time)}</span>` : ''}
    ${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(t('source'))} ↗</a>` : ''}
  </div>
  ${r.review ? `<div class="review"><span>${esc(t('reviewBanner'))}</span><a class="btn small primary" href="#/edit/${encodeURIComponent(id)}">${esc(t('reviewCheck'))}</a></div>` : ''}
  <div class="tag-row">
    ${tagsOf(r).map((tg) => `<span class="tag ${tg.startsWith('auto:') ? 'auto' : ''}">${esc(tagLabel(tg))}<button type="button" class="tag-x" data-action="tag-remove" data-id="${esc(id)}" data-value="${esc(tg)}" aria-label="${esc(t('remove'))}">×</button></span>`).join('')}
    <form class="tag-form" id="tag-form" data-id="${esc(id)}"><input name="tag" id="tag-input" list="all-tags" placeholder="+ ${esc(t('addTag'))}" autocomplete="off" maxlength="30"></form>
    <datalist id="all-tags">${[...new Set(live('recipes').flatMap((x) => x.tags || []))].sort().map((tg) => `<option value="${esc(tg)}">`).join('')}</datalist>
  </div>
  <label class="move">📁 <select data-action="move-recipe" data-id="${esc(id)}" aria-label="${esc(t('folder'))}">${folderOptions(recipeFolderId(r))}</select></label>
  <div class="servings">
    <button class="round" data-action="srv-dec" data-id="${esc(id)}" aria-label="−">−</button>
    <span>${esc(t('people', n))}</span>
    <button class="round" data-action="srv-inc" data-id="${esc(id)}" aria-label="+">+</button>
  </div>
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
  ${(r.steps || []).length ? `<h2>${esc(t('steps'))}</h2><ol class="steps">${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
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
    <div class="field-label">${esc(t('photos'))}</div>
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
      <label>${esc(t('time'))}<input name="time" value="${esc(r.time || '')}"></label>
    </div>
    <label>${esc(t('ingredients'))}<textarea name="ingredients" rows="10" placeholder="${esc(t('ingredientsHelp'))}">${esc(ingText)}</textarea></label>
    <label>${esc(t('steps'))}<textarea name="steps" rows="8" placeholder="${esc(t('stepsHelp'))}">${esc((r.steps || []).join('\n'))}</textarea></label>
    <label>${esc(t('notes'))}<textarea name="notes" rows="3">${esc(r.notes || '')}</textarea></label>
    <label>${esc(t('image'))}<input name="image" type="url" value="${esc(r.image || '')}"></label>
    <button class="btn primary">${esc(t('save'))}</button>
  </form>`;
}

function itemRow(i) {
  const src = i.auto ? `<span class="badge">${esc(t('fromPantry'))}</span>`
    : (i.sources || []).length ? `<small>${esc(i.sources.join(', '))}</small>` : '';
  return `<li class="${i.checked ? 'checked' : ''}">
    <label><input type="checkbox" data-action="toggle" data-id="${esc(i.id)}" ${i.checked ? 'checked' : ''}>
      <span class="item-text"><span class="q">${esc(qtyText(i.qty, i.unit))}</span> ${esc(i.name)} ${src}</span></label>
    <button class="icon" data-action="del-item" data-id="${esc(i.id)}" aria-label="${esc(t('remove'))}">×</button>
  </li>`;
}

function viewList() {
  const items = live('shopping');
  const byName = (a, b) => normalizeName(a.name).localeCompare(normalizeName(b.name));
  const open = items.filter((i) => !i.checked).sort(byName);
  const done = items.filter((i) => i.checked).sort(byName);
  return `
  <form id="add-item" class="row">
    <input name="item" id="add-item-input" required placeholder="${esc(t('addItemPh'))}" autocomplete="off">
    <button class="btn primary" aria-label="+">+</button>
  </form>
  ${open.length ? `${groupByDept(open, shopCat).map(([cat, items]) => `<h3 class="dept-h">${categoryIcon(cat)} ${esc(t(`cat_${cat}`))}</h3>
    <ul class="list">${items.map(itemRow).join('')}</ul>`).join('')}
    <button class="btn" data-action="share-list">${esc(t('share'))}</button>` : `<p class="empty">${esc(t('listEmpty'))}</p>`}
  ${done.length ? `<h2>${esc(t('inCart'))} (${done.length})</h2><ul class="list done">${done.map(itemRow).join('')}</ul>
    <div class="button-row">
      <button class="btn primary" data-action="put-away">📦 ${esc(t('putAway'))}</button>
      <button class="btn" data-action="clear-checked">${esc(t('clearChecked'))}</button>
    </div>
    <p class="hint small">${esc(t('putAwayExplain'))}</p>` : ''}`;
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

function shopCat(i) {
  const p = (i.pantryId && get('pantry', i.pantryId)) || live('pantry').find((x) => normalizeName(x.name) === normalizeName(i.name));
  return p ? categoryOf(p) : categorize(i.name);
}

function groupByDept(items, catOf) {
  const groups = new Map(CATEGORY_IDS.map((c) => [c, []]));
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
  <form class="form" id="gh-form">
    <div class="two">
      <label>${esc(t('owner'))}<input name="owner" value="${esc(s.owner)}" autocapitalize="off" autocomplete="off" spellcheck="false"></label>
      <label>${esc(t('repo'))}<input name="repo" value="${esc(s.repo)}" placeholder="ricette" autocapitalize="off" autocomplete="off" spellcheck="false"></label>
    </div>
    <label>${esc(t('token'))}<input name="token" type="password" value="${esc(s.token)}" autocomplete="off" spellcheck="false">
      <small>${esc(t('tokenHint'))}</small></label>
    <label>${esc(t('branch'))}<input name="branch" value="${esc(s.branch || 'main')}" autocapitalize="off"></label>
    ${ui.connMsg ? `<p class="conn ${ui.connMsg.startsWith('err') ? 'bad' : 'good'}">${esc(t(ui.connMsg))}</p>` : ''}
    <div class="button-row">
      <button class="btn primary">${esc(t('saveTest'))}</button>
      <button type="button" class="btn" data-action="sync-now">${esc(t('syncNow'))}</button>
    </div>
    <p class="hint">${esc(t('lastSync'))}: ${esc(last)}<br>${esc(t('setupHelp'))}</p>
  </form>
  <h2>${esc(t('reminders'))}</h2>
  <form class="form" id="remind-form">
    <label>${esc(t('remindDefault'))}<input name="remindDays" type="number" min="0" step="1" inputmode="numeric" value="${esc(remindDefault())}"></label>
  </form>
  ${notifySection()}
  <h2>${esc(t('backup'))}</h2>
  <button class="btn" data-action="export">${esc(t('exportData'))}</button>
  <p class="hint">${esc(t('installHint'))}</p>`;
}

// ---------- rendering ----------

function renderShell() {
  document.title = t('appName');
  $('#app-title').textContent = t('appName');
  for (const a of document.querySelectorAll('nav.tabs a')) {
    a.querySelector('.label').textContent = t(`tab${a.dataset.tab.charAt(0).toUpperCase()}${a.dataset.tab.slice(1)}`);
  }
  updateSyncBadge();
}

function render() {
  const r = route();
  const active = document.activeElement;
  const focusId = active && active.id;
  const typed = focusId && active.tagName === 'INPUT' ? active.value : null;
  let sel = null;
  try { sel = focusId && active.selectionStart != null ? [active.selectionStart, active.selectionEnd] : null; } catch { sel = null; }
  for (const a of document.querySelectorAll('nav.tabs a')) a.classList.toggle('active', a.dataset.tab === TAB_OF[r.name]);
  let html;
  switch (r.name) {
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
    if (el) { if (typed != null && el.tagName === 'INPUT') el.value = typed; el.focus(); if (sel) try { el.setSelectionRange(...sel); } catch { /* not a text input */ } }
  }
  updateSyncBadge();
}

// Background changes shouldn't wipe a form the user is typing in.
function renderIfSafe() {
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
  render();
});

function openAddToList(r) {
  const n = ui.servings[r.id] || r.servings || 4;
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
      const auto = autoTags(r).find((a) => t(`tag_${a}`).toLowerCase() === tag.toLowerCase());
      if (auto) upsert('recipes', { ...r, hiddenTags: (r.hiddenTags || []).filter((x) => x !== auto) }, { silent: true });
      else if (!(r.tags || []).some((x) => x.toLowerCase() === tag.toLowerCase())) upsert('recipes', { ...r, tags: [...(r.tags || []), tag] }, { silent: true });
      changed();
      $('#tag-input')?.focus();
    }
  } else if (form.id === 'edit-form') {
    saveRecipe(form);
  } else if (form.id === 'gh-form') {
    saveGithub(form);
  }
});

view.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.action === 'toggle') setChecked(el.dataset.id, el.checked);
  if (el.dataset.pa && ui.putaway) {
    const row = ui.putaway.rows[+el.dataset.i];
    row[el.dataset.pa] = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.pa === 'name') { row.pantryId = null; row.cat = null; }
    render();
  }
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
  if (e.target.id === 'search') {
    ui.search = e.target.value;
    $('#cards').innerHTML = cardsHtml();
    hydrate($('#cards'));
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
      const n = ui.servings[id] || r.servings || 4;
      ui.servings[id] = Math.max(1, n + (action === 'srv-inc' ? 1 : -1));
      render();
      break;
    }
    case 'to-list': openAddToList(get('recipes', id)); break;
    case 'cooked': {
      const r = get('recipes', id);
      const n = ui.servings[id] || r.servings || 4;
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
    case 'put-away': startPutAway(); break;
    case 'pa-scan': putAwayScan(); break;
    case 'dept-jump': document.getElementById(`dept-${btn.dataset.value}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); break;
    case 'toggle-filters': ui.showFilters = !ui.showFilters; render(); break;
    case 'f-tag': { const f = filters(); const v = btn.dataset.value; f.tags = f.tags.includes(v) ? f.tags.filter((x) => x !== v) : [...f.tags, v]; render(); break; }
    case 'f-source': { const f = filters(); f.source = f.source === btn.dataset.value ? '' : btn.dataset.value; render(); break; }
    case 'f-time': { const f = filters(); const v = +btn.dataset.value; f.maxTime = f.maxTime === v ? 0 : v; render(); break; }
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
    case 'folder-edit': openFolderEdit(get('folders', id)); break;
    case 'new-recipe':
      ui.newFolder = currentFolderId();
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
  ui.newFolder = currentFolderId();
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
      id: c.id, type: 'photo', kind, scans: [...c.scans], status: 'pending', addedAt: Date.now(), folderId: currentFolderId(),
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
    if (action === 'delete') {
      if (!confirm(t('confirmDeleteFolder', f.name))) return;
      const parent = f.parentId && folderOf(f.parentId) ? f.parentId : null;
      for (const r of live('recipes').filter((x) => x.folderId === f.id)) upsert('recipes', { ...r, folderId: parent }, { silent: true });
      for (const c of live('folders').filter((x) => x.parentId === f.id)) upsert('folders', { ...c, parentId: parent }, { silent: true });
      remove('folders', f.id);
      location.hash = folderHref(parent);
      changed();
      return;
    }
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
  upsert('queue', { id: uid(), url, status: 'pending', addedAt: Date.now(), folderId: currentFolderId() }, { silent: true });
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
    image: form.image.value.trim(),
    ingredients: lines(form.ingredients.value).map(parseIngredient),
    steps: lines(form.steps.value),
    notes: form.notes.value.trim(),
    folderId: form.folderId.value || null,
    source: form.sourceType.value ? {
      type: form.sourceType.value,
      book: form.sourceType.value === 'book' ? form.book.value.trim() : '',
      page: form.sourceType.value === 'book' ? form.page.value.trim() : '',
    } : null,
    sourcePhotos: prev.sourcePhotos || ui.prefillSource?.sourcePhotos || [],
    imageCredit: ui.edit?.imageCredit || null,
    review: false,
    photos: [...(ui.edit?.photos || [])],
    parsed: true,
  }, { silent: true });
  ui.prefillUrl = '';
  ui.prefillSource = null;
  ui.edit = null;
  delete ui.servings[id];
  location.hash = `#/recipe/${encodeURIComponent(id)}`;
  changed();
}

async function saveGithub(form) {
  await saveSettings({
    owner: form.owner.value.trim(), repo: form.repo.value.trim(),
    token: form.token.value.trim(), branch: form.branch.value.trim() || 'main',
  });
  const res = await testConnection();
  ui.connMsg = res.ok ? 'connected' : `err_${res.error}`;
  render();
  if (res.ok) {
    await runSync();
    ui.connMsg = state.meta.lastError ? `err_${state.meta.lastError}` : 'connected';
    render();
  }
}

async function shareList() {
  const text = live('shopping').filter((i) => !i.checked)
    .map((i) => `• ${[qtyText(i.qty, i.unit), i.name].filter(Boolean).join(' ')}`).join('\n');
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
    history.replaceState(null, '', location.pathname + '#/recipes');
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
  onChange((kind) => { if (COLLECTIONS.includes(kind) || kind === 'meta') renderIfSafe(); });
  window.addEventListener('hashchange', () => {
    if (route().name !== 'edit') ui.edit = null;
    window.scrollTo(0, 0);
    render();
  });
  window.addEventListener('online', () => { runSync(); resolvePendingProducts(); });
  window.addEventListener('offline', () => updateSyncBadge());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') runSync(); });
  $('#sync').addEventListener('click', runSync);
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
