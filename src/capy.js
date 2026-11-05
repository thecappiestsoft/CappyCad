// Capy — pomocnik CappyCad. Działa w pełni offline: porady są wbudowane w program.
// Porady sytuacyjne pojawiają się same (można je wyciszyć), ogólne — po kliknięciu Cappy.

const TIPS = [
  {
    pl: 'Każdy projekt zaczyna się od prostych brył. Zanim sięgniesz po szczegóły, zbuduj z sześcianów i walców ogólny kształt.',
    en: 'Every project starts with simple solids. Before adding details, build the overall shape from boxes and cylinders.',
  },
  {
    pl: 'Dziurę robi się w dwóch krokach: ustaw kształt jako „Otwór”, a potem zaznacz go z bryłą i kliknij Grupuj.',
    en: 'A hole takes two steps: set a shape to “Hole”, then select it together with a solid and click Group.',
  },
  {
    pl: 'Przytrzymaj Alt i przeciągnij obiekt — powstanie kopia. Świetne do szeregu takich samych elementów.',
    en: 'Hold Alt and drag an object to make a copy. Great for rows of identical parts.',
  },
  {
    pl: 'Ctrl+D zostawia duplikat w tym samym miejscu. Przesuń go strzałkami o dokładną odległość — po kolejnych Ctrl+D powstanie równy wzór.',
    en: 'Ctrl+D leaves a duplicate in place. Move it with the arrow keys by an exact distance to build an even pattern.',
  },
  {
    pl: 'Strzałki przesuwają obiekt o krok siatki, a z Shift — dziesięć razy dalej. Ctrl+↑ i Ctrl+↓ podnoszą i opuszczają.',
    en: 'Arrow keys move an object by one grid step, ten times further with Shift. Ctrl+↑ and Ctrl+↓ raise and lower it.',
  },
  {
    pl: 'Na drukarce 3D najlepiej wychodzą bryły z płaską podstawą. Kształty zwisające w powietrzu potrzebują podpór.',
    en: 'Shapes with a flat base print best. Parts hanging in the air need supports.',
  },
  {
    pl: 'Ścianki cieńsze niż ok. 1 mm są kruche, a cieńsze niż 0,4 mm drukarka może w ogóle pominąć.',
    en: 'Walls thinner than about 1 mm are fragile, and below 0.4 mm the printer may skip them entirely.',
  },
  {
    pl: 'Elementy, które mają do siebie pasować, projektuj z luzem 0,2–0,3 mm. Plastik lekko się rozlewa.',
    en: 'Design parts that fit together with 0.2–0.3 mm of clearance. Plastic spreads a little when printed.',
  },
  {
    pl: 'Miarka (klawisz L) przyciąga się do narożników. Zmierz, zanim wydrukujesz — oszczędzisz czas i filament.',
    en: 'The Ruler (L key) snaps to corners. Measure before you print — it saves time and filament.',
  },
  {
    pl: 'Pomyliłeś się? Ctrl+Z cofa ostatni krok. Błędy to normalna część projektowania — każdy inżynier je popełnia.',
    en: 'Made a mistake? Ctrl+Z undoes the last step. Mistakes are a normal part of design — every engineer makes them.',
  },
  {
    pl: 'Zapisuj często (Ctrl+S). Możesz też zapisać kolejne wersje pod różnymi nazwami i porównać pomysły.',
    en: 'Save often (Ctrl+S). You can also save versions under different names and compare ideas.',
  },
  {
    pl: 'Napis na bryle? Wstaw Tekst, ustaw go jako Otwór, wsuń 1 mm w powierzchnię i zgrupuj — powstanie grawer.',
    en: 'Text on a solid? Insert Text, set it as a Hole, sink it 1 mm into the surface and group — you get an engraving.',
  },
  {
    pl: 'Wyginanie zamieni prostą belkę w łuk, a skręcanie — w spiralę. Spróbuj na tekście albo gwieździe!',
    en: 'Bending turns a straight bar into an arc, twisting turns it into a spiral. Try it on text or a star!',
  },
  {
    pl: 'Masz rysunek na papierze? Zrób zdjęcie, wstaw je jako szablon i odrysuj narzędziem Rysuj.',
    en: 'Have a drawing on paper? Take a photo, insert it as a template and trace it with the Draw tool.',
  },
  {
    pl: 'Logo lub ikonę w SVG zamienisz w bryłę jednym kliknięciem: Wstaw → Grafika SVG jako bryła 3D.',
    en: 'An SVG logo or icon becomes a solid in one click: Insert → SVG graphic as a 3D solid.',
  },
  {
    pl: 'Śruby i nakrętki z palety mają prawdziwe wymiary ISO. Gwinty drukuj z cienką warstwą, 0,1–0,15 mm.',
    en: 'Bolts and nuts in the palette have real ISO dimensions. Print threads with thin layers, 0.1–0.15 mm.',
  },
  {
    pl: 'Udany kształt zapisz w „Moich kształtach” — przyda się w następnym projekcie, a bibliotekę możesz dać kolegom.',
    en: 'Save a successful shape to “My shapes” — it will come in handy next time, and you can share the library with friends.',
  },
  {
    pl: 'Widok z góry, z przodu i z boku (przyciski po lewej) pomaga sprawdzić, czy elementy są równo ustawione.',
    en: 'Top, front and side views (buttons on the left) help you check whether parts are lined up.',
  },
  {
    pl: 'Zaznacz kilka obiektów i użyj Wyrównaj w panelu, zamiast ustawiać je „na oko”.',
    en: 'Select several objects and use Align in the panel instead of placing them by eye.',
  },
  {
    pl: 'Dobry projekt rozwiązuje problem. Zanim zaczniesz, zapytaj: komu i do czego ma służyć mój przedmiot?',
    en: 'Good design solves a problem. Before you start, ask: who is my object for and what should it do?',
  },
  {
    pl: 'Nie wyszło za pierwszym razem? Wydrukuj mały fragment próbny — to szybsze niż cały model.',
    en: 'Didn’t work the first time? Print a small test piece — it is faster than the whole model.',
  },
  {
    pl: 'Duże, płaskie modele mogą odkształcać się na brzegach. Zaokrąglone rogi i szersza podstawa pomagają.',
    en: 'Large flat models can warp at the edges. Rounded corners and a wider base help.',
  },
  {
    pl: 'Ciekawość to supermoc projektanta. Zmień jeden suwak i zobacz, co się stanie!',
    en: 'Curiosity is a designer’s superpower. Move one slider and see what happens!',
  },
];

