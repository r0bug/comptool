document.addEventListener("DOMContentLoaded", async () => {
  const dot = document.getElementById("statusDot");
  const connText = document.getElementById("connText");
  const searchList = document.getElementById("searchList");
  const dashLink = document.getElementById("dashLink");

  const settings = await chrome.storage.sync.get(["apiUrl", "apiKey"]);

  if (!settings.apiUrl || !settings.apiKey) {
    dot.className = "status-dot err";
    connText.textContent = "Not configured — open Settings";
    searchList.innerHTML = '<li class="empty">Configure API URL and key first</li>';
    return;
  }

  const apiUrl = settings.apiUrl.replace(/\/+$/, "");
  dashLink.href = `${apiUrl}/comp/`;

  // Check connection
  try {
    const resp = await fetch(`${apiUrl}/comp/api/health`, {
      headers: { "X-API-Key": settings.apiKey },
    });
    if (resp.ok) {
      dot.className = "status-dot ok";
      connText.textContent = `Connected to ${new URL(apiUrl).hostname}`;
    } else {
      throw new Error(`HTTP ${resp.status}`);
    }
  } catch (err) {
    dot.className = "status-dot err";
    connText.textContent = `Connection failed: ${err.message}`;
    searchList.innerHTML = '<li class="empty">Cannot reach server</li>';
    return;
  }

  // Check for extension updates
  try {
    const verResp = await fetch(`${apiUrl}/comp/api/extension/version`);
    if (verResp.ok) {
      const { version: latest } = await verResp.json();
      const current = chrome.runtime.getManifest().version;
      if (latest && latest !== current) {
        const updateEl = document.getElementById("updateBanner");
        if (updateEl) {
          updateEl.innerHTML = `Update available: v${latest} (you have v${current}) — <a href="${apiUrl}/comp/extension/" target="_blank">Download</a>`;
          updateEl.style.display = "block";
        }
      }
    }
  } catch {}

  // Load recent searches
  try {
    const resp = await fetch(`${apiUrl}/comp/api/search/history?limit=8`, {
      headers: { "X-API-Key": settings.apiKey },
    });
    const data = await resp.json();

    if (!data.searches || data.searches.length === 0) {
      searchList.innerHTML = '<li class="empty">No searches yet</li>';
      return;
    }

    searchList.innerHTML = data.searches
      .map((s) => {
        const date = new Date(s.createdAt).toLocaleDateString();
        const avg = s.avgPrice != null ? `avg $${s.avgPrice.toFixed(2)}` : "";
        const count = `${s.resultCount} comps`;
        return `<li>
          <div class="search-keyword">${escapeHtml(s.keyword)}</div>
          <div class="search-meta">${count} ${avg ? "· " + avg : ""} · ${s.source || ""} · ${date}</div>
        </li>`;
      })
      .join("");
  } catch {
    searchList.innerHTML = '<li class="empty">Failed to load searches</li>';
  }
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
