# Architektura CappyCad

Dokument dla programistów: jak zbudowany jest program, gdzie szukać danej funkcji i jak go rozwijać.

## 1. Warstwy

```
┌───────────────────────────── electron/ (tylko wersja desktopowa) ─────────────────────────────┐
│ main.js     okno programu, systemowe okna Otwórz/Zapisz, motyw i język okien systemowych,     │
│             blokada nawigacji (offline), otwieranie pliku .cappycad podanego przy starcie      │
│ preload.js  bezpieczny most window.cappycad: openFile, saveFile, startupFile, setTheme, setLang│
└───────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                │ IPC (contextIsolation, sandbox)
┌───────────────────────────────────────────────▼───────────────────────────────────────────────┐
│ src/ — interfejs (ten sam kod w Electronie i w przeglądarce)                                   │
│   app.js  ─ scena, obiekty, narzędzia, panele, pliki                                           │
│     ├─ shapes.js ─ katalog kształtów + generatory  ─┬─ mech.js (gwinty, śruby)                  │
│     │                                               ├─ csg.js → solid.js (Manifold)            │
│     │                                               └─ data/font.json, data/capy-outline.json   │
│     ├─ deform.js (wyginanie)   ├─ examples.js (lekcje)   ├─ capy.js (pomocnik)                  │
│     └─ i18n.js + i18n-en.js (tłumaczenie)   ├─ help.js   ├─ icons.js   └─ zip.js                │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Gdy `window.cappycad` nie istnieje (przeglądarka), `app.js` używa zamienników: pole wyboru pliku zamiast okna
systemowego, pobieranie pliku przez link, a na stronie w Claude — funkcji `downloads` strony.

## 2. Układ współrzędnych i jednostki

- Jednostka: **milimetr**. Oś **Z w górę** (`camera.up = (0,0,1)`), płaszczyzna robocza to Z = 0.
- Położenie obiektu (`pos`) oznacza **środek jego podstawy**.

## 3. Od parametrów do bryły na ekranie

```
SHAPES[type] (etykieta, kolor, parametry)
      │ makeRaw(type, params)            surowa geometria Three.js, dowolny rozmiar i położenie
      ▼
normalizeGeometry()                      bez indeksów, poprawna orientacja trójkątów, odbicie lustrzane,
      │                                  środek podstawy w (0,0,0)
      ▼
geomFor(d)  ── pamięć podręczna (klucz: typ + parametry + odbicie [+ deformacja])
      │       zwraca { geom, baseSize } — baseSize to naturalne wymiary geometrii
      ▼
THREE.Mesh: scale = size / baseSize      obiekt na scenie ma wymiary `size` (mm)
```

- Zmiana wymiarów to tylko zmiana skali siatki (szybko). Zmiana parametru (np. liczba boków, rozmiar M6) przebudowuje
  geometrię (`rebuildGeometry`).
- Kształty „rzeczywiste” (`real: true`, np. śruby) mają skalę 1 — ich wymiary wynikają z normy, nie ze skalowania.
- **Deformacje** (`deform.js`): geometria jest najpierw przeskalowana do rzeczywistych wymiarów (`dsize`), pocięta
  płaszczyznami na plasterki (bez T-złączeń), a potem wygięta / skręcona / zwężona. Wynik ma skalę 1.

## 4. Grupy i operacje logiczne (CSG)

- Grupa (`type: 'group'`) przechowuje **zserializowane części** (`children`) i macierz `frame0`
  (układ grupy w chwili utworzenia). Jej geometria jest liczona w `csgGroup()`: suma brył minus suma otworów.
- `csg.js` → `solid.js`: silnik **Manifold** (WASM, wbudowany w kod). Wejściowe trójkąty są scalane po położeniu
  wierzchołków, trójkąty o zerowej powierzchni są usuwane, a wynik jest zawsze szczelny (każda krawędź należy do
  dokładnie dwóch trójkątów). Gdy wejście nie jest zamknięte (np. uszkodzony import STL), działa zapasowy
  `three-bvh-csg`.
- Silnik ładuje się asynchronicznie (`csg.ready`); paleta i przywracanie projektu czekają na niego.
- **Eksport STL** (`exportSolid`): wszystkie bryły są łączone w jedną szczelną bryłę. **OBJ**: osobne obiekty
  z kolorami, każdy oczyszczony.

## 5. Formaty danych

### Obiekt (rekord w `app.js`, zapis przez `serialize()`)

| Pole                | Znaczenie                                                                 |
| ------------------- | ------------------------------------------------------------------------- |
| `id`, `type`, `name`| identyfikator, typ z `SHAPES`, nazwa widoczna dla użytkownika             |
| `color`, `hole`     | kolor (#rrggbb); `true` = otwór (wycina przy grupowaniu)                  |
| `params`            | parametry kształtu (np. `{ sides: 48 }`, `{ size: 'M8', length: 30 }`)    |
| `pos`, `quat`, `size` | środek podstawy (mm), obrót (kwaternion), wymiary (mm)                  |
| `mirror`            | odbicie lustrzane `[±1, ±1, ±1]`                                          |
| `children`, `frame0`| tylko grupa: części i macierz układu grupy                                |
| `dataKey`           | modele STL/OBJ, SVG, obrazy: klucz do danych w `data` projektu            |
| `deform`, `dsize`   | deformacja `{ bend, axis, twist, taper }` i wymiary przed deformacją      |
| `locked`, `hidden`  | szablony: zablokowany / ukryty                                            |

### Projekt `.cappycad` (JSON)

```json
{ "app": "CappyCad", "format": 2, "name": "Domek", "workplane": { "x": 200, "y": 200 },
  "objects": [ /* obiekty */ ], "data": { "m…": "<base64 Float32 pozycji>", "s…": "<tekst SVG>", "i…": "data:image/…" } }
