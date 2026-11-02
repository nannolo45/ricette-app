// Takes every picture of the user guide from made-up data (Everyday's guide handover, 2 Nov 2026).
// Run from tests/:
//   node ../docs/guide/screenshots.mjs it ../app/guide/it          (phone: 390×780 at 2×, PNG)
//   node ../docs/guide/screenshots.mjs it /tmp/desk/it desk         (computer: 1440×900 at 1×, PNG → WebP in build.py)
// Languages: it, en, de. The clock is fixed at Monday 2 November 2026, 08:30, Europe/Rome.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(resolve(process.cwd(), 'x.js'))('playwright');
const [lang = 'it', outArg = `../app/guide/${lang}`, mode = ''] = process.argv.slice(2);
const DESK = mode === 'desk';
const OUT = resolve(outArg);
mkdirSync(OUT, { recursive: true });
const APP = resolve(dirname(fileURLToPath(import.meta.url)), '../../app');
const PORT = 8770 + ['it', 'en', 'de'].indexOf(lang) + (DESK ? 3 : 0);
const BASE = `http://localhost:${PORT}/`;
const L = (it, en, de) => ({ it, en, de })[lang];

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', APP], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

// A fake GitHub repository in memory, so the app shows itself connected and synced.
const repo = new Map();
const sha = (buf) => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
async function fakeGithub(ctx) {
  await ctx.route('https://api.github.com/**', async (route) => {
    const req = route.request(); const url = new URL(req.url());
    const m = url.pathname.match(/^\/repos\/[^/]+\/[^/]+(?:\/contents\/(.+))?$/);
    if (!m) return route.fulfill({ status: 404, body: '{}' });
    const path = m[1];
    if (!path) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ private: true, permissions: { push: true } }) });
    if (req.method() === 'GET') {
      const f = repo.get(path);
      if (f) {
        if ((req.headers().accept || '').includes('raw')) return route.fulfill({ status: 200, contentType: 'application/octet-stream', body: f.bytes });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'file', path, sha: f.sha, size: f.bytes.length, content: f.bytes.toString('base64') }) });
      }
      const kids = [...repo.entries()].filter(([p]) => p.startsWith(path + '/') && !p.slice(path.length + 1).includes('/'));
      if (!kids.length) return route.fulfill({ status: 404, body: '{}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(kids.map(([p, v]) => ({ type: 'file', path: p, name: p.split('/').pop(), sha: v.sha, size: v.bytes.length }))) });
    }
    if (req.method() === 'PUT') {
      const body = JSON.parse(req.postData());
      const bytes = Buffer.from(body.content, 'base64');
      repo.set(path, { sha: sha(bytes), bytes });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { path, sha: repo.get(path).sha } }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

// ---- sample data, in the guide's language ----
const seed = (pg) => pg.evaluate(async ({ lang }) => {
  const m = await import('./js/store.js');
  const L = (it, en, de) => ({ it, en, de })[lang];
  const day = 864e5; const now = Date.now();
  const iso = (n) => new Date(now + n * day).toLocaleDateString('sv-SE');
  m.upsert('folders', { id: 'f1', name: L('Cene veloci', 'Quick dinners', 'Schnelle Abendessen') });
  m.upsert('folders', { id: 'f2', name: L('Dolci', 'Baking', 'Kuchen') });
  const R = (id, title, stage, mins, ings, extra = {}) => m.upsert('recipes', { id, title, servings: 4, stage, parsed: true, createdAt: now - mins * 60000, time: `${mins} min`,
    ingredients: ings.map(([q, u, n]) => ({ raw: `${q ?? ''} ${u} ${n}`.trim(), qty: q, unit: u, name: n })), steps: L(['Scalda l\'olio con l\'aglio.', 'Aggiungi il resto e cuoci.', 'Servi caldo.'], ['Warm the oil with the garlic.', 'Add the rest and cook.', 'Serve hot.'], ['Öl mit Knoblauch erhitzen.', 'Den Rest dazugeben und kochen.', 'Heiß servieren.']), ...extra });
  R('r1', L('Pasta e ceci', 'Pasta e ceci', 'Pasta e ceci'), 'fav', 30, [[320, 'g', 'ditalini'], [400, 'g', L('ceci', 'chickpeas', 'Kichererbsen')], [1, '', L('aglio', 'garlic', 'Knoblauch')], [1, '', L('rosmarino', 'rosemary', 'Rosmarin')], [2, 'tbsp', L('olio d\'oliva', 'olive oil', 'Olivenöl')]], { cookedCount: 6, cuisine: 'italian', folder: 'f1', source: { book: L('Il cucchiaio d\'argento', 'Jamie\'s 30-Minute Meals', 'Das Kochbuch'), page: 112 } });
  R('r2', L('Zuppa di lenticchie rosse', 'Red lentil soup', 'Rote Linsensuppe'), 'try', 40, [[250, 'g', L('lenticchie rosse', 'red lentils', 'rote Linsen')], [1, '', L('cipolla', 'onion', 'Zwiebel')], [1, '', L('carota', 'carrot', 'Karotte')], [1, '', L('limone', 'lemon', 'Zitrone')]], { url: 'https://www.example.com/red-lentil-soup' });
  R('r3', 'Spanakopita', 'fav', 55, [[500, 'g', L('spinaci', 'spinach', 'Spinat')], [200, 'g', 'feta'], [1, '', L('pasta fillo', 'filo pastry', 'Filoteig')], [2, '', L('uova', 'eggs', 'Eier')]], { cookedCount: 4, cuisine: 'greek' });
  R('r4', L('Insalata greca', 'Greek salad', 'Griechischer Salat'), 'tried', 15, [[3, '', L('pomodori', 'tomatoes', 'Tomaten')], [1, '', L('cetriolo', 'cucumber', 'Gurke')], [200, 'g', 'feta']], { cuisine: 'greek', cookedCount: 1 });
  R('r5', 'Gazpacho', 'try', 20, [[1, 'kg', L('pomodori', 'tomatoes', 'Tomaten')], [1, '', L('peperone', 'pepper', 'Paprika')], [1, '', L('cetriolo', 'cucumber', 'Gurke')]], { cuisine: 'spanish' });
  R('r6', L('Risotto zucca e salsiccia', 'Pumpkin and sausage risotto', 'Kürbis-Risotto mit Salsiccia'), 'fav', 45, [[320, 'g', L('riso carnaroli', 'carnaroli rice', 'Carnaroli-Reis')], [500, 'g', L('zucca', 'pumpkin', 'Kürbis')], [250, 'g', L('salsiccia', 'sausage', 'Salsiccia')], [50, 'g', 'parmigiano']], { cookedCount: 3, folder: 'f1' });
  R('r7', L('Torta di mele della nonna', 'Granny\'s apple cake', 'Omas Apfelkuchen'), 'fav', 70, [[3, '', L('mele', 'apples', 'Äpfel')], [200, 'g', L('farina 00', 'plain flour', 'Mehl')], [3, '', L('uova', 'eggs', 'Eier')], [150, 'g', L('zucchero', 'sugar', 'Zucker')], [1, '', L('scorza di yuzu', 'yuzu zest', 'Yuzu-Schale')]], { folder: 'f2', cookedCount: 2 });
  R('r8', L('Pollo al limone', 'Lemon chicken', 'Zitronenhähnchen'), 'try', 35, [[4, '', L('cosce di pollo', 'chicken thighs', 'Hähnchenschenkel')], [2, '', L('limoni', 'lemons', 'Zitronen')], [1, '', L('aglio', 'garlic', 'Knoblauch')]], { url: 'https://www.example.com/lemon-chicken' });
  const P = (id, name, qty, unit, extra = {}) => m.upsert('pantry', { id, name, qty, unit, min: null, target: null, addedAt: now, ...extra });
  P('p1', 'ditalini', 500, 'g', { shops: ['s2'] }); P('p2', L('ceci', 'chickpeas', 'Kichererbsen'), 2, ''); P('p3', L('aglio', 'garlic', 'Knoblauch'), 3, '');
  P('p4', 'feta', 200, 'g', { expires: iso(2) }); P('p5', L('uova', 'eggs', 'Eier'), 4, '', { expires: iso(9) }); P('p6', L('latte', 'milk', 'Milch'), 1, 'l', { min: 1, target: 2, expires: iso(5) });
  P('p7', L('riso carnaroli', 'carnaroli rice', 'Carnaroli-Reis'), 0, 'g', { min: 200, target: 1000 }); P('p8', L('yogurt greco', 'greek yoghurt', 'griechischer Joghurt'), 2, '', { expires: iso(-1) });
  P('p9', L('pomodori pelati', 'tinned tomatoes', 'Dosentomaten'), 3, ''); P('p10', L('spinaci', 'spinach', 'Spinat'), 1, '', { expires: iso(1) });
  P('p11', 'parmigiano', 300, 'g', { min: 100, target: 400, expires: iso(20), shops: ['s2'], place: 'fridge' });
  P('p12', L('detersivo piatti', 'washing-up liquid', 'Spülmittel'), 1, ''); // v53: shows Casa e pulizia
  P('p13', L('pannolini', 'nappies', 'Windeln'), 2, '', { food: 'nappies' }); // v54: shows Bambino
  m.upsert('pantry', { id: 'salt', name: L('sale', 'salt', 'Salz'), track: 'level', level: 'ok', food: 'salt' });
  m.upsert('pantry', { id: 'oil', name: L('olio d\'oliva', 'olive oil', 'Olivenöl'), track: 'level', level: 'low', food: 'olive-oil' });
  m.upsert('pantry', { id: 'pepper', name: L('pepe nero', 'black pepper', 'schwarzer Pfeffer'), track: 'level', level: 'ok' });
  m.upsert('prefs', { id: 'staplesAsked', value: true });
  m.upsert('shops', { id: 's1', name: L('Mercato di Sant\'Ambrogio', 'Covered Market', 'Wochenmarkt'), hours: [] });
  m.upsert('shops', { id: 's2', name: 'Lidl', hours: [] });
  m.upsert('shops', { id: 's3', name: L('Esselunga', 'Tesco', 'Rewe'), hours: [] });
  const S = (name, qty, unit, extra = {}) => m.upsert('shopping', { id: m.uid(), name, qty, unit, checked: false, sources: [], addedAt: now, ...extra });
  S(L('finocchi', 'fennel', 'Fenchel'), 2, '', { shops: ['s1'] }); S(L('limoni', 'lemons', 'Zitronen'), 3, '', { shops: ['s1'] });
  S(L('zucca', 'pumpkin', 'Kürbis'), 500, 'g', { sources: [L('Risotto zucca e salsiccia', 'Pumpkin and sausage risotto', 'Kürbis-Risotto mit Salsiccia')] });
  S(L('salsiccia', 'sausage', 'Salsiccia'), 250, 'g', { sources: [L('Risotto zucca e salsiccia', 'Pumpkin and sausage risotto', 'Kürbis-Risotto mit Salsiccia')], shops: ['s3'] });
  S('parmigiano', 100, 'g', { shops: ['s2'], note: L('stagionato 24 mesi', 'aged 24 months', '24 Monate gereift') });
  S(L('detersivo piatti', 'washing-up liquid', 'Spülmittel'), null, '', { shops: ['s2', 's3'] });
  S(L('carta igienica', 'toilet paper', 'Toilettenpapier'), null, '');
  S(L('pane', 'bread', 'Brot'), 1, '', { checked: true }); S(L('mozzarella', 'mozzarella', 'Mozzarella'), 2, '', { checked: true });
}, { lang });

const LOCALE = L('it-IT', 'en-GB', 'de-DE');
const browser = await chromium.launch({ args: [`--lang=${LOCALE}`], env: { ...process.env, LANG: `${LOCALE.replace('-', '_')}.UTF-8`, LANGUAGE: LOCALE.replace('-', '_') } });
const errors = [];
const ctx = await browser.newContext({
  viewport: DESK ? { width: 1440, height: 900 } : { width: 390, height: 780 },
  deviceScaleFactor: DESK ? 1 : 2, colorScheme: 'dark', locale: LOCALE, timezoneId: 'Europe/Rome', permissions: ['notifications'],
});
await ctx.clock.setFixedTime(new Date('2026-11-02T08:30:00+01:00'));
// headless Chromium answers 'denied'; show the screen a new user sees (notifications not asked yet)
await ctx.addInitScript(() => { try { Object.defineProperty(Notification, 'permission', { get: () => 'default' }); } catch (e) { /* no Notification */ } });
await fakeGithub(ctx);
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(e.message));
const wait = (ms = 350) => p.waitForTimeout(ms);
const shot = async (name) => { await wait(250); await p.evaluate(() => document.getElementById('toast')?.classList.remove('show')); await wait(150); await p.screenshot({ path: `${OUT}/${name}.png` }); console.log(name); };
const go = async (hash) => { await p.goto(BASE + hash); await wait(450); };
const closeSheet = async () => { if (await p.$('dialog[open]')) { await p.keyboard.press('Escape'); await wait(250); } };

