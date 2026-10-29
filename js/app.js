import {
  state, load, live, get, upsert, remove, uid, onChange, saveSettings, COLLECTIONS,
} from './store.js';
import { syncNow, isConfigured, isSyncing, testConnection } from './sync.js';
import {
  parseIngredient, formatQty, scaleQty, convert, addQuantities, namesMatch, normalizeName, tidy,
  UNITS, stepFor, setDecimalSeparator,
} from './parse.js';
import { t, setLang, getLang, LANGS, unitLabel, unitOptionLabel, detectLang } from './i18n.js';
import { addPhoto, hydrate, prefetchAll, coverOf, isRepoPhoto } from './photos.js';

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

const TAB_OF = { recipes: 'recipes', recipe: 'recipes', edit: 'recipes', list: 'list', pantry: 'pantry', settings: 'settings' };

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

function ensureLowItems() {
  for (const p of state.pantry) {
    const id = `low_${p.id}`;
    const cur = state.shopping.find((s) => s.id === id);
    const low = p.deleted ? null : lowInfo(p);
    if (low) {
      if (!cur || cur.deleted || cur.checked) {
        upsert('shopping', { id, name: p.name, qty: low.buy, unit: p.unit || '', checked: false, auto: true, pantryId: p.id, sources: [] }, { silent: true });
      } else if (cur.qty !== low.buy || cur.name !== p.name || cur.unit !== (p.unit || '')) {
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
  if (checked && !stocked && it.qty != null) {
    const p = it.pantryId ? get('pantry', it.pantryId) : findPantry(it.name);
    const add = p ? convert(it.qty, it.unit, p.unit) : null;
    if (p && add != null) {
      upsert('pantry', { ...p, qty: round((num(p.qty) || 0) + add) }, { silent: true });
      stocked = { pantryId: p.id, amount: add };
    }
  }
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
      upsert('recipes', { ...r, parsed: true, ingredients: (r.ingredients || []).map((i) => parseIngredient(i.raw || '')) }, { silent: true });
      imported++;
    }
  }
  for (const q of live('queue')) {
    if (q.status === 'done' && Date.now() - (q.updatedAt || 0) > 60_000) remove('queue', q.id);
  }
  ensureLowItems();
  if (imported) toast(t('importedN', imported));
  prefetchAll();
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
  return `
  <form class="import" id="import-form">
    <input type="url" name="url" required placeholder="${esc(t('pasteLink'))}" inputmode="url" autocomplete="off">
    <button class="btn primary">${esc(t('import'))}</button>
  </form>
  ${!isConfigured() && queue.length ? `<p class="hint">${esc(t('importNeedsGithub'))}</p>` : ''}
  ${queue.map(queueItem).join('')}
  <div class="row">
    <input type="search" id="search" placeholder="${esc(t('search'))}" value="${esc(ui.search)}">
    <a class="btn" href="#/edit/new">+ ${esc(t('manual'))}</a>
  </div>
  <div class="cards" id="cards">${recipeCards()}</div>`;
}

function recipeCards() {
  const q = normalizeName(ui.search);
  const list = live('recipes')
    .filter((r) => !q || normalizeName(r.title).includes(q)
      || ingredientsOf(r).some((i) => normalizeName(i.name).includes(q)))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (!list.length) return q ? '' : `<p class="empty">${esc(t('noRecipes'))}</p>`;
  return list.map((r) => `
    <a class="card" href="#/recipe/${encodeURIComponent(r.id)}">
      <div class="thumb">${photoTag(coverOf(r), { fallback: r.image })}<span>${esc((r.title || '?').charAt(0))}</span></div>
      <div class="card-body">
        <div class="card-title">${esc(r.title)}</div>
        <div class="card-meta">${esc(t('people', r.servings || 4))}${r.time ? ` · ${esc(r.time)}` : ''}</div>
      </div>
    </a>`).join('');
}

function queueItem(q) {
  let host = q.url;
  try { host = new URL(q.url).hostname.replace(/^www\./, ''); } catch { /* keep url */ }
  if (q.status === 'error') {
    return `<div class="queue error">
      <div><strong>${esc(t('importFailed'))}</strong><br><small>${esc(host)}</small></div>
      <div class="actions">
        <button class="btn small" data-action="q-retry" data-id="${esc(q.id)}">${esc(t('retry'))}</button>
        <button class="btn small" data-action="q-manual" data-id="${esc(q.id)}">${esc(t('addManually'))}</button>
        <button class="btn small ghost" data-action="q-remove" data-id="${esc(q.id)}">${esc(t('remove'))}</button>
      </div></div>`;
  }
  const msg = isConfigured() && navigator.onLine && !state.meta.dirty ? t('importing') : t('importQueuedOffline');
  return `<div class="queue pending">
    <div><span class="spinner"></span> ${esc(msg)}<br><small>${esc(host)}</small></div>
    <div class="actions"><button class="btn small ghost" data-action="q-remove" data-id="${esc(q.id)}">${esc(t('remove'))}</button></div></div>`;
}

function viewRecipe(id) {
  const r = get('recipes', id);
  if (!r) return `<p class="empty">${esc(t('notFound'))}</p><a class="btn" href="#/recipes">${esc(t('back'))}</a>`;
  const base = r.servings || 4;
  const n = ui.servings[id] || base;
  const ings = ingredientsOf(r);
  return `
  <a class="back" href="#/recipes">← ${esc(t('back'))}</a>
  ${coverOf(r) ? `<div class="hero">${photoTag(coverOf(r), { fallback: r.image })}</div>` : ''}
  ${(r.photos || []).length > 1 ? `<div class="gallery">${r.photos.slice(1).map((p) => `<button class="shot" data-action="view-photo" data-src="${esc(p)}">${photoTag(p)}</button>`).join('')}</div>` : ''}
  <h1>${esc(r.title)}</h1>
  <div class="meta-line">
    ${r.time ? `<span>⏱ ${esc(r.time)}</span>` : ''}
    ${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(t('source'))} ↗</a>` : ''}
  </div>
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
  const r = isNew ? { title: '', url: ui.prefillUrl, servings: 4, ingredients: [], steps: [] } : get('recipes', id);
  if (!r) return `<p class="empty">${esc(t('notFound'))}</p>`;
  if (!ui.edit || ui.edit.route !== id) {
    ui.edit = { route: id, id: isNew ? uid() : id, photos: [...(r.photos || [])], busy: false };
  }
  const ingText = ingredientsOf(r).map((i) => i.raw || [formatQty(i.qty, i.unit), unitLabel(i.unit, i.qty), i.name].filter(Boolean).join(' ')).join('\n');
  return `
  <a class="back" href="${isNew ? '#/recipes' : `#/recipe/${encodeURIComponent(id)}`}">← ${esc(t('back'))}</a>
  <h1>${esc(t(isNew ? 'newRecipe' : 'editRecipe'))}</h1>
  <form id="edit-form" class="form" data-id="${esc(id)}">
    <div class="field-label">${esc(t('photos'))}</div>
    <div class="photo-strip" id="photo-strip">${photoStrip()}</div>
    <label>${esc(t('title'))}<input name="title" required value="${esc(r.title)}"></label>
    <label>${esc(t('url'))}<input name="url" type="url" value="${esc(r.url || '')}"></label>
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
  ${open.length ? `<ul class="list">${open.map(itemRow).join('')}</ul>
    <button class="btn" data-action="share-list">${esc(t('share'))}</button>` : `<p class="empty">${esc(t('listEmpty'))}</p>`}
  ${done.length ? `<h2>${esc(t('inCart'))} (${done.length})</h2><ul class="list done">${done.map(itemRow).join('')}</ul>
    <button class="btn" data-action="clear-checked">${esc(t('clearChecked'))}</button>` : ''}`;
}

function viewPantry() {
  const items = live('pantry').sort((a, b) => normalizeName(a.name).localeCompare(normalizeName(b.name)));
  return `
  <form id="add-pantry" class="row">
    <input name="item" id="add-pantry-input" required placeholder="${esc(t('addPantryPh'))}" autocomplete="off">
    <button class="btn primary" aria-label="+">+</button>
  </form>
  <p class="hint">${esc(t('pantryHint'))}</p>
  ${items.length ? `<ul class="list pantry">${items.map((p) => {
    const low = lowInfo(p);
    return `<li class="${low ? 'low' : ''}">
      <button class="name" data-action="p-edit" data-id="${esc(p.id)}">${esc(p.name)}${low ? ` <span class="badge warn">${esc(t('low'))}</span>` : ''}</button>
      <div class="stepper">
        <button class="round" data-action="p-dec" data-id="${esc(p.id)}" aria-label="−">−</button>
        <span class="q">${esc(qtyText(num(p.qty) || 0, p.unit) || '0')}</span>
        <button class="round" data-action="p-inc" data-id="${esc(p.id)}" aria-label="+">+</button>
      </div></li>`;
  }).join('')}</ul>` : `<p class="empty">${esc(t('pantryEmpty'))}</p>`}`;
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
      <label>${esc(t('repo'))}<input name="repo" value="${esc(s.repo)}" placeholder="ricette-data" autocapitalize="off" autocomplete="off" spellcheck="false"></label>
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
  <h2>${esc(t('backup'))}</h2>
  <button class="btn" data-action="export">${esc(t('exportData'))}</button>
  <p class="hint">${esc(t('installHint'))}</p>`;
}