// Porady sytuacyjne
const SITUATIONS = {
  welcome: {
    pl: 'Cześć, jestem Cappy! Kliknij kształt po prawej, żeby zacząć. Kliknij mnie, gdy będziesz potrzebować porady.',
    en: 'Hi, I’m Cappy! Click a shape on the right to start. Click me whenever you want a tip.',
  },
  firstShape: {
    pl: 'Super! Przeciągnij kształt myszą. Białe kwadraciki na krawędziach zmieniają rozmiar, czarny u góry — wysokość.',
    en: 'Great! Drag the shape with the mouse. The white squares on the edges change its size, the black one on top its height.',
  },
  holeNotGrouped: {
    pl: 'Masz otwór, ale nic jeszcze nie wycina. Zaznacz go razem z bryłą (Shift+klik) i kliknij Grupuj.',
    en: 'You have a hole, but it isn’t cutting anything yet. Select it with a solid (Shift+click) and click Group.',
  },
  floating: {
    pl: 'Obiekt „{name}” wisi w powietrzu. Jeśli ma stać na stole drukarki, naciśnij D.',
    en: 'The object “{name}” is floating in the air. If it should stand on the printer bed, press D.',
  },
  belowPlane: {
    pl: 'Część obiektu „{name}” jest pod płaszczyzną — ta część się nie wydrukuje. Naciśnij D, aby go postawić.',
    en: 'Part of “{name}” is below the workplane — that part won’t print. Press D to place it on the bed.',
  },
  outside: {
    pl: '„{name}” wystaje poza płaszczyznę roboczą — może nie zmieścić się na drukarce.',
    en: '“{name}” sticks out of the workplane — it may not fit on the printer.',
  },
  thin: {
    pl: '„{name}” ma tylko {mm} mm grubości. Poniżej 0,8 mm drukarka może sobie nie poradzić.',
    en: '“{name}” is only {mm} mm thick. Below 0.8 mm the printer may not manage it.',
  },
  scaledReal: {
    pl: 'Uwaga: przeskalowana śruba lub nakrętka nie będzie pasować. Zmieniaj rozmiar parametrem (np. M6), nie uchwytami.',
    en: 'Note: a scaled bolt or nut won’t fit. Change its size with the parameter (e.g. M6), not with the handles.',
  },
  smallText: {
    pl: 'Napis niższy niż ok. 5 mm może być nieczytelny po wydruku. Powiększ go albo zrób grubszy.',
    en: 'Text smaller than about 5 mm may be hard to read after printing. Make it bigger or thicker.',
  },
  saveReminder: {
    pl: 'Pracujesz już dłuższą chwilę bez zapisu. Naciśnij Ctrl+S — tak na wszelki wypadek.',
    en: 'You’ve been working for a while without saving. Press Ctrl+S — just in case.',
  },
  undo: {
    pl: 'Cofnięte! Próbowanie i poprawianie to najlepszy sposób nauki.',
    en: 'Undone! Trying and fixing is the best way to learn.',
  },
  exported: {
    pl: 'Plik gotowy! Otwórz go w programie drukarki (slicerze). Sprawdź tam, czy model leży płasko i czy potrzebuje podpór.',
    en: 'File ready! Open it in your printer software (slicer). Check there whether the model lies flat and needs supports.',
  },
  grouped: {
    pl: 'Brawo, otwory wycięte! Rozgrupowanie (Ctrl+Shift+G) przywróci osobne części, jeśli chcesz coś poprawić.',
    en: 'Well done, the holes are cut! Ungroup (Ctrl+Shift+G) brings the parts back if you want to change something.',
  },
  ruler: {
    pl: 'Miarka: kliknij dwa punkty. Z Shift mierzysz dokładnie wzdłuż osi X, Y lub Z.',
    en: 'Ruler: click two points. Hold Shift to measure exactly along the X, Y or Z axis.',
  },
  sketch: {
    pl: 'Klikaj kolejne punkty konturu. Kształt zamkniesz klikając pierwszy punkt albo Enterem.',
    en: 'Click the outline points one by one. Close the shape by clicking the first point or pressing Enter.',
  },
  template: {
    pl: 'Szablon to tylko podkładka do odrysowania — nie trafi do wydruku. Zablokuj go, żeby nie przeszkadzał.',
    en: 'A template is only a guide to trace — it won’t be printed. Lock it so it doesn’t get in the way.',
  },
  exerciseStart: {
    pl: 'Zaczynamy ćwiczenie „{name}”! Lista kroków jest po lewej — odhaczają się same, gdy je wykonasz.',
    en: 'Let’s start “{name}”! The step list is on the left — steps tick off by themselves as you do them.',
  },
  exerciseDone: {
    pl: 'Brawo! Ćwiczenie „{name}” ukończone. Spróbuj teraz zmienić projekt po swojemu — to najlepsza nauka!',
    en: 'Well done! You finished “{name}”. Now try changing the design your own way — that’s the best way to learn!',
  },
  deform: {
    pl: 'Wyginanie działa najlepiej na długich, cienkich kształtach. Pobaw się suwakiem!',
    en: 'Bending works best on long, thin shapes. Play with the slider!',
  },
};

