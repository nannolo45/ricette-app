// Finds a photo of a dish on Wikipedia (free, no key), e.g. "Tiramisù classico" → the
// Tiramisù article's main picture, with its author and licence from Wikimedia Commons.
// Works in the browser (CORS via origin=*) and in Node (GitHub Action).

const FOOD = /(piatt|dolc|dessert|torta|pasta|cibo|aliment|ricett|zupp|minestr|salsa|sugo|pane|biscott|formagg|insalat|antipast|contorno|bevand|cucina|gastronom|specialit|preparazion|food|dish|cake|bread|soup|sauce|pastry|cuisine|cookie|biscuit|salad|stew|pancake|pie|dumpling|gericht|speise|kuchen|gebäck|suppe|soße|brot|nachspeise|küche|teigware|eintopf|auflauf|spezialität|pfannkuchen|knödel|torte)/i;
const FILLER = /\b(della|dello|di|de|del|alla|al|à|la|le|il|lo|mia|mio|nonna|mamma|zia|classic[oa]?|facile|veloce|perfett[oa]|ricetta|originale|tradizionale|light|easy|best|classic|quick|homemade|my|grandma'?s?|mum'?s?|mom'?s?|einfach|schnell|omas?|nach|art|klassisch[e]?|beste[rn]?|selbstgemacht[e]?)\b/gi;
const STOP = new Set(['di', 'e', 'a', 'al', 'alla', 'con', 'in', 'la', 'il', 'and', 'with', 'the', 'of', 'mit', 'und', 'der', 'die', 'das', 'von']);

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ß ]/g, ' ').replace(/\s+/g, ' ').trim();
const words = (s) => norm(s).split(' ').filter((w) => w.length >= 3 && !STOP.has(w));
const stem = (w) => w.replace(/(e|i|a|o|s|es|en|n)$/, '');

export function searchQueries(title) {
  const full = String(title || '').replace(/[«»"“”]/g, '').trim();
  const short = full.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
  return [...new Set([short, full].filter((q) => q && q.length >= 3))];
}

// Is this Wikipedia article plausibly about this dish?
export function relevant(page, title) {
  if (!page.thumbnail || !page.pageimage || /\.(svg|gif)$/i.test(page.pageimage)) return false;
  const tw = new Set(words(title).map(stem));
  const pw = words(page.title).map(stem);
  const overlap = pw.filter((w) => tw.has(w)).length;
  if (!overlap) return false;
  const food = FOOD.test(page.description || '') || FOOD.test(page.extract || '');
  // all words of the article title appear in the recipe title ("Tiramisù" ⊂ "Tiramisù classico"), and it's food
  return food && overlap >= Math.min(pw.length, 2);
}

function api(lang, params) {
  const q = new URLSearchParams({ action: 'query', format: 'json', origin: '*', ...params });
  return `https://${lang}.wikipedia.org/w/api.php?${q}`;
}

export async function findDishImage(title, lang = 'it', { http = fetch, headers = {} } = {}) {
  const getJson = async (url) => {
    const res = await http(url, { headers: { Accept: 'application/json', ...headers } });
    if (!res.ok) throw new Error(`http_${res.status}`);
    return res.json();
  };
  for (const wiki of [...new Set([lang, 'en'])]) {
    for (const query of searchQueries(title)) {
      let data;
      try {
        data = await getJson(api(wiki, {
          generator: 'search', gsrsearch: query, gsrlimit: '5', gsrnamespace: '0', redirects: '1',
          prop: 'pageimages|description', piprop: 'thumbnail|name', pithumbsize: '1200',
        }));
      } catch { continue; }
      const pages = Object.values(data?.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
      const page = pages.find((p) => relevant(p, title));
      if (!page) continue;
      const credit = { title: page.title, creator: '', license: '', url: `https://${wiki}.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}` };
      try {
        const info = await getJson(`https://commons.wikimedia.org/w/api.php?${new URLSearchParams({
          action: 'query', format: 'json', origin: '*', titles: `File:${page.pageimage}`, prop: 'imageinfo', iiprop: 'extmetadata|url',
        })}`);
        const ii = Object.values(info?.query?.pages || {})[0]?.imageinfo?.[0];
        const strip = (v) => String(v || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        if (ii) {
          credit.creator = strip(ii.extmetadata?.Artist?.value).slice(0, 80);
          credit.license = strip(ii.extmetadata?.LicenseShortName?.value);
          credit.url = ii.descriptionurl || credit.url;
        }
      } catch { /* credit stays a link to the article */ }
      return { url: page.thumbnail.source, credit };
    }
  }
  return null;
}
