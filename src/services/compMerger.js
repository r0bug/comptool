/**
 * Cross-source comp merger.
 * Matches WorthPoint comps to eBay comps by title similarity + price + date.
 * When a match is found, merges the best data from both sources into one record.
 *
 * Run: node src/services/compMerger.js
 * PM2: pm2 start src/services/compMerger.js --name comptool-merger --cwd /home/robug/comptool
 */

require("dotenv").config();
const prisma = require("../config/database");

const BATCH_SIZE = 100;
const TITLE_SIMILARITY_THRESHOLD = 0.6; // 60% word overlap
const PRICE_TOLERANCE = 0.02; // 2% price difference allowed
const DATE_TOLERANCE_DAYS = 7; // sold within 7 days of each other

let stats = { processed: 0, merged: 0, noMatch: 0, errors: 0 };

/**
 * Calculate word-level similarity between two titles.
 * Returns 0-1 (1 = identical words).
 */
function titleSimilarity(a, b) {
  if (!a || !b) return 0;
  const wordsA = new Set(a.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }

  const maxSize = Math.max(wordsA.size, wordsB.size);
  return overlap / maxSize;
}

/**
 * Check if two prices are close enough.
 */
function priceMatch(a, b) {
  if (a === 0 || b === 0) return false;
  const diff = Math.abs(a - b) / Math.max(a, b);
  return diff <= PRICE_TOLERANCE;
}

/**
 * Check if two dates are within tolerance.
 */
function dateMatch(a, b) {
  if (!a || !b) return true; // if either is missing, don't penalize
  const diffMs = Math.abs(new Date(a).getTime() - new Date(b).getTime());
  return diffMs <= DATE_TOLERANCE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Find the best eBay match for a WorthPoint comp.
 */
async function findEbayMatch(wpComp) {
  // Search by title words — use the first 3 significant words
  const words = wpComp.title.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 3).slice(0, 4);
  if (words.length === 0) return null;

  // Build a search that matches all keywords
  const where = {
    AND: [
      ...words.map(w => ({ title: { contains: w, mode: "insensitive" } })),
      { ebayItemId: { not: { startsWith: "wp-" } } }, // only eBay comps
      { soldPrice: { gte: wpComp.soldPrice * (1 - PRICE_TOLERANCE), lte: wpComp.soldPrice * (1 + PRICE_TOLERANCE) } },
    ],
  };

  const candidates = await prisma.soldComp.findMany({
    where,
    take: 20,
    orderBy: { soldDate: "desc" },
  });

  if (candidates.length === 0) return null;

  // Score candidates
  let bestMatch = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const sim = titleSimilarity(wpComp.title, candidate.title);
    if (sim < TITLE_SIMILARITY_THRESHOLD) continue;
    if (!priceMatch(wpComp.soldPrice, candidate.soldPrice)) continue;
    if (!dateMatch(wpComp.soldDate, candidate.soldDate)) continue;

    const score = sim + (priceMatch(wpComp.soldPrice, candidate.soldPrice) ? 0.3 : 0) +
                  (dateMatch(wpComp.soldDate, candidate.soldDate) ? 0.2 : 0);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  return bestMatch;
}

/**
 * Merge WorthPoint data into an eBay record.
 * WP provides: historical images, preserved descriptions, WP category.
 * eBay provides: condition, seller, shipping, eBay item ID.
 * Merged record keeps the eBay item ID and fills in gaps from WP.
 */
async function mergeComps(wpComp, ebayComp) {
  const updates = {};

  // WP fills gaps in eBay record
  if (!ebayComp.imageUrl && wpComp.imageUrl) updates.imageUrl = wpComp.imageUrl;
  if (!ebayComp.category && wpComp.category) updates.category = wpComp.category;
  if (!ebayComp.itemUrl && wpComp.itemUrl) updates.itemUrl = wpComp.itemUrl;

  if (Object.keys(updates).length > 0) {
    await prisma.soldComp.update({ where: { id: ebayComp.id }, data: updates });
  }

  // Mark the WP comp as merged by updating its ebayItemId to point to the eBay record
  // This prevents future re-matching
  await prisma.soldComp.update({
    where: { id: wpComp.id },
    data: { category: `MERGED:${ebayComp.ebayItemId}` },
  });

  return Object.keys(updates).length;
}

/**
 * Main merge loop.
 */
async function run() {
  console.log("Comp merger starting...");
  console.log(`Thresholds: title=${TITLE_SIMILARITY_THRESHOLD}, price=${PRICE_TOLERANCE * 100}%, date=${DATE_TOLERANCE_DAYS}d`);

  const wpCount = await prisma.soldComp.count({
    where: {
      ebayItemId: { startsWith: "wp-" },
      category: { not: { startsWith: "MERGED:" } },
    },
  });
  console.log(`WorthPoint comps to process: ${wpCount}\n`);

  let offset = 0;

  while (true) {
    const wpComps = await prisma.soldComp.findMany({
      where: {
        ebayItemId: { startsWith: "wp-" },
        category: { not: { startsWith: "MERGED:" } },
      },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      skip: offset,
    });

    if (wpComps.length === 0) break;

    for (const wpComp of wpComps) {
      stats.processed++;

      try {
        const match = await findEbayMatch(wpComp);

        if (match) {
          const fieldsUpdated = await mergeComps(wpComp, match);
          stats.merged++;
          if (stats.merged <= 10 || stats.merged % 50 === 0) {
            console.log(`  MERGED #${wpComp.id} → #${match.id} (${fieldsUpdated} fields) "${wpComp.title?.slice(0, 50)}"`);
          }
        } else {
          stats.noMatch++;
        }
      } catch (err) {
        stats.errors++;
      }
    }

    // If no merges happened in this batch, we need to skip past unmatched WP comps
    offset += wpComps.length;
    console.log(`Progress: ${stats.processed} processed, ${stats.merged} merged, ${stats.noMatch} no match, ${stats.errors} errors`);
  }

  console.log(`\nDone: ${JSON.stringify(stats)}`);
  await prisma.$disconnect();
}

// Also export for API use
async function getMergeStats() {
  const wpTotal = await prisma.soldComp.count({ where: { ebayItemId: { startsWith: "wp-" } } });
  const merged = await prisma.soldComp.count({ where: { category: { startsWith: "MERGED:" } } });
  const unmerged = wpTotal - merged;
  return { wpTotal, merged, unmerged };
}

module.exports = { run, getMergeStats, titleSimilarity, priceMatch, dateMatch };

// Run if called directly
if (require.main === module) {
  run().catch(console.error);
}
