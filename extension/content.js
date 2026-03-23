// CompTool Content Script — injected on eBay Seller Hub Research (Terapeak) pages

(function () {
  "use strict";

  const BUTTON_ID = "comptool-save-btn";
  const STATUS_ID = "comptool-status";

  function scrapeResults() {
    const items = [];
    const rows = document.querySelectorAll(
      ".sold-result-table table tr:not(.research-table-header)"
    );

    rows.forEach((row) => {
      try {
        const cells = row.querySelectorAll("td");
        if (cells.length < 8) return;

        // Title from img alt or link text
        const linkEl = row.querySelector('a[href*="/itm/"]');
        const imgEl = row.querySelector("img");
        const productCell = row.querySelector('[class*="product-info"]');
        const title =
          imgEl?.alt?.trim() ||
          linkEl?.textContent?.trim() ||
          productCell?.textContent?.trim();
        if (!title || title.length < 3) return;

        // Item ID from link
        const href = linkEl?.href || "";
        const idMatch = href.match(/\/itm\/(\d+)/);
        const ebayItemId = idMatch
          ? idMatch[1]
          : `sh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        // Price (avgSoldPrice column)
        const priceCell = row.querySelector('[class*="avgSoldPrice"]');
        let soldPrice = 0;
        if (priceCell) {
          const m = priceCell.textContent.match(/\$?([\d,]+\.?\d*)/);
          if (m) soldPrice = parseFloat(m[1].replace(",", ""));
        }
        if (soldPrice === 0) return;

        // Listing type
        const formatEl = priceCell?.querySelector(".format");
        const listingType = formatEl?.textContent?.trim() || null;

        // Shipping
        const shipCell = row.querySelector('[class*="avgShippingCost"]');
        let shippingPrice = null;
        if (shipCell) {
          const text = shipCell.textContent || "";
          if (text.toLowerCase().includes("free")) {
            shippingPrice = 0;
          } else {
            const m = text.match(/\$?([\d,]+\.?\d*)/);
            if (m) shippingPrice = parseFloat(m[1].replace(",", ""));
          }
        }

        // Quantity sold (totalSoldCount column)
        const qtyCell = row.querySelector('[class*="totalSoldCount"]');
        let quantitySold = null;
        if (qtyCell) {
          const m = qtyCell.textContent.match(/([\d,]+)/);
          if (m) quantitySold = parseInt(m[1].replace(",", ""));
        }

        // Total sales value (totalSalesValue column)
        const salesCell = row.querySelector('[class*="totalSalesValue"]');
        let totalSales = null;
        if (salesCell) {
          const m = salesCell.textContent.match(/\$?([\d,]+\.?\d*)/);
          if (m) totalSales = parseFloat(m[1].replace(",", ""));
        }

        // Bids
        const bidsCell = row.querySelector('[class*="bids"]');
        let bidCount = null;
        if (bidsCell) {
          const m = bidsCell.textContent.match(/(\d+)/);
          if (m) bidCount = parseInt(m[1]);
        }

        // Date
        const dateCell = row.querySelector('[class*="dateLastSold"]');
        let soldDate = new Date().toISOString();
        if (dateCell) {
          const parsed = new Date(dateCell.textContent.trim());
          if (!isNaN(parsed.getTime())) soldDate = parsed.toISOString();
        }

        // Image
        const imageUrl = imgEl?.src
          ? imgEl.src.startsWith("//")
            ? `https:${imgEl.src}`
            : imgEl.src
          : null;

        const totalPrice =
          shippingPrice !== null ? soldPrice + shippingPrice : soldPrice;

        items.push({
          ebayItemId,
          title,
          soldPrice,
          shippingPrice,
          totalPrice,
          condition: null,
          category: null,
          listingType,
          bidCount,
          quantitySold,
          totalSales,
          watchers: null,
          seller: null,
          sellerFeedback: null,
          imageUrl,
          itemUrl: href || null,
          soldDate,
        });
      } catch {
        // skip unparseable rows
      }
    });

    return items;
  }

  function getKeyword() {
    // Try the search input first
    const input = document.querySelector(
      'input[placeholder*="keyword" i], input[placeholder*="Enter keywords" i], input[placeholder*="UPC" i]'
    );
    if (input?.value) return input.value.trim();

    // Fall back to URL param
    const url = new URL(window.location.href);
    const kw = url.searchParams.get("keywords");
    if (kw) return kw;

    // Page title as last resort
    const pageTitle = document.title.replace(/\s*[|\-–].*$/, "").trim();
    if (pageTitle && pageTitle.length > 2) return pageTitle;

    return "uncategorized";
  }

  function setStatus(msg, type) {
    const el = document.getElementById(STATUS_ID);
    if (!el) return;
    el.textContent = msg;
    el.className = `comptool-status comptool-status--${type}`;
    if (type === "success" || type === "error") {
      setTimeout(() => {
        el.textContent = "";
        el.className = "comptool-status";
      }, 5000);
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

  async function handleSave() {
    const btn = document.getElementById(BUTTON_ID);
    if (!btn) return;

    const settings = await chrome.storage.sync.get(["apiUrl", "apiKey"]);
    if (!settings.apiUrl || !settings.apiKey) {
      setStatus("Configure API URL and key in extension options first", "error");
      return;
    }

    const keyword = getKeyword();
    if (!keyword) {
      setStatus("No keyword found — search for something first", "error");
      return;
    }

    const items = scrapeResults();
    if (items.length === 0) {
      setStatus("No results found on this page to save", "error");
      return;
    }

    btn.disabled = true;
    btn.textContent = `Saving ${items.length} comps...`;
    setStatus("", "");

    try {
      const apiUrl = settings.apiUrl.replace(/\/+$/, "");
      const machineId = await getMachineId();
      const resp = await fetch(`${apiUrl}/comp/api/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": settings.apiKey,
          "X-Machine-Id": machineId,
        },
        body: JSON.stringify({ keyword, items, source: "extension" }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      const result = await resp.json();
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
      btn.textContent = "Save Comps";
    }
  }

  function injectButton() {
    if (document.getElementById(BUTTON_ID)) return;

    // Find the results table or search area to inject near
    const target =
      document.querySelector(".sold-result-table") ||
      document.querySelector(".search-results") ||
      document.querySelector(".research-container");
    if (!target) return;

    const container = document.createElement("div");
    container.className = "comptool-toolbar";

    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.textContent = "Save Comps";
    btn.addEventListener("click", handleSave);

    const autoLabel = document.createElement("label");
    autoLabel.style.cssText = "display:flex;align-items:center;gap:4px;font-size:12px;color:#666;cursor:pointer;margin-left:8px;";
    const autoCheck = document.createElement("input");
    autoCheck.type = "checkbox";
    autoCheck.checked = autoImportEnabled;
    autoCheck.addEventListener("change", () => {
      autoImportEnabled = autoCheck.checked;
      chrome.storage.sync.set({ autoImport: autoCheck.checked });
    });
    autoLabel.appendChild(autoCheck);
    autoLabel.appendChild(document.createTextNode("Auto-import"));

    const status = document.createElement("span");
    status.id = STATUS_ID;
    status.className = "comptool-status";

    container.appendChild(btn);
    container.appendChild(autoLabel);
    container.appendChild(status);
    target.parentNode.insertBefore(container, target);
  }

  // ─── Auto-import logic ──────────────────────────────
  let lastResultsHash = "";
  let autoSaveTimer = null;
  let autoImportEnabled = true;

  // Load auto-import setting from storage
  chrome.storage.sync.get("autoImport", (data) => {
    autoImportEnabled = data.autoImport !== false; // default ON
  });
  // Listen for setting changes in real-time
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.autoImport) {
      autoImportEnabled = changes.autoImport.newValue !== false;
    }
  });

  function hashResults() {
    // Quick fingerprint of visible results to detect changes
    const rows = document.querySelectorAll(
      ".sold-result-table table tr:not(.research-table-header)"
    );
    if (rows.length === 0) return "";
    const first = rows[0]?.textContent?.trim().slice(0, 100) || "";
    const last = rows[rows.length - 1]?.textContent?.trim().slice(0, 100) || "";
    return `${rows.length}|${first}|${last}`;
  }

  async function checkAndAutoSave() {
    if (!autoImportEnabled) return;

    const settings = await chrome.storage.sync.get(["apiUrl", "apiKey"]);
    if (!settings.apiUrl || !settings.apiKey) return;

    const hash = hashResults();
    if (!hash || hash === lastResultsHash) return;

    const keyword = getKeyword();
    if (!keyword) return;

    const items = scrapeResults();
    if (items.length === 0) return;

    lastResultsHash = hash;
    setStatus(`Auto-saving ${items.length} comps...`, "info");

    try {
      const apiUrl = settings.apiUrl.replace(/\/+$/, "");
      const machineId = await getMachineId();
      const resp = await fetch(`${apiUrl}/comp/api/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": settings.apiKey,
          "X-Machine-Id": machineId,
        },
        body: JSON.stringify({ keyword, items, source: "extension" }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      const result = await resp.json();
      setStatus(
        `Auto-saved ${result.resultCount} comps (avg $${result.stats.avg?.toFixed(2)}, median $${result.stats.median?.toFixed(2)})`,
        "success"
      );
    } catch (err) {
      setStatus(`Auto-save failed: ${err.message}`, "error");
    }
  }

  // Watch for the results table to appear (Terapeak is an SPA)
  function waitForResults() {
    injectButton();

    const observer = new MutationObserver(() => {
      injectButton();

      // Debounce auto-save check — wait for DOM to settle after changes
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(checkAndAutoSave, 2000);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Also check once after initial load
    setTimeout(checkAndAutoSave, 3000);
  }

  // Start
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", waitForResults);
  } else {
    waitForResults();
  }
})();
