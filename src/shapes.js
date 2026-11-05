// CappyCad — generator kształtów (układ Z-w-górę, jednostki: mm)
import * as THREE from 'three';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import fontData from './data/font.json';
import capyOutline from './data/capy-outline.json';
import polygonClipping from 'polygon-clipping';
import { cleanGeom, swapWinding, fromPositions } from './geomutil.js';
import { union, subtract } from './csg.js';
import * as mech from './mech.js';

export { swapWinding };
const font = new Font(fontData);
const PI = Math.PI;
const SIZE = { label: 'Rozmiar', type: 'select', def: 'M4', options: mech.SIZE_OPTIONS };
const LUZ = def => ({ label: 'Luz do druku (mm)', type: 'num', def, min: 0, max: 1, step: 0.05 });

export const SHAPES = {
  box: { label: 'Sześcian', color: '#e5484d', params: {} },
  cylinder: {
    label: 'Walec',
    color: '#f08c00',
    params: { sides: { label: 'Liczba boków', def: 48, min: 3, max: 128 } },
  },
  sphere: { label: 'Kula', color: '#1c7ed6', params: { segments: { label: 'Gładkość', def: 40, min: 8, max: 96 } } },
  halfsphere: {
    label: 'Półkula',
    color: '#7048e8',
    params: { segments: { label: 'Gładkość', def: 40, min: 8, max: 96 } },
  },
  cone: {
    label: 'Stożek',
    color: '#ae3ec9',
    params: {
      sides: { label: 'Liczba boków', def: 48, min: 3, max: 128 },
      top: { label: 'Promień góry (%)', def: 0, min: 0, max: 100 },
    },
  },
  pyramid: {
    label: 'Ostrosłup',
    color: '#fab005',
    params: { sides: { label: 'Liczba boków', def: 4, min: 3, max: 12 } },
  },
  roof: { label: 'Dach', color: '#37b24d', params: {} },
  wedge: { label: 'Klin', color: '#0ca678', params: {} },
  prism: {
    label: 'Graniastosłup',
    color: '#1098ad',
    params: { sides: { label: 'Liczba boków', def: 6, min: 3, max: 24 } },
  },
  tube: {
    label: 'Rura',
    color: '#f76707',
    params: {
      wall: { label: 'Grubość ścianki (%)', def: 25, min: 2, max: 95 },
      sides: { label: 'Liczba boków', def: 48, min: 3, max: 128 },
    },
  },
  torus: {
    label: 'Torus',
    color: '#4263eb',
    params: {
      thick: { label: 'Grubość (%)', def: 30, min: 5, max: 90 },
      sides: { label: 'Gładkość', def: 48, min: 3, max: 128 },
    },
  },
  star: {
    label: 'Gwiazda',
    color: '#fcc419',
    params: {
      points: { label: 'Ramiona', def: 5, min: 3, max: 20 },
      inner: { label: 'Wcięcie (%)', def: 45, min: 10, max: 95 },
    },
  },
  heart: { label: 'Serce', color: '#f03e3e', params: {} },
  text: {
    label: 'Tekst',
    color: '#e8590c',
    params: { text: { label: 'Treść', def: 'Tekst', type: 'text' } },
    keepScale: true,
  },

  capybara: {
    label: 'Kapibara',
    color: '#b97f52',
    params: {
      style: {
        label: 'Styl',
        type: 'select',
        def: 'mesh',
        options: [
          ['mesh', 'siatka jak w logo'],
          ['solid', 'pełna z grawerem'],
        ],
      },
      thick: { label: 'Grubość (mm)', type: 'num', def: 6, min: 2, max: 40, step: 0.5 },
      strut: { label: 'Grubość prętów siatki (mm)', type: 'num', def: 1.6, min: 0.8, max: 4, step: 0.1 },
    },
    keepScale: true,
    real: true,
  },
  banana: { label: 'Banan (do skali)', color: '#f2cf3a', params: {}, real: true },
  star3d: {
    label: 'Gwiazda 3D',
    color: '#fab005',
    params: {
      points: { label: 'Ramiona', def: 5, min: 3, max: 16 },
      inner: { label: 'Wcięcie (%)', def: 45, min: 15, max: 90 },
    },
  },
  arrow: { label: 'Strzałka', color: '#228be6', params: {} },
  moon: { label: 'Księżyc', color: '#ffd43b', params: { thin: { label: 'Smukłość (%)', def: 40, min: 10, max: 80 } } },
  drop: { label: 'Kropla', color: '#339af0', params: {} },
  egg: { label: 'Jajko', color: '#f1e3c8', params: {} },
  brick: {
    label: 'Klocek',
    color: '#e03131',
    params: {
      w: { label: 'Wypustki — długość', def: 4, min: 1, max: 10 },
      d: { label: 'Wypustki — szerokość', def: 2, min: 1, max: 6 },
    },
    keepScale: true,
    real: true,
  },
  stairs: { label: 'Schody', color: '#868e96', params: { steps: { label: 'Liczba stopni', def: 4, min: 2, max: 15 } } },
  arch: { label: 'Łuk', color: '#c2255c', params: {} },
  dice: { label: 'Kostka do gry', color: '#f8f9fa', params: {} },
  tetra: { label: 'Czworościan', color: '#12b886', params: {} },
  octa: { label: 'Ośmiościan', color: '#7950f2', params: {} },
  dodeca: { label: 'Dwunastościan', color: '#fd7e14', params: {} },
  icosa: { label: 'Dwudziestościan', color: '#15aabf', params: {} },

  bolt: {
    label: 'Śruba',
    color: '#adb5bd',
    real: true,
    params: {
      size: SIZE,
      length: { label: 'Długość trzpienia (mm)', type: 'num', def: 16, min: 1, max: 200, step: 1 },
      head: {
        label: 'Łeb',
        type: 'select',
        def: 'hex',
        options: [
          ['hex', 'sześciokątny'],
          ['socket', 'walcowy (imbus)'],
          ['csk', 'stożkowy (wpuszczany)'],
          ['none', 'brak — pręt gwintowany'],
        ],
      },
      thread: {
        label: 'Gwint',
        type: 'select',
        def: 'yes',
        options: [
          ['yes', 'tak'],
          ['no', 'nie (gładki trzpień)'],
        ],
      },
      luz: LUZ(0.1),
    },
  },
  nut: {
    label: 'Nakrętka',
    color: '#adb5bd',
    real: true,
    params: {
      size: SIZE,
      thread: {
        label: 'Gwint',
        type: 'select',
        def: 'yes',
        options: [
          ['yes', 'tak'],
          ['no', 'nie (gładki otwór)'],
        ],
      },
      luz: LUZ(0.2),
    },
  },
  tapHole: {
    label: 'Otwór gwintowany',
    color: '#8f9ba8',
    real: true,
    hole: true,
    params: {
      size: SIZE,
      length: { label: 'Głębokość (mm)', type: 'num', def: 10, min: 1, max: 200, step: 1 },
      luz: LUZ(0.2),
    },
  },
  boltHole: {
    label: 'Otwór na śrubę',
    color: '#8f9ba8',
    real: true,
    hole: true,
    params: {
      size: SIZE,
      length: { label: 'Głębokość (mm)', type: 'num', def: 10, min: 1, max: 200, step: 1 },
      head: {
        label: 'Pogłębienie (u góry)',
        type: 'select',
        def: 'socket',
        options: [
          ['socket', 'walcowe (łeb imbus)'],
          ['csk', 'stożkowe (łeb wpuszczany)'],
          ['hex', 'na łeb sześciokątny'],
          ['none', 'brak'],
        ],
      },
      luz: LUZ(0.2),
    },
  },
  nutTrap: {
    label: 'Gniazdo nakrętki',
    color: '#8f9ba8',
    real: true,
    hole: true,
    params: {
      size: SIZE,
      depth: { label: 'Głębokość (0 = wysokość nakrętki)', type: 'num', def: 0, min: 0, max: 50, step: 0.1 },
      through: { label: 'Otwór przelotowy w dół (mm)', type: 'num', def: 0, min: 0, max: 100, step: 1 },
      luz: LUZ(0.2),
    },
  },

  // typy specjalne (nie w palecie)
  mesh: { label: 'Model 3D', color: '#868e96', params: {} },
  svg: { label: 'Grafika SVG', color: '#1098ad', params: {} },
  sketch: {
    label: 'Mój rysunek',
    color: '#37b24d',
    params: {
      smooth: {
        label: 'Wygładzanie',
        type: 'select',
        def: 'no',
        options: [
          ['no', 'krawędzie proste'],
          ['yes', 'krzywe gładkie'],
        ],
      },
    },
  },
  image: {
    label: 'Szablon',
    color: '#ffffff',
    params: { opacity: { label: 'Widoczność obrazu (%)', def: 60, min: 5, max: 100 } },
  },
  group: { label: 'Grupa', color: '#868e96', params: {} },
};

