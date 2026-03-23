const router = require("express").Router();
const requireAdmin = require("../middleware/adminAuth");
const clientStore = require("../services/clientStore");

// All admin routes require admin password
router.use(requireAdmin);

// Validate admin password
router.post("/auth", (req, res) => {
  res.json({ status: "ok" });
});

// Dashboard stats
router.get("/dashboard", async (req, res) => {
  try {
    const stats = await clientStore.getDashboardStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List clients
router.get("/clients", async (req, res) => {
  try {
    const { limit, offset, search } = req.query;
    const result = await clientStore.listClients({
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
      search,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single client
router.get("/clients/:id", async (req, res) => {
  try {
    const client = await clientStore.getClient(req.params.id);
    if (!client) return res.status(404).json({ error: "Client not found" });
    const stats = await clientStore.getClientStats(req.params.id);
    res.json({ ...client, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create client (admin)
router.post("/clients", async (req, res) => {
  try {
    const { name, email, company } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: "name and email are required" });
    }
    const result = await clientStore.createClient({ name, email, company });
    res.json(result);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "A client with this email already exists" });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update client
router.patch("/clients/:id", async (req, res) => {
  try {
    const client = await clientStore.updateClient(req.params.id, req.body);
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate new API key for client
router.post("/clients/:id/keys", async (req, res) => {
  try {
    const { label } = req.body;
    const apiKey = await clientStore.createApiKey(req.params.id, label || "Default");
    res.json(apiKey);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Revoke API key
router.delete("/keys/:id", async (req, res) => {
  try {
    const key = await clientStore.revokeApiKey(parseInt(req.params.id));
    res.json(key);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
