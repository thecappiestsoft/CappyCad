// Sprawdza szczelność siatek wszystkich kształtów z palety (tak jak slicer przed drukiem).
// Dla każdego kształtu: liczba „niezamkniętych” krawędzi i trójkątów zdegenerowanych
// — surowej siatki oraz po oczyszczeniu silnikiem Manifold (to trafia do pliku STL).
//
//   npm run check:mesh
//
// Kod src/ korzysta z importów JSON i WASM, więc skrypt najpierw pakuje się esbuildem.
import * as esbuild from 'esbuild';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

const worker = `
import { SHAPES, makeRaw, defaultParams, normalizeGeometry } from './src/shapes.js';
import * as csg from './src/csg.js';

function meshErrors(g) {
  const p = (g.index ? g.toNonIndexed() : g).getAttribute('position').array;
  const ids = new Map();
  const id = i => { const k = [p[i], p[i + 1], p[i + 2]].map(v => Math.round(v * 1e4)).join(','); if (!ids.has(k)) ids.set(k, ids.size); return ids.get(k); };
  const edges = new Map();
  let degenerate = 0;
  for (let i = 0; i < p.length; i += 9) {
    const t = [id(i), id(i + 3), id(i + 6)];
    if (t[0] === t[1] || t[1] === t[2] || t[0] === t[2]) { degenerate++; continue; }
    for (let k = 0; k < 3; k++) { const e = t[k] + '>' + t[(k + 1) % 3]; edges.set(e, (edges.get(e) || 0) + 1); }
  }
  let open = 0;
  for (const [e, n] of edges) { const [a, b] = e.split('>'); if (n !== 1 || edges.get(b + '>' + a) !== 1) open++; }
  return { open, degenerate };
}

await csg.ready;
let failed = 0;
console.log('kształt'.padEnd(14), 'surowa siatka'.padEnd(34), 'do STL (Manifold)');
for (const type of Object.keys(SHAPES)) {
  if (['mesh', 'svg', 'image', 'group'].includes(type)) continue;
  const params = defaultParams(type);
  if (type === 'sketch') params.pts = [[0, 0], [20, 0], [10, 15]];
  const raw = normalizeGeometry(makeRaw(type, params));
  const clean = csg.cleanForExport(raw);
  const a = meshErrors(raw), b = clean ? meshErrors(clean) : null;
  if (!b || b.open || b.degenerate) failed++;
  console.log(type.padEnd(14), ('niezamknięte ' + a.open + ', zdegenerowane ' + a.degenerate).padEnd(34),
    b ? 'niezamknięte ' + b.open + ', zdegenerowane ' + b.degenerate : 'NIE DA SIĘ DOMKNĄĆ');
}
console.log(failed ? '\\nProblemy: ' + failed : '\\nWszystkie kształty są szczelne.');
process.exit(failed ? 1 : 0);
`;

const tmp = path.join(os.tmpdir(), `cappycad-check-${Date.now()}.mjs`);
await esbuild.build({
  stdin: { contents: worker, resolveDir: process.cwd(), loader: 'js' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: tmp,
  loader: { '.json': 'json', '.wasm': 'binary' },
  logLevel: 'error',
});
// biblioteka three-bvh-csg ostrzega o ustawieniach BVH — w tym raporcie to szum
const warn = console.warn;
console.warn = (...a) => (String(a[0]).includes('maxLeafSize') ? null : warn(...a));
try {
  await import(pathToFileURL(tmp).href);
} finally {
  fs.rmSync(tmp, { force: true });
}
