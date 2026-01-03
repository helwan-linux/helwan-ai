// main.js (الإصدار النهائي الكامل)
const { app, BrowserWindow, ipcMain, Notification, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// إعدادات الأداء الموصى بها في Electron 
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
      // ✅ الإعداد الحاسم: لتفعيل سجل التنقل (History) في الـ webview
      enableRemoteModule: false,
      enablePageZoom: true, // 👈 الإصلاح الأساسي هنا
      // حل مشكلة فشل تحميل المواقع (User-Agent Spoofing)
      allowRunningInsecureContent: true,
      session: {
        webRequest: {
          onBeforeSendHeaders: (details, callback) => {
            // إضافة User-Agent وهمي لحل مشاكل التحميل
            if (details.url.includes('google.com') || details.url.includes('openai.com')) {
                details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36';
            }
            callback({ cancel: false, requestHeaders: details.requestHeaders });
          }
        }
      }
    }
  });

  win.loadFile('index.html');
  // win.webContents.openDevTools(); 

  // معالجة طلب فتح نوافذ جديدة
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
        return { action: 'deny' }; 
    }
    return { action: 'deny' };
  });

  // معالجة الإشعارات
  ipcMain.on('notify', (event, { title, body }) => {
    new Notification({ title, body }).show();
  });
}

// دالة جاهزة لقراءة وكتابة المواقع
function handleSites() {
  // التأكد من وجود المجلد
  const dirPath = path.dirname(SITES_FILE_PATH);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // إذا كان الملف غير موجود، أنشئ ملفًا افتراضيًا
  if (!fs.existsSync(SITES_FILE_PATH)) {
    const defaultSites = [
      { name: 'Google Search', url: 'https://www.google.com' },
    ];
    fs.writeFileSync(SITES_FILE_PATH, JSON.stringify(defaultSites, null, 2), 'utf8');
  }

  // منطق جلب المواقع
  ipcMain.on('get-sites', (event) => {
    fs.readFile(SITES_FILE_PATH, 'utf8', (err, data) => {
      if (!err) {
        try {
          const sites = JSON.parse(data);
          event.sender.send('sites-data', sites);
        } catch (parseError) {
          event.sender.send('sites-data', []);
        }
      } else {
        event.sender.send('sites-data', []);
      }
    });
  });

  // منطق إضافة الموقع 
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
  
  // منطق حذف الموقع
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
}


app.whenReady().then(() => {
  setMenu();
  createWindow();
  handleSites();

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
