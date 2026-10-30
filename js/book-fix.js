// Tidying up recipes imported from a book with an older version of the importer:
// - entries that aren't recipes ("Introduction", "Send the Book!", pages of adverts) → removed
// - "Timing Information" / "Nutritional Information" tables that became entries of their own
//   → their times and nutrition values go back into the recipe they belong to (the one before)
// - adverts and nutrition rows left inside a recipe's steps → removed
import { parseIngredient } from './parse.js';
import { isNotRecipeTitle, isMetaHeading, isPromoLine, isNutritionLine, parseNutrition, parseTimeTable } from './recipe-text.js';
import { durationsIn, formatMinutes } from './times.js';

const TIME_WORD = /(?<![\p{L}])(?:total time|total|cooking|cook time|preparation|prep time|prep|cottura|preparazione|tempo totale|kochzeit|zubereitung|gesamtzeit)(?![\p{L}])/giu;

function textOf(r) {
  return [...(r.steps || []), r.notes || '', ...(r.ingredients || []).map((i) => i.raw || '')].filter(Boolean).join(' ');
}

// "1 h 30 m Cooking 10 m Total Time 9 h 40 m": the first label ("Preparation") was taken for a heading
function timesFrom(text) {
  const labels = (text.match(TIME_WORD) || []).length;
  const values = durationsIn(text).length;
  return parseTimeTable(values > labels ? `Preparation ${text}` : text);
}

function quantified(r) {
  return (r.ingredients || []).filter((i) => {
    const raw = i.raw || '';
    if (isNutritionLine(raw)) return false;
    const q = i.qty != null ? i.qty : parseIngredient(raw).qty;
    return q != null;
  }).length;
}

/** Plan for one book's recipes (sorted as in the book). Nothing is changed here. */
export function planBookFix(recipes) {
  const list = [...recipes].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const remove = [];
  const patch = new Map();
  let lastReal = null;
  for (const r of list) {
    const title = String(r.title || '').trim();
    const steps = r.steps || [];
    const promo = steps.filter(isPromoLine).length + (isPromoLine(r.notes || '') ? 1 : 0);
    const ing = quantified(r);
    if (isMetaHeading(title)) {
      const text = textOf(r);
      remove.push({ id: r.id, title, reason: 'meta', sure: true });
      if (lastReal) {
        const p = patch.get(lastReal.id) || { times: {}, nutrition: null };
        if (/nutri|nähr/i.test(title) || isNutritionLine(text)) {
          const n = parseNutrition(text);
          if (n.kcal != null || n.protein != null) p.nutrition = { ...n, per: 'serving' };
        }
        if (!/nutri|nähr/i.test(title)) {
          // the timing entry often swallowed the nutrition table as well
          const cut = text.split(/nutrition(?:al)? information:?/i);
          Object.assign(p.times, timesFrom(cut[0]));
          if (cut[1] && !p.nutrition) {
            const n = parseNutrition(cut[1]);
            if (n.kcal != null || n.protein != null) p.nutrition = { ...n, per: 'serving' };
          }
        }
        patch.set(lastReal.id, p);
      }
      continue;
    }
    if (isNotRecipeTitle(title)) { remove.push({ id: r.id, title, reason: 'title', sure: true }); continue; }
    if (promo >= 2 && promo >= ing) { remove.push({ id: r.id, title, reason: 'promo', sure: true }); continue; }
    if (!r.bookFixOk && (ing < 2 || !steps.length)) { remove.push({ id: r.id, title, reason: 'thin', sure: false }); continue; }
    lastReal = r;
    // adverts and nutrition rows inside the steps
    const keep = steps.filter((s) => !isPromoLine(s) && !isNutritionLine(s));
    if (keep.length !== steps.length) {
      const p = patch.get(r.id) || { times: {}, nutrition: null };
      p.steps = keep;
      patch.set(r.id, p);
    }
  }
  const changes = [];
  for (const [id, p] of patch) {
    const r = list.find((x) => x.id === id);
    const out = {};
    const times = { ...(r.times || {}) };
    let addTimes = false;
    for (const [k, v] of Object.entries(p.times || {})) if (times[k] == null) { times[k] = v; addTimes = true; }
    if (addTimes) {
      out.times = times;
      if (!r.time) {
        const total = times.total ?? ((times.prep || 0) + (times.cook || 0) + (times.rest || 0));
        if (total) out.time = formatMinutes(total);
      }
    }
    if (p.nutrition && !r.nutrition) out.nutrition = p.nutrition;
    if (p.steps) out.steps = p.steps;
    if (Object.keys(out).length) changes.push({ id, title: r.title, patch: out });
  }
  return { remove, changes };
}

/** Recipes grouped by the book they came from: {bookId: [recipes]} */
export function booksOf(recipes) {
  const out = {};
  for (const r of recipes) {
    const id = r.bookId || (/^r_(b[a-z0-9]+)_\d{3}$/.exec(r.id || '') || [])[1];
    if (!id) continue;
    (out[id] ||= []).push(r);
  }
  return out;
}