export function defaultParams(type) {
  const out = {};
  for (const [k, p] of Object.entries(SHAPES[type]?.params || {})) out[k] = p.def;
  return out;
}

function num(type, params, key) {
  const p = SHAPES[type].params[key];
  const v = Number(params?.[key] ?? p.def);
  return Math.round(Math.min(p.max, Math.max(p.min, isFinite(v) ? v : p.def)));
}

const extrude = (shape, depth, cs = 24) =>
  new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: cs });
const V2 = (x, y) => new THREE.Vector2(x, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const ellipsoid = (sx, sy, sz, x, y, z, rotY = 0, seg = 28) =>
  new THREE.SphereGeometry(1, seg, Math.round(seg * 0.65)).scale(sx, sy, sz).rotateY(rotY).translate(x, y, z);
const zcyl = (r, h, x = 0, y = 0, z = 0, seg = 32) =>
  new THREE.CylinderGeometry(r, r, h, seg).rotateX(PI / 2).translate(x, y, z + h / 2);
function faceDown(g) {
  // obraca wielościan tak, by leżał na ścianie
  const p = g.getAttribute('position').array;
  const a = new THREE.Vector3(p[0], p[1], p[2]),
    b = new THREE.Vector3(p[3], p[4], p[5]),
    c = new THREE.Vector3(p[6], p[7], p[8]);
  const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  if (n.dot(a.clone().add(b).add(c)) < 0) n.negate();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(n, new THREE.Vector3(0, 0, -1)));
  return g;
}

