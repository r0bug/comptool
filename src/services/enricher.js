/**
 * Background enrichment worker.
 * Fetches eBay item pages for comps missing details and updates them.
 *
 * Rate limit: 1 request per 2 seconds (30/min) — well under eBay's limits.
 * Run via: node src/services/enricher.js
 * Or via PM2: pm2 start src/services/enricher.js --name comptool-enricher
 */

require("dotenv").config();
const prisma = require("../config/database");

const DELAY_MS = 2000; // 2 seconds between requests
const BATCH_SIZE = 50; // Process 50 items per run cycle
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

let running = true;
let stats = { processed: 0, enriched: 0, failed: 0, skipped: 0 };

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse an eBay item page for details.
 */
function parseItemPage(html, url) {
  const data = {};

  // Category from breadcrumbs
  const catMatch = html.match(/<nav[^>]*class="[^"]*breadcrumb[^"]*"[^>]*>([\s\S]*?)<\/nav>/i);
  if (catMatch) {
    const crumbs = catMatch[1].match(/<span[^>]*>([^<]+)<\/span>/g);
    if (crumbs && crumbs.length > 1) {
      const parts = crumbs
        .map((c) => c.replace(/<[^>]+>/g, "").trim())
        .filter((t) => t && t !== "eBay" && t !== "Back to home page");
      if (parts.length > 0) data.category = parts[parts.length - 1];
    }
  }

  // Condition
  const condMatch = html.match(/"conditionDisplayName"\s*:\s*"([^"]+)"/i) ||
                    html.match(/Condition:<\/span>\s*<span[^>]*>([^<]+)/i) ||
                    html.match(/<div[^>]*class="[^"]*condition[^"]*"[^>]*>[^<]*<span[^>]*>([^<]+)/i);
  if (condMatch) data.condition = condMatch[1].trim();

  // Seller
  const sellerMatch = html.match(/"seller"\s*:\s*\{[^}]*"username"\s*:\s*"([^"]+)"/i) ||
                      html.match(/class="[^"]*seller-info[^"]*"[^>]*>[\s\S]*?<a[^>]*>([^<]+)/i);
  if (sellerMatch) data.seller = sellerMatch[1].trim();

  // Seller feedback
  const fbMatch = html.match(/"feedbackScore"\s*:\s*(\d+)/i) ||
                  html.match(/\((\d[\d,]*)\)\s*<\/span>\s*<\/a>\s*<\/div>\s*<!--\s*seller/i);
  if (fbMatch) data.sellerFeedback = parseInt(fbMatch[1].replace(",", ""));

  // Item specifics (for category enrichment)
  const specificsMatch = html.match(/"itemSpecifics"\s*:\s*\[([\s\S]*?)\]/i);
  if (specificsMatch) {
    try {
      // Try to extract brand from specifics
      const brandMatch = specificsMatch[1].match(/"Brand"\s*:\s*\["?([^"\],]+)/i) ||
                         specificsMatch[1].match(/"name"\s*:\s*"Brand"[^}]*"value"\s*:\s*\["?([^"\],]+)/i);
      // Not storing brand yet, but category from specifics
    } catch {}
  }

  // Category from structured data
  const ldMatch = html.match(/"category"\s*:\s*"([^"]+)"/i);
  if (ldMatch && !data.category) data.category = ldMatch[1];

  // Watchers
  const watchMatch = html.match(/(\d+)\s*watcher/i);
  if (watchMatch) data.watchers = parseInt(watchMatch[1]);

  // Bid count (for auctions)
  const bidMatch = html.match(/(\d+)\s*bid/i);
  if (bidMatch) data.bidCount = parseInt(bidMatch[1]);

  // Image URL (higher res than thumbnail)
  if (!data.imageUrl) {
    const imgMatch = html.match(/"image"\s*:\s*\["?(https:\/\/i\.ebayimg\.com\/[^"'\s]+)/i);
    if (imgMatch) data.imageUrl = imgMatch[1];
  }

  return data;
}

/**
 * Fetch and enrich a single comp.
 */
async function enrichComp(comp) {
  if (!comp.itemUrl) return null;

  try {
    const resp = await fetch(comp.itemUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        console.log("Rate limited! Backing off 30s...");
        await sleep(30000);
        return "rate_limited";
      }
      return null;
    }

    const html = await resp.text();
    const data = parseItemPage(html, comp.itemUrl);

    // Only update fields that are currently null on the comp
    const updates = {};
    if (data.condition && !comp.condition) updates.condition = data.condition;
    if (data.category && !comp.category) updates.category = data.category;
    if (data.seller && !comp.seller) updates.seller = data.seller;
    if (data.sellerFeedback != null && !comp.sellerFeedback) updates.sellerFeedback = data.sellerFeedback;
    if (data.watchers != null && !comp.watchers) updates.watchers = data.watchers;
    if (data.bidCount != null && !comp.bidCount) updates.bidCount = data.bidCount;
    if (data.imageUrl && !comp.imageUrl) updates.imageUrl = data.imageUrl;

    if (Object.keys(updates).length === 0) return "no_new_data";

    await prisma.soldComp.update({
      where: { id: comp.id },
      data: updates,
    });

    return updates;
  } catch (err) {
    if (err.name === "AbortError" || err.name === "TimeoutError") return "timeout";
    return null;
  }
}

