const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSites: () => ipcRenderer.send('get-sites'),
  addSite: (newSite) => ipcRenderer.send('add-site', newSite),
  sendNotification: (title, body) => ipcRenderer.send('notify', { title, body }),
  onSitesData: (callback) => ipcRenderer.on('sites-data', (event, data) => callback(data)),
  onSiteAddedSuccessfully: (callback) => ipcRenderer.on('site-added-successfully', () => callback()),
});
