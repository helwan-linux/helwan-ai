// renderer.js (الإصدار النهائي: إصلاح Gemini الجذري + التنقل)
let tabs = {};
let activeTabId = null;

const backButton = document.getElementById('back-button');
const forwardButton = document.getElementById('forward-button');
const reloadButton = document.getElementById('reload-button'); 


function loadSites() {
  window.electronAPI.getSites();
}

function updateNavButtons(webview) {
    if (webview) {
        backButton.disabled = !webview.canGoBack(); 
        forwardButton.disabled = !webview.canGoForward();
        reloadButton.disabled = false; 
    } else {
        backButton.disabled = true;
        forwardButton.disabled = true;
        reloadButton.disabled = true; 
    }
}

function renderSites(data) {
  const container = document.getElementById("site-buttons-container");
  container.innerHTML = '';
  
  const sortedData = data.sort((a, b) => {
    return a.name.localeCompare(b.name, 'en'); 
  });
  
  sortedData.forEach(site => {
    const button = document.createElement("button");
    button.className = "site-button";
    
    const buttonContent = document.createElement('div');
    buttonContent.style.display = 'flex';
    buttonContent.style.justifyContent = 'space-between';
    buttonContent.style.alignItems = 'center';
    buttonContent.style.width = '100%';
    
    const siteNameSpan = document.createElement('span');
    siteNameSpan.innerText = site.name;
    siteNameSpan.style.cursor = 'pointer'; 
    
    siteNameSpan.onclick = () => openSite(site.url, site.name); 

    const deleteButton = document.createElement('span');
    deleteButton.className = 'delete-site-btn';
    deleteButton.innerText = '🗑'; 
    deleteButton.title = `Delete ${site.name}`;
    deleteButton.onclick = (e) => {
      e.stopPropagation(); 
      if (confirm(`Are you sure you want to delete the site "${site.name}"?`)) {
        window.electronAPI.deleteSite(site.name); 
      }
    };
    
    buttonContent.appendChild(siteNameSpan);
    buttonContent.appendChild(deleteButton);
    
    button.appendChild(buttonContent);
    container.appendChild(button);
  });
}

// ✅ الإصلاح الجذري لـ Gemini (باستخدام static !important)
function injectGeminiFix(webviewElement) {
    const injectionCode = `
        (function() {
            // 1. CSS Injection: حقن CSS لتعطيل العناصر المثبتة
            const style = document.createElement('style');
            style.id = 'gemini-fix-style';
            const aggressiveCss = \`
                /* إجبار التمرير على الصفحة الرئيسية */
                html, body, div[data-testid="scrolling-container"] {
                    overflow: auto !important;
                    overflow-x: hidden !important;
                }

                /* استهداف شريط الإدخال والعناصر الثابتة في الأسفل وإجبارها على أن تكون قابلة للتمرير */
                div[role="main"] > div:last-child, 
                div[role="contentinfo"], 
                [role="banner"],
                div[data-testid="bottom-rail"] 
                {
                    position: static !important; /* تغيير من fixed/sticky إلى static */
                    z-index: 1 !important; 
                }
                
                /* إضافة مساحة حشو ضخمة للتمرير (احتياطي) */
                div[role="main"] {
                     padding-bottom: 400px !important; 
                }
            \`;

            // لمنع التكرار
            if (!document.getElementById('gemini-fix-style')) {
                 style.textContent = aggressiveCss;
                 document.head.appendChild(style);
            }
            
            console.log('Hyper-Aggressive Gemini fix applied.');
        })();
    `;
    
    if (webviewElement && !webviewElement.isDestroyed()) {
        webviewElement.executeJavaScript(injectionCode).catch(err => {
            console.error("Failed to inject Gemini fix:", err);
        });
    }
}

function createTab(url, name) {
    const tabId = `tab-${Date.now()}`; 
    
    const tabElement = document.createElement('div');
    tabElement.className = 'tab';
    tabElement.id = tabId;
    tabElement.innerHTML = `<span>${name}</span><span class="tab-close">&times;</span>`;
    document.getElementById('tabs-container').appendChild(tabElement);

    const webviewElement = document.createElement('webview');
    webviewElement.className = 'webview-page';
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    webviewElement.src = url;
    webviewElement.id = `webview-${tabId}`;
    webviewElement.setAttribute('allowpopups', '');
    
    webviewElement.setAttribute('partition', 'persist:main'); 
    
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

    webviewElement.addEventListener('did-navigate', () => {
        if (activeTabId === tabId) {
            updateNavButtons(webviewElement);
        }
    });
    
    webviewElement.addEventListener('did-finish-load', () => {
        if (activeTabId === tabId) {
            updateNavButtons(webviewElement);
            // تطبيق الإصلاح فور تحميل الصفحة إذا كان الموقع هو Gemini/Bard
            if (webviewElement.src.includes('gemini.google.com') || webviewElement.src.includes('bard.google.com')) {
                injectGeminiFix(webviewElement);
            }
        }
    });

    switchTab(tabId);
}

function switchTab(tabId) {
    if (activeTabId) {
        tabs[activeTabId].tabElement.classList.remove('active');
        tabs[activeTabId].webviewElement.classList.remove('active');
    }
    
    const welcomePage = document.getElementById('welcome-page');
    if (welcomePage) welcomePage.style.display = 'none';

    tabs[tabId].tabElement.classList.add('active');
    tabs[tabId].webviewElement.classList.add('active');
    activeTabId = tabId;

    updateNavButtons(tabs[tabId].webviewElement); 

    document.getElementById('tabs-container').style.display = 'flex';
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
            updateNavButtons(null); 
            const welcomePage = document.getElementById('welcome-page');
            if (welcomePage) welcomePage.style.display = 'flex';
        }
    }
}

function openSite(url, name) {
    createTab(url, name);
    window.electronAPI.sendNotification('Site Opened', `${name} opened successfully.`);
}

function reloadTab() {
    if (activeTabId && tabs[activeTabId].webviewElement) {
        tabs[activeTabId].webviewElement.reload();
    }
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
    
    document.getElementById('site-name-input').value = '';
    document.getElementById('site-url-input').value = '';
    
    hideAddSiteForm();
});

// ربط أزرار التنقل بالوظائف
if (backButton) backButton.addEventListener('click', () => {
    if (activeTabId && tabs[activeTabId].webviewElement && tabs[activeTabId].webviewElement.canGoBack()) {
        tabs[activeTabId].webviewElement.goBack();
    }
});

if (forwardButton) forwardButton.addEventListener('click', () => {
    if (activeTabId && tabs[activeTabId].webviewElement && tabs[activeTabId].webviewElement.canGoForward()) {
        tabs[activeTabId].webviewElement.goForward();
    }
});

if (reloadButton) reloadButton.addEventListener('click', reloadTab);

// عند بدء التشغيل
window.onload = () => {
    loadSites();
    updateNavButtons(null); 
};


// معالجات الأحداث المستقبلة من Main Process
window.electronAPI.onSitesData((data) => {
  renderSites(data);
});

window.electronAPI.onSiteAddedSuccessfully(() => {
    window.electronAPI.sendNotification('Site Added', 'Site added successfully!');
    loadSites();
});

window.electronAPI.onSiteDeletedSuccessfully(() => {
    window.electronAPI.sendNotification('Site Deleted', 'Site deleted successfully!');
    loadSites(); 
});
