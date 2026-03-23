const prisma = require("../config/database");

/**
 * Create a new search record.
 */
async function saveSearch(keyword, filters = null, clientId = "default") {
  return await prisma.search.create({
    data: {
      clientId,
      keyword,
      filters: filters || undefined,
      status: "running",
    },
  });
}

/**
 * Update a search record.
 */
async function updateSearch(searchId, data) {
  return await prisma.search.update({
    where: { id: searchId },
    data,
  });
}

/**
 * Save scraped comps, dedup by (clientId, ebayItemId), link to search, compute stats.
 */
async function saveComps(searchId, items, clientId = "default") {
  let newCount = 0;
  let existingCount = 0;

  for (const item of items) {
    // Build update data — only overwrite fields that have non-null values
    // so a Terapeak scrape (no condition) doesn't erase condition from a sold search
    const updateData = { title: item.title, soldPrice: item.soldPrice };
    if (item.shippingPrice != null) updateData.shippingPrice = item.shippingPrice;
    if (item.totalPrice != null) updateData.totalPrice = item.totalPrice;
    if (item.condition) updateData.condition = item.condition;
    if (item.category) updateData.category = item.category;
    if (item.listingType) updateData.listingType = item.listingType;
    if (item.bidCount != null) updateData.bidCount = item.bidCount;
    if (item.quantitySold != null) updateData.quantitySold = item.quantitySold;
    if (item.totalSales != null) updateData.totalSales = item.totalSales;
    if (item.watchers != null) updateData.watchers = item.watchers;
    if (item.seller) updateData.seller = item.seller;
    if (item.sellerFeedback != null) updateData.sellerFeedback = item.sellerFeedback;
    if (item.imageUrl) updateData.imageUrl = item.imageUrl;
    if (item.itemUrl) updateData.itemUrl = item.itemUrl;
    if (item.soldDate) updateData.soldDate = new Date(item.soldDate);

    const comp = await prisma.soldComp.upsert({
      where: {
        clientId_ebayItemId: { clientId, ebayItemId: item.ebayItemId },
      },
      update: updateData,
      create: {
        clientId,
        ebayItemId: item.ebayItemId,
        title: item.title,
        soldPrice: item.soldPrice,
        shippingPrice: item.shippingPrice,
        totalPrice: item.totalPrice,
        condition: item.condition,
        category: item.category,
        listingType: item.listingType,
        bidCount: item.bidCount,
        quantitySold: item.quantitySold,
        totalSales: item.totalSales,
        watchers: item.watchers,
        seller: item.seller,
        sellerFeedback: item.sellerFeedback,
        imageUrl: item.imageUrl,
        itemUrl: item.itemUrl,
        soldDate: item.soldDate ? new Date(item.soldDate) : null,
      },
    });

    // Link to search (ignore if already linked)
    await prisma.searchComp.upsert({
      where: {
        searchId_compId: { searchId, compId: comp.id },
      },
      update: {},
      create: { searchId, compId: comp.id },
    });

    // Check if this was a create or update
    const existed = await prisma.searchComp.count({
      where: { compId: comp.id },
    });
    if (existed > 1) existingCount++;
    else newCount++;
  }

  // Compute stats
  const stats = await computeSearchStats(searchId);
  await prisma.search.update({
    where: { id: searchId },
    data: {
      ...stats,
      resultCount: items.length,
      status: "done",
    },
  });

  return { newCount, existingCount };
}

/**
 * Compute price stats for a search's comps.
 */
async function computeSearchStats(searchId) {
  const comps = await prisma.soldComp.findMany({
    where: { searches: { some: { searchId } } },
    select: { soldPrice: true, totalPrice: true },
  });

  if (comps.length === 0) {
    return { avgPrice: null, medianPrice: null, minPrice: null, maxPrice: null };
  }

  const prices = comps
    .map((c) => c.totalPrice || c.soldPrice)
    .sort((a, b) => a - b);

  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const mid = Math.floor(prices.length / 2);
  const median =
    prices.length % 2 !== 0
      ? prices[mid]
      : (prices[mid - 1] + prices[mid]) / 2;

  return {
    avgPrice: Math.round(avg * 100) / 100,
    medianPrice: Math.round(median * 100) / 100,
    minPrice: prices[0],
    maxPrice: prices[prices.length - 1],
  };
}

/**
 * List past searches with pagination.
 */
async function listSearches({ limit = 20, offset = 0, keyword } = {}) {
  const where = keyword
    ? { keyword: { contains: keyword, mode: "insensitive" } }
    : {};

  const [searches, total] = await Promise.all([
    prisma.search.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.search.count({ where }),
  ]);

  return { searches, total };
}

