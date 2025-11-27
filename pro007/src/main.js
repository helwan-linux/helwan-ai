// main.js (الإصدار النهائي: إصلاح الأداء والتحميل)
const { app, BrowserWindow, ipcMain, Notification, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// ✅ إعدادات الأداء الموصى بها في Electron 
app.commandLine.appendSwitch('in-process-gpu'); 
app.commandLine.appendSwitch('disable-site-isolation-for-testing'); 
app.commandLine.appendSwitch('enable-features', 'CSSColorSchemeOverride');


function setMenu() {
    Menu.setApplicationMenu(null);
}

// المسار الثابت الصحيح
const SITES_FILE_PATH = path.join(__dirname, 'locales', 'en' ,'sites.json'); 

function createWindow () {
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
      // ✅ حل مشكلة فشل تحميل المواقع (User-Agent Spoofing)
      allowRunningInsecureContent: true,
      session: {
        webRequest: {
          onBeforeSendHeaders: (details, callback) => {
            // إجبار الـ webview على استخدام User-Agent متصفح Chrome قياسي
            details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
            callback({ cancel: false, requestHeaders: details.requestHeaders });
          }
        }
      }
    }
  });

  win.loadFile('index.html');
  setMenu();

  // منطق قراءة المواقع 
  ipcMain.on('get-sites', (event) => {
    fs.readFile(SITES_FILE_PATH, 'utf8', (err, data) => {
      if (err) {
        event.sender.send('sites-data', []); 
        return;
      }
      try {
          event.sender.send('sites-data', JSON.parse(data));
      } catch (parseError) {
          event.sender.send('sites-data', []);
      }
    });
  });

  // منطق إضافة وحذف الموقع 
  ipcMain.on('add-site', (event, newSite) => {
    fs.readFile(SITES_FILE_PATH, 'utf8', (err, data) => {
        let sites = [];
        if (!err) {
            try {
                sites = JSON.parse(data);
            } catch (parseError) {} 
        }
        const siteToSave = { name: newSite.name, url: newSite.url };
        const exists = sites.some(site => site.url === siteToSave.url);
        
        if (!exists) {
            sites.push(siteToSave); 
            fs.writeFile(SITES_FILE_PATH, JSON.stringify(sites, null, 2), 'utf8', (err) => {
                if (!err) {
                    event.sender.send('site-added-successfully');
                }
            });
        }
    });
  });
  
  ipcMain.on('delete-site', (event, siteName) => {
    fs.readFile(SITES_FILE_PATH, 'utf8', (err, data) => {
      if (err) return;
      let sites = JSON.parse(data);
      const updatedSites = sites.filter(site => site.name !== siteName);
      fs.writeFile(SITES_FILE_PATH, JSON.stringify(updatedSites, null, 2), 'utf8', (err) => {
        if (!err) {
          event.sender.send('site-deleted-successfully');
        }
      });
    });
  });
  
  ipcMain.on('notify', (event, { title, body }) => {
    new Notification({ title, body }).show();
  });
}

app.whenReady().then(createWindow);
app.setAppUserModelId(process.env.APP_ID || "com.yourcompany.yourapp");
