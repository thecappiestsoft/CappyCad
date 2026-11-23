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

    // ---- Kod QR, dzielenie, pędzel, 3MF (na czystej scenie)
    C.loadProject(JSON.stringify({ app: 'CappyCad', format: 2, objects: [] }), null, 'nowe.cappycad');
    check(C.qrModules({ text: 'CappyCad' }).size === 21, 'kod QR: rozmiar macierzy');
    const qr = C.addShape('qr', V(0, 0));
    check(qr && C.sizeOf(qr).x > 20 && C.sizeOf(qr).z > 2, 'kod QR jako bryła');
    C.setSelection([qr]);
    check(openEdges(C.exportSTLGeometry()) === 0, 'kod QR: szczelna siatka');
    C.splitQRColors(qr);
    check(C.objects.length === 2 && new Set(C.objects.map(o => o.color)).size === 2, 'kod QR: płytka + moduły');

    // Podział kształtem: część poza kształtem i część w kształcie (w kolorze kształtu)
    C.loadProject(JSON.stringify({ app: 'CappyCad', format: 2, objects: [] }), null, 'nowe.cappycad');
    const cb = C.addShape('box', V(0, 0));
    const cs = C.addShape('sphere', V(10, 0));
    C.setSelection([cb, cs]);
    C.cutWithShape('split');
    await wait(1500);
    check(
      C.objects.length === 2 && C.objects.some(o => o.color === cs.color) && C.objects.some(o => o.color === cb.color),
      'podział kształtem na 2 części',
    );
    C.setSelection([...C.objects]);
    check(openEdges(C.exportSTLGeometry()) === 0, 'podział kształtem: szczelny STL');
    C.groupSelection();
    await wait(1500);
    check(openEdges(C.objects[0].mesh.geometry) === 0, 'ponowne zgrupowanie części: szczelna bryła');
    C.undo();
    C.undo();
    check(C.objects.length === 2 && C.objects.some(o => o.type === 'sphere'), 'cofnięcie podziału');

    // Wycięcie kształtem
    C.setSelection([...C.objects]);
    C.cutWithShape('cut');
    await wait(1500);
    check(C.objects.length === 1 && C.objects[0].type === 'group', 'wycięcie kształtem');

    // Podział płaszczyzną
    C.loadProject(JSON.stringify({ app: 'CappyCad', format: 2, objects: [] }), null, 'nowe.cappycad');
    const pb = C.addShape('box', V(0, 0));
    C.splitByPlane([pb], 'z', 5, 4);
    await wait(1500);
    const hs = C.objects.map(o => Math.round(C.sizeOf(o).z)).sort((a, b) => a - b);
    check(C.objects.length === 2 && hs[0] === 5 && hs[1] === 15, `podział płaszczyzną (${hs.join(', ')})`);

    // Auto-Split: belka 500 mm na drukarkę 200 mm -> 3 części, każda mieści się w drukarce
    C.loadProject(JSON.stringify({ app: 'CappyCad', format: 2, objects: [] }), null, 'nowe.cappycad');
    const big = C.addShape('box', V(0, 0));
    big.mesh.scale.set(25, 2, 1);
    C.commit();
    C.autoSplit([big], { vol: [200, 200, 200], spare: 10, gap: 5, lay: true });
    await wait(2500);
    check(
      C.objects.length === 3 && C.objects.every(o => C.sizeOf(o).x <= 190.01 && Math.abs(o.mesh.position.z) < 0.01),
      `Auto-Split (${C.objects.length} części)`,
    );
    C.setSelection([C.objects[1]]);
    check(openEdges(C.exportSTLGeometry()) === 0, 'Auto-Split: szczelna część');

    // Rozdzielenie na osobne bryły
    C.loadProject(JSON.stringify({ app: 'CappyCad', format: 2, objects: [] }), null, 'nowe.cappycad');
    const a1 = C.addShape('box', V(0, 0)),
      a2 = C.addShape('box', V(40, 0));
    C.setSelection([a1, a2]);
    C.groupSelection();
    await wait(1500);
    C.setSelection([...C.objects]);
    C.separateParts();
    await wait(1500);
    check(C.objects.length === 2 && C.objects.every(o => o.type === 'mesh'), 'rozdzielenie na osobne bryły');

    // Pędzel — obszar (szkic) staje się osobną częścią w nowym kolorze
    C.loadProject(JSON.stringify({ app: 'CappyCad', format: 2, objects: [] }), null, 'nowe.cappycad');
    const pbx = C.addShape('box', V(0, 0));
    pbx.mesh.scale.set(3, 3, 0.5);
    C.commit();
    C.setSelection([]);
    C.setView('top', false);
    await wait(50);
    const vr = document.getElementById('viewport').getBoundingClientRect();
    const [sx, sy] = C.screenOfPoint(0, 0, 10);
    const cx = sx - vr.left,
      cy = sy - vr.top;
    C.setBrush('#1c7ed6', 'region');
    C.paintRegion([
      [cx - 15, cy - 15],
      [cx + 15, cy - 15],
      [cx + 15, cy + 15],
      [cx - 15, cy + 15],
    ]);
    await wait(1500);
    check(C.objects.length === 2 && C.objects.some(o => o.color === '#1c7ed6'), 'pędzel: kolorowanie obszaru');
    C.setSelection([...C.objects]);
    check(openEdges(C.exportSTLGeometry()) === 0, 'pędzel: szczelny STL');

    // Eksport 3MF: archiwum z modelem i kolorami
    const m3 = await C.build3MFBlob().text();
    check(
      m3.includes('3dmanufacturing') && m3.includes('#1C7ED6FF') && (m3.match(/<object /g) || []).length === 2,
      'eksport 3MF z kolorami',
    );
    C.setView('home', false);

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
