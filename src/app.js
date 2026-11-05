// CappyCad — prosty modelarz 3D dla szkół (offline)
//
// Główny moduł interfejsu: scena 3D, obiekty, narzędzia, panele i pliki.
// Opis architektury i formatów danych: docs/ARCHITEKTURA.md
//
// SPIS TREŚCI (wyszukaj nagłówek „// ===== <nazwa>”):
//   scena                    renderer Three.js, kamera, światła, sterowanie widokiem (OrbitControls)
//   płaszczyzna robocza      siatka milimetrowa = stół drukarki
//   motyw                    jasny / ciemny / jak w systemie (kolory sceny + atrybut data-theme)
//   stan                     lista obiektów, zaznaczenie, krok siatki, historia, magazyn danych binarnych
//   geometria                geomFor(): kształt -> znormalizowana geometria (z pamięcią podręczną), grupy (CSG)
//   obiekty                  rekord obiektu, serialize()/createObject(), deformacje, kolor, otwór
//   dodawanie kształtów      addShape() — z palety lub przez przeciągnięcie
//   zaznaczenie              setSelection(), ramki zaznaczenia
//   gizmo                    strzałki przesuwania / obrotu / skalowania (TransformControls)
//   uchwyty krawędzi         skalowanie od krawędzi i narożnika, uchwyt wysokości
//   operacje                 usuwanie, kopiowanie, grupowanie, odbicie, wyrównanie
//   historia                 cofnij / ponów (migawki JSON)
//   pliki                    projekt .cappycad, import STL/OBJ/SVG/obrazów, eksport STL/OBJ/PNG, autozapis
//   moje kształty            biblioteka użytkownika (localStorage + eksport .cappylib)
//   widok kamery             widoki z góry/przodu/…, dopasowanie, zoom
//   mysz / narzędzia         wybieranie promieniem, miarka, rysowanie własnego kształtu, przeciąganie
//   klawiatura               skróty klawiszowe
//   inspektor                panel obiektu (wymiary, obrót, parametry, deformacje), zwijany do uchwytu
//   panel szablonów          obrazy-podkładki do odrysowania
//   paleta                   kafelki kształtów z miniaturami renderowanymi w 3D
//   Cappy                    podpowiedzi sytuacyjne pomocnika
//   przykłady i ćwiczenia    galeria projektów, ćwiczenia z automatycznym sprawdzaniem kroków
//   język, paski narzędzi, okna dialogowe, pętla renderowania, start
//   (na końcu pliku: window.__cappycad — mostek dla testów automatycznych, test/smoke.in-page.js)
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as csg from './csg.js';
import {
  SHAPES,
  makeRaw,
  normalizeGeometry,
  swapWinding,
  defaultParams,
  svgGeometry,
  svgFirstColor,
} from './shapes.js';
import { applyDeform, deformActive } from './deform.js';
import { ICONS } from './icons.js';
import { tr, setLang, startObserver, initialLang, lang } from './i18n.js';
import { createCapy } from './capy.js';
import { EXAMPLES, EXERCISES } from './examples.js';
import { makeZip } from './zip.js';
import { showHelp as showHelpDialog } from './help.js';

const APP = 'CappyCad',
  EXT = 'cappycad';
{
  // wycisza powtarzające się ostrzeżenia bibliotek zewnętrznych
  const warn = console.warn.bind(console);
  console.warn = (...a) => {
    const m = String(a[0] || '');
    if (m.includes('maxLeafSize') || m.includes('createShapes() is deprecated')) return;
    warn(...a);
  };
}
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const api = window.cappycad || null; // most do Electrona (preload)
const r1 = v => Math.round(v * 100) / 100;
const fmt = v => (lang === 'en' ? String(r1(v)) : String(r1(v)).replace('.', ','));
const parseNum = s => parseFloat(String(s).replace(',', '.'));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ================================================================ scena
const viewport = $('#viewport');
// Bez grafiki 3D (WebGL) program nie może działać — pokazujemy zrozumiały komunikat zamiast pustego ekranu
function createRenderer() {
  try {
    return new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  } catch (err) {
    const en = !(navigator.language || 'pl').toLowerCase().startsWith('pl');
    document.body.innerHTML = `<div style="max-width:560px;margin:15vh auto;padding:24px;font:15px/1.5 system-ui,sans-serif">
      <h2>${en ? 'CappyCad cannot start' : 'Nie można uruchomić CappyCad'}</h2>
      <p>${
        en
          ? 'This computer did not allow 3D graphics (WebGL). Update the graphics card driver or try another browser (Chrome, Edge, Firefox).'
          : 'Ten komputer nie udostępnił grafiki 3D (WebGL). Zaktualizuj sterownik karty graficznej lub spróbuj innej przeglądarki (Chrome, Edge, Firefox).'
      }</p><p style="color:#888">${String(err.message || err)}</p></div>`;
    throw err;
  }
}
const renderer = createRenderer();
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
viewport.prepend(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#eef2f6'); // nadpisywane przez motyw
const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 50000);
camera.up.set(0, 0, 1);
camera.position.set(-170, -260, 210);

const orbit = new OrbitControls(camera, canvas);
orbit.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
orbit.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
orbit.enableDamping = true;
orbit.dampingFactor = 0.18;
orbit.zoomToCursor = true;
orbit.screenSpacePanning = true;
orbit.minDistance = 5;
orbit.maxDistance = 6000;

scene.add(new THREE.HemisphereLight('#ffffff', '#b8c4d0', 1.7));
const sun = new THREE.DirectionalLight('#ffffff', 1.9);
sun.position.set(-120, -200, 320);
scene.add(sun);
const backLight = new THREE.DirectionalLight('#ffffff', 0.6);
backLight.position.set(200, 150, 120);
scene.add(backLight);

// ================================================================ płaszczyzna robocza
const workplane = new THREE.Group();
scene.add(workplane);
let wp = { x: 200, y: 200 };

function lineSeg(arr, color, opacity = 1, depthTest = true) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  return new THREE.LineSegments(
    g,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, depthTest }),
  );
}

// ================================================================ motyw (jasny / ciemny)
const THEMES = {
  light: {
    bg: '#eef2f6',
    plane: '#d3e3f3',
    planeOp: 0.92,
    minor: '#7fa3c7',
    minorOp: 0.28,
    major: '#4f7ca8',
    majorOp: 0.55,
    border: '#2f5f8f',
    thumb: '#ffffff',
  },
  dark: {
    bg: '#0e1215',
    plane: '#132331',
    planeOp: 0.96,
    minor: '#2c4a63',
    minorOp: 0.6,
    major: '#3f74a0',
    majorOp: 0.8,
    border: '#5aa9d6',
    thumb: '#161b20',
  },
};
let themeMode = 'system';
try {
  themeMode = localStorage.getItem('cappycad-theme') || 'system';
} catch {}
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
let hostTheme =
  ['light', 'dark'].includes(document.documentElement.dataset.theme) && !api
    ? document.documentElement.dataset.theme
    : null;
let lastSetTheme = null;
const effectiveTheme = () => (themeMode === 'system' ? hostTheme || (darkQuery.matches ? 'dark' : 'light') : themeMode);
let TH = THEMES[effectiveTheme()];
document.documentElement.dataset.theme = lastSetTheme = effectiveTheme();

function buildWorkplane() {
  workplane.clear();
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(wp.x, wp.y),
    new THREE.MeshBasicMaterial({
      color: TH.plane,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: TH.planeOp,
      depthWrite: false,
    }),
  );
  plane.position.z = -0.05;
  plane.renderOrder = -2;
  workplane.add(plane);
  const minor = wp.x * wp.y > 250000 ? 5 : 1;
  const lines = [[], []];
  const hx = wp.x / 2,
    hy = wp.y / 2;
  for (let x = -hx; x <= hx + 1e-6; x += minor)
    lines[Math.abs(Math.round(x) % 10) === 0 ? 1 : 0].push(x, -hy, 0, x, hy, 0);
  for (let y = -hy; y <= hy + 1e-6; y += minor)
    lines[Math.abs(Math.round(y) % 10) === 0 ? 1 : 0].push(-hx, y, 0, hx, y, 0);
  const a = lineSeg(lines[0], TH.minor, TH.minorOp),
    b = lineSeg(lines[1], TH.major, TH.majorOp);
  const border = lineSeg(
    [-hx, -hy, 0, hx, -hy, 0, hx, -hy, 0, hx, hy, 0, hx, hy, 0, -hx, hy, 0, -hx, hy, 0, -hx, -hy, 0],
    TH.border,
    0.9,
  );
  const ax = lineSeg([-hx, -hy - 2, 0, -hx + 25, -hy - 2, 0], '#e03131');
  const ay = lineSeg([-hx - 2, -hy, 0, -hx - 2, -hy + 25, 0], '#2f9e44');
  [a, b, border, ax, ay].forEach(l => {
    l.renderOrder = -1;
    workplane.add(l);
  });
  $('#wpLabel').textContent = `${wp.x} × ${wp.y} mm`;
}

// ================================================================ stan
let objects = [];
let selection = [];
let snap = 1,
  angleSnap = 15;
let gizmoMode = 'translate';
let tool = 'select'; // select | ruler | sketch
let history = [],
  future = [];
let dirty = false,
  currentPath = null;
const dataStore = new Map(); // dataKey -> dane (base64 siatki, tekst SVG, obraz dataURL)

const holeMaterial = new THREE.MeshStandardMaterial({
  color: '#8f9ba8',
  transparent: true,
  opacity: 0.42,
  depthWrite: false,
  roughness: 0.8,
});

// ================================================================ geometria

const geomCache = new Map();
function hashStr(s) {
  let h = 2166136261 >>> 0,
    h2 = 5381;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h ^= c;
    h = Math.imul(h, 16777619);
    h2 = (Math.imul(h2, 33) + c) | 0;
  }
  return (h >>> 0).toString(36) + (h2 >>> 0).toString(36) + s.length;
}

function baseKey(d) {
  let k;
  if (d.type === 'group') k = 'g:' + hashStr(JSON.stringify([d.children, d.frame0]));
  else if (d.type === 'mesh' || d.type === 'svg') k = d.type + ':' + d.dataKey;
  else k = d.type + ':' + JSON.stringify(d.params || {});
  return k + '|' + (d.mirror || [1, 1, 1]).join(',');
}

function geomFor(d) {
  if (d.type === 'image') return imageGeom(d);
  const def = deformActive(d.deform) && d.dsize;
  const key = baseKey(d) + (def ? '|d:' + JSON.stringify(d.deform) + d.dsize.map(v => v.toFixed(3)).join(',') : '');
  let c = geomCache.get(key);
  if (c) return c;
  let geom;
  if (def) {
    const base = geomFor({ ...d, deform: null });
    geom = normalizeGeometry(applyDeform(base.geom, base.baseSize, d.dsize, d.deform));
  } else {
    let raw,
      fix = true;
    if (d.type === 'group') {
      raw = csgGroup(d);
      fix = false;
    } else if (d.type === 'mesh') raw = decodeMesh(d.dataKey);
    else if (d.type === 'svg') raw = svgGeometry(dataStore.get(d.dataKey) || '<svg/>');
    else raw = makeRaw(d.type, d.params);
    geom = normalizeGeometry(raw, d.mirror || [1, 1, 1], fix);
  }
  const baseSize = V3();
  geom.boundingBox.getSize(baseSize);
  baseSize.max(V3(0.01, 0.01, 0.01));
  c = { geom, baseSize };
  geomCache.set(key, c);
  return c;
}

function imageGeom(d) {
  const a = d.params?.aspect || 1;
  const key = 'img:' + a.toFixed(5);
  let c = geomCache.get(key);
  if (c) return c;
  const geom = new THREE.PlaneGeometry(100, 100 / a);
  geom.computeBoundingBox();
  c = { geom, baseSize: V3(100, 100 / a, 0.01) };
  geomCache.set(key, c);
  return c;
}

function matrixOf(d, baseSize) {
  return new THREE.Matrix4().compose(
    V3().fromArray(d.pos),
    new THREE.Quaternion().fromArray(d.quat),
    V3(d.size[0] / baseSize.x, d.size[1] / baseSize.y, d.size[2] / baseSize.z),
  );
}

function csgGroup(d) {
  const solids = [],
    holes = [];
  for (const c of d.children) {
    const { geom, baseSize } = geomFor(c);
    const m = matrixOf(c, baseSize);
    const g = geom.clone();
    g.applyMatrix4(m);
    if (m.determinant() < 0) swapWinding(g);
    (c.hole ? holes : solids).push(g);
  }
  // Manifold (szczelna siatka do druku); bryły bez otworów — suma, z otworami — różnica
  let out = solids.length
    ? holes.length
      ? csg.subtract(csg.union(solids), holes)
      : csg.union(solids)
    : csg.union(holes);
  if (out.index) out = out.toNonIndexed();
  out.applyMatrix4(new THREE.Matrix4().fromArray(d.frame0).invert());
  if (!out.getAttribute('position') || out.getAttribute('position').count === 0)
    out = new THREE.BoxGeometry(0.01, 0.01, 0.01).toNonIndexed();
  return out;
}

// --- dane binarne
function bytesToB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const f32ToB64 = f32 => bytesToB64(new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength));
function b64ToBytes(b64) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}
function decodeMesh(key) {
  const b64 = dataStore.get(key);
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    'position',
    new THREE.BufferAttribute(b64 ? new Float32Array(b64ToBytes(b64).buffer) : new Float32Array(9), 3),
  );
  g.computeVertexNormals();
  return g;
}

// ================================================================ obiekty
const sizeOf = o => V3().copy(o.mesh.scale).multiply(o.baseSize);
const isImage = o => o.type === 'image';

function serialize(o) {
  const d = {
    id: o.id,
    type: o.type,
    name: o.name,
    color: o.color,
    hole: o.hole,
    params: o.params,
    mirror: o.mirror,
    pos: o.mesh.position.toArray().map(v => Math.round(v * 10000) / 10000),
    quat: o.mesh.quaternion.toArray(),
    size: sizeOf(o)
      .toArray()
      .map(v => Math.round(v * 10000) / 10000),
  };
  if (o.type === 'group') {
    d.children = o.children;
    d.frame0 = o.frame0;
  }
  if (o.dataKey) d.dataKey = o.dataKey;
  if (deformActive(o.deform)) {
    d.deform = o.deform;
    d.dsize = o.dsize;
  }
  if (o.locked) d.locked = true;
  if (o.hidden) d.hidden = true;
  return d;
}

const textureCache = new Map();
function makeMaterial(o) {
  if (isImage(o)) {
    let tex = textureCache.get(o.dataKey);
    if (!tex) {
      tex = new THREE.TextureLoader().load(dataStore.get(o.dataKey) || '');
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      textureCache.set(o.dataKey, tex);
    }
    return new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: (o.params.opacity ?? 60) / 100,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }
  if (o.hole) return holeMaterial;
  return new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.55, metalness: 0.02 });
}

function createObject(d, addToScene = true) {
  const o = {
    id: d.id || uid(),
    type: d.type,
    name: d.name || SHAPES[d.type]?.label || 'Obiekt',
    color: d.color || SHAPES[d.type]?.color || '#868e96',
    hole: !!d.hole && d.type !== 'image',
    params: d.params ? structuredClone(d.params) : defaultParams(d.type),
    mirror: d.mirror ? [...d.mirror] : [1, 1, 1],
    children: d.children,
    frame0: d.frame0,
    dataKey: d.dataKey,
    deform: deformActive(d.deform) ? { ...d.deform } : null,
    dsize: d.dsize ? [...d.dsize] : null,
    locked: !!d.locked,
    hidden: !!d.hidden,
  };
  const { geom, baseSize } = geomFor(o);
  o.baseSize = baseSize.clone();
  o.mesh = new THREE.Mesh(geom, makeMaterial(o));
  o.mesh.userData.obj = o;
  o.mesh.visible = !o.hidden;
  if (isImage(o)) o.mesh.renderOrder = -0.5;
  o.mesh.position.fromArray(d.pos || [0, 0, 0]);
  o.mesh.quaternion.fromArray(d.quat || [0, 0, 0, 1]);
  const size = d.size || baseSize.toArray();
  o.mesh.scale.set(size[0] / baseSize.x, size[1] / baseSize.y, size[2] / baseSize.z);
  if (addToScene) {
    scene.add(o.mesh);
    objects.push(o);
  }
  return o;
}

function removeObject(o) {
  scene.remove(o.mesh);
  if (o.mesh.material !== holeMaterial) o.mesh.material.dispose();
  objects = objects.filter(x => x !== o);
}
function clearScene() {
  setSelection([]);
  [...objects].forEach(removeObject);
}

// mode: 'size' — zachowaj wymiary, 'scale' — zachowaj skalę, 'unit' — skala 1
function rebuildGeometry(o, mode = 'size') {
  const oldSize = sizeOf(o),
    oldScale = o.mesh.scale.clone();
  const { geom, baseSize } = geomFor(o);
  o.mesh.geometry = geom;
  o.baseSize = baseSize.clone();
  if (mode === 'unit') o.mesh.scale.set(1, 1, 1);
  else if (mode === 'scale') o.mesh.scale.copy(oldScale);
  else o.mesh.scale.set(oldSize.x / baseSize.x, oldSize.y / baseSize.y, oldSize.z / baseSize.z);
}

