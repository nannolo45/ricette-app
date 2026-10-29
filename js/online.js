// Online, free: dish photos (Wikipedia, Openverse, and Pixabay/Pexels with a free key) and recipe ideas from
// TheMealDB (free test key "1", no signup). Everything here runs in the browser; the recipe
// sites (GialloZafferano, Cucchiaio, Chefkoch, BBC Good Food) are searched by the GitHub job.
import { findDishImages, wikiCredit } from './dish-image.js';
import { translateFood, sameFood } from './lang-food.js';
import { parseIngredient, namesMatch } from './parse.js';
import { pantryCoverage } from './recipe-tools.js';

const LOCALE = { it: 'it-IT', de: 'de-DE', en: 'en-US' };

// ---------- photos ----------

export async function pexelsSearch(query, key, { lang = 'it', perPage = 15, http = fetch } = {}) {
  if (!key) return [];
  const res = await http(`https://api.pexels.com/v1/search?${new URLSearchParams({ query, per_page: String(perPage), locale: LOCALE[lang] || 'en-US', orientation: 'landscape' })}`, {
    headers: { Authorization: key },
  });
  if (res.status === 401 || res.status === 403) throw new Error('pexels_key');
  if (res.status === 429) throw new Error('pexels_limit');
  if (!res.ok) throw new Error(`pexels_${res.status}`);
  const data = await res.json();
  return (data.photos || []).map((p) => ({
    source: 'pexels', url: p.src?.large2x || p.src?.large || p.src?.original, thumb: p.src?.medium || p.src?.small,
    title: p.alt || query,
    credit: { title: p.alt || '', creator: p.photographer || '', license: 'Pexels', url: p.url || 'https://www.pexels.com' },
  })).filter((p) => p.url);
}

// Pixabay (free key from pixabay.com/api/docs). Its terms: no hotlinking in a live app, so
// pictures are always downloaded (into the repo); the picker only shows previews.
export async function pixabaySearch(query, key, { lang = 'it', perPage = 15, http = fetch, food = true } = {}) {
  if (!key) return [];
  const params = { key, q: query.slice(0, 100), lang: ['it', 'de', 'en'].includes(lang) ? lang : 'en', image_type: 'photo', orientation: 'horizontal', per_page: String(Math.max(3, perPage)), safesearch: 'true' };
  if (food) params.category = 'food';
  const res = await http(`https://pixabay.com/api/?${new URLSearchParams(params)}`);
  if (res.status === 400 || res.status === 401 || res.status === 403) throw new Error('pixabay_key');
  if (res.status === 429) throw new Error('pixabay_limit');
  if (!res.ok) throw new Error(`pixabay_${res.status}`);
  const data = await res.json();
  return (data.hits || []).map((h) => ({
    source: 'pixabay', url: h.largeImageURL || h.webformatURL, thumb: h.webformatURL || h.previewURL, title: h.tags || query, download: true,
    credit: { title: h.tags || '', creator: h.user || '', license: 'Pixabay', url: h.pageURL || 'https://pixabay.com' },
  })).filter((h) => h.url);
}

// Openverse: openly licensed photos (Flickr, Wikimedia…), no key needed.
export async function openverseSearch(query, { perPage = 10, http = fetch } = {}) {
  const res = await http(`https://api.openverse.org/v1/images/?${new URLSearchParams({ q: query.slice(0, 100), page_size: String(perPage), category: 'photograph', mature: 'false' })}`);
  if (res.status === 429) throw new Error('openverse_limit');
  if (!res.ok) throw new Error(`openverse_${res.status}`);
  const data = await res.json();
  return (data.results || []).map((r) => ({
    source: 'openverse', url: r.url, thumb: r.thumbnail || r.url, title: r.title || query,
    credit: { title: r.title || '', creator: r.creator || '', license: `CC ${String(r.license || '').toUpperCase()} ${r.license_version || ''}`.trim().replace(/^CC CC0/, 'CC0').replace(/^CC PDM/, 'Public domain'), url: r.foreign_landing_url || r.url },
  })).filter((r) => r.url);
}