await p.goto(BASE); await p.waitForSelector('#search');

await seed(p);

// ---- 1. First setup ----
await go('#/settings/sync');
await p.fill('input[name=owner]', 'anna-rossi').catch(() => {});
await p.fill('input[name=repo]', 'ricette-data').catch(() => {});
await p.fill('input[name=token]', 'github_pat_11ABC…').catch(() => {});
await shot('01-sync-form');
await p.fill('input[name=token]', 'github_pat_11ABCDEFGHIJKLMNOPQRSTUVWXYZ');
await p.click('#gh-form .btn.primary');
await p.waitForSelector('.gh-card', { timeout: 15000 }).catch(() => {});
await wait(1500);
await go('#/settings/sync');
await shot('02-sync-connected');
await go('#/settings');
await shot('03-settings');
await go('#/settings/pantry/remind');
await shot('04-settings-pantry');

// ---- 2. Recipes ----
await go('#/recipes');
await p.click('[data-action=seg][data-value=all]').catch(() => {}); await wait();
await shot('10-recipes');
await p.click('[data-action=seg][data-value=fav]'); await wait();
await shot('11-favourites');
await p.click('[data-action=seg][data-value=all]'); await wait();
if (!DESK) { await p.click('.f-toggle'); await wait(); }
await p.click('[data-action=f-sec][data-value=course]').catch(() => {}); await wait();
await shot('12-filters');
await p.click('[data-action=f-sec][data-value=course]').catch(() => {});
await p.click('.fp-quick [data-action=pantry-toggle]').catch(() => {}); await wait(500);
if (!DESK) { await p.click('.f-toggle').catch(() => {}); await wait(); }
await shot('13-with-pantry');
await p.click('[data-action=pantry-toggle]').catch(() => {}); await wait();
await go('#/recipe/r3');
await shot('14-recipe');
await go('#/recipe/r2');
await p.click('[data-action=cooked]'); await wait(400);
await p.click('dialog[open] .btn.primary, dialog[open] button[value=ok]').catch(() => {}); await wait(500);
await shot('15-how-was-it');
await closeSheet();

