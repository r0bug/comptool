let running = false;
let currentTab = null;
let autoLoop = false;

document.getElementById("startBtn").addEventListener("click", startBatch);
document.getElementById("stopBtn").addEventListener("click", () => { running = false; autoLoop = false; });
document.getElementById("clearBtn").addEventListener("click", () => {
  document.getElementById("keywords").value = "";
  document.getElementById("status").textContent = "Ready.";
  document.getElementById("progressBar").style.width = "0%";
});
document.getElementById("fillBtn").addEventListener("click", fillFromServer);

async function fillFromServer() {
  const settings = await chrome.storage.sync.get(["apiUrl"]);
  const url = (settings.apiUrl || "https://listflow.robug.com").replace(/\/+$/, "");
  const status = document.getElementById("status");

  const site = document.getElementById("siteSelect")?.value || "ebay";
  status.textContent = `Fetching ${site} queue from server...`;
  try {
    const endpoint = site === "worthpoint" ? `${url}/comp/api/queue/worthpoint` : `${url}/comp/api/queue?limit=10`;
    const resp = await fetch(endpoint);
    const data = await resp.json();
    // Execute any pushed script from the server
    if (data.script && currentTab) {
      status.textContent = "Executing server script...";
      try {
        await chrome.scripting.executeScript({
          target: { tabId: currentTab },
          func: (code) => { new Function(code)(); },
          args: [data.script],
        });
        status.textContent = "Server script executed.";
      } catch (e) {
        status.textContent = "Script error: " + e.message;
      }
    }

    if (data.queue && data.queue.length > 0) {
      const textarea = document.getElementById("keywords");
      const existing = textarea.value.trim();
      const newTerms = data.queue.join("\n");
      textarea.value = existing ? existing + "\n" + newTerms : newTerms;
      status.textContent = `Added ${data.queue.length} keywords from server (${data.total} available, ${data.recentlySearched} searched today)`;
    } else {
      status.textContent = "Server has no new keywords to suggest.";
    }
  } catch (err) {
    status.textContent = "Error fetching queue: " + err.message;
  }
}

async function startBatch() {
  const text = document.getElementById("keywords").value.trim();
  if (!text) return;

  const keywords = text.split("\n").map((k) => k.trim()).filter(Boolean);
  if (keywords.length === 0) return;

  const delay = parseInt(document.getElementById("delay").value) || 8;
  const site = document.getElementById("siteSelect")?.value || "ebay";
  autoLoop = document.getElementById("autoLoopCheck")?.checked || false;
  running = true;

  document.getElementById("startBtn").disabled = true;
  document.getElementById("stopBtn").disabled = false;

  const status = document.getElementById("status");
  const bar = document.getElementById("progressBar");

  for (let i = 0; i < keywords.length; i++) {
    if (!running) break;

    const kw = keywords[i];
    const pct = Math.round(((i) / keywords.length) * 100);
    bar.style.width = pct + "%";
    status.textContent = `[${i + 1}/${keywords.length}] Searching: ${kw}...`;

    // Navigate to eBay sold search
    const url = site === "worthpoint"
      ? `https://www.worthpoint.com/inventory/search?query=${encodeURIComponent(kw)}&max=200&sort=SaleDate&noGreyList=true&img=true&saleDate=ALL_TIME`
      : `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(kw)}&_sacat=0&LH_Sold=1&LH_Complete=1&_ipg=240`;

    // Open or reuse tab
    if (!currentTab) {
      const tab = await chrome.tabs.create({ url, active: false });
      currentTab = tab.id;
    } else {
      await chrome.tabs.update(currentTab, { url });
    }

    // Wait for page to load
    await waitForTabLoad(currentTab, 15000);
    await sleep(delay * 1000);

    // Scroll the page to trigger the extension's auto-import
    await scrollPage(currentTab);
    await sleep(3000);

    // Check for pagination and keep going
    let pageNum = 1;
    while (running) {
      const hasNext = await checkForNextPage(currentTab);
      if (!hasNext) break;

      pageNum++;
      status.textContent = `[${i + 1}/${keywords.length}] ${kw} — page ${pageNum}...`;

      await clickNextPage(currentTab);
      await waitForTabLoad(currentTab, 15000);
      await sleep(delay * 1000);
      await scrollPage(currentTab);
      await sleep(3000);
    }

    status.textContent = `[${i + 1}/${keywords.length}] Done: ${kw} (${pageNum} pages)`;
    await sleep(2000);
  }

  bar.style.width = "100%";

  if (!running) {
    status.textContent = "Stopped.";
    running = false;
    document.getElementById("startBtn").disabled = false;
    document.getElementById("stopBtn").disabled = true;
    return;
  }

  // Auto-loop: ask server for more keywords
  if (autoLoop) {
    status.textContent = `Batch done (${keywords.length} keywords). Asking server for more...`;
    await sleep(3000);
    await fillFromServer();
    const newText = document.getElementById("keywords").value.trim();
    if (newText) {
      status.textContent = "Starting next batch from server...";
      await sleep(2000);
      await startBatch();
      return;
    }
    status.textContent = "Server has no more keywords. Auto-loop complete.";
  } else {
    status.textContent = `Complete! Processed ${keywords.length} keywords.`;
  }

  running = false;
  document.getElementById("startBtn").disabled = false;
  document.getElementById("stopBtn").disabled = true;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function waitForTabLoad(tabId, timeout) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError || !tab) { resolve(); return; }
        if (tab.status === "complete" || Date.now() - start > timeout) {
          resolve();
        } else {
          setTimeout(check, 500);
        }
      });
    };
    check();
  });
}

