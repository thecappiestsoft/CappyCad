// Zamienia czcionkę TTF na format typeface.json używany przez kształt „Tekst” (src/data/font.json).
// Zostawia tylko potrzebne znaki: ASCII + polskie litery + kilka symboli, żeby plik był mały.
//
//   node tools/font/convert-font.mjs [wejście.ttf] [wyjście.json]
//   domyślnie: tools/font/DejaVuSans-Bold.ttf -> src/data/font.json
//
// TTFLoader z three.js importuje opentype.js z adresu CDN — podmieniamy go na pakiet z node_modules,
// więc skrypt najpierw pakuje sam siebie esbuildem, a potem uruchamia wynik.
import * as esbuild from 'esbuild';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

const input = process.argv[2] || 'tools/font/DejaVuSans-Bold.ttf';
const output = process.argv[3] || 'src/data/font.json';

const worker = `
import { TTFLoader } from 'three/examples/jsm/loaders/TTFLoader.js';
import fs from 'fs';
const buf = fs.readFileSync(${JSON.stringify(path.resolve(input))});
const json = new TTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const keep = new Set([...Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)), ...'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ°±×÷€']);
for (const k of Object.keys(json.glyphs)) if (!keep.has(k)) delete json.glyphs[k];
fs.writeFileSync(${JSON.stringify(path.resolve(output))}, JSON.stringify(json));
console.log('Znaków w czcionce:', Object.keys(json.glyphs).length, '->', ${JSON.stringify(output)});
`;

const opentype = path.resolve('node_modules/opentype.js/dist/opentype.mjs');
const tmp = path.join(os.tmpdir(), `cappycad-font-${Date.now()}.mjs`);
await esbuild.build({
  stdin: { contents: worker, resolveDir: process.cwd(), loader: 'js' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: tmp,
  plugins: [
    {
      name: 'opentype-z-node_modules',
      setup(b) {
        b.onResolve({ filter: /^https:\/\/cdn/ }, () => ({ path: 'opentype-shim', namespace: 'shim' }));
        b.onLoad({ filter: /.*/, namespace: 'shim' }, () => ({
          contents: `import * as o from ${JSON.stringify(opentype)}; export * from ${JSON.stringify(opentype)}; export default o;`,
          resolveDir: process.cwd(),
        }));
      },
    },
  ],
});
await import(pathToFileURL(tmp).href);
fs.rmSync(tmp);
