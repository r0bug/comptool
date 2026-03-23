const router = require("express").Router();
const compStore = require("../services/compStore");

// Aggregate stats — must be before /:id to avoid conflict
router.get("/stats", async (req, res) => {
  try {
    const { keyword } = req.query;
    if (!keyword) return res.status(400).json({ error: "keyword required" });
    const stats = await compStore.getStats(keyword);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List comps with filters
router.get("/", async (req, res) => {
  try {
    const { keyword, exclude, minPrice, maxPrice, condition, listingType, seller, dateFrom, dateTo, hasImage, richOnly, limit, offset, sortBy, sortDir } = req.query;
    const result = await compStore.listComps({
      keyword,
      exclude,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      condition,
      listingType,
      seller,
      dateFrom,
      dateTo,
      hasImage,
      richOnly,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
      sortBy: sortBy || "soldDate",
      sortDir: sortDir || "desc",
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single comp detail
router.get("/:id", async (req, res) => {
  try {
    const comp = await compStore.getComp(parseInt(req.params.id));
    if (!comp) return res.status(404).json({ error: "Comp not found" });
    res.json(comp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