export async function testKey(service, key, { http = fetch } = {}) {
  try {
    if (service === 'pixabay') await pixabaySearch('pasta', key, { perPage: 3, http });
    else await pexelsSearch('pasta', key, { perPage: 1, http });
    return 'ok';
  } catch (e) { return e.message.replace(/^(pixabay|pexels)_/, ''); }
}

export async function testPexelsKey(key, { http = fetch } = {}) {
  try { await pexelsSearch('pasta', key, { perPage: 1, http }); return 'ok'; } catch (e) { return e.message; }
}

/** Candidates for the photo picker: Wikipedia first (the dish itself), then Pixabay, Pexels, Openverse. */
export async function photoCandidates(title, { lang = 'it', keys = {}, http = fetch } = {}) {
  const errors = [];
  const en = title.split(/\s+/).map((w) => translateFood(w, 'en')).join(' ');
  const safe = (p, tag) => p.catch((e) => { errors.push(e.message || tag); return []; });
  const [wiki, pix, pex, open] = await Promise.all([
    safe(findDishImages(title, lang, { http, limit: 6 }), 'wikipedia'),
    keys.pixabay ? safe(pixabaySearch(title, keys.pixabay, { lang, http }).then(async (r) => (r.length >= 4 ? r : [...r, ...await pixabaySearch(title, keys.pixabay, { lang, http, food: false }).catch(() => [])])), 'pixabay') : [],
    keys.pexels ? safe(pexelsSearch(title, keys.pexels, { lang, http }), 'pexels') : [],
    safe(openverseSearch(lang === 'en' ? title : en, { http }), 'openverse'),
  ]);
  const seen = new Set();
  return { list: [...wiki, ...pix, ...pex, ...open].filter((c) => !seen.has(c.url) && seen.add(c.url)), errors };
}

export async function creditFor(c, { http = fetch } = {}) {
  if (c.source === 'wikipedia') return wikiCredit(c, { http });
  return c.credit || null;
}

// ---------- TheMealDB ----------

const MEALDB = 'https://www.themealdb.com/api/json/v1/1/';
let mealdbList = null;
const simple = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

async function mealdbIngredients(http) {
  if (mealdbList) return mealdbList;
  try {
    const cached = JSON.parse(localStorage.getItem('mealdbIngredients') || 'null');
    if (cached && Date.now() - cached.at < 30 * 864e5) return (mealdbList = cached.list);
  } catch { /* no storage */ }
  const res = await http(`${MEALDB}list.php?i=list`);
  if (!res.ok) throw new Error('mealdb_unreachable');
  const list = ((await res.json()).meals || []).map((m) => m.strIngredient).filter(Boolean);
  mealdbList = list;
  try { localStorage.setItem('mealdbIngredients', JSON.stringify({ at: Date.now(), list })); } catch { /* full */ }
  return list;
}

/** Our ingredient → TheMealDB's ingredient name ("zucchine" → "Courgettes"). */
export function mealdbName(name, list) {
  const en = translateFood(name, 'en');
  const byKey = new Map(list.map((x) => [simple(x), x]));
  const s = simple(en);
  const tries = [s, `${s}s`, s.replace(/e?s$/, ''), `${s}es`];
  for (const t of tries) if (byKey.has(t)) return byKey.get(t);
  // a TheMealDB name of the same food (Courgettes ↔ Zucchini), shortest first
  const same = list.filter((x) => sameFood(x, name)).sort((a, b) => a.length - b.length);
  if (same.length) return same[0];
  const contains = list.filter((x) => ` ${simple(x)} `.includes(` ${s} `)).sort((a, b) => a.length - b.length);
  return contains[0] || en;
}