// ---- 3. Adding recipes ----
await go('#/recipes');
if (DESK) await p.click('.ctx-add'); else await p.click('.fab');
await p.waitForSelector('#import-form'); await wait();
await p.fill('#import-form input[type=url]', 'https://www.example.com/lemon-chicken').catch(() => {});
await shot('20-add-link');
await p.click('[data-action=add-tab][data-value=photo]'); await wait();
await p.click('[data-action=photo-import]'); await p.waitForSelector('form.capture.guided'); await wait();
await shot('21-add-photo');
await closeSheet();
await go('#/recipes');
// on a computer the add panel stays open on the right
if (!DESK) await p.click('.fab'); else if (await p.$('.ctx-add')) await p.click('.ctx-add');
await p.waitForSelector('[data-action=add-tab][data-value=book]'); await wait();
await p.click('[data-action=add-tab][data-value=book]'); await wait();
await shot('22-add-book');
await p.click('[data-action=add-tab][data-value=new]'); await wait();
await p.click('[data-action=new-recipe]'); await p.waitForSelector('#edit-form');
await p.fill('input[name=title]', L('Torta salata di zucchine', 'Courgette tart', 'Zucchini-Tarte')); await wait();
await shot('23-new-recipe');
await p.click('[data-action=edit-cancel]'); await wait(300);
if (await p.$('dialog[open]')) { await p.click('dialog[open] button[value=ok], dialog[open] .btn.primary').catch(() => {}); await wait(300); }
await go('#/edit/r7');
await p.click('#edit-form .ing-row >> nth=0').catch(() => {}); await wait(300); await closeSheet();
await p.evaluate(() => document.querySelector('.ing-row')?.scrollIntoView({ block: 'start' })); await p.evaluate(() => window.scrollBy(0, -90));
await shot('24-edit');
await p.click('.ing-row >> nth=4').catch(() => {}); await wait(400);
await shot('25-ingredient');
await closeSheet();
await go('#/settings/foods');
await shot('26-foods');

