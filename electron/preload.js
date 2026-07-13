const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  promptTouchID: (message) => ipcRenderer.invoke('prompt-touch-id', message),
  saveCredential: (key, secret) => ipcRenderer.invoke('save-credential', key, secret),
  getCredential: (key, encryptedBase64) => ipcRenderer.invoke('get-credential', key, encryptedBase64),
});
