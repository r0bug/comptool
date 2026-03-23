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

router.use("/search", require("./search"));
router.use("/comps", require("./comps"));
router.use("/browser", require("./browser"));
router.use("/ingest", requireApiKey, require("./ingest"));
router.use("/images", require("./images"));
router.use("/admin", require("./admin"));
router.use("/clients", require("./clients"));

module.exports = router;
