// CappyCad — proces główny Electron: okno programu, systemowe okna zapisu/otwierania plików,
// motyw i język okien systemowych. Działa w pełni offline — blokuje nawigację i nowe okna.
const { app, BrowserWindow, ipcMain, dialog, Menu, shell, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');

// zbudowany interfejs (npm run build) leży w folderze app/ w katalogu głównym projektu
const APP_DIR = path.join(__dirname, '..', 'app');

let win = null;
let uiLang = 'pl';
ipcMain.handle('set-lang', (_e, l) => {
  uiLang = l === 'en' ? 'en' : 'pl';
});

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 640,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0e1215' : '#eef2f6',
    title: 'CappyCad',
    show: false,
    icon: path.join(APP_DIR, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(APP_DIR, 'index.html'));
  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });

  // pytanie przy zamykaniu z niezapisanymi zmianami
  win.webContents.on('will-prevent-unload', e => {
    const en = uiLang === 'en';
    const r = dialog.showMessageBoxSync(win, {
      type: 'question',
      buttons: en ? ['Close without saving', 'Cancel'] : ['Zamknij bez zapisywania', 'Anuluj'],
      defaultId: 1,
      cancelId: 1,
      title: 'CappyCad',
      message: en ? 'The project has unsaved changes.' : 'Projekt ma niezapisane zmiany.',
      detail: en
        ? 'Are you sure you want to quit? Unsaved changes will be lost.'
        : 'Czy na pewno chcesz zamknąć program? Niezapisane zmiany zostaną utracone.',
    });
    if (r === 0) e.preventDefault();
  });
  // całkowita blokada nawigacji i nowych okien (aplikacja offline)
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  // narzędzia deweloperskie: Ctrl+Shift+I
  win.webContents.on('before-input-event', (e, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') win.webContents.toggleDevTools();
  });
}

ipcMain.handle('open-file', async (_e, { filters, binary }) => {
  const r = await dialog.showOpenDialog(win, { filters, properties: ['openFile'] });
  if (r.canceled || !r.filePaths.length) return null;
  const p = r.filePaths[0];
  const buf = fs.readFileSync(p);
  return { path: p, name: path.basename(p), data: binary ? new Uint8Array(buf) : buf.toString('utf8') };
});

ipcMain.handle('save-file', async (_e, { path: target, defaultPath, filters, data }) => {
  if (!target) {
    const r = await dialog.showSaveDialog(win, { defaultPath, filters });
    if (r.canceled || !r.filePath) return null;
    target = r.filePath;
  }
  try {
    fs.writeFileSync(target, typeof data === 'string' ? data : Buffer.from(data));
  } catch (err) {
    dialog.showErrorBox(
      uiLang === 'en' ? 'Save error' : 'Błąd zapisu',
      (uiLang === 'en' ? 'Could not save the file:' : 'Nie udało się zapisać pliku:') + `\n${target}\n\n${err.message}`,
    );
    return null;
  }
  return { path: target, name: path.basename(target) };
});

// motyw okna (pasek tytułu, okna dialogowe) zgodny z wyborem w aplikacji
ipcMain.handle('set-theme', (_e, mode) => {
  nativeTheme.themeSource = ['light', 'dark', 'system'].includes(mode) ? mode : 'system';
  if (win) win.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#0e1215' : '#eef2f6');
});

// plik przekazany przy uruchomieniu (np. dwuklik na .cappycad)
ipcMain.handle('startup-file', () => {
  const arg = process.argv.slice(1).find(a => /\.(cappycad|capycad|blokcad)$/i.test(a) && fs.existsSync(a));
  if (!arg) return null;
  return { path: arg, name: path.basename(arg), data: fs.readFileSync(arg, 'utf8') };
});

// Zapasowa grafika programowa (SwiftShader), gdy sterownik karty graficznej jest zablokowany lub przestarzały —
// bez tego na części szkolnych komputerów scena 3D byłaby pusta. Program wyświetla tylko lokalne pliki.
app.commandLine.appendSwitch('enable-unsafe-swiftshader');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => app.quit());
}
void shell;
