const browser = require("./browser");

/**
 * Search eBay sold comps via Seller Hub Research page.
 * Falls back to public sold search if Seller Hub fails.
 */
async function searchSoldComps(keyword, filters = {}, options = {}) {
  const { maxPages = 2, delayMs = 3000 } = options;

  // Try Seller Hub first (requires login)
  try {
    const status = await browser.getStatus();
    if (!status.loggedIn) {
      console.log("Not logged in — falling back to public sold search");
      return await searchPublicSold(keyword, filters, { maxPages, delayMs });
    }

    return await searchSellerHub(keyword, filters, { maxPages, delayMs });
  } catch (err) {
    console.warn("Seller Hub scrape failed, falling back:", err.message);
    return await searchPublicSold(keyword, filters, { maxPages, delayMs });
  }
}

/**
 * Seller Hub Research page scraper
 */
async function searchSellerHub(keyword, filters, options) {
  const { maxPages = 2, delayMs = 3000 } = options;
  const page = await browser.getPage();
  const allItems = [];

  const url = `https://www.ebay.com/sh/research?marketplace=EBAY-US&tabName=SOLD`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

  // Wait for the Terapeak search input to appear
  const searchInput = page.locator(
    'input[placeholder*="keyword" i], input[placeholder*="Enter keywords" i], input[placeholder*="UPC" i]'
  ).first();
  await searchInput.waitFor({ state: "visible", timeout: 15000 });
  await searchInput.click();
  await searchInput.fill(keyword);

  // Click the Research/Search button instead of pressing Enter
  const searchBtn = page.locator(
    'button:has-text("Research"), button:has-text("Search"), button[aria-label*="search" i], button[aria-label*="Research" i]'
  ).first();
  const btnVisible = await searchBtn.isVisible().catch(() => false);
  if (btnVisible) {
    await searchBtn.click();
  } else {
    await searchInput.press("Enter");
  }

  // Wait for results table to load
  await page.waitForTimeout(5000);

  for (let pageNum = 0; pageNum < maxPages; pageNum++) {
    const items = await parseSellerHubResults(page);
    if (items.length === 0) break;

    allItems.push(...items);
    console.log(`Seller Hub page ${pageNum + 1}: ${items.length} items`);

    // Check for next page
    if (pageNum < maxPages - 1) {
      const nextBtn = page.locator(
        'button[aria-label="Next page"], a[aria-label="Next page"], .pagination__next'
      ).first();
      const isVisible = await nextBtn.isVisible().catch(() => false);
      if (!isVisible) break;

      await nextBtn.click();
      await randomDelay(delayMs);
    }
  }

  return { items: allItems, source: "seller_hub" };
}

/**
 * Parse results from Seller Hub Research / Terapeak page.
 *
 * Table columns (by class suffix):
 *   0  product-info      — thumbnail + title link
 *   1  actions           — Edit / Sell Similar buttons
 *   2  avgSoldPrice      — price + listing type
 *   3  avgShippingCost   — shipping + free-shipping %
 *   4  totalSoldCount    — quantity sold
 *   5  totalSalesValue   — total sales $
 *   6  bids              — bid count or "-"
 *   7  dateLastSold      — date
 */
