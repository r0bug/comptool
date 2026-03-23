const router = require("express").Router();
const compStore = require("../services/compStore");
const scraper = require("../services/scraper");
const browser = require("../services/browser");

// Simple rate limiter: 1 active scrape at a time
let activeScrape = false;

// Trigger a new search
router.post("/", async (req, res) => {
  try {
    const { keyword, filters } = req.body;
    if (!keyword) return res.status(400).json({ error: "keyword required" });

    if (!browser.isLaunched()) {
      return res.status(409).json({ error: "Browser not launched. Launch it first via POST /comp/api/browser/launch" });
    }

    if (activeScrape) {
      return res.status(429).json({ error: "A search is already in progress. Wait for it to finish." });
    }

    const search = await compStore.saveSearch(keyword, filters);

    // Run scraper in background
    activeScrape = true;
    runSearch(search.id, keyword, filters)
      .catch((err) => {
        console.error("Search failed:", err.message);
        compStore.updateSearch(search.id, {
          status: "error",
          errorMessage: err.message,
        });
      })
      .finally(() => {
        activeScrape = false;
      });

    res.json({ searchId: search.id, status: "running" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List past searches
router.get("/history", async (req, res) => {
  try {
    const { limit, offset, keyword } = req.query;
    const result = await compStore.listSearches({
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0,
      keyword,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get search detail with comps
router.get("/:id", async (req, res) => {
  try {
    const search = await compStore.getSearch(parseInt(req.params.id));
    if (!search) return res.status(404).json({ error: "Search not found" });
    res.json(search);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Poll search status
router.get("/:id/status", async (req, res) => {
  try {
    const search = await compStore.getSearch(parseInt(req.params.id));
    if (!search) return res.status(404).json({ error: "Search not found" });
    res.json({
      status: search.status,
      resultCount: search.resultCount,
      pagesScraped: search.pagesScraped,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function runSearch(searchId, keyword, filters) {
  const { items, source } = await scraper.searchSoldComps(keyword, filters);
  await compStore.updateSearch(searchId, { source });
  await compStore.saveComps(searchId, items);
}

module.exports = router;
