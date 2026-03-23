/**
 * eBay API enricher — uses ListFlow's already-authenticated eBay API
 * to look up item details and enrich comps with category, condition,
 * seller, etc.
 *
 * Calls ListFlow at localhost:3001/api/ebay/listing/:itemId which
 * uses the Browse API (already OAuth'd via @hendt/ebay-api).
 *
 * Rate: ~1 req/sec to stay within eBay's 5000/day limit.
 *
 * Run: node src/services/ebayEnricher.js
 * PM2: pm2 start src/services/ebayEnricher.js --name comptool-ebay-enricher
 */

require("dotenv").config();
const prisma = require("../config/database");
const fs = require("fs");
const path = require("path");

const LISTFLOW_URL = process.env.LISTFLOW_URL || "http://localhost:3001";
const DELAY_MS = parseInt(process.env.ENRICHER_DELAY_MS || "1200"); // ~50/min
const BATCH_SIZE = parseInt(process.env.ENRICHER_BATCH_SIZE || "100");
const STATUS_FILE = path.join(__dirname, "../../data/ebay-enricher-status.json");

let running = true;
let stats = { processed: 0, enriched: 0, failed: 0, skipped: 0, notFound: 0, startedAt: new Date().toISOString() };

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch item details from ListFlow's eBay API endpoint.
 */
async function fetchFromListFlow(ebayItemId) {
  try {
    const resp = await fetch(`${LISTFLOW_URL}/api/ebay/listing/${ebayItemId}`, {
      signal: AbortSignal.timeout(15000),
    });

    if (resp.status === 404) return null;
    if (resp.status === 429) {
      console.log("Rate limited by eBay via ListFlow. Backing off 60s...");
      await sleep(60000);
      return "rate_limited";
    }
    if (!resp.ok) return null;

    return resp.json();
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") return "timeout";
    return null;
  }
}

/**
 * Parse ListFlow's response into update fields.
 * ListFlow's Browse API response includes various nested structures.
 */
function parseResponse(data) {
  const updates = {};

  // Category — could be in categoryPath, category, or nested
  if (data.categoryPath) {
    const parts = data.categoryPath.split("|").map((s) => s.trim());
    updates.category = parts[parts.length - 1] || data.categoryPath;
  } else if (data.category) {
    updates.category = typeof data.category === "string" ? data.category : data.category.categoryName || data.category.categoryId;
  }

  // Condition
  if (data.condition) {
    updates.condition = data.condition;
  } else if (data.conditionDescription) {
    updates.condition = data.conditionDescription;
  }

  // Seller
  if (data.seller?.username) {
    updates.seller = data.seller.username;
    if (data.seller.feedbackScore != null) updates.sellerFeedback = data.seller.feedbackScore;
  }

  // Image
  if (data.image?.imageUrl) {
    updates.imageUrl = data.image.imageUrl;
  } else if (data.thumbnailImages?.[0]?.imageUrl) {
    updates.imageUrl = data.thumbnailImages[0].imageUrl;
  }

  // URL
  if (data.itemWebUrl) {
    updates.itemUrl = data.itemWebUrl;
  }

  // Watchers
  if (data.watchCount != null) {
    updates.watchers = data.watchCount;
  }

  // Bids
  if (data.bidCount != null) {
    updates.bidCount = data.bidCount;
  }

  return updates;
}

/**
 * Enrich a single comp.
 */
async function enrichComp(comp) {
  stats.processed++;

  const data = await fetchFromListFlow(comp.ebayItemId);

  if (data === null) { stats.notFound++; return; }
  if (data === "rate_limited" || data === "timeout") { stats.failed++; return; }

  const apiUpdates = parseResponse(data);

  // Only overwrite null fields
  const updates = {};
  if (apiUpdates.category && !comp.category) updates.category = apiUpdates.category;
  if (apiUpdates.condition && !comp.condition) updates.condition = apiUpdates.condition;
  if (apiUpdates.seller && !comp.seller) updates.seller = apiUpdates.seller;
  if (apiUpdates.sellerFeedback != null && !comp.sellerFeedback) updates.sellerFeedback = apiUpdates.sellerFeedback;
  if (apiUpdates.imageUrl && !comp.imageUrl) updates.imageUrl = apiUpdates.imageUrl;
  if (apiUpdates.itemUrl && !comp.itemUrl) updates.itemUrl = apiUpdates.itemUrl;
  if (apiUpdates.watchers != null && !comp.watchers) updates.watchers = apiUpdates.watchers;
  if (apiUpdates.bidCount != null && !comp.bidCount) updates.bidCount = apiUpdates.bidCount;

  if (Object.keys(updates).length === 0) {
    stats.skipped++;
    await prisma.soldComp.update({ where: { id: comp.id }, data: {} }).catch(() => {});
    return;
  }

  await prisma.soldComp.update({ where: { id: comp.id }, data: updates });
  stats.enriched++;

  if (stats.enriched % 50 === 0 || stats.enriched <= 10) {
    console.log(`  #${comp.id} [${Object.keys(updates).join(", ")}] "${comp.title?.slice(0, 50)}"`);
  }
}

/**
 * Main loop.
 */
async function run() {
  console.log("eBay API enricher starting...");
  console.log(`ListFlow: ${LISTFLOW_URL}`);
  console.log(`Rate: ~${Math.round(60000 / DELAY_MS)}/min | Batch: ${BATCH_SIZE}`);

  // Test ListFlow connectivity
  try {
    const resp = await fetch(`${LISTFLOW_URL}/api/health`, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    console.log("ListFlow connection OK\n");
  } catch (err) {
    console.error(`Cannot reach ListFlow at ${LISTFLOW_URL}:`, err.message);
    console.error("Make sure ListFlow is running (pm2 list)");
    process.exit(1);
  }

  while (running) {
    const comps = await prisma.soldComp.findMany({
      where: {
        OR: [
          { category: null },
          { condition: null },
          { seller: null },
        ],
      },
      orderBy: { updatedAt: "asc" },
      take: BATCH_SIZE,
    });

    if (comps.length === 0) {
      console.log("No more comps to enrich. Sleeping 10 minutes...");
      await sleep(600000);
      continue;
    }

    console.log(`Batch: ${comps.length} | Total: ${stats.processed} processed, ${stats.enriched} enriched, ${stats.notFound} not found`);

    for (const comp of comps) {
      if (!running) break;
      await enrichComp(comp);
      await sleep(DELAY_MS);
    }
  }

  console.log("\nDone:", JSON.stringify(stats));
  await prisma.$disconnect();
}

// Graceful shutdown
process.on("SIGINT", () => { running = false; });
process.on("SIGTERM", () => { running = false; });

// Status writer
setInterval(() => {
  try { fs.writeFileSync(STATUS_FILE, JSON.stringify({ ...stats, running, updatedAt: new Date().toISOString() })); } catch {}
}, 10000);

run().catch((err) => {
  console.error("Enricher crashed:", err);
  process.exit(1);
});
