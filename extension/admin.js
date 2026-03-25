document.addEventListener("DOMContentLoaded", async () => {
  let apiUrl = "";
  let apiKey = "";
  let adminPassword = "";

  // ─── Auth ───────────────────────────────────────────────

  const authOverlay = document.getElementById("authOverlay");
  const authBtn = document.getElementById("authBtn");
  const authError = document.getElementById("authError");
  const adminPwInput = document.getElementById("adminPassword");

  // Check for cached admin password
  const cached = await chrome.storage.local.get("adminPassword");
  const settings = await chrome.storage.sync.get(["apiUrl", "apiKey"]);
  apiUrl = settings.apiUrl || "";
  apiKey = settings.apiKey || "";

  if (cached.adminPassword && apiUrl) {
    adminPassword = cached.adminPassword;
    const valid = await verifyAdmin();
    if (valid) {
      authOverlay.classList.add("hidden");
      init();
    }
  }

  adminPwInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") authBtn.click();
  });

  authBtn.addEventListener("click", async () => {
    adminPassword = adminPwInput.value.trim();
    if (!adminPassword) return;

    const valid = await verifyAdmin();
    if (valid) {
      await chrome.storage.local.set({ adminPassword });
      authOverlay.classList.add("hidden");
      init();
    } else {
      authError.textContent = "Invalid admin password";
      authError.classList.remove("hidden");
    }
  });

  async function verifyAdmin() {
    try {
      const resp = await fetch(`${apiUrl}/comp/api/admin/auth`, {
        method: "POST",
        headers: adminHeaders(),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  function adminHeaders() {
    return {
      "Content-Type": "application/json",
      "X-Admin-Password": adminPassword,
      "X-API-Key": apiKey,
    };
  }

  function apiHeaders() {
    return {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    };
  }

  // ─── Init ─────────────────────────────────────────────

  async function init() {
    setupTabs();
    setupTaskTypeToggle();
    setupButtons();
    await Promise.all([loadStats(), loadTasks(), loadAccount(), loadMachines(), checkPollStatus()]);
  }

  // ─── Tabs ─────────────────────────────────────────────

  function setupTabs() {
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach((tc) => tc.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
      });
    });
  }

  // ─── Task type field toggles ──────────────────────────

  function setupTaskTypeToggle() {
    const typeSelect = document.getElementById("newTaskType");
    typeSelect.addEventListener("change", () => updatePayloadFields(typeSelect.value));
    updatePayloadFields(typeSelect.value);
  }

  function updatePayloadFields(type) {
    const fields = {
      scrape_sold: ["fieldKeyword"],
      scrape_page: ["fieldUrl", "fieldSelectors"],
      navigate: ["fieldUrl"],
      inject_prompt: ["fieldUrl", "fieldInstructions"],
      custom: ["fieldCustom"],
    };

    ["fieldKeyword", "fieldUrl", "fieldSelectors", "fieldInstructions", "fieldCustom"].forEach((id) => {
      document.getElementById(id).classList.add("hidden");
    });

    (fields[type] || []).forEach((id) => {
      document.getElementById(id).classList.remove("hidden");
    });
  }

  // ─── Buttons ──────────────────────────────────────────

  function setupButtons() {
    document.getElementById("refreshBtn").addEventListener("click", () => {
      loadStats();
      loadTasks();
    });

    document.getElementById("togglePollBtn").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "get-poll-status" }, (resp) => {
        chrome.runtime.sendMessage({ type: "set-polling", enabled: !resp?.polling });
        setTimeout(checkPollStatus, 500);
      });
    });

    document.getElementById("pollNowBtn").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "poll-now" });
    });

    document.getElementById("taskFilter").addEventListener("change", loadTasks);

    document.getElementById("createTaskBtn").addEventListener("click", createTask);
  }

  // ─── Poll status ──────────────────────────────────────

  function checkPollStatus() {
    chrome.runtime.sendMessage({ type: "get-poll-status" }, (resp) => {
      const dot = document.getElementById("pollDot");
      const label = document.getElementById("pollLabel");
      if (resp?.polling) {
        dot.className = "poll-dot active";
        label.textContent = `Polling every ${resp.interval / 1000}s`;
      } else {
        dot.className = "poll-dot inactive";
        label.textContent = "Polling off";
      }
    });
  }

  // ─── Load task queue stats ────────────────────────────

  async function loadStats() {
    try {
      const resp = await fetch(`${apiUrl}/comp/api/tasks/stats`, { headers: adminHeaders() });
      if (!resp.ok) return;
      const stats = await resp.json();
      document.getElementById("statPending").textContent = stats.pending + (stats.claimed || 0);
      document.getElementById("statRunning").textContent = stats.running;
      document.getElementById("statDone").textContent = stats.done;
      document.getElementById("statFailed").textContent = stats.failed;
    } catch (err) {
      console.warn("Failed to load stats:", err);
    }
  }

  // ─── Load tasks table ─────────────────────────────────

  async function loadTasks() {
    try {
      const status = document.getElementById("taskFilter").value;
      const qs = status ? `?status=${status}` : "";
      const resp = await fetch(`${apiUrl}/comp/api/tasks${qs}`, { headers: adminHeaders() });
      if (!resp.ok) return;
      const { tasks } = await resp.json();

      const tbody = document.getElementById("taskTableBody");
      if (!tasks || tasks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><p>No tasks found</p></td></tr>';
        return;
      }

      tbody.innerHTML = tasks.map((t) => `
        <tr>
          <td title="${t.id}" style="font-family:monospace;font-size:11px;">${t.id.substring(0, 8)}...</td>
          <td><strong>${t.type}</strong></td>
          <td><span class="status-${t.status}">${t.status}</span></td>
          <td style="font-family:monospace;font-size:11px;">${t.machineId ? t.machineId.substring(0, 8) + "..." : "-"}</td>
          <td>${timeAgo(t.createdAt)}</td>
          <td>
            ${t.status === "pending" ? `<button class="btn btn-danger" style="padding:2px 8px;font-size:11px;" onclick="cancelTask('${t.id}')">Cancel</button>` : ""}
            ${t.result ? `<button class="btn btn-ghost" style="padding:2px 8px;font-size:11px;" onclick="viewResult('${t.id}')">Result</button>` : ""}
          </td>
        </tr>
      `).join("");
    } catch (err) {
      console.warn("Failed to load tasks:", err);
    }
  }

  // ─── Create task ──────────────────────────────────────

  async function createTask() {
    const type = document.getElementById("newTaskType").value;
    const priority = parseInt(document.getElementById("newTaskPriority").value);
    const statusEl = document.getElementById("createStatus");

    let payload = {};
    switch (type) {
      case "scrape_sold":
        payload = { keyword: document.getElementById("payloadKeyword").value.trim() };
        if (!payload.keyword) { statusEl.textContent = "Keyword is required"; return; }
        break;
      case "scrape_page":
        payload = { url: document.getElementById("payloadUrl").value.trim() };
        try { payload.selectors = JSON.parse(document.getElementById("payloadSelectors").value || "{}"); } catch { payload.selectors = {}; }
        if (!payload.url) { statusEl.textContent = "URL is required"; return; }
        break;
      case "navigate":
        payload = { url: document.getElementById("payloadUrl").value.trim() };
        if (!payload.url) { statusEl.textContent = "URL is required"; return; }
        break;
      case "inject_prompt":
        payload = {
          url: document.getElementById("payloadUrl").value.trim(),
          instructions: document.getElementById("payloadInstructions").value.trim(),
        };
        if (!payload.instructions) { statusEl.textContent = "Instructions are required"; return; }
        break;
      case "custom":
        try { payload = JSON.parse(document.getElementById("payloadCustom").value); } catch {
          statusEl.textContent = "Invalid JSON payload";
          return;
        }
        break;
    }

    try {
      statusEl.textContent = "Creating...";
      const resp = await fetch(`${apiUrl}/comp/api/tasks`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ type, payload, priority }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        statusEl.textContent = `Error: ${err.error}`;
        return;
      }

      statusEl.textContent = "Task created!";
      statusEl.style.color = "#4caf50";
      setTimeout(() => { statusEl.textContent = ""; statusEl.style.color = ""; }, 3000);

      loadStats();
      loadTasks();
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
    }
  }

  // ─── Load account / SaaS metadata ────────────────────

  async function loadAccount() {
    try {
      // Get client info via admin dashboard
      const resp = await fetch(`${apiUrl}/comp/api/admin/dashboard`, { headers: adminHeaders() });
      if (!resp.ok) return;
      const dashboard = await resp.json();

      // Get client list to find our client details
      const clientResp = await fetch(`${apiUrl}/comp/api/admin/clients`, { headers: adminHeaders() });
      if (!clientResp.ok) return;
      const { clients } = await clientResp.json();

      // Try to match via API key lookup — use the first client if only one
      const client = clients[0];
      if (client) {
        document.getElementById("metaName").textContent = client.name || "-";
        document.getElementById("metaEmail").textContent = client.email || "-";
        document.getElementById("metaCompany").textContent = client.company || "-";
        document.getElementById("metaClientId").textContent = client.id;

        // Load full client detail for plan info
        const detailResp = await fetch(`${apiUrl}/comp/api/admin/clients/${client.id}`, { headers: adminHeaders() });
        if (detailResp.ok) {
          const detail = await detailResp.json();
          const tier = detail.planTier || "free";
          document.getElementById("metaPlan").innerHTML = `<span class="badge badge-${tier}">${tier}</span>`;
          const billing = detail.billingStatus || "active";
          document.getElementById("metaBilling").innerHTML = `<span class="badge badge-${billing}">${billing}</span>`;
          document.getElementById("metaUsageLimit").textContent = (detail.usageLimitMonthly || 1000).toLocaleString() + " requests/mo";
          document.getElementById("metaCreated").textContent = new Date(detail.createdAt).toLocaleDateString();

          // API keys
          if (detail.apiKeys) {
            const keysBody = document.getElementById("apiKeysBody");
            keysBody.innerHTML = detail.apiKeys.map((k) => `
              <tr>
                <td>${k.label}</td>
                <td style="font-family:monospace;font-size:11px;">${k.key.substring(0, 12)}...</td>
                <td>${k.isActive ? '<span style="color:#4caf50;">Active</span>' : '<span style="color:#f44336;">Revoked</span>'}</td>
                <td>${(k.usageCount || 0).toLocaleString()}</td>
                <td>${k.lastUsedAt ? timeAgo(k.lastUsedAt) : "Never"}</td>
              </tr>
            `).join("");
          }

          // Usage stats
          if (detail.stats) {
            document.getElementById("metaSearches").textContent = (detail.stats.searchCount || 0).toLocaleString();
            document.getElementById("metaComps").textContent = (detail.stats.compCount || 0).toLocaleString();
          }
        }
      }

      // Task count
      const taskResp = await fetch(`${apiUrl}/comp/api/tasks/stats`, { headers: adminHeaders() });
      if (taskResp.ok) {
        const taskStats = await taskResp.json();
        document.getElementById("metaTasks").textContent = (taskStats.total || 0).toLocaleString();
      }

      document.getElementById("metaMachines").textContent = (dashboard.totalMachines || 0).toLocaleString();
    } catch (err) {
      console.warn("Failed to load account:", err);
    }
  }

  // ─── Load machines ────────────────────────────────────

  async function loadMachines() {
    try {
      const clientResp = await fetch(`${apiUrl}/comp/api/admin/clients`, { headers: adminHeaders() });
      if (!clientResp.ok) return;
      const { clients } = await clientResp.json();
      if (!clients || clients.length === 0) return;

      // Gather all machines across clients
      const allMachines = [];
      for (const client of clients) {
        const detailResp = await fetch(`${apiUrl}/comp/api/admin/clients/${client.id}`, { headers: adminHeaders() });
        if (!detailResp.ok) continue;
        const detail = await detailResp.json();
        for (const key of (detail.apiKeys || [])) {
          for (const m of (key.machines || [])) {
            allMachines.push({ ...m, keyLabel: key.label, keyPrefix: key.key.substring(0, 12) });
          }
        }
      }

      const tbody = document.getElementById("machinesBody");
      if (allMachines.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><p>No machines registered yet</p></td></tr>';
        return;
      }

      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      tbody.innerHTML = allMachines.map((m) => {
        const isRecent = new Date(m.lastSeen).getTime() > fiveMinAgo;
        return `
          <tr>
            <td style="font-family:monospace;font-size:11px;" title="${m.machineId}">${m.machineId.substring(0, 12)}...</td>
            <td style="font-size:12px;">${truncate(m.browserInfo || "-", 40)}</td>
            <td style="font-family:monospace;font-size:11px;">${m.keyPrefix}...</td>
            <td>${new Date(m.firstSeen).toLocaleDateString()}</td>
            <td><span class="machine-dot ${isRecent ? "recent" : ""}" style="display:inline-block;vertical-align:middle;margin-right:4px;"></span>${timeAgo(m.lastSeen)}</td>
            <td>${(m.requestCount || 0).toLocaleString()}</td>
          </tr>
        `;
      }).join("");
    } catch (err) {
      console.warn("Failed to load machines:", err);
    }
  }

  // ─── Globals for inline onclick handlers ──────────────

  window.cancelTask = async (taskId) => {
    if (!confirm("Cancel this task?")) return;
    await fetch(`${apiUrl}/comp/api/tasks/${taskId}`, { method: "DELETE", headers: adminHeaders() });
    loadStats();
    loadTasks();
  };

  window.viewResult = async (taskId) => {
    const resp = await fetch(`${apiUrl}/comp/api/tasks/${taskId}`, { headers: adminHeaders() });
    if (!resp.ok) return;
    const { task } = await resp.json();
    alert(JSON.stringify(task.result, null, 2));
  };

  // ─── Listen for task updates from background worker ───

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "task-completed" || msg.type === "task-failed") {
      loadStats();
      loadTasks();
    }
  });

  // ─── Helpers ──────────────────────────────────────────

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  function truncate(str, len) {
    return str.length > len ? str.substring(0, len) + "..." : str;
  }
});
