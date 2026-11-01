// The recipe editor (v42): one page with a few cards instead of a long form.
// Ingredients and steps are rows you tap (or write as text), details open in place, tags are chips.
// What you change lives in ui.edit until you tap Salva; Annulla asks before throwing changes away.
// App-level helpers come in through setupEditView() (they still live in app.js); the rest is imported.
import { get, live } from '../store.js';
import { t, getLang, unitLabel, unitOptionLabel } from '../i18n.js';
import { formatQty, UNITS } from '../parse.js';
import { groupLines } from '../recipe-text.js';
import { recipeTimes } from '../times.js';
import { originOf } from '../geo.js';
import { foodOf, food as foodRec, foodName } from '../foods.js';
import { esc, num, fmtMin } from '../ui/format.js';
import { askConfirm } from '../ui/dialogs.js';

let c$ = null;
export function setupEditView(ctx) { c$ = ctx; }

const E = () => c$.ui.edit;
const lines = (v) => String(v || '').split('\n').map((s) => s.trim()).filter(Boolean);
const DRAFT = ['title', 'servings', 'time', 'prepMin', 'waitMin', 'folderId', 'url', 'sourceType', 'book', 'page', 'notes', 'cuisine', 'image'];

/* ---------- state ---------- */

function startEdit(id, r) {
  const isNew = id === 'new';
  const ings = c$.withFoods(c$.ingredientsOf(r).map((i) => ({ ...i })), r.ingredients || []);
  const steps = [...(r.steps || [])];
  c$.ui.edit = {
    route: id, id: isNew ? c$.uid() : id, isNew,
    photos: [...(r.photos || [])], photos0: (r.photos || []).join('|'), busy: false, imageCredit: r.imageCredit || null,
    draft: {}, dirty: false,
    ings, ingMode: ings.length ? 'rows' : 'text', ingText: '',
    steps, stepMode: steps.length ? 'rows' : 'text', stepText: '',
    tags: (r.tags || []).filter(Boolean), hidden: [...(r.hiddenTags || [])], tagInput: false,
  };
}

function markDirty() { if (E()) E().dirty = true; }
export function editIsDirty() {
  const e = E();
  return Boolean(e && (e.dirty || e.photos.join('|') !== e.photos0));
}
export function editMarkClean() { if (E()) { E().dirty = false; E().photos0 = E().photos.join('|'); } }

// the field's value: what you typed (kept across redraws), else the recipe's
function v(name, fallback) { const d = E().draft; return d[name] != null ? d[name] : fallback; }

/* ---------- ingredients ---------- */

function ingTextOf(ings) {
  let last = '';
  return ings.flatMap((i) => {
    const line = i.raw || rawOf(i);
    const g = i.group || '';
    const head = g && g !== last ? [`${g}:`] : [];
    last = g;
    return [...head, line];
  }).join('\n');
}
function rawOf(i) {
  const q = i.qty != null ? formatQty(i.qty, i.unit || '') : '';
  return `${[q, i.unit ? unitLabel(i.unit, i.qty) : '', i.name].filter(Boolean).join(' ')}${i.note ? `, ${i.note}` : ''}`;
}
function parseText(text, prev) { return c$.withFoods(c$.parseIngs(groupLines(lines(text))), prev); }

/** The ingredients as they stand now (rows, or the text being written). */
export function editIngredients() {
  const e = E();
  if (e.ingMode === 'text') return parseText(e.ingText, e.ings);
  return c$.withFoods(e.ings, e.ings);
}
export function editIngText() { const e = E(); return e ? (e.ingMode === 'text' ? e.ingText : ingTextOf(e.ings)) : ''; }

function foodIdOf(i) {
  if (i.food && foodRec(i.food)) return foodRec(i.food).id;
  if (i.foodPinned) return null;
  return foodOf(i.name || '');
}
function groupNames(ings = E().ings) { return [...new Set(ings.map((i) => i.group || '').filter(Boolean))]; }
// consecutive ingredients with the same group: one heading each, the way the recipe page shows them
function runs(ings) {
  const out = [];
  ings.forEach((i, n) => {
    const g = i.group || '';
    if (!out.length || out[out.length - 1].g !== g) out.push({ g, start: n, items: [] });
    out[out.length - 1].items.push(n);
  });
  return out;
}

