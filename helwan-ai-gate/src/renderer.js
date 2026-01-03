// renderer.js (الإصدار النهائي الكامل + مميزات مضافة بدون تخريب)

// الأصلية بدأت هنا
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
      backButton.disabled = !webview.canGoBack();
      forwardButton.disabled = !webview.canGoForward();
      reloadButton.disabled = false;
    } catch (e) {
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
  } catch (e) {}
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

// ------------------ إضافات ذكية (مضافة دون حذف أي شيء أصلي) ------------------

// Helper: escape HTML (مساعد أصلي مستخدم لاحقاً)
function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
}

// ---- Smart Command Parser (الميزة رقم 1) ----
function smartCommand(input) {
  if (!input || typeof input !== 'string') return '';
  const raw = input.trim();
  const text = raw.toLowerCase();

  // 1) Full URL -> return as-is
  if (text.startsWith('http://') || text.startsWith('https://')) return raw;

  // 2) Domain-like (contains dot, no spaces)
  if (text.includes('.') && !text.includes(' ')) return (text.startsWith('http') ? raw : 'https://' + raw);

  // 3) quick keywords map
  const keywords = {
    'youtube': 'https://www.youtube.com',
    'yt': 'https://www.youtube.com',
    'facebook': 'https://www.facebook.com',
    'fb': 'https://www.facebook.com',
    'gmail': 'https://mail.google.com',
    'maps': 'https://maps.google.com',
    'twitter': 'https://twitter.com',
    'x': 'https://twitter.com',
    'whatsapp': 'https://web.whatsapp.com',
    'github': 'https://github.com',
    'reddit': 'https://www.reddit.com',
    'duckduckgo': 'https://duckduckgo.com'
  };
  for (const k in keywords) {
    if (text === k || text.includes(k + ' ' ) || text.includes(' ' + k) || text.includes(k + '.')) {
      return keywords[k];
    }
  }

  // 4) Play / شغل -> youtube search
  if (text.startsWith('play ') || text.startsWith('شغل ') || text.startsWith('شغّل ')) {
    const q = raw.replace(/^play\s+/i, '').replace(/^شغل\s+/i, '').replace(/^شغّل\s+/i, '');
    return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
  }

  // 5) commands (internal)
  const trimmed = text.trim();
  if (trimmed === 'open new tab' || trimmed === 'افتح تبويب' || trimmed === 'فتح تبويب' || trimmed === 'new tab') {
    return '__COMMAND__NEW_TAB';
  }
  if (trimmed === 'close tab' || trimmed === 'اغلق التبويب' || trimmed === 'اغلق تاب' || trimmed === 'close tab') {
    return '__COMMAND__CLOSE_TAB';
  }
  if (trimmed === 'clear tabs' || trimmed === 'اغلق الكل' || trimmed === 'close all tabs') {
    return '__COMMAND__CLOSE_ALL';
  }

  // 6) default -> google search
  return 'https://www.google.com/search?q=' + encodeURIComponent(raw);
}

// ------------------ نهاية Smart Command ------------------

