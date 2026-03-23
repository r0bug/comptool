const router = require("express").Router();
const browser = require("../services/browser");

// Launch browser
router.post("/launch", async (req, res) => {
  try {
    await browser.launch();
    res.json({ status: "launched" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get browser status
router.get("/status", async (req, res) => {
  try {
    const status = await browser.getStatus();
    const url = await browser.getCurrentUrl();
    res.json({ ...status, url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Open eBay login page
router.post("/login", async (req, res) => {
  try {
    await browser.openLoginPage();
    const screenshot = await browser.screenshot();
    res.json({ status: "login_page_opened", screenshot });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Take screenshot of current page
router.get("/screenshot", async (req, res) => {
  try {
    const screenshot = await browser.screenshot();
    const url = await browser.getCurrentUrl();
    res.json({ screenshot, url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fill a form field
router.post("/fill", async (req, res) => {
  try {
    const { selector, value } = req.body;
    if (!selector || value === undefined) {
      return res.status(400).json({ error: "selector and value required" });
    }
    await browser.fillField(selector, value);
    const screenshot = await browser.screenshot();
    res.json({ status: "filled", screenshot });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Click an element
router.post("/click", async (req, res) => {
  try {
    const { selector } = req.body;
    if (!selector) return res.status(400).json({ error: "selector required" });
    await browser.clickElement(selector);
    const screenshot = await browser.screenshot();
    const url = await browser.getCurrentUrl();
    res.json({ status: "clicked", screenshot, url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Click at x,y coordinates (for CAPTCHA, etc.)
router.post("/click-at", async (req, res) => {
  try {
    const { x, y } = req.body;
    if (x === undefined || y === undefined) {
      return res.status(400).json({ error: "x and y required" });
    }
    await browser.clickAt(x, y);
    const screenshot = await browser.screenshot();
    const url = await browser.getCurrentUrl();
    res.json({ status: "clicked", screenshot, url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Import cookies from real browser session
router.post("/import-cookies", async (req, res) => {
  try {
    // Accept either { cookies: [...] } or a bare array
    const cookies = Array.isArray(req.body) ? req.body : req.body.cookies;
    if (!cookies || !Array.isArray(cookies)) {
      return res.status(400).json({ error: "cookies array required" });
    }

    // Convert from EditThisCookie/cookie-editor format to Playwright format
    const playwrightCookies = cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain || ".ebay.com",
      path: c.path || "/",
      expires: c.expirationDate || c.expires || -1,
      httpOnly: c.httpOnly || false,
      secure: c.secure || false,
      sameSite: c.sameSite === "no_restriction" ? "None" : c.sameSite === "lax" ? "Lax" : "None",
    }));

    await browser.importCookies(playwrightCookies);

    // Actually verify login by navigating to My eBay
    const loggedIn = await browser.verifyLogin();
    const screenshot = await browser.screenshot();

    res.json({ status: "imported", count: playwrightCookies.length, loggedIn, screenshot });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Navigate to a URL
router.post("/goto", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "url required" });
    await browser.goto(url);
    const screenshot = await browser.screenshot();
    const currentUrl = await browser.getCurrentUrl();
    res.json({ screenshot, url: currentUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify login by navigating to My eBay
router.post("/verify", async (req, res) => {
  try {
    const loggedIn = await browser.verifyLogin();
    const screenshot = await browser.screenshot();
    res.json({ loggedIn, screenshot });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Evaluate JS on current page (dev tool)
router.post("/eval", async (req, res) => {
  try {
    const { script } = req.body;
    if (!script) return res.status(400).json({ error: "script required" });
    const page = await browser.getPage();
    const result = await page.evaluate((s) => {
      return new Function(s)();
    }, script);
    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Close browser
router.post("/close", async (req, res) => {
  try {
    await browser.close();
    res.json({ status: "closed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
