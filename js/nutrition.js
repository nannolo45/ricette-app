// Calories and protein, estimated offline from a built-in table (typical values per 100 g,
// based on common food composition tables). No network, no API. Names in Italian, German and English.
//

import { parseIngredient } from './parse.js';
import { foodOf, food, simple } from './foods.js';

// The values live in the food dictionary (foods.js): kcal and protein per 100 g, piece / dens /
// pack / can / slice / bunch weights.
export function simplify(s) { return simple(s); }

/** Best matching food for an ingredient name, or null: { id, name, kcal, prot, piece?, dens?, … }. */
export function findFood(name) {
  const id = foodOf(name);
  const r = id ? food(id) : null;
  if (!r || r.kcal == null) return null;
  const out = { id: r.id, name: r.it, kcal: r.kcal, prot: r.prot };
  for (const k of ['piece', 'dens', 'pack', 'can', 'slice', 'bunch']) if (r[k] != null) out[k] = r[k];
  return out;
}

// "1 bicchiere di vino", "una noce di burro", "2 vasetti di yogurt", "1 Glas Wasser"
const CONTAINERS = [
  [/^(?:(?:noce|noci|nocetta)\s+di|(?:knob|knobs)\s+of|flocke|flocken|stuckchen)\s+/, { g: 10 }],
  [/^(?:bicchierino|bicchierini|shot|shots|schnapsglas|stamperl)\s+(?:di\s+|of\s+)?/, { ml: 40 }],
  [/^(?:bicchiere|bicchieri|glass|glasses|glas|glaser)\s+(?:di\s+|of\s+)?/, { ml: 200 }],
  [/^(?:tazza|tazze|mug|mugs|tasse|tassen)\s+(?:di\s+|of\s+)?/, { ml: 240 }],
  [/^(?:tazzina|tazzine)\s+(?:di\s+|of\s+)?/, { ml: 50 }],
  [/^(?:mestolo|mestoli|ladle|ladles|schopfkelle|kelle)\s+(?:di\s+|of\s+)?/, { ml: 100 }],
  [/^(?:vasetto|vasetti|pot|pots|becher)\s+(?:di\s+|of\s+)?/, { g: 125 }],
  [/^(?:barattolo|barattoli|jar|jars)\s+(?:di\s+|of\s+)?/, { can: true }],
  [/^(?:scatola|scatole|scatoletta|scatolette|lattina|lattine|tin|tins|dose|dosen)\s+(?:di\s+|of\s+)?/, { can: true }],
  [/^(?:confezione|confezioni|pacco|pacchi|pacchetto|pacchetti|bustina|bustine|busta|buste|vaschetta|vaschette|panetto|panetti|package|packages|pack|packs|packet|packets|bag|bags|packung|packungen|packchen|beutel|tute|tuten|tuete|stange|stangen)\s+(?:di\s+|of\s+)?/, { pack: true }],
  [/^(?:fetta|fette|fettina|fettine|slice|slices|scheibe|scheiben)\s+(?:di\s+|of\s+)?/, { slice: true }],
  [/^(?:mazzetto|mazzetti|mazzo|mazzi|ciuffo|ciuffi|bunch|bunches|bund|bundel|handful|handfuls|manciata|manciate|handvoll)\s+(?:di\s+|of\s+)?/, { g: 25 }],
  [/^(?:rametto|rametti|rametto di|sprig|sprigs|zweig|zweige|zweiglein|stangel|stiel|stiele)\s+(?:di\s+|of\s+)?/, { g: 2 }],
  [/^(?:foglia|foglie|foglioline|leaf|leaves|blatt|blatter|blattchen)\s+(?:di\s+|of\s+)?/, { g: 0.5 }],
  [/^(?:pizzico|pizzichi|presa|prise|prisen|dash|dashes|spruzzo|spruzzata|schuss|spritzer|goccio|gocce|drop|drops|tropfen)\s+(?:di\s+|of\s+)?/, { g: 0.5 }],
  [/^(?:cucchiaio|cucchiai|cucchiaiata|tablespoon|tablespoons|esslöffel|essloffel)\s+(?:di\s+|of\s+)?(?:raso|rasi|colmo|colmi\s+)?/, { ml: 15 }],
  [/^(?:cucchiaino|cucchiaini|teaspoon|teaspoons|teeloffel)\s+(?:di\s+|of\s+)?/, { ml: 5 }],
  [/^(?:spicchio|spicchi|clove|cloves|zehe|zehen)\s+(?:di\s+|d\s+|of\s+)?/, { piece: true }],
  [/^(?:testa|teste|bulb|bulbs|knolle|knollen|cespo|cespi|kopf|kopfe)\s+(?:di\s+|d\s+|of\s+)?/, { g: null, whole: true }],
];

