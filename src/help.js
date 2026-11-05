// CappyCad — okno pomocy (PL / EN): pierwsze kroki, obsługa myszy, skróty klawiszowe.
// Wywoływane z app.js: showHelp({ lang, openModal, closeModal, $ }).

function showHelpEN({ openModal, closeModal, $ }) {
  const k = (a, b) => `<tr><td><kbd>${a.split('+').join('</kbd>+<kbd>')}</kbd></td><td>${b}</td></tr>`;
  openModal(`<div data-notr><h2>Help — CappyCad</h2>
  <div class="help-cols">
   <div><h3>Getting started</h3>
    <ol class="steps">
      <li>Click a shape in the palette on the right or drag it onto the blue workplane.</li>
      <li>Drag objects with the mouse. The <b>white squares</b> on the edges resize from that side, the <b>black</b> one on top changes the height (hold <kbd>Shift</kbd> to keep proportions).</li>
      <li>Exact size, rotation and <b>bending</b> are set in the panel that appears when an object is selected.</li>
      <li>To cut a hole, set an object to <b>Hole</b>, select it together with a solid and click <b>Group</b>.</li>
      <li>Internal thread: insert a <b>Threaded hole</b> (Bolts &amp; nuts section) and group it with a solid.</li>
      <li>The <b>Ruler</b> measures the distance between two points, <b>Draw</b> turns a drawn outline into a solid.</li>
      <li>Insert a drawing to trace as a template: <b>Insert → Image as a template</b>. An SVG file can also become a 3D solid.</li>
      <li>Export the finished model to <b>STL</b> or <b>OBJ</b> and open it in your 3D printer software.</li>
    </ol>
    <h3>Mouse</h3>
    <table class="keys">
     ${k('Left button', 'select / move an object; drag a box to select many')}
     ${k('Shift+click', 'add to selection')}
     ${k('Alt+drag', 'copy an object')}
     ${k('Right button', 'orbit the view')}
     ${k('Wheel', 'zoom in / out')}
     ${k('Middle button', 'pan the view (or Shift+right)')}
    </table></div>
   <div><h3>Keys</h3>
    <table class="keys">
     ${k('M', 'move mode')} ${k('R', 'rotate mode')} ${k('S', 'scale mode')} ${k('Q', 'hide arrows')}
     ${k('L', 'ruler')} ${k('P', 'draw your own shape')}
     ${k('Arrows', 'move by one grid step (Shift ×10)')}
     ${k('Ctrl+↑', 'raise')} ${k('Ctrl+↓', 'lower')}
     ${k('D', 'drop to workplane')} ${k('H', 'solid ↔ hole')}
     ${k('Ctrl+G', 'group')} ${k('Ctrl+Shift+G', 'ungroup')}
     ${k('Ctrl+C', 'copy')} ${k('Ctrl+V', 'paste')} ${k('Ctrl+D', 'duplicate')}
     ${k('Delete', 'delete')} ${k('Ctrl+A', 'select all')} ${k('Esc', 'deselect / exit tool')}
     ${k('Ctrl+Z', 'undo')} ${k('Ctrl+Y', 'redo')}
     ${k('Ctrl+S', 'save')} ${k('Ctrl+O', 'open')} ${k('Ctrl+E', 'export STL')}
     ${k('F', 'fit view')} ${k('I', 'collapse / expand the object panel')} ${k('T', 'light ↔ dark theme')} ${k('F1', 'this help')}
    </table>
    <h3>Printing bolts and nuts</h3>
    <p class="small">Threads use ISO dimensions (M2–M16). The <b>Print clearance</b> parameter compensates for plastic spreading — increase it if the nut does not fit. Print threads with 0.1–0.15 mm layers; below M4 it is usually better to use a metal bolt with a <b>Bolt hole</b> or <b>Nut trap</b>.</p></div>
  </div>
  <p class="muted">CappyCad works fully offline. Projects are saved as .cappycad files on your computer — nothing is sent to the internet.</p>
  <div class="modal-btns"><button class="btn primary" id="helpClose">Close</button></div></div>`);
  $('#helpClose').onclick = closeModal;
}

