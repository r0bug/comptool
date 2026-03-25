const router = require("express").Router();
const clientStore = require("../services/clientStore");
const prisma = require("../config/database");
const { generateApiKey } = require("../services/keyGenerator");
const settings = require("../services/settings");

// Public registration
router.post("/register", async (req, res) => {
  try {
    // Check if registration is open
    const regOpen = await settings.get("registration_open");
    if (regOpen === "false") {
      return res.status(403).json({ error: "Registration is currently closed" });
    }

    const { name, email, company, sendEmail } = req.body;
    const saasMode = await settings.isSaasMode();

    if (saasMode) {
      // Full validation in SaaS mode
      if (!name || typeof name !== "string" || name.trim().length < 2) {
        return res.status(400).json({ error: "Name is required (min 2 characters)" });
      }
      if (!email || typeof email !== "string" || !email.includes("@") || !email.includes(".")) {
        return res.status(400).json({ error: "Valid email is required" });
      }
    } else {
      // Relaxed validation — accept anything
      if (!name || name.trim().length < 1) {
        return res.status(400).json({ error: "Name is required" });
      }
    }

    const { client, apiKey } = await clientStore.createClient({
      name: name.trim(),
      email: (email || `${name.trim().replace(/\s+/g, ".")}@comptool.local`).trim().toLowerCase(),
      company: company?.trim() || null,
    });

    res.json({
      clientId: client.id,
      name: client.name,
      email: client.email,
      apiKey: apiKey.key,
      message: "Save your API key — it will not be shown again.",
    });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    res.status(500).json({ error: err.message });
  }
});

// Request key recovery — generates a new key and queues an email
router.post("/recover", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Valid email required" });
    }

    const client = await prisma.client.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { apiKeys: { where: { isActive: true } } },
    });

    if (!client) {
      // Don't reveal whether email exists
      return res.json({ sent: true, message: "If an account exists with that email, a new key has been sent." });
    }

    // Generate a fresh key
    const newKey = await clientStore.createApiKey(client.id, "Recovery");

    // Store for the email worker to pick up
    // For now, write to a recovery log that can be checked
    const fs = require("fs");
    const path = require("path");
    const logPath = path.join(__dirname, "../../data/recovery-log.json");
    let log = [];
    try { log = JSON.parse(fs.readFileSync(logPath, "utf-8")); } catch {}
    log.push({
      email: client.email,
      name: client.name,
      apiKey: newKey.key,
      requestedAt: new Date().toISOString(),
    });
    fs.writeFileSync(logPath, JSON.stringify(log, null, 2));

    res.json({ sent: true, message: "If an account exists with that email, a new key has been sent." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Recover API key by machine ID — if this machine was previously registered
router.post("/recover-machine", async (req, res) => {
  try {
    const { machineId } = req.body;
    if (!machineId) return res.json({ apiKey: null });

    // Find machine record
    const machine = await prisma.machine.findFirst({
      where: { machineId },
      include: { apiKey: { include: { client: true } } },
      orderBy: { lastSeen: "desc" },
    });

    if (!machine || !machine.apiKey?.isActive || !machine.apiKey?.client?.isActive) {
      return res.json({ apiKey: null });
    }

    res.json({
      apiKey: machine.apiKey.key,
      clientName: machine.apiKey.client.name,
      message: "Key recovered from previous session",
    });
  } catch (err) {
    res.json({ apiKey: null });
  }
});

module.exports = router;
