// Zapis 3MF (3D Manufacturing Format) — archiwum ZIP z modelem XML.
// Każdy obiekt jest osobną bryłą z własnym kolorem (basematerials) i nazwą, w rzeczywistym położeniu (mm).
// Slicery (PrusaSlicer, Bambu Studio, OrcaSlicer, Cura) wczytują obiekty osobno, więc można im przypisać
// różne filamenty — to podstawa druku wielokolorowego.
import { makeZip } from './zip.js';

const xmlEsc = s =>
  String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const num = v => {
  const s = (Math.round(v * 1e5) / 1e5).toString();
  return s === '-0' ? '0' : s;
};

// Nieindeksowane trójkąty -> wierzchołki scalone po położeniu + trójkąty (bez zdegenerowanych)
function indexMesh(pos) {
  const map = new Map(),
    verts = [],
    tris = [];
  const id = (x, y, z) => {
    const k = num(x) + ' ' + num(y) + ' ' + num(z);
    let i = map.get(k);
    if (i === undefined) {
      i = verts.length;
      verts.push(k);
      map.set(k, i);
    }
    return i;
  };
  for (let i = 0; i + 8 < pos.length; i += 9) {
    const a = id(pos[i], pos[i + 1], pos[i + 2]),
      b = id(pos[i + 3], pos[i + 4], pos[i + 5]),
      c = id(pos[i + 6], pos[i + 7], pos[i + 8]);
    if (a !== b && b !== c && a !== c) tris.push(a, b, c);
  }
  return { verts, tris };
}

// items: [{ name, color: '#rrggbb', positions: Float32Array (nieindeksowane trójkąty, mm) }]
export function build3MF(items, { title = 'CappyCad', app = 'CappyCad' } = {}) {
  const colors = [];
  const colorIdx = c => {
    const k = (/^#[0-9a-f]{6}$/i.test(c) ? c : '#868e96').toUpperCase();
    let i = colors.indexOf(k);
    if (i < 0) {
      i = colors.length;
      colors.push(k);
    }
    return i;
  };
  const parts = [];
  const objs = [];
  items.forEach((it, n) => {
    const { verts, tris } = indexMesh(it.positions);
    if (!tris.length) return;
    const id = n + 2;
    const v = verts.map(k => {
      const [x, y, z] = k.split(' ');
      return `<vertex x="${x}" y="${y}" z="${z}"/>`;
    });
    const t = [];
    for (let i = 0; i < tris.length; i += 3)
      t.push(`<triangle v1="${tris[i]}" v2="${tris[i + 1]}" v3="${tris[i + 2]}"/>`);
    parts.push(
      `<object id="${id}" type="model" name="${xmlEsc(it.name)}" pid="1" pindex="${colorIdx(it.color)}"><mesh><vertices>${v.join('')}</vertices><triangles>${t.join('')}</triangles></mesh></object>`,
    );
    objs.push(id);
  });
  const mats = colors.map(c => `<base name="${c}" displaycolor="${c}FF"/>`).join('');
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="pl-PL" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Title">${xmlEsc(title)}</metadata>
<metadata name="Application">${xmlEsc(app)}</metadata>
<resources><basematerials id="1">${mats}</basematerials>
${parts.join('\n')}
</resources>
<build>${objs.map(id => `<item objectid="${id}"/>`).join('')}</build>
</model>
`;
  const types = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>
`;
  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>
`;
  return {
    count: objs.length,
    blob: makeZip([
      { name: '[Content_Types].xml', data: types },
      { name: '_rels/.rels', data: rels },
      { name: '3D/3dmodel.model', data: model },
    ]),
  };
}
