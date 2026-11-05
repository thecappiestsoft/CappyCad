// Buduje interfejs programu do folderu app/ (używany przez Electron i electron-builder).
//   npm run build
import * as esbuild from 'esbuild';
import fs from 'fs';
import { rendererBuild } from './esbuild-options.mjs';

const OUT = 'app';

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);

await esbuild.build({ ...rendererBuild, target: 'chrome120', outfile: `${OUT}/app.js` });

fs.copyFileSync('src/index.html', `${OUT}/index.html`);
fs.copyFileSync('src/style.css', `${OUT}/style.css`);
for (const f of fs.readdirSync('src/assets')) fs.copyFileSync(`src/assets/${f}`, `${OUT}/${f}`);
// tekst licencji MIT i lista bibliotek zewnętrznych trafiają do każdej paczki programu
fs.copyFileSync('LICENSE', `${OUT}/LICENSE.txt`);
fs.copyFileSync('docs/LICENCJE-ZEWNETRZNE.md', `${OUT}/LICENCJE-ZEWNETRZNE.md`);

const kb = (fs.statSync(`${OUT}/app.js`).size / 1024).toFixed(0);
console.log(`Interfejs zbudowany: ${OUT}/ (app.js ${kb} KB)`);
