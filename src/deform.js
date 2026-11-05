// Deformacje: wyginanie, skręcanie, zwężanie
import * as THREE from 'three';

// Cięcie trójkątów płaszczyznami prostopadłymi do osi (bez szczelin między sąsiadami)
export function sliceGeometry(g, axis, planes) {
  const src = g.getAttribute('position').array;
  const out = [];
  const less = (a, b) => (a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] < b[2]);
  const cut = (poly, p) => {
    const below = [],
      above = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length];
      const da = a[axis] - p,
        db = b[axis] - p;
      if (da <= 0) below.push(a);
      if (da >= 0) above.push(a);
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
        const [u, v] = less(a, b) ? [a, b] : [b, a];
        const t = (p - u[axis]) / (v[axis] - u[axis]);
        const q = [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t, u[2] + (v[2] - u[2]) * t];
        q[axis] = p;
        below.push(q);
        above.push(q);
      }
    }
    return [below, above];
  };
  const emit = poly => {
    for (let i = 1; i + 1 < poly.length; i++) {
      const a = poly[0],
        b = poly[i],
        c = poly[i + 1];
      const ux = b[0] - a[0],
        uy = b[1] - a[1],
        uz = b[2] - a[2],
        vx = c[0] - a[0],
        vy = c[1] - a[1],
        vz = c[2] - a[2];
      const cx = uy * vz - uz * vy,
        cy = uz * vx - ux * vz,
        cz = ux * vy - uy * vx;
      if (cx * cx + cy * cy + cz * cz < 1e-14) continue;
      out.push(...a, ...b, ...c);
    }
  };
  for (let i = 0; i < src.length; i += 9) {
    let poly = [
      [src[i], src[i + 1], src[i + 2]],
      [src[i + 3], src[i + 4], src[i + 5]],
      [src[i + 6], src[i + 7], src[i + 8]],
    ];
    const mn = Math.min(poly[0][axis], poly[1][axis], poly[2][axis]);
    const mx = Math.max(poly[0][axis], poly[1][axis], poly[2][axis]);
    for (const p of planes) {
      if (p <= mn || p >= mx) continue;
      const [b, a] = cut(poly, p);
      if (b.length >= 3) emit(b);
      poly = a;
    }
    emit(poly);
  }
  const res = new THREE.BufferGeometry();
  res.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  return res;
}

const range = (a, b, n) => Array.from({ length: n - 1 }, (_, i) => a + ((b - a) * (i + 1)) / n);

export function deformActive(d) {
  return !!d && (Math.abs(d.bend || 0) > 0.01 || Math.abs(d.twist || 0) > 0.01 || Math.abs(d.taper || 0) > 0.01);
}

// g: znormalizowana geometria (środek podstawy w 0), base: jej wymiary, dsize: wymiary przed deformacją [mm]
export function applyDeform(g0, base, dsize, d) {
  let g = g0.clone();
  g.scale(dsize[0] / base.x, dsize[1] / base.y, dsize[2] / base.z);
  const H = Math.max(0.01, dsize[2]);
  const taper = (d.taper || 0) / 100;
  const twist = THREE.MathUtils.degToRad(d.twist || 0);
  const bend = THREE.MathUtils.degToRad(d.bend || 0);
  const ax = d.axis === 'y' ? 1 : 0;
  if (Math.abs(taper) > 1e-4 || Math.abs(twist) > 1e-4) {
    const n = Math.max(16, Math.min(120, Math.round(Math.abs(d.twist || 0) / 4)));
    g = sliceGeometry(g, 2, range(0, H, n));
  }
  const L = Math.max(0.01, dsize[ax]);
  if (Math.abs(bend) > 1e-4) {
    const n = Math.max(16, Math.min(160, Math.round(Math.abs(d.bend) / 2.5)));
    g = sliceGeometry(g, ax, range(-L / 2, L / 2, n));
  }
  const p = g.getAttribute('position').array;
  const R = Math.abs(bend) > 1e-4 ? L / bend : 0;
  for (let i = 0; i < p.length; i += 3) {
    let x = p[i],
      y = p[i + 1],
      z = p[i + 2];
    if (taper) {
      const f = 1 - taper * (z / H);
      x *= f;
      y *= f;
    }
    if (twist) {
      const a = twist * (z / H),
        c = Math.cos(a),
        s = Math.sin(a);
      const nx = x * c - y * s;
      y = x * s + y * c;
      x = nx;
    }
    if (R) {
      const u = ax === 0 ? x : y;
      const th = u / R,
        r = R - z;
      const nu = r * Math.sin(th);
      z = R - r * Math.cos(th);
      if (ax === 0) x = nu;
      else y = nu;
    }
    p[i] = x;
    p[i + 1] = y;
    p[i + 2] = z;
  }
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  return g;
}
