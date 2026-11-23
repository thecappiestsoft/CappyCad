// Generator kodów QR (ISO/IEC 18004) — bez bibliotek zewnętrznych, działa offline.
// Tryb bajtowy (UTF-8), wersje 1–40, poziomy korekcji L / M / Q / H, automatyczny wybór maski.
// qrMatrix(text, ecl) -> { size, get(x, y) } — true = moduł ciemny.

const ECL = { L: 0, M: 1, Q: 2, H: 3 };
const FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };
// [poziom][wersja] — liczba bajtów korekcji na blok i liczba bloków
const ECC_PER_BLOCK = [
  [
    -1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30,
    30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
  [
    -1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28,
    28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
  ],
  [
    -1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30,
    30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
  [
    -1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30,
    30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
];
const NUM_BLOCKS = [
  [
    -1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19,
    19, 20, 21, 22, 24, 25,
  ],
  [
    -1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31,
    33, 35, 37, 38, 40, 43, 45, 47, 49,
  ],
  [
    -1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43,
    45, 48, 51, 53, 56, 59, 62, 65, 68,
  ],
  [
    -1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48,
    51, 54, 57, 60, 63, 66, 70, 74, 77, 81,
  ],
];

function rawModules(ver) {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}
const dataCodewords = (ver, e) => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[e][ver] * NUM_BLOCKS[e][ver];

// --- Reed-Solomon w GF(256), wielomian 0x11d
function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}
function rsDivisor(deg) {
  const r = new Array(deg).fill(0);
  r[deg - 1] = 1;
  let root = 1;
  for (let i = 0; i < deg; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = gfMul(r[j], root);
      if (j + 1 < r.length) r[j] ^= r[j + 1];
    }
    root = gfMul(root, 2);
  }
  return r;
}
function rsRemainder(data, div) {
  const r = new Array(div.length).fill(0);
  for (const b of data) {
    const f = b ^ r.shift();
    r.push(0);
    div.forEach((c, i) => (r[i] ^= gfMul(c, f)));
  }
  return r;
}

function alignmentPositions(ver) {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const out = [6];
  for (let p = ver * 4 + 10; out.length < n; p -= step) out.splice(1, 0, p);
  return out;
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  x => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

export function qrMatrix(text, level = 'M') {
  const lv = ECL[level] !== undefined ? level : 'M';
  const e = ECL[lv];
  const bytes = [...new TextEncoder().encode(String(text ?? ''))];
  // najmniejsza wersja, która mieści dane
  let ver = 1;
  for (; ver <= 40; ver++) {
    const cc = ver < 10 ? 8 : 16;
    if (4 + cc + bytes.length * 8 <= dataCodewords(ver, e) * 8) break;
  }
  if (ver > 40) throw new Error('Za dużo tekstu na kod QR (maks. ok. 2900 znaków)');
  const cap = dataCodewords(ver, e) * 8;
  // strumień bitów
  const bits = [];
  const put = (v, n) => {
    for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1);
  };
  put(4, 4); // tryb bajtowy
  put(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach(b => put(b, 8));
  put(0, Math.min(4, cap - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  // bloki + korekcja błędów, przeplatanie
  const nb = NUM_BLOCKS[e][ver],
    eccLen = ECC_PER_BLOCK[e][ver];
  const raw = Math.floor(rawModules(ver) / 8);
  const nShort = nb - (raw % nb),
    shortLen = Math.floor(raw / nb);
  const div = rsDivisor(eccLen);
  const blocks = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const len = shortLen - eccLen + (i < nShort ? 0 : 1);
    const dat = data.slice(k, k + len);
    k += len;
    const ecc = rsRemainder(dat, div);
    if (i < nShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const final = [];
  for (let i = 0; i < blocks[0].length; i++)
    blocks.forEach((b, j) => {
      if (i !== shortLen - eccLen || j >= nShort) final.push(b[i]);
    });

  // matryca
  const size = ver * 4 + 17;
  const mod = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, d) => {
    mod[y][x] = d;
    fn[y][x] = true;
  };
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy)),
          x = cx + dx,
          y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
      }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  const al = alignmentPositions(ver);
  al.forEach((ax, i) =>
    al.forEach((ay, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }),
  );
  const drawFormat = mask => {
    const d = (FORMAT_BITS[lv] << 3) | mask;
    let r = d;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412;
    const bit = i => ((b >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6));
    set(8, 8, bit(7));
    set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  drawFormat(0); // rezerwacja miejsc
  if (ver >= 7) {
    let r = ver;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const b = (ver << 12) | r;
    for (let i = 0; i < 18; i++) {
      const v = ((b >>> i) & 1) === 1,
        a = size - 11 + (i % 3),
        c = Math.floor(i / 3);
      set(a, c, v);
      set(c, a, v);
    }
  }
  // dane zygzakiem
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const up = ((right + 1) & 2) === 0;
        const y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && i < final.length * 8) {
          mod[y][x] = ((final[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
          i++;
        }
      }
  }
  // wybór maski o najmniejszej karze
  const applyMask = m => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[m](x, y)) mod[y][x] = !mod[y][x];
  };
  let best = 0,
    bestPen = Infinity;
  for (let m = 0; m < 8; m++) {
    applyMask(m);
    drawFormat(m);
    const p = penalty(mod, size);
    if (p < bestPen) {
      bestPen = p;
      best = m;
    }
    applyMask(m);
  }
  applyMask(best);
  drawFormat(best);
  return { size, version: ver, mask: best, get: (x, y) => x >= 0 && y >= 0 && x < size && y < size && mod[y][x] };
}

