const router = require("express").Router();
const requireApiKey = require("../middleware/apiKey");

router.get("/health", (req, res) => {
  res.json({ status: "ok", service: "comptool" });
});

// Extension version check
router.get("/extension/version", (req, res) => {
  const fs = require("fs");
  const path = require("path");
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../../extension/manifest.json"), "utf-8")
    );
    res.json({ version: manifest.version });
  } catch {
    res.status(404).json({ error: "Extension manifest not found" });
  }
});

// Global stats for footer
router.get("/stats", async (req, res) => {
  try {
    const prisma = require("../config/database");
    const fs = require("fs");
    const path = require("path");
    const imgDir = path.join(__dirname, "../../data/images");

    const [compCount, searchCount, cachedImages] = await Promise.all([
      prisma.soldComp.count(),
      prisma.search.count(),
      prisma.soldComp.count({ where: { localImage: { not: null } } }),
    ]);

    // Estimate storage from image count * avg size (faster than scanning disk)
    let storageMb = 0;
    try {
      const files = fs.readdirSync(imgDir);
      // Sample first 20 files for avg size
      let sampleSize = 0;
      const sample = files.slice(0, 20);
      for (const f of sample) {
        try { sampleSize += fs.statSync(path.join(imgDir, f)).size; } catch {}
      }
      const avgSize = sample.length > 0 ? sampleSize / sample.length : 0;
      storageMb = Math.round((avgSize * files.length) / (1024 * 1024));
    } catch {}

    res.json({ compCount, searchCount, cachedImages, storageMb });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enrichment worker status
router.get("/enricher/status", (req, res) => {
  const fs = require("fs");
  const path = require("path");
  try {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, "../../data/enricher-status.json"), "utf-8"));
    res.json(data);
  } catch {
    res.json({ running: false, processed: 0, enriched: 0, failed: 0, skipped: 0, message: "Enricher not running" });
  }
});

router.use("/search", require("./search"));
router.use("/comps", require("./comps"));
router.use("/browser", require("./browser"));
router.use("/ingest", requireApiKey, require("./ingest"));
router.use("/images", require("./images"));
router.use("/admin", require("./admin"));
router.use("/clients", require("./clients"));

module.exports = router;