function setDeform(o, nd) {
  const was = deformActive(o.deform),
    now = deformActive(nd);
  if (!was && !now) return;
  if (!was && now) {
    o.dsize = sizeOf(o).toArray();
    capy?.say('deform');
  }
  if (was && !now) {
    const ds = o.dsize;
    o.deform = null;
    o.dsize = null;
    rebuildGeometry(o, 'unit');
    o.mesh.scale.set(ds[0] / o.baseSize.x, ds[1] / o.baseSize.y, ds[2] / o.baseSize.z);
    return;
  }
  o.deform = { ...nd };
  rebuildGeometry(o, 'unit');
}

// po skalowaniu obiektu z deformacją przeliczamy go w prawdziwych wymiarach
function rebakeDeformed() {
  for (const o of objects) {
    if (!deformActive(o.deform)) continue;
    const s = o.mesh.scale;
    if (Math.abs(s.x - 1) < 1e-5 && Math.abs(s.y - 1) < 1e-5 && Math.abs(s.z - 1) < 1e-5) continue;
    o.dsize = o.dsize.map((v, i) => Math.max(0.1, v * [s.x, s.y, s.z][i]));
    rebuildGeometry(o, 'unit');
  }
}

function setHole(o, hole) {
  if (o.hole === hole || isImage(o)) return;
  if (o.mesh.material !== holeMaterial) o.mesh.material.dispose();
  o.hole = hole;
  o.mesh.material = makeMaterial(o);
}
function setColor(o, color) {
  if (isImage(o)) return;
  o.color = color;
  if (!o.hole) o.mesh.material.color.set(color);
}

function worldBox(o, precise = true) {
  o.mesh.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(o.mesh, precise);
}
function selectionBox(list = selection, precise = false) {
  const b = new THREE.Box3();
  list.forEach(o => b.union(worldBox(o, precise)));
  return b;
}

// ================================================================ dodawanie kształtów
function addShape(type, at, extra = {}) {
  const def = SHAPES[type];
  const params = { ...defaultParams(type), ...(extra.params || {}) };
  setBusy(true, 'Tworzenie kształtu…');
  try {
    const { baseSize } = geomFor({ type, params, mirror: [1, 1, 1] });
    const k = def.keepScale || def.real ? 1 : (def.defSize || 20) / Math.max(baseSize.x, baseSize.y);
    const size = [baseSize.x * k, baseSize.y * k, baseSize.z * k].map(v => Math.round(v * 1000) / 1000);
    const pos = at ? at.clone() : V3(snapV(orbit.target.x), snapV(orbit.target.y), 0);
    pos.x = snapV(pos.x);
    pos.y = snapV(pos.y);
    const hole = extra.hole ?? !!def.hole;
    const o = createObject({
      type,
      params,
      size,
      pos: pos.toArray(),
      color: hole ? '#8f9ba8' : def.color,
      hole,
      name:
        tr(extra.label || (hole && !def.hole ? 'Otwór — ' : '') + def.label) +
        (params.size ? ' ' + String(params.size).replace('_', lang === 'en' ? '.' : ',') : ''),
    });
    if (!at) dropToPlane([o]);
    setSelection([o]);
    commit();
    capyAfterAdd(o);
    return o;
  } finally {
    setBusy(false);
  }
}

// ================================================================ zaznaczenie
const selHelpers = new Map();
function setSelection(list) {
  selection = [...new Set(list)].filter(o => objects.includes(o));
  for (const [, h] of selHelpers) {
    scene.remove(h);
    h.geometry.dispose();
  }
  selHelpers.clear();
  for (const o of selection) {
    const h = new THREE.BoxHelper(o.mesh, '#1971c2');
    h.material.depthTest = false;
    h.material.transparent = true;
    h.material.opacity = 0.7;
    h.renderOrder = 10;
    scene.add(h);
    selHelpers.set(o, h);
  }
  attachGizmo();
  renderInspector();
  updateToolbarState();
}
const toggleSelect = o => setSelection(selection.includes(o) ? selection.filter(x => x !== o) : [...selection, o]);

// ================================================================ gizmo (strzałki)
const pivot = new THREE.Object3D();
scene.add(pivot);
const tc = new TransformControls(camera, canvas);
tc.setSize(0.85);
scene.add(tc.getHelper());
let tcStart = null;

function applySnapSettings() {
  tc.setTranslationSnap(snap > 0 ? snap : null);
  tc.setRotationSnap(angleSnap > 0 ? THREE.MathUtils.degToRad(angleSnap) : null);
}

function attachGizmo() {
  if (!selection.length || gizmoMode === 'none' || tool !== 'select') {
    tc.detach();
    return;
  }
  tc.setMode(gizmoMode);
  const b = selectionBox();
  const c = b.getCenter(V3());
  if (gizmoMode === 'rotate') {
    pivot.position.copy(c);
    pivot.quaternion.identity();
    tc.setSpace('world');
  } else if (selection.length === 1) {
    const m = selection[0].mesh;
    pivot.position.copy(m.position);
    pivot.quaternion.copy(m.quaternion);
    tc.setSpace(gizmoMode === 'scale' ? 'local' : 'world');
  } else {
    pivot.position.set(c.x, c.y, b.min.z);
    pivot.quaternion.identity();
    tc.setSpace('world');
  }
  pivot.scale.set(1, 1, 1);
  pivot.updateMatrixWorld(true);
  tc.attach(pivot);
}

tc.addEventListener('dragging-changed', e => {
  orbit.enabled = !e.value;
  if (e.value) {
    pivot.updateMatrixWorld(true);
    tcStart = {
      P0inv: pivot.matrixWorld.clone().invert(),
      M0: selection.map(o => {
        o.mesh.updateMatrix();
        return o.mesh.matrix.clone();
      }),
    };
  } else {
    tcStart = null;
    commit();
    attachGizmo();
  }
});
tc.addEventListener('objectChange', () => {
  if (!tcStart) return;
  pivot.updateMatrixWorld(true);
  const D = pivot.matrixWorld.clone().multiply(tcStart.P0inv);
  selection.forEach((o, i) => {
    D.clone().multiply(tcStart.M0[i]).decompose(o.mesh.position, o.mesh.quaternion, o.mesh.scale);
    o.mesh.scale.set(Math.abs(o.mesh.scale.x), Math.abs(o.mesh.scale.y), Math.abs(o.mesh.scale.z));
    if (gizmoMode === 'scale') {
      const s = sizeOf(o),
        step = snap > 0 ? snap : 0.01;
      ['x', 'y', 'z'].forEach(a => {
        o.mesh.scale[a] = Math.max(0.1, Math.round(s[a] / step) * step) / o.baseSize[a];
      });
    }
  });
  updateInspectorValues();
});

// ================================================================ uchwyty krawędzi (skalowanie od krawędzi/narożnika)
const handleGroup = new THREE.Group();
handleGroup.renderOrder = 25;
scene.add(handleGroup);
const HANDLE_DEFS = [
  { sx: 1, sy: 1 },
  { sx: -1, sy: 1 },
  { sx: 1, sy: -1 },
  { sx: -1, sy: -1 },
  { sx: 1, sy: 0 },
  { sx: -1, sy: 0 },
  { sx: 0, sy: 1 },
  { sx: 0, sy: -1 },
  { top: true },
];
{
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const edges = new THREE.EdgesGeometry(geo);
  for (const h of HANDLE_DEFS) {
    const corner = h.sx && h.sy;
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: h.top ? '#1d2733' : corner ? '#ffffff' : '#e7f1fb',
        depthTest: false,
        transparent: true,
      }),
    );
    m.add(
      new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: '#1971c2', depthTest: false, transparent: true }),
      ),
    );
    m.renderOrder = 25;
    m.children[0].renderOrder = 26;
    m.userData.h = h;
    handleGroup.add(m);
  }
}
let hdrag = null;

function handlesActive() {
  return tool === 'select' && selection.length === 1 && gizmoMode !== 'rotate' && !selection[0].locked;
}
function updateHandles() {
  handleGroup.visible = handlesActive() && !drag;
  if (!handleGroup.visible) return;
  const o = selection[0],
    s = sizeOf(o),
    q = o.mesh.quaternion,
    p = o.mesh.position;
  const a = toScreen(
      V3(-s.x / 2, -s.y / 2, 0)
        .applyQuaternion(q)
        .add(p),
    ),
    b = toScreen(
      V3(s.x / 2, s.y / 2, 0)
        .applyQuaternion(q)
        .add(p),
    );
  const screenSpan = Math.hypot(a.x - b.x, a.y - b.y);
  for (const m of handleGroup.children) {
    const h = m.userData.h;
    const local = h.top ? V3(0, 0, s.z) : V3((h.sx * s.x) / 2, (h.sy * s.y) / 2, 0);
    m.position.copy(local.applyQuaternion(q).add(p));
    m.quaternion.copy(q);
    const k = camera.position.distanceTo(m.position) * (h.top ? 0.0095 : 0.008);
    m.scale.setScalar(k);
    const small = screenSpan < 70 && !(h.sx && h.sy) && !h.top; // przy małych obiektach tylko narożniki i góra
    m.visible = !small && !(isImage(o) && h.top) && !(h.top && hdrag && hdrag.h !== h);
  }
}
function pickHandle(e) {
  if (!handleGroup.visible) return null;
  setRay(e);
  const hits = raycaster.intersectObjects(
    handleGroup.children.filter(m => m.visible),
    false,
  );
  return hits.length ? hits[0].object.userData.h : null;
}

viewport.addEventListener(
  'pointerdown',
  e => {
    if (e.button !== 0 || tool !== 'select') return;
    const h = pickHandle(e);
    if (!h) return;
    e.stopPropagation();
    e.preventDefault();
    const o = selection[0];
    const q = o.mesh.quaternion.clone();
    const zl = V3(0, 0, 1).applyQuaternion(q);
    const base = o.mesh.position.clone();
    let plane;
    if (h.top) {
      const camDir = camera.position.clone().sub(base);
      const n = camDir.sub(zl.clone().multiplyScalar(camDir.dot(zl))).normalize();
      plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, base);
    } else plane = new THREE.Plane().setFromNormalAndCoplanarPoint(zl, base);
    hdrag = { o, h, plane, size0: sizeOf(o), pos0: base, q, qi: q.clone().invert() };
    tc.detach();
    orbit.enabled = false;
    canvas.setPointerCapture(e.pointerId);
  },
  { capture: true },
);

function moveHandle(e) {
  const { o, h, plane, size0, pos0, q, qi } = hdrag;
  setRay(e);
  const p = V3();
  if (!raycaster.ray.intersectPlane(plane, p)) return;
  const L = p.sub(pos0).applyQuaternion(qi);
  const S = size0.clone();
  const keepProp = e.shiftKey || isImage(o);
  let cx = 0,
    cy = 0;
  if (h.top) {
    S.z = Math.max(0.1, snapV(L.z));
    if (keepProp) {
      const f = S.z / size0.z;
      S.x = size0.x * f;
      S.y = size0.y * f;
    }
  } else {
    const ax = (-h.sx * size0.x) / 2,
      ay = (-h.sy * size0.y) / 2;
    if (h.sx) S.x = Math.max(0.1, snapV(h.sx * (L.x - ax)));
    if (h.sy) S.y = Math.max(0.1, snapV(h.sy * (L.y - ay)));
    if (keepProp) {
      const f = h.sx && h.sy ? Math.max(S.x / size0.x, S.y / size0.y) : h.sx ? S.x / size0.x : S.y / size0.y;
      S.x = size0.x * f;
      S.y = size0.y * f;
      if (!isImage(o)) S.z = size0.z * f;
    }
    if (h.sx) cx = ax + (h.sx * S.x) / 2;
    if (h.sy) cy = ay + (h.sy * S.y) / 2;
  }
  o.mesh.scale.set(S.x / o.baseSize.x, S.y / o.baseSize.y, isImage(o) ? 1 : S.z / o.baseSize.z);
  o.mesh.position.copy(pos0).add(V3(cx, cy, 0).applyQuaternion(q));
  updateInspectorValues();
}

// ================================================================ operacje
const snapV = v => (snap > 0 ? Math.round(v / snap) * snap : v);

function dropToPlane(list = selection) {
  list.forEach(o => {
    const b = worldBox(o);
    o.mesh.position.z = r1(o.mesh.position.z - b.min.z + (isImage(o) ? 0.1 : 0));
  });
}
function deleteList(del) {
  if (!del.length) return;
  setSelection(selection.filter(o => !del.includes(o)));
  del.forEach(removeObject);
  commit();
  toast(del.length === 1 ? 'Usunięto obiekt' : `Usunięto obiekty: ${del.length}`);
}
const deleteSelection = () => deleteList([...selection]);

let clipboard = null;
function copySelection() {
  if (!selection.length) return;
  clipboard = selection.map(serialize);
  updateToolbarState();
  toast(`Skopiowano: ${clipboard.length}`);
}
function pasteFrom(list, offset) {
  if (!list || !list.length) return [];
  const created = list.map(d => {
    const c = structuredClone(d);
    c.id = uid();
    c.pos = [c.pos[0] + offset, c.pos[1] + offset, c.pos[2]];
    return createObject(c);
  });
  setSelection(created);
  commit();
  return created;
}
function paste() {
  if (clipboard) {
    pasteFrom(clipboard, 10);
    clipboard = clipboard.map(d => ({ ...d, pos: [d.pos[0] + 10, d.pos[1] + 10, d.pos[2]] }));
  }
}
function duplicate() {
  if (selection.length) {
    pasteFrom(selection.map(serialize), 0);
    toast('Duplikat jest w tym samym miejscu — przeciągnij go');
  }
}

