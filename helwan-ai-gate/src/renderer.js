let tabs = {};
let activeTabId = null;

function loadSites() {
  window.electronAPI.getSites();
}

function renderSites(data) {
  const container = document.getElementById("site-buttons-container");
  container.innerHTML = '';
  data.forEach(site => {
    const button = document.createElement("button");
    button.className = "site-button";
    button.innerText = site.name;
    button.onclick = () => openSite(site.url, site.name);
    container.appendChild(button);
  });
}

function createTab(url, name) {
    const tabId = `tab-${Object.keys(tabs).length + 1}`;
    
    const tabElement = document.createElement('div');
    tabElement.className = 'tab';
    tabElement.id = tabId;
    tabElement.innerHTML = `<span>${name}</span><span class="tab-close">&times;</span>`;
    document.getElementById('tabs-container').appendChild(tabElement);

    const webviewElement = document.createElement('webview');
    webviewElement.className = 'webview-page';
    webviewElement.src = url;
    webviewElement.id = `webview-${tabId}`;
    webviewElement.setAttribute('allowpopups', '');
    document.getElementById('content').appendChild(webviewElement);

    tabs[tabId] = {
        name: name,
        url: url,
        tabElement: tabElement,
        webviewElement: webviewElement
    };

    tabElement.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-close')) {
            closeTab(tabId);
        } else {
            switchTab(tabId);
        }
    });

    switchTab(tabId);
}

function switchTab(tabId) {
    if (activeTabId) {
        tabs[activeTabId].tabElement.classList.remove('active');
        tabs[activeTabId].webviewElement.classList.remove('active');
    }
    
    tabs[tabId].tabElement.classList.add('active');
    tabs[tabId].webviewElement.classList.add('active');
    activeTabId = tabId;

    document.getElementById('tabs-container').style.display = 'flex';
    document.getElementById('welcome-page').style.display = 'none';
}

function closeTab(tabId) {
    const closedTabElement = tabs[tabId].tabElement;
    const closedWebviewElement = tabs[tabId].webviewElement;

    closedTabElement.remove();
    closedWebviewElement.remove();
    
    delete tabs[tabId];

    if (activeTabId === tabId) {
        const remainingTabIds = Object.keys(tabs);
        if (remainingTabIds.length > 0) {
            switchTab(remainingTabIds[remainingTabIds.length - 1]);
        } else {
            activeTabId = null;
            document.getElementById('tabs-container').style.display = 'none';
            document.getElementById('welcome-page').style.display = 'flex';
        }
    }
}

function openSite(url, name) {
    createTab(url, name);
    window.electronAPI.sendNotification('Site Opened', `${name} opened successfully.`);
}

function showAddSiteForm() {
    document.getElementById('add-site-form-container').style.display = 'block';
}

function hideAddSiteForm() {
    document.getElementById('add-site-form-container').style.display = 'none';
}

document.getElementById('add-site-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('site-name-input').value;
    const url = document.getElementById('site-url-input').value;

    window.electronAPI.addSite({ name: name, url: url });
    hideAddSiteForm();
});

window.electronAPI.onSitesData((data) => {
  renderSites(data);
});

window.electronAPI.onSiteAddedSuccessfully(() => {
    window.electronAPI.sendNotification('Site Added', 'Site added successfully!');
    loadSites();
});

window.onload = () => {
    loadSites();
};
