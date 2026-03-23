const router = require("express").Router();
const compStore = require("../services/compStore");
const { cacheImages } = require("../services/imageCache");
const prisma = require("../config/database");

// Receive bulk comp data from the Chrome extension
router.post("/", async (req, res) => {
  try {
    const { keyword, items, source } = req.body;

    if (!keyword || typeof keyword !== "string") {
      return res.status(400).json({ error: "keyword is required" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items array is required and must not be empty" });
    }

    // Validate each item has minimum fields
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.ebayItemId || !item.title || item.soldPrice == null) {
        return res.status(400).json({
          error: `Item ${i} missing required fields (ebayItemId, title, soldPrice)`,
        });
      }
    }

    const clientId = req.clientId || "default";
    const search = await compStore.saveSearch(keyword, null, clientId);
    await compStore.updateSearch(search.id, { source: source || "extension" });
    const { newCount, existingCount } = await compStore.saveComps(search.id, items, clientId);

    // Fetch the completed search with stats
    const result = await compStore.getSearch(search.id);

    // Cache images in the background (don't block the response)
    const compIds = result.comps.map((sc) => sc.comp.id);
    prisma.soldComp
      .findMany({ where: { id: { in: compIds }, localImage: null, imageUrl: { not: null } } })
      .then((uncached) => {
        if (uncached.length > 0) {
          cacheImages(uncached).then(({ cached }) => {
            if (cached > 0) console.log(`Cached ${cached} images for search "${keyword}"`);
          });
        }
      })
      .catch(() => {});

    res.json({
      searchId: search.id,
      resultCount: result.resultCount,
      newCount,
      existingCount,
      stats: {
        avg: result.avgPrice,
        median: result.medianPrice,
        min: result.minPrice,
        max: result.maxPrice,
      },
    });
  } catch (err) {
    console.error("Ingest error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