export function createCapy({ getLang, root, img }) {
  let muted = false,
    tipIndex = -1,
    hideTimer = null;
  const shown = new Set();
  try {
    muted = localStorage.getItem('cappycad-capy-muted') === '1';
    tipIndex = +(localStorage.getItem('cappycad-capy-tip') || -1);
  } catch {}
  const L = (o, vars = {}) => (o[getLang()] || o.pl).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  const UI = {
    next: { pl: 'Kolejna porada', en: 'Next tip' },
    mute: { pl: 'Wycisz podpowiedzi', en: 'Mute hints' },
    unmute: { pl: 'Włącz podpowiedzi', en: 'Turn hints on' },
    close: { pl: 'Zamknij', en: 'Close' },
    title: { pl: 'Cappy — kliknij po poradę', en: 'Cappy — click for a tip' },
    muted: { pl: 'Podpowiedzi wyciszone — kliknij mnie po poradę.', en: 'Hints muted — click me for a tip.' },
    tip: { pl: 'Porada', en: 'Tip' },
    heads: { pl: 'Uwaga', en: 'Heads up' },
  };

  root.innerHTML = `<div class="capy-bubble" data-notr role="status" aria-live="polite"><div class="capy-kind"></div><div class="capy-text"></div>
      <div class="capy-actions"><button class="link capy-next"></button><button class="link capy-mute"></button></div>
      <button class="capy-close">×</button></div>
    <button class="capy-btn" data-notr><img src="${img || 'capy.png'}" alt="Cappy"></button>`;
  const bubble = root.querySelector('.capy-bubble'),
    text = root.querySelector('.capy-text'),
    kind = root.querySelector('.capy-kind');
  const btn = root.querySelector('.capy-btn');
  const labels = () => {
    root.querySelector('.capy-next').textContent = L(UI.next);
    root.querySelector('.capy-mute').textContent = L(muted ? UI.unmute : UI.mute);
    root.querySelector('.capy-close').title = L(UI.close);
    btn.title = L(UI.title);
    root.classList.toggle('muted', muted);
  };
  const show = (msg, k = 'tip', autoHide = 0) => {
    kind.textContent = L(k === 'warn' ? UI.heads : UI.tip);
    bubble.classList.toggle('warn', k === 'warn');
    text.textContent = msg;
    bubble.classList.add('show');
    btn.classList.remove('bounce');
    void btn.offsetWidth;
    btn.classList.add('bounce');
    clearTimeout(hideTimer);
    if (autoHide) hideTimer = setTimeout(hide, autoHide);
  };
  const hide = () => {
    bubble.classList.remove('show');
    clearTimeout(hideTimer);
  };
  const nextTip = () => {
    tipIndex = (tipIndex + 1) % TIPS.length;
    try {
      localStorage.setItem('cappycad-capy-tip', tipIndex);
    } catch {}
    show(L(TIPS[tipIndex]), 'tip');
  };
  btn.addEventListener('click', () => (bubble.classList.contains('show') ? hide() : nextTip()));
  root.querySelector('.capy-next').addEventListener('click', nextTip);
  root.querySelector('.capy-close').addEventListener('click', hide);
  root.querySelector('.capy-mute').addEventListener('click', () => {
    muted = !muted;
    try {
      localStorage.setItem('cappycad-capy-muted', muted ? '1' : '0');
    } catch {}
    labels();
    if (muted) show(L(UI.muted), 'tip', 3500);
    else hide();
  });
  labels();

  // sytuacja: id, zmienne, opcje { once, warn, cooldownKey }
  const lastAt = new Map();
  function say(id, vars = {}, { once = true, warn = false, cooldown = 0, key = id } = {}) {
    if (muted || !SITUATIONS[id]) return false;
    if (once && shown.has(key)) return false;
    const now = Date.now();
    if (cooldown && now - (lastAt.get(key) || 0) < cooldown) return false;
    shown.add(key);
    lastAt.set(key, now);
    show(L(SITUATIONS[id], vars), warn ? 'warn' : 'tip', 14000);
    return true;
  }
  return {
    say,
    nextTip,
    hide,
    refresh: () => {
      labels();
      if (bubble.classList.contains('show')) hide();
    },
    get muted() {
      return muted;
    },
    TIPS,
    SITUATIONS,
  };
}