// ---- 4. Shopping ----
await go('#/list');
await shot('30-list');
if (!DESK) { await p.click('.fab'); await p.waitForSelector('dialog[open] #add-item-input'); }
await p.fill('#add-item-input', L('2 l latte, uova, 1,5 kg farina', '2 l milk, eggs, 1.5 kg flour', '2 l Milch, Eier, 1,5 kg Mehl'));
await p.press('#add-item-input', 'Enter'); await wait(400);
await shot('31-list-add');
await closeSheet();
if (!DESK) { await p.click('.f-toggle'); await wait(); }
await p.click('[data-action=lv-open]'); await wait();
await shot('32-list-views');
await p.click('[data-action=lv-open]'); await wait(150);
if (!DESK) { await p.click('.f-toggle'); await wait(); }
await p.click('.sl-main:has-text("parmigiano")'); await wait(400);
await shot('33-list-item');
await closeSheet();
if (!DESK) { await p.click('[data-action=sl-cart-toggle]').catch(() => {}); await wait(); await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); }
await shot('34-cart');
if (DESK) await p.click('.ctx [data-action=put-away], .ctx [data-action=sl-cart-main]').catch(() => {});
else await p.click('[data-action=sl-cart-main]').catch(() => {});
await wait(500);
await shot('35-put-away');
await go('#/list');
await p.evaluate(async () => {
  const m = await import('./js/store.js');
  const iso = (n) => new Date(Date.now() + n * 864e5).toLocaleDateString('sv-SE');
  m.upsert('prefs', { id: 'trips', value: [{ id: 't1', date: iso(1), start: 600, minutes: 45, shops: ['s1', 's2'] }, { id: 't2', date: iso(3), start: 1080, minutes: 30, shops: ['s3'] }] });
});
await go('#/list');
await shot('36-trips');