function ingRowHtml(i, n) {
  const id = foodIdOf(i);
  const r = id ? foodRec(id) : null;
  const q = i.qty != null ? [formatQty(i.qty, i.unit || ''), i.unit ? unitLabel(i.unit, i.qty) : ''].filter(Boolean).join(' ') : '';
  const fname = foodName(id, getLang());
  const sub = r ? `${esc(fname.charAt(0).toUpperCase() + fname.slice(1))} · ${esc(t(`cat_${r.dept}`))}`
    : i.foodPinned ? esc(t('noFoodChosen')) : esc(t('foodTapToPick'));
  return `<li class="ing-row" data-sort-key="${n}">${c$.grip(`ig-${n}`, i.name)}
    <button type="button" class="ing-open" data-action="ing-open" data-i="${n}">
      <b class="ing-q">${esc(q)}</b>
      <span class="ing-main"><span class="ing-n">${esc(i.name)}${i.note ? ` <small>${esc(i.note)}</small>` : ''}</span>
      <small class="ing-food${r || i.foodPinned ? '' : ' unk'}">${sub}</small></span>
    </button></li>`;
}

function ingBoxHtml() {
  const e = E();
  if (e.ingMode === 'text') {
    return `<textarea name="ingredients" id="ing-text" rows="10" placeholder="${esc(t('ingredientsHelp'))}">${esc(e.ingText)}</textarea>
      <p class="hint small">${esc(t('ingTextHint'))}</p>
      <div class="ing-count" id="ing-count" aria-live="polite">${ingCountHtml(e.ingText)}</div>
      ${e.ings.length || e.ingText ? `<button type="button" class="btn" data-action="ing-text-done">${esc(t('done'))}</button>` : ''}`;
  }
  if (!e.ings.length) return `<p class="hint">${esc(t('noIngsYet'))}</p>${ingAddRow()}`;
  return `${runs(e.ings).map((run) => `${run.g ? `<div class="ing-group-head"><span>${esc(run.g)}</span>
      <button type="button" class="icon-btn" data-action="grp-menu" data-g="${esc(run.g)}" aria-label="${esc(t('groupMenu', run.g))}">⋯</button></div>` : ''}
    <ul class="ing-edit" data-sortable="edit-ings" data-group="${run.start}">${run.items.map((n) => ingRowHtml(e.ings[n], n)).join('')}</ul>`).join('')}
    ${ingAddRow()}`;
}
function ingAddRow() {
  return `<div class="add-row"><button type="button" class="btn" data-action="ing-add">+ ${esc(t('ingredient'))}</button>
    <button type="button" class="btn ghost dashed" data-action="grp-add">+ ${esc(t('group'))}</button></div>`;
}
function ingCountHtml(text) {
  const list = c$.parseIngs(groupLines(lines(text)));
  const groups = new Set(list.map((i) => i.group).filter(Boolean)).size;
  const unk = list.filter((i) => !foodOf(i.name || '')).length;
  return `${esc(t('nIngredients', list.length))} · ${esc(t('nGroups', groups))}${unk ? ` · <b class="warn-text">${esc(t('nToCheck', unk))}</b>` : ''}`;
}

function refreshIngs() {
  const box = document.getElementById('ing-box');
  if (box) box.innerHTML = ingBoxHtml();
  const head = document.getElementById('ing-mode');
  if (head) head.outerHTML = ingModeBtn();
  refreshNutrition();
  refreshTags();
}
function ingModeBtn() {
  const text = E().ingMode === 'text';
  return `<button type="button" class="chip" id="ing-mode" data-action="ing-mode">${esc(t(text ? 'asRows' : 'writeAsText'))}</button>`;
}
function refreshNutrition() {
  const el = document.getElementById('nutri-preview');
  const form = document.getElementById('edit-form');
  if (el && form) el.innerHTML = c$.nutritionLine(form.servings.value, editIngredients());
}

/** Where a new ingredient of group g goes: after the last one of that group (or at the end). */
function insertAt(ings, g) {
  for (let n = ings.length - 1; n >= 0; n--) if ((ings[n].group || '') === g) return n + 1;
  return ings.length;
}

