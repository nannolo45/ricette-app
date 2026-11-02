// The app's frame: routes, the tab bar, the header (title + sync status), and swapping a view's HTML
// without losing the place on the page or the field being typed in.
import { state } from './store.js';
import { t } from './i18n.js';
import { isConfigured } from './sync.js';

const $ = (sel) => document.querySelector(sel);

export function route() {
  const h = location.hash.replace(/^#\/?/, '') || 'recipes';
  const [name, id, sub] = h.split('/');
  return { name, id: id && decodeURIComponent(id), sub: sub && decodeURIComponent(sub) };
}

// which tab is lit for each route
export const TAB_OF = { import: 'recipes', putaway: 'list', recipes: 'recipes', folder: 'recipes', suggest: 'recipes', recipe: 'recipes', edit: 'recipes', list: 'list', pantry: 'pantry', settings: '' };

export function renderShell() {
  document.title = t('appName');
  $('#app-title').textContent = t('appName');
  $('#app-title').title = t('toRecipes');
  for (const a of document.querySelectorAll('nav.tabs a')) {
    a.querySelector('.label').textContent = t(`tab${a.dataset.tab.charAt(0).toUpperCase()}${a.dataset.tab.slice(1)}`);
  }
  const gear = $('#settings-link');
  if (gear) { gear.setAttribute('aria-label', t('tabSettings')); gear.title = t('tabSettings'); }
  const gl = $('#gear-label');
  if (gl) gl.textContent = t('tabSettings');
}

export function setActiveTab(routeName) {
  for (const a of document.querySelectorAll('nav.tabs a')) a.classList.toggle('active', a.dataset.tab === TAB_OF[routeName]);
  $('#settings-link')?.classList.toggle('active', routeName === 'settings');
}

export function syncStatus(syncing) {
  if (!isConfigured()) return 'local';
  if (syncing) return 'syncing';
  if (!navigator.onLine) return 'offline';
  if (state.meta.lastError && state.meta.lastError !== 'network') return 'error';
  if (state.meta.lastError === 'network') return 'offline';
  if (state.meta.dirty) return 'pending';
  return 'synced';
}

export function updateSyncBadge(syncing) {
  const b = $('#sync');
  const st = syncStatus(syncing);
  b.className = `sync ${st}`;
  b.title = t(`st_${st}`);
  b.setAttribute('aria-label', b.title);
  $('#sync-label').textContent = t(`st_${st}`);
}

let lastRendered = '';

/**
 * Put new HTML in the view. A re-render of the same page keeps the scroll position, and the field that had
 * focus gets it back with what was typed and the cursor where it was. after(view) runs before focus returns.
 */
export function paint(view, html, after = () => {}) {
  const here = location.hash || '#/recipes';
  const keepY = here === lastRendered ? window.scrollY : null;
  lastRendered = here;
  const active = document.activeElement;
  const focusId = active && active.id;
  const typed = focusId && active.tagName === 'INPUT' ? active.value : null;
  let sel = null;
  try { sel = focusId && active.selectionStart != null ? [active.selectionStart, active.selectionEnd] : null; } catch { sel = null; }
  view.innerHTML = html;
  after(view);
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) { if (typed != null && el.tagName === 'INPUT') el.value = typed; el.focus({ preventScroll: true }); if (sel) try { el.setSelectionRange(...sel); } catch { /* not a text input */ } }
  }
  if (keepY != null && Math.abs(window.scrollY - keepY) > 1) window.scrollTo(0, keepY);
}
