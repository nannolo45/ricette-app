// Light, dark or automatic, plus Ricette's colour (Everyday's handover, v62; Ricette v52).
// The choice lives on this device only, in localStorage: 'ricette-theme' (auto | light | dark, the key the guide reads too)
// and 'ricette-accent' (melanzana | petrolio | terracotta | fiordaliso). index.html's <head> applies both before the
// first paint; this module applies a new choice and follows the phone or computer while on Automatico.
const KEY = 'ricette-theme';
const AKEY = 'ricette-accent';
export const THEMES = ['auto', 'light', 'dark'];
export const ACCENTS = ['melanzana', 'petrolio', 'terracotta', 'fiordaliso'];
const MQ = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
const BAR = { light: '#ffffff', dark: '#151a1b' }; // the top bar's colour, for the phone's status bar

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* no storage */ } };

// v51 kept both in 'ricette.look'
(function migrate() {
  const old = read('ricette.look');
  if (!old) return;
  try {
    const o = JSON.parse(old);
    if (!read(KEY) && THEMES.includes(o.theme)) write(KEY, o.theme);
    if (!read(AKEY) && ACCENTS.includes(o.accent)) write(AKEY, o.accent);
  } catch { /* ignore */ }
  try { localStorage.removeItem('ricette.look'); } catch { /* ignore */ }
}());

export function themeChoice() { const v = read(KEY); return THEMES.includes(v) ? v : 'auto'; }
export function accentChoice() { const v = read(AKEY); return ACCENTS.includes(v) ? v : 'melanzana'; }
export const isDark = () => (themeChoice() === 'auto' ? Boolean(MQ?.matches) : themeChoice() === 'dark');

export function applyTheme(c = themeChoice(), a = accentChoice()) {
  write(KEY, THEMES.includes(c) ? c : 'auto');
  write(AKEY, ACCENTS.includes(a) ? a : 'melanzana');
  const dark = isDark();
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.classList.toggle('light', !dark);
  const acc = accentChoice();
  if (acc === 'melanzana') delete root.dataset.accent; else root.dataset.accent = acc;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? BAR.dark : BAR.light);
}

MQ?.addEventListener?.('change', () => { if (themeChoice() === 'auto') applyTheme(); });