function openIngSheet(n, defaultGroup) {
  const e = E();
  const isNew = n == null;
  const cur = isNew ? { qty: null, unit: '', name: '', note: '', ...(defaultGroup ? { group: defaultGroup } : {}) } : { ...e.ings[n] };
  let group = cur.group || '';
  const groups = [...new Set([...groupNames(), ...(group ? [group] : [])])];
  const fst = c$.foodState(isNew ? null : cur);
  const units = (UNITS.includes(cur.unit || '') ? UNITS : [...UNITS, cur.unit]);
  const chips = () => `${groups.map((g) => `<button type="button" class="chip${g === group ? ' on' : ''}" data-ia="grp" data-g="${esc(g)}">${esc(g)}</button>`).join('')}
    <button type="button" class="chip${group ? '' : ' on'}" data-ia="grp" data-g="">${esc(t('noGroup'))}</button>
    <button type="button" class="chip dashed" data-ia="grp-new">+ ${esc(t('newGroup'))}</button>`;
  c$.openModal(`<h2>${esc(t(isNew ? 'newIngredient' : 'ingredient'))}</h2>
    <label>${esc(t('ingNameLabel'))}<input name="name" required autocomplete="off" value="${esc(cur.name || '')}"></label>
    <div class="two">
      <div class="field"><span class="field-label">${esc(t('quantity'))}</span><div class="stepper">
        <button type="button" class="icon-btn" data-ia="dec" aria-label="${esc(t('fewerQty'))}">−</button>
        <input name="qty" inputmode="decimal" autocomplete="off" value="${cur.qty != null ? esc(String(cur.qty).replace('.', ',')) : ''}" aria-label="${esc(t('quantity'))}">
        <button type="button" class="icon-btn" data-ia="inc" aria-label="${esc(t('moreQty'))}">+</button></div></div>
      <label>${esc(t('unit'))}<select name="unit">${units.map((u) => `<option value="${esc(u)}" ${u === (cur.unit || '') ? 'selected' : ''}>${esc(u === '' ? '—' : unitOptionLabel(u))}</option>`).join('')}</select></label>
    </div>
    <label>${esc(t('ingDetail'))}<input name="note" autocomplete="off" value="${esc(cur.note || '')}" placeholder="${esc(t('ingDetailPh'))}"></label>
    <div class="field"><span class="field-label">${esc(t('group'))}</span><div class="chips" id="ing-groups">${chips()}</div>
      <input name="newGroup" id="new-group" hidden autocomplete="off" placeholder="${esc(t('newGroupPh'))}"></div>
    ${c$.foodFieldHtml(fst, cur.name || '')}
    <div class="button-row"><button class="btn primary" value="ok">${esc(t('save'))}</button>
      ${isNew ? `<button class="btn ghost" value="cancel" formnovalidate>${esc(t('cancel'))}</button>` : `<button class="btn ghost danger" value="delete" formnovalidate>${esc(t('delete'))}</button>`}</div>`, (form, action) => {
    if (action === 'delete') { e.ings.splice(n, 1); markDirty(); refreshIngs(); return; }
    const name = form.name.value.trim();
    if (!name) return;
    const qty = num(form.qty.value);
    const unit = form.unit.value;
    const note = form.note.value.trim();
    const g = form.newGroup.value.trim().replace(/:$/, '') || group;
    const same = !isNew && name === cur.name && qty === cur.qty && unit === (cur.unit || '') && note === (cur.note || '');
    let next = { ...cur, qty, unit, name, note };
    next.raw = same && cur.raw ? cur.raw : rawOf(next);
    if (g) next.group = g; else delete next.group;
    next = c$.applyFoodChoice(next, fst, name, c$.deptGuess(name), isNew ? '' : cur.name);
    if (isNew) e.ings.splice(insertAt(e.ings, g), 0, next);
    else if ((cur.group || '') !== g) { e.ings.splice(n, 1); e.ings.splice(insertAt(e.ings, g), 0, next); }
    else e.ings[n] = next;
    markDirty();
    refreshIngs();
  }, { sheet: true });
  const modal = c$.modal;
  const ff = modal.querySelector('#food-field');
  const nameOf = () => modal.querySelector('input[name=name]').value.trim();
  c$.wireFoodField(ff, fst, nameOf);
  modal.onclick = (ev) => {
    if (c$.foodFieldClick(ev, fst, ff, nameOf)) return;
    const b = ev.target.closest('[data-ia]');
    if (!b) return;
    const act = b.dataset.ia;
    if (act === 'grp') { group = b.dataset.g; modal.querySelector('#new-group').hidden = true; modal.querySelector('#new-group').value = ''; modal.querySelector('#ing-groups').innerHTML = chips(); }
    if (act === 'grp-new') { group = ''; modal.querySelector('#ing-groups').innerHTML = chips(); const inp = modal.querySelector('#new-group'); inp.hidden = false; inp.focus(); }
    if (act === 'dec' || act === 'inc') {
      const inp = modal.querySelector('input[name=qty]');
      const unit = modal.querySelector('select[name=unit]').value;
      const q = num(inp.value) || 0;
      const by = ['g', 'ml'].includes(unit) ? (q >= 100 ? 50 : 10) : (q < 1 && act === 'dec' ? 0.25 : 1);
      const nq = Math.max(0, Math.round((q + (act === 'inc' ? by : -by)) * 100) / 100);
      inp.value = nq ? String(nq).replace('.', ',') : '';
    }
  };
  if (isNew) modal.querySelector('input[name=name]').focus();
}