// ---------- rendering ----------

function renderShell() {
  document.title = t('appName');
  $('#app-title').textContent = t('appName');
  for (const a of document.querySelectorAll('nav a')) {
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
  for (const a of document.querySelectorAll('nav a')) a.classList.toggle('active', a.dataset.tab === TAB_OF[r.name]);
  let html;
  switch (r.name) {
    case 'recipe': html = viewRecipe(r.id); break;
    case 'edit': html = viewEdit(r.id); break;
    case 'list': html = viewList(); break;
    case 'pantry': html = viewPantry(); break;
    case 'settings': html = viewSettings(); break;
    default: html = viewRecipes();
  }
  view.innerHTML = html;
  hydrate(view);
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) { if (typed != null && el.tagName === 'INPUT') el.value = typed; el.focus(); if (sel) try { el.setSelectionRange(...sel); } catch { /* not a text input */ } }
  }
  updateSyncBadge();
}

// Background changes shouldn't wipe a form the user is typing in.
function renderIfSafe() {
  const r = route();
  if (r.name === 'edit' || r.name === 'settings' || modal.open) return;
  render();
}

// ---------- dialogs ----------

function openModal(html, onSubmit) {
  modal.onchange = null;
  modal.innerHTML = `<form method="dialog" class="form">${html}</form>`;
  const form = modal.querySelector('form');
  form.addEventListener('submit', (e) => {
    const submitter = e.submitter;
    if (submitter && submitter.value === 'cancel') return;
    if (submitter && submitter.value === 'delete') { onSubmit(form, 'delete'); return; }
    onSubmit(form, 'ok');
  });
  modal.showModal();
}