// dane grupy (operacja logiczna) z listy zserializowanych obiektów
function groupData(children) {
  const worldGeom = csgGroup({ type: 'group', children, frame0: new THREE.Matrix4().toArray() });
  worldGeom.computeBoundingBox();
  const b = worldGeom.boundingBox;
  const offset = V3((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, b.min.z);
  const frame0 = new THREE.Matrix4().makeTranslation(offset.x, offset.y, offset.z).toArray();
  const firstSolid = children.find(c => !c.hole);
  const d = {
    id: uid(),
    type: 'group',
    children,
    frame0,
    pos: offset.toArray(),
    quat: [0, 0, 0, 1],
    hole: !firstSolid,
    color: firstSolid ? firstSolid.color : '#8f9ba8',
    name: tr('Grupa'),
    mirror: [1, 1, 1],
  };
  d.size = geomFor(d).baseSize.toArray();
  return d;
}

function groupSelection() {
  const list = selection.filter(o => !isImage(o));
  if (list.length < 2) {
    toast('Zaznacz co najmniej 2 bryły (Shift+klik lub ramka)');
    return;
  }
  setBusy(true, 'Łączenie brył…');
  setTimeout(() => {
    try {
      const children = list.map(serialize);
      const d = groupData(children);
      const firstSolid = children.find(c => !c.hole);
      setSelection([]);
      list.forEach(removeObject);
      const g = createObject(d);
      setSelection([g]);
      commit();
      toast(children.some(c => c.hole) && firstSolid ? 'Zgrupowano — otwory zostały wycięte' : 'Zgrupowano');
      if (children.some(c => c.hole) && firstSolid) capy?.say('grouped');
    } catch (err) {
      console.error(err);
      toast('Nie udało się połączyć tych brył: ' + err.message, true);
    } finally {
      setBusy(false);
    }
  }, 30);
}

function ungroupSelection() {
  const groups = selection.filter(o => o.type === 'group');
  if (!groups.length) {
    toast('Zaznacz grupę, aby ją rozgrupować');
    return;
  }
  const created = [];
  for (const g of groups) {
    if (deformActive(g.deform)) {
      toast('Najpierw usuń deformację grupy (wyzeruj suwaki)', true);
      continue;
    }
    const mir = g.mirror;
    const unmirrored = geomFor({ ...g, mirror: [1, 1, 1] }).baseSize;
    const S = new THREE.Matrix4()
      .makeTranslation(0, 0, mir[2] < 0 ? unmirrored.z : 0)
      .multiply(new THREE.Matrix4().makeScale(mir[0], mir[1], mir[2]));
    const sz = sizeOf(g);
    const Mg = new THREE.Matrix4().compose(
      g.mesh.position,
      g.mesh.quaternion,
      V3(sz.x / unmirrored.x, sz.y / unmirrored.y, sz.z / unmirrored.z),
    );
    const F = new THREE.Matrix4().fromArray(g.frame0).invert();
    for (const c of g.children) {
      const cd = structuredClone(c);
      const { baseSize } = geomFor(cd);
      const M = Mg.clone().multiply(S).multiply(F).multiply(matrixOf(cd, baseSize));
      const p = V3(),
        q = new THREE.Quaternion(),
        s = V3();
      M.decompose(p, q, s);
      if (s.x < 0) {
        s.x = -s.x;
        cd.mirror = [...(cd.mirror || [1, 1, 1])];
        cd.mirror[0] *= -1;
      }
      cd.pos = p.toArray();
      cd.quat = q.toArray();
      cd.size = [s.x * baseSize.x, s.y * baseSize.y, s.z * baseSize.z];
      cd.id = uid();
      created.push(createObject(cd));
    }
    removeObject(g);
  }
  setSelection(created);
  commit();
  if (created.length) toast('Rozgrupowano');
}

function mirrorSelection(axis) {
  const list = selection.filter(o => !isImage(o));
  if (!list.length) return;
  const ai = { x: 0, y: 1, z: 2 }[axis];
  const worldAxis = V3().setComponent(ai, 1);
  const C = selectionBox(list, true).getCenter(V3());
  for (const o of list) {
    const before = worldBox(o).getCenter(V3());
    let best = 0,
      bestDot = -1;
    for (let i = 0; i < 3; i++) {
      const d = Math.abs(V3().setComponent(i, 1).applyQuaternion(o.mesh.quaternion).dot(worldAxis));
      if (d > bestDot) {
        bestDot = d;
        best = i;
      }
    }
    o.mirror = [...o.mirror];
    o.mirror[best] *= -1;
    rebuildGeometry(o, deformActive(o.deform) ? 'unit' : 'size');
    const after = worldBox(o).getCenter(V3());
    const target = before.clone();
    if (list.length > 1) target.setComponent(ai, 2 * C.getComponent(ai) - before.getComponent(ai));
    o.mesh.position.add(target.sub(after));
  }
  setSelection(selection);
  commit();
}

function align(axis, where) {
  if (selection.length < 2) return;
  const ai = { x: 0, y: 1, z: 2 }[axis];
  const B = selectionBox(selection, true);
  const pick = b =>
    where === 'min'
      ? b.min.getComponent(ai)
      : where === 'max'
        ? b.max.getComponent(ai)
        : (b.min.getComponent(ai) + b.max.getComponent(ai)) / 2;
  const target = pick(B);
  for (const o of selection)
    o.mesh.position.setComponent(ai, o.mesh.position.getComponent(ai) + target - pick(worldBox(o)));
  setSelection(selection);
  commit();
}

function nudge(dx, dy, dz) {
  if (!selection.length) return;
  selection.forEach(o => {
    o.mesh.position.x += dx;
    o.mesh.position.y += dy;
    o.mesh.position.z += dz;
  });
  attachGizmo();
  updateInspectorValues();
  commitDebounced();
}

// ================================================================ historia
function snapshot() {
  return JSON.stringify({ objects: objects.map(serialize), sel: selection.map(o => o.id) });
}
function commit() {
  rebakeDeformed();
  const s = snapshot();
  if (history.length && s === history[history.length - 1]) return;
  history.push(s);
  if (history.length > 200) history.shift();
  future = [];
  if (history.length > 1) setDirty(true);
  updateToolbarState();
  updateCount();
  renderTemplates();
  if (selection.length === 1) updateInspectorValues();
  scheduleAutosave();
  capyCheck();
  checkExercise();
}
let commitTimer = null;
function commitDebounced() {
  clearTimeout(commitTimer);
  commitTimer = setTimeout(commit, 400);
}

function restore(s) {
  const st = JSON.parse(s);
  clearScene();
  const created = st.objects.map(d => createObject(d));
  setSelection(created.filter(o => st.sel.includes(o.id)));
  updateCount();
  renderTemplates();
}
function undo() {
  clearTimeout(commitTimer);
  commit();
  if (history.length < 2) return;
  capy?.say('undo');
  future.push(history.pop());
  restore(history[history.length - 1]);
  setDirty(true);
  updateToolbarState();
}
function redo() {
  if (!future.length) return;
  const s = future.pop();
  history.push(s);
  restore(s);
  setDirty(true);
  updateToolbarState();
}
function resetHistory() {
  history = [];
  future = [];
  commit();
}

// ================================================================ pliki
function collectKeys(list, set = new Set()) {
  for (const d of list) {
    if (d.dataKey) set.add(d.dataKey);
    if (d.children) collectKeys(d.children, set);
  }
  return set;
}
function dataFor(list) {
  const data = {};
  for (const k of collectKeys(list)) if (dataStore.has(k)) data[k] = dataStore.get(k);
  return data;
}
function projectJSON() {
  const objs = objects.map(serialize);
  return JSON.stringify({
    app: APP,
    format: 2,
    name: projectName(),
    workplane: wp,
    objects: objs,
    data: dataFor(objs),
  });
}
function loadProject(text, path, name) {
  let p;
  try {
    p = JSON.parse(text);
  } catch {
    toast('To nie jest poprawny plik projektu', true);
    return false;
  }
  if (!['CappyCad', 'CapyCad', 'BlokCAD'].includes(p.app) || !Array.isArray(p.objects)) {
    toast('To nie jest plik projektu CappyCad', true);
    return false;
  }
  clearScene();
  for (const [k, v] of Object.entries(p.data || p.meshes || {})) dataStore.set(k, v);
  if (p.workplane) {
    wp = { x: p.workplane.x, y: p.workplane.y };
    buildWorkplane();
  }
  setBusy(true, 'Wczytywanie projektu…');
  try {
    p.objects.forEach(d => createObject(d));
  } finally {
    setBusy(false);
  }
  $('#projName').value = p.name || (name || 'Projekt').replace(/\.(cappycad|capycad|blokcad)$/i, '');
  currentPath = path && /\.cappycad$/i.test(path) ? path : null;
  clearMeasures();
  resetHistory();
  setDirty(false);
  markSaved();
  setSelection([]);
  fitView(false);
  return true;
}

const projectName = () => ($('#projName').value || tr('Bez tytułu')).trim();
const safeFileName = s => s.replace(/[\\/:*?"<>|]+/g, '_') || 'projekt';

const trFilters = f => f.map(x => ({ ...x, name: tr(x.name) }));
// Strona w Claude: pobieranie tylko przez okno potwierdzenia i tylko dla wybranych rozszerzeń
let downloadsCap;
function getDownloads() {
  if (downloadsCap === undefined)
    downloadsCap = window.claude?.use ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null);
  return downloadsCap;
}
const ALLOWED_EXT = new Set(['png', 'json', 'zip', 'txt', 'svg', 'csv']);
async function saveFile(name, filters, data) {
  if (api) return await api.saveFile({ defaultPath: name, filters: trFilters(filters), data });
  const dl = await getDownloads();
  if (!dl) {
    downloadBlob(new Blob([data]), name);
    return { path: null, name };
  }
  const ext = (name.split('.').pop() || '').toLowerCase();
  name = asciiName(name);
  let filename = name,
    payload = data instanceof Blob ? data : new Blob([data]),
    zipped = false;
  if (ext === EXT || ext === 'cappylib') filename = name + '.json';
  else if (!ALLOWED_EXT.has(ext)) {
    payload = makeZip([
      {
        name,
        data:
          typeof data === 'string'
            ? data
            : new Uint8Array(
                data.buffer ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data,
              ),
      },
    ]);
    filename = name.replace(/\.[^.]+$/, '') + '-' + ext + '.zip';
    zipped = true;
  }
  try {
    await dl.save({ filename, data: payload });
    return { path: null, name: filename, zipped };
  } catch (err) {
    if (err?.code !== 'declined')
      toast(
        (lang === 'en' ? 'Could not save the file: ' : 'Nie udało się zapisać pliku: ') +
          (err?.message || err?.code || ''),
        true,
      );
    return null;
  }
}

async function saveProject(saveAs = false) {
  const data = projectJSON();
  if (api) {
    const r = await api.saveFile({
      path: saveAs ? null : currentPath,
      defaultPath: safeFileName(projectName()) + '.' + EXT,
      filters: trFilters([{ name: 'Projekt CappyCad', extensions: [EXT] }]),
      data,
    });
    if (!r) return false;
    currentPath = r.path;
  } else if (
    !(await saveFile(safeFileName(projectName()) + '.' + EXT, [{ name: 'Projekt CappyCad', extensions: [EXT] }], data))
  )
    return false;
  setDirty(false);
  clearAutosave();
  markSaved();
  exEvent('saved');
  toast('Projekt zapisany');
  return true;
}
async function openProject() {
  if (!(await confirmDiscard())) return;
  const f = await pickFile(
    [{ name: 'Projekt CappyCad', extensions: [EXT, 'capycad', 'blokcad', 'json'] }],
    false,
    `.${EXT},.capycad,.blokcad,.json`,
  );
  if (f) loadProject(f.data, f.path, f.name);
}
async function newProject() {
  if (!(await confirmDiscard())) return;
  clearScene();
  clearMeasures();
  currentPath = null;
  $('#projName').value = tr('Bez tytułu');
  resetHistory();
  setDirty(false);
  clearAutosave();
  setView('home', false);
}
async function confirmDiscard() {
  if (!dirty || !objects.length) return true;
  const r = await ask('Niezapisane zmiany', 'Bieżący projekt ma niezapisane zmiany. Co chcesz zrobić?', [
    'Zapisz',
    'Nie zapisuj',
    'Anuluj',
  ]);
  if (r === 0) return await saveProject();
  return r === 1;
}
function markSaved() {
  lastSaveAt = Date.now();
}

const placeAt = () => [snapV(orbit.target.x), snapV(orbit.target.y), 0];

// --- import STL / OBJ
async function importModel() {
  const f = await pickFile([{ name: 'Model 3D (STL, OBJ)', extensions: ['stl', 'obj'] }], true, '.stl,.obj');
  if (!f) return;
  setBusy(true, 'Wczytywanie modelu…');
  setTimeout(() => {
    try {
      let g;
      if (/\.obj$/i.test(f.name)) {
        const grp = new OBJLoader().parse(new TextDecoder().decode(f.data));
        grp.updateMatrixWorld(true);
        const arrs = [];
        grp.traverse(m => {
          if (!m.isMesh) return;
          let mg = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
          mg.applyMatrix4(m.matrixWorld);
          arrs.push(mg.getAttribute('position').array);
        });
        const total = arrs.reduce((n, a) => n + a.length, 0);
        if (!total) throw new Error('pusty model');
        const all = new Float32Array(total);
        let off = 0;
        arrs.forEach(a => {
          all.set(a, off);
          off += a.length;
        });
        g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(all, 3));
        g.computeVertexNormals();
      } else {
        g = new STLLoader().parse(f.data.buffer.slice(f.data.byteOffset, f.data.byteOffset + f.data.byteLength));
      }
      g = normalizeGeometry(g);
      const key = 'm' + uid();
      dataStore.set(key, f32ToB64(new Float32Array(g.getAttribute('position').array)));
      const o = createObject({
        type: 'mesh',
        dataKey: key,
        name: f.name.replace(/\.(stl|obj)$/i, ''),
        color: '#868e96',
        pos: placeAt(),
      });
      setSelection([o]);
      commit();
      const s = sizeOf(o);
      toast(`Zaimportowano model (${fmt(s.x)} × ${fmt(s.y)} × ${fmt(s.z)} mm)`);
      fitView();
    } catch (err) {
      console.error(err);
      toast('Nie udało się wczytać modelu: ' + err.message, true);
    } finally {
      setBusy(false);
    }
  }, 30);
}

// --- SVG jako bryła 3D
async function importSVG() {
  const f = await pickFile([{ name: 'Grafika SVG', extensions: ['svg'] }], false, '.svg');
  if (!f) return;
  setBusy(true, 'Zamiana SVG na bryłę…');
  setTimeout(() => {
    try {
      const key = 's' + uid();
      dataStore.set(key, f.data);
      const d = {
        type: 'svg',
        dataKey: key,
        name: f.name.replace(/\.svg$/i, ''),
        color: svgFirstColor(f.data) || '#1098ad',
        pos: placeAt(),
      };
      const { baseSize } = geomFor(d);
      const k = 50 / Math.max(baseSize.x, baseSize.y);
      d.size = [baseSize.x * k, baseSize.y * k, 5];
      const o = createObject(d);
      setSelection([o]);
      commit();
      toast('Wstawiono grafikę SVG jako bryłę (50 mm, grubość 5 mm)');
      fitView();
    } catch (err) {
      console.error(err);
      toast(err.message || 'Nie udało się odczytać pliku SVG', true);
    } finally {
      setBusy(false);
    }
  }, 30);
}

// --- obraz jako szablon
const MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
};
async function importImage() {
  const f = await pickFile(
    [{ name: 'Obraz (PNG, JPG, SVG…)', extensions: Object.keys(MIME) }],
    true,
    Object.keys(MIME)
      .map(e => '.' + e)
      .join(','),
  );
  if (!f) return;
  const ext = (f.name.split('.').pop() || 'png').toLowerCase();
  const url = `data:${MIME[ext] || 'image/png'};base64,${bytesToB64(f.data)}`;
  const img = new Image();
  img.onload = () => {
    const aspect = (img.naturalWidth || 1) / (img.naturalHeight || 1);
    const key = 'i' + uid();
    dataStore.set(key, url);
    let w = wp.x * 0.8,
      h = w / aspect;
    if (h > wp.y * 0.8) {
      h = wp.y * 0.8;
      w = h * aspect;
    }
    const o = createObject({
      type: 'image',
      dataKey: key,
      name: f.name.replace(/\.[^.]+$/, ''),
      params: { opacity: 60, aspect },
      size: [w, h, 0.01],
      pos: [0, 0, 0.1],
    });
    setSelection([o]);
    commit();
    toast('Wstawiono szablon — odrysuj go kształtami lub narzędziem Rysuj. Zablokuj go, by nie przeszkadzał.');
    setTimeout(() => capy?.say('template'), 3200);
  };
  img.onerror = () => toast('Nie udało się odczytać obrazu', true);
  img.src = url;
}

// --- eksport
function exportList() {
  return (selection.length ? selection : objects).filter(o => !o.hole && !isImage(o) && !o.hidden);
}
// Geometria obiektu w układzie świata, oczyszczona przez Manifold (szczelna) — lub surowa, gdy się nie da
function worldGeometry(o) {
  o.mesh.updateMatrixWorld(true);
  const g = o.mesh.geometry.clone();
  g.applyMatrix4(o.mesh.matrixWorld);
  if (o.mesh.matrixWorld.determinant() < 0) swapWinding(g);
  return csg.cleanForExport(g) || g;
}
// STL: wszystkie bryły połączone w jedną szczelną bryłę (bez nachodzących na siebie powłok)
function exportSolid(list) {
  const geoms = list.map(worldGeometry);
  let g = null;
  if (geoms.length > 1) {
    try {
      g = csg.unionStrict(geoms);
    } catch (err) {
      console.warn('Eksport: łączenie brył nie powiodło się', err.message);
    }
  }
  if (!g) g = geoms.length === 1 ? geoms[0] : mergePositions(geoms);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(g));
  root.updateMatrixWorld(true);
  return root;
}
function mergePositions(geoms) {
  const arrs = geoms.map(g => (g.index ? g.toNonIndexed() : g).getAttribute('position').array);
  const all = new Float32Array(arrs.reduce((n, a) => n + a.length, 0));
  let off = 0;
  arrs.forEach(a => {
    all.set(a, off);
    off += a.length;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(all, 3));
  g.computeVertexNormals();
  return g;
}
function exportRoot(list, withColors) {
  const root = new THREE.Group();
  for (const o of list) {
    let g = worldGeometry(o);
    if (withColors) {
      const c = new THREE.Color(o.color),
        n = g.getAttribute('position').count;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        arr[i * 3] = c.r;
        arr[i * 3 + 1] = c.g;
        arr[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    }
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ name: o.name }));
    m.name = o.name.replace(/\s+/g, '_');
    root.add(m);
  }
  root.updateMatrixWorld(true);
  return root;
}
async function exportModel(fmtName) {
  const list = exportList();
  if (!list.length) {
    toast('Brak brył do eksportu (otwory i szablony nie są eksportowane)', true);
    return;
  }
  const base = safeFileName(projectName()) + (selection.length ? '_zaznaczenie' : '');
  let r;
  if (fmtName === 'obj') {
    const text = new OBJExporter().parse(exportRoot(list, true));
    r = await saveFile(
      base + '.obj',
      [{ name: 'Model OBJ', extensions: ['obj'] }],
      `# ${APP} — jednostki: mm, oś Z w górę\n` + text,
    );
  } else {
    setBusy(true, lang === 'en' ? 'Preparing a watertight mesh…' : 'Przygotowanie szczelnej siatki…');
    await new Promise(r => setTimeout(r, 30));
    let dv;
    try {
      dv = new STLExporter().parse(exportSolid(list), { binary: true });
    } finally {
      setBusy(false);
    }
    r = await saveFile(
      base + '.stl',
      [{ name: 'Model STL (druk 3D)', extensions: ['stl'] }],
      new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength),
    );
  }
  if (!r) return;
  if (fmtName === 'stl' && !csg.isSolidReady()) {
    setTimeout(
      () =>
        toast(
          lang === 'en'
            ? 'This browser blocked the watertight-mesh engine. The STL may need “Repair” in your slicer.'
            : 'Ta przeglądarka zablokowała silnik szczelnych brył. Plik STL może wymagać „Napraw” w slicerze.',
          true,
        ),
      3200,
    );
  }
  if (r.zipped)
    setTimeout(
      () =>
        toast(
          lang === 'en'
            ? `Saved as ${r.name} — unzip it before opening in your slicer.`
            : `Zapisano jako ${r.name} — rozpakuj go przed otwarciem w slicerze.`,
        ),
      3200,
    );
  const holes = objects.filter(o => o.hole).length;
  setTimeout(() => capy?.say('exported'), 3000);
  exEvent('exported');
  toast(
    `Wyeksportowano ${fmtName.toUpperCase()} (${list.length} ${list.length === 1 ? 'obiekt' : 'obiekty'})` +
      (holes ? ' — pojedyncze otwory pominięto; zgrupuj je z bryłą, aby wyciąć' : ''),
  );
}
async function exportPNG() {
  const hidden = [tc.getHelper(), handleGroup, rulerGroup, sketchGroup, ...selHelpers.values()].map(o => [
    o,
    o.visible,
  ]);
  hidden.forEach(([o]) => (o.visible = false));
  renderer.render(scene, camera);
  const url = canvas.toDataURL('image/png');
  hidden.forEach(([o, v]) => (o.visible = v));
  const r = await saveFile(
    safeFileName(projectName()) + '.png',
    [{ name: 'Obraz PNG', extensions: ['png'] }],
    b64ToBytes(url.split(',')[1]),
  );
  if (r) toast('Zapisano obraz');
}