function openGroupMenu(g) {
  const e = E();
  const names = groupNames();
  const at = names.indexOf(g);
  c$.openModal(`<h2>${esc(g)}</h2>
    <label>${esc(t('groupName'))}<input name="gname" value="${esc(g)}" autocomplete="off" required></label>
    <div class="button-row"><button class="btn primary" value="ok">${esc(t('save'))}</button><button class="btn ghost" value="cancel" formnovalidate>${esc(t('cancel'))}</button></div>
    <div class="sheet-acts">
      <button type="button" class="btn" data-ga="add">+ ${esc(t('ingredientHere'))}</button>
      ${at > 0 ? `<button type="button" class="btn" data-ga="up">${esc(t('moveUp'))}</button>` : ''}
      ${at < names.length - 1 ? `<button type="button" class="btn" data-ga="down">${esc(t('moveDown'))}</button>` : ''}
      <button type="button" class="btn ghost danger" data-ga="ungroup">${esc(t('removeGroup'))}</button>
    </div>
    <p class="hint small">${esc(t('removeGroupHint'))}</p>`, (form) => {
    const nn = form.gname.value.trim().replace(/:$/, '');
    if (!nn || nn === g) return;
    e.ings = e.ings.map((i) => (i.group === g ? { ...i, group: nn } : i));
    markDirty(); refreshIngs();
  }, { sheet: true });
  c$.modal.onclick = (ev) => {
    const b = ev.target.closest('[data-ga]');
    if (!b) return;
    const act = b.dataset.ga;
    c$.modal.close();
    if (act === 'add') { openIngSheet(null, g); return; }
    if (act === 'ungroup') e.ings = e.ings.map((i) => { if (i.group !== g) return i; const { group: _g, ...rest } = i; return rest; });
    if (act === 'up' || act === 'down') {
      const order = [...names];
      const to = at + (act === 'up' ? -1 : 1);
      [order[at], order[to]] = [order[to], order[at]];
      const rank = (i) => (i.group ? order.indexOf(i.group) + 1 : 0);
      e.ings = e.ings.map((i, n) => ({ i, n })).sort((a, b) => rank(a.i) - rank(b.i) || a.n - b.n).map((x) => x.i);
    }
    markDirty(); refreshIngs();
  };
}

function openNewGroup() {
  c$.openModal(`<h2>${esc(t('newGroup'))}</h2>
    <label>${esc(t('groupName'))}<input name="gname" autocomplete="off" required placeholder="${esc(t('newGroupPh'))}"></label>
    <p class="hint small">${esc(t('newGroupHint'))}</p>
    <div class="button-row"><button class="btn primary" value="ok">${esc(t('next'))}</button><button class="btn ghost" value="cancel" formnovalidate>${esc(t('cancel'))}</button></div>`, (form) => {
    const g = form.gname.value.trim().replace(/:$/, '');
    if (g) setTimeout(() => openIngSheet(null, g), 0);
  }, { sheet: true });
  c$.modal.querySelector('input[name=gname]').focus();
}

/* ---------- steps ---------- */

function stepBoxHtml() {
  const e = E();
  if (e.stepMode === 'text') {
    return `<textarea name="steps" id="step-text" rows="8" placeholder="${esc(t('stepsHelp'))}">${esc(e.stepText)}</textarea>
      ${e.steps.length || e.stepText ? `<button type="button" class="btn" data-action="step-text-done">${esc(t('done'))}</button>` : ''}`;
  }
  return `<ol class="step-edit" data-sortable="edit-steps">${e.steps.map((s, n) => `<li class="step-card" data-sort-key="${n}">
      <span class="step-num" aria-hidden="true">${n + 1}</span>
      <div class="step-body"><textarea class="step-text" data-step="${n}" rows="${Math.max(2, Math.ceil(s.length / 38))}" aria-label="${esc(t('stepN', n + 1))}">${esc(s)}</textarea>
        <div class="step-acts">
          ${n > 0 ? `<button type="button" class="chip" data-action="step-up" data-i="${n}">${esc(t('moveUp'))}</button>` : ''}
          <button type="button" class="chip" data-action="step-split" data-i="${n}">${esc(t('splitStep'))}</button>
          <button type="button" class="chip danger" data-action="step-del" data-i="${n}">${esc(t('delete'))}</button>
        </div></div>
      ${c$.grip(`st-${n}`, t('stepN', n + 1))}</li>`).join('')}</ol>
    <button type="button" class="btn ghost dashed wide" data-action="step-add">+ ${esc(t('step'))}</button>`;
}
function refreshSteps(focus) {
  const box = document.getElementById('step-box');
  if (box) box.innerHTML = stepBoxHtml();
  const head = document.getElementById('step-mode');
  if (head) head.outerHTML = stepModeBtn();
  if (focus != null) document.querySelector(`#step-box [data-step="${focus}"]`)?.focus();
}
function stepModeBtn() {
  const text = E().stepMode === 'text';
  return `<button type="button" class="chip" id="step-mode" data-action="step-mode">${esc(t(text ? 'asRows' : 'writeAsText'))}</button>`;
}
export function editSteps() {
  const e = E();
  return e.stepMode === 'text' ? lines(e.stepText) : e.steps.map((s) => s.trim()).filter(Boolean);
}

