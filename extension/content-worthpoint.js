// CompTool Content Script — WorthPoint sold items
// Scrapes search results from worthpoint.com/inventory/search pages
// and auto-imports them to the CompTool database.

(function () {
  "use strict";

  const BUTTON_ID = "comptool-wp-save-btn";
  const STATUS_ID = "comptool-wp-status";

  function scrapeResults() {
    const items = [];
    const listings = document.querySelectorAll(".product-thumbnail");

    listings.forEach((el) => {
      try {
        // Title
        const titleEl = el.querySelector(".info-field.product-title") || el.querySelector("span[id^='itemTitle']");
        if (!titleEl) return;
        const title = titleEl.textContent?.trim() || "";
        if (!title || title.length < 3) return;

        // WorthPoint Item ID
        const idEl = el.querySelector("span[id^='itemTitle']");
        const wpId = idEl ? idEl.id.match(/\d+/)?.[0] : null;
        const ebayItemId = wpId ? `wp-${wpId}` : `wp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        // Detail page URL
        const linkEl = el.querySelector("a.item-link");
        const itemUrl = linkEl ? `https://www.worthpoint.com${linkEl.getAttribute("href")}` : null;

        // Sold price
        const priceEl = el.querySelector(".price .result");
        let soldPrice = 0;
        if (priceEl) {
          const match = priceEl.textContent.match(/\$?([\d,]+\.?\d*)/);
          if (match) soldPrice = parseFloat(match[1].replace(",", ""));
        }
        if (soldPrice === 0) return;

        // Sold date
        const dateEl = el.querySelector(".sold-date .result");
        let soldDate = new Date().toISOString();
        if (dateEl) {
          const parsed = new Date(dateEl.textContent.trim());
          if (!isNaN(parsed.getTime())) soldDate = parsed.toISOString();
        }

        // Source marketplace
        const sourceEl = el.querySelector(".source .result");
        const source = sourceEl?.textContent?.trim() || null;

        // Category
        const catEl = el.querySelector(".category .result");
        const category = catEl?.textContent?.trim() || null;

        // Image
        const imgEl = el.querySelector("img.image-container");
        const imageUrl = imgEl?.src || null;

        items.push({
          ebayItemId,
          title,
          soldPrice,
          shippingPrice: null,
          totalPrice: soldPrice,
          condition: null,
          category: category ? `WorthPoint > ${category}` : null,
          listingType: source || "WorthPoint",
          bidCount: null,
          quantitySold: null,
          totalSales: null,
          watchers: null,
          seller: null,
          sellerFeedback: null,
          imageUrl,
          itemUrl,
          soldDate,
        });
      } catch {
        // skip unparseable
      }
    });

    return items;
  }

  function getKeyword() {
    const url = new URL(window.location.href);
    return url.searchParams.get("query") || url.searchParams.get("q") || "worthpoint-import";
  }

  function setStatus(msg, type) {
    const el = document.getElementById(STATUS_ID);
    if (!el) return;
    el.textContent = msg;
    el.className = `comptool-status comptool-status--${type}`;
    if (type === "success" || type === "error") {
      setTimeout(() => { el.textContent = ""; el.className = "comptool-status"; }, 5000);
    }
  }

  async function getMachineId() {
    let { machineId } = await chrome.storage.local.get("machineId");
    if (!machineId) {
      machineId = crypto.randomUUID();
      await chrome.storage.local.set({ machineId });
    }
    return machineId;
  }

  async function saveComps(items, keyword) {
    const settings = await chrome.storage.sync.get(["apiUrl", "apiKey"]);
    if (!settings.apiUrl || !settings.apiKey) return;

    const apiUrl = settings.apiUrl.replace(/\/+$/, "");
    const machineId = await getMachineId();
    const resp = await fetch(`${apiUrl}/comp/api/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": settings.apiKey,
        "X-Machine-Id": machineId,
      },
      body: JSON.stringify({ keyword, items, source: "worthpoint" }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${resp.status}`);
    }
    return resp.json();
  }

  async function handleSave() {
    const btn = document.getElementById(BUTTON_ID);
    if (!btn) return;

    const keyword = getKeyword();
    const items = scrapeResults();
    if (items.length === 0) { setStatus("No items found on this page", "error"); return; }

    btn.disabled = true;
    btn.textContent = `Saving ${items.length} comps...`;

    try {
      const result = await saveComps(items, keyword);
      const count = result?.resultCount || items.length;
      const avg = result?.stats?.avg;
      setStatus(
        `Saved ${count} comps${avg ? ` (avg $${avg.toFixed(2)})` : ""}`,
        "success"
      );
    } catch (err) {
      setStatus(`Error: ${err.message}`, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Save to CompTool";
    }
  }

  // ─── Auto-import ──────────────────────────────────
  let lastHash = "";
  let autoTimer = null;
  let autoEnabled = true;

  chrome.storage.sync.get("autoImport", (data) => {
    autoEnabled = data.autoImport !== false;
  });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.autoImport) autoEnabled = changes.autoImport.newValue !== false;
  });

  function hashResults() {
    const items = document.querySelectorAll(".product-thumbnail");
    if (items.length === 0) return "";
    const first = items[0]?.textContent?.trim().slice(0, 80) || "";
    const last = items[items.length - 1]?.textContent?.trim().slice(0, 80) || "";
    return `${items.length}|${first}|${last}`;
  }

  async function checkAutoSave() {
    if (!autoEnabled) return;

    const settings = await chrome.storage.sync.get(["apiUrl", "apiKey"]);
    if (!settings.apiUrl || !settings.apiKey) return;

    const hash = hashResults();
    if (!hash || hash === lastHash) return;

    const keyword = getKeyword();
    const items = scrapeResults();
    if (items.length === 0) return;

    lastHash = hash;
    setStatus(`Auto-saving ${items.length} WorthPoint comps...`, "info");

    try {
      const result = await saveComps(items, keyword);
      const count = result?.resultCount || items.length;
      const avg = result?.stats?.avg;
      setStatus(
        `Auto-saved ${count} comps${avg ? ` (avg $${avg.toFixed(2)})` : ""}`,
        "success"
      );
    } catch (err) {
      setStatus(`Auto-save failed: ${err.message}`, "error");
    }
  }

  // ─── UI injection ──────────────────────────────────
  function injectButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const target = document.querySelector(".search-results-body") ||
                   document.querySelector(".product-thumbnail")?.parentNode ||
                   document.querySelector("#searchResults");
    if (!target) return;

    const container = document.createElement("div");
    container.style.cssText = "display:flex;align-items:center;gap:12px;padding:8px 12px;margin-bottom:8px;background:#f0f4ff;border:1px solid #c0d0f0;border-radius:6px;";

    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.textContent = "Save to CompTool";
    btn.style.cssText = "background:#3665f3;color:white;border:none;padding:8px 20px;border-radius:20px;font-size:14px;font-weight:600;cursor:pointer;";
    btn.addEventListener("click", handleSave);

    const autoLabel = document.createElement("label");
    autoLabel.style.cssText = "display:flex;align-items:center;gap:4px;font-size:12px;color:#666;cursor:pointer;";
    const autoCheck = document.createElement("input");
    autoCheck.type = "checkbox";
    autoCheck.checked = autoEnabled;
    autoCheck.addEventListener("change", () => {
      autoEnabled = autoCheck.checked;
      chrome.storage.sync.set({ autoImport: autoCheck.checked });
    });
    autoLabel.appendChild(autoCheck);
    autoLabel.appendChild(document.createTextNode("Auto-import"));

    const status = document.createElement("span");
    status.id = STATUS_ID;
    status.style.cssText = "font-size:13px;font-weight:500;";

    container.appendChild(btn);
    container.appendChild(autoLabel);
    container.appendChild(status);
    target.parentNode.insertBefore(container, target);
  }

  function start() {
    injectButton();

    const observer = new MutationObserver(() => {
      injectButton();
      if (autoTimer) clearTimeout(autoTimer);
      autoTimer = setTimeout(checkAutoSave, 2000);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(checkAutoSave, 3000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
