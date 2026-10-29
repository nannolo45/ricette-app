// Decoder for retail barcodes (EAN-13, UPC-A, EAN-8) from camera frames.
// Used when the browser has no built-in BarcodeDetector (e.g. Safari on iPhone).

// Widths (in modules) of the 4 elements of each digit, left-hand "L" code.
const L = ['3211', '2221', '2122', '1411', '1132', '1231', '1114', '1312', '1213', '3112'].map((s) => [...s].map(Number));
const G = L.map((w) => [...w].reverse());
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

const MAX_DIGIT_ERR = 0.9;

function matchDigit(w, tables) {
  const sum = w[0] + w[1] + w[2] + w[3];
  let best = null;
  for (const [kind, table] of tables) {
    for (let d = 0; d < 10; d++) {
      const p = table[d];
      let err = 0;
      for (let i = 0; i < 4; i++) { const n = (w[i] * 7) / sum - p[i]; err += n * n; }
      if (!best || err < best.err) best = { d, kind, err };
    }
  }
  return best && best.err <= MAX_DIGIT_ERR ? best : null;
}

export function checksumOk(digits) {
  const n = digits.length;
  let sum = 0;
  for (let i = 0; i < n - 1; i++) sum += digits[i] * ((n - 1 - i) % 2 === 1 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === digits[n - 1];
}

// Elements as {dark, w} with sub-pixel edges.
export function toRuns(line, threshold) {
  const runs = [];
  let dark = line[0] < threshold[0];
  let start = 0;
  for (let i = 1; i < line.length; i++) {
    const d = line[i] < threshold[i];
    if (d === dark) continue;
    // interpolate where the signal crosses the threshold between i-1 and i
    const a = line[i - 1] - threshold[i - 1];
    const b = line[i] - threshold[i];
    const edge = i - 1 + (a === b ? 0.5 : a / (a - b));
    runs.push({ dark, w: edge - start });
    start = edge;
    dark = d;
  }
  runs.push({ dark, w: line.length - start });
  return runs;
}

function guardOk(runs, from, count, m) {
  for (let i = from; i < from + count; i++) {
    const r = runs[i].w / m;
    if (r < 0.4 || r > 1.9) return false;
  }
  return true;
}

function tryEAN13(runs, s) {
  if (s + 59 > runs.length) return null;
  let total = 0;
  for (let i = s; i < s + 59; i++) total += runs[i].w;
  const m = total / 95;
  const before = s > 0 ? runs[s - 1].w : Infinity;
  const after = s + 59 < runs.length ? runs[s + 59].w : Infinity;
  if (before < 3 * m || after < 3 * m) return null;
  if (!guardOk(runs, s, 3, m) || !guardOk(runs, s + 27, 5, m) || !guardOk(runs, s + 56, 3, m)) return null;
  const digits = [];
  let parity = '';
  let err = 0;
  for (let k = 0; k < 6; k++) {
    const i = s + 3 + k * 4;
    const r = matchDigit([runs[i].w, runs[i + 1].w, runs[i + 2].w, runs[i + 3].w], [['L', L], ['G', G]]);
    if (!r) return null;
    digits.push(r.d); parity += r.kind; err += r.err;
  }
  for (let k = 0; k < 6; k++) {
    const i = s + 32 + k * 4;
    const r = matchDigit([runs[i].w, runs[i + 1].w, runs[i + 2].w, runs[i + 3].w], [['R', L]]);
    if (!r) return null;
    digits.push(r.d); err += r.err;
  }
  const first = PARITY.indexOf(parity);
  if (first < 0) return null;
  const all = [first, ...digits];
  if (!checksumOk(all)) return null;
  return { code: all.join(''), err };
}

function tryEAN8(runs, s) {
  if (s + 43 > runs.length) return null;
  let total = 0;
  for (let i = s; i < s + 43; i++) total += runs[i].w;
  const m = total / 67;
  const before = s > 0 ? runs[s - 1].w : Infinity;
  const after = s + 43 < runs.length ? runs[s + 43].w : Infinity;
  if (before < 3 * m || after < 3 * m) return null;
  if (!guardOk(runs, s, 3, m) || !guardOk(runs, s + 19, 5, m) || !guardOk(runs, s + 40, 3, m)) return null;
  const digits = [];
  let err = 0;
  for (let k = 0; k < 8; k++) {
    const i = k < 4 ? s + 3 + k * 4 : s + 24 + (k - 4) * 4;
    const r = matchDigit([runs[i].w, runs[i + 1].w, runs[i + 2].w, runs[i + 3].w], [['L', L]]);
    if (!r) return null;
    digits.push(r.d); err += r.err;
  }
  if (!checksumOk(digits)) return null;
  return { code: digits.join(''), err };
}

function decodeRuns(runs) {
  let best = null;
  for (let s = 0; s < runs.length; s++) {
    if (!runs[s].dark) continue;
    const r = tryEAN13(runs, s) || tryEAN8(runs, s);
    if (r && (!best || r.err < best.err)) best = r;
  }
  return best;
}

function smooth(line) {
  const out = new Float32Array(line.length);
  for (let i = 0; i < line.length; i++) {
    out[i] = (line[Math.max(0, i - 1)] + 2 * line[i] + line[Math.min(line.length - 1, i + 1)]) / 4;
  }
  return out;
}

function globalThreshold(line) {
  const sorted = Float32Array.from(line).sort();
  const lo = sorted[Math.floor(sorted.length * 0.05)];
  const hi = sorted[Math.floor(sorted.length * 0.95)];
  if (hi - lo < 25) return null; // no contrast
  return new Float32Array(line.length).fill((lo + hi) / 2);
}

// Local mid-point between nearby min and max: copes with shadows and gradients.
function localThreshold(line, win) {
  const n = line.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let lo = 255, hi = 0;
    const a = Math.max(0, i - win), b = Math.min(n - 1, i + win);
    for (let j = a; j <= b; j += 2) { const v = line[j]; if (v < lo) lo = v; if (v > hi) hi = v; }
    out[i] = hi - lo < 25 ? (lo + hi) / 2 + 128 : (lo + hi) / 2; // flat areas count as light
  }
  return out;
}

