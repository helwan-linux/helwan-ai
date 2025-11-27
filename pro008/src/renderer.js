// renderer.js (الإصدار النهائي الكامل)

console.log('--- ✅ Multi-tab renderer active ---');

let tabs = {};
let activeTabId = null;

const backButton = document.getElementById('back-button');
const forwardButton = document.getElementById('forward-button');
const reloadButton = document.getElementById('reload-button');
const urlBar = document.getElementById('url-bar');

// Utility: safe DOM getter
function $id(id) {
  return document.getElementById(id);
}

function loadSites() {
  if (window && window.electronAPI && typeof window.electronAPI.getSites === 'function') {
    window.electronAPI.getSites();
  } else {
    console.warn('electronAPI.getSites not available');
  }
}

function updateNavButtons(webview) {
  if (!backButton || !forwardButton || !reloadButton) return;
  if (webview) {
    try {
      // THE CORE LOGIC: Checking webview navigation history
      backButton.disabled = !webview.canGoBack();
      forwardButton.disabled = !webview.canGoForward();
      reloadButton.disabled = false;
    } catch (e) {
      // if anything goes wrong, disable them safely
      backButton.disabled = true;
      forwardButton.disabled = true;
      reloadButton.disabled = false;
    }
  } else {
    backButton.disabled = true;
    forwardButton.disabled = true;
    reloadButton.disabled = true;
  }
}

function updateUrlBar(url) {
  if (!urlBar) return;
  try {
    urlBar.value = url || '';
  } catch (e) {
    // ignore
  }
}

function renderSites(data) {
  const container = $id('site-buttons-container');
  if (!container) return;
  container.innerHTML = '';

  const sortedData = Array.isArray(data) ? data.slice().sort((a, b) => {
    return (a.name || '').localeCompare(b.name || '', 'en');
  }) : [];

  sortedData.forEach(site => {
    const button = document.createElement('button');
    button.className = 'site-button';

    const buttonContent = document.createElement('div');
    buttonContent.style.display = 'flex';
    buttonContent.style.justifyContent = 'space-between';
    buttonContent.style.alignItems = 'center';
    buttonContent.style.width = '100%';

    const siteNameSpan = document.createElement('span');
    siteNameSpan.innerText = site.name || site.url || 'Untitled';
    siteNameSpan.style.cursor = 'pointer';

    // Open site in a brand new tab instance every click
    siteNameSpan.onclick = () => createTab(site.url, `${site.name}-${Date.now()}`, site.name);

    const deleteButton = document.createElement('span');
    deleteButton.className = 'delete-site-btn';
    deleteButton.innerText = '🗑';
    deleteButton.title = `Delete ${site.name || site.url || 'site'}`;
    deleteButton.onclick = (e) => {
      e.stopPropagation();
      if (confirm(`Are you sure you want to delete the site "${site.name}"?`)) {
        if (window && window.electronAPI && typeof window.electronAPI.deleteSite === 'function') {
          window.electronAPI.deleteSite(site.name);
        }
      }
    };

    buttonContent.appendChild(siteNameSpan);
    buttonContent.appendChild(deleteButton);
    button.appendChild(buttonContent);
    container.appendChild(button);
  });
}

// Inject aggressive CSS/workarounds for Gemini/Bard pages when needed.
function injectGeminiFix(webviewElement) {
  if (!webviewElement || typeof webviewElement.executeJavaScript !== 'function') return;

  const injectionCode = `
    (function() {
      try {
        if (!document.getElementById('__helwan_gemini_fix')) {
          const style = document.createElement('style');
          style.id = '__helwan_gemini_fix';
          style.textContent = \`
            html, body, div[data-testid="scrolling-container"] {
              overflow: auto !important;
              overflow-x: hidden !important;
            }
            div[role="main"] > div:last-child,
            div[role="contentinfo"],
            [role="banner"],
            div[data-testid="bottom-rail"] {
              position: static !important;
              z-index: 1 !important;
            }
            div[role="main"] { padding-bottom: 400px !important; }
          \`;
          document.head && document.head.appendChild(style);
          console.log('Helwan: Gemini fix injected');
        }
      } catch (e) {
        console.error('Helwan: Gemini fix failed', e);
      }
    })();
  `;

  webviewElement.executeJavaScript(injectionCode).catch(err => {
    console.error('Failed to inject Gemini fix:', err);
  });
}