```

Otwierane są też projekty starszych nazw programu (`"app": "CapyCad"` / `"BlokCAD"`).
Biblioteka „Moje kształty” (`.cappylib`): `{ app, library: [{ id, name, objects, data }] }`.

### Pamięć przeglądarki (`localStorage`, tylko wygoda użytkownika)

`cappycad-autosave` (ostatni niezapisany stan), `cappycad-library`, `cappycad-theme`, `cappycad-lang`,
`cappycad-sections` (rozwinięte sekcje palety), `cappycad-insp-collapsed`, `cappycad-capy-*` (pomocnik).

## 6. Interfejs

- **Panel obiektu** (`renderInspector`) jest generowany od nowa przy każdej zmianie zaznaczenia; pola liczbowe
  odświeża `updateInspectorValues()` w trakcie przeciągania. Można go zwinąć do uchwytu (stan w `localStorage`).
- **Historia**: każda zakończona operacja wywołuje `commit()`, który zapisuje migawkę JSON sceny; cofanie odtwarza
  migawkę (`restore`). `commit()` uruchamia też podpowiedzi Cappy i sprawdzanie kroków ćwiczeń.
- **Tłumaczenie** (`i18n.js`): teksty w kodzie są po polsku; w trybie angielskim `MutationObserver` podmienia teksty
  i atrybuty `title` według słownika `i18n-en.js` (dokładne dopasowania + wzorce). Elementy z atrybutem `data-notr`
  (np. nazwy nadane przez użytkownika) nie są tłumaczone.
  Dodając nowy tekst interfejsu, dopisz jego tłumaczenie w `src/i18n-en.js`.
- **Motyw**: zmienne CSS na `:root` (jasny) i `:root[data-theme="dark"]`; scena 3D ma własne kolory w `THEMES`.

## 7. Jak dodać…

- **nowy kształt** — wpis w `SHAPES` (`src/shapes.js`: etykieta, kolor, parametry), gałąź `case` w `makeRaw()`,
  kafelek w tablicy `PALETTE` (`src/app.js`), tłumaczenie etykiety w `src/i18n-en.js`. Sprawdź `npm run check:mesh`.
- **przykład lub ćwiczenie** — `src/examples.js` (opis formatu na początku pliku). Kroki ćwiczeń sprawdza `exCheck()`.
- **poradę Cappy** — tablica `TIPS` lub `SITUATIONS` w `src/capy.js` (zawsze `pl` i `en`).
- **skrót klawiszowy** — obsługa `keydown` w sekcji „klawiatura” (`app.js`) i wpis w `src/help.js` (PL i EN).

## 8. Budowanie i testy

- `scripts/esbuild-options.mjs` — wspólne ustawienia pakowania (JSON i WASM wbudowane w kod).
- `scripts/build.mjs` → `app/` (Electron); `scripts/build-html.mjs` → `dist/CappyCad.html`.
- `electron-builder.yml` — instalatory; `scripts/after-pack.cjs` — podpis ad-hoc aplikacji macOS.
- `test/run.mjs` uruchamia `test/electron-runner.cjs`, który otwiera program i wykonuje
  `test/smoke.in-page.js` przez mostek `window.__cappycad` (koniec `app.js`). Na serwerze bez ekranu używa `xvfb-run`.

## 9. Narzędzia (`tools/`)

- `font/convert-font.mjs` — TTF → `src/data/font.json` (tylko potrzebne znaki, w tym polskie).
- `capybara/trace-capybara.py` — obrys i siatka kapibary z obrazu logo → `src/data/capy-outline.json`.
- `check-mesh.mjs` — raport szczelności siatek wszystkich kształtów.
