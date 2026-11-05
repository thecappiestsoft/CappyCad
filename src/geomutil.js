// Narzędzia geometrii: orientacja trójkątów, czyszczenie atrybutów
import * as THREE from 'three';

export function swapWinding(g) {
  for (const name of ['position', 'normal']) {
    const a = g.getAttribute(name);
    if (!a) continue;
    const arr = a.array;
    for (let i = 0; i < arr.length; i += 9) {
      for (let k = 0; k < 3; k++) {
        const t = arr[i + 3 + k];
        arr[i + 3 + k] = arr[i + 6 + k];
        arr[i + 6 + k] = t;
      }
    }
    a.needsUpdate = true;
  }
}

export function signedVolume(g) {
  const p = g.getAttribute('position').array;
  let v = 0;
  for (let i = 0; i < p.length; i += 9) {
    const ax = p[i],
      ay = p[i + 1],
      az = p[i + 2],
      bx = p[i + 3],
      by = p[i + 4],
      bz = p[i + 5],
      cx = p[i + 6],
      cy = p[i + 7],
      cz = p[i + 8];
    v += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return v / 6;
}

// nieindeksowana, tylko position+normal, bez grup, zorientowana na zewnątrz
export function cleanGeom(src, fixOrientation = true) {
  let g = src.index ? src.toNonIndexed() : src.clone();
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  g.clearGroups();
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  if (fixOrientation && signedVolume(g) < 0) {
    swapWinding(g);
    const n = g.getAttribute('normal').array;
    for (let i = 0; i < n.length; i++) n[i] = -n[i];
  }
  return g;
}

export function fromPositions(arr) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  g.computeVertexNormals();
  return g;
}
