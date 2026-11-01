// The recipe page (v34): for reading and cooking. Editing lives in Modifica; the ⋯ menu moves, shares, deletes.
// App-level helpers come in through setup() (they still live in app.js); the rest is imported.
import { state, get, live, upsert } from '../store.js';
import { t } from '../i18n.js';
import { scaleQty } from '../parse.js';
import { pantryCoverage, tagsOf } from '../recipe-tools.js';
import { esc, num, qtyText, kcalText, protText } from '../ui/format.js';
import { toast } from '../ui/dialogs.js';

let c$ = null;
export function setupRecipeView(ctx) { c$ = ctx; }

export function viewRecipe(id) {
  const r = get('recipes', id);
  if (!r) return `<p class="empty">${esc(t('notFound'))}</p><a class="btn" href="#/recipes">${esc(t('back'))}</a>`;
  const base = r.servings || 4;
  const n = c$.servingsFor(r);
  const ings = c$.ingredientsOf(r);
  const st = c$.stageOfR(r);
  const pantry = live('pantry');
  const usePantry = pantry.some((p) => (num(p.qty) || 0) > 0);
  const c = pantryCoverage(r, pantry, { basics: state.settings.basics !== false, servings: n });
  const status = (name) => {
    if (!usePantry) return '';
    const m = c.missing.find((x) => x.name === name);
    if (m) return m.have > 0 ? `<span class="ing-st some">${esc(t('ingHaveSome', qtyText(m.have, m.unit)))}</span>` : `<span class="ing-st miss">${esc(t('ingMissing'))}</span>`;
    if (c.have.includes(name)) return `<span class="ing-st have">${esc(t('ingHave'))}</span>`;
    if (c.optional.includes(name)) return `<span class="ing-st opt">${esc(t('ingAlways'))}</span>`;
    return '';
  };
  const tags = tagsOf(r, c$.tagDefs());
  const nu = c$.nutritionOf(r);
  const host = (() => { try { return new URL(r.url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  const nMissing = usePantry ? c.missing.length : 0;
  return `
  <div class="recipe-page">
  <a class="back" href="${c$.folderHref(c$.recipeFolderId(r))}">← ${esc(c$.recipeFolderId(r) ? c$.folderOf(r.folderId).name : t('allRecipes'))}</a>
  ${c$.coverOf(r) ? `<div class="hero">${c$.photoTag(c$.coverOf(r), { fallback: r.image })}</div>` : ''}
  ${r.imageCredit && c$.coverOf(r) === (r.imageCredit.photo || (r.photos || [])[0]) ? `<p class="credit">${esc(t('photoBy'))} <a href="${esc(r.imageCredit.url)}" target="_blank" rel="noopener">${esc([r.imageCredit.creator, r.imageCredit.license].filter(Boolean).join(', ') || r.imageCredit.title || '↗')}</a></p>` : ''}
  ${(r.photos || []).length > 1 ? `<div class="gallery">${r.photos.slice(1).map((p) => `<button class="shot" data-action="view-photo" data-src="${esc(p)}">${c$.photoTag(p)}</button>`).join('')}</div>` : ''}
  <div class="title-row">
    <h1>${esc(r.title)}</h1>
    <button type="button" class="star-btn ${st === 'fav' ? 'on' : ''}" data-action="toggle-fav" data-id="${esc(id)}" aria-pressed="${st === 'fav'}" aria-label="${esc(t('stage_fav'))}">${st === 'fav' ? '★' : '☆'}</button>
  </div>
  <div class="meta-line">
    ${c$.timesLine(r)}
    ${c$.sourceLabel(r.source) ? `<span class="src">${esc(c$.sourceLabel(r.source))}</span>` : ''}
    ${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(host || t('source'))} ↗</a>` : ''}
  </div>
  ${r.review ? `<div class="review"><span>${esc(t('reviewBanner'))}</span><a class="btn small primary" href="#/edit/${encodeURIComponent(id)}">${esc(t('reviewCheck'))}</a></div>` : ''}
  <div class="tag-row read">
    <button type="button" class="stage-chip st-${st}" data-action="stage-menu" data-id="${esc(id)}" aria-label="${esc(t('stageLabel'))}: ${esc(t(`stage_${st}`))}">${esc(t(`stage_${st}`))}${r.cookedCount ? ` · ${esc(t('cookedN', r.cookedCount))}` : ''} ▾</button>
    ${tags.map((tg) => `<span class="tag ${tg.startsWith('auto:') ? 'auto' : ''}">${esc(c$.tagLabel(tg))}</span>`).join('')}
  </div>
  ${nu ? `<details class="nutri-line" ${c$.ui.nutriOpen ? 'open' : ''}><summary>🔥 ${nu.stated ? '' : '≈ '}${kcalText(nu.perServing.kcal)} kcal · 💪 ${protText(nu.perServing.protein)} g ${esc(t('protein'))} <small>${esc(t('perPerson'))}</small> <span class="link-like">${esc(t('details'))}</span></summary>${c$.nutritionBox(r, n)}</details>` : ''}
  <div class="ing-head">
    <h2>${esc(t('ingredients'))}</h2>
    <div class="servings">
      <button class="round" data-action="srv-dec" data-id="${esc(id)}" aria-label="${esc(t('fewerPeople'))}">−</button>
      <span>${esc(t('people', n))}</span>
      <button class="round" data-action="srv-inc" data-id="${esc(id)}" aria-label="${esc(t('morePeople'))}">+</button>
    </div>
  </div>
  ${n !== base ? `<p class="hint small srv-note">${esc(t('scaledFrom', base))}${c$.ui.servings[id] ? ` · <button type="button" class="link-btn" data-action="srv-reset" data-id="${esc(id)}">${esc(t('reset'))}</button>` : ''}</p>` : ''}
  <ul class="ingredients">
    ${ings.map((i, k) => {
      const q = qtyText(scaleQty(i.qty, base, n), i.unit);
      // a group heading ("Per la crema") where the group changes
      const head = i.group && i.group !== ings[k - 1]?.group ? `<li class="ing-group">${esc(i.group)}</li>` : '';
      return `${head}<li><span class="q">${esc(q)}</span><span class="ing-name">${esc(i.name)}${i.note ? ` <small>${esc(i.note)}</small>` : ''}</span>${status(i.name)}</li>`;
    }).join('')}
  </ul>
  ${(r.steps || []).length ? `<h2>${esc(t('steps'))}</h2><ol class="steps">${r.steps.map((x) => (/^[^.!?:]{3,60}:$/.test(x.trim()) ? `<li class="step-head">${esc(x)}</li>` : `<li>${esc(x)}</li>`)).join('')}</ol>` : ''}
  ${r.notes ? `<h2>${esc(t('notes'))}</h2><p class="notes">${esc(r.notes)}</p>` : ''}
  ${(r.sourcePhotos || []).length ? `<h2>${esc(t(r.source?.type === 'book' ? 'originalPage' : 'originalNote'))}</h2>
    <div class="gallery">${r.sourcePhotos.map((p) => `<button class="shot page" data-action="view-photo" data-src="${esc(p)}">${c$.photoTag(p)}</button>`).join('')}</div>` : ''}
  </div>
  <div class="action-bar" role="toolbar" aria-label="${esc(r.title)}">
    <button class="btn primary" data-action="to-list" data-id="${esc(id)}" aria-label="${esc(nMissing ? t('addNToList', nMissing) : t('addToList'))}">🛒 ${esc(nMissing ? t('nToList', nMissing) : t('toListShort'))}</button>
    <button class="btn" data-action="cooked" data-id="${esc(id)}">${esc(t('cooked'))}</button>
    <button class="btn icon-only" data-action="recipe-menu" data-id="${esc(id)}" aria-label="${esc(t('more'))}">⋯</button>
  </div>`;
}

// the ⋯ on a recipe: edit, move, share, delete
export function openRecipeMenu(id) {
  const r = get('recipes', id);
  if (!r) return;
  c$.openModal(`
    <h2>${esc(r.title)}</h2>
    <div class="menu-list">
      <a class="btn" href="#/edit/${encodeURIComponent(id)}">✎ ${esc(t('edit'))}</a>
      <label class="menu-move">📁 ${esc(t('moveTo'))}<select data-action="move-recipe" data-id="${esc(id)}">${c$.folderOptions(c$.recipeFolderId(r))}</select></label>
      <button type="button" class="btn" data-menu="share">↗ ${esc(t('share'))}</button>
      <button type="button" class="btn danger" data-menu="delete">🗑 ${esc(t('delete'))}</button>
    </div>
    <div class="button-row"><button class="btn ghost" value="cancel" formnovalidate>${esc(t('close'))}</button></div>`, () => {}, { sheet: true });
  c$.modal.onclick = (e) => {
    const b = e.target.closest('[data-menu]');
    if (b?.dataset.menu === 'share') { c$.modal.close(); shareRecipe(r); }
    if (b?.dataset.menu === 'delete') { c$.modal.close(); c$.deleteRecipeUndoable(id); }
    if (e.target.closest('a[href]')) c$.modal.close();
  };
  c$.modal.onchange = (e) => {
    const el = e.target;
    if (el.dataset.action !== 'move-recipe') return;
    upsert('recipes', { ...get('recipes', id), folderId: el.value || null }, { silent: true });
    c$.modal.close();
    c$.changed();
    toast(t('movedTo', el.value ? c$.folderOf(el.value).name : t('allRecipes')));
  };
}

export function openStageMenu(id) {
  const r = get('recipes', id);
  if (!r) return;
  const st = c$.stageOfR(r);
  c$.openModal(`
    <h2>${esc(t('stageLabel'))}</h2>
    <div class="choice-list">${[['fav', '★'], ['tried', '✓'], ['try', '⏳'], ['archived', '🗄']].map(([k, ico]) => `<button type="button" class="btn stage-btn ${st === k ? 'on' : ''}" aria-pressed="${st === k}" data-choice="${k}" data-value="${k}">${ico} ${esc(t(`stage_${k}`))}</button>`).join('')}</div>
    <p class="hint small">${esc(t('stageHint'))}</p>
    <div class="button-row"><button class="btn ghost" value="cancel" formnovalidate>${esc(t('close'))}</button></div>`, () => {}, { sheet: true });
  c$.modal.onclick = (e) => {
    const b = e.target.closest('[data-choice]');
    if (!b) return;
    c$.modal.close();
    c$.setStage(id, b.dataset.choice);
  };
}

function recipeText(r) {
  const n = c$.servingsFor(r);
  const base = r.servings || 4;
  const all = c$.ingredientsOf(r);
  const ings = all.flatMap((i, k) => [
    ...(i.group && i.group !== all[k - 1]?.group ? [`${i.group}:`] : []),
    `- ${[qtyText(scaleQty(i.qty, base, n), i.unit), i.name].filter(Boolean).join(' ')}`,
  ]);
  const steps = (r.steps || []).map((x, k) => `${k + 1}. ${x}`);
  return [r.title, t('people', n), '', `${t('ingredients')}:`, ...ings, '', `${t('steps')}:`, ...steps, ...(r.url ? ['', r.url] : [])].join('\n');
}

export async function shareRecipe(r) {
  const text = recipeText(r);
  try {
    if (navigator.share) { await navigator.share({ title: r.title, text }); return; }
  } catch (e) { if (e?.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast(t('copied')); } catch { toast(t('copyFailed')); }
}

