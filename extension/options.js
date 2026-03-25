document.addEventListener("DOMContentLoaded", async () => {
  const apiUrlInput = document.getElementById("apiUrl");
  const apiKeyInput = document.getElementById("apiKey");
  const saveBtn = document.getElementById("saveBtn");
  const testBtn = document.getElementById("testBtn");
  const statusMsg = document.getElementById("statusMsg");

  const machineIdInput = document.getElementById("machineId");
  const resetMachineLink = document.getElementById("resetMachineId");
  const autoImportCheck = document.getElementById("autoImport");

  // Load saved settings
  const taskPollingCheck = document.getElementById("taskPolling");

  const settings = await chrome.storage.sync.get(["apiUrl", "apiKey", "autoImport", "taskPolling"]);
  if (settings.apiUrl) apiUrlInput.value = settings.apiUrl;
  if (settings.apiKey) apiKeyInput.value = settings.apiKey;
  autoImportCheck.checked = settings.autoImport !== false; // default ON
  taskPollingCheck.checked = settings.taskPolling !== false; // default ON

  autoImportCheck.addEventListener("change", async () => {
    await chrome.storage.sync.set({ autoImport: autoImportCheck.checked });
  });

  taskPollingCheck.addEventListener("change", async () => {
    await chrome.storage.sync.set({ taskPolling: taskPollingCheck.checked });
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