export function makeRaw(type, params = {}) {
  switch (type) {
    case 'box':
      return new THREE.BoxGeometry(20, 20, 20);
    case 'cylinder':
      return new THREE.CylinderGeometry(10, 10, 20, num(type, params, 'sides')).rotateX(PI / 2);
    case 'prism': {
      const s = num(type, params, 'sides');
      return new THREE.CylinderGeometry(10, 10, 20, s).rotateY(PI / s).rotateX(PI / 2);
    }
    case 'cone':
      return new THREE.CylinderGeometry(num(type, params, 'top') / 10, 10, 20, num(type, params, 'sides')).rotateX(
        PI / 2,
      );
    case 'pyramid': {
      const s = num(type, params, 'sides');
      return new THREE.ConeGeometry(10, 20, s).rotateY(PI / s).rotateX(PI / 2);
    }
    case 'sphere': {
      const s = num(type, params, 'segments');
      return new THREE.SphereGeometry(10, s, Math.max(4, Math.round(s / 2)));
    }
    case 'halfsphere': {
      const s = num(type, params, 'segments'),
        n = Math.max(4, Math.round(s / 4));
      const pts = [V2(0, 0)];
      for (let i = 0; i <= n; i++) {
        const a = ((i / n) * PI) / 2;
        pts.push(V2(Math.max(1e-4, 10 * Math.cos(a)), 10 * Math.sin(a)));
      }
      pts[pts.length - 1].x = 0;
      return new THREE.LatheGeometry(pts, s).rotateX(PI / 2);
    }
    case 'tube': {
      const ri = 10 * (1 - num(type, params, 'wall') / 100);
      return new THREE.LatheGeometry(
        [V2(ri, 0), V2(10, 0), V2(10, 20), V2(ri, 20), V2(ri, 0)],
        num(type, params, 'sides'),
      ).rotateX(PI / 2);
    }
    case 'torus': {
      const r = (10 * num(type, params, 'thick')) / 200;
      return new THREE.TorusGeometry(10 - r, r, 24, num(type, params, 'sides'));
    }
    case 'roof':
      return extrude(new THREE.Shape([V2(-10, 0), V2(10, 0), V2(0, 20)]), 20).rotateX(PI / 2);
    case 'wedge':
      return extrude(new THREE.Shape([V2(-10, 0), V2(10, 0), V2(-10, 20)]), 20).rotateX(PI / 2);
    case 'star':
      return extrude(new THREE.Shape(starPts(num(type, params, 'points'), num(type, params, 'inner') / 100)), 5);
    case 'heart': {
      const s = new THREE.Shape();
      s.moveTo(0, -10);
      s.bezierCurveTo(-3, -6, -10, -2, -10, 3.5);
      s.bezierCurveTo(-10, 8, -6.5, 10, -4.5, 10);
      s.bezierCurveTo(-2, 10, -0.5, 8.5, 0, 6.5);
      s.bezierCurveTo(0.5, 8.5, 2, 10, 4.5, 10);
      s.bezierCurveTo(6.5, 10, 10, 8, 10, 3.5);
      s.bezierCurveTo(10, -2, 3, -6, 0, -10);
      return extrude(s, 5);
    }
    case 'text': {
      let t = String(params.text ?? 'Tekst').replace(/\s+$/, '');
      if (!t.trim()) t = '?';
      const g = new TextGeometry(t, { font, size: 10, depth: 3, curveSegments: 5, bevelEnabled: false });
      g.computeBoundingBox();
      if (!isFinite(g.boundingBox.min.x)) return new THREE.BoxGeometry(5, 5, 3);
      return g;
    }
    case 'capybara':
      return capybara(params);
    case 'banana':
      return banana();
    case 'star3d': {
      const pts = starPts(num(type, params, 'points'), num(type, params, 'inner') / 100);
      const out = [],
        top = [0, 0, 5],
        bot = [0, 0, -5];
      for (let i = 0; i < pts.length; i++) {
        const a = [pts[i].x, pts[i].y, 0],
          b = [pts[(i + 1) % pts.length].x, pts[(i + 1) % pts.length].y, 0];
        out.push(...a, ...b, ...top, ...b, ...a, ...bot);
      }
      return fromPositions(out);
    }
    case 'arrow':
      return extrude(
        new THREE.Shape([V2(-10, -3), V2(2, -3), V2(2, -7.5), V2(10, 0), V2(2, 7.5), V2(2, 3), V2(-10, 3)]),
        5,
      );
    case 'moon': {
      const R = 10,
        d = 2 + (num(type, params, 'thin') / 100) * 8,
        r = 9.2;
      const x = (d * d + R * R - r * r) / (2 * d),
        y = Math.sqrt(Math.max(0.01, R * R - x * x));
      const a1 = Math.atan2(y, x),
        b1 = Math.atan2(y, x - d);
      const s = new THREE.Shape();
      s.moveTo(x, y);
      s.absarc(0, 0, R, a1, 2 * PI - a1, false);
      s.absarc(d, 0, r, -b1, b1, true);
      return extrude(s, 5, 48);
    }
    case 'drop': {
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const a = PI - (i / 40) * PI;
        pts.push(V2(Math.max(0, 9 * Math.sin(a) * Math.pow((1 - Math.cos(a)) / 2, 0.8)), 12 * (1 + Math.cos(a))));
      }
      pts[0].x = 0;
      pts[pts.length - 1].x = 0;
      return new THREE.LatheGeometry(pts, 48).rotateX(PI / 2);
    }
    case 'egg': {
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const a = PI - (i / 40) * PI;
        pts.push(V2(Math.max(0, 9 * Math.sin(a) * (1 - 0.12 * Math.cos(a))), 13 * (1 + Math.cos(a))));
      }
      pts[0].x = 0;
      pts[pts.length - 1].x = 0;
      return new THREE.LatheGeometry(pts, 48).rotateX(PI / 2);
    }
    case 'brick': {
      const w = num(type, params, 'w'),
        d = num(type, params, 'd');
      const parts = [new THREE.BoxGeometry(w * 8 - 0.2, d * 8 - 0.2, 9.6).translate(0, 0, 4.8)];
      for (let i = 0; i < w; i++)
        for (let j = 0; j < d; j++) parts.push(zcyl(2.4, 1.9, (i - (w - 1) / 2) * 8, (j - (d - 1) / 2) * 8, 9.5, 28));
      return union(parts);
    }
    case 'stairs': {
      const n = num(type, params, 'steps'),
        sw = 20 / n,
        sh = 20 / n;
      const pts = [V2(-10, 0), V2(10, 0)];
      for (let k = 1; k <= n; k++) pts.push(V2(10 - (k - 1) * sw, k * sh), V2(10 - k * sw, k * sh));
      return extrude(new THREE.Shape(dedupe(pts)), 20).rotateX(PI / 2);
    }
    case 'arch': {
      const body = new THREE.BoxGeometry(24, 10, 18).translate(0, 0, 9);
      return subtract(body, [
        new THREE.BoxGeometry(13, 12, 10).translate(0, 0, 4),
        new THREE.CylinderGeometry(6.5, 6.5, 12, 48).translate(0, 0, 9),
      ]);
    }
    case 'dice': {
      const body = new THREE.BoxGeometry(20, 20, 20).translate(0, 0, 10);
      const pip = (x, y, z) => new THREE.SphereGeometry(1.8, 16, 10).translate(x, y, z);
      const o = 5,
        pips = [];
      const face = (n, map) => {
        const L = {
          1: [[0, 0]],
          2: [
            [-o, -o],
            [o, o],
          ],
          3: [
            [-o, -o],
            [0, 0],
            [o, o],
          ],
          4: [
            [-o, -o],
            [o, -o],
            [-o, o],
            [o, o],
          ],
          5: [
            [-o, -o],
            [o, -o],
            [0, 0],
            [-o, o],
            [o, o],
          ],
          6: [
            [-o, -o],
            [-o, 0],
            [-o, o],
            [o, -o],
            [o, 0],
            [o, o],
          ],
        }[n];
        L.forEach(([u, v]) => pips.push(pip(...map(u, v))));
      };
      face(1, (u, v) => [u, v, 20]);
      face(6, (u, v) => [u, v, 0]);
      face(2, (u, v) => [u, -10, 10 + v]);
      face(5, (u, v) => [u, 10, 10 + v]);
      face(3, (u, v) => [10, u, 10 + v]);
      face(4, (u, v) => [-10, u, 10 + v]);
      return subtract(body, pips);
    }
    case 'tetra':
      return faceDown(new THREE.TetrahedronGeometry(12));
    case 'octa':
      return faceDown(new THREE.OctahedronGeometry(11));
    case 'dodeca':
      return faceDown(new THREE.DodecahedronGeometry(10));
    case 'icosa':
      return faceDown(new THREE.IcosahedronGeometry(10));
    case 'bolt':
      return mech.bolt(params);
    case 'nut':
      return mech.nut(params);
    case 'tapHole':
      return mech.tapHole(params);
    case 'boltHole':
      return mech.boltHole(params);
    case 'nutTrap':
      return mech.nutTrap(params);
    case 'sketch':
      return sketchGeometry(params);
    default:
      return new THREE.BoxGeometry(20, 20, 20);
  }
}