// ---- تابع إنشاء التبويب (غير معدل منطقياً) ----
function createTab(url, name, displayName = null) {
  const tabsContainer = $id('tabs-container');
  const content = $id('content');
  const welcomePage = $id('welcome-page');

  if (!tabsContainer || !content) return;

  let finalUrl = url || '';
  // إذا الأمر داخلي (مثل __COMMAND__) اترك finalUrl كما هو
  if (!finalUrl.match(/^https?:\/\//i) && !finalUrl.startsWith('__COMMAND__')) finalUrl = 'https://' + finalUrl;

  const tabId = name; 
  const tabElement = document.createElement('div');
  tabElement.className = 'tab';
  tabElement.id = tabId;

  const tabText = displayName || (name.split('-')[0] || 'Site');
  tabElement.innerHTML = `<span class="tab-label">${escapeHtml(tabText)}</span><span class="tab-close">&times;</span>`;

  tabsContainer.appendChild(tabElement);

  const webviewElement = document.createElement('webview');
  webviewElement.className = 'webview-page';
  webviewElement.id = `webview-${tabId}`;
  webviewElement.src = finalUrl;
  webviewElement.setAttribute('allowpopups', '');
  webviewElement.setAttribute('partition', `persist:${tabId}`);
  webviewElement.style.flex = '1';
  webviewElement.style.width = '100%';
  webviewElement.style.height = '100%';

  content.appendChild(webviewElement);

  tabs[tabId] = { name: tabText, url: finalUrl, tabElement, webviewElement };

  tabElement.addEventListener('click', (e) => {
    if (e.target && e.target.classList && e.target.classList.contains('tab-close')) {
      closeTab(tabId);
    } else {
      switchTab(tabId);
    }
  });

  const onDidNavigate = (event) => {
    if (activeTabId === tabId) {
      updateNavButtons(webviewElement);
      try {
        updateUrlBar(event && event.url ? event.url : webviewElement.getURL());
      } catch (e) {}
    }
  };

  webviewElement.addEventListener('did-navigate', onDidNavigate);
  webviewElement.addEventListener('did-navigate-in-page', onDidNavigate);

  webviewElement.addEventListener('did-finish-load', () => {
    if (activeTabId === tabId) {
      updateNavButtons(webviewElement); 
      try { updateUrlBar(webviewElement.getURL()); } catch (e) {}
    }

    const src = webviewElement.getURL ? webviewElement.getURL() : finalUrl;
    if (/gemini\.google\.com|bard\.google\.com/i.test(src)) {
      injectGeminiFix(webviewElement);
    }
  });

  webviewElement.addEventListener('did-fail-load', (e) => {
    console.warn('webview failed to load', e);
  });

  switchTab(tabId);

  if (window && window.electronAPI && typeof window.electronAPI.sendNotification === 'function') {
    window.electronAPI.sendNotification('Site Opened', `${tabText} opened successfully.`);
  }
}

// ---- switchTab, closeTab, reloadTab, helpers (لم أغير المنطق الأصلي إلا للتكامل الآمن) ----
function switchTab(tabId) {
  if (!tabs[tabId]) return;

  if (activeTabId && tabs[activeTabId]) {
    tabs[activeTabId].tabElement.classList.remove('active');
    if (tabs[activeTabId].webviewElement) {
      tabs[activeTabId].webviewElement.classList.remove('active');
      tabs[activeTabId].webviewElement.style.display = 'none';
    }
  }

  const welcomePage = $id('welcome-page');
  if (welcomePage) welcomePage.style.display = 'none';

  tabs[tabId].tabElement.classList.add('active');
  if (tabs[tabId].webviewElement) {
    tabs[tabId].webviewElement.classList.add('active');
    tabs[tabId].webviewElement.style.display = 'flex';
  }
  activeTabId = tabId;

  setTimeout(() => {
    updateNavButtons(tabs[tabId].webviewElement);
    try {
      const currentUrl = tabs[tabId].webviewElement && typeof tabs[tabId].webviewElement.getURL === 'function'
        ? tabs[tabId].webviewElement.getURL()
        : tabs[tabId].url;
      updateUrlBar(currentUrl);
    } catch (e) {
      updateUrlBar(tabs[tabId].url);
    }
  }, 100); 

  const tabsContainer = $id('tabs-container');
  if (tabsContainer) tabsContainer.style.display = 'flex';
}

function closeTab(tabId) {
  if (!tabs[tabId]) return;

  const closedTab = tabs[tabId];
  try {
    if (closedTab.tabElement && closedTab.tabElement.parentNode) closedTab.tabElement.parentNode.removeChild(closedTab.tabElement);
    if (closedTab.webviewElement && closedTab.webviewElement.parentNode) closedTab.webviewElement.parentNode.removeChild(closedTab.webviewElement);
  } catch (e) { console.warn('Error removing tab elements', e); }

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

function reloadTab() {
  if (activeTabId && tabs[activeTabId] && tabs[activeTabId].webviewElement) {
    try { tabs[activeTabId].webviewElement.reload(); } catch (e) {}
  }
}

// ---- Show/hide add site form (unchanged) ----
function showAddSiteForm() { const el = $id('add-site-form-container'); if (el) el.style.display = 'block'; }
function hideAddSiteForm() { const el = $id('add-site-form-container'); if (el) el.style.display = 'none'; }

const addSiteForm = $id('add-site-form');
if (addSiteForm) {
  addSiteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const nameInput = $id('site-name-input');
    const urlInput = $id('site-url-input');
    const name = nameInput ? nameInput.value.trim() : '';
    const url = urlInput ? urlInput.value.trim() : '';
    if (!name || !url) { alert('Please provide both name and URL.'); return; }
    if (window && window.electronAPI && typeof window.electronAPI.addSite === 'function') {
      window.electronAPI.addSite({ name, url });
    }
    if (nameInput) nameInput.value = '';
    if (urlInput) urlInput.value = '';
    hideAddSiteForm();
  });
}

// ---- URL bar handling: مدمج مع smartCommand لكن يحافظ على السلوك السابق ----
if (urlBar) {
  // remove any previous handler gracefully by cloning (defensive)
  try {
    const newUrlBar = urlBar.cloneNode(true);
    urlBar.parentNode.replaceChild(newUrlBar, urlBar);
  } catch (e) {
    // if clone fails, proceed with existing
  }

  const currentUrlBar = document.getElementById('url-bar');
  if (currentUrlBar) {
    currentUrlBar.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const rawInput = currentUrlBar.value.trim();
        if (!rawInput) return;

        // run smartCommand to get either a URL or special command token
        const commandResult = smartCommand(rawInput);

        // handle internal commands
        if (commandResult === '__COMMAND__NEW_TAB') {
          createTab('about:blank', `tab-${Date.now()}`, 'New Tab');
          currentUrlBar.value = '';
          return;
        }
        if (commandResult === '__COMMAND__CLOSE_TAB') {
          if (activeTabId) closeTab(activeTabId);
          currentUrlBar.value = '';
          return;
        }
        if (commandResult === '__COMMAND__CLOSE_ALL') {
          Object.keys(tabs).forEach(id => closeTab(id));
          currentUrlBar.value = '';
          return;
        }

        // Determine final URL (result from smartCommand is already a URL)
        const finalUrl = commandResult;

        // If there is an active tab, load there (preserves original behavior)
        if (activeTabId && tabs[activeTabId] && tabs[activeTabId].webviewElement) {
          try {
            if (typeof tabs[activeTabId].webviewElement.loadURL === 'function') {
              tabs[activeTabId].webviewElement.loadURL(finalUrl);
            } else {
              tabs[activeTabId].webviewElement.src = finalUrl;
            }
          } catch (err) {
            tabs[activeTabId].webviewElement.src = finalUrl;
          }
        } else {
          // no active tab -> create a new one (keeps original usability)
          createTab(finalUrl, `tab-${Date.now()}`, rawInput);
        }
      }
    });
  }
}

