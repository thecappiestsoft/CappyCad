// Wspólne ustawienia pakowania kodu interfejsu (src/app.js + moduły) w jeden plik JavaScript.
// Używane przez scripts/build.mjs (wersja desktopowa) i scripts/build-html.mjs (jeden plik .html).

/** @type {import('esbuild').BuildOptions} */
export const rendererBuild = {
  entryPoints: ['src/app.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  legalComments: 'none',
  loader: {
    '.json': 'json', // dane: czcionka, obrys kapibary
    '.wasm': 'binary', // silnik brył Manifold — wbudowany w kod jako Uint8Array
  },
  // manifold-3d importuje moduł Node tylko podczas pracy w Node.js — w przeglądarce nieużywany
  external: ['node:module'],
};