// Create a new tab + webview.
function createTab(url, name, displayName = null) {
  const tabsContainer = $id('tabs-container');
  const content = $id('content');
  const welcomePage = $id('welcome-page');

  if (!tabsContainer || !content) {
    console.error('Tabs container or content not found in DOM');
    return;
  }

  // Normalize URL
  let finalUrl = url || '';
  if (!finalUrl.match(/^https?:\/\//i)) {
    finalUrl = 'https://' + finalUrl;
  }

  const tabId = name; 
  const tabElement = document.createElement('div');
  tabElement.className = 'tab';
  tabElement.id = tabId;

  const tabText = displayName || (name.split('-')[0] || 'Site');
  tabElement.innerHTML = `<span class="tab-label">${escapeHtml(tabText)}</span><span class="tab-close">&times;</span>`;

  // Append tab
  tabsContainer.appendChild(tabElement);

  // Create webview
  const webviewElement = document.createElement('webview');
  webviewElement.className = 'webview-page';
  webviewElement.id = `webview-${tabId}`;
  webviewElement.src = finalUrl;
  webviewElement.setAttribute('allowpopups', '');
  webviewElement.setAttribute('partition', `persist:${tabId}`);

  // Ensure webview takes the available space
  webviewElement.style.flex = '1';
  webviewElement.style.width = '100%';
  webviewElement.style.height = '100%';

  content.appendChild(webviewElement);

  // Register tab meta
  tabs[tabId] = {
    name: tabText,
    url: finalUrl,
    tabElement,
    webviewElement
  };

  // Tab click behavior
  tabElement.addEventListener('click', (e) => {
    if (e.target && e.target.classList && e.target.classList.contains('tab-close')) {
      closeTab(tabId);
    } else {
      switchTab(tabId);
    }
  });

  // Webview events - update nav buttons and url bar
  const onDidNavigate = (event) => {
    if (activeTabId === tabId) {
      // CRITICAL: Update nav buttons immediately after navigation
      updateNavButtons(webviewElement); 
      try {
        updateUrlBar(event && event.url ? event.url : webviewElement.getURL());
      } catch (e) { /* ignore */ }
    }
  };

  // did-navigate (full navigation)
  webviewElement.addEventListener('did-navigate', onDidNavigate);

  // did-navigate-in-page (hash/SPA)
  webviewElement.addEventListener('did-navigate-in-page', onDidNavigate);

  // did-finish-load
  webviewElement.addEventListener('did-finish-load', () => {
    if (activeTabId === tabId) {
      // CRITICAL: Update nav buttons immediately after load finish
      updateNavButtons(webviewElement); 
      try {
        updateUrlBar(webviewElement.getURL());
      } catch (e) { /* ignore */ }
    }

    // If URL matches Gemini/Bard patterns, inject fix
    const src = webviewElement.getURL ? webviewElement.getURL() : finalUrl;
    if (/gemini\.google\.com|bard\.google\.com/i.test(src)) {
      injectGeminiFix(webviewElement);
    }
  });

  // Safety: handle load failures gracefully
  webviewElement.addEventListener('did-fail-load', (e) => {
    console.warn('webview failed to load', e);
  });

  // Activate this tab
  switchTab(tabId);

  // Send desktop notification
  if (window && window.electronAPI && typeof window.electronAPI.sendNotification === 'function') {
    window.electronAPI.sendNotification('Site Opened', `${tabText} opened successfully.`);
  }
}

// Switch the visible tab to tabId
function switchTab(tabId) {
  if (!tabs[tabId]) return;

  // Deactivate previous
  if (activeTabId && tabs[activeTabId]) {
    tabs[activeTabId].tabElement.classList.remove('active');
    if (tabs[activeTabId].webviewElement) {
      tabs[activeTabId].webviewElement.classList.remove('active');
      tabs[activeTabId].webviewElement.style.display = 'none';
    }
  }

  const welcomePage = $id('welcome-page');
  if (welcomePage) welcomePage.style.display = 'none';

  // Activate new
  tabs[tabId].tabElement.classList.add('active');
  if (tabs[tabId].webviewElement) {
    tabs[tabId].webviewElement.classList.add('active');
    tabs[tabId].webviewElement.style.display = 'flex';
  }
  activeTabId = tabId;

  // 🔴 الإصلاح: الانتظار قليلاً لضمان جاهزية الـ webview لقراءة حالة التنقل
  setTimeout(() => {
    updateNavButtons(tabs[tabId].webviewElement);

    // Update URL bar safely
    try {
      const currentUrl = tabs[tabId].webviewElement && typeof tabs[tabId].webviewElement.getURL === 'function'
        ? tabs[tabId].webviewElement.getURL()
        : tabs[tabId].url;
      updateUrlBar(currentUrl);
    } catch (e) {
      updateUrlBar(tabs[tabId].url);
    }
  }, 100); 

  // Ensure tabs container is visible
  const tabsContainer = $id('tabs-container');
  if (tabsContainer) tabsContainer.style.display = 'flex';
}

// Close a specific tab and clean up
function closeTab(tabId) {
  if (!tabs[tabId]) return;

  const closedTab = tabs[tabId];
  try {
    if (closedTab.tabElement && closedTab.tabElement.parentNode) closedTab.tabElement.parentNode.removeChild(closedTab.tabElement);
    if (closedTab.webviewElement && closedTab.webviewElement.parentNode) closedTab.webviewElement.parentNode.removeChild(closedTab.webviewElement);
  } catch (e) {
    console.warn('Error removing tab elements', e);
  }

  delete tabs[tabId];

  if (activeTabId === tabId) {
    const remainingTabIds = Object.keys(tabs);
    if (remainingTabIds.length > 0) {
      switchTab(remainingTabIds[remainingTabIds.length - 1]);
    } else {
      activeTabId = null;
      const tabsContainer = $id('tabs-container');
      if (tabsContainer) tabsContainer.style.display = 'none';
      updateNavButtons(null);
      updateUrlBar('');
      const welcomePage = $id('welcome-page');
      if (welcomePage) welcomePage.style.display = 'flex';
    }
  }
}

// Simple helper to escape HTML for tab labels
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Reload active tab
function reloadTab() {
  if (activeTabId && tabs[activeTabId] && tabs[activeTabId].webviewElement) {
    try {
      tabs[activeTabId].webviewElement.reload();
    } catch (e) { /* ignore */ }
  }
}

// Show/hide add-site form helpers
function showAddSiteForm() {
  const el = $id('add-site-form-container');
  if (el) el.style.display = 'block';
}

function hideAddSiteForm() {
  const el = $id('add-site-form-container');
  if (el) el.style.display = 'none';
}

// Form submit handling
const addSiteForm = $id('add-site-form');
if (addSiteForm) {
  addSiteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const nameInput = $id('site-name-input');
    const urlInput = $id('site-url-input');
    const name = nameInput ? nameInput.value.trim() : '';
    const url = urlInput ? urlInput.value.trim() : '';

    if (!name || !url) {
      alert('Please provide both name and URL.');
      return;
    }

    if (window && window.electronAPI && typeof window.electronAPI.addSite === 'function') {
      window.electronAPI.addSite({ name, url });
    }

    if (nameInput) nameInput.value = '';
    if (urlInput) urlInput.value = '';

    hideAddSiteForm();
  });
}

