const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'ai.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true
    }
  });

  win.loadFile('index.html');

  ipcMain.on('get-sites', (event) => {
    const sitesPath = path.join(__dirname, 'locales', 'ar', 'sites.json');
    fs.readFile(sitesPath, 'utf8', (err, data) => {
      if (err) {
        console.error("Failed to read sites.json:", err);
        return;
      }
      event.sender.send('sites-data', JSON.parse(data));
    });
  });

  ipcMain.on('add-site', (event, newSite) => {
    const sitesPath = path.join(__dirname, 'locales', 'ar', 'sites.json');
    fs.readFile(sitesPath, 'utf8', (err, data) => {
      if (err) {
        console.error("Failed to read sites.json:", err);
        return;
      }
      const sites = JSON.parse(data);
      sites.push(newSite);
      
      fs.writeFile(sitesPath, JSON.stringify(sites, null, 2), 'utf8', (err) => {
        if (err) {
          console.error("Failed to write to sites.json:", err);
          return;
        }
        event.sender.send('site-added-successfully');
      });
    });
  });
  
  ipcMain.on('notify', (event, { title, body }) => {
    new Notification({ title, body }).show();
  });
}

app.whenReady().then(createWindow);

app.setAppUserModelId(process.env.APP_ID || "com.yourcompany.yourapp");
