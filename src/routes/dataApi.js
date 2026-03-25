/**
 * Public Data API — tiered access to comp data.
 *
 * All endpoints require X-API-Key header.
 * Access level determined by client's planTier.
 *
 * Free:       Extension + browse UI only (no API access)
 * Pro:        Query own data via API, basic stats
 * Business:   Query shared/aggregated data, price analytics
 * Enterprise: Full API, raw data, bulk export, webhooks
 */

const router = require("express").Router();
const requireApiKey = require("../middleware/apiKey");
const prisma = require("../config/database");
const settings = require("../services/settings");

// All data API routes require an API key
router.use(requireApiKey);

// Middleware: resolve plan tier from API key's client
router.use(async (req, res, next) => {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.clientId } });
    req.planTier = client?.planTier || "free";
    req.clientName = client?.name;

    // Free tier has no API access
    if (req.planTier === "free") {
      return res.status(403).json({
        error: "API access requires a Pro subscription or higher",
        currentPlan: "free",
        upgrade: "https://listflow.robug.com/comp/register",
      });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Price Check ─────────────────────────────────────
// GET /data/price-check?q=keyword&condition=Pre-Owned
// Returns price statistics for a keyword. Pro+.
router.get("/price-check", async (req, res) => {
  try {
    const { q, condition, category, listingType, days } = req.query;
    if (!q) return res.status(400).json({ error: "q (keyword) is required" });

    const where = buildWhere(q, { condition, category, listingType, days });
    const comps = await prisma.soldComp.findMany({
      where,
      select: { soldPrice: true, shippingPrice: true, totalPrice: true, soldDate: true },
      orderBy: { soldDate: "desc" },
      distinct: ["ebayItemId"],
      take: 1000,
    });

    if (comps.length === 0) {
      return res.json({ keyword: q, count: 0, stats: null, message: "No comps found for this keyword" });
    }

    const prices = comps.map((c) => c.soldPrice).sort((a, b) => a - b);
    const stats = computeStats(prices);

    res.json({
      keyword: q,
      count: comps.length,
      filters: { condition, category, listingType, days },
      stats,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Search Comps ────────────────────────────────────
// GET /data/search?q=keyword&limit=50&offset=0
// Returns comp listings. Pro = own data. Business+ = shared data.
router.get("/search", async (req, res) => {
  try {
    const { q, exclude, condition, category, listingType, seller, minPrice, maxPrice, days, limit, offset, sort, dir } = req.query;

    const where = buildWhere(q, { exclude, condition, category, listingType, seller, minPrice, maxPrice, days });

    // Pro: only their own data
    if (req.planTier === "pro") {
      where.clientId = req.clientId;
    }
    // Business/Enterprise: shared data (no clientId filter)

    const take = Math.min(parseInt(limit) || 50, req.planTier === "enterprise" ? 500 : 100);
    const skip = parseInt(offset) || 0;
    const sortBy = sort || "soldDate";
    const sortDir = dir || "desc";

    const comps = await prisma.soldComp.findMany({
      where,
      orderBy: [{ [sortBy]: sortDir }],
      distinct: ["ebayItemId"],
      take,
      skip,
      select: {
        ebayItemId: true,
        title: true,
        soldPrice: true,
        shippingPrice: true,
        totalPrice: true,
        condition: true,
        category: true,
        listingType: true,
        bidCount: true,
        seller: req.planTier === "enterprise" ? true : false,
        imageUrl: true,
        itemUrl: req.planTier === "enterprise" ? true : false,
        soldDate: true,
      },
    });

    const total = await prisma.soldComp.count({ where });

    res.json({
      keyword: q,
      total,
      returned: comps.length,
      offset: skip,
      comps,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Categories ──────────────────────────────────────
// GET /data/categories?q=keyword
// Returns available categories with counts. Pro+.
router.get("/categories", async (req, res) => {
  try {
    const { q } = req.query;
    const where = q ? { title: { contains: q, mode: "insensitive" } } : {};

    const cats = await prisma.soldComp.groupBy({
      by: ["category"],
      where: { ...where, category: { not: null } },
      _count: true,
      orderBy: { _count: { category: "desc" } },
      take: 50,
    });

    res.json({
      categories: cats.map((c) => ({ category: c.category, count: c._count })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Trending ────────────────────────────────────────
// GET /data/trending?days=7
// Returns most-searched keywords and price movers. Business+.
router.get("/trending", async (req, res) => {
  try {
    if (req.planTier === "pro") {
      return res.status(403).json({ error: "Trending data requires Business tier", currentPlan: req.planTier });
    }

    const days = parseInt(req.query.days) || 7;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const topSearches = await prisma.search.groupBy({
      by: ["keyword"],
      where: { createdAt: { gte: since } },
      _count: true,
      _avg: { avgPrice: true },
      orderBy: { _count: { keyword: "desc" } },
      take: 20,
    });

    const recentComps = await prisma.soldComp.groupBy({
      by: ["category"],
      where: { createdAt: { gte: since }, category: { not: null } },
      _count: true,
      _avg: { soldPrice: true },
      orderBy: { _count: { category: "desc" } },
      take: 10,
    });

    res.json({
      period: `${days} days`,
      topSearches: topSearches.map((s) => ({
        keyword: s.keyword,
        searchCount: s._count,
        avgPrice: s._avg.avgPrice ? Math.round(s._avg.avgPrice * 100) / 100 : null,
      })),
      topCategories: recentComps.map((c) => ({
        category: c.category,
        compCount: c._count,
        avgPrice: c._avg.soldPrice ? Math.round(c._avg.soldPrice * 100) / 100 : null,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Bulk Export ──────────────────────────────────────
// GET /data/export?q=keyword&format=json
// Full data export. Enterprise only.
router.get("/export", async (req, res) => {
  try {
    if (req.planTier !== "enterprise") {
      return res.status(403).json({ error: "Bulk export requires Enterprise tier", currentPlan: req.planTier });
    }

    const { q, condition, category, listingType, days, format } = req.query;
    if (!q) return res.status(400).json({ error: "q (keyword) is required for export" });

    const where = buildWhere(q, { condition, category, listingType, days });
    const comps = await prisma.soldComp.findMany({
      where,
      distinct: ["ebayItemId"],
      orderBy: { soldDate: "desc" },
      take: 10000,
    });

    if (format === "csv") {
      const header = "ebayItemId,title,soldPrice,shippingPrice,totalPrice,condition,category,listingType,bidCount,seller,sellerFeedback,imageUrl,itemUrl,soldDate\n";
      const rows = comps.map((c) =>
        [c.ebayItemId, `"${(c.title || "").replace(/"/g, '""')}"`, c.soldPrice, c.shippingPrice, c.totalPrice, `"${c.condition || ""}"`, `"${c.category || ""}"`, c.listingType, c.bidCount, c.seller, c.sellerFeedback, c.imageUrl, c.itemUrl, c.soldDate?.toISOString()].join(",")
      ).join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="comptool-export-${q.replace(/\s+/g, "-")}.csv"`);
      return res.send(header + rows);
    }

    res.json({ keyword: q, count: comps.length, comps });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Account Info ────────────────────────────────────
// GET /data/account
// Returns current plan, usage, limits.
router.get("/account", async (req, res) => {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.clientId } });
    const searchCount = await prisma.search.count({ where: { clientId: req.clientId } });
    const compCount = await prisma.soldComp.count({ where: { clientId: req.clientId } });
    const keyCount = await prisma.apiKey.count({ where: { clientId: req.clientId, isActive: true } });

    res.json({
      name: client.name,
      email: client.email,
      plan: client.planTier,
      usage: {
        searches: searchCount,
        comps: compCount,
        apiKeys: keyCount,
      },
      limits: {
        maxSearchesPerMonth: client.planTier === "free" ? 1000 : client.planTier === "pro" ? 5000 : "unlimited",
        maxComps: client.planTier === "free" ? 10000 : client.planTier === "pro" ? 100000 : "unlimited",
        apiAccess: client.planTier !== "free",
        sharedData: client.planTier === "business" || client.planTier === "enterprise",
        bulkExport: client.planTier === "enterprise",
        trending: client.planTier === "business" || client.planTier === "enterprise",
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Helpers ─────────────────────────────────────────

function buildWhere(keyword, opts = {}) {
  const and = [];

  if (keyword) {
    keyword.split(/\s+/).filter(Boolean).forEach((term) => {
      and.push({ title: { contains: term, mode: "insensitive" } });
    });
  }
  if (opts.exclude) {
    opts.exclude.split(/[,\s]+/).filter(Boolean).forEach((term) => {
      and.push({ NOT: { title: { contains: term, mode: "insensitive" } } });
    });
  }
  if (opts.condition) and.push({ condition: { contains: opts.condition, mode: "insensitive" } });
  if (opts.category) and.push({ category: { contains: opts.category, mode: "insensitive" } });
  if (opts.listingType) and.push({ listingType: { contains: opts.listingType, mode: "insensitive" } });
  if (opts.seller) and.push({ seller: { contains: opts.seller, mode: "insensitive" } });
  if (opts.minPrice) and.push({ soldPrice: { gte: parseFloat(opts.minPrice) } });
  if (opts.maxPrice) and.push({ soldPrice: { lte: parseFloat(opts.maxPrice) } });
  if (opts.days) {
    const since = new Date();
    since.setDate(since.getDate() - parseInt(opts.days));
    and.push({ soldDate: { gte: since } });
  }

  return and.length > 0 ? { AND: and } : {};
}

function computeStats(prices) {
  if (prices.length === 0) return null;
  const sum = prices.reduce((a, b) => a + b, 0);
  const avg = sum / prices.length;
  const median = prices.length % 2 === 0
    ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
    : prices[Math.floor(prices.length / 2)];
  const p25 = prices[Math.floor(prices.length * 0.25)];
  const p75 = prices[Math.floor(prices.length * 0.75)];

  return {
    avg: Math.round(avg * 100) / 100,
    median: Math.round(median * 100) / 100,
    min: prices[0],
    max: prices[prices.length - 1],
    p25: Math.round(p25 * 100) / 100,
    p75: Math.round(p75 * 100) / 100,
    count: prices.length,
  };
}

module.exports = router;
