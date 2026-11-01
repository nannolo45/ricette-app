// Builds app/js/foods.js from tools/foods/src-*.txt + the old nutrition values, then checks
// that every name the old tables knew still resolves. Run: node tools/foods/build.mjs [--report]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const js = (f) => path.join(root, 'app/js', f);
const simple = (s) => String(s || '').toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/\(.*?\)/g, ' ').replace(/['’`-]/g, ' ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const DEPTS = ['produce', 'bakery', 'meatfish', 'dairy', 'grains', 'staples', 'condiments', 'sweets', 'drinks', 'frozen', 'household', 'care', 'other'];
const errors = []; const notes = [];

// old nutrition table (frozen copy kept for the build: tools/foods/nutrition-v38.js)
const nutSrcFile = fs.existsSync(path.join(here, 'nutrition-v38.js')) ? path.join(here, 'nutrition-v38.js') : js('nutrition.js');
const nsrc = fs.readFileSync(nutSrcFile, 'utf8');
const start = nsrc.indexOf('const FOODS = [');
const body = nsrc.slice(start, nsrc.indexOf('\n];', start) + 3);
const HERB = { piece: 1, dens: 0.3 }; const SPICE = { piece: 1, dens: 0.5 }; // eslint-disable-line no-unused-vars
const NUT = eval(body.replace('const FOODS =', '(').replace(/\];\s*$/, '])')); // eslint-disable-line no-eval
const nutByKey = new Map(NUT.map(([keys, kcal, prot, extra = {}]) => [simple(keys.split('|')[0]), { keys: keys.split('|'), kcal, prot, extra }]));

// sources
const recs = [];
for (const f of fs.readdirSync(here).filter((x) => /^src-.*\.txt$/.test(x)).sort()) {
  fs.readFileSync(path.join(here, f), 'utf8').split('\n').forEach((line, n) => {
    if (!line.trim() || line.startsWith('#')) return;
    const p = line.split('|');
    const [id, dept, it, de, en, alt = '', nut = '', extra = ''] = p;
    const where = `${f}:${n + 1}`;
    if (p.length < 5) { errors.push(`${where}: too few fields`); return; }
    if (!/^[a-z0-9-]+$/.test(id)) errors.push(`${where}: bad id ${id}`);
    if (!DEPTS.includes(dept)) errors.push(`${where}: bad dept ${dept}`);
    const r = { id, dept, it, de, en, alt: alt ? alt.split(';').map((x) => x.trim()).filter(Boolean) : [], where };
    if (nut) {
      const v = nutByKey.get(simple(nut));
      if (!v) errors.push(`${where}: no nutrition entry "${nut}"`);
      else Object.assign(r, { kcal: v.kcal, prot: v.prot, w: v.extra, nut: simple(nut) });
    } else if (!['household', 'care'].includes(dept)) notes.push(`${where}: ${id} has no nutrition`);
    for (const tok of extra.split(/\s+/).filter(Boolean)) {
      if (tok === 'basic') r.basic = true;
      else if (tok.startsWith('of:')) r.of = tok.slice(3);
      else if (/^[a-z]+:[\d.]+$/.test(tok)) { const [k, v] = tok.split(':'); r.w = { ...(r.w || {}), [k]: Number(v) }; }
      else errors.push(`${where}: unknown extra ${tok}`);
    }
    recs.push(r);
  });
}
const ids = new Map();
for (const r of recs) { if (ids.has(r.id)) errors.push(`${r.where}: duplicate id ${r.id} (also ${ids.get(r.id).where})`); ids.set(r.id, r); }
for (const r of recs) if (r.of && !ids.has(r.of)) errors.push(`${r.where}: of:${r.of} unknown`);
// name collisions
const owner = new Map();
for (const r of recs) {
  for (const n of [r.it, r.de, r.en, ...r.alt]) {
    const k = simple(n);
    if (!k) continue;
    const o = owner.get(k);
    if (o && o !== r.id) errors.push(`name "${n}" is in ${o} and ${r.id}`);
    else owner.set(k, r.id);
  }
}

// emit
const clean = (s) => String(s).replace(/[|;`\n]/g, ' ').trim();
const lines = recs.map((r) => {
  const w = Object.entries(r.w || {}).filter(([k]) => ['piece', 'dens', 'pack', 'can', 'slice', 'bunch'].includes(k)).map(([k, v]) => `${k}=${v}`).join(' ');
  const alt = [...new Set(r.alt.map(clean))].filter((a) => ![r.it, r.de, r.en].map(simple).includes(simple(a))).join(';');
  return [r.id, r.dept, clean(r.it), clean(r.de), clean(r.en), alt, r.kcal ?? '', r.prot ?? '', w, r.of || '', r.basic ? 'b' : ''].join('|').replace(/\|+$/, '');
});
const gone = fs.existsSync(path.join(here, 'gone.txt')) ? fs.readFileSync(path.join(here, 'gone.txt'), 'utf8').split('\n').filter((l) => /^[a-z0-9-]+\|>[a-z0-9-]+$/.test(l)) : [];
const tpl = fs.readFileSync(path.join(here, 'foods.template.js'), 'utf8');
const out = tpl.replace('/*DATA*/', [...lines, ...gone].join('\n'));
if (errors.length) { console.log(`ERRORS (${errors.length}):\n${errors.join('\n')}`); process.exit(1); }
fs.writeFileSync(js('foods.js'), out);
// the data repo's importer translates titles with it (only in Ricette's workspace, where scripts/ sits next to app/)
if (fs.existsSync(path.join(root, 'scripts/lib'))) fs.writeFileSync(path.join(root, 'scripts/lib/foods.js'), out);
console.log(`foods.js: ${recs.length} foods, ${Buffer.byteLength(out)} bytes`);

// ---- checks against the old tables ----
const F = await import(`${pathToFileURL(js('foods.js')).href}?t=${Date.now()}`);
const report = process.argv.includes('--report');
const miss = []; const nutDiff = []; const rowSplit = [];
// every nutrition keyword resolves, to a food with the same nutrition entry
for (const [key, v] of nutByKey) {
  for (const k of v.keys) {
    const id = F.foodOf(k);
    if (!id) { miss.push(`nutrition "${k}"`); continue; }
    const r = ids.get(id);
    if (r && r.nut !== key) nutDiff.push(`"${k}" (entry ${key}) → ${id} (entry ${r.nut || 'none'})`);
  }
}
// every translation-row name resolves; one row → one food (or of-related)
const lsrc = fs.readFileSync(fs.existsSync(path.join(here, 'lang-food-v38.js')) ? path.join(here, 'lang-food-v38.js') : js('lang-food.js'), 'utf8');
const rows = lsrc.slice(lsrc.indexOf('const ROWS = `') + 14, lsrc.indexOf('`;', lsrc.indexOf('const ROWS = `'))).trim().split('\n').map((l) => l.split('|').map((x) => x.trim()).filter(Boolean));
for (const row of rows) {
  const got = new Set();
  for (const n of row) { const id = F.foodOf(n); if (!id) miss.push(`lang "${n}"`); else got.add(id); }
  if (got.size > 1) rowSplit.push(`${row[0]}: ${[...got].join(', ')}`);
}
for (const n of ['sale', 'sale fino', 'sale grosso', 'pepe', 'pepe nero', 'acqua', 'olio', 'olio extravergine', 'olio evo', "olio d'oliva", 'olio di oliva', 'olio di semi', 'salz', 'pfeffer', 'wasser', 'öl', 'olivenöl', 'salt', 'pepper', 'black pepper', 'water', 'oil', 'olive oil', 'ghiaccio', 'ice']) {
  if (!F.isBasicFood(n)) miss.push(`basic "${n}"`);
}
console.log(`unresolved: ${miss.length}; nutrition changed: ${nutDiff.length}; translation rows split: ${rowSplit.length}`);
if (report || miss.length) console.log(`-- unresolved\n${miss.join('\n')}`);
if (report) console.log(`-- nutrition changed\n${nutDiff.join('\n')}\n-- rows split\n${rowSplit.join('\n')}\n-- notes\n${notes.join('\n')}`);
