# CappyCad

Prosty modelarz 3D dla szkół w stylu Tinkercada, działający **w pełni offline**.
Wersje: Windows, macOS (Intel i Apple Silicon), Linux (Debian/Ubuntu, Arch, AppImage) oraz **jeden plik HTML** do przeglądarki.

© 2026 CappySoft.pl

---

## Szybki start dla programisty

Wymagany **Node.js 20 lub nowszy** (https://nodejs.org, wersja LTS).

```bash
npm install        # zależności (pobiera m.in. Electron)
npm start          # buduje interfejs i uruchamia program w trybie deweloperskim
```

Po zmianie kodu w `src/` zamknij okno i uruchom `npm start` ponownie (budowanie trwa ok. 1 s).
Narzędzia deweloperskie przeglądarki w oknie programu: **Ctrl+Shift+I**.

| Polecenie                | Co robi                                                                    |
| ------------------------ | -------------------------------------------------------------------------- |
| `npm start`              | buduje interfejs (`app/`) i uruchamia program                              |
| `npm run build`          | tylko buduje interfejs do `app/`                                           |
| `npm test`               | test dymny: uruchamia program i sprawdza kluczowe funkcje (ok. 15 s)       |
| `npm run check:mesh`     | sprawdza, czy wszystkie kształty dają szczelne siatki do druku 3D          |
| `npm run build:html`     | składa cały program w jeden plik `dist/CappyCad.html`                      |
| `npm run dist:win`       | instalator i wersja przenośna Windows → `release/`                         |
| `npm run dist:mac`       | aplikacja macOS (Intel + Apple Silicon) → `release/`                       |
| `npm run dist:linux`     | `.deb`, `.AppImage`, `.tar.gz` → `release/`                                |
| `npm run dist:linux:arch`| pakiet Arch Linux (`.pkg.tar.xz`, wymaga programu `bsdtar`)                |
| `npm run dist:all`       | wszystko naraz z jednego Linuksa (wymaga wine — patrz `scripts/build-all.mjs`) |
| `npm run format`         | formatowanie kodu (Prettier)                                               |

## Gotowe skrypty budowania (dla osób, które nie programują)

Skrypty same sprawdzają Node.js, instalują zależności, uruchamiają test i budują program.
Pierwsze uruchomienie wymaga internetu (pobranie zależności) i trwa kilka minut.

| System  | Wersja desktopowa                                     | Jeden plik HTML                         |
| ------- | ----------------------------------------------------- | --------------------------------------- |
| Windows | `build-windows.bat` (dwuklik)                         | `build-html.bat` (dwuklik)              |
| macOS   | `build-macos.command` (dwuklik)                       | `build-html.command` (dwuklik)          |
| Linux   | `./build-linux.sh`                                    | `./build-html.sh`                       |

- Wyniki: wersje desktopowe w `release/`, plik HTML w `dist/CappyCad.html`.
- Test można pominąć: `build-windows.bat --skip-tests`, `./build-linux.sh --skip-tests`.
- Każdy system buduje wersję dla siebie (Windows → Windows, Mac → Mac, Linux → Linux).
  Wszystkie wersje z jednego komputera: `npm run dist:all` na Linuksie (opis w `scripts/build-all.mjs`).
- macOS: jeśli system nie pozwala uruchomić pliku `.command`, wykonaj w Terminalu `chmod +x *.command *.sh`.
- Linux: pakiet dla Archa powstaje tylko, gdy zainstalowany jest `bsdtar`
  (`sudo apt install libarchive-tools` lub `sudo pacman -S libarchive`).

## Struktura projektu

```
src/                    kod interfejsu (przeglądarka / okno Electrona)
  app.js                główny moduł: scena, obiekty, narzędzia, panele, pliki (spis treści na początku pliku)
  shapes.js             katalog kształtów (SHAPES) i ich generatory (makeRaw), import SVG
  mech.js               gwinty metryczne ISO, śruby, nakrętki, otwory normowe
  deform.js             wyginanie, skręcanie, zwężanie
  csg.js                łączenie / wycinanie brył (Manifold, z zapasowym three-bvh-csg)
  solid.js              warstwa nad biblioteką Manifold (szczelne siatki do druku)
  geomutil.js           drobne narzędzia geometrii (orientacja trójkątów, czyszczenie atrybutów)
  examples.js           przykładowe projekty i ćwiczenia (dane dwujęzyczne)
  capy.js               pomocnik Cappy: porady i podpowiedzi sytuacyjne
  help.js               okno pomocy (PL / EN)
  i18n.js, i18n-en.js   tłumaczenie interfejsu i słownik angielski
  icons.js              ikony SVG interfejsu
  zip.js                zapis archiwum ZIP (pobieranie STL/OBJ w przeglądarce)
  index.html, style.css układ i wygląd (motyw jasny i ciemny)
  assets/               obrazy interfejsu (ikona, Cappy)
  data/                 dane generowane: czcionka (font.json), obrys kapibary (capy-outline.json)
electron/               proces główny Electrona (okno, systemowe okna plików) i preload
scripts/                budowanie: interfejs, jeden plik HTML, wszystkie wersje, podpis macOS
test/                   test dymny uruchamiany w oknie programu
tools/                  narzędzia: konwersja czcionki, obrys kapibary z logo, kontrola siatek
assets/                 ikony aplikacji dla instalatorów (ico, icns, png) i ikona źródłowa
docs/                   dokumentacja: architektura, licencje; docs/user/ — instrukcje dla użytkowników
build-*.bat / .command / .sh   gotowe skrypty budowania
electron-builder.yml    konfiguracja instalatorów i paczek
```

Foldery `app/`, `dist/`, `release/` i `node_modules/` powstają podczas budowania — nie trzymaj ich w repozytorium.

## Jak to działa — w skrócie

Szczegóły: **[docs/ARCHITEKTURA.md](docs/ARCHITEKTURA.md)**.

- **Jeden kod, trzy postacie.** Interfejs (`src/`) jest pakowany esbuildem do jednego pliku JS. Electron wyświetla go
  w oknie programu, a `scripts/build-html.mjs` osadza go razem ze stylami i obrazami w jednym pliku HTML.
- **Kształty** to funkcje generujące geometrię (`makeRaw`) z parametrów. Każda geometria jest normalizowana
  (środek podstawy w punkcie 0,0,0) i zapamiętywana; obiekt na scenie to ta geometria przeskalowana do wymiarów w mm.
- **Grupowanie** wykonuje operacje logiczne (suma brył, odjęcie otworów) silnikiem **Manifold**, który zawsze zwraca
  szczelną siatkę — wymóg slicerów drukarek 3D. Eksport STL łączy wszystkie bryły w jedną szczelną bryłę.
- **Projekt** (`.cappycad`) to JSON: lista obiektów z parametrami i położeniem. Grupy przechowują swoje części,
  więc można je rozgrupować także po ponownym otwarciu.
- **Offline i prywatność:** program nie wykonuje żadnych połączeń sieciowych; Electron blokuje nawigację i nowe okna.

## Licencja

Kod: © 2026 CappySoft.pl, wszelkie prawa zastrzeżone (`"license": "UNLICENSED"` w `package.json`) — do ustalenia
przez właściciela przed publikacją. Biblioteki zewnętrzne i ich licencje: [docs/LICENCJE-ZEWNETRZNE.md](docs/LICENCJE-ZEWNETRZNE.md).