function dedupe(pts) {
  return pts.filter((p, i) => {
    const q = pts[(i + pts.length - 1) % pts.length];
    return Math.hypot(p.x - q.x, p.y - q.y) > 1e-6;
  });
}

function starPts(n, inner) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = PI / 2 + (i * PI) / n,
      r = i % 2 === 0 ? 10 : 10 * inner;
    pts.push(V2(Math.cos(a) * r, Math.sin(a) * r));
  }
  return pts;
}

// Płaska kapibara z obrysu logo CappyCad (60 × 30 mm), z wygrawerowanym uchem, okiem, nosem i pyszczkiem
function strokeShape(pts, w) {
  // pogrubiona linia łamana -> zamknięty kształt
  const L = [],
    R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0],
      dy = b[1] - a[1];
    const n = Math.hypot(dx, dy) || 1;
    dx /= n;
    dy /= n;
    L.push(V2(pts[i][0] - (dy * w) / 2, pts[i][1] + (dx * w) / 2));
    R.push(V2(pts[i][0] + (dy * w) / 2, pts[i][1] - (dx * w) / 2));
  }
  return new THREE.Shape([...L, ...R.reverse()]);
}
function capybara(params = {}) {
  const T = Math.max(2, Number(params.thick) || 6);
  const strut = Math.max(0.8, Number(params.strut) || 1.6);
  const style = params.style === 'solid' ? 'solid' : 'mesh';
  const outline = capyOutline.pts;
  const depth = Math.min(1.0, T * 0.3);
  const PC = polygonClipping;
  const ring = pts => {
    const r = pts.map(p => [p[0], p[1]]);
    r.push(r[0]);
    return r;
  };
  const strokePoly = (pts, w) =>
    ring(
      strokeShape(pts, w)
        .getPoints()
        .map(v => [v.x, v.y]),
    );
  const disc = (x, y, r, n = 20) =>
    ring(
      Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        return [x + Math.cos(a) * r, y + Math.sin(a) * r];
      }),
    );
  const outlineP = [ring(outline)];
  const mesh = capyOutline.mesh || [];

  // węzły i trójkąty siatki z logo
  const key = (x, y) => x.toFixed(2) + ',' + y.toFixed(2);
  const nodes = new Map(),
    adj = new Map();
  for (const [x1, y1, x2, y2] of mesh) {
    const a = key(x1, y1),
      b = key(x2, y2);
    nodes.set(a, [x1, y1]);
    nodes.set(b, [x2, y2]);
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b);
    adj.get(b).add(a);
  }
  const tris = [];
  for (const [a, na] of adj)
    for (const b of na)
      if (b > a)
        for (const c of adj.get(b))
          if (c > b && na.has(c))
            tris.push([[nodes.get(a), nodes.get(b), nodes.get(c)].map(p => [...p]).concat([nodes.get(a)])]);
  const meshRegion = tris.length ? PC.union(...tris) : [];

  // rowki twarzy (ucho, oko, nos, pyszczek)
  const [ex, ey, ew, eh] = capyOutline.ear;
  const face = [
    [disc(ex, ey, (Math.max(ew, eh) / 2) * 1.15)],
    [strokePoly(capyOutline.eye, 1.4)],
    [strokePoly(capyOutline.nose, 1.1)],
    [strokePoly(capyOutline.mouth, 1.1)],
  ];

  let base2D;
  if (style === 'mesh' && meshRegion.length) {
    // przód — pełny; tył — ażurowa siatka prętów i węzłów jak w logo
    const front = PC.difference(outlineP, meshRegion);
    const bars = mesh.map(([x1, y1, x2, y2]) => [
      strokePoly(
        [
          [x1, y1],
          [x2, y2],
        ],
        strut,
      ),
    ]);
    const knots = [...nodes.values()].map(([x, y]) => [disc(x, y, strut * 0.95)]);
    const lattice = PC.intersection(outlineP, PC.union(...bars, ...knots));
    base2D = PC.union(front, lattice);
  } else {
    const grooves = mesh.map(([x1, y1, x2, y2]) => [
      strokePoly(
        [
          [x1, y1],
          [x2, y2],
        ],
        0.75,
      ),
    ]);
    base2D = [outlineP];
    face.push(...grooves);
  }
  const top2D = PC.difference(base2D, ...face);
  const toShapes = mp =>
    mp.map(poly => {
      const sh = new THREE.Shape(poly[0].slice(0, -1).map(([x, y]) => V2(x, y)));
      for (const h of poly.slice(1)) sh.holes.push(new THREE.Path(h.slice(0, -1).map(([x, y]) => V2(x, y))));
      return sh;
    });
  const opts = d => ({ depth: d, bevelEnabled: false, curveSegments: 8 });
  const lower = new THREE.ExtrudeGeometry(toShapes(base2D), opts(T - depth));
  const upper = new THREE.ExtrudeGeometry(toShapes(top2D), opts(depth + 0.05)).translate(0, 0, T - depth - 0.05);
  return union([lower, upper]);
}