modal.addEventListener('close', () => render());

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
  openModal(`
    <h2>${esc(p.name)}</h2>
    <label>${esc(t('name'))}<input name="name" required value="${esc(p.name)}"></label>
    <div class="two">
      <label>${esc(t('quantity'))}<input name="qty" inputmode="decimal" value="${esc(p.qty ?? '')}"></label>
      <label>${esc(t('unit'))}<select name="unit">${UNITS.map((u) => `<option value="${u}" ${u === (p.unit || '') ? 'selected' : ''}>${esc(unitOptionLabel(u))}</option>`).join('')}</select></label>
    </div>
    <label>${esc(t('minQty'))}<input name="min" inputmode="decimal" value="${esc(p.min ?? '')}"><small>${esc(t('minHint'))}</small></label>
    <label>${esc(t('target'))}<input name="target" inputmode="decimal" value="${esc(p.target ?? '')}"><small>${esc(t('targetHint'))}</small></label>
    <div class="button-row">
      <button class="btn primary" value="ok">${esc(t('save'))}</button>
      <button class="btn" value="cancel" formnovalidate>${esc(t('cancel'))}</button>
      <button class="btn danger" value="delete" formnovalidate>${esc(t('delete'))}</button>
    </div>`, (form, action) => {
    if (action === 'delete') { remove('pantry', p.id); ensureLowItems(); changed(); return; }
    upsert('pantry', {
      ...p, name: form.name.value.trim(), qty: num(form.qty.value) ?? 0, unit: form.unit.value,
      min: num(form.min.value), target: num(form.target.value),
    }, { silent: true });
    ensureLowItems();
    changed();
  });
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
  } else if (form.id === 'edit-form') {
    saveRecipe(form);
  } else if (form.id === 'gh-form') {
    saveGithub(form);
  }
});

view.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.action === 'toggle') setChecked(el.dataset.id, el.checked);
  if (el.id === 'photo-input' && el.files.length && ui.edit) addPhotos([...el.files]);
  if (el.name === 'lang' && el.form?.id === 'lang-form') {
    saveSettings({ lang: el.value });
    applyLang(el.value);
    renderShell();
    render();
  }
});

view.addEventListener('input', (e) => {
  if (e.target.id === 'search') {
    ui.search = e.target.value;
    $('#cards').innerHTML = recipeCards();
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
      ui.prefillUrl = q.url;
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
      const step = stepFor(p.unit);
      const qty = Math.max(0, round((num(p.qty) || 0) + (action === 'p-inc' ? step : -step)));
      upsert('pantry', { ...p, qty }, { silent: true });
      ensureLowItems();
      changed();
      break;
    }
    case 'p-edit': openPantryEdit(get('pantry', id)); break;
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
  upsert('queue', { id: uid(), url, status: 'pending', addedAt: Date.now() }, { silent: true });
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
    photos: [...(ui.edit?.photos || [])],
    parsed: true,
  }, { silent: true });
  ui.prefillUrl = '';
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

async function start() {
  await load();
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
  window.addEventListener('online', runSync);
  window.addEventListener('offline', () => updateSyncBadge());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') runSync(); });
  $('#sync').addEventListener('click', runSync);
  runSync();
  // Poll: every minute, every 15 s while imports are pending.
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    const pending = live('queue').some((q) => q.status === 'pending');
    const now = Date.now();
    if (pending || now - (start.lastPoll || 0) > 60_000) { start.lastPoll = now; runSync(); }
  }, 15_000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

start();