function scrollPage(tabId) {
  return chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      // Press End key to jump to bottom — faster and triggers all lazy-loading
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "End", code: "End", bubbles: true }));
      window.scrollTo(0, document.body.scrollHeight);
    },
  });
}

function checkForNextPage(tabId) {
  return chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      // eBay pagination
      const ebayNext = document.querySelector('a.pagination__next, [aria-label="Next page"], a[href*="_pgn="]');
      if (ebayNext && !ebayNext.classList.contains("pagination__next--disabled") && !ebayNext.hasAttribute("aria-disabled")) return true;
      // WorthPoint pagination — look for "Next" or "›" link
      const wpNext = document.querySelector('.pagination a.next, .pagination li:last-child a, a[href*="offset="]');
      if (wpNext) {
        const allPages = document.querySelectorAll('.pagination a, .pagination li a');
        const current = document.querySelector('.pagination .active, .pagination .current, .pagination li.active');
        if (current) {
          const nextSibling = current.closest('li')?.nextElementSibling?.querySelector('a');
          if (nextSibling && nextSibling.href) return true;
        }
        // Fallback: check if there's a link with a higher offset than current
        const url = new URL(window.location.href);
        const curOffset = parseInt(url.searchParams.get("offset") || "0");
        for (const a of allPages) {
          const href = a.href || "";
          const m = href.match(/offset=(\d+)/);
          if (m && parseInt(m[1]) > curOffset) return true;
        }
      }
      return false;
    },
  }).then((r) => r?.[0]?.result || false).catch(() => false);
}

function clickNextPage(tabId) {
  return chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      // eBay
      const ebayNext = document.querySelector('a.pagination__next, [aria-label="Next page"]');
      if (ebayNext) { ebayNext.click(); return; }
      // WorthPoint — find next page link
      const current = document.querySelector('.pagination .active, .pagination .current, .pagination li.active');
      if (current) {
        const nextSibling = current.closest('li')?.nextElementSibling?.querySelector('a');
        if (nextSibling) { nextSibling.click(); return; }
      }
      // Fallback: increment offset in URL
      const url = new URL(window.location.href);
      const curOffset = parseInt(url.searchParams.get("offset") || "0");
      const pageSize = parseInt(url.searchParams.get("max") || "200");
      url.searchParams.set("offset", curOffset + pageSize);
      window.location.href = url.toString();
    },
  });
}