async function parseSellerHubResults(page) {
  return await page.evaluate(() => {
    const items = [];

    const rows = document.querySelectorAll(
      '.sold-result-table table tr:not(.research-table-header)'
    );

    rows.forEach((row) => {
      try {
        const cells = row.querySelectorAll("td");
        if (cells.length < 8) return;

        // Title from img alt or link text
        const productCell = row.querySelector('[class*="product-info"]');
        const linkEl = row.querySelector('a[href*="/itm/"]');
        const imgEl = row.querySelector("img");
        const title =
          imgEl?.alt?.trim() ||
          linkEl?.textContent?.trim() ||
          productCell?.textContent?.trim();
        if (!title || title.length < 3) return;

        // Item ID from link
        const href = linkEl?.href || "";
        const idMatch = href.match(/\/itm\/(\d+)/);
        const ebayItemId = idMatch
          ? idMatch[1]
          : `sh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        // Price (avgSoldPrice column)
        const priceCell = row.querySelector('[class*="avgSoldPrice"]');
        let soldPrice = 0;
        if (priceCell) {
          const priceMatch = priceCell.textContent.match(/\$?([\d,]+\.?\d*)/);
          if (priceMatch) soldPrice = parseFloat(priceMatch[1].replace(",", ""));
        }
        if (soldPrice === 0) return;

        // Listing type from format subtitle
        const formatEl = priceCell?.querySelector(".format");
        const listingType = formatEl?.textContent?.trim() || null;

        // Shipping (avgShippingCost column)
        const shipCell = row.querySelector('[class*="avgShippingCost"]');
        let shippingPrice = null;
        if (shipCell) {
          const shipText = shipCell.textContent || "";
          if (shipText.toLowerCase().includes("free")) {
            shippingPrice = 0;
          } else {
            const match = shipText.match(/\$?([\d,]+\.?\d*)/);
            if (match) shippingPrice = parseFloat(match[1].replace(",", ""));
          }
        }

        // Bids
        const bidsCell = row.querySelector('[class*="bids"]');
        let bidCount = null;
        if (bidsCell) {
          const bidMatch = bidsCell.textContent.match(/(\d+)/);
          if (bidMatch) bidCount = parseInt(bidMatch[1]);
        }

        // Date
        const dateCell = row.querySelector('[class*="dateLastSold"]');
        let soldDate = new Date().toISOString();
        if (dateCell) {
          const parsed = new Date(dateCell.textContent.trim());
          if (!isNaN(parsed.getTime())) soldDate = parsed.toISOString();
        }

        // Image
        const imageUrl = imgEl?.src ? `https:${imgEl.src}` : null;

        const totalPrice =
          shippingPrice !== null ? soldPrice + shippingPrice : soldPrice;

        items.push({
          ebayItemId,
          title,
          soldPrice,
          shippingPrice,
          totalPrice,
          condition: null,
          category: null,
          listingType,
          bidCount,
          seller: null,
          sellerFeedback: null,
          imageUrl,
          itemUrl: href || null,
          soldDate,
        });
      } catch {
        // Skip unparseable rows
      }
    });

    return items;
  });
}

/**
 * Public eBay sold search — fallback scraper.
 * Uses proven selectors from ListFlow soldData.service.ts.
 */
async function searchPublicSold(keyword, filters, options) {
  const { maxPages = 2, delayMs = 3000 } = options;
  const page = await browser.getPage();
  const allItems = [];

  const encodedQuery = encodeURIComponent(keyword);
  const baseUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}&_sacat=0&LH_Complete=1&LH_Sold=1&rt=nc`;

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    const pageUrl = pageNum === 1 ? baseUrl : `${baseUrl}&_pgn=${pageNum}`;

    await page.goto(pageUrl, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector(".srp-results", { timeout: 10000 }).catch(() => {});

    const items = await parsePublicSoldResults(page);
    if (items.length === 0) break;

    allItems.push(...items);
    console.log(`Public sold page ${pageNum}: ${items.length} items`);

    // Check for next page
    const hasNext = await page.$(".pagination__next");
    if (!hasNext) break;

    if (pageNum < maxPages) await randomDelay(delayMs);
  }

  return { items: allItems, source: "public_sold" };
}

/**
 * Parse results from public eBay sold search.
 * Selectors ported from ListFlow soldData.service.ts.
 */
async function parsePublicSoldResults(page) {
  return await page.evaluate(() => {
    const items = [];
    const listingElements = document.querySelectorAll(".s-item");

    listingElements.forEach((element) => {
      try {
        const titleEl = element.querySelector(".s-item__title");
        if (!titleEl || titleEl.textContent?.includes("Shop on eBay")) return;

        // Item ID from link
        const linkEl = element.querySelector(".s-item__link");
        const itemUrl = linkEl?.href || "";
        const idMatch = itemUrl.match(/\/itm\/(\d+)/);
        const ebayItemId = idMatch
          ? idMatch[1]
          : `pub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const title = titleEl?.textContent?.trim() || "";

        // Price
        const priceEl = element.querySelector(".s-item__price");
        let soldPrice = 0;
        if (priceEl) {
          const priceMatch = priceEl.textContent.match(/\$?([\d,]+\.?\d*)/);
          if (priceMatch) soldPrice = parseFloat(priceMatch[1].replace(",", ""));
        }
        if (soldPrice === 0) return;

        // Shipping
        const shippingEl = element.querySelector(
          ".s-item__shipping, .s-item__freeXDays"
        );
        let shippingPrice = null;
        if (shippingEl) {
          const text = shippingEl.textContent || "";
          if (text.toLowerCase().includes("free")) {
            shippingPrice = 0;
          } else {
            const match = text.match(/\$?([\d,]+\.?\d*)/);
            if (match) shippingPrice = parseFloat(match[1].replace(",", ""));
          }
        }

        // Condition
        const condEl = element.querySelector(".SECONDARY_INFO");
        const condition = condEl?.textContent?.trim() || null;

        // Seller
        const sellerEl = element.querySelector(".s-item__seller-info-text");
        let seller = null;
        let sellerFeedback = null;
        if (sellerEl) {
          const text = sellerEl.textContent || "";
          const sellerMatch = text.match(/^([^(]+)/);
          seller = sellerMatch ? sellerMatch[1].trim() : null;
          const fbMatch = text.match(/\((\d+)\)/);
          sellerFeedback = fbMatch ? parseInt(fbMatch[1]) : null;
        }

        // Listing type / bids
        const bidEl = element.querySelector(".s-item__bids");
        let listingType = "buy_it_now";
        let bidCount = null;
        if (bidEl) {
          listingType = "auction";
          const bidMatch = bidEl.textContent?.match(/(\d+)\s*bid/);
          bidCount = bidMatch ? parseInt(bidMatch[1]) : null;
        }

        // Image
        const imgEl = element.querySelector(".s-item__image-img");
        const imageUrl = imgEl?.src || null;

        // Sold date
        const dateEl = element.querySelector(
          ".s-item__caption--signal, .POSITIVE"
        );
        let soldDate = new Date().toISOString();
        if (dateEl) {
          const dateMatch = dateEl.textContent?.match(/Sold\s+(.+)/i);
          if (dateMatch) {
            const parsed = new Date(dateMatch[1]);
            if (!isNaN(parsed.getTime())) soldDate = parsed.toISOString();
          }
        }

        const totalPrice =
          shippingPrice !== null ? soldPrice + shippingPrice : soldPrice;

        items.push({
          ebayItemId,
          title,
          soldPrice,
          shippingPrice,
          totalPrice,
          condition,
          category: null,
          listingType,
          bidCount,
          seller,
          sellerFeedback,
          imageUrl,
          itemUrl: itemUrl || null,
          soldDate,
        });
      } catch {
        // Skip unparseable items
      }
    });

    return items;
  });
}

function randomDelay(baseMs) {
  const jitter = Math.floor(Math.random() * 2000);
  return new Promise((resolve) => setTimeout(resolve, baseMs + jitter));
}

module.exports = { searchSoldComps };
