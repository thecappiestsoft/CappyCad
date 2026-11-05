// Operacje logiczne na bryłach (suma, różnica, część wspólna) — silnik Manifold.
// Manifold zawsze zwraca szczelną, „manifold” siatkę: każda krawędź należy do dokładnie dwóch
// trójkątów, bez dziur i bez T-złączeń — dokładnie tego wymagają slicery drukarek 3D.
import * as THREE from 'three';
import ManifoldModule from 'manifold-3d/manifold.js';
import wasmBinary from 'manifold-3d/manifold.wasm';

let M = null;
// dane .wasm są wbudowane w program — locateFile zapobiega szukaniu pliku po adresie
export const ready = ManifoldModule({ wasmBinary, locateFile: () => 'manifold.wasm' })
  .then(m => {
    m.setup();
    M = m;
    return m;
  })
  .catch(err => {
    console.error('Manifold', err);
    return null;
  });
export const isReady = () => !!M;

// Pozycje (nieindeksowane trójkąty) -> wierzchołki scalone po położeniu, bez trójkątów zdegenerowanych
function indexed(pos, tol = 1e-5) {
  const map = new Map(),
    verts = [],
    tris = [];
  const q = v => Math.round(v / tol);
  const idx = (x, y, z) => {
    const k = q(x) + ',' + q(y) + ',' + q(z);
    let i = map.get(k);
    if (i === undefined) {
      i = verts.length / 3;
      verts.push(x, y, z);
      map.set(k, i);
    }
    return i;
  };
  for (let i = 0; i < pos.length; i += 9) {
    const a = idx(pos[i], pos[i + 1], pos[i + 2]),
      b = idx(pos[i + 3], pos[i + 4], pos[i + 5]),
      c = idx(pos[i + 6], pos[i + 7], pos[i + 8]);
    if (a === b || b === c || a === c) continue; // trójkąt o zerowej powierzchni (np. biegun kuli)
    tris.push(a, b, c);
  }
  return { verts: new Float32Array(verts), tris: new Uint32Array(tris) };
}

function positionsOf(g) {
  const p = g.index ? g.toNonIndexed().getAttribute('position') : g.getAttribute('position');
  return p.array;
}

export function toManifold(g) {
  if (!M) throw new Error('Manifold not ready');
  const { verts, tris } = indexed(positionsOf(g));
  const mesh = new M.Mesh({ numProp: 3, vertProperties: verts, triVerts: tris });
  mesh.merge();
  const m = new M.Manifold(mesh);
  const st = m.status();
  if (st !== 'NoError') {
    m.delete();
    throw new Error('Siatka nie jest zamknięta (' + st + ')');
  }
  return m;
}

export function fromManifold(m) {
  const mesh = m.getMesh();
  const vp = mesh.vertProperties,
    tv = mesh.triVerts,
    np = mesh.numProp;
  const out = new Float32Array(tv.length * 3);
  for (let i = 0; i < tv.length; i++) {
    const v = tv[i] * np;
    out[i * 3] = vp[v];
    out[i * 3 + 1] = vp[v + 1];
    out[i * 3 + 2] = vp[v + 2];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out, 3));
  g.computeVertexNormals();
  return g;
}

// Wykonuje operację na kopiach Manifold i zawsze zwalnia pamięć WASM
function run(geoms, fn) {
  const ms = [];
  try {
    for (const g of geoms) ms.push(toManifold(g));
    const r = fn(ms);
    const g = fromManifold(r);
    if (!ms.includes(r)) r.delete();
    return g;
  } finally {
    ms.forEach(m => m.delete());
  }
}

export const union = list => run(list, ms => (ms.length === 1 ? ms[0] : M.Manifold.union(ms)));
export function subtract(a, list) {
  return run([a, ...list], ([base, ...cut]) => {
    if (!cut.length) return base;
    const tool = cut.length === 1 ? cut[0] : M.Manifold.union(cut);
    const r = base.subtract(tool);
    if (cut.length > 1) tool.delete();
    return r;
  });
}
export const intersect = (a, b) => run([a, b], ([x, y]) => x.intersect(y));

// Czyści pojedynczą bryłę (np. przed eksportem). Zwraca null, gdy siatki nie da się domknąć.
export function clean(g) {
  try {
    return run([g], ([m]) => m);
  } catch {
    return null;
  }
}