/* ---------- tags ---------- */

function draftRecipe(r) {
  const form = document.getElementById('edit-form');
  return { ...r, title: form ? form.title.value : r.title, ingredients: E().ingMode === 'text' ? r.ingredients : E().ings, hiddenTags: [] };
}
function tagBoxHtml(r) {
  const e = E();
  const autos = c$.autoTags(draftRecipe(r), c$.tagDefs());
  const all = [...new Set(live('recipes').flatMap((x) => x.tags || []))].filter((x) => !e.tags.some((y) => y.toLowerCase() === x.toLowerCase())).sort();
  return `<div class="chips tag-chips">
    ${autos.map((a) => { const off = e.hidden.includes(a); return `<button type="button" class="chip auto${off ? ' off' : ''}" data-action="tag-auto" data-tag="${esc(a)}" aria-pressed="${off ? 'false' : 'true'}">${esc(c$.autoLabel(a))}</button>`; }).join('')}
    ${e.tags.map((tg, n) => `<span class="chip own">${esc(tg)}<button type="button" class="tag-x" data-action="tag-x" data-i="${n}" aria-label="${esc(t('removeTag', tg))}">×</button></span>`).join('')}
    ${e.tagInput ? `<input id="own-tag-new" class="tag-input" list="all-tags" autocomplete="off" placeholder="${esc(t('ownTagsPh'))}" enterkeyhint="done">
      <datalist id="all-tags">${all.map((tg) => `<option value="${esc(tg)}">`).join('')}</datalist>`
    : `<button type="button" class="chip dashed" data-action="tag-add">+ ${esc(t('tag'))}</button>`}
  </div>${autos.length ? `<p class="hint small">${esc(t('autoTagsEditHint'))}</p>` : ''}`;
}
function refreshTags(focusInput) {
  const box = document.getElementById('tag-box');
  if (!box) return;
  box.innerHTML = tagBoxHtml(E().isNew ? {} : get('recipes', E().route) || {});
  if (focusInput) box.querySelector('#own-tag-new')?.focus();
}
function addOwnTags(text) {
  const e = E();
  for (const raw of String(text || '').split(',')) {
    const tg = raw.trim().replace(/\s+/g, ' ');
    if (tg && !e.tags.some((x) => x.toLowerCase() === tg.toLowerCase())) e.tags.push(tg);
  }
}
export function editTags() {
  const e = E();
  const inp = document.getElementById('own-tag-new');
  if (inp && inp.value.trim()) addOwnTags(inp.value);
  return { tags: [...e.tags], hiddenTags: [...e.hidden] };
}

/* ---------- details: rows that open in place ---------- */

function timeSummary(r) {
  const form = document.getElementById('edit-form');
  const get$ = (n, d) => (form ? form[n].value : d);
  const prep = num(get$('prepMin', v('prepMin', r.prepMin ?? '')));
  const wait = num(get$('waitMin', v('waitMin', r.waitMin ?? '')));
  const est = recipeTimes({ ...r, ingredients: E().ings, steps: editSteps(), prepMin: prep ?? undefined, waitMin: wait ?? undefined });
  const typed = get$('time', v('time', r.time || ''));
  if (!est.total && !typed) return t('notSet');
  return `${est.estimated ? '≈ ' : ''}${typed && !Number.isFinite(prep) ? typed : fmtMin(est.total)}${est.active ? ` · ${t('nActive', fmtMin(est.active))}` : ''}`;
}
function folderSummary(id) { const f = id ? c$.folderOf(id) : null; return f ? f.name : t('allRecipes'); }
function sourceSummary(type, book, page, url) {
  if (type === 'book') return [book || t('srcBook'), page ? t('pageN', page) : ''].filter(Boolean).join(' · ');
  if (type === 'note') return t('srcNote');
  if (url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } }
  return t('notSet');
}
function originSummary(r, typed) {
  if (typed) return typed;
  const o = originOf({ ...r, cuisine: '' });
  return o ? `${o.country ? c$.countryName(o.country) : t(`cont_${o.continent}`)} (${t('estShort')})` : t('notSet');
}
function updateSummaries() {
  const form = document.getElementById('edit-form');
  if (!form || !E()) return;
  const r = E().isNew ? {} : get('recipes', E().route) || {};
  const set = (k, txt) => { const el = form.querySelector(`[data-sum="${k}"]`); if (el) el.textContent = txt; };
  set('time', timeSummary(r));
  set('folder', folderSummary(form.folderId.value));
  set('source', sourceSummary(form.sourceType.value, form.book.value.trim(), form.page.value.trim(), form.url.value.trim()));
  set('origin', originSummary({ ...r, title: form.title.value, ingredients: E().ings }, form.cuisine.value.trim()));
  set('notes', form.notes.value.trim().split('\n')[0] || t('notSet'));
}
const chev = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
function row(key, label, value, body) {
  return `<details class="erow" data-row="${key}"><summary><span class="erow-l">${esc(label)}</span><span class="erow-v" data-sum="${key}">${esc(value)}</span>${chev}</summary>
    <div class="erow-body">${body}</div></details>`;
}

