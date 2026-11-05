// Składa cały program w JEDEN plik HTML (kod, style, obrazy, czcionka i silnik brył w środku).
// Plik działa offline: z dysku, z pendrive'a albo z dowolnego serwera WWW.
//
//   npm run build:html              -> dist/CappyCad.html
//   npm run build:html -- --artifact   dodatkowo dist/CappyCad-artifact.html
//                                     (sama treść bez <html>/<head>/<body> — do publikacji jako strona w Claude)
import * as esbuild from 'esbuild';
import fs from 'fs';
import { rendererBuild } from './esbuild-options.mjs';

const OUT_DIR = 'dist';
const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;

// 1. Kod interfejsu jako tekst (nie zapisujemy pliku pośredniego)
const result = await esbuild.build({ ...rendererBuild, target: 'es2020', write: false });
// "</script" wewnątrz kodu zamknęłoby znacznik <script> — zabezpieczamy
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

// 2. Style i obrazy osadzone bezpośrednio w pliku
const css = fs.readFileSync('src/style.css', 'utf8');
const dataUri = (file, mime) => `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
const icon = dataUri('src/assets/icon.png', 'image/png');
const capy = dataUri('src/assets/capy.png', 'image/png');

// 3. Podstawienie w index.html: style, obrazy, skrypt. Zasady CSP z wersji desktopowej usuwamy —
//    plik otwierany w przeglądarce nie potrzebuje ich, a blokowałyby osadzony kod.
let html = fs
  .readFileSync('src/index.html', 'utf8')
  .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/, '')
  .replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${css}\n</style>`)
  .replace(/src="icon\.png"/g, () => `src="${icon}"`)
  .replace(
    '<script src="app.js"></script>',
    () => `<script>window.__CAPPY_ASSETS={capy:"${capy}"};</script>\n<script>${js}</script>`,
  )
  .replace(
    '<title>CappyCad</title>',
    `<title>CappyCad</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="CappyCad ${version} — prosty modelarz 3D dla szkół">
<link rel="icon" href="${icon}">`,
  );

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(`${OUT_DIR}/CappyCad.html`, html);
const mb = f => (fs.statSync(f).size / 1048576).toFixed(2) + ' MB';
console.log(`Gotowe: ${OUT_DIR}/CappyCad.html (${mb(`${OUT_DIR}/CappyCad.html`)})`);

// 4. Opcjonalnie: wariant do publikacji jako strona w Claude (tytuł i style na początku, potem treść <body>)
if (process.argv.includes('--artifact')) {
  const head = html
    .match(/<head>([\s\S]*?)<\/head>/)[1]
    .replace(/<meta charset="utf-8">\n?/, '')
    .replace(/<meta name="viewport"[^>]*>\n?/, '')
    .replace(/<link rel="icon"[^>]*>\n?/, '');
  const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
  fs.writeFileSync(`${OUT_DIR}/CappyCad-artifact.html`, head.trim() + '\n' + body.trim() + '\n');
  console.log(`Gotowe: ${OUT_DIR}/CappyCad-artifact.html (${mb(`${OUT_DIR}/CappyCad-artifact.html`)})`);
}
