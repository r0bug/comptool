const router = require("express").Router();
const compStore = require("../services/compStore");
const cache = require("../services/cache");

// Aggregate stats — must be before /:id to avoid conflict
router.get("/stats", async (req, res) => {
  try {
    const { keyword } = req.query;
    if (!keyword) return res.status(400).json({ error: "keyword required" });
    const stats = await cache.get(`stats:${keyword}`, 120000, () => compStore.getStats(keyword));
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Filter facet counts — shows impact of each filter option
router.get("/facets", async (req, res) => {
  try {
    const { keyword, exclude } = req.query;
    const cacheKey = `facets:${keyword || ""}:${exclude || ""}`;

    const result = await cache.get(cacheKey, 120000, async () => {
      const prisma = require("../config/database");
      const andConditions = [];
      if (keyword) {
        keyword.split(/\s+/).filter(Boolean).forEach((term) => {
          andConditions.push({ title: { contains: term, mode: "insensitive" } });
        });
      }
      if (exclude) {
        exclude.split(/[,\s]+/).filter(Boolean).forEach((term) => {
          andConditions.push({ NOT: { title: { contains: term, mode: "insensitive" } } });
        });
      }
      const baseWhere = andConditions.length > 0 ? { AND: andConditions } : {};

      const [conditions, types, categories, shipping, images, total] = await Promise.all([
        prisma.soldComp.groupBy({ by: ["condition"], where: baseWhere, _count: true, orderBy: { _count: { condition: "desc" } }, take: 15 }),
        prisma.soldComp.groupBy({ by: ["listingType"], where: baseWhere, _count: true, orderBy: { _count: { listingType: "desc" } }, take: 10 }),
        prisma.soldComp.groupBy({ by: ["category"], where: baseWhere, _count: true, orderBy: { _count: { category: "desc" } }, take: 50 }),
        prisma.soldComp.groupBy({ by: ["shippingPrice"], where: { ...baseWhere, shippingPrice: 0 }, _count: true }).then((r) => r[0]?._count || 0),
        prisma.soldComp.count({ where: { ...baseWhere, imageUrl: { not: null } } }),
        prisma.soldComp.count({ where: baseWhere }),
      ]);

      const freeShipCount = typeof shipping === "number" ? shipping : 0;
      return {
        total,
        categories: categories.filter((c) => c.category).map((c) => ({ value: c.category, count: c._count })),
        conditions: conditions.filter((c) => c.condition).map((c) => ({ value: c.condition, count: c._count })),
        listingTypes: types.filter((c) => c.listingType).map((c) => ({ value: c.listingType, count: c._count })),
        freeShipping: freeShipCount,
        withImages: images,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List comps with filters
router.get("/", async (req, res) => {
  try {
    const { keyword, exclude, minPrice, maxPrice, condition, category, listingType, seller, dateFrom, dateTo, hasImage, richOnly, limit, offset, sortBy, sortDir } = req.query;
    const result = await compStore.listComps({
      keyword,
      exclude,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      condition,
      category,
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