/* ---------- the page ---------- */

export function viewEdit(id) {
  const isNew = id === 'new';
  const ui = c$.ui;
  const r = isNew ? { title: '', url: ui.prefillUrl, servings: 4, ingredients: [], steps: [], folderId: ui.newFolder || null, ...(ui.prefillSource || {}) } : get('recipes', id);
  if (!r) return `<p class="empty">${esc(t('notFound'))}</p>`;
  if (!ui.edit || ui.edit.route !== id) {
    startEdit(id, r);
    if (isNew && ui.prefillSource?.findImageFor) c$.lookForDishPhoto(ui.edit, ui.prefillSource.findImageFor, ui.prefillSource.lang);
  }
  const e = E();
  const src = { type: v('sourceType', r.source?.type || ''), book: v('book', r.source?.book || ''), page: v('page', r.source?.page || '') };
  const folderId = v('folderId', c$.recipeFolderId(r) || '');
  const est = recipeTimes({ ...r, prepMin: undefined, waitMin: undefined });
  const origGuess = (() => { const o = originOf({ ...r, cuisine: '' }); return o ? (o.country ? c$.countryName(o.country) : t(`cont_${o.continent}`)) : t('originUnknown'); })();
  const srcPhotos = r.sourcePhotos || ui.prefillSource?.sourcePhotos || [];
  const back = isNew ? c$.folderHref(ui.newFolder) : `#/recipe/${encodeURIComponent(id)}`;
  const cuisine = v('cuisine', [].concat(r.cuisine || []).join(', '));
  const notes = v('notes', r.notes || '');
  const url = v('url', r.url || '');
  return `
  <form id="edit-form" class="form edit-page" data-id="${esc(id)}" data-back="${esc(back)}">
    <div class="edit-bar">
      <button class="btn primary edit-save">${esc(t('save'))}</button>
      <button type="button" class="link-btn edit-cancel" data-action="edit-cancel">${esc(t('cancel'))}</button>
      <h1 class="edit-title">${esc(t(isNew ? 'newRecipe' : 'editRecipe'))}</h1>
    </div>

    <div class="photo-row">
      <div class="photo-strip" id="photo-strip">${c$.photoStrip()}</div>
      <button type="button" class="shot search" data-action="photo-search"><span aria-hidden="true">🔍</span><span>${esc(t('searchOnlineShort'))}</span></button>
    </div>

    <label>${esc(t('title'))}<input name="title" class="title-input" required value="${esc(v('title', r.title || ''))}"></label>

    <div class="ecard">
      <div class="erow static"><span class="erow-l">${esc(t('servingsLabel'))}</span>
        <span class="stepper small"><button type="button" class="icon-btn" data-action="ed-srv" data-d="-1" aria-label="${esc(t('fewerPeople'))}">−</button>
        <input name="servings" type="number" min="1" step="1" inputmode="numeric" value="${esc(v('servings', r.servings || 4))}" aria-label="${esc(t('servingsLabel'))}">
        <button type="button" class="icon-btn" data-action="ed-srv" data-d="1" aria-label="${esc(t('morePeople'))}">+</button></span></div>
      ${row('time', t('timeRow'), '', `
        <label>${esc(t('totalTimeLabel'))}<input name="time" value="${esc(v('time', r.time || ''))}" placeholder="${esc(t('timePh'))}"></label>
        <div class="two times-edit">
          <label>🔪 ${esc(t('activeTimeLabel'))} <small>(min)</small><input name="prepMin" id="prep-min" type="number" min="0" step="1" inputmode="numeric" value="${esc(v('prepMin', Number.isFinite(r.prepMin) ? r.prepMin : ''))}" placeholder="${est.active}"></label>
          <label>⏳ ${esc(t('waitTimeLabel'))} <small>(min)</small><input name="waitMin" id="wait-min" type="number" min="0" step="1" inputmode="numeric" value="${esc(v('waitMin', Number.isFinite(r.waitMin) ? r.waitMin : ''))}" placeholder="${est.waiting}"></label>
        </div>
        <p class="hint small">${esc(t('timesEditHint'))}</p>`)}
      ${row('folder', t('folder'), folderSummary(folderId), `<label class="sr-label">${esc(t('folder'))}<select name="folderId">${c$.folderOptions(folderId)}</select></label>`)}
      ${row('source', t('sourceLabel'), sourceSummary(src.type, src.book, src.page, url), `
        <div class="source-fields ${src.type === 'book' ? 'is-book' : ''}">
          <label>${esc(t('sourceLabel'))}<select name="sourceType">
            <option value="">${esc(t('srcWeb'))}</option>
            <option value="book" ${src.type === 'book' ? 'selected' : ''}>📖 ${esc(t('srcBook'))}</option>
            <option value="note" ${src.type === 'note' ? 'selected' : ''}>✍️ ${esc(t('srcNote'))}</option>
          </select></label>
          <div class="two book-only">
            <label>${esc(t('bookTitle'))}<input name="book" value="${esc(src.book)}" list="books"></label>
            <label>${esc(t('page'))}<input name="page" value="${esc(src.page)}" inputmode="numeric"></label>
          </div>
          <label>${esc(t('url'))}<input name="url" type="url" value="${esc(url)}"></label>
        </div>${c$.booksDatalist()}`)}
    </div>

    <div class="sec-head"><h2>${esc(t('ingredients'))}</h2>${ingModeBtn()}</div>
    <div id="ing-box">${ingBoxHtml()}</div>
    <p class="nutri-preview" id="nutri-preview" aria-live="polite">${c$.nutritionLine(v('servings', r.servings || 4), editIngredients())}</p>

    <div class="sec-head"><h2>${esc(t('steps'))}</h2>${stepModeBtn()}</div>
    <div id="step-box">${stepBoxHtml()}</div>

    <div class="sec-head"><h2>${esc(t('tagsAndOrigin'))}</h2></div>
    <div id="tag-box">${tagBoxHtml(r)}</div>
    <div class="ecard">
      ${row('origin', `🌍 ${t('originLabel')}`, originSummary(r, cuisine), `<label class="sr-label">${esc(t('originLabel'))}<input name="cuisine" value="${esc(cuisine)}" placeholder="${esc(t('originPh', origGuess))}" autocomplete="off"></label><small class="hint">${esc(t('originHint'))}</small>`)}
      ${row('notes', t('notes'), notes.split('\n')[0] || t('notSet'), `<label class="sr-label">${esc(t('notes'))}<textarea name="notes" rows="4">${esc(notes)}</textarea></label>`)}
    </div>

    <details class="erow more">
      <summary><span class="erow-l">${esc(t('origPhotosAndLink'))}</span>${chev}</summary>
      <div class="erow-body">
        ${srcPhotos.length ? `<div class="field-label">${esc(t('originalForCheck'))}</div>
          <div class="gallery">${srcPhotos.map((p) => `<button type="button" class="shot page" data-action="view-photo" data-src="${esc(p)}">${c$.photoTag(p)}</button>`).join('')}</div>` : ''}
        <label>${esc(t('image'))}<input name="image" type="url" value="${esc(v('image', r.image || ''))}"></label>
      </div>
    </details>
    ${isNew ? '' : `<button type="button" class="btn ghost danger wide" data-action="edit-delete">${esc(t('deleteRecipe'))}</button>`}
  </form>`;
}

