const clientStore = require("../services/clientStore");

async function requireApiKey(req, res, next) {
  const key = req.headers["x-api-key"];
  if (!key) {
    return res.status(401).json({ error: "Missing API key" });
  }

  // DB lookup
  const apiKey = await clientStore.lookupApiKey(key);
  if (apiKey && apiKey.isActive && apiKey.client?.isActive) {
    req.clientId = apiKey.clientId;
    req.apiKeyId = apiKey.id;

    // Track usage (fire-and-forget)
    clientStore.trackApiKeyUsage(apiKey.id);

    // Track machine if header present
    const machineId = req.headers["x-machine-id"];
    if (machineId) {
      clientStore.upsertMachine(apiKey.id, machineId, req.headers["user-agent"]);
    }

    return next();
  }

  // Fallback to env-based key (backward compat)
  const envKey = process.env.COMPTOOL_API_KEY;
  if (envKey && key === envKey) {
    req.clientId = process.env.COMPTOOL_CLIENT_ID || "default";
    req.apiKeyId = null;
    return next();
  }

  return res.status(401).json({ error: "Invalid API key" });
}

module.exports = requireApiKey;