export function showHelp(ctx) {
  const { lang, openModal, closeModal, $ } = ctx;
  if (lang === 'en') return showHelpEN(ctx);
  const k = (a, b) => `<tr><td><kbd>${a.split('+').join('</kbd>+<kbd>')}</kbd></td><td>${b}</td></tr>`;
  openModal(`<h2>Pomoc — CappyCad</h2>
  <div class="help-cols">
   <div><h3>Jak zacząć</h3>
    <ol class="steps">
      <li>Kliknij kształt w palecie po prawej lub przeciągnij go na niebieską płaszczyznę.</li>
      <li>Przeciągaj obiekt myszą. <b>Białe kwadraciki</b> na krawędziach zmieniają rozmiar od strony krawędzi, a <b>czarny</b> u góry — wysokość (z <kbd>Shift</kbd> proporcjonalnie).</li>
      <li>Dokładne wymiary, obrót i <b>wyginanie</b> ustawisz w panelu, który pojawia się po zaznaczeniu obiektu.</li>
      <li>Aby wyciąć dziurę, ustaw obiekt jako <b>Otwór</b>, zaznacz go razem z bryłą i kliknij <b>Grupuj</b>.</li>
      <li>Gwint wewnętrzny: wstaw <b>Otwór gwintowany</b> (sekcja Śruby i nakrętki) i zgrupuj z bryłą.</li>
      <li><b>Miarka</b> mierzy odległość między dwoma punktami, a <b>Rysuj</b> zamienia narysowany kontur w bryłę.</li>
      <li>Rysunek do odrysowania wstawisz jako szablon: <b>Wstaw → Obraz jako szablon</b>. Plik SVG może też stać się bryłą 3D.</li>
      <li>Gotowy model wyeksportuj do <b>STL</b> lub <b>OBJ</b> i wczytaj w programie drukarki 3D.</li>
    </ol>
    <h3>Mysz</h3>
    <table class="keys">
     ${k('Lewy przycisk', 'zaznacz / przesuń obiekt; ramka zaznacza wiele')}
     ${k('Shift+klik', 'dodaj do zaznaczenia')}
     ${k('Alt+przeciągnij', 'skopiuj obiekt')}
     ${k('Prawy przycisk', 'obracaj widok')}
     ${k('Kółko', 'przybliż / oddal')}
     ${k('Środkowy', 'przesuń widok (lub Shift+prawy)')}
    </table></div>
   <div><h3>Klawisze</h3>
    <table class="keys">
     ${k('M', 'tryb przesuwania')} ${k('R', 'tryb obracania')} ${k('S', 'tryb skalowania')} ${k('Q', 'ukryj strzałki')}
     ${k('L', 'miarka')} ${k('P', 'rysuj własny kształt')}
     ${k('Strzałki', 'przesuń o krok siatki (Shift ×10)')}
     ${k('Ctrl+↑', 'podnieś')} ${k('Ctrl+↓', 'opuść')}
     ${k('D', 'połóż na płaszczyźnie')} ${k('H', 'bryła ↔ otwór')}
     ${k('Ctrl+G', 'grupuj')} ${k('Ctrl+Shift+G', 'rozgrupuj')}
     ${k('Ctrl+C', 'kopiuj')} ${k('Ctrl+V', 'wklej')} ${k('Ctrl+D', 'duplikuj')}
     ${k('Delete', 'usuń')} ${k('Ctrl+A', 'zaznacz wszystko')} ${k('Esc', 'odznacz / zakończ narzędzie')}
     ${k('Ctrl+Z', 'cofnij')} ${k('Ctrl+Y', 'ponów')}
     ${k('Ctrl+S', 'zapisz')} ${k('Ctrl+O', 'otwórz')} ${k('Ctrl+E', 'eksport STL')}
     ${k('F', 'dopasuj widok')} ${k('I', 'zwiń / rozwiń panel obiektu')} ${k('T', 'motyw jasny ↔ ciemny')} ${k('F1', 'ta pomoc')}
    </table>
    <h3>Druk śrub i nakrętek</h3>
    <p class="small">Gwinty mają wymiary ISO (M2–M16). Parametr <b>Luz do druku</b> kompensuje rozlewanie się plastiku — zwiększ go, jeśli nakrętka nie wchodzi. Gwinty drukuj z warstwą 0,1–0,15 mm; poniżej M4 zwykle lepiej wkręcić metalową śrubę w <b>Otwór na śrubę</b> lub <b>Gniazdo nakrętki</b>.</p></div>
  </div>
  <p class="muted">CappyCad działa w pełni offline. Projekty zapisujesz jako pliki .cappycad na swoim komputerze — nic nie jest wysyłane do internetu.</p>
  <div class="modal-btns"><button class="btn primary" id="helpClose">Zamknij</button></div>`);
  $('#helpClose').onclick = closeModal;
}