// Banan w typowych wymiarach (ok. 18 cm po łuku, Ø 36 mm) — klasyczne „do skali”
function banana() {
  const R = 190,
    arc = 0.95; // promień i kąt łuku osi: 190 mm × 0,95 rad ≈ 180 mm długości po łuku
  const rings = 72,
    seg = 30,
    out = [];
  const radiusAt = t => {
    if (t > 0.93) return 3.6; // ogonek
    if (t < 0.02) return 3.2; // czubek
    const u = Math.min(1, t / 0.93);
    return Math.max(3.2, 18 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.98 + 0.02)), 0.55));
  };
  const V = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings,
      a = -arc / 2 + arc * t;
    const c = V3(R * Math.sin(a), R - R * Math.cos(a), 0); // oś banana w płaszczyźnie XY
    const nrm = V3(-Math.sin(a), Math.cos(a), 0); // kierunek do środka łuku
    const up = V3(0, 0, 1);
    const r = radiusAt(t),
      row = [];
    for (let j = 0; j < seg; j++) {
      const th = (j / seg) * Math.PI * 2;
      const rr = r * (1 + (t < 0.93 && t > 0.02 ? 0.07 * Math.cos(5 * th) : 0)); // pięć krawędzi
      row.push(
        c
          .clone()
          .addScaledVector(nrm, rr * Math.cos(th))
          .addScaledVector(up, rr * Math.sin(th)),
      );
    }
    V.push({ c, row });
  }
  const tri = (a, b, c) => out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < seg; j++) {
      const a = V[i].row[j],
        b = V[i].row[(j + 1) % seg],
        c = V[i + 1].row[(j + 1) % seg],
        d = V[i + 1].row[j];
      tri(a, b, c);
      tri(a, c, d);
    }
  for (let j = 0; j < seg; j++) {
    tri(V[0].c, V[0].row[(j + 1) % seg], V[0].row[j]);
    tri(V[rings].c, V[rings].row[j], V[rings].row[(j + 1) % seg]);
  }
  return fromPositions(out);
}