/** After the page is drawn: fill in the summaries that depend on the form. */
export function afterEditRender() {
  updateSummaries();
  // a recipe that arrived for checking (paste, photo): open the source row so it's clear where it came from
}

/* ---------- events (called from app.js) ---------- */

export function editInput(ev) {
  const el = ev.target;
  if (!el.closest('#edit-form') || !E()) return;
  const e = E();
  if (el.name && DRAFT.includes(el.name)) e.draft[el.name] = el.value;
  if (el.id === 'own-tag-new') return; // a tag only counts once it's added
  e.dirty = true;
  if (el.dataset.step != null) e.steps[+el.dataset.step] = el.value;
  if (el.id === 'step-text') e.stepText = el.value;
  if (el.id === 'ing-text') {
    e.ingText = el.value;
    const c = document.getElementById('ing-count');
    if (c) c.innerHTML = ingCountHtml(el.value);
  }
  if (el.name === 'sourceType') el.closest('.source-fields')?.classList.toggle('is-book', el.value === 'book');
  if (el.id === 'ing-text' || el.name === 'servings') refreshNutrition();
  updateSummaries();
}

export function editKeydown(ev) {
  const el = ev.target;
  if (el.id === 'own-tag-new' && (ev.key === 'Enter' || ev.key === ',')) {
    ev.preventDefault();
    addOwnTags(el.value);
    markDirty();
    refreshTags(true);
    return true;
  }
  if (el.id === 'own-tag-new' && ev.key === 'Escape') { E().tagInput = false; refreshTags(); return true; }
  return false;
}