// nazwy pobieranych plików bez polskich znaków — przeglądarki potrafią je odrzucić
const asciiName = n =>
  n
    .replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, c => 'acelnoszzACELNOSZZ'['ąćęłńóśźżĄĆĘŁŃÓŚŹŻ'.indexOf(c)])
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/ +/g, '_');
function downloadBlob(blob, name) {
  name = asciiName(name);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
function pickFile(filters, binary, accept) {
  if (api) return api.openFile({ filters: trFilters(filters), binary });
  return new Promise(res => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept;
    inp.onchange = async () => {
      const f = inp.files[0];
      if (!f) return res(null);
      res({ name: f.name, path: null, data: binary ? new Uint8Array(await f.arrayBuffer()) : await f.text() });
    };
    inp.click();
  });
}

// --- autozapis
let autosaveTimer = null;
function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    if (!dirty) return;
    try {
      localStorage.setItem('cappycad-autosave', projectJSON());
    } catch {
      /* brak miejsca */
    }
  }, 1500);
}
function clearAutosave() {
  try {
    localStorage.removeItem('cappycad-autosave');
  } catch {}
}

function setDirty(v) {
  dirty = v;
  document.title = `${projectName()}${dirty ? ' •' : ''} — ${APP}`;
  $('#saveState').textContent = dirty ? 'Niezapisane zmiany' : currentPath ? 'Zapisano' : '';
  $('#saveState').classList.toggle('warn', dirty);
}

// ================================================================ moje kształty (biblioteka)
let library = [];
function loadLibrary() {
  try {
    library = JSON.parse(localStorage.getItem('cappycad-library') || localStorage.getItem('capycad-library') || '[]');
  } catch {
    library = [];
  }
}
function storeLibrary() {
  try {
    localStorage.setItem('cappycad-library', JSON.stringify(library));
    return true;
  } catch {
    toast('Brak miejsca w bibliotece — usuń część kształtów lub wyeksportuj bibliotekę', true);
    return false;
  }
}
async function saveToLibrary() {
  const list = selection.filter(o => !isImage(o));
  if (!list.length) return;
  const name = await prompt(
    'Zapisz jako mój kształt',
    'Nazwa kształtu:',
    list.length === 1 ? list[0].name : 'Mój kształt',
  );
  if (!name) return;
  const objs = list.map(serialize);
  const B = selectionBox(list, true);
  const c = V3((B.min.x + B.max.x) / 2, (B.min.y + B.max.y) / 2, B.min.z);
  objs.forEach(d => {
    d.pos = [d.pos[0] - c.x, d.pos[1] - c.y, d.pos[2] - c.z];
  });
  library.push({ id: uid(), name, objects: objs, data: dataFor(objs) });
  if (storeLibrary()) {
    buildPalette();
    exEvent('library');
    toast(`Dodano „${name}” do Moich kształtów`);
  } else library.pop();
}
function insertFromLibrary(id, at) {
  const item = library.find(l => l.id === id);
  if (!item) return;
  for (const [k, v] of Object.entries(item.data || {})) dataStore.set(k, v);
  const p = at || V3(...placeAt());
  const created = item.objects.map(d => {
    const c = structuredClone(d);
    c.id = uid();
    c.pos = [c.pos[0] + snapV(p.x), c.pos[1] + snapV(p.y), c.pos[2] + Math.max(0, p.z)];
    return createObject(c);
  });
  setSelection(created);
  commit();
}
async function exportLibrary() {
  if (!library.length) {
    toast('Biblioteka jest pusta');
    return;
  }
  const r = await saveFile(
    'moje-ksztalty.cappylib',
    [{ name: 'Biblioteka kształtów CappyCad', extensions: ['cappylib'] }],
    JSON.stringify({ app: APP, library }),
  );
  if (r) toast('Wyeksportowano bibliotekę');
}
async function importLibrary() {
  const f = await pickFile(
    [{ name: 'Biblioteka kształtów CappyCad', extensions: ['cappylib', 'capylib', 'json'] }],
    false,
    '.cappylib,.capylib,.json',
  );
  if (!f) return;
  try {
    const p = JSON.parse(f.data);
    const items = (p.library || []).filter(i => i && Array.isArray(i.objects));
    const ids = new Set(library.map(l => l.id));
    let n = 0;
    items.forEach(i => {
      if (!ids.has(i.id)) {
        library.push(i);
        n++;
      }
    });
    if (storeLibrary()) {
      buildPalette();
      toast(`Dodano kształty: ${n}`);
    }
  } catch {
    toast('To nie jest plik biblioteki CappyCad', true);
  }
}

// ================================================================ widok kamery
let camAnim = null;
function animateCamera(pos, target, animate = true) {
  if (!animate) {
    camera.position.copy(pos);
    orbit.target.copy(target);
    orbit.update();
    return;
  }
  camAnim = {
    p0: camera.position.clone(),
    t0: orbit.target.clone(),
    p1: pos,
    t1: target,
    start: performance.now(),
    dur: 380,
  };
}
const wpBox = (h = 0) => new THREE.Box3(V3(-wp.x / 2, -wp.y / 2, 0), V3(wp.x / 2, wp.y / 2, h));
const sceneBox = () => (objects.length ? selectionBox(objects) : wpBox());
function distanceFor(box) {
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const r = Math.max(sphere.radius, 15);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  return { center: sphere.center, dist: (r / Math.sin(Math.min(fov, fov * camera.aspect) / 2)) * 1.05 };
}
const VIEWS = {
  home: V3(-0.5, -0.78, 0.62),
  top: V3(0, -0.0001, 1),
  front: V3(0, -1, 0.0001),
  back: V3(0, 1, 0.0001),
  left: V3(-1, 0, 0.0001),
  right: V3(1, 0, 0.0001),
};
function setView(name, animate = true) {
  const box = name === 'home' ? wpBox(20).union(objects.length ? sceneBox() : new THREE.Box3()) : sceneBox();
  const { center, dist } = distanceFor(box);
  animateCamera(center.clone().add(VIEWS[name].clone().normalize().multiplyScalar(dist)), center, animate);
}
function fitView(animate = true) {
  const { center, dist } = distanceFor(selection.length ? selectionBox(selection) : sceneBox());
  const dir = camera.position.clone().sub(orbit.target).normalize();
  animateCamera(center.clone().add(dir.multiplyScalar(dist)), center, animate);
}
function zoomBy(f) {
  const dir = camera.position.clone().sub(orbit.target);
  animateCamera(orbit.target.clone().add(dir.multiplyScalar(f)), orbit.target.clone());
}

// ================================================================ mysz — wspólne
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function setRay(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
}
const pickable = () => objects.filter(o => !o.locked && !o.hidden).map(o => o.mesh);
function pick(e, includeLocked = false) {
  setRay(e);
  const hits = raycaster.intersectObjects(
    includeLocked ? objects.filter(o => !o.hidden).map(o => o.mesh) : pickable(),
    false,
  );
  return hits[0] || null;
}
function pointOnSurface(e) {
  const hit = pick(e);
  if (hit && !isImage(hit.object.userData.obj)) return hit.point;
  const p = V3();
  return raycaster.ray.intersectPlane(new THREE.Plane(V3(0, 0, 1), 0), p) ? p : V3();
}
function toScreen(v) {
  const p = v.clone().project(camera);
  const r = canvas.getBoundingClientRect();
  return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height, z: p.z };
}

// ================================================================ narzędzia: miarka
const rulerGroup = new THREE.Group();
scene.add(rulerGroup);
const RCOL = '#e8590c';
let measures = [],
  rStart = null,
  rPreview = null;
const markerMat = new THREE.PointsMaterial({
  color: RCOL,
  size: 9,
  sizeAttenuation: false,
  depthTest: false,
  transparent: true,
});
const hoverMarker = new THREE.Points(
  new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3)),
  new THREE.PointsMaterial({ color: '#1971c2', size: 11, sizeAttenuation: false, depthTest: false, transparent: true }),
);
hoverMarker.renderOrder = 31;
hoverMarker.visible = false;
rulerGroup.add(hoverMarker);

function makeMeasureVisual(a, b) {
  const g = new THREE.BufferGeometry().setFromPoints([a, b]);
  const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: RCOL, depthTest: false, transparent: true }));
  line.renderOrder = 30;
  const pts = new THREE.Points(new THREE.BufferGeometry().setFromPoints([a, b]), markerMat);
  pts.renderOrder = 31;
  const grp = new THREE.Group();
  grp.add(line, pts);
  rulerGroup.add(grp);
  const label = document.createElement('div');
  label.className = 'measure';
  viewport.appendChild(label);
  return { grp, label };
}
function updateMeasureVisual(m) {
  m.grp.children[0].geometry.setFromPoints([m.a, m.b]);
  m.grp.children[1].geometry.setFromPoints([m.a, m.b]);
  const d = m.b.clone().sub(m.a);
  m.label.innerHTML =
    `<b>${fmt(d.length())} mm</b><small>X ${fmt(Math.abs(d.x))} · Y ${fmt(Math.abs(d.y))} · Z ${fmt(Math.abs(d.z))}</small>` +
    (m.preview ? '' : '<button title="Usuń pomiar">×</button>');
  const btn = m.label.querySelector('button');
  if (btn) btn.onclick = () => removeMeasure(m);
}
function removeMeasure(m) {
  rulerGroup.remove(m.grp);
  m.label.remove();
  measures = measures.filter(x => x !== m);
}
function clearMeasures() {
  [...measures].forEach(removeMeasure);
  if (rPreview) {
    removeMeasure(rPreview);
    rPreview = null;
  }
  rStart = null;
}
function rulerPoint(e) {
  const hit = pick(e, true);
  const mouse = { x: e.clientX, y: e.clientY };
  let p,
    snapped = false;
  if (hit && !isImage(hit.object.userData.obj)) {
    const o = hit.object,
      pos = o.geometry.getAttribute('position');
    let best = null,
      bd = 14;
    for (const i of [hit.face.a, hit.face.b, hit.face.c]) {
      const v = V3().fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const s = toScreen(v),
        d = Math.hypot(s.x - mouse.x, s.y - mouse.y);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    p = best || hit.point.clone();
    snapped = !!best;
  } else {
    p = V3();
    if (!raycaster.ray.intersectPlane(new THREE.Plane(V3(0, 0, 1), 0), p)) return null;
    p.x = snapV(p.x);
    p.y = snapV(p.y);
  }
  if (rStart && e.shiftKey) {
    const d = p.clone().sub(rStart);
    const ax =
      Math.abs(d.x) >= Math.abs(d.y) && Math.abs(d.x) >= Math.abs(d.z)
        ? 'x'
        : Math.abs(d.y) >= Math.abs(d.z)
          ? 'y'
          : 'z';
    p = rStart.clone();
    p[ax] += d[ax];
  }
  return { p, snapped };
}
function rulerMove(e) {
  const r = rulerPoint(e);
  hoverMarker.visible = !!r;
  if (!r) return;
  hoverMarker.geometry.attributes.position.setXYZ(0, r.p.x, r.p.y, r.p.z);
  hoverMarker.geometry.attributes.position.needsUpdate = true;
  hoverMarker.material.color.set(r.snapped ? '#2b8a3e' : '#1971c2');
  if (rStart) {
    if (!rPreview) {
      rPreview = { a: rStart.clone(), b: r.p.clone(), preview: true, ...makeMeasureVisual(rStart, r.p) };
    }
    rPreview.b.copy(r.p);
    updateMeasureVisual(rPreview);
  }
}
function rulerClick(e) {
  const r = rulerPoint(e);
  if (!r) return;
  if (!rStart) {
    rStart = r.p.clone();
    return;
  }
  if (rPreview) {
    removeMeasure(rPreview);
    rPreview = null;
  }
  const m = { a: rStart.clone(), b: r.p.clone(), ...makeMeasureVisual(rStart, r.p) };
  measures.push(m);
  updateMeasureVisual(m);
  exEvent('measured');
  rStart = null;
}

// ================================================================ narzędzia: rysowanie własnego kształtu
const sketchGroup = new THREE.Group();
scene.add(sketchGroup);
let sk = null; // { z, pts: [Vector3] }
const sketchLine = new THREE.Line(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: '#2b8a3e', depthTest: false, transparent: true }),
);
const sketchPts = new THREE.Points(
  new THREE.BufferGeometry(),
  new THREE.PointsMaterial({ color: '#2b8a3e', size: 9, sizeAttenuation: false, depthTest: false, transparent: true }),
);
sketchLine.renderOrder = 30;
sketchPts.renderOrder = 31;
sketchGroup.add(sketchLine, sketchPts);

