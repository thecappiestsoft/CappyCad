// Przykładowe projekty i ćwiczenia (offline, wbudowane w program). Wszystkie teksty: { pl, en }.
//
// EXAMPLES — gotowe projekty otwierane z okna „Lekcje”:
//   { id, level: 1|2, title, desc, build(B) }
//   build(B) zwraca listę obiektów sceny, budowanych pomocnikiem B (exampleBuilder w app.js):
//     B.add(typ, { size?: [x,y,z] mm, pos?: [x,y,z], rot?: [x,y,z] stopnie, params?, hole?, color?, name?,
//                  height?/depth? — dla tekstu: wysokość liter i grubość })
//     B.group([obiekty], { color?, name? }) — grupa: suma brył minus otwory (jak przycisk Grupuj)
//
// EXERCISES — ćwiczenia krok po kroku:
//   { id, level, minutes, title, goal, steps: [{ pl, en, check }], hint, solution?: id przykładu }
//   check — warunek automatycznego odhaczenia kroku (exCheck w app.js), np. 'has:box', 'size:30,30,10',
//   'groupWithHole', 'stacked', 'measured', 'saved', 'exported'; 'manual' = uczeń odhacza sam.

export const EXAMPLES = [
  {
    id: 'keychain',
    level: 1,
    icon: '🔑',
    title: { pl: 'Brelok z imieniem', en: 'Name keychain' },
    desc: {
      pl: 'Podstawka z otworem na kółko i wypukły napis w drugim kolorze.',
      en: 'A tag with a hole for a key ring and raised text in a second color.',
    },
    build(B) {
      const plate = B.group(
        [
          B.add('box', { size: [46, 22, 3] }),
          B.add('cylinder', { size: [22, 22, 3], pos: [-23, 0, 0] }),
          B.add('cylinder', { size: [22, 22, 3], pos: [23, 0, 0] }),
          B.add('cylinder', { size: [6, 6, 10], pos: [-27, 0, -2], hole: true }),
        ],
        { color: '#1098ad', name: { pl: 'Brelok', en: 'Keychain' } },
      );
      return [
        plate,
        B.add('text', { params: { text: 'Ola' }, height: 11, depth: 1.6, pos: [5, 0, 3], color: '#f8f9fa' }),
      ];
    },
  },
  {
    id: 'house',
    level: 1,
    icon: '🏠',
    title: { pl: 'Domek', en: 'Little house' },
    desc: {
      pl: 'Ściany z wyciętymi drzwiami i oknami, dach i komin.',
      en: 'Walls with cut-out door and windows, a roof and a chimney.',
    },
    build(B) {
      const walls = B.group(
        [
          B.add('box', { size: [50, 40, 30] }),
          B.add('box', { size: [12, 8, 20], pos: [0, -20, -1], hole: true }),
          B.add('box', { size: [10, 8, 10], pos: [-15, -20, 12], hole: true }),
          B.add('box', { size: [10, 8, 10], pos: [15, -20, 12], hole: true }),
        ],
        { color: '#f1e3c8', name: { pl: 'Ściany', en: 'Walls' } },
      );
      return [
        walls,
        B.add('roof', { size: [56, 46, 20], pos: [0, 0, 30], color: '#e03131' }),
        B.add('box', { size: [7, 7, 16], pos: [14, 8, 34], color: '#868e96', name: { pl: 'Komin', en: 'Chimney' } }),
      ];
    },
  },
  {
    id: 'penholder',
    level: 1,
    icon: '✏️',
    title: { pl: 'Pojemnik na długopisy', en: 'Pen holder' },
    desc: {
      pl: 'Walec z wydrążonym środkiem i kapibarą na froncie.',
      en: 'A hollow cylinder with a capybara on the front.',
    },
    build(B) {
      const cup = B.group(
        [
          B.add('cylinder', { size: [70, 70, 95] }),
          B.add('cylinder', { size: [63, 63, 95], pos: [0, 0, 3], hole: true }),
        ],
        { color: '#4263eb', name: { pl: 'Pojemnik', en: 'Holder' } },
      );
      return [cup, B.add('capybara', { params: { thick: 3 }, pos: [0, -36, 30], rot: [90, 0, 0], color: '#b97f52' })];
    },
  },
  {
    id: 'box',
    level: 2,
    icon: '📦',
    title: { pl: 'Pudełko z pokrywką', en: 'Box with a lid' },
    desc: {
      pl: 'Ścianki 2 mm i pokrywka z kołnierzem — z luzem 0,3 mm, żeby pasowała po wydruku.',
      en: '2 mm walls and a lid with a rim — with 0.3 mm clearance so it fits after printing.',
    },
    build(B) {
      const box = B.group(
        [B.add('box', { size: [64, 44, 32] }), B.add('box', { size: [60, 40, 32], pos: [0, 0, 2], hole: true })],
        { color: '#fab005', name: { pl: 'Pudełko', en: 'Box' } },
      );
      const lid = B.group(
        [
          B.add('box', { size: [64, 44, 2], pos: [80, 0, 0] }),
          B.add('box', { size: [59.4, 39.4, 6], pos: [80, 0, 0] }),
          B.add('box', { size: [55.4, 35.4, 6], pos: [80, 0, 2], hole: true }),
        ],
        { color: '#f08c00', name: { pl: 'Pokrywka', en: 'Lid' } },
      );
      return [box, lid];
    },
  },
  {
    id: 'bolts',
    level: 2,
    icon: '🔩',
    title: { pl: 'Śruba, nakrętka i gwint', en: 'Bolt, nut and thread' },
    desc: {
      pl: 'Śruba M8, nakrętka, podkładka i klocek z gwintem wewnętrznym — wszystko w wymiarach ISO.',
      en: 'An M8 bolt, nut, washer and a block with an internal thread — all ISO sizes.',
    },
    build(B) {
      const block = B.group(
        [
          B.add('box', { size: [26, 26, 16], pos: [45, 0, 0] }),
          B.add('tapHole', { params: { size: 'M8', length: 18 }, pos: [45, 0, -1] }),
        ],
        { color: '#37b24d', name: { pl: 'Klocek z gwintem M8', en: 'Block with M8 thread' } },
      );
      return [
        B.add('bolt', { params: { size: 'M8', length: 30 }, pos: [-30, 0, 0] }),
        B.add('nut', { params: { size: 'M8' }, pos: [0, 0, 0] }),
        B.add('tube', {
          params: { wall: 47 },
          size: [16, 16, 1.6],
          pos: [0, 22, 0],
          name: { pl: 'Podkładka M8', en: 'M8 washer' },
        }),
        block,
      ];
    },
  },
  {
    id: 'stand',
    level: 2,
    icon: '📱',
    title: { pl: 'Podstawka pod telefon', en: 'Phone stand' },
    desc: {
      pl: 'Podstawa, pochylone oparcie i rant, który przytrzymuje telefon.',
      en: 'A base, a tilted back and a lip that holds the phone.',
    },
    build(B) {
      return [
        B.group(
          [
            B.add('box', { size: [70, 80, 6] }),
            B.add('box', { size: [70, 7, 85], pos: [0, 14, 2], rot: [-22, 0, 0] }),
            B.add('box', { size: [70, 8, 16], pos: [0, -36, 0] }),
            B.add('box', { size: [24, 20, 30], pos: [0, -24, 4], hole: true }),
          ],
          { color: '#7048e8', name: { pl: 'Podstawka', en: 'Stand' } },
        ),
      ];
    },
  },
  {
    id: 'ornament',
    level: 1,
    icon: '⭐',
    title: { pl: 'Zawieszka gwiazdka', en: 'Star ornament' },
    desc: {
      pl: 'Płaska gwiazda z uszkiem — idealna na choinkę lub do plecaka.',
      en: 'A flat star with a loop — perfect for a tree or a backpack.',
    },
    build(B) {
      return [
        B.group(
          [
            B.add('star', { size: [50, 47.6, 5] }),
            B.add('torus', { params: { thick: 40 }, size: [13, 13, 4], pos: [0, 28, 0] }),
          ],
          { color: '#fcc419', name: { pl: 'Gwiazdka', en: 'Star' } },
        ),
      ];
    },
  },
  {
    id: 'capykey',
    level: 1,
    icon: '🐹',
    title: { pl: 'Brelok kapibara', en: 'Capybara keychain' },
    desc: {
      pl: 'Kapibara z logo CappyCad z ażurową siatką — kółko na klucze przełożysz przez oczko siatki.',
      en: 'The CappyCad logo capybara with an openwork mesh — thread a key ring through the mesh.',
    },
    build(B) {
      return [
        B.add('capybara', {
          params: { style: 'mesh', thick: 4, strut: 1.8 },
          name: { pl: 'Brelok kapibara', en: 'Capybara keychain' },
        }),
      ];
    },
  },
  {
    id: 'platonic',
    level: 1,
    icon: '📐',
    title: { pl: 'Bryły platońskie', en: 'Platonic solids' },
    desc: {
      pl: 'Pięć brył foremnych z liczbą ścian — na lekcję matematyki.',
      en: 'All five regular solids with their number of faces — for a maths lesson.',
    },
    build(B) {
      const out = [];
      [
        ['tetra', 4, '#12b886'],
        ['box', 6, '#e5484d'],
        ['octa', 8, '#7950f2'],
        ['dodeca', 12, '#fd7e14'],
        ['icosa', 20, '#15aabf'],
      ].forEach(([t, f, c], i) => {
        const x = -64 + i * 32;
        out.push(B.add(t, { size: t === 'box' ? [18, 18, 18] : undefined, pos: [x, 0, 0], color: c }));
        out.push(
          B.add('text', { params: { text: String(f) }, height: 8, depth: 1.5, pos: [x, -22, 0], color: '#495057' }),
        );
      });
      return out;
    },
  },
  {
    id: 'scale',
    level: 1,
    icon: '🍌',
    title: { pl: 'Banan do skali', en: 'Banana for scale' },
    desc: {
      pl: 'Jak duży jest Twój projekt naprawdę? Porównaj go z bananem (ok. 18 cm).',
      en: 'How big is your design really? Compare it with a banana (about 18 cm).',
    },
    build(B) {
      return [
        B.add('banana', { pos: [0, -25, 0] }),
        B.add('capybara', { pos: [-45, 35, 0] }),
        B.add('box', { size: [20, 20, 20], pos: [40, 35, 0] }),
      ];
    },
  },
];

