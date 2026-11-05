// Test dymny CappyCad — wykonywany WEWNĄTRZ okna programu (przez test/electron-runner.cjs).
// Korzysta z testowego mostka window.__cappycad (koniec pliku src/app.js).
// Zwraca listę nieudanych sprawdzeń (pusta lista = wszystko działa).

window.__runSmokeTest = async function () {
  const C = window.__cappycad;
  const V = (x, y) => new C.THREE.Vector3(x, y, 0);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const failures = [];
  const check = (ok, what) => {
    if (!ok) failures.push(what);
  };

  // Liczba „niezamkniętych” krawędzi siatki — tak jak liczą je slicery.
  // W szczelnej bryle każda krawędź należy do dokładnie dwóch trójkątów skierowanych przeciwnie.
  function openEdges(geometry) {
    const p = geometry.getAttribute('position').array;
    const ids = new Map();
    const vertexId = i => {
      const key = [p[i], p[i + 1], p[i + 2]].map(v => Math.round(v * 1e4)).join(',');
      if (!ids.has(key)) ids.set(key, ids.size);
      return ids.get(key);
    };
    const edges = new Map();
    for (let i = 0; i < p.length; i += 9) {
      const t = [vertexId(i), vertexId(i + 3), vertexId(i + 6)];
      for (let k = 0; k < 3; k++) {
        const e = t[k] + '>' + t[(k + 1) % 3];
        edges.set(e, (edges.get(e) || 0) + 1);
      }
    }
    let open = 0;
    for (const [e, n] of edges) {
      const [a, b] = e.split('>');
      if (n !== 1 || edges.get(b + '>' + a) !== 1) open++;
    }
    return open;
  }

  try {
    // Kształty z palety
    for (const t of [
      'box',
      'cylinder',
      'sphere',
      'text',
      'capybara',
      'dice',
      'brick',
      'star3d',
      'moon',
      'stairs',
      'arch',
    ]) {
      C.addShape(t, V(0, 0));
    }

    // Grupowanie z otworem gwintowanym (operacja logiczna na bryłach)
    const box = C.addShape('box', V(60, 0));
    const hole = C.addShape('tapHole', V(60, 0), { params: { size: 'M6', length: 25 } });
    C.setSelection([box, hole]);
    C.groupSelection();
    await wait(1500);
    check(
      C.objects.some(o => o.type === 'group'),
      'grupowanie brył z otworem',
    );

    // Wymiary normowe: łeb śruby M8 ma 13 mm pod klucz
    const bolt = C.addShape('bolt', V(-60, 0), { params: { size: 'M8', length: 20 } });
    check(Math.abs(C.sizeOf(bolt).x - 13) < 0.2, 'wymiar łba śruby M8');

    // Wyginanie belki podnosi jej środek
    const bar = C.addShape('box', V(0, 60));
    bar.mesh.scale.set(4, 0.5, 0.25);
    C.commit();
    C.setDeform(bar, { bend: 90, axis: 'x' });
    C.commit();
    check(C.sizeOf(bar).z > 10, 'wyginanie');

    // Import SVG jako bryły
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';
    check(C.svgGeometry(svg).attributes.position.count > 0, 'SVG jako bryła');

    // Eksport: STL musi być szczelny (bez dziur) — wymóg slicerów
    check(C.csg.isSolidReady(), 'silnik brył Manifold załadowany');
    check(C.exportSTLBytes() > 1000, 'eksport STL');
    const open = openEdges(C.exportSTLGeometry());
    check(open === 0, `STL szczelny (niezamknięte krawędzie: ${open})`);
    check(C.exportOBJText().length > 1000, 'eksport OBJ');

    // Zapis i odczyt projektu, cofanie
    const count = C.objects.length;
    C.loadProject(C.projectJSON(), null, 'test.cappycad');
    check(C.objects.length === count, 'zapis i odczyt projektu');
    C.undo();
    C.redo();

    // Motyw i język
    C.setTheme('dark');
    C.setTheme('light');
    C.setTheme('system');
    C.setLanguage('en');
    await wait(30);
    check(document.querySelector('#bNew span').textContent === 'New', 'tłumaczenie na angielski');
    C.setLanguage('pl');
    await wait(30);
    check(document.querySelector('#bNew span').textContent === 'Nowy', 'powrót do polskiego');

    // Paleta, przykłady, ćwiczenia, pomocnik Cappy
    check(document.querySelectorAll('#palette .tile').length > 30, 'paleta kształtów');
    C.addShape('banana', V(0, -60));
    await C.openExample('keychain', true);
    await wait(1500);
    check(C.objects.length === 2 && C.objects.some(o => o.type === 'group'), 'przykład: brelok');
    C.startExercise('first');
    C.addShape('box', V(0, 0));
    C.commit();
    check(C.exercise && C.exercise.done.has(0), 'ćwiczenie: automatyczne odhaczanie kroku');
    C.capy.hide();
    document.querySelector('.capy-btn').click();
    const bubble = document.querySelector('.capy-bubble');
    check(
      bubble.classList.contains('show') && document.querySelector('.capy-text').textContent.length > 20,
      'porada Cappy',
    );

    // Zwijany panel obiektu
    C.setSelection([C.objects[0]]);
    C.setInspCollapsed(true);
    check(document.getElementById('inspTab').classList.contains('show'), 'zwinięty panel obiektu');
    C.setInspCollapsed(false);
  } catch (err) {
    failures.push('wyjątek: ' + err.message);
  }
  return failures;
};