function sketchPoint(e) {
  setRay(e);
  let z = sk ? sk.z : 0;
  if (!sk) {
    const hit = pick(e);
    if (
      hit &&
      !isImage(hit.object.userData.obj) &&
      hit.face &&
      Math.abs(hit.face.normal.clone().transformDirection(hit.object.matrixWorld).z) > 0.95
    )
      z = hit.point.z;
  }
  const p = V3();
  if (!raycaster.ray.intersectPlane(new THREE.Plane(V3(0, 0, 1), -z), p)) return null;
  p.x = snapV(p.x);
  p.y = snapV(p.y);
  p.z = z;
  return p;
}
function updateSketchVisual(cursor) {
  const pts = sk ? [...sk.pts] : [];
  if (cursor && sk) pts.push(cursor);
  if (sk && sk.pts.length >= 3 && cursor && cursor.distanceTo(sk.pts[0]) < 0.01) pts.push(sk.pts[0]);
  sketchLine.geometry.dispose();
  sketchLine.geometry = new THREE.BufferGeometry().setFromPoints(pts.length ? pts : [V3()]);
  sketchPts.geometry.dispose();
  sketchPts.geometry = new THREE.BufferGeometry().setFromPoints(
    sk && sk.pts.length ? sk.pts : cursor ? [cursor] : [V3()],
  );
  sketchGroup.visible = tool === 'sketch';
  updateBanner();
}
function sketchClick(e) {
  const p = sketchPoint(e);
  if (!p) return;
  if (!sk) sk = { z: p.z, pts: [] };
  // klik w pierwszy punkt = zamknięcie
  if (sk.pts.length >= 3) {
    const s0 = toScreen(sk.pts[0]);
    if (Math.hypot(s0.x - e.clientX, s0.y - e.clientY) < 12) {
      finishSketch();
      return;
    }
  }
  const last = sk.pts[sk.pts.length - 1];
  if (!last || last.distanceTo(p) > 1e-6) sk.pts.push(p);
  updateSketchVisual(p);
}
function finishSketch() {
  if (!sk || sk.pts.length < 3) {
    toast('Postaw co najmniej 3 punkty');
    return;
  }
  const xs = sk.pts.map(p => p.x),
    ys = sk.pts.map(p => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2,
    cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const params = { smooth: 'no', pts: sk.pts.map(p => [r1(p.x - cx), r1(p.y - cy)]) };
  const z = sk.z;
  sk = null;
  updateSketchVisual(null);
  setTool('select');
  try {
    const d = { type: 'sketch', params, pos: [cx, cy, z], color: SHAPES.sketch.color, name: tr('Mój rysunek') };
    const { baseSize } = geomFor(d);
    d.size = [baseSize.x, baseSize.y, 10];
    const o = createObject(d);
    setSelection([o]);
    commit();
    toast('Gotowe! Zmień wysokość uchwytem u góry lub w panelu.');
  } catch (err) {
    toast('Nie udało się utworzyć kształtu (czy linie się nie przecinają?)', true);
  }
}

function setTool(t) {
  if (tool === 'sketch' && t !== 'sketch') {
    sk = null;
    updateSketchVisual(null);
  }
  if (tool === 'ruler' && t !== 'ruler') {
    if (rPreview) {
      removeMeasure(rPreview);
      rPreview = null;
    }
    rStart = null;
    hoverMarker.visible = false;
  }
  tool = t;
  if (t === 'ruler') capy?.say('ruler');
  if (t === 'sketch') capy?.say('sketch');
  $('#bRuler').classList.toggle('on', t === 'ruler');
  $('#bSketch').classList.toggle('on', t === 'sketch');
  canvas.style.cursor = t === 'select' ? 'default' : 'crosshair';
  sketchGroup.visible = t === 'sketch';
  attachGizmo();
  updateBanner();
}
function updateBanner() {
  const b = $('#toolBanner');
  if (tool === 'ruler') {
    b.innerHTML = `<b>Miarka</b> — kliknij dwa punkty (przyciąga do wierzchołków). <kbd>Shift</kbd> — wzdłuż osi. <kbd>Esc</kbd> — koniec.
      <button class="link" id="tbClear">Wyczyść pomiary</button><button class="btn sm" id="tbDone">Zakończ</button>`;
    $('#tbClear').onclick = clearMeasures;
  } else if (tool === 'sketch') {
    const n = sk ? sk.pts.length : 0;
    b.innerHTML = `<b>Rysuj kształt</b> — klikaj kolejne punkty (${n}). Zamknij klikając pierwszy punkt, dwuklikiem lub <kbd>Enter</kbd>. <kbd>Backspace</kbd> — cofnij punkt.
      <button class="btn sm primary" id="tbFinish" ${n < 3 ? 'disabled' : ''}>Utwórz bryłę</button><button class="btn sm" id="tbDone">Anuluj</button>`;
    $('#tbFinish').onclick = finishSketch;
  } else {
    b.classList.remove('show');
    return;
  }
  b.classList.add('show');
  $('#tbDone').onclick = () => setTool('select');
}

// ================================================================ mysz — zaznaczanie i przesuwanie
let drag = null,
  marquee = null,
  hovered = null;
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  canvas.focus();
  if (e.button !== 0) return;
  if (tool === 'ruler') {
    rulerClick(e);
    return;
  }
  if (tool === 'sketch') {
    sketchClick(e);
    return;
  }
  if (tc.dragging || tc.axis) return;
  const hit = pick(e);
  if (e.pointerType === 'touch' && !hit) {
    if (!e.shiftKey) setSelection([]);
    return;
  } // pusty obszar: obrót widoku palcem
  if (hit) {
    if (e.pointerType === 'touch') orbit.enabled = false;
    let o = hit.object.userData.obj;
    if (e.shiftKey || e.ctrlKey) {
      toggleSelect(o);
      return;
    }
    if (!selection.includes(o)) setSelection([o]);
    if (e.altKey) {
      const idx = selection.indexOf(o);
      o = pasteFrom(selection.map(serialize), 0)[idx];
    }
    drag = {
      plane: new THREE.Plane(V3(0, 0, 1), -hit.point.z),
      start: hit.point.clone(),
      startPos: selection.map(s => s.mesh.position.clone()),
      moved: false,
    };
    tc.detach();
    canvas.setPointerCapture(e.pointerId);
  } else {
    if (!e.shiftKey && !e.ctrlKey) setSelection([]);
    marquee = { x0: e.clientX, y0: e.clientY, add: e.shiftKey || e.ctrlKey };
    canvas.setPointerCapture(e.pointerId);
  }
});
canvas.addEventListener('pointermove', e => {
  if (hdrag) {
    moveHandle(e);
    return;
  }
  if (tool === 'ruler') {
    rulerMove(e);
    return;
  }
  if (tool === 'sketch') {
    updateSketchVisual(sketchPoint(e));
    return;
  }
  if (drag) {
    setRay(e);
    const p = V3();
    if (!raycaster.ray.intersectPlane(drag.plane, p)) return;
    const dx = snapV(p.x - drag.start.x),
      dy = snapV(p.y - drag.start.y);
    if (Math.abs(dx) > 1e-9 || Math.abs(dy) > 1e-9) drag.moved = true;
    selection.forEach((o, i) =>
      o.mesh.position.set(drag.startPos[i].x + dx, drag.startPos[i].y + dy, drag.startPos[i].z),
    );
    updateInspectorValues();
    return;
  }
  if (marquee) {
    const m = $('#marquee');
    const x = Math.min(e.clientX, marquee.x0),
      y = Math.min(e.clientY, marquee.y0);
    const w = Math.abs(e.clientX - marquee.x0),
      h = Math.abs(e.clientY - marquee.y0);
    const vr = viewport.getBoundingClientRect();
    if (w + h > 6)
      Object.assign(m.style, {
        display: 'block',
        left: x - vr.left + 'px',
        top: y - vr.top + 'px',
        width: w + 'px',
        height: h + 'px',
      });
    return;
  }
  if (e.buttons === 0) {
    const hh = pickHandle(e);
    if (hh) {
      canvas.style.cursor = hh.top ? 'ns-resize' : hh.sx && hh.sy ? 'nwse-resize' : 'ew-resize';
      setHover(null);
      return;
    }
    const hit = tc.axis ? null : pick(e);
    setHover(hit ? hit.object.userData.obj : null);
    canvas.style.cursor = hovered ? 'move' : 'default';
  }
});
function setHover(o) {
  if (o === hovered) return;
  if (hovered && hovered.mesh.material.emissive && hovered.mesh.material !== holeMaterial)
    hovered.mesh.material.emissive.set('#000000');
  hovered = o;
  if (hovered && hovered.mesh.material.emissive && hovered.mesh.material !== holeMaterial)
    hovered.mesh.material.emissive.set('#1c2a3a');
}
canvas.addEventListener('pointerup', e => {
  if (hdrag) {
    hdrag = null;
    orbit.enabled = true;
    commit();
    attachGizmo();
    return;
  }
  if (e.pointerType === 'touch') orbit.enabled = true;
  if (drag) {
    const moved = drag.moved;
    drag = null;
    if (moved) commit();
    attachGizmo();
  }
  if (marquee) {
    const w = Math.abs(e.clientX - marquee.x0),
      h = Math.abs(e.clientY - marquee.y0);
    if (w + h > 6) {
      const x0 = Math.min(e.clientX, marquee.x0),
        x1 = Math.max(e.clientX, marquee.x0);
      const y0 = Math.min(e.clientY, marquee.y0),
        y1 = Math.max(e.clientY, marquee.y0);
      const inside = objects.filter(o => {
        if (o.locked || o.hidden) return false;
        const s = toScreen(worldBox(o, false).getCenter(V3()));
        return s.z < 1 && s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1;
      });
      setSelection(marquee.add ? [...selection, ...inside] : inside);
    }
    $('#marquee').style.display = 'none';
    marquee = null;
  }
});
canvas.addEventListener('dblclick', e => {
  if (tool === 'sketch') {
    if (sk && sk.pts.length >= 3) finishSketch();
    return;
  }
  if (tool !== 'select') return;
  const hit = pick(e);
  if (hit) {
    setSelection([hit.object.userData.obj]);
    fitView();
  }
});

// przeciąganie kształtów z palety
viewport.addEventListener('dragover', e => {
  if (e.dataTransfer.types.includes('text/cappycad')) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
});
viewport.addEventListener('drop', e => {
  const t = e.dataTransfer.getData('text/cappycad');
  if (!t) return;
  e.preventDefault();
  const p = pointOnSurface(e);
  const at = V3(p.x, p.y, Math.max(0, r1(p.z)));
  const [kind, id] = t.split('|');
  if (kind === 'lib') insertFromLibrary(id, at);
  else addTile(+id, at);
});

// ================================================================ klawiatura
window.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  if ($('#modal').classList.contains('open')) {
    if (e.key === 'Escape') closeModal();
    return;
  }
  const ctrl = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (tool === 'sketch') {
    if (e.key === 'Escape') setTool('select');
    else if (e.key === 'Enter') finishSketch();
    else if (e.key === 'Backspace' && sk) {
      sk.pts.pop();
      updateSketchVisual(null);
    }
    return;
  }
  if (tool === 'ruler' && e.key === 'Escape') {
    if (rStart) {
      rStart = null;
      if (rPreview) {
        removeMeasure(rPreview);
        rPreview = null;
      }
    } else setTool('select');
    return;
  }
  const step = (e.shiftKey ? 10 : 1) * (snap > 0 ? snap : 1);
  if (ctrl) {
    const acts = {
      z: () => (e.shiftKey ? redo() : undo()),
      y: redo,
      c: copySelection,
      v: paste,
      d: duplicate,
      a: () => setSelection(objects.filter(o => !o.locked && !o.hidden)),
      g: () => (e.shiftKey ? ungroupSelection() : groupSelection()),
      s: () => saveProject(e.shiftKey),
      o: openProject,
      n: newProject,
      e: () => exportModel('stl'),
      arrowup: () => nudge(0, 0, step),
      arrowdown: () => nudge(0, 0, -step),
    };
    if (acts[k]) {
      e.preventDefault();
      acts[k]();
    }
    return;
  }
  switch (e.key) {
    case 'Delete':
    case 'Backspace':
      deleteSelection();
      return;
    case 'Escape':
      setSelection([]);
      return;
    case 'ArrowLeft':
      e.preventDefault();
      nudge(-step, 0, 0);
      return;
    case 'ArrowRight':
      e.preventDefault();
      nudge(step, 0, 0);
      return;
    case 'ArrowUp':
      e.preventDefault();
      nudge(0, step, 0);
      return;
    case 'ArrowDown':
      e.preventDefault();
      nudge(0, -step, 0);
      return;
    case 'F1':
      e.preventDefault();
      showHelp();
      return;
  }
  if (k === 'd' && selection.length) {
    dropToPlane();
    attachGizmo();
    updateInspectorValues();
    commit();
  } else if (k === 'h' && selection.length) {
    const h = !selection.every(o => o.hole);
    selection.forEach(o => setHole(o, h));
    renderInspector();
    commit();
  } else if (k === 'm') setGizmoMode('translate');
  else if (k === 'r') setGizmoMode('rotate');
  else if (k === 's') setGizmoMode('scale');
  else if (k === 'q') setGizmoMode('none');
  else if (k === 'l') setTool('ruler');
  else if (k === 'p') setTool('sketch');
  else if (k === 'f') fitView();
  else if (k === 'i' && selection.length) setInspCollapsed(!inspCollapsed);
  else if (k === 't') setTheme(effectiveTheme() === 'dark' ? 'light' : 'dark');
});

function setGizmoMode(m) {
  gizmoMode = m;
  $$('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  if (tool !== 'select') setTool('select');
  attachGizmo();
}

// ================================================================ inspektor
const SWATCHES = [
  '#e5484d',
  '#f08c00',
  '#fab005',
  '#37b24d',
  '#0ca678',
  '#1098ad',
  '#1c7ed6',
  '#4263eb',
  '#7048e8',
  '#ae3ec9',
  '#d6336c',
  '#a87444',
  '#f8f9fa',
  '#adb5bd',
  '#495057',
  '#212529',
];
const numField = (label, f, i) =>
  `<label class="nf"><span class="ax ax${i}">${label}</span><input type="text" inputmode="decimal" data-f="${f}" data-i="${i}"></label>`;
const esc = s =>
  String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function paramField(k, p, v) {
  if (p.type === 'text')
    return `<label class="pf wide"><span>${p.label}</span><input type="text" data-p="${k}" value="${esc(v)}"></label>`;
  if (p.type === 'select')
    return `<label class="pf wide"><span>${p.label}</span><select data-p="${k}">${p.options.map(([val, lab]) => `<option value="${val}" ${val === v ? 'selected' : ''}>${lab}</option>`).join('')}</select></label>`;
  if (p.type === 'num')
    return `<label class="pf"><span>${p.label}</span><input type="number" data-p="${k}" min="${p.min}" max="${p.max}" step="${p.step}" value="${v}"></label>`;
  return `<label class="pf"><span>${p.label}</span><input type="range" data-p="${k}" min="${p.min}" max="${p.max}" value="${v}"><output>${v}</output></label>`;
}
function deformField(k, label, min, max, step, v, unit) {
  return `<label class="pf"><span>${label}</span><input type="range" data-d="${k}" min="${min}" max="${max}" step="${step}" value="${v}"><output>${v}${unit}</output></label>`;
}

// --- zwijany panel obiektu (stan zapamiętany między zaznaczeniami i uruchomieniami)
let inspCollapsed = false;
try {
  inspCollapsed = localStorage.getItem('cappycad-insp-collapsed') === '1';
} catch {}
function setInspCollapsed(v, animate = true) {
  inspCollapsed = v;
  try {
    localStorage.setItem('cappycad-insp-collapsed', v ? '1' : '0');
  } catch {}
  const el = $('#inspector');
  el.classList.remove('anim-in');
  if (!v && animate) {
    void el.offsetWidth;
    el.classList.add('anim-in');
  }
  updateInspVisibility();
}
function updateInspVisibility() {
  const has = selection.length > 0;
  $('#inspector').classList.toggle('show', has && !inspCollapsed);
  const tab = $('#inspTab');
  tab.classList.toggle('show', has && inspCollapsed);
  if (has)
    tab.querySelector('.tab-name').textContent =
      selection.length > 1
        ? lang === 'en'
          ? `Selected: ${selection.length}`
          : `Zaznaczono: ${selection.length}`
        : selection[0].name;
}
// przeciąganie: uchwyt w lewo = rozwiń, lewa krawędź panelu w prawo = zwiń
function dragToggle(handle, dir, onDone) {
  handle.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const x0 = e.clientX,
      target = dir < 0 ? handle : $('#inspector');
    let moved = 0;
    handle.setPointerCapture(e.pointerId);
    const move = ev => {
      moved = ev.clientX - x0;
      const d = dir < 0 ? Math.min(0, moved) : Math.max(0, moved);
      target.style.transform = `translateX(${d}px)`;
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      target.style.transform = '';
      onDone(Math.abs(moved) < 4 ? 'click' : (dir < 0 ? moved < -30 : moved > 50) ? 'drag' : 'none');
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  });
}
dragToggle($('#inspTab'), -1, r => {
  if (r !== 'none') setInspCollapsed(false);
});