// Ćwiczenia: kroki z automatycznym sprawdzaniem (check) i podpowiedziami
export const EXERCISES = [
  {
    id: 'first',
    level: 1,
    minutes: 5,
    icon: '🧱',
    title: { pl: 'Pierwsze kroki', en: 'First steps' },
    goal: {
      pl: 'Poznasz paletę, zmianę wymiarów i kolorów oraz układanie brył jedna na drugiej.',
      en: 'Learn the palette, changing size and color, and stacking solids.',
    },
    steps: [
      { pl: 'Dodaj sześcian z palety.', en: 'Add a box from the palette.', check: 'has:box' },
      {
        pl: 'Zmień jego wymiary na 30 × 30 × 10 mm (panel po prawej).',
        en: 'Change its size to 30 × 30 × 10 mm (panel on the right).',
        check: 'size:30,30,10',
      },
      { pl: 'Nadaj mu inny kolor.', en: 'Give it a different color.', check: 'recolored' },
      {
        pl: 'Dodaj walec i postaw go na sześcianie.',
        en: 'Add a cylinder and place it on top of the box.',
        check: 'stacked',
      },
      { pl: 'Zapisz projekt (Ctrl+S).', en: 'Save the project (Ctrl+S).', check: 'saved' },
    ],
    hint: {
      pl: 'Walec podniesiesz czarnym uchwytem strzałki w górę albo wpisując Z = 10 w panelu.',
      en: 'Raise the cylinder with the up arrow handle or by typing Z = 10 in the panel.',
    },
  },
  {
    id: 'hole',
    level: 1,
    minutes: 10,
    icon: '🕳️',
    title: { pl: 'Robimy dziurę', en: 'Making a hole' },
    goal: { pl: 'Nauczysz się wycinać otwory i mierzyć miarką.', en: 'Learn to cut holes and measure with the ruler.' },
    steps: [
      { pl: 'Dodaj sześcian.', en: 'Add a box.', check: 'has:box' },
      { pl: 'Dodaj walec i ustaw go jako Otwór.', en: 'Add a cylinder and set it to Hole.', check: 'hole' },
      {
        pl: 'Przesuń otwór tak, by przechodził przez sześcian.',
        en: 'Move the hole so it goes through the box.',
        check: 'manual',
      },
      {
        pl: 'Zaznacz oba obiekty i kliknij Grupuj.',
        en: 'Select both objects and click Group.',
        check: 'groupWithHole',
      },
      {
        pl: 'Zmierz średnicę otworu Miarką (L).',
        en: 'Measure the hole diameter with the Ruler (L).',
        check: 'measured',
      },
    ],
    hint: { pl: 'Shift+klik dodaje obiekt do zaznaczenia.', en: 'Shift+click adds an object to the selection.' },
    solution: null,
  },
  {
    id: 'keychain',
    level: 1,
    minutes: 15,
    icon: '🔑',
    title: { pl: 'Brelok z imieniem', en: 'Name keychain' },
    goal: {
      pl: 'Zaprojektujesz i przygotujesz do druku własny brelok.',
      en: 'Design your own keychain and get it ready to print.',
    },
    steps: [
      { pl: 'Zrób podstawkę ok. 50 × 20 × 3 mm.', en: 'Make a base about 50 × 20 × 3 mm.', check: 'flatPlate' },
      {
        pl: 'Dodaj Tekst i wpisz swoje imię w parametrach.',
        en: 'Add Text and type your name in the parameters.',
        check: 'customText',
      },
      { pl: 'Połóż napis na podstawce (Z = 3).', en: 'Put the text on the base (Z = 3).', check: 'stacked' },
      {
        pl: 'Wytnij otwór na kółko (walec-otwór + Grupuj).',
        en: 'Cut a hole for the ring (hole cylinder + Group).',
        check: 'groupWithHole',
      },
      { pl: 'Wyeksportuj model do STL.', en: 'Export the model to STL.', check: 'exported' },
    ],
    hint: {
      pl: 'Otwór na kółko powinien mieć min. 4 mm średnicy i 2 mm od brzegu.',
      en: 'The ring hole should be at least 4 mm wide and 2 mm from the edge.',
    },
    solution: 'keychain',
  },
  {
    id: 'house',
    level: 1,
    minutes: 15,
    icon: '🏠',
    title: { pl: 'Domek', en: 'Little house' },
    goal: {
      pl: 'Złożysz model z kilku brył i wytniesz drzwi oraz okna.',
      en: 'Build a model from several solids and cut out a door and windows.',
    },
    steps: [
      { pl: 'Dodaj sześcian jako ściany domu.', en: 'Add a box for the walls.', check: 'has:box' },
      { pl: 'Dodaj dach i postaw go na ścianach.', en: 'Add a roof and place it on the walls.', check: 'has:roof' },
      {
        pl: 'Wytnij drzwi i co najmniej jedno okno.',
        en: 'Cut a door and at least one window.',
        check: 'groupWithHole',
      },
      { pl: 'Dodaj komin.', en: 'Add a chimney.', check: 'count:3' },
      {
        pl: 'Obejrzyj domek z przodu i z góry (przyciski widoku po lewej).',
        en: 'Look at the house from the front and top (view buttons on the left).',
        check: 'manual',
      },
    ],
    hint: {
      pl: 'Dach jest szerszy od ścian? Użyj Wyrównaj, aby go wyśrodkować.',
      en: 'Is the roof wider than the walls? Use Align to center it.',
    },
    solution: 'house',
  },
  {
    id: 'box',
    level: 2,
    minutes: 25,
    icon: '📦',
    title: { pl: 'Pudełko z pokrywką', en: 'Box with a lid' },
    goal: {
      pl: 'Poznasz grubość ścianek i luz potrzebny, żeby części do siebie pasowały.',
      en: 'Learn about wall thickness and the clearance parts need to fit together.',
    },
    steps: [
      { pl: 'Zrób sześcian 64 × 44 × 32 mm.', en: 'Make a 64 × 44 × 32 mm box.', check: 'size:64,44,32' },
      {
        pl: 'Wydrąż go otworem 60 × 40 mm podniesionym o 2 mm (dno).',
        en: 'Hollow it with a 60 × 40 mm hole raised by 2 mm (the floor).',
        check: 'groupWithHole',
      },
      {
        pl: 'Zrób pokrywkę 64 × 44 × 2 mm obok pudełka.',
        en: 'Make a 64 × 44 × 2 mm lid next to the box.',
        check: 'size:64,44,2',
      },
      {
        pl: 'Dodaj kołnierz mniejszy o 0,3 mm z każdej strony od wnętrza pudełka.',
        en: 'Add a rim 0.3 mm smaller on each side than the inside of the box.',
        check: 'manual',
      },
      {
        pl: 'Sprawdź Miarką szerokość kołnierza i wnętrza.',
        en: 'Check the rim and inside width with the Ruler.',
        check: 'measured',
      },
    ],
    hint: {
      pl: 'Wnętrze ma 60 mm, więc kołnierz: 60 − 2 × 0,3 = 59,4 mm.',
      en: 'The inside is 60 mm, so the rim is 60 − 2 × 0.3 = 59.4 mm.',
    },
    solution: 'box',
  },
  {
    id: 'thread',
    level: 2,
    minutes: 15,
    icon: '🔩',
    title: { pl: 'Gwint w klocku', en: 'A thread in a block' },
    goal: {
      pl: 'Zrobisz element, do którego wkręcisz prawdziwą lub wydrukowaną śrubę.',
      en: 'Make a part you can screw a real or printed bolt into.',
    },
    steps: [
      { pl: 'Dodaj sześcian 25 × 25 × 15 mm.', en: 'Add a 25 × 25 × 15 mm box.', check: 'size:25,25,15' },
      {
        pl: 'Dodaj Otwór gwintowany (sekcja Śruby i nakrętki) i wybierz rozmiar M8.',
        en: 'Add a Threaded hole (Bolts & nuts section) and choose size M8.',
        check: 'type:tapHole',
      },
      { pl: 'Zgrupuj otwór z sześcianem.', en: 'Group the hole with the box.', check: 'groupWithHole' },
      { pl: 'Dodaj Śrubę M8 do wydruku testowego.', en: 'Add an M8 Bolt for a test print.', check: 'type:bolt' },
    ],
    hint: {
      pl: 'Otwór powinien wystawać trochę ponad i pod klocek, żeby gwint był na całej długości.',
      en: 'Let the hole stick out a little above and below the block so the thread runs all the way through.',
    },
    solution: 'bolts',
  },
  {
    id: 'draw',
    level: 2,
    minutes: 15,
    icon: '✍️',
    title: { pl: 'Własny kształt', en: 'Your own shape' },
    goal: {
      pl: 'Narysujesz kontur, zamienisz go w bryłę i wygniesz.',
      en: 'Draw an outline, turn it into a solid and bend it.',
    },
    steps: [
      {
        pl: 'Włącz narzędzie Rysuj (P) i narysuj zamknięty kształt.',
        en: 'Turn on the Draw tool (P) and draw a closed shape.',
        check: 'type:sketch',
      },
      {
        pl: 'Ustaw w parametrach „krzywe gładkie”.',
        en: 'Set “smooth curves” in the parameters.',
        check: 'smoothSketch',
      },
      {
        pl: 'Wygnij lub skręć kształt w sekcji Wyginanie i deformacje.',
        en: 'Bend or twist the shape in the Bend & deform section.',
        check: 'deformed',
      },
      { pl: 'Zapisz go jako „Mój kształt”.', en: 'Save it as “My shape”.', check: 'library' },
    ],
    hint: {
      pl: 'Możesz najpierw wstawić zdjęcie rysunku jako szablon i odrysować go.',
      en: 'You can first insert a photo of a drawing as a template and trace it.',
    },
  },
  {
    id: 'solids',
    level: 1,
    minutes: 10,
    icon: '📐',
    title: { pl: 'Bryły foremne', en: 'Regular solids' },
    goal: {
      pl: 'Poznasz pięć brył platońskich i zmierzysz ich krawędzie.',
      en: 'Meet the five Platonic solids and measure their edges.',
    },
    steps: [
      {
        pl: 'Dodaj czworościan, ośmiościan, dwunastościan i dwudziestościan.',
        en: 'Add a tetrahedron, octahedron, dodecahedron and icosahedron.',
        check: 'platonic',
      },
      { pl: 'Ustaw je w rzędzie (Wyrównaj → Y).', en: 'Line them up (Align → Y).', check: 'manual' },
      {
        pl: 'Zmierz Miarką długość krawędzi jednej z brył.',
        en: 'Measure the edge length of one solid with the Ruler.',
        check: 'measured',
      },
      {
        pl: 'Policz ściany każdej bryły i podpisz je Tekstem.',
        en: 'Count the faces of each solid and label them with Text.',
        check: 'has:text',
      },
    ],
    hint: {
      pl: 'Miarka przyciąga się do wierzchołków — kliknij dwa sąsiednie narożniki.',
      en: 'The ruler snaps to vertices — click two neighbouring corners.',
    },
    solution: 'platonic',
  },
];
