const fs = require("fs");
const path = require("path");
const prisma = require("../config/database");

const IMAGE_DIR = path.join(__dirname, "../../data/images");

// Ensure directory exists
if (!fs.existsSync(IMAGE_DIR)) {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
}

/**
 * Download and cache an image for a comp.
 * Returns the local filename or null on failure.
 */
async function cacheImage(comp) {
  if (!comp.imageUrl) return null;
  if (comp.localImage) return comp.localImage; // already cached

  try {
    const url = comp.imageUrl.startsWith("//")
      ? `https:${comp.imageUrl}`
      : comp.imageUrl;

    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return null;

    const contentType = resp.headers.get("content-type") || "";
    const ext = contentType.includes("png") ? ".png"
      : contentType.includes("webp") ? ".webp"
      : ".jpg";

    const filename = `${comp.ebayItemId}${ext}`;
    const filepath = path.join(IMAGE_DIR, filename);

    const buffer = Buffer.from(await resp.arrayBuffer());
    fs.writeFileSync(filepath, buffer);

    // Update the database
    await prisma.soldComp.update({
      where: { id: comp.id },
      data: { localImage: filename },
    });

    return filename;
  } catch {
    return null;
  }
}

/**
 * Cache images for an array of comps. Runs with concurrency limit.
 */
async function cacheImages(comps, concurrency = 5) {
  let cached = 0;
  let failed = 0;
  const queue = [...comps.filter((c) => c.imageUrl && !c.localImage)];

  async function worker() {
    while (queue.length > 0) {
      const comp = queue.shift();
      const result = await cacheImage(comp);
      if (result) cached++;
      else failed++;
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () => worker());
  await Promise.all(workers);

  return { cached, failed, skipped: comps.length - cached - failed };
}

/**
 * Backfill all comps that have imageUrl but no localImage.
 */
async function backfillImages(batchSize = 100, concurrency = 5) {
  let total = 0;
  let offset = 0;

  while (true) {
    const comps = await prisma.soldComp.findMany({
      where: {
        imageUrl: { not: null },
        localImage: null,
      },
      take: batchSize,
      skip: offset,
    });

    if (comps.length === 0) break;

    const { cached, failed } = await cacheImages(comps, concurrency);
    total += cached;
    console.log(`Batch: ${cached} cached, ${failed} failed (${total} total so far)`);

    // If all failed, something is wrong — stop
    if (cached === 0 && failed === comps.length) break;

    // Don't increment offset for failed ones — they'll be skipped by localImage: null check
    // Actually we need to skip past them
    offset += failed;
  }

  return total;
}

module.exports = { cacheImage, cacheImages, backfillImages, IMAGE_DIR };
