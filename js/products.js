// Product lookup by barcode in Open Food Facts (free, open data, ODbL).
import { kvGet, kvSet } from './store.js';
import { parseIngredient } from './parse.js';
import { offCategory } from './categories.js';

const API = 'https://world.openfoodfacts.org/api/v2/product/';
const FIELDS = [
  'product_name', 'product_name_it', 'product_name_de', 'product_name_en', 'generic_name',
  'brands', 'quantity', 'product_quantity', 'product_quantity_unit', 'categories_tags',
].join(',');
const NOT_FOUND_TTL = 7 * 24 * 3600 * 1000;

const UNIT_MAP = { g: 'g', gr: 'g', kg: 'kg', mg: 'mg', ml: 'ml', cl: 'cl', dl: 'dl', l: 'l', lt: 'l' };

// "500 g", "1 l", "6 x 125 g", "4x1,5 l"
export function parsePackQuantity(product) {
  const pq = parseFloat(product.product_quantity);
  const pu = UNIT_MAP[String(product.product_quantity_unit || '').toLowerCase()];
  if (Number.isFinite(pq) && pq > 0 && pu) return { qty: pq, unit: pu };
  const q = String(product.quantity || '').trim();
  if (!q) return { qty: 1, unit: '' };
  const multi = q.match(/^(\d+)\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)/);
  if (multi) {
    const unit = UNIT_MAP[multi[3].toLowerCase()];
    if (unit) return { qty: +multi[1] * parseFloat(multi[2].replace(',', '.')), unit };
  }
  const p = parseIngredient(q);
  if (p.qty != null && ['g', 'kg', 'mg', 'ml', 'cl', 'dl', 'l'].includes(p.unit)) return { qty: p.qty, unit: p.unit };
  return { qty: 1, unit: '' };
}

export function productName(product, lang) {
  const pick = (v) => (typeof v === 'string' ? v.trim() : '');
  return pick(product[`product_name_${lang}`]) || pick(product.product_name)
    || pick(product.product_name_it) || pick(product.product_name_de) || pick(product.product_name_en)
    || pick(product.generic_name);
}

// Returns {found:true, name, brand, qty, unit} | {found:false}; throws on network problems.
export async function lookupProduct(code, lang, { fetchImpl = fetch } = {}) {
  const key = `off:${code}`;
  const cached = await kvGet(key);
  if (cached && (cached.found || Date.now() - cached.at < NOT_FOUND_TTL)) return { ...cached, name: cached.names?.[lang] || cached.name };

  const res = await fetchImpl(`${API}${encodeURIComponent(code)}.json?fields=${FIELDS}`);
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok && res.status !== 404) throw new Error(`off_${res.status}`);
  let result;
  if (data && data.status === 1 && data.product) {
    const p = data.product;
    const pack = parsePackQuantity(p);
    const names = { it: productName(p, 'it'), de: productName(p, 'de'), en: productName(p, 'en') };
    result = {
      found: Boolean(names.it || names.de || names.en), at: Date.now(), names, name: names[lang] || names.it,
      brand: String(p.brands || '').split(',')[0].trim(), qty: pack.qty, unit: pack.unit,
      cat: offCategory(p.categories_tags),
    };
  } else {
    result = { found: false, at: Date.now() };
  }
  await kvSet(key, result);
  return result;
}
