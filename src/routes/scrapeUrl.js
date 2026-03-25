/**
 * Server-side scraping — accepts an eBay URL, fetches the page,
 * extracts sold comps, saves to database. Works from any device
 * since the server does the scraping, not the browser.
 */
const router = require("express").Router();
const compStore = require("../services/compStore");

// POST /comp/api/scrape-url
// Body: { url: "https://www.ebay.com/sch/...", apiKey: "ct_..." }
router.post("/", async (req, res) => {
  try {
    const { url, apiKey } = req.body;

    if (!url || !url.includes("ebay.com")) {
      return res.status(400).json({ error: "Valid eBay URL required" });
    }
    if (!apiKey) {
      return res.status(400).json({ error: "API key required" });
    }

    // Validate API key
    const clientStore = require("../services/clientStore");
    const key = await clientStore.lookupApiKey(apiKey);
    if (!key || !key.isActive || !key.client?.isActive) {
      return res.status(401).json({ error: "Invalid API key" });
    }
    const clientId = key.clientId;
    clientStore.trackApiKeyUsage(key.id);

    // Fetch the eBay page
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(20000),
      redirect: "follow",
    });

    if (!resp.ok) {
      return res.status(502).json({ error: `eBay returned ${resp.status}` });
    }

    const html = await resp.text();
    const items = parseEbayHtml(html, url);

    if (items.length === 0) {
      return res.json({ resultCount: 0, message: "No sold items found on that page. Make sure the URL has LH_Sold=1 or is a sold items search." });
    }

    // Extract keyword from URL
    const urlObj = new URL(url);
    const keyword = urlObj.searchParams.get("_nkw") || "url-import";

    const search = await compStore.saveSearch(keyword, null, clientId);
    await compStore.updateSearch(search.id, { source: "url-scrape" });
    await compStore.saveComps(search.id, items, clientId);
    const result = await compStore.getSearch(search.id);

    res.json({
      searchId: search.id,
      resultCount: result.resultCount,
      keyword,
      stats: {
        avg: result.avgPrice,
        median: result.medianPrice,
        min: result.minPrice,
        max: result.maxPrice,
      },
    });
  } catch (err) {
    console.error("Scrape URL error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Parse eBay search HTML for sold items.
 * Works with both old .s-item and new .s-card layouts.
 */
function parseEbayHtml(html, url) {
  const items = [];

  // Extract category from breadcrumbs in HTML
  let pageCategory = null;
  const breadcrumbMatch = html.match(/<nav[^>]*breadcrumb[^>]*>([\s\S]*?)<\/nav>/i);
  if (breadcrumbMatch) {
    const links = [...breadcrumbMatch[1].matchAll(/<a[^>]*href="[^"]*\/(\d+)\/[^"]*"[^>]*>([^<]+)<\/a>/g)];
    const junk = ["eBay", "All", "More", "See All", "Back", ""];
    const path = links.map(m => m[2].trim()).filter(t => t && !junk.includes(t) && t.length > 1 && t.length < 80);
    if (path.length > 0) {
      pageCategory = path.slice(0, Math.min(path.length, 4)).join(" > ");
    }
  }

  // Try .s-card pattern first (2026 eBay), then .s-item
  // Use regex since we don't have DOM on the server
  const cardPattern = /<li[^>]*class="[^"]*s-card[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  const itemPattern = /<li[^>]*class="[^"]*s-item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;

  const cards = [...html.matchAll(cardPattern), ...html.matchAll(itemPattern)];

  for (const match of cards) {
    try {
      const card = match[1];

      // Title
      const titleMatch = card.match(/class="[^"]*title[^"]*"[^>]*>([^<]+)/i) ||
                         card.match(/role="heading"[^>]*>([^<]+)/i);
      if (!titleMatch) continue;
      const title = titleMatch[1].trim();
      if (!title || title.length < 3 || title.includes("Shop on eBay")) continue;

      // Item URL + ID
      const linkMatch = card.match(/href="(https?:\/\/www\.ebay\.com\/itm\/(\d+)[^"]*)"/i);
      const ebayItemId = linkMatch ? linkMatch[2] : `srv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const itemUrl = linkMatch ? linkMatch[1] : null;

      // Price
      const priceMatch = card.match(/\$\s*([\d,]+\.?\d*)/);
      if (!priceMatch) continue;
      const soldPrice = parseFloat(priceMatch[1].replace(",", ""));
      if (soldPrice === 0) continue;

      // Shipping
      let shippingPrice = null;
      if (/free\s*(delivery|shipping)/i.test(card)) {
        shippingPrice = 0;
      } else {
        const shipMatch = card.match(/\+?\$?([\d,]+\.?\d*)\s*(delivery|shipping)/i);
        if (shipMatch) shippingPrice = parseFloat(shipMatch[1].replace(",", ""));
      }

      // Condition
      const condMatch = card.match(/class="[^"]*(?:SECONDARY_INFO|condition|subtitle)[^"]*"[^>]*>([^<]+)/i);
      const condition = condMatch ? condMatch[1].trim() : null;

      // Listing type
      let listingType = "Fixed price";
      let bidCount = null;
      const bidMatch = card.match(/(\d+)\s*bid/i);
      if (bidMatch) {
        listingType = "Auction";
        bidCount = parseInt(bidMatch[1]);
      }

      // Image
      const imgMatch = card.match(/src="(https:\/\/i\.ebayimg\.com\/[^"]+)"/i);
      const imageUrl = imgMatch ? imgMatch[1] : null;

      // Sold date
      let soldDate = new Date().toISOString();
      const dateMatch = card.match(/Sold\s+(\w+\s+\d+,?\s*\d{4})/i);
      if (dateMatch) {
        const parsed = new Date(dateMatch[1]);
        if (!isNaN(parsed.getTime())) soldDate = parsed.toISOString();
      }

      const totalPrice = shippingPrice !== null ? soldPrice + shippingPrice : soldPrice;

      items.push({
        ebayItemId,
        title,
        soldPrice,
        shippingPrice,
        totalPrice,
        condition,
        category: pageCategory,
        listingType,
        bidCount,
        seller: null,
        sellerFeedback: null,
        imageUrl,
        itemUrl,
        soldDate,
      });
    } catch {
      continue;
    }
  }

  return items;
}

module.exports = router;
