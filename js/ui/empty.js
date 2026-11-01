// What a screen shows when there's nothing in it (v43): an icon, a title, one sentence, one main action
// and at most one more. The same component everywhere, small (inside a list) or full (the whole screen).
import { esc } from './format.js';

const ICONS = {
  book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/><path d="M9 8h6"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  inbox: '<path d="M4 13h4l2 3h4l2-3h4"/><path d="M5 5h14l1 8v6H4v-6z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  folder: '<path d="M3.5 6.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  pantry: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 6h4M10 12h4M10 18h4"/>',
  check: '<circle cx="12" cy="12" r="8.5"/><path d="m8 12.5 2.7 2.7L16 9.8"/>',
  archive: '<rect x="3.5" y="4" width="17" height="4.5" rx="1"/><path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5M10 12h4"/>',
};

function actionHtml(a, cls) {
  if (!a) return '';
  const attrs = Object.entries(a.data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  if (a.href) return `<a class="btn ${cls}" href="${esc(a.href)}"${attrs}>${esc(a.label)}</a>`;
  return `<button type="button" class="btn ${cls}" data-action="${esc(a.action)}"${attrs}${a.disabled ? ' disabled' : ''}${a.id ? ` id="${esc(a.id)}"` : ''}>${esc(a.label)}</button>`;
}

/**
 * emptyState({ icon, title, text, main, second, extra, size: 'full' | 'small', tone, id })
 * main / second: { label, action, data? } or { label, href }. extra: HTML placed above the buttons.
 */
export function emptyState({ icon = 'inbox', title, text = '', main = null, second = null, extra = '', size = 'full', tone = 'accent', id = '' }) {
  return `<div class="empty-state ${size} tone-${tone}"${id ? ` id="${esc(id)}"` : ''}>
    <div class="es-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${ICONS[icon] || ICONS.inbox}</svg></div>
    <h2 class="es-title">${esc(title)}</h2>
    ${text ? `<p class="es-text">${esc(text)}</p>` : ''}
    ${extra}
    ${main || second ? `<div class="es-acts">${actionHtml(main, 'primary')}${actionHtml(second, '')}</div>` : ''}
  </div>`;
}