/**
 * Get a single search with its comps.
 */
async function getSearch(id) {
  return await prisma.search.findUnique({
    where: { id },
    include: {
      comps: {
        include: { comp: true },
        orderBy: { comp: { soldPrice: "desc" } },
      },
    },
  });
}

/**
 * List comps with rich filtering and pagination.
 */
async function listComps({
  keyword,
  exclude,
  minPrice,
  maxPrice,
  condition,
  category,
  listingType,
  seller,
  dateFrom,
  dateTo,
  hasImage,
  richOnly,
  limit = 50,
  offset = 0,
  sortBy = "soldDate",
  sortDir = "desc",
} = {}) {
  const andConditions = [];

  // Include keyword (supports multiple terms with +)
  if (keyword) {
    const terms = keyword.split(/\s+/).filter(Boolean);
    for (const term of terms) {
      andConditions.push({ title: { contains: term, mode: "insensitive" } });
    }
  }

  // Exclude terms (supports multiple, comma or space separated)
  if (exclude) {
    const excludeTerms = exclude.split(/[,\s]+/).filter(Boolean);
    for (const term of excludeTerms) {
      andConditions.push({
        NOT: { title: { contains: term, mode: "insensitive" } },
      });
    }
  }

  // Price range
  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceFilter = {};
    if (minPrice !== undefined) priceFilter.gte = parseFloat(minPrice);
    if (maxPrice !== undefined) priceFilter.lte = parseFloat(maxPrice);
    andConditions.push({ soldPrice: priceFilter });
  }

  // Condition
  if (condition) {
    andConditions.push({ condition: { contains: condition, mode: "insensitive" } });
  }

  // Category
  if (category) {
    andConditions.push({ category: { contains: category, mode: "insensitive" } });
  }

  // Listing type
  if (listingType) {
    andConditions.push({ listingType: { contains: listingType, mode: "insensitive" } });
  }

  // Seller
  if (seller) {
    andConditions.push({ seller: { contains: seller, mode: "insensitive" } });
  }

  // Date range
  if (dateFrom) {
    andConditions.push({ soldDate: { gte: new Date(dateFrom) } });
  }
  if (dateTo) {
    andConditions.push({ soldDate: { lte: new Date(dateTo) } });
  }

  // Has image
  if (hasImage === "true" || hasImage === true) {
    andConditions.push({ imageUrl: { not: null } });
  }

  // Rich data only — exclude items missing condition/seller (typically Terapeak)
  if (richOnly === "true" || richOnly === true) {
    andConditions.push({ condition: { not: null } });
  }

  const where = andConditions.length > 0 ? { AND: andConditions } : {};

  const [comps, total] = await Promise.all([
    prisma.soldComp.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      take: limit,
      skip: offset,
    }),
    prisma.soldComp.count({ where }),
  ]);

  return { comps, total };
}

/**
 * Get a single comp with its search history.
 */
async function getComp(id) {
  return await prisma.soldComp.findUnique({
    where: { id },
    include: {
      searches: {
        include: { search: true },
      },
    },
  });
}

/**
 * Get aggregate stats for all comps matching a keyword.
 */
async function getStats(keyword) {
  const comps = await prisma.soldComp.findMany({
    where: { title: { contains: keyword, mode: "insensitive" } },
    select: { soldPrice: true, totalPrice: true },
  });

  if (comps.length === 0) {
    return {
      avg: 0,
      median: 0,
      min: 0,
      max: 0,
      count: 0,
      p25: 0,
      p75: 0,
    };
  }

  const prices = comps
    .map((c) => c.totalPrice || c.soldPrice)
    .sort((a, b) => a - b);
  const count = prices.length;
  const avg = prices.reduce((a, b) => a + b, 0) / count;
  const mid = Math.floor(count / 2);
  const median =
    count % 2 !== 0 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;

  const p25Index = Math.max(0, Math.ceil(count * 0.25) - 1);
  const p75Index = Math.max(0, Math.ceil(count * 0.75) - 1);

  return {
    avg: Math.round(avg * 100) / 100,
    median: Math.round(median * 100) / 100,
    min: prices[0],
    max: prices[count - 1],
    count,
    p25: prices[p25Index],
    p75: prices[p75Index],
  };
}

module.exports = {
  saveSearch,
  updateSearch,
  saveComps,
  listSearches,
  getSearch,
  listComps,
  getComp,
  getStats,
};
