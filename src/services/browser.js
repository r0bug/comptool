const { chromium } = require("playwright-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const path = require("path");

// Apply stealth plugin to avoid bot detection
chromium.use(StealthPlugin());

const USER_DATA_DIR = path.join(__dirname, "../../.browser-data");

let context = null;

async function launch() {
  if (context) return;

  context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1920, height: 1080 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.7632.6 Safari/537.36",
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
    bypassCSP: true,
    ignoreHTTPSErrors: true,
  });

  // Patch navigator.webdriver on every new page
  context.on("page", async (page) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      // Remove automation-related properties
      delete navigator.__proto__.webdriver;
    });
  });

  // Patch existing pages too
  for (const page of context.pages()) {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      delete navigator.__proto__.webdriver;
    });
  }

  console.log("Browser launched (headed) with persistent context");
}

async function getPage() {
  if (!context) throw new Error("Browser not launched");

  const pages = context.pages();
  if (pages.length > 0) return pages[0];
  return await context.newPage();
}

// Cache login status so we don't re-verify every poll
let verifiedLoggedIn = false;

async function getStatus() {
  if (!context) {
    verifiedLoggedIn = false;
    return { launched: false, loggedIn: false };
  }
  return { launched: true, loggedIn: verifiedLoggedIn };
}

/**
 * Actually verify login by navigating to eBay and checking if we land
 * on a logged-in page (not redirected to signin).
 */
async function verifyLogin() {
  if (!context) return false;
  try {
    const page = await getPage();
    await page.goto("https://www.ebay.com/mye/myebay/summary", {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    const url = page.url();
    verifiedLoggedIn = !url.includes("signin");
    return verifiedLoggedIn;
  } catch {
    verifiedLoggedIn = false;
    return false;
  }
}

function setLoggedIn(val) {
  verifiedLoggedIn = val;
}

/**
 * Navigate to eBay homepage, then click Sign In to avoid CAPTCHA
 * on the direct sign-in URL.
 */
async function openLoginPage() {
  if (!context) await launch();

  const page = await getPage();

  // Go to homepage first (no CAPTCHA)
  await page.goto("https://www.ebay.com", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(1000);

  // Click the "Sign in" link at the top
  try {
    await page.click('a[href*="signin"], a:has-text("Sign in")', { timeout: 5000 });
    await page.waitForTimeout(2000);
  } catch {
    // Fallback: navigate directly but through ebay.com referrer
    await page.goto("https://signin.ebay.com/ws/eBayISAPI.dll?SignIn", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
  }

  console.log("Login page loaded via homepage");
}

/**
 * Take a screenshot of the current browser page.
 * Returns a base64-encoded PNG.
 */
async function screenshot() {
  if (!context) throw new Error("Browser not launched");
  const page = await getPage();
  const buffer = await page.screenshot({ type: "png" });
  return buffer.toString("base64");
}

/**
 * Fill a form field.
 */
async function fillField(selector, value) {
  const page = await getPage();
  await page.fill(selector, value);
}

/**
 * Click a button/element by selector.
 */
async function clickElement(selector) {
  const page = await getPage();
  await page.click(selector);
  await page.waitForTimeout(2000);
}

/**
 * Click at specific x,y coordinates on the page.
 */
async function clickAt(x, y) {
  const page = await getPage();
  await page.mouse.click(x, y);
  await page.waitForTimeout(2000);
}

/**
 * Get the current page URL.
 */
async function getCurrentUrl() {
  if (!context) return null;
  const page = await getPage();
  return page.url();
}

/**
 * Import cookies from an array (e.g., exported from a real browser).
 */
async function importCookies(cookies) {
  if (!context) await launch();
  await context.addCookies(cookies);
  console.log(`Imported ${cookies.length} cookies`);
}

/**
 * Navigate to a URL.
 */
async function goto(url) {
  const page = await getPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
}

async function close() {
  if (context) {
    await context.close();
    context = null;
    verifiedLoggedIn = false;
    console.log("Browser closed");
  }
}

function isLaunched() {
  return context !== null;
}

module.exports = {
  launch,
  getPage,
  getStatus,
  openLoginPage,
  screenshot,
  fillField,
  clickElement,
  clickAt,
  getCurrentUrl,
  importCookies,
  verifyLogin,
  setLoggedIn,
  goto,
  close,
  isLaunched,
};
