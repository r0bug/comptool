document.addEventListener("DOMContentLoaded", async () => {
  const apiUrlInput = document.getElementById("apiUrl");
  const apiKeyInput = document.getElementById("apiKey");
  const saveBtn = document.getElementById("saveBtn");
  const testBtn = document.getElementById("testBtn");
  const statusMsg = document.getElementById("statusMsg");

  const machineIdInput = document.getElementById("machineId");
  const resetMachineLink = document.getElementById("resetMachineId");
  const autoImportCheck = document.getElementById("autoImport");

  const DEFAULT_API_URL = "https://listflow.robug.com";

  // Load saved settings — default to production URL
  const settings = await chrome.storage.sync.get(["apiUrl", "apiKey", "autoImport"]);
  apiUrlInput.value = settings.apiUrl || DEFAULT_API_URL;
  if (settings.apiKey) apiKeyInput.value = settings.apiKey;

  // If no API URL was saved, save the default now
  if (!settings.apiUrl) {
    await chrome.storage.sync.set({ apiUrl: DEFAULT_API_URL });
  }

  // Auto-recover key by machine ID if no key is set
  if (!settings.apiKey) {
    let { machineId } = await chrome.storage.local.get("machineId");
    if (!machineId) {
      machineId = crypto.randomUUID();
      await chrome.storage.local.set({ machineId });
    }
    try {
      const url = (settings.apiUrl || DEFAULT_API_URL).replace(/\/+$/, "");
      const resp = await fetch(`${url}/comp/api/clients/recover-machine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineId }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.apiKey) {
          apiKeyInput.value = data.apiKey;
          await chrome.storage.sync.set({ apiKey: data.apiKey });
          statusMsg.textContent = "Key recovered from server!";
          statusMsg.className = "ok";
        }
      }
    } catch {}
  }
  autoImportCheck.checked = settings.autoImport !== false; // default ON

  autoImportCheck.addEventListener("change", async () => {
    await chrome.storage.sync.set({ autoImport: autoImportCheck.checked });
  });

  // Load or generate machine ID
  let { machineId } = await chrome.storage.local.get("machineId");
  if (!machineId) {
    machineId = crypto.randomUUID();
    await chrome.storage.local.set({ machineId });
  }
  machineIdInput.value = machineId;

  resetMachineLink.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!confirm("Reset machine ID? The server will see this as a new machine.")) return;
    machineId = crypto.randomUUID();
    await chrome.storage.local.set({ machineId });
    machineIdInput.value = machineId;
  });

  saveBtn.addEventListener("click", async () => {
    const apiUrl = apiUrlInput.value.trim().replace(/\/+$/, "");
    const apiKey = apiKeyInput.value.trim();

    if (!apiUrl || !apiKey) {
      statusMsg.textContent = "Both fields are required";
      statusMsg.className = "err";
      return;
    }

    await chrome.storage.sync.set({ apiUrl, apiKey, autoImport: autoImportCheck.checked });
    statusMsg.textContent = "Saved!";
    statusMsg.className = "ok";
    setTimeout(() => { statusMsg.textContent = ""; }, 2000);
  });

  testBtn.addEventListener("click", async () => {
    const apiUrl = apiUrlInput.value.trim().replace(/\/+$/, "");
    const apiKey = apiKeyInput.value.trim();

    if (!apiUrl || !apiKey) {
      statusMsg.textContent = "Fill in both fields first";
      statusMsg.className = "err";
      return;
    }

    statusMsg.textContent = "Testing...";
    statusMsg.className = "";

    try {
      const resp = await fetch(`${apiUrl}/comp/api/health`, {
        headers: { "X-API-Key": apiKey },
      });
      if (resp.ok) {
        statusMsg.textContent = "Connected!";
        statusMsg.className = "ok";
      } else {
        statusMsg.textContent = `Failed: HTTP ${resp.status}`;
        statusMsg.className = "err";
      }
    } catch (err) {
      statusMsg.textContent = `Error: ${err.message}`;
      statusMsg.className = "err";
    }
  });
});
