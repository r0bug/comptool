const router = require("express").Router();
const requireApiKey = require("../middleware/apiKey");
const cache = require("../services/cache");

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

// Global stats for footer — cached 5 minutes
router.get("/stats", async (req, res) => {
  try {
    const result = await cache.get("global_stats", 300000, async () => {
      const prisma = require("../config/database");
      const fs = require("fs");
      const path = require("path");
      const imgDir = path.join(__dirname, "../../data/images");

      const [compCount, searchCount, cachedImages] = await Promise.all([
        prisma.soldComp.count(),
        prisma.search.count(),
        prisma.soldComp.count({ where: { localImage: { not: null } } }),
      ]);

      let storageMb = 0;
      try {
        const files = fs.readdirSync(imgDir);
        let sampleSize = 0;
        const sample = files.slice(0, 20);
        for (const f of sample) {
          try { sampleSize += fs.statSync(path.join(imgDir, f)).size; } catch {}
        }
        const avgSize = sample.length > 0 ? sampleSize / sample.length : 0;
        storageMb = Math.round((avgSize * files.length) / (1024 * 1024));
      } catch {}

      return { compCount, searchCount, cachedImages, storageMb };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enrichment worker status
router.get("/enricher/status", (req, res) => {
  const fs = require("fs");
  const path = require("path");
  const result = {};
  try {
    result.htmlScraper = JSON.parse(fs.readFileSync(path.join(__dirname, "../../data/enricher-status.json"), "utf-8"));
  } catch {
    result.htmlScraper = { running: false };
  }
  try {
    result.ebayApi = JSON.parse(fs.readFileSync(path.join(__dirname, "../../data/ebay-enricher-status.json"), "utf-8"));
  } catch {
    result.ebayApi = { running: false };
  }
  res.json(result);
});

// Hot-patch endpoint — push JavaScript to extensions
router.get("/extension/patch", async (req, res) => {
  try {
    const prisma = require("../config/database");
    const patch = await prisma.setting.findUnique({ where: { key: "extension_patch" } });
    res.json({ script: patch?.value || null });
  } catch {
    res.json({ script: null });
  }
});

router.use("/search", require("./search"));
router.use("/comps", require("./comps"));
router.use("/browser", require("./browser"));
router.use("/ingest", requireApiKey, require("./ingest"));
router.use("/images", require("./images"));
// Search queue — server tells extensions what to search next (cached 10 min)
router.get("/queue", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const result = await cache.get(`queue:${limit}`, 600000, async () => {
    const prisma = require("../config/database");

    // Strategy: find common title words among uncategorized comps
    // that would benefit most from a re-search
    const results = await prisma.$queryRawUnsafe(`
      WITH words AS (
        SELECT unnest(string_to_array(lower(title), ' ')) as word
        FROM comptool."SoldComp"
        WHERE category IS NULL AND title IS NOT NULL
      )
      SELECT word, count(*) as cnt FROM words
      WHERE length(word) > 4
      AND word NOT IN ('the','and','for','with','new','used','lot','set','pair','vintage','original','from','this','that','item','each','pack','type','left','right','part','fits','model','good','free','ship','rare','nice','great','size','sale','more','only','rear','side','ford','opens','black','white','green','blue','brown','large','small','front','tested','boxopens','usaopens','untestedopens','price','works','working','shipping','condition')
      GROUP BY word
      HAVING count(*) >= 50
      ORDER BY cnt DESC
      LIMIT ${limit * 3}
    `);

    // Build search-friendly terms by combining top words
    const keywords = results.map((r) => r.word);

    // Also check what was recently searched so we don't repeat
    const recent = await prisma.search.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      select: { keyword: true },
      distinct: ["keyword"],
    });
    const recentSet = new Set(recent.map((r) => r.keyword.toLowerCase()));

    const queue = keywords
      .filter((kw) => !recentSet.has(kw))
      .slice(0, limit);

    // Check for any pending scripts/patches to push to extensions
    const pendingScript = await prisma.setting.findUnique({ where: { key: "extension_script" } });
    const script = pendingScript?.value || null;

    return { queue, total: results.length, recentlySearched: recentSet.size, script };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// WorthPoint search queue — pulls from stored keyword list
router.get("/queue/worthpoint", async (req, res) => {
  try {
    const prisma = require("../config/database");
    const limit = parseInt(req.query.limit) || 10;

    // Get the stored WP keyword list
    const setting = await prisma.setting.findUnique({ where: { key: "worthpoint_queue" } });
    if (!setting?.value) {
      return res.json({ queue: [], total: 0 });
    }

    const allKeywords = setting.value.split("\n").map((k) => k.trim()).filter(Boolean);

    // Check which ones were recently searched (source = worthpoint)
    const recent = await prisma.search.findMany({
      where: { source: "worthpoint", createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      select: { keyword: true },
      distinct: ["keyword"],
    });
    const recentSet = new Set(recent.map((r) => r.keyword.toLowerCase()));

    const queue = allKeywords.filter((kw) => !recentSet.has(kw.toLowerCase())).slice(0, limit);

    res.json({ queue, total: allKeywords.length, remaining: queue.length, recentlySearched: recentSet.size });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use("/admin", require("./admin"));
router.use("/clients", require("./clients"));
router.use("/data", require("./dataApi"));
router.use("/scrape-url", require("./scrapeUrl"));

module.exports = router;
