const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cappycad', {
  openFile: opts => ipcRenderer.invoke('open-file', opts),
  saveFile: opts => ipcRenderer.invoke('save-file', opts),
  startupFile: () => ipcRenderer.invoke('startup-file'),
  setTheme: mode => ipcRenderer.invoke('set-theme', mode),
  setLang: l => ipcRenderer.invoke('set-lang', l),
});
