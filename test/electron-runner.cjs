// Uruchamia zbudowany program (app/) w oknie Electrona, wstrzykuje test/smoke.in-page.js
// i kończy proces z kodem 0 (sukces) lub 1 (błędy). Wywoływany przez test/run.mjs.
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Kanały IPC, których używa program — w teście nie robią nic
for (const ch of ['startup-file', 'set-theme', 'set-lang']) ipcMain.handle(ch, () => null);

app.commandLine.appendSwitch('enable-unsafe-swiftshader'); // grafika WebGL bez karty graficznej (serwery CI)
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cappycad-test-'))); // czyste ustawienia

const ROOT = path.join(__dirname, '..');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 880,
    show: true,
    webPreferences: { preload: path.join(ROOT, 'electron', 'preload.js'), contextIsolation: true, sandbox: false },
  });
  const pageErrors = [];
  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 3 || /Uncaught/.test(message)) pageErrors.push(message);
  });

  await win.loadFile(path.join(ROOT, 'app', 'index.html'));
  await new Promise(r => setTimeout(r, 2500)); // start programu i załadowanie silnika brył

  let failures;
  try {
    // „; true” — wynik wczytania pliku to funkcja, której nie da się przekazać między procesami
    await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname, 'smoke.in-page.js'), 'utf8') + '\n;true');
    failures = await win.webContents.executeJavaScript('window.__runSmokeTest()');
  } catch (err) {
    failures = ['nie udało się uruchomić testu: ' + err.message];
  }
  failures.push(...pageErrors.map(m => 'błąd w konsoli: ' + m));

  if (failures.length) {
    console.log('TEST NIEUDANY:\n  - ' + failures.join('\n  - '));
    app.exit(1);
  } else {
    console.log('Test dymny: OK');
    app.exit(0);
  }
});
