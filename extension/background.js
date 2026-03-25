// ─── CompTool Background Service Worker ─────────────────
// Polls the server for tasks and dispatches them to browser tabs.

const POLL_ALARM = "comptool-poll-tasks";
const POLL_INTERVAL_MINUTES = 0.166; // ~10 seconds (minimum chrome allows is 0.5 in production, uses setTimeout fallback)
const POLL_INTERVAL_MS = 10000;

let polling = false;

// ─── Initialization ─────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  console.log("[CompTool] Extension installed/updated");
  startPolling();
});

chrome.runtime.onStartup.addListener(() => {
  startPolling();
});

// ─── Polling control ────────────────────────────────────

async function startPolling() {
  const settings = await chrome.storage.sync.get(["apiUrl", "apiKey", "taskPolling"]);
  if (!settings.apiUrl || !settings.apiKey) {
    console.log("[CompTool] No API credentials configured, skipping task polling");
    return;
  }
  if (settings.taskPolling === false) {
    console.log("[CompTool] Task polling disabled");
    return;
  }

  // Use alarms as a keepalive, but do actual polling with setTimeout for faster intervals
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: 1 });
  polling = true;
  schedulePoll();
}

function schedulePoll() {
  if (!polling) return;
  setTimeout(() => pollForTasks(), POLL_INTERVAL_MS);
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) {
    // Keepalive — also trigger a poll in case setTimeout was killed
    pollForTasks();
  }
});

// React to settings changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.taskPolling) {
    if (changes.taskPolling.newValue === false) {
      polling = false;
      chrome.alarms.clear(POLL_ALARM);
      console.log("[CompTool] Task polling stopped");
    } else {
      startPolling();
    }
  }
  if (changes.apiUrl || changes.apiKey) {
    // Restart polling with new credentials
    startPolling();
  }
});

// ─── Task polling ───────────────────────────────────────

async function pollForTasks() {
  if (!polling) return;

  try {
    const settings = await chrome.storage.sync.get(["apiUrl", "apiKey"]);
    const { machineId } = await chrome.storage.local.get("machineId");

    if (!settings.apiUrl || !settings.apiKey || !machineId) {
      schedulePoll();
      return;
    }

    const resp = await fetch(`${settings.apiUrl}/comp/api/tasks/claim`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": settings.apiKey,
        "X-Machine-Id": machineId,
      },
      body: JSON.stringify({}),
    });

    if (!resp.ok) {
      console.warn("[CompTool] Task poll failed:", resp.status);
      schedulePoll();
      return;
    }

    const { task } = await resp.json();
    if (task) {
      console.log("[CompTool] Claimed task:", task.id, task.type);
      await executeTask(task, settings, machineId);
    }
  } catch (err) {
    console.warn("[CompTool] Task poll error:", err.message);
  }

  schedulePoll();
}

// ─── Task execution ─────────────────────────────────────

async function executeTask(task, settings, machineId) {
  const headers = {
    "Content-Type": "application/json",
    "X-API-Key": settings.apiKey,
    "X-Machine-Id": machineId,
  };

  // Mark as running
  await fetch(`${settings.apiUrl}/comp/api/tasks/${task.id}/status`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ status: "running" }),
  });

  try {
    let result;

    switch (task.type) {
      case "navigate":
        result = await taskNavigate(task.payload);
        break;
      case "scrape_sold":
        result = await taskScrapeSold(task.payload);
        break;
      case "scrape_page":
        result = await taskScrapePage(task.payload);
        break;
      case "inject_prompt":
        result = await taskInjectPrompt(task.payload);
        break;
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }

    // Report success
    await fetch(`${settings.apiUrl}/comp/api/tasks/${task.id}/status`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "done", result }),
    });

    // Notify admin page if open
    chrome.runtime.sendMessage({ type: "task-completed", task: { ...task, status: "done", result } }).catch(() => {});

  } catch (err) {
    console.error("[CompTool] Task failed:", task.id, err.message);

    await fetch(`${settings.apiUrl}/comp/api/tasks/${task.id}/status`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "failed", errorMessage: err.message }),
    });

    chrome.runtime.sendMessage({ type: "task-failed", task: { ...task, status: "failed", errorMessage: err.message } }).catch(() => {});
  }
}

// ─── Task handlers ──────────────────────────────────────

async function taskNavigate(payload) {
  const { url } = payload;
  if (!url) throw new Error("No URL provided");

  const tab = await chrome.tabs.create({ url, active: false });
  await waitForTabLoad(tab.id);

  return { tabId: tab.id, url, loaded: true };
}

async function taskScrapeSold(payload) {
  const { keyword, pages = 1 } = payload;
  if (!keyword) throw new Error("No keyword provided");

  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(keyword)}&LH_Sold=1&LH_Complete=1`;
  const tab = await chrome.tabs.create({ url, active: false });
  await waitForTabLoad(tab.id);

  // Give content-sold.js time to auto-import
  await sleep(5000);

  // Inject a script to get the results count from the page
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const heading = document.querySelector(".srp-controls__count-heading");
      return { resultText: heading ? heading.textContent.trim() : "unknown", url: window.location.href };
    },
  });

  return { keyword, pages, ...(results[0]?.result || {}) };
}

async function taskScrapePage(payload) {
  const { url, selectors } = payload;
  if (!url) throw new Error("No URL provided");

  const tab = await chrome.tabs.create({ url, active: false });
  await waitForTabLoad(tab.id);

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sels) => {
      const data = {};
      for (const [key, selector] of Object.entries(sels || {})) {
        const el = document.querySelector(selector);
        data[key] = el ? el.textContent.trim() : null;
      }
      data._title = document.title;
      data._url = window.location.href;
      return data;
    },
    args: [selectors || {}],
  });

  return results[0]?.result || {};
}

async function taskInjectPrompt(payload) {
  const { tabId, url, instructions } = payload;
  if (!instructions) throw new Error("No instructions provided");

  let targetTabId = tabId;
  if (!targetTabId && url) {
    const tab = await chrome.tabs.create({ url, active: true });
    await waitForTabLoad(tab.id);
    targetTabId = tab.id;
  }

  if (!targetTabId) throw new Error("No tabId or url provided");

  // Inject a visible prompt element that Claude Chrome can see
  await chrome.scripting.executeScript({
    target: { tabId: targetTabId },
    func: (instr) => {
      let el = document.getElementById("comptool-ai-prompt");
      if (!el) {
        el = document.createElement("div");
        el.id = "comptool-ai-prompt";
        el.style.cssText = "position:fixed;top:10px;right:10px;z-index:999999;background:#1a1a2e;color:#e0e0ff;padding:16px;border-radius:8px;max-width:400px;font-size:13px;box-shadow:0 4px 20px rgba(0,0,0,0.3);border:1px solid #3665f3;";
        document.body.appendChild(el);
      }
      el.innerHTML = `<div style="font-weight:700;margin-bottom:8px;color:#3665f3;">CompTool Instructions</div><div>${instr}</div>`;
    },
    args: [instructions],
  });

  return { tabId: targetTabId, injected: true };
}

// ─── Helpers ────────────────────────────────────────────

function waitForTabLoad(tabId, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Tab load timeout"));
    }, timeoutMs);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Message handler (from popup/admin pages) ───────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "get-poll-status") {
    sendResponse({ polling, interval: POLL_INTERVAL_MS });
    return true;
  }

  if (msg.type === "set-polling") {
    chrome.storage.sync.set({ taskPolling: msg.enabled });
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === "poll-now") {
    pollForTasks();
    sendResponse({ ok: true });
    return true;
  }
});