function renderInspector() {
  const el = $('#inspector');
  updateInspVisibility();
  if (!selection.length) {
    el.innerHTML = '';
    return;
  }
  const multi = selection.length > 1;
  const o = selection[0];
  const img = !multi && isImage(o);
  const allHole = selection.every(x => x.hole),
    anyHole = selection.some(x => x.hole);
  const def = SHAPES[o.type] || { params: {} };
  let h = `<div class="insp-head">${multi ? `<b>Zaznaczono: ${selection.length}</b>` : `<input id="objName" value="${esc(o.name)}" title="Nazwa obiektu"><span class="tag">${def.label}</span>`}
    <button class="icon-btn" id="inspCollapse" title="Zwiń panel (I)">›</button><button class="icon-btn" id="inspClose" title="Odznacz (Esc)">×</button></div>
    <div class="insp-grip" title="Przeciągnij w prawo, aby zwinąć panel"></div>`;
  if (!img) {
    h += `<div class="seg wide" id="holeSeg">
      <button data-hole="0" class="${!anyHole ? 'on' : ''}"><span class="dot solid"></span>Bryła</button>
      <button data-hole="1" class="${allHole ? 'on' : ''}"><span class="dot hole"></span>Otwór</button></div>
      <div class="sw-row ${allHole ? 'disabled' : ''}">${SWATCHES.map(c => `<button class="sw" style="--c:${c}" data-c="${c}" title="${c}"></button>`).join('')}
      <label class="sw custom" title="Własny kolor"><input type="color" id="colorPick" value="${o.color}"></label></div>`;
  }
  if (!multi) {
    h += `<h4>Położenie <small>(środek podstawy, mm)</small></h4><div class="row3">${numField('X', 'pos', 0)}${numField('Y', 'pos', 1)}${numField('Z', 'pos', 2)}</div>`;
    h += `<h4>Wymiary <small>(mm)</small>${img ? '' : '<label class="lock"><input type="checkbox" id="lockProp"> proporcje</label>'}</h4>
      <div class="${img ? 'row2 tight' : 'row3'}">${numField('Szer', 'size', 0)}${numField('Głęb', 'size', 1)}${img ? '' : numField('Wys', 'size', 2)}</div>`;
    h += `<h4>Obrót <small>(°)</small></h4><div class="row3">${numField('X', 'rot', 0)}${numField('Y', 'rot', 1)}${numField('Z', 'rot', 2)}</div>`;
    const params = Object.entries(def.params || {});
    if (params.length) {
      h += `<h4>${img ? 'Szablon' : 'Parametry kształtu'}</h4><div class="params">${params.map(([k, p]) => paramField(k, p, o.params[k] ?? p.def)).join('')}</div>`;
    }
    if (def.real)
      h += `<p class="note">Wymiary według normy ISO. Zmieniaj rozmiar parametrem, a nie skalowaniem — inaczej gwint i otwory przestaną pasować.</p>`;
    if (img) {
      h += `<div class="row2"><button class="btn" id="imgVert">${ICONS.rotate}${Math.abs(new THREE.Euler().setFromQuaternion(o.mesh.quaternion).x) > 0.1 ? 'Połóż poziomo' : 'Ustaw pionowo'}</button>
        <button class="btn" id="imgLock">${ICONS.lock}Zablokuj</button></div>
        <p class="note">Szablon nie jest eksportowany. Zablokowany szablon nie daje się zaznaczyć — odblokujesz go w panelu „Szablony”.</p>`;
    }
    if (o.type === 'group')
      h += `<p class="note">Grupa z ${o.children.length} elementów. Rozgrupuj (Ctrl+Shift+G), aby edytować części.</p>`;
    if (!img) {
      const d = o.deform || {};
      h += `<details class="deform" ${deformActive(o.deform) ? 'open' : ''}><summary>Wyginanie i deformacje</summary>
        ${deformField('bend', 'Wygięcie', -360, 360, 5, d.bend || 0, '°')}
        <div class="pf wide"><span>Oś wygięcia</span><div class="seg mini" id="bendAxis"><button data-ax="x" class="${(d.axis || 'x') === 'x' ? 'on' : ''}">wzdłuż X</button><button data-ax="y" class="${d.axis === 'y' ? 'on' : ''}">wzdłuż Y</button></div></div>
        ${deformField('twist', 'Skręcenie', -720, 720, 5, d.twist || 0, '°')}
        ${deformField('taper', 'Zwężenie ku górze', -100, 95, 5, d.taper || 0, '%')}
        <button class="link" id="deformReset">Wyzeruj deformacje</button></details>`;
    }
  } else {
    h += `<h4>Wyrównaj</h4>
      <div class="align-grid">
        <span>X</span><button data-al="x|min" title="Do lewej">◧</button><button data-al="x|mid" title="Środek X">◫</button><button data-al="x|max" title="Do prawej">◨</button>
        <span>Y</span><button data-al="y|min" title="Do przodu">⬓</button><button data-al="y|mid" title="Środek Y">◫</button><button data-al="y|max" title="Do tyłu">⬒</button>
        <span>Z</span><button data-al="z|min" title="Do dołu">▁</button><button data-al="z|mid" title="Środek Z">▬</button><button data-al="z|max" title="Do góry">▔</button>
      </div>
      <button class="btn primary block" id="inspGroup">${ICONS.group}Grupuj (Ctrl+G)</button>`;
  }
  if (!img) {
    h += `<h4>Odbij lustrzanie</h4><div class="row3 mirror-row">
      <button class="btn" data-mir="x">${ICONS.mirror} X</button><button class="btn" data-mir="y">${ICONS.mirror} Y</button><button class="btn" data-mir="z">${ICONS.mirror} Z</button></div>
      <button class="btn block" id="inspLib">${ICONS.star}Zapisz jako mój kształt</button>`;
  }
  h += `<div class="row2"><button class="btn" id="inspDrop">${ICONS.drop}Połóż na płaszczyźnie</button><button class="btn danger" id="inspDel">${ICONS.trash}Usuń</button></div>`;
  el.innerHTML = h;

  $('#inspClose').onclick = () => setSelection([]);
  $('#inspCollapse').onclick = () => setInspCollapsed(true);
  dragToggle($('#inspector .insp-grip'), 1, r => {
    if (r === 'drag') setInspCollapsed(true);
  });
  $('#objName')?.addEventListener('change', e => {
    o.name = e.target.value || def.label;
    commit();
    renderTemplates();
  });
  $$('#holeSeg button').forEach(
    b =>
      (b.onclick = () => {
        selection.forEach(x => setHole(x, b.dataset.hole === '1'));
        renderInspector();
        commit();
      }),
  );
  $$('.sw[data-c]').forEach(
    b =>
      (b.onclick = () => {
        selection.forEach(x => {
          setHole(x, false);
          setColor(x, b.dataset.c);
        });
        renderInspector();
        commit();
      }),
  );
  $('#colorPick')?.addEventListener('input', e =>
    selection.forEach(x => {
      setHole(x, false);
      setColor(x, e.target.value);
    }),
  );
  $('#colorPick')?.addEventListener('change', () => {
    renderInspector();
    commit();
  });
  $$('[data-mir]').forEach(b => (b.onclick = () => mirrorSelection(b.dataset.mir)));
  $$('[data-al]').forEach(
    b =>
      (b.onclick = () => {
        const [a, w] = b.dataset.al.split('|');
        align(a, w);
      }),
  );
  $('#inspGroup')?.addEventListener('click', groupSelection);
  $('#inspLib')?.addEventListener('click', saveToLibrary);
  $('#inspDrop').onclick = () => {
    dropToPlane();
    attachGizmo();
    updateInspectorValues();
    commit();
  };
  $('#inspDel').onclick = deleteSelection;
  $('#imgVert')?.addEventListener('click', () => {
    const e = new THREE.Euler().setFromQuaternion(o.mesh.quaternion);
    o.mesh.quaternion.setFromEuler(new THREE.Euler(Math.abs(e.x) > 0.1 ? 0 : Math.PI / 2, 0, e.z));
    dropToPlane([o]);
    attachGizmo();
    renderInspector();
    commit();
  });
  $('#imgLock')?.addEventListener('click', () => {
    o.locked = true;
    setSelection([]);
    commit();
    toast('Szablon zablokowany — odblokujesz go w panelu Szablony');
  });
  $$('#inspector input[data-f]').forEach(inp => {
    inp.addEventListener('change', () => applyField(inp));
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') inp.blur();
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const st = (inp.dataset.f === 'rot' ? angleSnap || 1 : snap || 1) * (e.shiftKey ? 10 : 1);
        inp.value = fmt(parseNum(inp.value) + (e.key === 'ArrowUp' ? st : -st));
        applyField(inp);
      }
    });
    inp.addEventListener('focus', () => inp.select());
  });
  $$('#inspector [data-p]').forEach(inp => {
    const key = inp.dataset.p,
      p = def.params[key];
    const apply = () => {
      let v = inp.value;
      if (p.type === 'num') {
        v = Math.min(p.max, Math.max(p.min, parseNum(v) || 0));
        inp.value = v;
      } else if (!p.type) v = Number(v);
      o.params = { ...o.params, [key]: v };
      if (img && key === 'opacity') {
        o.mesh.material.opacity = v / 100;
        return;
      }
      setBusy(true, 'Przeliczanie kształtu…');
      try {
        rebuildGeometry(o, deformActive(o.deform) ? 'unit' : def.keepScale || def.real ? 'scale' : 'size');
        if (def.real && key === 'size')
          o.name = tr(def.label) + ' ' + String(v).replace('_', lang === 'en' ? '.' : ',');
      } catch (err) {
        toast('Nie udało się przeliczyć kształtu: ' + err.message, true);
      } finally {
        setBusy(false);
      }
      setSelection(selection);
    };
    if (inp.type === 'range') {
      inp.addEventListener('input', () => {
        inp.nextElementSibling.textContent = inp.value;
        if (img) apply();
      });
      inp.addEventListener('change', () => {
        apply();
        commit();
      });
    } else
      inp.addEventListener('change', () => {
        apply();
        commit();
      });
  });
  // deformacje — podgląd na żywo
  let defTimer = null;
  const readDeform = () => {
    const d = { axis: $('#bendAxis .on')?.dataset.ax || 'x' };
    $$('#inspector [data-d]').forEach(i => {
      d[i.dataset.d] = Number(i.value);
    });
    return d;
  };
  $$('#inspector [data-d]').forEach(inp => {
    const unit = inp.dataset.d === 'taper' ? '%' : '°';
    inp.addEventListener('input', () => {
      inp.nextElementSibling.textContent = inp.value + unit;
      clearTimeout(defTimer);
      defTimer = setTimeout(() => {
        setDeform(o, readDeform());
        refreshSelVisual();
        updateInspectorValues();
      }, 40);
    });
    inp.addEventListener('change', () => {
      clearTimeout(defTimer);
      setDeform(o, readDeform());
      refreshSelVisual();
      commit();
    });
  });
  $$('#bendAxis button').forEach(
    b =>
      (b.onclick = () => {
        $$('#bendAxis button').forEach(x => x.classList.toggle('on', x === b));
        if (deformActive(o.deform)) {
          setDeform(o, readDeform());
          refreshSelVisual();
          commit();
        }
      }),
  );
  $('#deformReset')?.addEventListener('click', () => {
    setDeform(o, null);
    renderInspector();
    refreshSelVisual();
    commit();
  });
  updateInspectorValues();
}
function refreshSelVisual() {
  attachGizmo();
}

function applyField(inp) {
  const o = selection[0];
  if (!o) return;
  const v = parseNum(inp.value);
  if (!isFinite(v)) {
    updateInspectorValues();
    return;
  }
  const ax = ['x', 'y', 'z'][+inp.dataset.i];
  if (inp.dataset.f === 'pos') o.mesh.position[ax] = v;
  else if (inp.dataset.f === 'size') {
    const s = sizeOf(o),
      nv = Math.max(0.1, v);
    if ($('#lockProp')?.checked || isImage(o)) {
      const f = nv / s[ax];
      s.x *= f;
      s.y *= f;
      if (!isImage(o)) s.z *= f;
    } else s[ax] = nv;
    o.mesh.scale.set(s.x / o.baseSize.x, s.y / o.baseSize.y, isImage(o) ? 1 : s.z / o.baseSize.z);
  } else if (inp.dataset.f === 'rot') {
    const e = new THREE.Euler().setFromQuaternion(o.mesh.quaternion, 'XYZ');
    e[ax] = THREE.MathUtils.degToRad(v);
    o.mesh.quaternion.setFromEuler(e);
  }
  attachGizmo();
  updateInspectorValues();
  commit();
}

function updateInspectorValues() {
  if (selection.length !== 1) return;
  const o = selection[0];
  const s = sizeOf(o);
  const e = new THREE.Euler().setFromQuaternion(o.mesh.quaternion, 'XYZ');
  const vals = {
    pos: o.mesh.position.toArray(),
    size: s.toArray(),
    rot: [e.x, e.y, e.z].map(a => THREE.MathUtils.radToDeg(a)),
  };
  $$('#inspector input[data-f]').forEach(inp => {
    if (document.activeElement === inp) return;
    let v = vals[inp.dataset.f][+inp.dataset.i];
    if (Math.abs(v) < 0.005) v = 0;
    inp.value = fmt(v);
  });
}

// ================================================================ panel szablonów
function renderTemplates() {
  const imgs = objects.filter(isImage);
  const el = $('#tplPanel');
  el.style.display = imgs.length ? '' : 'none';
  $('#tplList').innerHTML = imgs
    .map(
      o => `<div class="tpl" data-id="${o.id}">
    <span class="tpl-name" data-notr title="${esc(o.name)}">${esc(o.name)}</span>
    <button class="icon-btn" data-act="vis" title="${o.hidden ? 'Pokaż' : 'Ukryj'}">${o.hidden ? ICONS.eyeOff : ICONS.eye}</button>
    <button class="icon-btn ${o.locked ? 'on' : ''}" data-act="lock" title="${o.locked ? 'Odblokuj' : 'Zablokuj'}">${o.locked ? ICONS.lock : ICONS.unlock}</button>
    <button class="icon-btn" data-act="del" title="Usuń szablon">${ICONS.trash}</button></div>`,
    )
    .join('');
  $$('#tplList .tpl').forEach(row => {
    const o = objects.find(x => x.id === row.dataset.id);
    row.querySelector('[data-act=vis]').onclick = () => {
      o.hidden = !o.hidden;
      o.mesh.visible = !o.hidden;
      if (o.hidden) setSelection(selection.filter(x => x !== o));
      commit();
      renderTemplates();
    };
    row.querySelector('[data-act=lock]').onclick = () => {
      o.locked = !o.locked;
      if (o.locked) setSelection(selection.filter(x => x !== o));
      commit();
      renderTemplates();
    };
    row.querySelector('[data-act=del]').onclick = () => deleteList([o]);
    row.querySelector('.tpl-name').onclick = () => {
      if (!o.locked && !o.hidden) setSelection([o]);
    };
  });
}

// ================================================================ paleta
const T = (type, extra = {}) => ({ type, ...extra });
const PALETTE = [
  {
    id: 'basic',
    title: 'Podstawowe',
    open: true,
    items: [
      'box',
      'cylinder',
      'sphere',
      'halfsphere',
      'cone',
      'pyramid',
      'roof',
      'wedge',
      'prism',
      'tube',
      'torus',
      'star',
      'heart',
      'text',
    ].map(t => T(t)),
  },
  {
    id: 'more',
    title: 'Więcej kształtów',
    open: true,
    items: [
      'capybara',
      'banana',
      'star3d',
      'arrow',
      'moon',
      'drop',
      'egg',
      'brick',
      'stairs',
      'arch',
      'dice',
      'tetra',
      'octa',
      'dodeca',
      'icosa',
    ].map(t => T(t)),
  },
  {
    id: 'mech',
    title: 'Śruby i nakrętki',
    note: 'wymiary ISO',
    open: false,
    items: [
      T('bolt'),
      T('bolt', { params: { head: 'socket' }, label: 'Śruba imbusowa' }),
      T('bolt', { params: { head: 'csk' }, label: 'Śruba wpuszczana' }),
      T('bolt', { params: { head: 'none', length: 30 }, label: 'Pręt gwintowany' }),
      T('nut'),
      T('tapHole'),
      T('boltHole'),
      T('nutTrap'),
    ],
  },
  {
    id: 'holes',
    title: 'Otwory',
    note: 'zgrupuj z bryłą, aby wyciąć',
    open: true,
    items: [
      T('box', { hole: true }),
      T('cylinder', { hole: true }),
      T('prism', { hole: true }),
      T('cone', { hole: true }),
    ],
  },
];
const TILES = PALETTE.flatMap(s => s.items);
TILES.forEach((t, i) => {
  t.idx = i;
});
const tileLabel = t => t.label || SHAPES[t.type].label;
function addTile(idx, at) {
  const t = TILES[idx];
  addShape(t.type, at || null, { hole: t.hole, params: t.params, label: t.label });
}

// miniatury renderowane głównym rendererem (jeden kontekst WebGL)
const thumbCache = new Map();
const thumbScene = new THREE.Scene();
thumbScene.background = new THREE.Color(TH.thumb);
thumbScene.add(new THREE.HemisphereLight('#ffffff', '#9aa8b6', 2.0));
{
  const l = new THREE.DirectionalLight('#ffffff', 2.2);
  l.position.set(-1, -2, 3);
  thumbScene.add(l);
}
const thumbCam = new THREE.PerspectiveCamera(30, 1, 0.1, 5000);
thumbCam.up.set(0, 0, 1);

function renderThumb(meshes) {
  const box = new THREE.Box3();
  meshes.forEach(m => {
    m.updateMatrixWorld(true);
    box.union(new THREE.Box3().setFromObject(m));
    thumbScene.add(m);
  });
  const c = box.getCenter(V3()),
    r = Math.max(1, box.getSize(V3()).length() / 2);
  thumbCam.position.copy(c).add(
    V3(-0.55, -0.85, 0.6)
      .normalize()
      .multiplyScalar((r / Math.sin(THREE.MathUtils.degToRad(15))) * 1.02),
  );
  thumbCam.lookAt(c);
  const pr = renderer.getPixelRatio();
  renderer.setPixelRatio(1);
  renderer.setSize(112, 112, false);
  renderer.render(thumbScene, thumbCam);
  const url = canvas.toDataURL();
  renderer.setPixelRatio(pr);
  resize();
  meshes.forEach(m => {
    thumbScene.remove(m);
    if (m.material !== holeMaterial) m.material.dispose();
  });
  return url;
}
function tileThumb(t) {
  const key = JSON.stringify([t.type, t.hole, t.params]);
  if (thumbCache.has(key)) return thumbCache.get(key);
  const params = t.type === 'text' ? { text: 'Abc' } : { ...defaultParams(t.type), ...(t.params || {}) };
  const { geom } = geomFor({ type: t.type, params, mirror: [1, 1, 1] });
  const hole = t.hole ?? SHAPES[t.type].hole;
  const mat = hole
    ? new THREE.MeshStandardMaterial({ color: '#9aa6b2', roughness: 0.7, transparent: true, opacity: 0.8 })
    : new THREE.MeshStandardMaterial({ color: SHAPES[t.type].color, roughness: 0.5 });
  const url = renderThumb([new THREE.Mesh(geom, mat)]);
  thumbCache.set(key, url);
  return url;
}
function libThumb(item) {
  if (thumbCache.has('lib:' + item.id)) return thumbCache.get('lib:' + item.id);
  for (const [k, v] of Object.entries(item.data || {})) dataStore.set(k, v);
  const meshes = item.objects.map(d => {
    const o = createObject(d, false);
    return o.mesh;
  });
  const url = renderThumb(meshes);
  thumbCache.set('lib:' + item.id, url);
  return url;
}

