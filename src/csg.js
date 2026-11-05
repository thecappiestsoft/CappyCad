// Operacje logiczne na bryłach (suma, różnica, część wspólna).
// Główny silnik: Manifold (szczelne siatki do druku 3D). Zapasowy: three-bvh-csg — tylko gdy
// siatka wejściowa nie jest zamknięta (np. uszkodzony, zaimportowany plik STL).
import { Brush, Evaluator, ADDITION, SUBTRACTION, INTERSECTION } from 'three-bvh-csg';
import { cleanGeom } from './geomutil.js';
import * as solid from './solid.js';

export const ready = solid.ready;
export const isSolidReady = solid.isReady;
export const cleanForExport = g => (solid.isReady() ? solid.clean(g) : null);
// tylko Manifold (bez zapasowego silnika) — rzuca wyjątek, gdy się nie da
export const unionStrict = list => solid.union(list);

const ev = new Evaluator();
ev.attributes = ['position', 'normal'];
ev.useGroups = false;
function brush(g) {
  const b = new Brush(cleanGeom(g));
  b.updateMatrixWorld();
  return b;
}
function out(b) {
  let g = b.geometry;
  if (g.index) g = g.toNonIndexed();
  return g;
}

function withManifold(fn, fallback) {
  if (solid.isReady()) {
    try {
      return fn();
    } catch (err) {
      console.warn('Manifold → zapasowy silnik CSG:', err.message);
    }
  }
  return fallback();
}

export function union(list) {
  return withManifold(
    () => solid.union(list),
    () => {
      let r = brush(list[0]);
      for (let i = 1; i < list.length; i++) r = ev.evaluate(r, brush(list[i]), ADDITION);
      return out(r);
    },
  );
}
export function subtract(a, list) {
  return withManifold(
    () => solid.subtract(a, list),
    () => {
      let r = brush(a);
      for (const g of list) r = ev.evaluate(r, brush(g), SUBTRACTION);
      return out(r);
    },
  );
}
export function intersect(a, b) {
  return withManifold(
    () => solid.intersect(a, b),
    () => out(ev.evaluate(brush(a), brush(b), INTERSECTION)),
  );
}
