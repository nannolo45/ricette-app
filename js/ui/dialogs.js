// Shared UI pieces: an in-app confirmation box (instead of the browser's confirm()) and a toast that can
// offer "Undo". Both work on top of an open dialog.
import { t } from '../i18n.js';

import { esc } from './format.js';

let box = null;
function confirmBox() {
  if (box && box.isConnected) return box;
  box = document.createElement('dialog');
  box.id = 'confirm';
  box.className = 'confirm-dialog';
  document.body.appendChild(box);
  return box;
}

/**
 * Ask a yes/no question. Resolves true when the person confirms.
 * askConfirm({ text, title?, ok?, danger? })
 */
export function askConfirm({ text, title = '', ok = t('confirmYes'), danger = false } = {}) {
  const el = confirmBox();
  el.innerHTML = `<form method="dialog">
    ${title ? `<h2>${esc(title)}</h2>` : ''}
    <p>${esc(text)}</p>
    <div class="button-row">
      <button class="btn ${danger ? 'danger-fill' : 'primary'}" value="ok" data-confirm="ok">${esc(ok)}</button>
      <button class="btn ghost" value="cancel" data-confirm="cancel">${esc(t('cancel'))}</button>
    </div></form>`;
  return new Promise((resolve) => {
    el.returnValue = '';
    el.addEventListener('close', () => resolve(el.returnValue === 'ok'), { once: true });
    if (el.open) el.close();
    el.showModal();
    el.querySelector('[data-confirm=ok]').focus();
  });
}

/**
 * Show a short message at the bottom. With undo: a button that runs it (once) and closes the message.
 */
export function toast(msg, { undo = null, ms } = {}) {
  const el = document.getElementById('toast');
  if (!el) return;
  clearTimeout(toast.timer);
  el.innerHTML = `<span>${esc(msg)}</span>${undo ? `<button type="button" class="toast-undo">${esc(t('undo'))}</button>` : ''}`;
  el.classList.toggle('has-action', Boolean(undo));
  if (undo) {
    el.querySelector('.toast-undo').onclick = () => {
      clearTimeout(toast.timer);
      el.classList.remove('show', 'has-action');
      undo();
    };
  }
  el.classList.add('show');
  toast.timer = setTimeout(() => el.classList.remove('show', 'has-action'), ms || (undo ? 6000 : 2600));
}
