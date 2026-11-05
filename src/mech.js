// Elementy złączne: gwinty metryczne ISO, śruby, nakrętki, otwory normowe
import * as THREE from 'three';
import { fromPositions } from './geomutil.js';
import { union, subtract } from './csg.js';

// d, skok P, s (klucz nakrętki / łba 6-kąt.), m (wys. nakrętki ISO 4032), k (wys. łba 6-kąt. ISO 4017),
// dk (średnica łba walcowego ISO 4762), sk (klucz imbusowy), dcs (łeb stożkowy ISO 10642), clr (otwór przejściowy ISO 273), cb (pogłębienie walcowe)
export const METRIC = {
  M2: { d: 2, P: 0.4, s: 4, m: 1.6, k: 1.4, dk: 3.8, sk: 1.5, dcs: 4.4, clr: 2.4, cb: 4.4 },
  M2_5: { d: 2.5, P: 0.45, s: 5, m: 2, k: 1.7, dk: 4.5, sk: 2, dcs: 5.5, clr: 2.9, cb: 5.5 },
  M3: { d: 3, P: 0.5, s: 5.5, m: 2.4, k: 2, dk: 5.5, sk: 2.5, dcs: 6.72, clr: 3.4, cb: 6.5 },
  M4: { d: 4, P: 0.7, s: 7, m: 3.2, k: 2.8, dk: 7, sk: 3, dcs: 8.96, clr: 4.5, cb: 8 },
  M5: { d: 5, P: 0.8, s: 8, m: 4.7, k: 3.5, dk: 8.5, sk: 4, dcs: 11.2, clr: 5.5, cb: 10 },
  M6: { d: 6, P: 1, s: 10, m: 5.2, k: 4, dk: 10, sk: 5, dcs: 13.44, clr: 6.6, cb: 11 },
  M8: { d: 8, P: 1.25, s: 13, m: 6.8, k: 5.3, dk: 13, sk: 6, dcs: 17.92, clr: 9, cb: 15 },
  M10: { d: 10, P: 1.5, s: 16, m: 8.4, k: 6.4, dk: 16, sk: 8, dcs: 22.4, clr: 11, cb: 18 },
  M12: { d: 12, P: 1.75, s: 18, m: 10.8, k: 7.5, dk: 18, sk: 10, dcs: 26.88, clr: 13.5, cb: 20 },
  M16: { d: 16, P: 2, s: 24, m: 14.8, k: 10, dk: 24, sk: 14, dcs: 33.6, clr: 17.5, cb: 26 },
};
export const SIZE_OPTIONS = Object.keys(METRIC).map(k => [k, k.replace('_', ',')]);
export const spec = size => METRIC[size] || METRIC.M4;

// profil trapezowy zwoju: 0 = średnica rdzenia, 1 = średnica zewnętrzna
function profile(u) {
  if (u < 0.3125) return u / 0.3125;
  if (u < 0.4375) return 1;
  if (u < 0.75) return 1 - (u - 0.4375) / 0.3125;
  return 0;
}

// Pręt z gwintem prawoskrętnym, oś Z, od z=0 do z=L
export function threadRod({ rmaj, rmin, P, L, chamferBottom = true, chamferTop = true }) {
  const seg = Math.max(32, Math.min(80, Math.round(rmaj * 16)));
  const rows = Math.max(4, Math.ceil(L / (P / 10)));
  const rad = (th, z) => {
    let u = (z / P - th / (2 * Math.PI)) % 1;
    if (u < 0) u += 1;
    let r = rmin + (rmaj - rmin) * profile(u);
    if (chamferBottom) r = Math.min(r, rmin * 0.92 + z);
    if (chamferTop) r = Math.min(r, rmin * 0.92 + (L - z));
    return r;
  };
  const V = [];
  for (let j = 0; j <= rows; j++) {
    const z = (L * j) / rows;
    const row = [];
    for (let i = 0; i < seg; i++) {
      const th = (i / seg) * 2 * Math.PI;
      const r = rad(th, z);
      row.push([r * Math.cos(th), r * Math.sin(th), z]);
    }
    V.push(row);
  }
  const out = [];
  const tri = (a, b, c) => out.push(...a, ...b, ...c);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < seg; i++) {
      const a = V[j][i],
        b = V[j][(i + 1) % seg],
        c = V[j + 1][(i + 1) % seg],
        d = V[j + 1][i];
      tri(a, b, c);
      tri(a, c, d);
    }
  }
  const c0 = [0, 0, 0],
    c1 = [0, 0, L];
  for (let i = 0; i < seg; i++) {
    tri(c0, V[0][(i + 1) % seg], V[0][i]);
    tri(c1, V[rows][i], V[rows][(i + 1) % seg]);
  }
  return fromPositions(out);
}