// ---- 5. Pantry ----
await go('#/pantry');
await shot('40-pantry');
if (!DESK) { await p.click('.fab'); await p.waitForSelector('dialog[open] #add-pantry-input').catch(() => {}); }
await p.fill('#add-pantry-input', L('6 uova scade 20/11, 1 kg farina', '6 eggs exp 20/11, 1 kg flour', '6 Eier bis 20.11., 1 kg Mehl')).catch(() => {});
await p.press('#add-pantry-input', 'Enter').catch(() => {}); await wait(400);
await shot('41-pantry-add');
await closeSheet();
await p.click('[data-action=p-edit][data-id=p11]'); await wait(400);
await shot('42-pantry-product');
await closeSheet();
await p.click('[data-action=p-edit][data-id=oil]'); await wait(400);
await shot('43-staple');
await closeSheet();
if (!DESK) { await p.click('.f-toggle'); await wait(); }
await p.click('[data-action=p-filter][data-value=expiring]').catch(() => {}); await wait();
await shot('44-pantry-filters');
await p.click('[data-action=p-filter][data-value=expiring]').catch(() => {});
if (!DESK) { await p.click('.f-toggle').catch(() => {}); await wait(); }
await p.click('[data-action=p-place][data-value=fridge]'); await wait();
await shot('45-pantry-fridge');
await p.click('[data-action=p-place][data-value=all]'); await wait();
await p.click('[data-action=places-edit]'); await wait(300);
await shot('46-pantry-places'); // v54: the ✎ Posti editor
await closeSheet();

// ---- 6. On a computer: wide pictures in the phone guide (the computer set doesn't need them) ----
if (!DESK) {
  const wctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark', locale: L('it-IT', 'en-GB', 'de-DE'), timezoneId: 'Europe/Rome' });
  await wctx.clock.setFixedTime(new Date('2026-11-02T08:30:00+01:00'));
  await fakeGithub(wctx);
  const w = await wctx.newPage();
  w.on('pageerror', (e) => errors.push(e.message));
  await w.goto(BASE); await w.waitForSelector('#search'); await seed(w);
  await w.evaluate(async () => { const m = await import('./js/store.js'); await m.saveSettings({ owner: 'anna-rossi', repo: 'ricette-data', token: 'github_pat_x', branch: 'main', verified: true }); });
  const wshot = async (name) => { await w.waitForTimeout(500); await w.screenshot({ path: `${OUT}/${name}.png` }); console.log(name); };
  await w.goto(BASE + '#/recipes'); await w.waitForTimeout(600);
  await w.click('[data-action=seg][data-value=all]').catch(() => {}); await w.waitForTimeout(300);
  await w.click('.mid .rrow:has-text("Spanakopita")').catch(() => {});
  await wshot('60-wide-recipes');
  await w.goto(BASE + '#/list'); await wshot('61-wide-list');
  await w.goto(BASE + '#/pantry'); await wshot('62-wide-pantry');
  await wctx.close();
}

console.log('errors', JSON.stringify(errors));
await browser.close(); server.kill();