const UNIT_G = { g: 1, kg: 1000, mg: 0.001, oz: 28.3495, lb: 453.592 };
const UNIT_ML = { ml: 1, l: 1000, dl: 100, cl: 10, tsp: 5, tbsp: 15, cup: 240, floz: 29.5735 };

/**
 * Grams of one parsed ingredient {qty, unit, name}, using the food's piece weight / density.
 * Returns {grams, food} — grams null when it can't be worked out; food null when unknown.
 */
export function gramsOf(ing) {
  let name = simplify(ing.name);
  let qty = ing.qty;
  let unit = ing.unit || '';
  let container = null;
  for (const [re, c] of CONTAINERS) {
    const m = name.match(re);
    if (m && m[0].length < name.length) { container = c; name = name.slice(m[0].length); break; }
  }
  const food = findFood(name);
  if (!food) return { grams: null, food: null };
  if (qty == null) return { grams: null, food, toTaste: true };
  const dens = food.dens || 1;
  if (unit in UNIT_G) return { grams: qty * UNIT_G[unit], food };
  if (unit in UNIT_ML) return { grams: qty * UNIT_ML[unit] * dens, food };
  if (unit === 'pinch') return { grams: qty * 0.4, food };
  if (unit === 'clove') return { grams: qty * (food.piece && food.piece < 10 ? food.piece : 4), food };
  if (unit === 'slice') return { grams: qty * (food.slice || food.piece || 25), food };
  if (unit === 'bunch') return { grams: qty * (food.bunch || 25), food };
  if (unit === 'can') return { grams: qty * (food.can || 400), food };
  if (unit === 'packet') return { grams: qty * (food.pack || 250), food };
  if (container) {
    if (container.g !== undefined && container.g !== null) return { grams: qty * container.g, food };
    if (container.ml) return { grams: qty * container.ml * dens, food };
    if (container.can) return { grams: qty * (food.can || food.pack || 400), food };
    if (container.pack) return { grams: qty * (food.pack || food.can || 250), food };
    if (container.slice) return { grams: qty * (food.slice || 25), food };
    if (container.piece) return { grams: qty * (food.piece || 4), food };
    if (container.whole) return { grams: qty * (food.piece ? food.piece * 10 : 300), food };
  }
  if (unit === '' || unit === 'pcs') return food.piece ? { grams: qty * food.piece, food } : { grams: null, food };
  return { grams: null, food };
}

/**
 * Estimated calories and protein of a whole recipe (as written, for r.servings people).
 * Result: { kcal, protein, perServing: {kcal, protein}, servings, known, unknown: [names],
 *           items: [{name, grams, kcal, protein}], partial } — or null when nothing could be estimated.
 * Ingredients "to taste" (no quantity) are left out.
 */
export function estimateNutrition(r) {
  const servings = r.servings || 4;
  let kcal = 0;
  let protein = 0;
  const items = [];
  const unknown = [];
  let skipped = 0;
  for (const raw of r.ingredients || []) {
    const ing = raw.name != null ? raw : parseIngredient(raw.raw || '');
    if (!ing.name) continue;
    if (ing.qty == null) { skipped++; continue; }
    const { grams, food } = gramsOf(ing);
    if (!food || grams == null) { unknown.push(ing.name); continue; }
    const k = (grams * food.kcal) / 100;
    const p = (grams * food.prot) / 100;
    kcal += k;
    protein += p;
    items.push({ name: ing.name, food: food.name, grams, kcal: k, protein: p });
  }
  if (!items.length) return null;
  // partial: something with a quantity wasn't recognised
  const partial = unknown.length > 0;
  return {
    kcal, protein, servings, items, unknown, skipped, partial,
    known: items.length,
    perServing: { kcal: kcal / servings, protein: protein / servings },
  };
}

// values printed in the book or stated by the website (per serving) beat our estimate
export function statedNutrition(r) {
  const st = r.nutrition;
  if (!st || (!Number.isFinite(st.kcal) && !Number.isFinite(st.protein))) return null;
  const servings = r.servings || 4;
  const est = (!Number.isFinite(st.kcal) || !Number.isFinite(st.protein)) ? estimateNutrition(r) : null;
  const kcal = Number.isFinite(st.kcal) ? st.kcal : est?.perServing.kcal;
  const protein = Number.isFinite(st.protein) ? st.protein : est?.perServing.protein;
  if (kcal == null || protein == null) return null;
  return {
    kcal: kcal * servings, protein: protein * servings, servings, items: [], unknown: [], skipped: 0, partial: false, known: 0,
    stated: true, perServing: { kcal, protein },
  };
}

const cache = new Map();
/** Cached per recipe version (id + updatedAt). */
export function nutritionOf(r) {
  const key = `${r.id}|${r.updatedAt || ''}|${r.servings || ''}`;
  if (cache.has(key)) return cache.get(key);
  const n = statedNutrition(r) || estimateNutrition(r);
  if (cache.size > 2000) cache.clear();
  cache.set(key, n);
  return n;
}