// URL bar "Enter" handling
if (urlBar) {
  urlBar.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && activeTabId && tabs[activeTabId] && tabs[activeTabId].webviewElement) {
      let newUrl = urlBar.value.trim();
      if (!newUrl) return;
      if (!newUrl.match(/^https?:\/\//i)) newUrl = 'https://' + newUrl;
      try {
        tabs[activeTabId].webviewElement.loadURL
          ? tabs[activeTabId].webviewElement.loadURL(newUrl)
          : (tabs[activeTabId].webviewElement.src = newUrl);
      } catch (err) {
        tabs[activeTabId].webviewElement.src = newUrl;
      }
    }
  });
}

// Navigation buttons wiring 
if (backButton) {
  backButton.addEventListener('click', () => {
    if (activeTabId && tabs[activeTabId] && tabs[activeTabId].webviewElement && typeof tabs[activeTabId].webviewElement.canGoBack === 'function') {
      try {
        if (tabs[activeTabId].webviewElement.canGoBack()) tabs[activeTabId].webviewElement.goBack();
      } catch (e) { /* ignore */ }
    }
  });
}

if (forwardButton) {
  forwardButton.addEventListener('click', () => {
    if (activeTabId && tabs[activeTabId] && tabs[activeTabId].webviewElement && typeof tabs[activeTabId].webviewElement.canGoForward === 'function') {
      try {
        if (tabs[activeTabId].webviewElement.canGoForward()) tabs[activeTabId].webviewElement.goForward();
      } catch (e) { /* ignore */ }
    }
  });
}

if (reloadButton) {
  reloadButton.addEventListener('click', reloadTab);
}

// On window load: request sites and initialize UI
window.onload = () => {
  loadSites();
  updateNavButtons(null);
  updateUrlBar('');
  // hide tabs container initially if empty
  const tabsContainer = $id('tabs-container');
  if (tabsContainer && tabsContainer.children.length === 0) tabsContainer.style.display = 'none';
};

// IPC handlers from main
if (window && window.electronAPI) {
  if (typeof window.electronAPI.onSitesData === 'function') {
    window.electronAPI.onSitesData((data) => {
      renderSites(data || []);
    });
  }

  if (typeof window.electronAPI.onSiteAddedSuccessfully === 'function') {
    window.electronAPI.onSiteAddedSuccessfully(() => {
      if (typeof window.electronAPI.sendNotification === 'function') {
        window.electronAPI.sendNotification('Site Added', 'Site added successfully!');
      }
      loadSites();
    });
  }

  if (typeof window.electronAPI.onSiteDeletedSuccessfully === 'function') {
    window.electronAPI.onSiteDeletedSuccessfully(() => {
      if (typeof window.electronAPI.sendNotification === 'function') {
        window.electronAPI.sendNotification('Site Deleted', 'Site deleted successfully!');
      }
      loadSites();
    });
  }
}