function penalty(mod, size) {
  let p = 0,
    dark = 0;
  const line = get => {
    let run = 1,
      s = 0,
      seq = '';
    for (let i = 0; i < size; i++) {
      const v = get(i);
      seq += v ? '1' : '0';
      if (i > 0) {
        if (v === get(i - 1)) {
          run++;
          if (run === 5) s += 3;
          else if (run > 5) s++;
        } else run = 1;
      }
    }
    const pad = '0000' + seq + '0000';
    for (let k = pad.indexOf('1011101'); k >= 0; k = pad.indexOf('1011101', k + 1)) {
      if (pad.slice(k - 4, k) === '0000' || pad.slice(k + 7, k + 11) === '0000') s += 40;
    }
    return s;
  };
  for (let y = 0; y < size; y++) p += line(x => mod[y][x]);
  for (let x = 0; x < size; x++) p += line(y => mod[y][x]);
  for (let y = 0; y < size - 1; y++)
    for (let x = 0; x < size - 1; x++) {
      const c = mod[y][x];
      if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3;
    }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (mod[y][x]) dark++;
  p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
  return p;
}

// Macierz modułów (z qrMatrix lub odczytana z obrazu) jako obraz SVG — do zapisania lub wydruku na papierze
export function matrixSVG(q, border = 4, scale = 10) {
  const n = q.size + border * 2;
  let d = '';
  for (let y = 0; y < q.size; y++)
    for (let x = 0; x < q.size; x++) if (q.get(x, y)) d += `M${x + border},${y + border}h1v1h-1z`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${n * scale}" height="${n * scale}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>
`;
}
export const qrSVG = (text, level = 'M', border = 4, scale = 10) => matrixSVG(qrMatrix(text, level), border, scale);

// Odczyt modułów kodu QR z obrazu (RGBA, np. z canvas.getImageData).
// Działa dla prostych, niezniekształconych obrazów kodu (zrzut ekranu, wygenerowany plik, skan) —
// kod musi być ustawiony prosto i być jedynym ciemnym elementem na jasnym tle.
// Zwraca wiersze „0/1” rozdzielone „/” (format params.grid kształtu „Kod QR”).
export function gridFromImage(rgba, w, h) {
  const g = new Float32Array(w * h);
  const hist = new Array(256).fill(0);
  for (let i = 0; i < w * h; i++) {
    const a = rgba[i * 4 + 3] / 255;
    // przezroczyste piksele traktujemy jak białe tło
    const v = (0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]) * a + 255 * (1 - a);
    g[i] = v;
    hist[Math.min(255, Math.max(0, Math.round(v)))]++;
  }
  // próg metodą Otsu
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sB = 0,
    wB = 0,
    best = 0,
    thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = w * h - wB;
    if (!wF) break;
    sB += t * hist[t];
    const mB = sB / wB,
      mF = (sum - sB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      thr = t;
    }
  }
  const dark = (x, y) => g[Math.round(y) * w + Math.round(x)] <= thr;
  // obszar ciemnych pikseli
  let x0 = w,
    y0 = h,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (g[y * w + x] <= thr) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  const fail = () => {
    throw new Error('Nie rozpoznano kodu QR na obrazie');
  };
  if (x1 < 0 || x1 - x0 < 20 || y1 - y0 < 20) fail();
  const W = x1 - x0 + 1,
    H = y1 - y0 + 1;
  if (Math.abs(W - H) > Math.max(W, H) * 0.08) fail();
  // wzorzec pozycjonujący w lewym górnym rogu: po przekątnej moduły 1:1:3:1:1 (razem 7)
  const runs = [];
  let cur = true,
    len = 0;
  for (let k = 0; k < Math.min(W, H); k++) {
    const d = dark(x0 + k, y0 + k);
    if (d === cur) len++;
    else {
      runs.push(len);
      if (runs.length === 5) break;
      cur = d;
      len = 1;
    }
  }
  if (runs.length < 5) fail();
  const est = runs.reduce((a, b) => a + b, 0) / 7;
  const n0 = Math.round(W / est);
  const n = 21 + 4 * Math.round((n0 - 21) / 4);
  if (n < 21 || n > 177) fail();
  const mx = W / n,
    my = H / n;
  const rows = [];
  for (let r = 0; r < n; r++) {
    let row = '';
    for (let c = 0; c < n; c++) {
      // średnia z kilku punktów w środku modułu
      let dk = 0,
        cnt = 0;
      for (const fy of [0.35, 0.5, 0.65])
        for (const fx of [0.35, 0.5, 0.65]) {
          const px = Math.min(w - 1, x0 + (c + fx) * mx),
            py = Math.min(h - 1, y0 + (r + fy) * my);
          if (dark(px, py)) dk++;
          cnt++;
        }
      row += dk * 2 > cnt ? '1' : '0';
    }
    rows.push(row);
  }
  // kontrola: trzy wzorce pozycjonujące muszą się zgadzać
  let bad = 0;
  const finder = (cx, cy) => {
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        if ((rows[cy + dy][cx + dx] === '1') !== (d !== 2)) bad++;
      }
  };
  finder(3, 3);
  finder(n - 4, 3);
  finder(3, n - 4);
  if (bad > 6) fail();
  return rows.join('/');
}
