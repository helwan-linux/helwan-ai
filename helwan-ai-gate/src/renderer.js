let currentLang = "en";

function loadUI(lang) {
  fetch(`./locales/${lang}/i18n.json`)
    .then(res => res.json())
    .then(dict => {
      document.getElementById("title").innerText = dict.title;
    });
}

function loadSites(lang) {
  fetch(`./locales/${lang}/sites.json`)
    .then(res => res.json())
    .then(data => {
      const container = document.getElementById("sites");
      container.innerHTML = '';
      data.forEach(site => {
        const div = document.createElement("div");
        div.className = "site";
        div.innerText = site.name;
        div.onclick = () => openSite(site.url);
        container.appendChild(div);
      });
    });
}

function openSite(url) {
  const webview = document.getElementById("webview");
  document.getElementById("sites").style.display = "none";
  webview.style.display = "block";
  webview.src = url;
}

function goHome() {
  document.getElementById("webview").style.display = "none";
  document.getElementById("sites").style.display = "flex";
}

document.getElementById("language-select").addEventListener("change", (e) => {
  currentLang = e.target.value;
  loadUI(currentLang);
  loadSites(currentLang);
});

window.onload = () => {
  loadUI(currentLang);
  loadSites(currentLang);
};
