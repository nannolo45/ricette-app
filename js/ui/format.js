// Small text helpers shared by the views: HTML escaping, numbers, quantities, minutes, calories.
import { t, getLang, unitLabel } from '../i18n.js';
import { formatQty, tidy } from '../parse.js';
import { formatMinutes } from '../times.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const round = (x) => Math.round(x * 1000) / 1000;
export const num = (v) => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };

export function qtyText(qty, unit) {
  if (qty == null) return '';
  const tt = tidy(qty, unit || '');
  const q = formatQty(tt.qty, tt.unit);
  return [q, unitLabel(tt.unit, tt.qty)].filter(Boolean).join(' ');
}

export const fmtMin = (m) => formatMinutes(m, { day: t('dayShort') });
export const kcalText = (x) => `${Math.round(x).toLocaleString(getLang())}`;
export const protText = (x) => (x < 10 ? Math.round(x * 10) / 10 : Math.round(x)).toLocaleString(getLang());