const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
let sectionOpen = {};
try {
  sectionOpen = JSON.parse(localStorage.getItem('cappycad-sections') || '{}');
} catch {}
function buildPalette() {
  const sec = (
    id,
    title,
    note,
    open,
    body,
  ) => `<details class="pal-sec" data-sec="${id}" ${(sectionOpen[id] ?? open) ? 'open' : ''}>
    <summary>${title}${note ? ` <small>— ${note}</small>` : ''}</summary>${body}</details>`;
  let html = PALETTE.map(s =>
    sec(
      s.id,
      s.title,
      s.note,
      s.open,
      `<div class="tiles">${s.items
        .map(
          t =>
            `<button class="tile${(t.hole ?? SHAPES[t.type].hole) ? ' hole' : ''}" draggable="true" data-tile="${t.idx}" title="${esc(tileLabel(t))}: kliknij lub przeciągnij">
      <img data-thumb="${t.idx}" src="${BLANK}" alt=""><span>${esc(tileLabel(t))}</span></button>`,
        )
        .join('')}</div>`,
    ),
  ).join('');
  html += sec(
    'lib',
    'Moje kształty',
    '',
    true,
    `<div class="tiles">${library
      .map(
        l =>
          `<div class="tile lib" draggable="true" data-lib="${l.id}" title="${esc(l.name)}: kliknij lub przeciągnij"><img data-libthumb="${l.id}" src="${BLANK}" alt=""><span data-notr>${esc(l.name)}</span>
     <button class="tile-del" data-libdel="${l.id}" title="Usuń z biblioteki">×</button></div>`,
      )
      .join('')}</div>
    ${library.length ? '' : '<p class="muted small">Zaznacz obiekt i kliknij „Zapisz jako mój kształt”, a pojawi się tutaj. Narzędziem <b>Rysuj</b> narysujesz własny kształt.</p>'}
    <div class="lib-btns"><button class="link" id="libImport">${ICONS.import}Importuj</button><button class="link" id="libExport">${ICONS.export}Eksportuj bibliotekę</button></div>`,
  );
  $('#palette').innerHTML = html;
  $$('#palette .pal-sec').forEach(d =>
    d.addEventListener('toggle', () => {
      sectionOpen[d.dataset.sec] = d.open;
      try {
        localStorage.setItem('cappycad-sections', JSON.stringify(sectionOpen));
      } catch {}
      if (d.open) loadThumbs();
    }),
  );
  $$('#palette [data-tile]').forEach(b => {
    b.addEventListener('click', () => addTile(+b.dataset.tile));
    b.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/cappycad', 'tile|' + b.dataset.tile);
      e.dataTransfer.effectAllowed = 'copy';
    });
  });
  $$('#palette [data-lib]').forEach(b => {
    b.addEventListener('click', e => {
      if (!e.target.closest('[data-libdel]')) insertFromLibrary(b.dataset.lib);
    });
    b.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/cappycad', 'lib|' + b.dataset.lib);
      e.dataTransfer.effectAllowed = 'copy';
    });
  });
  $$('#palette [data-libdel]').forEach(b =>
    b.addEventListener('click', async e => {
      e.stopPropagation();
      const item = library.find(l => l.id === b.dataset.libdel);
      if ((await ask('Usunąć kształt?', `Usunąć „${esc(item.name)}” z Moich kształtów?`, ['Usuń', 'Anuluj'])) !== 0)
        return;
      library = library.filter(l => l !== item);
      storeLibrary();
      buildPalette();
    }),
  );
  $('#libImport').onclick = importLibrary;
  $('#libExport').onclick = exportLibrary;
  loadThumbs();
}
// miniatury ładowane stopniowo, by nie blokować startu
let thumbQueue = [],
  thumbBusy = false;
function loadThumbs() {
  thumbQueue = $$('#palette details[open] img[data-thumb], #palette details[open] img[data-libthumb]').filter(
    i => i.src === BLANK,
  );
  if (!thumbBusy) pumpThumbs();
}
function pumpThumbs() {
  const img = thumbQueue.shift();
  if (!img) {
    thumbBusy = false;
    return;
  }
  thumbBusy = true;
  try {
    img.src =
      img.dataset.thumb !== undefined
        ? tileThumb(TILES[+img.dataset.thumb])
        : libThumb(library.find(l => l.id === img.dataset.libthumb));
  } catch (err) {
    console.error(err);
  }
  setTimeout(pumpThumbs, 0);
}

// ================================================================ przełączanie motywu
const THEME_LABEL = { light: 'Jasny', dark: 'Ciemny', system: 'Jak w systemie' };
function applyTheme(rebuild = true) {
  const t = effectiveTheme();
  TH = THEMES[t];
  document.documentElement.dataset.theme = lastSetTheme = t;
  scene.background = new THREE.Color(TH.bg);
  thumbScene.background = new THREE.Color(TH.thumb);
  buildWorkplane();
  const b = $('#bTheme');
  if (b) {
    b.innerHTML = ICONS[t === 'dark' ? 'moon' : 'sun'];
    b.title = 'Motyw: ' + THEME_LABEL[themeMode];
  }
  $$('[data-theme-set]').forEach(x => x.classList.toggle('on', x.dataset.themeSet === themeMode));
  api?.setTheme?.(themeMode);
  if (rebuild) {
    thumbCache.clear();
    buildPalette();
  }
}
function setTheme(mode) {
  themeMode = mode;
  try {
    localStorage.setItem('cappycad-theme', mode);
  } catch {}
  applyTheme();
  toast('Motyw: ' + THEME_LABEL[mode].toLowerCase());
}
darkQuery.addEventListener('change', () => {
  if (themeMode === 'system') applyTheme();
});
new MutationObserver(() => {
  const v = document.documentElement.dataset.theme;
  if (v !== lastSetTheme && ['light', 'dark'].includes(v)) {
    hostTheme = v;
    if (themeMode === 'system') applyTheme();
  }
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// ================================================================ Cappy — pomocnik
let capy = null,
  lastSaveAt = Date.now();
const WARN = { once: false, warn: true, cooldown: 90000 };
function capyAfterAdd(o) {
  if (!capy) return;
  if (objects.filter(x => !isImage(x)).length === 1) capy.say('firstShape');
  if (o.hole)
    setTimeout(() => {
      if (objects.some(x => x.hole && x.type !== 'group')) capy.say('holeNotGrouped', {}, { warn: true });
    }, 12000);
}
function restingOnSomething(o, b) {
  return objects.some(
    x =>
      x !== o &&
      !isImage(x) &&
      !x.hole &&
      (() => {
        const c = worldBox(x, false);
        return (
          Math.abs(c.max.z - b.min.z) < 0.6 &&
          c.min.x < b.max.x &&
          c.max.x > b.min.x &&
          c.min.y < b.max.y &&
          c.max.y > b.min.y
        );
      })(),
  );
}
function capyCheck() {
  if (!capy || capy.muted || tool !== 'select') return;
  for (const o of selection) {
    if (isImage(o)) continue;
    const b = worldBox(o),
      s = sizeOf(o),
      name = o.name;
    const def = SHAPES[o.type] || {};
    if (
      def.real &&
      (Math.abs(o.mesh.scale.x - 1) > 0.01 ||
        Math.abs(o.mesh.scale.y - 1) > 0.01 ||
        Math.abs(o.mesh.scale.z - 1) > 0.01)
    ) {
      capy.say('scaledReal', {}, { ...WARN, key: 'scaled' + o.id });
      return;
    }
    if (o.hole) continue;
    if (b.min.z < -0.3) {
      capy.say('belowPlane', { name }, { ...WARN, key: 'below' + o.id });
      return;
    }
    if (b.min.z > 0.5 && !restingOnSomething(o, b)) {
      capy.say('floating', { name }, { ...WARN, key: 'float' + o.id });
      return;
    }
    if (
      b.min.x < -wp.x / 2 - 0.5 ||
      b.max.x > wp.x / 2 + 0.5 ||
      b.min.y < -wp.y / 2 - 0.5 ||
      b.max.y > wp.y / 2 + 0.5
    ) {
      capy.say('outside', { name }, { ...WARN, key: 'out' + o.id });
      return;
    }
    const thin = Math.min(s.x, s.y, s.z);
    if (thin < 0.8) {
      capy.say('thin', { name, mm: fmt(thin) }, { ...WARN, key: 'thin' + o.id });
      return;
    }
    if (o.type === 'text' && s.y < 5) {
      capy.say('smallText', {}, { ...WARN, key: 'text' + o.id });
      return;
    }
  }
}
setInterval(() => {
  if (capy && dirty && objects.length && Date.now() - lastSaveAt > 10 * 60000)
    capy.say('saveReminder', {}, { once: false, cooldown: 10 * 60000 });
}, 60000);

// ================================================================ przykłady i ćwiczenia
const LL = o => (o && typeof o === 'object' ? o[lang] || o.pl : o);
const LEVEL = { 1: { pl: 'łatwe', en: 'easy' }, 2: { pl: 'średnie', en: 'medium' } };
const exampleCache = new Map();

function exampleBuilder() {
  return {
    add(type, o = {}) {
      const def = SHAPES[type];
      const params = { ...defaultParams(type), ...(o.params || {}) };
      const { baseSize } = geomFor({ type, params, mirror: [1, 1, 1] });
      let size = o.size;
      if (!size && o.height) {
        const k = o.height / baseSize.y;
        size = [baseSize.x * k, o.height, o.depth || baseSize.z * k];
      }
      if (!size) {
        const k = def.keepScale || def.real ? 1 : (def.defSize || 20) / Math.max(baseSize.x, baseSize.y);
        size = [baseSize.x * k, baseSize.y * k, baseSize.z * k];
      }
      const q = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(...(o.rot || [0, 0, 0]).map(THREE.MathUtils.degToRad)),
      );
      const hole = o.hole ?? !!def.hole;
      return {
        id: uid(),
        type,
        params,
        size,
        pos: o.pos || [0, 0, 0],
        quat: q.toArray(),
        hole,
        mirror: [1, 1, 1],
        color: o.color || (hole ? '#8f9ba8' : def.color),
        name: LL(o.name) || tr(def.label),
      };
    },
    group(list, o = {}) {
      const d = groupData(list);
      if (o.color) d.color = o.color;
      if (o.name) d.name = LL(o.name);
      return d;
    },
  };
}
function buildExample(ex) {
  const key = ex.id + ':' + lang;
  if (!exampleCache.has(key)) exampleCache.set(key, ex.build(exampleBuilder()));
  return structuredClone(exampleCache.get(key));
}
async function openExample(id, skipConfirm = false) {
  const ex = EXAMPLES.find(e => e.id === id);
  if (!ex || (!skipConfirm && !(await confirmDiscard()))) return;
  closeModal();
  setBusy(true, lang === 'en' ? 'Building the example…' : 'Budowanie przykładu…');
  setTimeout(() => {
    try {
      clearScene();
      clearMeasures();
      buildExample(ex).forEach(d => createObject(d));
      $('#projName').value = LL(ex.title);
      currentPath = null;
      resetHistory();
      setDirty(false);
      markSaved();
      setSelection([]);
      setView('home');
    } catch (err) {
      console.error(err);
      toast(err.message, true);
    } finally {
      setBusy(false);
    }
  }, 30);
}

// --- ćwiczenia
let exercise = null; // { def, done: Set, events: Set }
const exEvents = new Set();
function exEvent(name) {
  exEvents.add(name);
  checkExercise();
}
function allData(list = objects) {
  const out = [];
  const walk = d => {
    out.push(d);
    (d.children || []).forEach(walk);
  };
  list.forEach(o => walk(o.mesh ? { ...o, children: o.children } : o));
  return out;
}
function exCheck(code) {
  const all = allData().filter(o => o.type !== 'image');
  const top = objects.filter(o => !isImage(o));
  const [k, arg] = code.split(':');
  switch (k) {
    case 'has':
    case 'type':
      return all.some(o => o.type === arg);
    case 'size': {
      const want = arg.split(',').map(Number);
      return top.some(o => {
        const s = sizeOf(o).toArray();
        return want.every((v, i) => Math.abs(s[i] - v) < 0.6);
      });
    }
    case 'recolored':
      return top.some(o => !o.hole && o.color.toLowerCase() !== (SHAPES[o.type]?.color || '').toLowerCase());
    case 'stacked':
      return top.some(o => {
        const b = worldBox(o, false);
        return b.min.z > 0.5 && restingOnSomething(o, b);
      });
    case 'hole':
      return all.some(o => o.hole);
    case 'groupWithHole':
      return top.some(o => o.type === 'group' && o.children.some(c => c.hole) && o.children.some(c => !c.hole));
    case 'flatPlate':
      return top.some(o => {
        const s = sizeOf(o);
        return !o.hole && s.z >= 1.5 && s.z <= 6 && Math.max(s.x, s.y) >= 30;
      });
    case 'customText':
      return all.some(o => o.type === 'text' && !['Tekst', 'Text', ''].includes(String(o.params?.text || '').trim()));
    case 'count':
      return top.length >= Number(arg);
    case 'smoothSketch':
      return all.some(o => o.type === 'sketch' && o.params?.smooth === 'yes');
    case 'deformed':
      return all.some(o => deformActive(o.deform));
    case 'platonic':
      return ['tetra', 'octa', 'dodeca', 'icosa'].every(t => all.some(o => o.type === t));
    case 'measured':
      return exEvents.has('measured') || measures.length > 0;
    case 'saved':
    case 'exported':
    case 'library':
      return exEvents.has(k);
    default:
      return false;
  }
}
function checkExercise() {
  if (!exercise) return;
  let changed = false;
  exercise.def.steps.forEach((st, i) => {
    if (!exercise.done.has(i) && st.check !== 'manual' && exCheck(st.check)) {
      exercise.done.add(i);
      changed = true;
    }
  });
  if (changed) renderExercise();
}
function startExercise(id) {
  const def = EXERCISES.find(e => e.id === id);
  if (!def) return;
  closeModal();
  exEvents.clear();
  exercise = { def, done: new Set(), finished: false };
  renderExercise();
  checkExercise();
  capy?.say('exerciseStart', { name: LL(def.title) }, { once: false });
}
function stopExercise() {
  exercise = null;
  renderExercise();
}
function renderExercise() {
  const el = $('#exPanel');
  if (!exercise) {
    el.classList.remove('show');
    el.innerHTML = '';
    return;
  }
  const { def, done } = exercise;
  const n = def.steps.length,
    k = done.size;
  const T = {
    steps: { pl: 'Kroki', en: 'Steps' },
    hint: { pl: 'Podpowiedź', en: 'Hint' },
    sol: { pl: 'Pokaż rozwiązanie', en: 'Show solution' },
    end: { pl: 'Zakończ ćwiczenie', en: 'End exercise' },
    manual: { pl: 'zaznacz sam(a), gdy zrobisz', en: 'tick it yourself when done' },
  };
  el.innerHTML = `<div class="ex-head"><b>${esc(LL(def.title))}</b><button class="icon-btn" id="exMin" title="${LL({ pl: 'Zwiń', en: 'Collapse' })}">–</button><button class="icon-btn" id="exClose" title="${LL(T.end)}">×</button></div>
    <div class="ex-body">
    <p class="ex-goal">${esc(LL(def.goal))}</p>
    <div class="ex-progress"><div style="width:${(k / n) * 100}%"></div></div>
    <ol class="ex-steps">${def.steps.map((st, i) => `<li class="${done.has(i) ? 'done' : ''}" data-i="${i}"><span class="ex-check">${done.has(i) ? '✓' : ''}</span><span>${esc(LL(st))}${st.check === 'manual' && !done.has(i) ? `<small>${LL(T.manual)}</small>` : ''}</span></li>`).join('')}</ol>
    <details class="ex-hint"><summary>${LL(T.hint)}</summary><p>${esc(LL(def.hint))}</p></details>
    <div class="ex-btns">${def.solution ? `<button class="link" id="exSol">${LL(T.sol)}</button>` : '<span></span>'}<span class="ex-count">${k} / ${n}</span></div></div>`;
  el.classList.add('show');
  $$('#exPanel .ex-steps li').forEach(
    li =>
      (li.onclick = () => {
        const i = +li.dataset.i;
        if (exercise.done.has(i)) exercise.done.delete(i);
        else exercise.done.add(i);
        renderExercise();
      }),
  );
  $('#exClose').onclick = stopExercise;
  $('#exMin').onclick = () => el.classList.toggle('min');
  $('#exSol')?.addEventListener('click', () => openExample(def.solution));
  if (k === n && !exercise.finished) {
    exercise.finished = true;
    capy?.say('exerciseDone', { name: LL(def.title) }, { once: false });
  }
}

function showLessons(tab = 'examples') {
  const T = {
    title: { pl: 'Przykłady i ćwiczenia', en: 'Examples & exercises' },
    ex: { pl: 'Przykładowe projekty', en: 'Example projects' },
    lessons: { pl: 'Ćwiczenia krok po kroku', en: 'Step-by-step exercises' },
    open: { pl: 'Otwórz', en: 'Open' },
    start: { pl: 'Zacznij', en: 'Start' },
    min: { pl: 'min', en: 'min' },
    steps: { pl: 'kroków', en: 'steps' },
    close: { pl: 'Zamknij', en: 'Close' },
    exNote: {
      pl: 'Otwórz gotowy projekt, obejrzyj jak jest zbudowany (Rozgrupuj!) i zmień go po swojemu.',
      en: 'Open a ready project, see how it is built (Ungroup it!) and make it your own.',
    },
    leNote: {
      pl: 'Ćwiczenie pokazuje listę zadań — kroki odhaczają się same, gdy je wykonasz.',
      en: 'An exercise shows a task list — steps tick themselves off as you complete them.',
    },
  };
  openModal(`<div data-notr class="lessons"><h2>${LL(T.title)}</h2>
    <div class="seg lessons-tabs"><button data-tab="examples" class="${tab === 'examples' ? 'on' : ''}">${LL(T.ex)}</button><button data-tab="exercises" class="${tab === 'exercises' ? 'on' : ''}">${LL(T.lessons)}</button></div>
    <div class="lessons-pane" data-pane="examples" ${tab === 'examples' ? '' : 'hidden'}><p class="muted">${LL(T.exNote)}</p>
      <div class="cards">${EXAMPLES.map(
        e => `<div class="card"><img data-exthumb="${e.id}" src="${BLANK}" alt=""><div class="card-body">
        <b>${esc(LL(e.title))}</b><span class="badge l${e.level}">${LL(LEVEL[e.level])}</span><p>${esc(LL(e.desc))}</p>
        <button class="btn sm primary" data-open="${e.id}">${LL(T.open)}</button></div></div>`,
      ).join('')}</div></div>
    <div class="lessons-pane" data-pane="exercises" ${tab === 'exercises' ? '' : 'hidden'}><p class="muted">${LL(T.leNote)}</p>
      <div class="cards list">${EXERCISES.map(
        e => `<div class="card row"><div class="card-num">${EXERCISES.indexOf(e) + 1}</div><div class="card-body">
        <b>${esc(LL(e.title))}</b><span class="badge l${e.level}">${LL(LEVEL[e.level])}</span><span class="badge">${e.minutes} ${LL(T.min)}</span><span class="badge">${e.steps.length} ${LL(T.steps)}</span>
        <p>${esc(LL(e.goal))}</p></div><button class="btn sm primary" data-start="${e.id}">${LL(T.start)}</button></div>`,
      ).join('')}</div></div>
    <div class="modal-btns"><button class="btn" id="lessonsClose">${LL(T.close)}</button></div></div>`);
  $('#lessonsClose').onclick = closeModal;
  $$('.lessons-tabs button').forEach(
    b =>
      (b.onclick = () => {
        $$('.lessons-tabs button').forEach(x => x.classList.toggle('on', x === b));
        $$('.lessons-pane').forEach(p => (p.hidden = p.dataset.pane !== b.dataset.tab));
      }),
  );
  $$('[data-open]').forEach(b => (b.onclick = () => openExample(b.dataset.open)));
  $$('[data-start]').forEach(b => (b.onclick = () => startExercise(b.dataset.start)));
  // miniatury przykładów — stopniowo
  const imgs = $$('img[data-exthumb]');
  const next = () => {
    const img = imgs.shift();
    if (!img || !$('#modal').classList.contains('open')) return;
    const key = 'ex:' + img.dataset.exthumb;
    try {
      if (!thumbCache.has(key))
        thumbCache.set(
          key,
          renderThumb(
            buildExample(EXAMPLES.find(e => e.id === img.dataset.exthumb)).map(d => createObject(d, false).mesh),
          ),
        );
      img.src = thumbCache.get(key);
    } catch (err) {
      console.error(err);
    }
    setTimeout(next, 0);
  };
  setTimeout(next, 30);
}

// ================================================================ język
function setLanguage(l, announce = true) {
  setLang(l);
  try {
    localStorage.setItem('cappycad-lang', lang);
  } catch {}
  api?.setLang?.(lang);
  const ls = $('#bLang');
  ls.classList.toggle('en', lang === 'en');
  ls.setAttribute('aria-checked', String(lang === 'en'));
  $$('#bLang .ls-opt').forEach(x => x.classList.toggle('on', x.dataset.l === lang));
  const pn = $('#projName');
  if (['Bez tytułu', 'Untitled'].includes(pn.value)) {
    pn.value = lang === 'en' ? 'Untitled' : 'Bez tytułu';
  }
  buildPalette();
  renderInspector();
  renderTemplates();
  updateBanner();
  updateCount();
  setDirty(dirty);
  applyTheme(false);
  capy?.refresh();
  renderExercise();
  $('#bLessons span').textContent = lang === 'en' ? 'Lessons' : 'Lekcje';
  $('#bLessons').title = lang === 'en' ? 'Example projects and exercises' : 'Przykładowe projekty i ćwiczenia';
  if (announce) toast(lang === 'en' ? 'Language: English' : 'Język: polski');
}

// ================================================================ paski narzędzi
function updateToolbarState() {
  const has = selection.length > 0;
  const set = (id, on) => {
    const b = document.getElementById(id);
    if (b) b.disabled = !on;
  };
  set('bUndo', history.length > 1);
  set('bRedo', future.length > 0);
  set('bCopy', has);
  set('bDup', has);
  set('bDel', has);
  set('bPaste', !!clipboard);
  set('bGroup', selection.filter(o => !isImage(o)).length > 1);
  set(
    'bUngroup',
    selection.some(o => o.type === 'group'),
  );
  set('bDrop', has);
}
function updateCount() {
  $('#objCount').textContent = `Obiekty: ${objects.filter(o => !isImage(o)).length}`;
}

function setupMenus() {
  $$('.menu-wrap').forEach(w => {
    const btn = w.querySelector('.tb'),
      menu = w.querySelector('.menu');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const open = !menu.classList.contains('open');
      $$('.menu.open').forEach(m => m.classList.remove('open'));
      menu.classList.toggle('open', open);
    });
    menu.addEventListener('click', () => menu.classList.remove('open'));
  });
  document.addEventListener('pointerdown', e => {
    if (!e.target.closest('.menu-wrap')) $$('.menu.open').forEach(m => m.classList.remove('open'));
  });
}