export function editFocusOut(ev) {
  const el = ev.target;
  if (el.id === 'own-tag-new' && el.isConnected) {
    if (el.value.trim()) { addOwnTags(el.value); el.value = ''; markDirty(); }
    // a redraw that puts a fresh field back in focus isn't leaving it
    setTimeout(() => { if (!E() || document.activeElement?.id === 'own-tag-new') return; E().tagInput = false; refreshTags(); }, 0);
  }
}

/** Clicks inside the editor; true when the click was the editor's own. */
export function editClick(btn) {
  const e = E();
  if (!e || !btn.closest('#edit-form')) return false;
  const i = btn.dataset.i != null ? +btn.dataset.i : null;
  switch (btn.dataset.action) {
    case 'edit-cancel': cancelEdit(); return true;
    case 'edit-delete': if (!e.isNew) { editMarkClean(); c$.deleteRecipeUndoable(e.route); } return true;
    case 'ed-srv': {
      const inp = btn.closest('.stepper').querySelector('input');
      inp.value = Math.max(1, (parseInt(inp.value, 10) || 1) + +btn.dataset.d);
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    case 'ing-open': openIngSheet(i); return true;
    case 'ing-add': openIngSheet(null, groupNames().slice(-1)[0] || ''); return true;
    case 'grp-add': openNewGroup(); return true;
    case 'grp-menu': openGroupMenu(btn.dataset.g); return true;
    case 'ing-mode':
      if (e.ingMode === 'text') { e.ings = parseText(e.ingText, e.ings); e.ingMode = 'rows'; } else { e.ingText = ingTextOf(e.ings); e.ingMode = 'text'; }
      refreshIngs();
      if (e.ingMode === 'text') document.getElementById('ing-text')?.focus();
      return true;
    case 'ing-text-done': e.ings = parseText(e.ingText, e.ings); e.ingMode = 'rows'; refreshIngs(); return true;
    case 'step-mode':
      if (e.stepMode === 'text') { e.steps = lines(e.stepText); e.stepMode = 'rows'; } else { e.stepText = e.steps.join('\n'); e.stepMode = 'text'; }
      refreshSteps();
      return true;
    case 'step-text-done': e.steps = lines(e.stepText); e.stepMode = 'rows'; refreshSteps(); return true;
    case 'step-add': e.steps.push(''); markDirty(); refreshSteps(e.steps.length - 1); return true;
    case 'step-del': e.steps.splice(i, 1); markDirty(); refreshSteps(); return true;
    case 'step-up': if (i > 0) { [e.steps[i - 1], e.steps[i]] = [e.steps[i], e.steps[i - 1]]; markDirty(); refreshSteps(i - 1); } return true;
    case 'step-split': {
      const ta = document.querySelector(`#step-box [data-step="${i}"]`);
      const s = e.steps[i] || '';
      let at = ta && ta.selectionStart > 0 && ta.selectionStart < s.length ? ta.selectionStart : -1;
      if (at < 0) { const m = s.slice(0, -1).search(/[.!?;]\s+\S[^.!?;]*$/); at = m >= 0 ? m + 1 : Math.floor(s.length / 2); }
      const a = s.slice(0, at).trim(); const b = s.slice(at).trim();
      if (!a || !b) return true;
      e.steps.splice(i, 1, a, b);
      markDirty(); refreshSteps(i + 1);
      return true;
    }
    case 'tag-auto': {
      const a = btn.dataset.tag;
      e.hidden = e.hidden.includes(a) ? e.hidden.filter((x) => x !== a) : [...e.hidden, a];
      markDirty(); refreshTags();
      return true;
    }
    case 'tag-x': e.tags.splice(i, 1); markDirty(); refreshTags(); return true;
    case 'tag-add': e.tagInput = true; refreshTags(true); return true;
    default: return false;
  }
}

/** A row or step dragged to a new place. */
export function editSorted(kind, group, keys) {
  const e = E();
  if (!e) return;
  if (kind === 'edit-ings') {
    const start = +group;
    const old = [...e.ings];
    keys.forEach((k, n) => { e.ings[start + n] = old[+k]; });
    markDirty(); refreshIngs();
  } else if (kind === 'edit-steps') {
    const old = [...e.steps];
    e.steps = keys.map((k) => old[+k]);
    markDirty(); refreshSteps();
  }
}

async function cancelEdit() {
  const form = document.getElementById('edit-form');
  const back = form?.dataset.back || '#/recipes';
  if (editIsDirty() && !(await askConfirm({ text: t('discardChangesText'), ok: t('discardChanges'), danger: true }))) return;
  editMarkClean();
  location.hash = back;
}

/** Leaving the editor some other way (a tab, the back button) with changes: ask first. */
export async function confirmLeaveEdit() {
  if (!editIsDirty()) return true;
  const ok = await askConfirm({ text: t('discardChangesText'), ok: t('discardChanges'), danger: true });
  if (ok) editMarkClean();
  return ok;
}
