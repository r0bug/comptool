let running = false;
let currentTab = null;

document.getElementById("startBtn").addEventListener("click", startBatch);
document.getElementById("stopBtn").addEventListener("click", () => { running = false; });
document.getElementById("clearBtn").addEventListener("click", () => {
  document.getElementById("keywords").value = "";
  document.getElementById("status").textContent = "Ready.";
  document.getElementById("progressBar").style.width = "0%";
});

async function startBatch() {
  const text = document.getElementById("keywords").value.trim();
  if (!text) return;

  const keywords = text.split("\n").map((k) => k.trim()).filter(Boolean);
  if (keywords.length === 0) return;

  const delay = parseInt(document.getElementById("delay").value) || 8;
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
    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(kw)}&_sacat=0&LH_Sold=1&LH_Complete=1&_ipg=240`;

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
  status.textContent = running
    ? `Complete! Processed ${keywords.length} keywords.`
    : `Stopped after ${keywords.indexOf(keywords.find((_, i) => !running)) || "?"} keywords.`;

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
      const next = document.querySelector('a.pagination__next, [aria-label="Next page"], a[href*="_pgn="]');
      return !!next && !next.classList.contains("pagination__next--disabled") && !next.hasAttribute("aria-disabled");
    },
  }).then((r) => r?.[0]?.result || false).catch(() => false);
}

function clickNextPage(tabId) {
  return chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const next = document.querySelector('a.pagination__next, [aria-label="Next page"]');
      if (next) next.click();
    },
  });
}
