const { app, BrowserWindow, ipcMain, Notification, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const SITES_FILE_PATH = path.join(__dirname, 'locales', 'en', 'sites.json');

function setMenu() {
  Menu.setApplicationMenu(null);
}

function ensureSitesFile() {
  const dirPath = path.dirname(SITES_FILE_PATH);
  fs.mkdirSync(dirPath, { recursive: true });

  if (!fs.existsSync(SITES_FILE_PATH)) {
    const defaultSites = [
      { name: 'Google Search', url: 'https://www.google.com' }
    ];
    fs.writeFileSync(SITES_FILE_PATH, JSON.stringify(defaultSites, null, 2), 'utf8');
  }
}

function readSites() {
  ensureSitesFile();

  try {
    const parsed = JSON.parse(fs.readFileSync(SITES_FILE_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Could not read sites.json:', error);
    return [];
  }
}

function writeSites(sites) {
  ensureSitesFile();
  fs.writeFileSync(SITES_FILE_PATH, JSON.stringify(sites, null, 2), 'utf8');
}

function registerIpcHandlers() {
  ipcMain.removeAllListeners('get-sites');
  ipcMain.removeAllListeners('add-site');
  ipcMain.removeAllListeners('delete-site');
  ipcMain.removeAllListeners('notify');

  ipcMain.on('get-sites', (event) => {
    event.sender.send('sites-data', readSites());
  });

  ipcMain.on('add-site', (event, newSite) => {
    if (!newSite || typeof newSite.name !== 'string' || typeof newSite.url !== 'string') {
      return;
    }

    const name = newSite.name.trim();
    const url = newSite.url.trim();

    if (!name || !url) return;

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) return;
    } catch {
      return;
    }

    const sites = readSites();
    const exists = sites.some(site =>
      String(site.url || '').replace(/\/+$/, '').toLowerCase() === url.replace(/\/+$/, '').toLowerCase()
    );

    if (!exists) {
      sites.push({ name, url });
      try {
        writeSites(sites);
        event.sender.send('site-added-successfully');
      } catch (error) {
        console.error('Could not save new site:', error);
      }
    }
  });

  ipcMain.on('delete-site', (event, siteName) => {
    if (typeof siteName !== 'string') return;

    const sites = readSites();
    const updatedSites = sites.filter(site => site.name !== siteName);

    try {
      writeSites(updatedSites);
      event.sender.send('site-deleted-successfully');
    } catch (error) {
      console.error('Could not delete site:', error);
    }
  });

  ipcMain.on('notify', (event, payload) => {
    if (!Notification.isSupported()) return;

    const title = payload && typeof payload.title === 'string' ? payload.title : 'Helwan AI Gate';
    const body = payload && typeof payload.body === 'string' ? payload.body : '';

    new Notification({ title, body }).show();
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'ai.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      webSecurity: true,
      backgroundThrottling: false,
      enablePageZoom: true
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  return win;
}

app.whenReady().then(() => {
  setMenu();
  ensureSitesFile();
  registerIpcHandlers();
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