// Edges = peaks of the brightness slope. Robust to blur: a blurred narrow bar never
// gets truly dark, but its edges stay where they were.
export function edgeRuns(line) {
  const n = line.length;
  const d = new Float32Array(n);
  let maxAbs = 0;
  for (let i = 1; i < n - 1; i++) { d[i] = (line[i + 1] - line[i - 1]) / 2; maxAbs = Math.max(maxAbs, Math.abs(d[i])); }
  const tau = Math.max(4, maxAbs * 0.12);
  const peaks = [];
  for (let i = 2; i < n - 2; i++) {
    const v = d[i];
    if (Math.abs(v) < tau) continue;
    if (!(Math.abs(v) >= Math.abs(d[i - 1]) && Math.abs(v) > Math.abs(d[i + 1]))) continue;
    // parabolic sub-pixel position
    const a = Math.abs(d[i - 1]), b = Math.abs(v), c = Math.abs(d[i + 1]);
    const den = a - 2 * b + c;
    const pos = i + (den !== 0 ? (0.5 * (a - c)) / den : 0);
    const sign = v < 0 ? -1 : 1;
    const last = peaks[peaks.length - 1];
    if (last && last.sign === sign) { if (Math.abs(v) > last.mag) peaks[peaks.length - 1] = { pos, sign, mag: Math.abs(v) }; continue; }
    peaks.push({ pos, sign, mag: Math.abs(v) });
  }
  if (peaks.length < 10) return null;
  const runs = [{ dark: peaks[0].sign > 0, w: peaks[0].pos }];
  for (let k = 0; k < peaks.length; k++) {
    const end = k + 1 < peaks.length ? peaks[k + 1].pos : n;
    runs.push({ dark: peaks[k].sign < 0, w: end - peaks[k].pos });
  }
  return runs;
}

function decodeBothWays(runs) {
  if (!runs) return null;
  return decodeRuns(runs) || decodeRuns([...runs].reverse());
}

export function decodeLine(raw) {
  const sm = smooth(raw);
  for (const line of [sm, raw]) {
    for (const th of [globalThreshold(line), localThreshold(line, Math.max(12, Math.round(line.length / 24)))]) {
      if (!th) continue;
      const r = decodeBothWays(toRuns(line, th));
      if (r) return r.code;
    }
    const r = decodeBothWays(edgeRuns(line));
    if (r) return r.code;
  }
  return null;
}

// gray: Uint8Array/Uint8ClampedArray of width*height luminance values.
// Returns the most frequent code found on scan lines (rows and columns), with how often it was seen.
export function scanGray(gray, width, height, { lines = 15 } = {}) {
  const counts = new Map();
  const row = new Float32Array(width);
  const col = new Float32Array(height);
  for (let k = 0; k < lines; k++) {
    const y = Math.round(height * (0.2 + (0.6 * k) / (lines - 1)));
    for (let x = 0; x < width; x++) row[x] = gray[y * width + x];
    const c = decodeLine(row);
    if (c) counts.set(c, (counts.get(c) || 0) + 1);
  }
  if (!counts.size) {
    for (let k = 0; k < lines; k++) {
      const x = Math.round(width * (0.2 + (0.6 * k) / (lines - 1)));
      for (let y = 0; y < height; y++) col[y] = gray[y * width + x];
      const c = decodeLine(col);
      if (c) counts.set(c, (counts.get(c) || 0) + 1);
    }
  }
  let best = null;
  for (const [code, n] of counts) if (!best || n > best.n) best = { code, n };
  return best;
}

export function rgbaToGray(data, width, height) {
  const g = new Uint8Array(width * height);
  for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
  return g;
}

// UPC-A codes come back as 13 digits with a leading 0, the same as Open Food Facts uses.
export function normalizeCode(code) {
  const c = String(code || '').replace(/\D/g, '');
  if (c.length === 12) return `0${c}`;
  return c;
}

export function isValidCode(code) {
  const c = normalizeCode(code);
  if (![8, 13].includes(c.length)) return false;
  return checksumOk([...c].map(Number));
}
