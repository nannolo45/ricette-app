// Automatic tags, cooking time in minutes, and "what can I cook with my pantry?".
import { parseIngredient, namesMatch, convert, normalizeName } from './parse.js';

const words = (list) => new RegExp(`(?:^|[^a-zà-öø-ÿ])(?:${list.join('|')})`, 'i');

const MEAT = words(['manzo', 'maiale', 'vitell', 'pollo', 'tacchin', 'agnell', 'salsicc', 'pancetta', 'prosciutt', 'guanciale', 'speck', 'salam', 'carne', 'macinat[ao] di', 'mortadella', 'bresaola', 'lardo', 'cotechino', 'coniglio', 'anatra', 'ragù di carne',
  'rinder', 'rindfleisch', 'schwein', 'kalb', 'huhn', 'hähnchen', 'hühner', 'pute', 'lamm', 'wurst', 'speck', 'schinken', 'hackfleisch', 'fleisch', 'würstchen', 'ente',
  'beef', 'pork', 'veal', 'chicken', 'turkey', 'lamb', 'sausage', 'bacon', 'ham', 'mince', 'meat', 'duck', 'chorizo', 'pepperoni']);
const FISH = words(['pesce', 'tonno', 'salmone', 'merluzzo', 'baccalà', 'acciugh', 'alici', 'gamber', 'cozze', 'vongole', 'calamar', 'polpo', 'seppi', 'branzino', 'orata', 'sgombr', 'scamp', 'frutti di mare', 'bottarga',
  'fisch', 'thunfisch', 'lachs', 'kabeljau', 'sardell', 'garnele', 'muschel', 'tintenfisch', 'forelle', 'hering',
  'fish', 'tuna', 'salmon', 'cod', 'anchov', 'shrimp', 'prawn', 'mussel', 'clam', 'squid', 'octopus', 'seafood', 'trout']);
const ANIMAL = words(['uov[ao]', 'tuorl', 'album', 'latte(?! di (?:cocco|soia|mandorl|riso|avena))', 'burro(?! di arachidi)', 'panna', 'formagg', 'parmigian', 'grana', 'pecorino', 'mozzarell', 'ricotta', 'mascarpone', 'yogurt', 'miele', 'gelatina', 'stracchino', 'gorgonzola', 'fontina', 'besciamella',
  'ei(?:er)?(?![a-z])', 'eigelb', 'eiweiß', 'milch(?!\\s*\\(?(?:hafer|soja|mandel))', 'butter(?!milch)', 'sahne', 'käse', 'quark', 'joghurt', 'honig', 'schmand', 'crème fraîche', 'mascarpone',
  'eggs?(?![a-z])', 'yolk', 'milk(?! \\(?(?:oat|soy|almond|coconut))', 'butter(?!nut)', 'cream(?! of tartar)', 'cheese', 'parmesan', 'yogurt', 'honey', 'gelatin']);
const PASTA = words(['spaghett', 'penne', 'rigaton', 'fusill', 'tagliatell', 'lasagn', 'linguine', 'farfalle', 'orecchiette', 'pasta(?! (?:frolla|sfoglia|brisé|matta|madre|di (?:mandorl|pistacch|nocciol)))', 'maccheron', 'bucatin', 'paccheri', 'tortellin', 'ravioli', 'fettuccine', 'pappardelle', 'tagliolin', 'ditalin', 'gnocchi', 'trofie', 'mezze maniche',
  'nudeln', 'spätzle', 'maultaschen', 'noodle', 'macaroni']);
const RICE = words(['riso(?! soffiato)', 'risotto', 'reis', 'rice', 'arborio', 'carnaroli']);
const SWEET_TITLE = words(['torta(?! salata)', 'crostata', 'biscott', 'tiramis', 'dolce', 'budino', 'gelato', 'mousse', 'muffin', 'cake', 'kuchen', 'torte', 'keks', 'plätzchen', 'dessert', 'pudding', 'cookie', 'brownie', 'strudel', 'panna cotta', 'semifreddo', 'crêpe', 'pancake', 'pfannkuchen', 'cheesecake', 'ciambell', 'cantucci', 'meringh', 'zabaione', 'sorbett', 'waffel', 'krapfen', 'zuccotto', 'cannoli', 'babà', 'sfogliatell']);
const SWEET_ING = words(['zucchero', 'zucker', 'sugar', 'cioccolat', 'schokolade', 'chocolate', 'cacao', 'kakao', 'cocoa', 'zucchero a velo', 'puderzucker', 'icing sugar', 'vaniglia', 'vanille', 'vanilla']);
const SAVORY = words(['cipoll', 'aglio', 'zwiebel', 'knoblauch', 'onion', 'garlic', 'pepe', 'pfeffer', 'pepper(?!mint)', 'brodo', 'brühe', 'stock', 'broth']);
const SOUP_TITLE = words(['zupp', 'minestr', 'vellutat', 'brodo', 'passato di', 'suppe', 'eintopf', 'brühe', 'soup', 'stew', 'chowder', 'gazpacho']);
const SALAD_TITLE = words(['insalat', 'salat(?!e)', 'salad']);
const OVEN = words(['forno', 'inforn', 'gratin', 'backofen', 'ofen', 'backen', 'überbacken', 'oven', 'bake', 'roast']);

export const AUTO_TAGS = ['veg', 'vegan', 'meat', 'fish', 'dessert', 'pasta', 'rice', 'soup', 'salad', 'quick', 'oven'];