function setupToolbar() {
  $$('[data-icon]').forEach(el => el.insertAdjacentHTML('afterbegin', ICONS[el.dataset.icon] || ''));
  const on = (id, fn) => $('#' + id).addEventListener('click', fn);
  on('bNew', newProject);
  on('bOpen', openProject);
  on('bSave', () => saveProject(false));
  on('bSaveAs', () => saveProject(true));
  on('miModel', importModel);
  on('miSvg', importSVG);
  on('miImage', importImage);
  on('meStl', () => exportModel('stl'));
  on('meObj', () => exportModel('obj'));
  on('mePng', exportPNG);
  on('bHelp', showHelp);
  on('bLessons', () => showLessons());
  on('bShapes', () => document.body.classList.toggle('shapes-open'));
  $('#palette').addEventListener('click', e => {
    if (e.target.closest('.tile') && window.innerWidth <= 760) document.body.classList.remove('shapes-open');
  });
  $$('[data-theme-set]').forEach(b => b.addEventListener('click', () => setTheme(b.dataset.themeSet)));
  on('bLang', () => setLanguage(lang === 'pl' ? 'en' : 'pl'));
  on('bUndo', undo);
  on('bRedo', redo);
  on('bCopy', copySelection);
  on('bPaste', paste);
  on('bDup', duplicate);
  on('bDel', deleteSelection);
  on('bGroup', groupSelection);
  on('bUngroup', ungroupSelection);
  on('bDrop', () => {
    dropToPlane();
    attachGizmo();
    updateInspectorValues();
    commit();
  });
  on('bRuler', () => setTool(tool === 'ruler' ? 'select' : 'ruler'));
  on('bSketch', () => setTool(tool === 'sketch' ? 'select' : 'sketch'));
  $$('#modeSeg button').forEach(b => b.addEventListener('click', () => setGizmoMode(b.dataset.mode)));
  $$('#viewBtns [data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  on('vFit', () => fitView());
  on('vIn', () => zoomBy(0.7));
  on('vOut', () => zoomBy(1.4));
  $('#snap').addEventListener('change', e => {
    snap = parseFloat(e.target.value);
    applySnapSettings();
  });
  $('#angle').addEventListener('change', e => {
    angleSnap = parseFloat(e.target.value);
    applySnapSettings();
  });
  $('#wpBtn').addEventListener('click', editWorkplane);
  $('#projName').addEventListener('change', () => setDirty(true));
  setupMenus();
}

// ================================================================ okna dialogowe
function openModal(html) {
  $('#modalBody').innerHTML = html;
  $('#modal').classList.add('open');
}
function closeModal() {
  $('#modal').classList.remove('open');
}
$('#modal').addEventListener('mousedown', e => {
  if (e.target.id === 'modal') closeModal();
});

function ask(title, text, buttons) {
  return new Promise(res => {
    openModal(
      `<h2>${title}</h2><p>${text}</p><div class="modal-btns">${buttons.map((b, i) => `<button class="btn ${i === 0 ? 'primary' : ''}" data-i="${i}">${b}</button>`).join('')}</div>`,
    );
    $$('#modalBody [data-i]').forEach(
      b =>
        (b.onclick = () => {
          closeModal();
          res(+b.dataset.i);
        }),
    );
  });
}
function prompt(title, label, value) {
  return new Promise(res => {
    openModal(`<h2>${title}</h2><label class="pf wide"><span>${label}</span><input type="text" id="promptIn" value="${esc(value)}" maxlength="40"></label>
      <div class="modal-btns"><button class="btn primary" id="promptOk">Zapisz</button><button class="btn" id="promptCancel">Anuluj</button></div>`);
    const inp = $('#promptIn');
    inp.focus();
    inp.select();
    const ok = () => {
      closeModal();
      res(inp.value.trim() || null);
    };
    $('#promptOk').onclick = ok;
    inp.onkeydown = e => {
      if (e.key === 'Enter') ok();
    };
    $('#promptCancel').onclick = () => {
      closeModal();
      res(null);
    };
  });
}

function editWorkplane() {
  openModal(`<h2>Płaszczyzna robocza</h2>
    <p>Ustaw wymiary stołu drukarki 3D, na której będziesz drukować.</p>
    <div class="row2"><label class="pf"><span>Szerokość (mm)</span><input id="wpX" type="number" min="50" max="2000" value="${wp.x}"></label>
    <label class="pf"><span>Głębokość (mm)</span><input id="wpY" type="number" min="50" max="2000" value="${wp.y}"></label></div>
    <div class="presets">Popularne: <button class="link" data-wp="200x200">200×200</button><button class="link" data-wp="220x220">220×220 (Ender 3)</button><button class="link" data-wp="256x256">256×256 (Bambu)</button><button class="link" data-wp="250x210">250×210 (Prusa MK4)</button><button class="link" data-wp="180x180">180×180 (mini)</button></div>
    <div class="modal-btns"><button class="btn primary" id="wpOk">Zastosuj</button><button class="btn" id="wpCancel">Anuluj</button></div>`);
  $$('[data-wp]').forEach(
    b =>
      (b.onclick = () => {
        const [x, y] = b.dataset.wp.split('x');
        $('#wpX').value = x;
        $('#wpY').value = y;
      }),
  );
  $('#wpCancel').onclick = closeModal;
  $('#wpOk').onclick = () => {
    const x = Math.round(+$('#wpX').value),
      y = Math.round(+$('#wpY').value);
    if (x >= 50 && y >= 50 && x <= 2000 && y <= 2000) {
      wp = { x, y };
      buildWorkplane();
      setDirty(true);
    }
    closeModal();
  };
}

function showHelp() {
  showHelpDialog({ lang, openModal, closeModal, $ });
}

let toastTimer = null;
function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('err', err);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), err ? 4500 : 2800);
}
function setBusy(on, msg = '') {
  $('#busy').classList.toggle('show', on);
  $('#busyMsg').textContent = msg;
}

// ================================================================ pętla renderowania
const dimLabel = $('#dimLabel');
function resize() {
  const w = viewport.clientWidth,
    h = viewport.clientHeight;
  renderer.setSize(w, h, false);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport);

function placeLabel(el, world, dy = '-150%') {
  const s = toScreen(world),
    r = viewport.getBoundingClientRect();
  if (s.z >= 1) {
    el.style.display = 'none';
    return;
  }
  el.style.display = '';
  el.style.transform = `translate(${s.x - r.left}px, ${s.y - r.top}px) translate(-50%, ${dy})`;
}

function loop(t) {
  requestAnimationFrame(loop);
  if (camAnim) {
    const k = Math.min(1, (t - camAnim.start) / camAnim.dur),
      e = 1 - Math.pow(1 - k, 3);
    camera.position.lerpVectors(camAnim.p0, camAnim.p1, e);
    orbit.target.lerpVectors(camAnim.t0, camAnim.t1, e);
    if (k >= 1) camAnim = null;
  }
  orbit.update();
  for (const [, h] of selHelpers) h.update();
  updateHandles();
  if (selection.length && tool === 'select') {
    const b = selectionBox(),
      s = b.getSize(V3());
    const img = selection.length === 1 && isImage(selection[0]);
    dimLabel.textContent = img
      ? `${fmt(sizeOf(selection[0]).x)} × ${fmt(sizeOf(selection[0]).y)} mm`
      : `${fmt(s.x)} × ${fmt(s.y)} × ${fmt(s.z)} mm`;
    placeLabel(dimLabel, V3((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, b.max.z), '-190%');
  } else dimLabel.style.display = 'none';
  for (const m of measures) placeLabel(m.label, m.a.clone().add(m.b).multiplyScalar(0.5), '-120%');
  if (rPreview) placeLabel(rPreview.label, rPreview.a.clone().add(rPreview.b).multiplyScalar(0.5), '-120%');
  renderer.render(scene, camera);
}

// ================================================================ start
window.addEventListener('beforeunload', e => {
  if (dirty && objects.length) {
    e.preventDefault();
    e.returnValue = false;
  }
});

loadLibrary();
setupToolbar();
startObserver();
setLang(initialLang());
applyTheme(false);
applySnapSettings();
setGizmoMode('translate');
resize();
resetHistory();
setDirty(false);
renderInspector();
renderTemplates();
setView('home', false);
requestAnimationFrame(loop);
csg.ready.then(() => setTimeout(() => setLanguage(lang, false), 0)); // paleta po załadowaniu silnika brył
capy = createCapy({ getLang: () => lang, root: $('#capy'), img: window.__CAPPY_ASSETS?.capy });
setTimeout(() => {
  let first = true;
  try {
    first = !localStorage.getItem('cappycad-capy-welcomed');
    localStorage.setItem('cappycad-capy-welcomed', '1');
  } catch {}
  if (first && !objects.length) capy.say('welcome');
}, 1500);

(async () => {
  await csg.ready;
  if (api?.startupFile) {
    const f = await api.startupFile();
    if (f && loadProject(f.data, f.path, f.name)) return;
  }
  let saved = null;
  try {
    saved = localStorage.getItem('cappycad-autosave');
  } catch {}
  if (saved) {
    const r = await ask(
      'Przywrócić projekt?',
      'Poprzednia sesja zakończyła się bez zapisania zmian. Czy chcesz przywrócić ostatni stan projektu?',
      ['Przywróć', 'Zacznij od nowa'],
    );
    if (r === 0 && loadProject(saved, null, null)) {
      setDirty(true);
      toast('Przywrócono projekt — zapisz go (Ctrl+S)');
    } else clearAutosave();
  }
})();

// most testowy (automatyczne testy)
window.__cappycad = {
  get capy() {
    return capy;
  },
  setInspCollapsed,
  get inspCollapsed() {
    return inspCollapsed;
  },
  showLessons,
  openExample,
  startExercise,
  get exercise() {
    return exercise;
  },
  EXAMPLES,
  EXERCISES,
  setTheme,
  setLanguage,
  get lang() {
    return lang;
  },
  addShape,
  addTile,
  groupSelection,
  ungroupSelection,
  setSelection,
  setDeform,
  setTool,
  rulerClick,
  sketchClick,
  finishSketch,
  saveToLibrary,
  insertFromLibrary,
  get objects() {
    return objects;
  },
  get selection() {
    return selection;
  },
  get measures() {
    return measures;
  },
  get library() {
    return library;
  },
  projectJSON,
  loadProject,
  mirrorSelection,
  setView,
  sizeOf,
  undo,
  redo,
  commit,
  THREE,
  camera,
  dataStore,
  createObject,
  svgGeometry,
  exportOBJText() {
    return new OBJExporter().parse(exportRoot(exportList(), true));
  },
  exportSTLBytes() {
    return new STLExporter().parse(exportSolid(exportList()), { binary: true }).byteLength;
  },
  exportSTLGeometry() {
    return exportSolid(exportList()).children[0].geometry;
  },
  csg,
  screenOf(o) {
    const s = toScreen(worldBox(o).getCenter(V3()));
    return [Math.round(s.x), Math.round(s.y)];
  },
  screenOfPoint(x, y, z) {
    const s = toScreen(V3(x, y, z));
    return [Math.round(s.x), Math.round(s.y)];
  },
  handleScreen(i) {
    const m = handleGroup.children[i];
    const s = toScreen(m.position);
    return [Math.round(s.x), Math.round(s.y)];
  },
};