/**
 * Main enrichment loop.
 */
async function runEnrichment() {
  console.log("Enrichment worker starting...");
  console.log(`Rate: 1 request per ${DELAY_MS / 1000}s | Batch: ${BATCH_SIZE}`);

  while (running) {
    // Find comps that have a URL but are missing key details
    const comps = await prisma.soldComp.findMany({
      where: {
        itemUrl: { not: null },
        OR: [
          { condition: null },
          { category: null },
          { seller: null },
        ],
      },
      orderBy: { updatedAt: "asc" }, // oldest first
      take: BATCH_SIZE,
    });

    if (comps.length === 0) {
      console.log("No more comps to enrich. Sleeping 5 minutes...");
      await sleep(300000);
      continue;
    }

    console.log(`Processing batch of ${comps.length} comps...`);

    for (const comp of comps) {
      if (!running) break;

      const result = await enrichComp(comp);
      stats.processed++;

      if (result === "rate_limited") {
        stats.failed++;
        // Already backed off in enrichComp
      } else if (result === "timeout") {
        stats.skipped++;
      } else if (result === "no_new_data") {
        stats.skipped++;
        // Mark as processed so we don't re-fetch — touch updatedAt
        await prisma.soldComp.update({ where: { id: comp.id }, data: {} }).catch(() => {});
      } else if (result === null) {
        stats.failed++;
      } else {
        stats.enriched++;
        const fields = Object.keys(result).join(", ");
        if (stats.enriched % 10 === 0 || stats.enriched <= 5) {
          console.log(`  #${comp.id} enriched: ${fields} | "${comp.title?.slice(0, 50)}"`);
        }
      }

      // Rate limit
      await sleep(DELAY_MS);
    }

    console.log(`Batch done. Total: ${stats.processed} processed, ${stats.enriched} enriched, ${stats.failed} failed, ${stats.skipped} skipped`);
  }

  console.log("Enrichment worker stopped.");
  console.log(`Final: ${stats.processed} processed, ${stats.enriched} enriched, ${stats.failed} failed, ${stats.skipped} skipped`);
  await prisma.$disconnect();
}

// Graceful shutdown
process.on("SIGINT", () => { running = false; });
process.on("SIGTERM", () => { running = false; });

// Status endpoint — write stats to a file for the API to read
const fs = require("fs");
const path = require("path");
const STATUS_FILE = path.join(__dirname, "../../data/enricher-status.json");

setInterval(() => {
  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify({ ...stats, running, updatedAt: new Date().toISOString() }));
  } catch {}
}, 10000);

runEnrichment().catch((err) => {
  console.error("Enrichment worker crashed:", err);
  process.exit(1);
});
