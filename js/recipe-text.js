// Turns recipe text (read from a photo, or pasted) into title, servings, time,
// ingredients, steps and notes. Italian, German and English.
// Input: lines as {text, h?, brk?}: h = text height (bigger = title), brk = a new paragraph starts here.
import { parseIngredient } from './parse.js';

const HEAD = {
  ing: /^(ingredienti|ingredienti per\b.*|occorrente|cosa (?:ti )?serve|zutaten|zutaten für\b.*|ingredients|you(?:'| wi)ll need)\s*:?$/i,
  steps: /^(preparazione|procedimento|esecuzione|come si prepara|come prepararl[aoie]|zubereitung|anleitung|so geht'?s|so wird'?s gemacht|method|directions|instructions|preparation|steps)\s*:?$/i,
  notes: /^(consigli[oi]?|il consiglio|i consigli|note|nota|varianti|variante|curiosità|conservazione|tipps?|hinweise?|varianten?|notes?|tips?|variations?|cook'?s notes?)(?:\s+(?:dello chef|del cuoco|vom koch))?\s*:?$/i,
};
// "Ingredienti per 4 persone", "Zutaten für 4 Personen"
const ING_HEAD_LOOSE = /^(ingredienti|zutaten|ingredients)\b.{0,40}$/i;

const SERVINGS = [
  /\b(?:serves|servings|porzioni|portionen|yield|makes)\s*:?\s*(\d{1,2})\b/i,
  /\b(\d{1,2})\s*(?:persone|porzioni|personen|portionen|persons|people|servings|portions|pers\.)/i,
  /\b(?:für|per|for|makes|ergibt|circa)\s+(?:ca\.?\s+|about\s+)?(\d{1,2})\s*(?:stück|stücke|stk\.?|pezzi|fette|slices|pieces|cookies|biscotti|muffins?|kekse)\b/i,
];
const TIME = /(?:tempo(?: totale| di preparazione)?|preparazione|cottura|zeit|zubereitungszeit|gesamtzeit|backzeit|ready in|time|total time|prep(?:aration)? time)\s*:?\s*([\d][^·|•\n]{0,40}?(?:min(?:uti|uten|utes)?|h|ore|ora|stunden?|std\.?|hours?)\b(?:\s*\+\s*[\d][^·|•\n]{0,30}?(?:min(?:uti|uten|utes)?|h|ore|ora|stunden?|hours?)\b(?:\s+[a-zà-ü ]{0,25})?)?)/i;

const BULLET = /^[\s•·*\-–—»«►▪■□○◦‣⁃~>]+/;
const NUMBERED = /^(?:\(?\d{1,2}[.)]|(?:step|schritt|passo|fase)\s*\d{1,2}[.:)]?)\s+/i;
// an ingredient line that obviously goes on: "… extravergine di", "… a cubetti e", "…,"
const CONTINUES = /(?:[,(-]|\b(?:di|d'|del|della|dei|delle|e|ed|o|con|per|a|al|alla|da|in|of|and|or|with|for|von|vom|mit|und|oder|zum|zur|für))$/i;
const TO_TASTE = /\b(?:q\.?\s?b\.?|quanto basta|to taste|nach belieben|nach geschmack|a piacere|etwas)\s*\.?$/i;

const STOP = {
  it: ['di', 'e', 'il', 'la', 'con', 'per', 'un', 'una', 'del', 'della', 'le', 'nel', 'al', 'alla', 'che', 'fino', 'poi', 'aggiungete', 'mescolate', 'cuocete', 'fate'],
  de: ['und', 'mit', 'der', 'die', 'das', 'für', 'zu', 'den', 'im', 'mit', 'ein', 'eine', 'auf', 'bis', 'dann', 'in', 'geben', 'lassen', 'minuten'],
  en: ['and', 'the', 'with', 'of', 'to', 'a', 'in', 'until', 'then', 'add', 'into', 'for', 'over', 'minutes', 'stir', 'mix'],
};

export function detectLang(text) {
  const words = String(text).toLowerCase().match(/[a-zà-öø-ÿß]+/g) || [];
  const score = {};
  for (const [lang, list] of Object.entries(STOP)) {
    const set = new Set(list);
    score[lang] = words.filter((w) => set.has(w)).length;
  }
  if (/[äöüß]/i.test(text)) score.de += 3;
  if (/[àèéìòù]/i.test(text)) score.it += 3;
  const [best, n] = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  return n > 0 ? best : 'it';
}

function clean(s) {
  return String(s || '')
    .replace(/[|_]{1,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isHeader(t) {
  for (const [kind, re] of Object.entries(HEAD)) if (t.length <= 40 && re.test(t)) return kind;
  if (t.length <= 45 && ING_HEAD_LOOSE.test(t) && !/\d+\s*(?:g|ml|kg|l)\b/i.test(t)) return 'ing';
  return null;
}

export function isIngredientLike(t) {
  if (t.length > 75) return false;
  if (TO_TASTE.test(t)) return true;
  const p = parseIngredient(t);
  if (p.qty != null && !/[.!?]$/.test(t) && t.split(' ').length <= 12) return true;
  return false;
}

export function isStepLike(t) {
  return NUMBERED.test(t) || t.length > 60 || (/[.!?]$/.test(t) && t.split(' ').length >= 6);
}

function servingsOf(t) {
  for (const re of SERVINGS) { const m = t.match(re); if (m && +m[1] > 0 && +m[1] <= 40) return +m[1]; }
  return null;
}

const lowerFirst = (g) => g.charAt(0).toLowerCase() + g.slice(1);

function niceTitle(t) {
  t = t.replace(/[.:]+$/, '').trim();
  const letters = t.replace(/[^a-zà-öø-ÿ]/gi, '');
  if (letters && letters === letters.toUpperCase()) t = t.charAt(0) + t.slice(1).toLowerCase();
  return t;
}

function isMeta(t) {
  return t.length <= 90 && (servingsOf(t) != null || TIME.test(t)) && !isIngredientLike(t.replace(/^.*?:\s*/, 'x'));
}

export function textToLines(text) {
  const out = [];
  let brk = true;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const t = clean(raw);
    if (!t) { brk = true; continue; }
    out.push({ text: raw.trim(), brk });
    brk = false;
  }
  return out;
}

export function parseRecipeText(input) {
  const lines = (typeof input === 'string' ? textToLines(input) : input)
    .map((l) => ({ ...l, text: clean(l.text) }))
    .filter((l) => l.text && !/^\d{1,3}$/.test(l.text) && /[a-zà-öø-ÿ0-9]/i.test(l.text));
  const hasHeights = lines.some((l) => l.h);
  const all = lines.map((l) => l.text).join('\n');

  // Title: biggest text near the top (photos) or first plain line (pasted text).
  let titleIdx = -1;
  const top = lines.slice(0, 8);
  if (hasHeights) {
    let best = -1;
    top.forEach((l, i) => {
      if (l.text.replace(/[^a-zà-öø-ÿ]/gi, '').length < 3 || isHeader(l.text) || isMeta(l.text)) return;
      if (best < 0 || l.h > top[best].h * 1.15) best = i;
    });
    titleIdx = best;
  }
  if (titleIdx < 0) {
    titleIdx = top.findIndex((l) => !isHeader(l.text) && !isMeta(l.text) && !isIngredientLike(l.text)
      && l.text.length <= 70 && l.text.replace(/[^a-zà-öø-ÿ]/gi, '').length >= 3);
  }
  const title = titleIdx >= 0 ? niceTitle(lines[titleIdx].text) : '';

  let servings = null;
  let time = '';
  const ingredients = [];
  const steps = [];
  const notes = [];
  const intro = [];
  let state = 'pre';
  let group = '';
  let sawIngHeader = false;
  let stepBuf = '';
  let stepNumbered = false;

  const flushStep = () => { if (stepBuf.trim()) steps.push(stepBuf.trim()); stepBuf = ''; };
  const appendText = (buf, t) => {
    if (!buf) return t;
    if (/[-‐]$/.test(buf) && /^[a-zà-öø-ÿ]/.test(t)) return buf.replace(/[-‐]$/, '') + t; // hyphenated word
    return `${buf} ${t}`;
  };

  lines.forEach((l, i) => {
    if (i === titleIdx) return;
    let t = l.text;
    const header = isHeader(t);
    if (header) {
      if (header === 'ing') { const s = servingsOf(t); if (s) servings = servings || s; sawIngHeader = true; }
      if (state === 'steps') flushStep();
      state = header; group = '';
      return;
    }
    // servings / time lines ("Per 6 persone · Tempo: 30 min")
    if (isMeta(t) && state !== 'steps' && state !== 'notes') {
      servings = servings || servingsOf(t);
      const tm = t.match(TIME);
      if (tm) time = time || tm[1].trim();
      return;
    }
    const bulleted = BULLET.test(t);
    t = t.replace(BULLET, '').trim();
    if (!t) return;

    if (state === 'pre') {
      if (isIngredientLike(t) || (bulleted && t.length < 50)) state = 'ing';
      else if (isStepLike(t) && (ingredients.length || sawIngHeader)) state = 'steps';
      else { intro.push(t); return; }
    }

    if (state === 'ing') {
      // A sentence in the ingredient list means the method has started (no heading in between).
      if (!isIngredientLike(t) && isStepLike(t) && !(bulleted && t.length < 60) && ingredients.length) {
        state = 'steps';
      } else {
        // sub-heading: "Per la crema:", "Für den Teig:", "For the sauce:"
        if (/:$/.test(t) && t.length <= 40 && !isIngredientLike(t)) { group = t.replace(/:$/, '').trim(); return; }
        const prev = ingredients[ingredients.length - 1];
        // Typesetting: a line wraps when its next word doesn't fit. If this short lowercase bit
        // would not have fitted after the line above, it is that line's tail ("3 1/2 tsp baking" + "powder").
        const firstWord = t.split(' ')[0];
        const wordW = l.w && t.length ? (l.w * firstWord.length) / t.length : 0;
        const ranToEdge = prev && prev.right && l.colRight && prev.right + (l.h || 20) * 0.5 + wordW > l.colRight;
        if (prev && ranToEdge && /^[a-zà-öø-ÿ]/.test(t) && parseIngredient(t).qty == null && !bulleted && !TO_TASTE.test(t) && t.split(' ').length <= 2) {
          prev.raw = appendText(prev.raw.replace(/ \([^)]*\)$/, ''), t) + (group ? ` (${lowerFirst(group)})` : '');
          prev.right = l.right;
          return;
        }
        // wrapped line: "1 cucchiaio di olio extravergine di" + "oliva"
        if (prev && CONTINUES.test(prev.raw.replace(/ \([^)]*\)$/, '')) && /^[a-zà-öø-ÿ(]/.test(t) && parseIngredient(t).qty == null && !bulleted && t.split(' ').length <= 4) {
          prev.raw = appendText(prev.raw.replace(/ \([^)]*\)$/, ''), t) + (group ? ` (${lowerFirst(group)})` : '');
          return;
        }
        ingredients.push({ raw: group ? `${t} (${lowerFirst(group)})` : t, right: l.right });
        return;
      }
    }

    if (state === 'steps') {
      if (NUMBERED.test(t)) { flushStep(); stepNumbered = true; stepBuf = t.replace(NUMBERED, ''); return; }
      let newStep = false;
      if (stepBuf && !stepNumbered) {
        // a new paragraph starts a new step; pasted text without blank lines: one sentence-ending line = one step
        // never split a sentence in two
        newStep = /[.!?)]$/.test(stepBuf) && (l.brk || !hasHeights);
      }
      if (newStep) flushStep();
      stepBuf = appendText(stepBuf, t);
      return;
    }

    if (state === 'notes') {
      notes.push(t);
    }
  });
  flushStep();

  // Nothing structured? Treat every line with a quantity as an ingredient, the rest as steps.
  if (!ingredients.length && intro.length) {
    for (const t of intro.splice(0)) (isIngredientLike(t) ? ingredients.push({ raw: t }) : steps.push(t));
  }
  if (servings == null) servings = servingsOf(all.slice(0, 400));
  if (!time) { const tm = all.match(TIME); if (tm) time = tm[1].trim(); }

  const noteText = [intro.join(' '), notes.join(' ')].filter(Boolean).join('\n\n');
  return {
    title,
    servings: servings || 4,
    servingsFound: servings != null,
    time,
    ingredients: ingredients.map((x) => ({ raw: x.raw.replace(/\s+([,.;:])/g, '$1').trim() })).filter((x) => x.raw.length > 1),
    steps: steps.map((s) => s.replace(/\s+([,.;:!?])/g, '$1')),
    notes: noteText,
    lang: detectLang(all),
  };
}