export function mealToResult(m) {
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const ing = String(m[`strIngredient${i}`] || '').trim();
    if (!ing) continue;
    ingredients.push(`${String(m[`strMeasure${i}`] || '').trim()} ${ing}`.trim());
  }
  const steps = String(m.strInstructions || '').split(/\r?\n+/).map((x) => x.replace(/^\s*(?:step\s*\d+|\d+[.)])\s*/i, '').trim()).filter((x) => x.length > 2);
  return {
    source: 'mealdb', id: `mealdb-${m.idMeal}`, title: m.strMeal, image: m.strMealThumb || '',
    url: m.strSource || `https://www.themealdb.com/meal/${m.idMeal}`, lang: 'en', servings: 4,
    ingredients, steps, category: m.strCategory || '', area: m.strArea || '',
  };
}

/** Meals that use the most of the selected ingredients (TheMealDB's free API filters one ingredient at a time). */
export async function mealdbSearch(selected, { http = fetch, max = 12 } = {}) {
  const list = await mealdbIngredients(http);
  const hits = new Map();
  for (const name of selected.slice(0, 6)) {
    const n = mealdbName(name, list);
    let meals = [];
    try {
      const res = await http(`${MEALDB}filter.php?i=${encodeURIComponent(n.replace(/ /g, '_'))}`);
      if (res.ok) meals = (await res.json()).meals || [];
    } catch { /* next one */ }
    for (const m of meals) {
      const h = hits.get(m.idMeal) || { n: 0 };
      h.n++;
      hits.set(m.idMeal, h);
    }
  }
  const top = [...hits.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, max);
  const out = [];
  for (const [id] of top) {
    try {
      const res = await http(`${MEALDB}lookup.php?i=${id}`);
      const m = res.ok ? (await res.json()).meals?.[0] : null;
      if (m) out.push(mealToResult(m));
    } catch { /* skip */ }
  }
  return out;
}

// ---------- ranking against the pantry ----------

/**
 * results: [{title, ingredients: ["2 eggs", …], servings, …}]
 * → { shown, hidden } each item with .c (coverage) and .usesSelected
 * The selected ingredients count as available even if they're not in the pantry.
 */
export function rankOnline(results, { pantry = [], selected = [], maxMissing = 3, basics = true } = {}) {
  const stock = pantry.filter((p) => (Number(p.qty) || 0) > 0);
  const extra = selected.filter((s) => !stock.some((p) => namesMatch(p.name, s) || sameFood(p.name, s))).map((s, i) => ({ id: `sel-${i}`, name: s, qty: 1, unit: '' }));
  const avail = [...stock, ...extra];
  const seen = new Set();
  const ranked = [];
  for (const r of results) {
    const key = r.url || r.id || r.title;
    if (seen.has(key)) continue;
    seen.add(key);
    const ings = (r.ingredients || []).map((raw) => parseIngredient(typeof raw === 'string' ? raw : raw.raw || ''));
    // quantities from abroad (cups, lb…) aren't compared: having the ingredient is enough
    const c = pantryCoverage({ servings: r.servings || 4, ingredients: ings.map((i) => ({ ...i, qty: null })) }, avail, { basics });
    const usesSelected = selected.filter((s) => ings.some((i) => namesMatch(i.name, s) || sameFood(i.name, s)));
    ranked.push({ ...r, c, usesSelected });
  }
  ranked.sort((a, b) => b.usesSelected.length - a.usesSelected.length || a.c.missing.length - b.c.missing.length || b.c.ratio - a.c.ratio);
  const usable = ranked.filter((r) => r.c.total > 0 && (!selected.length || r.usesSelected.length));
  return { shown: usable.filter((r) => r.c.missing.length <= maxMissing), hidden: usable.filter((r) => r.c.missing.length > maxMissing) };
}

/** Search terms per site language: the first few selected ingredients, translated. */
export function searchTerms(selected, max = 3) {
  const pick = selected.slice(0, max);
  return Object.fromEntries(['it', 'de', 'en'].map((l) => [l, pick.map((s) => translateFood(s, l))]));
}