function sketchGeometry(params) {
  const pts = (params.pts || []).map(([x, y]) => V2(x, y));
  if (pts.length < 3) return new THREE.BoxGeometry(5, 5, 5);
  let outline = pts;
  if (params.smooth === 'yes')
    outline = new THREE.SplineCurve([...pts, pts[0]]).getSpacedPoints(Math.max(48, pts.length * 12)).slice(0, -1);
  return extrude(new THREE.Shape(outline), 10);
}

// SVG → bryła: każdy wypełniony kształt wyciągnięty na 10 mm
export function svgGeometry(text) {
  const data = new SVGLoader().parse(text);
  const geoms = [];
  for (const path of data.paths) {
    const style = path.userData?.style || {};
    if (style.fill === 'none' || style.fill === 'transparent') continue;
    for (const sh of SVGLoader.createShapes(path)) {
      const g = cleanGeom(new THREE.ExtrudeGeometry(sh, { depth: 10, bevelEnabled: false, curveSegments: 12 }), false);
      if (g.getAttribute('position').count) geoms.push(g);
    }
  }
  if (!geoms.length) throw new Error('Plik SVG nie zawiera wypełnionych kształtów (same linie nie tworzą bryły).');
  const g = mergeGeometries(geoms, false);
  g.scale(1, -1, 1); // w SVG oś Y biegnie w dół
  swapWinding(g);
  return g;
}
export function svgFirstColor(text) {
  try {
    const data = new SVGLoader().parse(text);
    for (const p of data.paths) {
      const f = p.userData?.style?.fill;
      if (f && f !== 'none') {
        const hex = '#' + new THREE.Color(f).getHexString();
        if (hex !== '#000000') return hex;
      }
    }
  } catch {}
  return null;
}

// Ujednolica geometrię: orientacja, odbicie lustrzane, środek podstawy w (0,0,0)
export function normalizeGeometry(src, mirror = [1, 1, 1], fixOrientation = true) {
  const g = cleanGeom(src, fixOrientation);
  if (mirror.some(m => m < 0)) {
    g.applyMatrix4(new THREE.Matrix4().makeScale(mirror[0], mirror[1], mirror[2]));
    if (mirror[0] * mirror[1] * mirror[2] < 0) swapWinding(g);
  }
  g.computeBoundingBox();
  const b = g.boundingBox;
  g.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -b.min.z);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