const hexPrism = (acrossFlats, h) =>
  new THREE.CylinderGeometry(acrossFlats / Math.sqrt(3), acrossFlats / Math.sqrt(3), h, 6)
    .rotateX(Math.PI / 2)
    .translate(0, 0, h / 2);
const cyl = (r, h, seg = 48) => new THREE.CylinderGeometry(r, r, h, seg).rotateX(Math.PI / 2).translate(0, 0, h / 2);

function extRod(S, L, luz, threaded, chamferBottom, chamferTop) {
  if (!threaded) {
    const g = cyl(S.d / 2 - luz, L);
    return g;
  }
  return threadRod({ rmaj: S.d / 2 - luz, rmin: S.d / 2 - 0.6134 * S.P - luz, P: S.P, L, chamferBottom, chamferTop });
}
function intRod(S, L, luz, threaded) {
  if (!threaded) return cyl(S.d / 2 + luz, L);
  return threadRod({
    rmaj: S.d / 2 + luz + 0.05,
    rmin: S.d / 2 - 0.5413 * S.P + luz,
    P: S.P,
    L,
    chamferBottom: false,
    chamferTop: false,
  });
}

// Śruba: łeb na dole (najlepiej do druku), trzpień do góry
export function bolt(p) {
  const S = spec(p.size),
    L = Math.max(1, +p.length || 16),
    luz = +p.luz || 0;
  const threaded = p.thread !== 'no';
  if (p.head === 'none') return extRod(S, L, luz, threaded, true, true);
  let head, k;
  if (p.head === 'socket') {
    k = S.d;
    head = subtract(cyl(S.dk / 2, k, 48), [hexPrism(S.sk + 0.15, k * 0.6).translate(0, 0, -0.01)]);
  } else if (p.head === 'csk') {
    k = (S.dcs - S.d) / 2;
    const cone = new THREE.CylinderGeometry(S.d / 2, S.dcs / 2, k, 48).rotateX(Math.PI / 2).translate(0, 0, k / 2);
    head = subtract(cone, [hexPrism(S.sk + 0.15, Math.max(0.6, k * 0.8)).translate(0, 0, -0.01)]);
  } else {
    k = S.k;
    head = hexPrism(S.s, k);
  }
  const rod = extRod(S, L + 0.3, luz, threaded, false, true).translate(0, 0, k - 0.3);
  return union([head, rod]);
}

export function nut(p) {
  const S = spec(p.size),
    luz = p.luz === undefined ? 0.2 : +p.luz;
  const m = S.m;
  const body = hexPrism(S.s, m);
  const hole = intRod(S, m + 2, luz, p.thread !== 'no').translate(0, 0, -1);
  return subtract(body, [hole]);
}

// Otwór gwintowany — zgrupuj go z bryłą, aby powstał gwint wewnętrzny
export function tapHole(p) {
  const S = spec(p.size),
    L = Math.max(1, +p.length || 10),
    luz = p.luz === undefined ? 0.2 : +p.luz;
  return intRod(S, L, luz, true);
}

// Otwór przejściowy na śrubę z pogłębieniem (u góry)
export function boltHole(p) {
  const S = spec(p.size),
    L = Math.max(1, +p.length || 10),
    luz = p.luz === undefined ? 0.2 : +p.luz;
  const shaft = cyl(S.clr / 2 + luz, L);
  if (p.head === 'socket') {
    const depth = Math.min(L, S.d + 0.4);
    return union([shaft, cyl(S.cb / 2 + luz, depth + 0.01).translate(0, 0, L - depth)]);
  }
  if (p.head === 'csk') {
    const h = (S.dcs - S.clr) / 2 + 0.2;
    const cone = new THREE.CylinderGeometry(S.dcs / 2 + luz + 0.2, S.clr / 2 + luz, h, 48)
      .rotateX(Math.PI / 2)
      .translate(0, 0, L - h / 2 + 0.001);
    return union([shaft, cone]);
  }
  if (p.head === 'hex') {
    const depth = Math.min(L, S.k + 0.4);
    return union([shaft, cyl((S.s / Math.sqrt(3)) * 1.0 + 1 + luz, depth + 0.01).translate(0, 0, L - depth)]);
  }
  return shaft;
}

// Gniazdo na nakrętkę (sześciokątna kieszeń), opcjonalnie z otworem przelotowym
export function nutTrap(p) {
  const S = spec(p.size),
    luz = p.luz === undefined ? 0.2 : +p.luz;
  const depth = +p.depth || +(S.m + 0.4).toFixed(2);
  const pocket = hexPrism(S.s + 2 * luz, depth);
  const through = +p.through || 0;
  if (through > 0) return union([pocket, cyl(S.clr / 2 + luz, depth + through).translate(0, 0, -through)]);
  return pocket;
}
