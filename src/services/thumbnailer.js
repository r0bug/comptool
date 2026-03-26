/**
 * On-demand thumbnail generation with Sharp.
 * Generates 300px-wide WebP thumbnails from cached full-size images.
 * Thumbnails stored in data/images/thumbs/ with same filename + .webp
 */

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const IMAGE_DIR = path.join(__dirname, "../../data/images");
const THUMB_DIR = path.join(__dirname, "../../data/images/thumbs");
const THUMB_WIDTH = 300;

// Ensure thumb directory exists
if (!fs.existsSync(THUMB_DIR)) {
  fs.mkdirSync(THUMB_DIR, { recursive: true });
}

/**
 * Get or generate a thumbnail. Returns the thumb file path or null.
 */
async function getThumb(filename) {
  const thumbName = filename.replace(/\.[^.]+$/, "") + ".webp";
  const thumbPath = path.join(THUMB_DIR, thumbName);

  // Return cached thumb if exists
  if (fs.existsSync(thumbPath)) {
    return thumbPath;
  }

  // Find the original
  const originalPath = path.join(IMAGE_DIR, filename);
  if (!fs.existsSync(originalPath)) {
    return null;
  }

  // Generate thumbnail
  try {
    await sharp(originalPath)
      .resize(THUMB_WIDTH, null, { withoutEnlargement: true })
      .webp({ quality: 75 })
      .toFile(thumbPath);
    return thumbPath;
  } catch (err) {
    // Silently fail — serve original instead
    return null;
  }
}

/**
 * Backfill thumbnails for existing images.
 */
async function backfillThumbs(concurrency = 3) {
  const files = fs.readdirSync(IMAGE_DIR).filter((f) => !f.startsWith(".") && f !== "thumbs");
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  const queue = [...files];

  async function worker() {
    while (queue.length > 0) {
      const file = queue.shift();
      const thumbName = file.replace(/\.[^.]+$/, "") + ".webp";
      const thumbPath = path.join(THUMB_DIR, thumbName);

      if (fs.existsSync(thumbPath)) {
        skipped++;
        continue;
      }

      try {
        await sharp(path.join(IMAGE_DIR, file))
          .resize(THUMB_WIDTH, null, { withoutEnlargement: true })
          .webp({ quality: 75 })
          .toFile(thumbPath);
        generated++;
        if (generated % 100 === 0) {
          console.log(`Thumbnails: ${generated} generated, ${skipped} skipped, ${failed} failed`);
        }
      } catch {
        failed++;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  console.log(`Done: ${generated} generated, ${skipped} skipped, ${failed} failed`);
  return { generated, skipped, failed };
}

module.exports = { getThumb, backfillThumbs, THUMB_DIR };