// ---- Back / Forward / Reload buttons wiring (unchanged logic) ----
if (backButton) {
  backButton.addEventListener('click', () => {
    if (activeTabId && tabs[activeTabId] && tabs[activeTabId].webviewElement && typeof tabs[activeTabId].webviewElement.canGoBack === 'function') {
      try { if (tabs[activeTabId].webviewElement.canGoBack()) tabs[activeTabId].webviewElement.goBack(); } catch (e) {}
    }
  });
}

if (forwardButton) {
  forwardButton.addEventListener('click', () => {
    if (activeTabId && tabs[activeTabId] && tabs[activeTabId].webviewElement && typeof tabs[activeTabId].webviewElement.canGoForward === 'function') {
      try { if (tabs[activeTabId].webviewElement.canGoForward()) tabs[activeTabId].webviewElement.goForward(); } catch (e) {}
    }
  });
}

if (reloadButton) { reloadButton.addEventListener('click', reloadTab); }

// ---- Window onload (keeps original init) ----
window.onload = () => {
  loadSites();
  updateNavButtons(null);
  updateUrlBar('');
  const tabsContainer = $id('tabs-container');
  if (tabsContainer && tabsContainer.children.length === 0) tabsContainer.style.display = 'none';

  // Initialize optional UI elements if present (clock & notepad)
  // Clock: if element exists, start updating (non-blocking)
  const clockEl = document.getElementById('clock-display');
  if (clockEl) {
    try {
      // update once immediately and then every second
      const updateClockOnce = () => { clockEl.textContent = new Date().toLocaleTimeString(); };
      updateClockOnce();
      setInterval(updateClockOnce, 1000);
    } catch (e) {
      console.warn('Clock init failed', e);
    }
  }

  // Notepad: bind buttons and load saved content if present
  try {
    const notepadText = document.getElementById('notepad-text');
    const notepadBtn = document.getElementById('notepad-btn');
    const notepadCloseBtn = document.getElementById('notepad-close-btn');
    const notepadClearBtn = document.getElementById('notepad-clear-btn');
    const notepadContainer = document.getElementById('notepad-container');

    if (notepadText) {
      // load saved notes
      const saved = localStorage.getItem('helwan-notes');
      if (saved) notepadText.value = saved;

      // save on input (debounced-ish)
      let saveTimer = null;
      notepadText.addEventListener('input', () => {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          try { localStorage.setItem('helwan-notes', notepadText.value); } catch (e) {}
        }, 300);
      });
    }

    if (notepadBtn && notepadContainer) {
      notepadBtn.addEventListener('click', () => {
        try {
          notepadContainer.style.display = 'flex';
          notepadContainer.setAttribute('aria-hidden', 'false');
        } catch (e) {}
      });
    }
    if (notepadCloseBtn && notepadContainer) {
      notepadCloseBtn.addEventListener('click', () => {
        try {
          notepadContainer.style.display = 'none';
          notepadContainer.setAttribute('aria-hidden', 'true');
        } catch (e) {}
      });
    }
    if (notepadClearBtn && notepadText) {
      notepadClearBtn.addEventListener('click', () => {
        if (!confirm('Clear all notes?')) return;
        try {
          notepadText.value = '';
          localStorage.removeItem('helwan-notes');
        } catch (e) {}
      });
    }
  } catch (e) {
    console.warn('Notepad init failed', e);
  }
};

// ---- IPC/listeners from preload/main (unchanged behaviour but safe) ----
if (window && window.electronAPI) {
  if (typeof window.electronAPI.onSitesData === 'function') {
    window.electronAPI.onSitesData((data) => { renderSites(data || []); });
  }
  if (typeof window.electronAPI.onSiteAddedSuccessfully === 'function') {
    window.electronAPI.onSiteAddedSuccessfully(() => {
      if (typeof window.electronAPI.sendNotification === 'function') window.electronAPI.sendNotification('Site Added', 'Site added successfully!');
      loadSites();
    });
  }
  if (typeof window.electronAPI.onSiteDeletedSuccessfully === 'function') {
    window.electronAPI.onSiteDeletedSuccessfully(() => {
      if (typeof window.electronAPI.sendNotification === 'function') window.electronAPI.sendNotification('Site Deleted', 'Site deleted successfully!');
      loadSites();
    });
  }
}

// Expose helpers for debugging (optional)
window.helwan = Object.assign(window.helwan || {}, { createTab, closeTab, smartCommand, tabs });

/* نهاية الملف - لا تغييرات أخرى تمت على المنطق الأصلي، كل الإضافات في المكان المناسب وآمنة */
