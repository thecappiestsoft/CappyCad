# Biblioteki i zasoby zewnętrzne

CappyCad jest udostępniony na licencji **MIT** (plik `LICENSE`, © 2026 CappySoft.pl).

Program wbudowuje (w pliku `app/app.js` lub `CappyCad.html`) poniższe biblioteki. Ich licencje są zgodne z MIT
i pozwalają na użycie, także komercyjne, pod warunkiem zachowania informacji o prawach autorskich i licencji —
dlatego budowanie zachowuje komentarze licencyjne bibliotek na końcu kodu (`legalComments: 'eof'`).

| Składnik                  | Do czego służy                                   | Licencja       |
| ------------------------- | ------------------------------------------------ | -------------- |
| three.js                  | grafika 3D, eksport/import STL i OBJ, SVG         | MIT            |
| manifold-3d               | szczelne operacje logiczne na bryłach (WASM)      | Apache-2.0     |
| three-bvh-csg, three-mesh-bvh | zapasowy silnik operacji na bryłach           | MIT            |
| polygon-clipping          | operacje na wielokątach (kapibara z siatką)       | MIT            |
| DejaVu Sans Bold          | czcionka kształtu „Tekst” (`src/data/font.json`)  | licencja Bitstream Vera / DejaVu (wolna) |
| Electron                  | okno programu w wersjach desktopowych             | MIT            |

Narzędzia budowania (nie trafiają do programu): esbuild (MIT), electron-builder (MIT), Prettier (MIT),
opentype.js (MIT, tylko konwersja czcionki).

Pełne teksty licencji znajdują się w katalogach pakietów w `node_modules/` po instalacji zależności.
