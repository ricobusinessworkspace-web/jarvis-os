const { app, BrowserWindow, ipcMain, safeStorage, systemPreferences } = require('electron');
const path = require('path');
const url = require('url');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC: Biometric prompt
ipcMain.handle('prompt-touch-id', async (event, message) => {
  if (systemPreferences.canPromptTouchID()) {
    try {
      await systemPreferences.promptTouchID(message);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  } else {
    return { success: false, error: 'Touch ID not available' };
  }
});

// IPC: safeStorage
ipcMain.handle('save-credential', async (event, key, secret) => {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(secret);
    // In a real app, save 'encrypted' buffer to disk/store under 'key'
    return { success: true, encrypted: encrypted.toString('base64') };
  }
  return { success: false, error: 'Encryption not available' };
});

ipcMain.handle('get-credential', async (event, key, encryptedBase64) => {
  if (safeStorage.isEncryptionAvailable()) {
    try {
      const buffer = Buffer.from(encryptedBase64, 'base64');
      const decrypted = safeStorage.decryptString(buffer);
      return { success: true, decrypted };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: 'Encryption not available' };
});
