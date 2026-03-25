const router = require("express").Router();
const requireApiKey = require("../middleware/apiKey");
const requireAdmin = require("../middleware/adminAuth");
const taskStore = require("../services/taskStore");

// ─── Extension endpoints (API key auth) ─────────────────

// Poll for next task (extension calls this periodically)
router.post("/claim", requireApiKey, async (req, res) => {
  try {
    const machineId = req.headers["x-machine-id"];
    if (!machineId) {
      return res.status(400).json({ error: "X-Machine-Id header required" });
    }

    const { types } = req.body; // optional filter: ["scrape_sold", "navigate"]
    const task = await taskStore.claimTask(machineId, req.clientId, { types });

    if (!task) {
      return res.json({ task: null });
    }

    res.json({ task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update task status (extension reports progress)
router.patch("/:id/status", requireApiKey, async (req, res) => {
  try {
    const { status, result, errorMessage } = req.body;
    if (!status) {
      return res.status(400).json({ error: "status is required" });
    }

    const validStatuses = ["running", "done", "failed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(", ")}` });
    }

    if (status === "failed") {
      const task = await taskStore.failTask(req.params.id, errorMessage || "Unknown error");
      return res.json({ task });
    }

    const task = await taskStore.updateTaskStatus(req.params.id, { status, result, errorMessage });
    res.json({ task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Extension heartbeat — keeps task from expiring while in progress
router.post("/:id/heartbeat", requireApiKey, async (req, res) => {
  try {
    const task = await taskStore.updateTaskStatus(req.params.id, { status: "running" });
    res.json({ task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin endpoints ────────────────────────────────────

// Create a new task (admin dispatches work)
router.post("/", requireAdmin, async (req, res) => {
  try {
    const { clientId, type, payload, priority, maxRetries, expiresAt } = req.body;
    if (!type || !payload) {
      return res.status(400).json({ error: "type and payload are required" });
    }
    const task = await taskStore.createTask({
      clientId: clientId || "default",
      type,
      payload,
      priority,
      maxRetries,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });
    res.json({ task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List tasks with filters
router.get("/", requireAdmin, async (req, res) => {
  try {
    const { clientId, status, machineId, type, limit, offset } = req.query;
    const result = await taskStore.listTasks({
      clientId,
      status,
      machineId,
      type,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Queue stats
router.get("/stats", requireAdmin, async (req, res) => {
  try {
    const stats = await taskStore.getQueueStats(req.query.clientId);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single task
router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const task = await taskStore.getTask(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json({ task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel a task
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const task = await taskStore.cancelTask(req.params.id);
    res.json({ task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Expire stale tasks (can be called by cron or admin)
router.post("/expire-stale", requireAdmin, async (req, res) => {
  try {
    const count = await taskStore.expireStaleTasks(parseInt(req.body.staleMinutes) || 10);
    res.json({ expired: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