// "30 min + 4 ore di riposo" → 270, "1 h 15 min" → 75, "45 Minuten" → 45, "20-30 min" → 30
export function minutesOf(time) {
  const s = String(time || '').toLowerCase().replace(',', '.');
  if (!s) return null;
  let total = 0;
  let found = false;
  const re = /(\d+(?:\.\d+)?)(?:\s*[-–]\s*(\d+(?:\.\d+)?))?\s*(ore|ora|stunden|stunde|std\.?|hours?|hrs?|h|minuti|minuten|minutes|mins?|min|')(?![a-z])/g;
  let m;
  while ((m = re.exec(s))) {
    const n = parseFloat(m[2] || m[1]);
    total += /^(ore|ora|stund|std|hour|hr|h)/.test(m[3]) ? n * 60 : n;
    found = true;
  }
  return found ? Math.round(total) : null;
}

function ingredientNames(r) {
  return (r.ingredients || []).map((i) => (i.name != null ? `${i.name} ${i.note || ''}` : parseIngredient(i.raw || '').name)).join(' \n ');
}

export function autoTags(r) {
  const ing = ingredientNames(r).toLowerCase();
  const title = String(r.title || '').toLowerCase();
  const steps = (r.steps || []).join(' ').toLowerCase();
  const tags = new Set();
  if (!ing.trim()) return [];
  const meat = MEAT.test(ing) || MEAT.test(title);
  const fish = FISH.test(ing) || FISH.test(title);
  if (meat) tags.add('meat');
  if (fish) tags.add('fish');
  if (!meat && !fish) { tags.add('veg'); if (!ANIMAL.test(ing)) tags.add('vegan'); }
  const sweet = SWEET_TITLE.test(title) || (SWEET_ING.test(ing) && !SAVORY.test(ing) && !meat && !fish);
  if (sweet) tags.add('dessert');
  if (!sweet && (PASTA.test(ing) || PASTA.test(title))) tags.add('pasta');
  if (!sweet && (RICE.test(ing) || RICE.test(title))) tags.add('rice');
  if (SOUP_TITLE.test(title)) tags.add('soup');
  if (SALAD_TITLE.test(title)) tags.add('salad');
  const min = minutesOf(r.time);
  if (min != null && min <= 30) tags.add('quick');
  if (OVEN.test(steps) || OVEN.test(title)) tags.add('oven');
  return AUTO_TAGS.filter((t) => tags.has(t));
}

// Manual tags plus automatic ones the user hasn't hidden. Auto tags are returned as "auto:veg".
export function tagsOf(r) {
  const hidden = new Set(r.hiddenTags || []);
  const auto = autoTags(r).filter((t) => !hidden.has(t)).map((t) => `auto:${t}`);
  const manual = (r.tags || []).filter(Boolean);
  return [...auto, ...manual.filter((t) => !auto.includes(t))];
}

// ---------- what can I cook? ----------

const BASICS = /^(?:sale|sale fino|sale grosso|pepe|pepe nero|acqua|olio|olio (?:extra ?vergine|evo|d'oliva|di oliva|di semi)(?: d'oliva)?|salz|pfeffer|wasser|öl|olivenöl|salt|pepper|black pepper|water|oil|olive oil|ghiaccio|eis|ice)$/i;
const TO_TASTE = /\b(?:q\.?\s?b\.?|quanto basta|to taste|nach belieben|nach geschmack|a piacere|etwas)\b/i;

export function isBasic(name) { return BASICS.test(normalizeName(name).replace(/\s+/g, ' ')); }

function findPantryItem(name, pantry) {
  const n = normalizeName(name);
  return pantry.find((p) => normalizeName(p.name) === n) || pantry.find((p) => namesMatch(p.name, name));
}

/**
 * For one recipe: which ingredients are at home, which are missing (or not enough).
 * opts.basics: salt, pepper, oil, water count as always available.
 * opts.expiringIds: pantry ids that expire soon (bonus for using them up).
 */
export function pantryCoverage(r, pantry, { servings, basics = true, expiringIds = new Set() } = {}) {
  const base = r.servings || 4;
  const n = servings || base;
  const have = [];
  const missing = [];
  const optional = [];
  const uses = [];
  for (const raw of r.ingredients || []) {
    const ing = raw.name != null ? raw : parseIngredient(raw.raw || '');
    if (!ing.name) continue;
    const need = ing.qty == null ? null : (ing.qty * n) / base;
    const p = findPantryItem(ing.name, pantry);
    const stock = p ? (Number(p.qty) || 0) : 0;
    const usable = p && stock > 0;
    if (usable) {
      const avail = need == null ? null : convert(stock, p.unit || '', ing.unit || '');
      if (need == null || avail == null || avail + 1e-9 >= need) {
        have.push(ing.name);
        if (expiringIds.has(p.id)) uses.push(p);
        continue;
      }
      // some, not enough
      if (expiringIds.has(p.id)) uses.push(p);
      missing.push({ name: ing.name, unit: ing.unit, need, short: need - avail, have: avail });
      continue;
    }
    if ((basics && isBasic(ing.name)) || (ing.qty == null && TO_TASTE.test(`${ing.raw || ''} ${ing.note || ''}`))) { optional.push(ing.name); continue; }
    missing.push({ name: ing.name, unit: ing.unit, need, short: need, have: 0 });
  }
  const counted = have.length + missing.length;
  return { have, missing, optional, uses, ratio: counted ? have.length / counted : 0, total: counted };
}

export function rankByPantry(recipes, pantry, opts = {}) {
  return recipes
    .map((r) => ({ r, c: pantryCoverage(r, pantry, opts) }))
    .filter((x) => x.c.total > 0)
    .sort((a, b) => a.c.missing.length - b.c.missing.length
      || b.c.uses.length - a.c.uses.length
      || b.c.ratio - a.c.ratio
      || (b.r.cookedCount || 0) - (a.r.cookedCount || 0)
      || String(a.r.title).localeCompare(String(b.r.title)));
}
