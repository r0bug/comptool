// CompTool Content Script — eBay sold search results (public search pages)
// Detects sold items on regular eBay search pages (LH_Sold=1 / LH_Complete=1)
// and auto-imports them.
// eBay 2026 uses .s-card (not .s-item) with .s-card__link for links

(function () {
  "use strict";

  const BUTTON_ID = "comptool-sold-save-btn";
  const STATUS_ID = "comptool-sold-status";

  function isSoldSearch() {
    const url = new URL(window.location.href);
    // URL param check
    if (url.searchParams.get("LH_Sold") === "1" || url.searchParams.get("LH_Complete") === "1") return true;
    // Sold filter active in sidebar
    if (document.querySelector('[class*="sold" i].filter--applied, .x-refine__select__svg--soldItems')) return true;
    // "Sold" in heading or active filter text
    const pageText = (document.querySelector('.srp-controls__count-heading')?.textContent || "") +
                     (document.querySelector('[class*="applied-filter"]')?.textContent || "");
    if (pageText.toLowerCase().includes("sold")) return true;
    // Cards with "Sold" date text
    const cards = document.querySelectorAll('.srp-results li.s-card');
    if (cards.length > 0) {
      const sampleText = cards[0]?.textContent || "";
      if (sampleText.match(/Sold\s+\w+\s+\d+/i)) return true;
    }
    return false;
  }

  function getPageCategory() {
    const junk = ["eBay", "All", "More", "See All", "Back", "Shop by Category", ""];

    // eBay breadcrumbs: first few links are the hierarchical path
    // e.g. "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"
    // followed by sibling subcategory links at the same depth.
    // We detect the path vs siblings by checking if category IDs are nested.
    const crumbLinks = document.querySelectorAll('.seo-breadcrumb-text a, [class*="breadcrumb"] a');
    if (crumbLinks.length > 0) {
      const links = Array.from(crumbLinks).map((a) => ({
        text: a.textContent?.trim(),
        href: a.href || "",
        catId: a.href?.match(/\/(\d+)\//)?.[1] || "",
      })).filter((l) => l.text && !junk.includes(l.text) && l.text.length > 1 && l.text.length < 80);

      if (links.length > 0) {
        // The path links are the first N links before siblings start.
        // Path links have unique category IDs; siblings repeat the same depth.
        // Heuristic: path links are the first 1-4 links. After that, if a link's
        // URL pattern is the same depth as the previous, it's a sibling.
        const path = [links[0]];
        for (let i = 1; i < links.length; i++) {
          // If URL structure shows this is a deeper category (different catId), it's path
          // If it's a sibling (same URL structure, different category), stop
          const prevParts = links[i - 1].href.split("/").length;
          const curParts = links[i].href.split("/").length;
          // Path links typically share the same URL structure with different catIds
          // Once we see 4+ links at the same depth, they're siblings
          if (path.length >= 4) break;
          // If catId is different and this looks like a child, add to path
          if (links[i].catId !== path[path.length - 1].catId) {
            path.push(links[i]);
          } else {
            break;
          }
        }

        // Return full path joined with " > "
        return path.map((l) => l.text).join(" > ");
      }
    }

    // Try the selected/active category in the sidebar filter
    const activeCategory = document.querySelector(
      '.x-refine__left__nav [class*="selected"] a, ' +
      '[class*="category"] [aria-current="page"]'
    );
    if (activeCategory) {
      const text = activeCategory.textContent?.trim().replace(/\(\d[\d,]*\)$/, "").trim();
      if (text && !junk.includes(text)) return text;
    }

    return null;
  }

  function scrapeResults() {
    const items = [];
    const pageCategory = getPageCategory();
    // eBay 2026: listings are <li class="s-card"> inside .srp-results
    // Fallback to .s-item for older layouts
    const listings = document.querySelectorAll(".srp-results li.s-card, .srp-results .s-item");

    listings.forEach((el) => {
      try {
        // Title — try multiple selectors
        const titleEl = el.querySelector('[class*="title"], [role="heading"], .s-item__title');
        if (!titleEl) return;
        const title = titleEl.textContent?.trim() || "";
        if (!title || title.length < 3 || title.includes("Shop on eBay")) return;

        // Link + item ID
        const linkEl = el.querySelector('a[href*="/itm/"]');
        const itemUrl = linkEl?.href || "";
        const idMatch = itemUrl.match(/\/itm\/(\d+)/);
        const ebayItemId = idMatch
          ? idMatch[1]
          : `pub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        // Price
        const priceEl = el.querySelector('[class*="price"]');
        let soldPrice = 0;
        if (priceEl) {
          const match = priceEl.textContent.match(/\$?([\d,]+\.?\d*)/);
          if (match) soldPrice = parseFloat(match[1].replace(",", ""));
        }
        if (soldPrice === 0) return;

        // Shipping — eBay 2026 uses su-styled-text spans with "delivery" or "shipping" text
        let shippingPrice = null;
        const allSpans = el.querySelectorAll("span");
        for (const span of allSpans) {
          const text = span.textContent?.trim() || "";
          if (text.match(/free\s*(delivery|shipping)/i)) {
            shippingPrice = 0;
            break;
          }
          const shipMatch = text.match(/\+?\$?([\d,]+\.?\d*)\s*(delivery|shipping)/i);
          if (shipMatch) {
            shippingPrice = parseFloat(shipMatch[1].replace(",", ""));
            break;
          }
        }

        // Condition
        const condEl = el.querySelector('.SECONDARY_INFO, [class*="condition"], [class*="subtitle"]');
        const condition = condEl?.textContent?.trim() || null;

        // Seller
        const sellerEl = el.querySelector('[class*="seller"], .s-item__seller-info-text');
        let seller = null;
        let sellerFeedback = null;
        if (sellerEl) {
          const text = sellerEl.textContent || "";
          const sellerMatch = text.match(/^([^(]+)/);
          seller = sellerMatch ? sellerMatch[1].trim() : null;
          const fbMatch = text.match(/\((\d+)\)/);
          sellerFeedback = fbMatch ? parseInt(fbMatch[1]) : null;
        }

        // Listing type / bids
        const bidEl = el.querySelector('[class*="bids"], .s-item__bids');
        let listingType = "Fixed price";
        let bidCount = null;
        if (bidEl) {
          listingType = "Auction";
          const bidMatch = bidEl.textContent?.match(/(\d+)\s*bid/);
          bidCount = bidMatch ? parseInt(bidMatch[1]) : null;
        }

        // Image
        const imgEl = el.querySelector("img");
        const imageUrl = imgEl?.src || null;

        // Category — per-item category link if present
        let category = null;
        const itemCatEl = el.querySelector('[class*="category"] a, [class*="breadcrumb"] a');
        if (itemCatEl) {
          const catText = itemCatEl.textContent?.trim();
          if (catText && catText !== "More" && catText.length > 1 && catText.length < 60) {
            category = catText;
          }
        }

        // Watchers
        const watchEl = el.querySelector('[class*="watcher"], [class*="watch"]');
        let watchers = null;
        if (watchEl) {
          const wm = watchEl.textContent?.match(/(\d+)\s*watch/i);
          if (wm) watchers = parseInt(wm[1]);
        }

        // Sold date — look for "Sold [date]" text anywhere in the card
        let soldDate = new Date().toISOString();
        const allText = el.textContent || "";
        const dateMatch = allText.match(/Sold\s+(\w+\s+\d+,?\s*\d{4})/i);
        if (dateMatch) {
          const parsed = new Date(dateMatch[1]);
          if (!isNaN(parsed.getTime())) soldDate = parsed.toISOString();
        }

        const totalPrice = shippingPrice !== null ? soldPrice + shippingPrice : soldPrice;

        items.push({
          ebayItemId,
          title,
          soldPrice,
          shippingPrice,
          totalPrice,
          condition,
          category: category || pageCategory,
          listingType,
          bidCount,
          quantitySold: null,
          totalSales: null,
          watchers,
          seller,
          sellerFeedback,
          imageUrl,
          itemUrl: itemUrl || null,
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
    // Try keyword param first
    const nkw = url.searchParams.get("_nkw");
    if (nkw) return nkw;

    // Seller store page — use seller name as keyword
    const sellerMatch = url.pathname.match(/\/seller\/([^/]+)/i) ||
                        url.pathname.match(/\/usr\/([^/]+)/i) ||
                        url.pathname.match(/\/str\/([^/]+)/i);
    if (sellerMatch) return `seller:${sellerMatch[1]}`;

    // Try the search heading on the page
    const heading = document.querySelector('.srp-controls__count-heading, [class*="result-count"], h1');
    if (heading) {
      const text = heading.textContent?.trim();
      const match = text?.match(/results?\s+for\s+(.+)/i);
      if (match) return match[1].trim();
    }

    // Category page — use breadcrumb
    const breadcrumb = document.querySelector('[class*="breadcrumb"] li:last-child, .seo-breadcrumb-text');
    if (breadcrumb) return breadcrumb.textContent?.trim();

    // Last resort — use page title
    const pageTitle = document.title.replace(/\s*[|\-–].*$/, "").replace(/sold.*$/i, "").trim();
    if (pageTitle && pageTitle.length > 2 && pageTitle !== "eBay") return pageTitle;

    return "uncategorized";
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
      body: JSON.stringify({ keyword, items, source: "extension" }),
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
    if (items.length === 0) { setStatus("No sold items found on this page", "error"); return; }

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
      btn.textContent = "Save Sold Comps";
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
    const items = document.querySelectorAll(".srp-results li.s-card, .srp-results .s-item");
    if (items.length === 0) return "";
    const first = items[0]?.textContent?.trim().slice(0, 80) || "";
    const last = items[items.length - 1]?.textContent?.trim().slice(0, 80) || "";
    return `${items.length}|${first}|${last}`;
  }

  async function checkAutoSave() {
    if (!autoEnabled) return;
    if (!isSoldSearch()) return;

    const settings = await chrome.storage.sync.get(["apiUrl", "apiKey"]);
    if (!settings.apiUrl || !settings.apiKey) return;

    const hash = hashResults();
    if (!hash || hash === lastHash) return;

    const keyword = getKeyword();
    const items = scrapeResults();
    if (items.length === 0) return;

    lastHash = hash;
    setStatus(`Auto-saving ${items.length} sold comps...`, "info");

    try {
      const result = await saveComps(items, keyword);
      setStatus(
        `Auto-saved ${result.resultCount} comps (avg $${result.stats.avg?.toFixed(2)}, median $${result.stats.median?.toFixed(2)})`,
        "success"
      );
    } catch (err) {
      setStatus(`Auto-save failed: ${err.message}`, "error");
    }
  }

  // ─── UI injection ──────────────────────────────────
  function injectButton() {
    if (!isSoldSearch()) return;
    if (document.getElementById(BUTTON_ID)) return;

    const target = document.querySelector(".srp-controls") ||
                   document.querySelector(".srp-results") ||
                   document.querySelector("#srp-river-results");
    if (!target) return;

    const container = document.createElement("div");
    container.className = "comptool-toolbar";

    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.textContent = "Save Sold Comps";
    btn.addEventListener("click", handleSave);

    const autoLabel = document.createElement("label");
    autoLabel.style.cssText = "display:flex;align-items:center;gap:4px;font-size:12px;color:#666;cursor:pointer;margin-left:8px;";
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
    status.className = "comptool-status";

    container.appendChild(btn);
    container.appendChild(autoLabel);
    container.appendChild(status);
    target.parentNode.insertBefore(container, target);
  }

  function start() {
    if (!isSoldSearch()) return;

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
