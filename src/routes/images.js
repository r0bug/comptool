const router = require("express").Router();
const prisma = require("../config/database");
const { backfillImages } = require("../services/imageCache");

let backfillRunning = false;

// Trigger a backfill of uncached images
router.post("/backfill", async (req, res) => {
  if (backfillRunning) {
    return res.json({ status: "already_running" });
  }

  const uncached = await prisma.soldComp.count({
    where: { imageUrl: { not: null }, localImage: null },
  });

  if (uncached === 0) {
    return res.json({ status: "done", uncached: 0 });
  }

  backfillRunning = true;
  res.json({ status: "started", uncached });

  // Run in background
  backfillImages()
    .then((total) => {
      console.log(`Image backfill complete: ${total} images cached`);
    })
    .catch((err) => {
      console.error("Image backfill error:", err);
    })
    .finally(() => {
      backfillRunning = false;
    });
});

// Check backfill status
router.get("/status", async (req, res) => {
  const total = await prisma.soldComp.count({ where: { imageUrl: { not: null } } });
  const cached = await prisma.soldComp.count({ where: { localImage: { not: null } } });

  res.json({
    total,
    cached,
    uncached: total - cached,
    backfillRunning,
  });
});

module.exports = router;
