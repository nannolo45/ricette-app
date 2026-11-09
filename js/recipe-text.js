// Turns recipe text (read from a photo, or pasted) into title, servings, time,
// ingredients, steps and notes. Italian, German and English.
// Input: lines as {text, h?, brk?}: h = text height (bigger = title), brk = a new paragraph starts here.
import { parseIngredient } from './parse.js';
import { extractTimes, hasTimes, formatMinutes, durationsIn } from './times.js';

const HEAD = {
  ing: /^(ingredienti|ingredienti per\b.*|occorrente|cosa (?:ti |vi )?serve|ti serve|vi serve|zutaten|zutaten für\b.*|(?:dafür |das )?brauchst du|du brauchst|was du brauchst|(?:dafür |das )?brauchen sie|sie brauchen|ingredients|you(?:'| wi)ll need|what you(?:'ll)? need)\s*:?$/i,
  steps: /^(preparazione|procedimento|esecuzione|come si prepara|come prepararl[aoie]|come si fa|zubereitung|anleitung|(?:und )?so geht['’´`]?s|so geht es|so wird['’´`]?s gemacht|so machst du['’´`]?s|method|directions|instructions|preparation|steps|how to make it)\s*:?$/i,
  notes: /^(consigli[oi]?|il consiglio|i consigli|note|nota|varianti|variante|curiosità|conservazione|tipps?|hinweise?|varianten?|notes?|tips?|variations?|cook'?s notes?)(?:\s+(?:dello chef|del cuoco|vom koch))?\s*:?$/i,
};
// "Timing Information:", "Nutritional Information:", "Valori nutrizionali", "Nährwerte": tables, not recipe text
const META_HEAD = /^(?:timing(?: information)?|times|cooking times|nutrition(?:al)?(?: (?:information|info|facts|values|data))?|nutrition facts|amount per serving\b.*|per serving|valori nutrizionali\b.*|informazioni nutrizionali|tabella nutrizionale|tempi|nährwerte\b.*|nährwertangaben|nährwertinformationen|zeiten|zeitangaben)\s*:?$/i;
export const isMetaHeading = (t) => META_HEAD.test(String(t).trim());

// Pages of a book that aren't recipes (titles)
const NOT_RECIPE = /^(?:introduction|intro|foreword|preface|prologue|epilogue|conclusion|final words|(?:table of )?contents|index|glossary|copyright\b.*|legal(?: notes?| notice| disclaimer)?|disclaimer|about the authors?|about me|meet the author|acknowledg(?:e)?ments?|dedication|thank(?:s| you)\b.*|any issues\b.*|contact(?: me| us)?\b.*|(?:common )?abbreviations|conversions?(?: tables?| charts?)?|measurements?(?: conversions?)?|kitchen (?:tools|equipment)|free (?:gift|books?|bonus|download)\b.*|newsletter\b.*|join the club\b.*|subscribe\b.*|send the book!?|(?:also by|other books|more books)\b.*|interested in\b.*|can i ask\b.*|let'?s be friends\b.*|come on\b.*|facebook|twitter|instagram|pinterest|youtube|introduzione|prefazione|premessa|indice(?: delle ricette)?|sommario|glossario|ringraziamenti|dedica|conclusioni?|l'autore|l['’]autrice|sull['’]autore|chi sono|note legali|tabella delle conversioni|equivalenze|einleitung|einführung|vorwort|nachwort|inhalt|inhaltsverzeichnis|register|rezeptregister|glossar|impressum|danksagung|danke\b.*|über (?:die autorin|den autor|mich)|abkürzungen|umrechnungstabelle|schlusswort)\s*[:.!?]*$/i;
export const isNotRecipeTitle = (t) => NOT_RECIPE.test(String(t).replace(/\s+/g, ' ').trim()) || isMetaHeading(t);

// Self-promotion at the end of free e-books: links, newsletters, reviews, social networks
const PROMO = /(?:\b(?:subscribe|newsletter|sign up|mailing list|email address|e-mail address|box ?set|free (?:e-?)?books?|download (?:my|the|this)|tap the (?:book )?cover|follow (?:the|this) link|click (?:here|the link|them)|leave a review|post a review|write a review|amazon|kindle|author page|facebook|twitter|instagram|pinterest|youtube|social networks?|like and subscribe|follow me|my (?:other |new )?books|send the book|join the club|iscriviti|lascia una recensione|recensione su|seguimi|abonnier|newsletter|rezension|bewertung auf|folge mir)\b|https?:\/\/|www\.)/i;
export const isPromoLine = (t) => PROMO.test(String(t));

// "Calories Fat Protein", "1092 kcal 78.6 g 157.5g": a nutrition table, not ingredients
const NUTRIENT = /(?<![\p{L}])(?:calories|calorie|kalorien|energy|energia|energie|brennwert|fat|saturated fat|grassi(?: saturi)?|fett|carbohydrates?|carbs|carboidrati|kohlenhydrate|protein|proteins|proteine|eiweiß|eiweiss|cholesterol|colesterolo|cholesterin|sodium|sodio|natrium|fiber|fibre|fibra|fibre alimentari|ballaststoffe|sugars?|zuccheri|zucker|salt|sale|salz)(?![\p{L}])/giu;
const NUTRI_VALUE = /(\d+(?:[.,]\d+)?)\s*(kcal|cal|kj|mg|g|%)?(?![\p{L}\d])/giu;
export function isNutritionLine(t) {
  t = String(t).trim();
  if (/percent daily values?|% daily value|tagesbedarf|fabbisogno giornaliero|based on a 2[,.]?000/i.test(t)) return true;
  const labels = (t.match(NUTRIENT) || []).length;
  if (labels >= 3) return true;
  // only numbers with nutrition units: "1092 kcal 78.6 g 157.5g 39.1 g 155 mg"
  const rest = t.replace(NUTRI_VALUE, '').replace(NUTRIENT, '').replace(/[\s|·•,;:*-]/g, '');
  const values = (t.match(/\d+(?:[.,]\d+)?\s*(?:kcal|mg|g)(?![\p{L}])/giu) || []).length;
  return !rest && values >= 2 && /kcal|mg/i.test(t) || (labels >= 1 && /\d\s*(?:kcal|mg)\b/i.test(t) && !rest);
}

const NUTRI_KEYS = [
  ['kcal', /^(?:calories|calorie|kalorien|energy|energia|energie|brennwert)$/i],
  ['fat', /^(?:fat|grassi|fett)$/i],
  ['carbs', /^(?:carbohydrates?|carbs|carboidrati|kohlenhydrate)$/i],
  ['protein', /^(?:protein|proteins|proteine|eiweiß|eiweiss)$/i],
];
/**
 * A nutrition table read row by row or column by column: labels and values are paired in order
 * ("Calories Fat Protein … 1092 kcal 78.6 g 39.1 g …" or "Calories 312 kcal Fat 12 g").
 * → {kcal, fat, carbs, protein} (the ones found), per serving as the book states them.
 */
export function parseNutrition(text) {
  const s = String(text || '');
  const tokens = [];
  let m;
  NUTRIENT.lastIndex = 0;
  while ((m = NUTRIENT.exec(s))) {
    // "saturated fat" is not the fat total
    const key = /saturated|saturi/i.test(m[0]) ? 'other' : (NUTRI_KEYS.find(([, re]) => re.test(m[0]))?.[0] || 'other');
    tokens.push({ i: m.index, end: m.index + m[0].length, label: key });
  }
  NUTRI_VALUE.lastIndex = 0;
  while ((m = NUTRI_VALUE.exec(s))) {
    if (tokens.some((t) => m.index >= t.i && m.index < t.end)) continue;
    // "2,000 calorie diet" is not a value
    if (/^\s*calorie diet/i.test(s.slice(m.index + m[0].length, m.index + m[0].length + 14))) continue;
    tokens.push({ i: m.index, value: parseFloat(m[1].replace(',', '.')), unit: (m[2] || '').toLowerCase() });
  }
  tokens.sort((a, b) => a.i - b.i);
  const queue = [];
  const out = {};
  for (const tk of tokens) {
    if (tk.label) { queue.push(tk.label); continue; }
    const key = queue.shift();
    if (!key) continue;
    if (key !== 'other' && out[key] == null && Number.isFinite(tk.value)) out[key] = key === 'kcal' && tk.unit === 'kj' ? Math.round(tk.value / 4.184) : tk.value;
  }
  return out;
}

const TIME_KEYS = [
  ['total', /^(?:total(?: time)?|tempo totale|gesamt(?:zeit)?|ready in)$/i],
  ['rest', /^(?:rest(?:ing)?(?: time)?|marinating|riposo|ruhezeit|wartezeit)$/i],
  ['cook', /^(?:cook(?:ing)?(?: time)?|cottura|kochzeit|backzeit|garzeit)$/i],
  ['prep', /^(?:prep(?:aration)?(?: time)?|preparazione|zubereitung(?:szeit)?|vorbereitung|arbeitszeit)$/i],
];
const TIME_LABEL = /(?<![\p{L}])(?:total time|total|tempo totale|gesamtzeit|ready in|resting time|resting|marinating|riposo|ruhezeit|wartezeit|cooking time|cooking|cook time|cottura|kochzeit|backzeit|garzeit|preparation time|preparation|prep time|prep|preparazione|zubereitungszeit|zubereitung|vorbereitung|arbeitszeit)(?![\p{L}])/giu;
/** A table of times, row by row or column by column ("Preparation Cooking Total Time 1 h 15 m 6 m 1 h 21 m"). */
export function parseTimeTable(text) {
  const s = String(text || '');
  const tokens = [];
  let m;
  TIME_LABEL.lastIndex = 0;
  while ((m = TIME_LABEL.exec(s))) tokens.push({ i: m.index, label: TIME_KEYS.find(([, re]) => re.test(m[0]))?.[0] });
  for (const d of durationsIn(s)) tokens.push({ i: d.index, min: d.min });
  tokens.sort((a, b) => a.i - b.i);
  const queue = [];
  const out = {};
  for (const tk of tokens) {
    if (tk.label) { queue.push(tk.label); continue; }
    const key = queue.shift();
    if (key && out[key] == null) out[key] = Math.round(tk.min);
  }
  return out;
}

// "Ingredienti per 4 persone", "Zutaten für 4 Personen"
const ING_HEAD_LOOSE = /^(ingredienti|zutaten|ingredients)\b.{0,40}$/i;

const SERVINGS = [
  /\bamount per serving\s*\(\s*(\d{1,2})\s*total\s*\)/i,
  /\b(?:serves|servings|porzioni|portionen|yield|makes)\s*:?\s*(\d{1,2})\b/i,
  /\b(\d{1,2})\s*(?:persone|porzioni|personen|portionen|persons|people|servings|portions|pers\.)/i,
  /\b(?:für|per|for|makes|ergibt|circa)\s+(?:ca\.?\s+|about\s+)?(\d{1,2})\s*(?:stück|stücke|stk\.?|pezzi|fette|slices|pieces|cookies|biscotti|muffins?|kekse)\b/i,
];
const TIME = /(?:tempo(?: totale| di preparazione)?|preparazione|cottura|zeit|zubereitungszeit|gesamtzeit|backzeit|ready in|time|total time|prep(?:aration)? time)\s*:?\s*([\d][^·|•\n]{0,40}?(?:min(?:uti|uten|utes)?|h|ore|ora|stunden?|std\.?|hours?)\b(?:\s*\+\s*[\d][^·|•\n]{0,30}?(?:min(?:uti|uten|utes)?|h|ore|ora|stunden?|hours?)\b(?:\s+[a-zà-ü ]{0,25})?)?)/i;

const BULLET = /^[\s•·*\-–—»«►▪■□○◦‣⁃~>]+/;
const NUMBERED = /^(?:\(?\d{1,2}[.)]|(?:step|schritt|passo|fase)\s*\d{1,2}[.:)]?)\s+/i;
// a step number misread as a sign or a letter ("@. Gib", "S. Mit"), only once the steps are numbered
const JUNK_NUMBER = /^(?:[^\s\p{L}\p{N}]{1,2}|\p{L})[.)]\s+(?=\p{Lu}\p{Ll})/u;
// marks the photo reader puts before a line ("‚Parmesan", "| Salz")
const LEAD_JUNK = /^[‚'‘’`´"„“”|¦]+\s*/;
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
    .replace(/<\?xml[^>]*\?>|\?xml version=[^>]*\?>/gi, ' ')
    .replace(/(\d)\s?[oº]\s?([CF])\b/g, '$1 °$2')
    .replace(/[|_]{1,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isHeader(t) {
  if (t.length <= 50 && META_HEAD.test(t)) return 'meta';
  for (const [kind, re] of Object.entries(HEAD)) if (t.length <= 40 && re.test(t)) return kind;
  if (t.length <= 45 && ING_HEAD_LOOSE.test(t) && !/\d+\s*(?:g|ml|kg|l)\b/i.test(t)) return 'ing';
  return fuzzyHeader(t);
}

// v56: headings as a photo reader gets them wrong ("So geht's:" → "Pi So geht ER", "Zutaten" → "Zutaien").
// Letters only, no accents; long enough that one or two wrong letters can't turn another word into a heading.
const FUZZY_HEADS = {
  ing: ['ingredienti', 'occorrente', 'cosaserve', 'zutaten', 'dafurbrauchstdu', 'dasbrauchstdu', 'wasdubrauchst', 'ingredients', 'youwillneed', 'whatyouneed'],
  steps: ['preparazione', 'procedimento', 'esecuzione', 'comesiprepara', 'zubereitung', 'anleitung', 'sogehts', 'sowirdsgemacht', 'directions', 'instructions', 'preparation'],
};
const letters = (s) => String(s).toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
/** Fewest letter changes that turn `key` into some stretch of `s` (s may have junk before and after). */
function nearIn(key, s) {
  let prev = new Array(s.length + 1).fill(0);
  for (let i = 1; i <= key.length; i++) {
    const cur = [i];
    for (let j = 1; j <= s.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (key[i - 1] === s[j - 1] ? 0 : 1));
    prev = cur;
  }
  return Math.min(...prev);
}
export function fuzzyHeader(t) {
  t = String(t).trim();
  if (t.length > 40 || t.split(/\s+/).length > 5 || /[.!?]$/.test(t) || isNotRecipeTitle(t)) return null;
  // no amounts or times; one stray digit only where a letter was misread before the colon ("So geht 3:")
  const digits = (t.match(/\d/g) || []).length;
  if (digits > 1 || (digits === 1 && !/:$/.test(t))) return null;
  const s = letters(t);
  for (const [kind, keys] of Object.entries(FUZZY_HEADS)) {
    for (const k of keys) {
      if (s.length > k.length + 5 || s.length < k.length - 2) continue;
      if (nearIn(k, s) <= (k.length >= 12 ? 2 : 1)) return kind;
    }
  }
  return null;
}

export function isIngredientLike(t) {
  if (t.length > 75 || isNutritionLine(t)) return false;
  if (TO_TASTE.test(t)) return true;
  const p = parseIngredient(t);
  if (p.qty != null && !/[.!?]$/.test(t) && t.split(' ').length <= 12) return true;
  return false;
}

// v56: the amount after the name, as in a table or many German books: "Mozzarella 150 g", "Ei 1", "Parmesan 2 EL".
const TRAIL_QTY = /^(.*?\p{L}.*?)[\s.:…·_-]+(\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+|[½⅓⅔¼¾])\s*(\p{L}{1,12})?\.?$/u;
// "Mehl Type 405", "Seite 12", "Schritt 3", "Backzeit 20": a number that isn't an amount
const NOT_AMOUNT = /(?:^|\s)(?:typ|type|tipo|nr|no|n°|seite|page|pagina|pag|schritt|step|passo|fase|teil|parte|part|portionen|porzioni|personen|persone|servings|serves|grad|gradi|degrees|minuten|minuti|minutes|min|ore|stunden|hours|\p{L}*zeit|tempo|cottura|time|ofen|backofen|forno|oven|kapitel|capitolo|chapter|rezept|ricetta|recipe|ergibt|makes|yield|resa|°c?)\.?$/iu;
const unitOf = (w) => (w ? parseIngredient(`1 ${w} x`).unit : '');
/** "Mozzarella 150 g" → "150 g Mozzarella" (and the photo reader's slips: "150 9" → "150 g", "LTL" → "1 TL"). */
export function frontQty(t) {
  t = String(t).trim();
  if (parseIngredient(t).qty != null || t.split(/\s+/).length > 8 || /[!?]$/.test(t)) return t;
  let s = t
    .replace(/(\d{2,4})(?:\.|\s)9\.?$/, '$1 g') // a g read as 9
    .replace(/\s[lLI|]\s?(TL|EL|ml|g|kg)\.?$/, ' 1 $1') // a 1 read as l
    .replace(/(\s)((?=[\dOolI]*\d)[\dOolI]{2,4})(\s*\p{L}{0,3}\.?)$/u, (m, sp, n, rest) => sp + n.replace(/[Oo]/g, '0').replace(/[lI]/g, '1') + rest); // 1O0 → 100
  const m = s.match(TRAIL_QTY);
  if (!m) return t;
  const [, rawName, qty, unit = ''] = m;
  const name = rawName.replace(/[\s.:…·_|-]+$/, '').trim();
  if (!name || NOT_AMOUNT.test(name) || name.split(/\s+/).length > 6 || (!unit && unitOf(name))) return t;
  if (unit && !unitOf(unit)) return t;
  return `${qty.replace(/\s+/g, '')}${unit ? ` ${unit}` : ''} ${name}`;
}

export function isStepLike(t) {
  return NUMBERED.test(t) || t.length > 60 || (/[.!?]$/.test(t) && t.split(' ').length >= 6);
}

function servingsOf(t) {
  for (const re of SERVINGS) { const m = t.match(re); if (m && +m[1] > 0 && +m[1] <= 40) return +m[1]; }
  return null;
}

const GROUP_LEAD = /^(?:per\s+(?:il|lo|la|l'|l’|i|gli|le)\b|für\s+(?:den|die|das)\b|for\s+the\b)/i;
/**
 * An ingredient sub-heading ("Per la crema:", "Für den Teig:", "For the sauce", "## Salsa"): its text, or null.
 * Short, no quantity, and either ends with a colon, starts with "Per la / Für den / For the", or is a markdown heading.
 */
export function groupHeading(line) {
  let t = String(line || '').trim();
  const md = /^#{1,4}\s+/.test(t);
  t = t.replace(/^#{1,4}\s+/, '').replace(/^[-–•*]\s*/, '').trim();
  if (!t || t.length > 40 || /\d/.test(t)) return null;
  const colon = /:$/.test(t);
  const text = t.replace(/:$/, '').trim();
  if (!text || text.split(/\s+/).length > 6) return null;
  if (md || (colon && !isIngredientLike(text)) || (GROUP_LEAD.test(text) && !isIngredientLike(text))) return text.charAt(0).toUpperCase() + text.slice(1);
  return null;
}

/** Ingredient lines with their sub-headings → [{ raw, group? }] (headings themselves dropped). */
export function groupLines(lines) {
  let group = '';
  const out = [];
  for (const l of lines || []) {
    const raw = String(typeof l === 'string' ? l : l?.raw || '').trim();
    if (!raw) continue;
    const h = groupHeading(raw);
    if (h) { group = h; continue; }
    out.push(group ? { raw, group } : { raw });
  }
  return out;
}

function niceTitle(t) {
  t = t.replace(/[.:]+$/, '').trim();
  const letters = t.replace(/[^a-zà-öø-ÿ]/gi, '');
  if (letters && letters === letters.toUpperCase()) t = t.charAt(0) + t.slice(1).toLowerCase();
  return t;
}

function isMeta(t) {
  return t.length <= 120 && (servingsOf(t) != null || TIME.test(t) || hasTimes(extractTimes(t))) && !isIngredientLike(t.replace(/^.*?:\s*/, 'x'));
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

// v56: what a photo reader gets wrong in German: "Tomatensoβe" read as "TomatensoBe", "auBen"
const fixEszett = (t) => t.replace(/(?<=\p{Ll})B(?=\p{Ll}|\b)/gu, 'ß');

/**
 * v56: several photos (lines carry `photo`, the photo they came from). A photo that is only the ingredient list
 * goes before a photo that is only the method, and each gets its heading when the reader missed it, so the order the
 * photos were taken in, or a heading in a decorative font, can't push the ingredients into the steps.
 */
function byPhoto(lines) {
  const photos = [...new Set(lines.map((l) => l.photo))];
  if (photos.length < 2 || photos.length > 4 || photos.some((p) => p == null)) return lines;
  const pages = photos.map((p) => {
    const ls = lines.filter((l) => l.photo === p);
    let ing = 0; let step = 0; let ingHead = false; let stepHead = false; let firstIng = -1; let firstStep = -1;
    ls.forEach((l, i) => {
      const h = isHeader(l.text);
      if (h === 'ing') ingHead = true;
      if (h === 'steps') stepHead = true;
      if (h) return;
      const t = l.text.replace(BULLET, '').trim();
      if (isIngredientLike(frontQty(t))) { ing++; if (firstIng < 0) firstIng = i; } else if (isStepLike(t)) { step++; if (firstStep < 0) firstStep = i; }
    });
    let role = '';
    if (ingHead && stepHead) role = 'both';
    else if (ingHead || (ing >= 3 && ing > step * 2)) role = 'ing';
    else if (stepHead || (step >= 2 && step > ing * 2)) role = 'steps';
    return { ls, role, ingHead, stepHead, firstIng, firstStep };
  });
  if (pages.some((p) => p.role === 'both' || !p.role)) return lines;
  const firstSteps = pages.findIndex((p) => p.role === 'steps');
  const ordered = firstSteps < 0 ? pages
    : [...pages.slice(0, firstSteps), ...pages.filter((p, i) => i >= firstSteps && p.role === 'ing'), ...pages.filter((p, i) => i >= firstSteps && p.role !== 'ing')];
  const out = [];
  for (const p of ordered) {
    const at = p.role === 'ing' && !p.ingHead ? p.firstIng : p.role === 'steps' && !p.stepHead ? p.firstStep : -1;
    p.ls.forEach((l, i) => {
      if (i === at) out.push({ text: p.role === 'ing' ? 'Ingredients' : 'Method', brk: true, photo: l.photo });
      out.push(i === 0 ? { ...l, brk: true } : l);
    });
  }
  return out;
}

export function parseRecipeText(input) {
  const raw = typeof input === 'string' ? textToLines(input) : input;
  const german = detectLang(raw.map((l) => l.text).join('\n')) === 'de';
  const lines = byPhoto(raw
    .map((l) => ({ ...l, text: german ? fixEszett(clean(l.text)) : clean(l.text) }))
    .filter((l) => l.text && !/^\d{1,3}$/.test(l.text) && /[a-zà-öø-ÿ0-9]/i.test(l.text)));
  const hasHeights = lines.some((l) => l.h);
  const all = lines.map((l) => l.text).join('\n');

  // Title: biggest text near the top (photos) or first plain line (pasted text).
  let titleIdx = -1;
  // v56: the title is above the first heading ("Zutaten", "Dafür brauchst du"), never inside the list under it
  const firstHead = lines.slice(0, 8).findIndex((l) => isHeader(l.text));
  const top = lines.slice(0, firstHead >= 0 ? firstHead : 8);
  if (hasHeights) {
    let best = -1;
    top.forEach((l, i) => {
      if (l.text.replace(/[^a-zà-öø-ÿ]/gi, '').length < 3 || isHeader(l.text) || isMeta(l.text)) return;
      // v56: a misread line can come out tall; an ingredient is never the title
      if (isIngredientLike(frontQty(l.text))) return;
      if (best < 0 || l.h > top[best].h * 1.15) best = i;
    });
    titleIdx = best;
  }
  if (titleIdx < 0) {
    titleIdx = top.findIndex((l) => !isHeader(l.text) && !isMeta(l.text) && !isIngredientLike(frontQty(l.text))
      && l.text.length <= 70 && l.text.replace(/[^a-zà-öø-ÿ]/gi, '').length >= 3);
  }
  const title = titleIdx >= 0 ? niceTitle(lines[titleIdx].text) : '';

  let servings = null;
  let time = '';
  const times = {};
  const ingredients = [];
  const steps = [];
  const notes = [];
  const intro = [];
  let state = 'pre';
  let group = '';
  let sawIngHeader = false;
  let stepBuf = '';
  let stepNumbered = false;
  // tables of times and nutrition values ("Timing Information:", "Nutritional Information:")
  let timeBuf = '';
  let nutriBuf = '';
  let beforeMeta = 'pre';
  let metaKind = '';
  const nextHasTime = (i) => lines.slice(i + 1, i + 4).some((x) => durationsIn(x.text).length);

  const flushStep = () => {
    const st = stepBuf.trim();
    stepBuf = '';
    if (!st) return;
    // "…stir the syrup. To prepare the dough:" → the sub-heading becomes its own line
    const m = st.match(/^(.*[.!?)])\s+([^.!?:]{3,60}:)$/);
    if (m && m[2].split(/\s+/).length <= 8) { steps.push(m[1].trim(), m[2].trim()); return; }
    steps.push(st);
  };
  const appendText = (buf, t) => {
    if (!buf) return t;
    if (/[-‐]$/.test(buf) && /^[a-zà-öø-ÿ]/.test(t)) return buf.replace(/[-‐]$/, '') + t; // hyphenated word
    return `${buf} ${t}`;
  };

  lines.forEach((l, i) => {
    if (i === titleIdx) return;
    let t = l.text;
    let header = isHeader(t);
    if (header === 'meta') {
      if (state === 'steps') flushStep();
      if (state !== 'meta') beforeMeta = state;
      state = 'meta';
      metaKind = /nutri|nähr|valori/i.test(t) ? 'nutri' : /amount|serving/i.test(t) ? metaKind : 'time';
      const sv = servingsOf(t); if (sv) servings = servings || sv;
      return;
    }
    // nutrition values anywhere: not ingredients, not steps
    if (isNutritionLine(t)) { nutriBuf += ` ${t}`; return; }
    if (state === 'meta') {
      // "Preparation" here is a row of the times table, not the method heading
      if (header === 'steps' && nextHasTime(i)) header = null;
      if (!header) {
        const short = t.length <= 30 && !/[.!?]$/.test(t);
        // a table read cell by cell: "Calories" / "Fat" / … / "1092 kcal" / "78.6 g"
        if (metaKind === 'nutri' && (short || /\d\s*(?:kcal|k?j|mg|g)\b/i.test(t))) { nutriBuf += ` ${t}`; return; }
        if (durationsIn(t).length || short) { timeBuf += ` ${t}`; return; }
        // a real sentence: back to where we were
        state = beforeMeta === 'pre' ? 'notes' : beforeMeta;
      }
    }
    // a link to the author's newsletter is not part of the recipe
    if (isPromoLine(t) && (ingredients.length || steps.length || stepBuf)) return;
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
      Object.assign(times, Object.fromEntries(Object.entries(extractTimes(t)).filter(([k]) => times[k] == null)));
      return;
    }
    const bulleted = BULLET.test(t);
    t = t.replace(BULLET, '').trim();
    if (!t) return;
    // v56: before the method, "Mozzarella 150 g" is "150 g Mozzarella", and a stray mark in front ("‚Parmesan") goes
    if (state === 'pre' || state === 'ing') {
      const q = frontQty(t.replace(LEAD_JUNK, ''));
      if (state === 'ing' || (isIngredientLike(q) && !isIngredientLike(t))) t = q;
    }

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
        const h = groupHeading(t);
        if (h) { group = h; return; }
        const prev = ingredients[ingredients.length - 1];
        // Typesetting: a line wraps when its next word doesn't fit. If this short lowercase bit
        // would not have fitted after the line above, it is that line's tail ("3 1/2 tsp baking" + "powder").
        const firstWord = t.split(' ')[0];
        const wordW = l.w && t.length ? (l.w * firstWord.length) / t.length : 0;
        const ranToEdge = prev && prev.right && l.colRight && prev.right + (l.h || 20) * 0.5 + wordW > l.colRight;
        if (prev && ranToEdge && /^[a-zà-öø-ÿ]/.test(t) && parseIngredient(t).qty == null && !bulleted && !TO_TASTE.test(t) && t.split(' ').length <= 2) {
          prev.raw = appendText(prev.raw, t);
          prev.right = l.right;
          return;
        }
        // wrapped line: "1 cucchiaio di olio extravergine di" + "oliva"
        if (prev && CONTINUES.test(prev.raw.replace(/ \([^)]*\)$/, '')) && /^[a-zà-öø-ÿ(]/.test(t) && parseIngredient(t).qty == null && !bulleted && t.split(' ').length <= 4) {
          prev.raw = appendText(prev.raw, t);
          return;
        }
        ingredients.push({ raw: t, right: l.right, ...(group ? { group } : {}) });
        return;
      }
    }

    if (state === 'steps') {
      if (NUMBERED.test(t)) { flushStep(); stepNumbered = true; stepBuf = t.replace(NUMBERED, ''); return; }
      const ended = /[.!?)]$/.test(stepBuf);
      // v56: a step number the photo reader got wrong ("4." read as "@.")
      if (stepNumbered && (ended || !stepBuf) && JUNK_NUMBER.test(t)) { flushStep(); stepBuf = t.replace(JUNK_NUMBER, ''); return; }
      // v56: specks and bits of the pictures under the method ("a", "«Ten")
      if (t.replace(/[^\p{L}]/gu, '').length < 4 && !/\d/.test(t) && (ended || l.brk)) return;
      let newStep = false;
      if (stepBuf && !stepNumbered) {
        // a new paragraph starts a new step; pasted text without blank lines: one sentence-ending line = one step
        // never split a sentence in two
        newStep = ended && (l.brk || !hasHeights);
      } else if (stepBuf && hasHeights) {
        // numbered steps from a photo: a new paragraph after a full stop is the next step, its number unread
        newStep = ended && l.brk && /^\p{Lu}/u.test(t);
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
    for (const t of intro.splice(0)) { const q = frontQty(t); (isIngredientLike(q) ? ingredients.push({ raw: q }) : steps.push(t)); }
  }
  if (servings == null) servings = servingsOf(all.slice(0, 400));
  // a table of times ("Preparation | 1 h 30 m · Cooking | 10 m · Total Time | 9 h 40 m")
  for (const [k, v] of Object.entries(parseTimeTable(timeBuf))) if (times[k] == null) times[k] = v;
  // labelled times anywhere (also in the intro or the notes)
  for (const [k, v] of Object.entries(extractTimes(all.split('\n').filter((x) => !isNutritionLine(x)).join('\n')))) if (times[k] == null) times[k] = v;
  const nutrition = parseNutrition(nutriBuf);
  if (times.total != null) time = formatMinutes(times.total);
  else if (!time && (times.prep != null || times.cook != null)) time = formatMinutes((times.prep || 0) + (times.cook || 0) + (times.rest || 0));
  if (!time) { const tm = all.match(TIME); if (tm) time = tm[1].trim(); }

  const noteText = [intro.join(' '), notes.join(' ')].filter(Boolean).join('\n\n');
  return {
    title,
    servings: servings || 4,
    servingsFound: servings != null,
    time,
    ingredients: ingredients.map((x) => ({ raw: x.raw.replace(/\s+([,.;:])/g, '$1').trim(), ...(x.group ? { group: x.group } : {}) })).filter((x) => x.raw.length > 1),
    steps: steps.map((s) => s.replace(/\s+([,.;:!?])/g, '$1')),
    times,
    notes: noteText,
    ...(nutrition.kcal != null || nutrition.protein != null ? { nutrition: { ...nutrition, per: 'serving' } } : {}),
    lang: detectLang(all),
  };
}
