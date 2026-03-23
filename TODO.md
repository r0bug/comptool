# CompTool TODO

## High Priority

### Self-Healing Selector Monitor
**Problem:** eBay changes their DOM class names without warning (e.g., `.s-item` → `.s-card` in 2026). When this happens, the Chrome extension silently fails to scrape results.

**Solution:** Build a selector health-check and auto-repair system:

1. **Selector Test Endpoint** (`POST /comp/api/selectors/test`) — Accepts a URL and list of expected selectors. Uses Claude Opus (via Anthropic API, key from ListFlow `.env`) to analyze the page HTML and suggest updated selectors when existing ones fail.

2. **Extension Selector Versioning** — The extension fetches its selectors from the server at startup instead of having them hardcoded. Server stores the current working selectors in the database.

3. **Failure Detection** — When `scrapeResults()` returns 0 items but the page clearly has results (detected via `.srp-results li` count > 0 or similar generic check), the extension:
   - Reports the failure to the server with the page's outer HTML structure (class names, tag hierarchy — not content/PII)
   - Server calls Claude Opus to analyze the HTML diff and propose new selectors
   - Admin reviews and approves new selectors
   - Extension picks up the updated selectors on next load

4. **Automated Regression Check** — Cron job or scheduled task that loads a known eBay sold search URL (via headless fetch or Playwright on the server), runs the current selectors against it, and alerts if zero results are returned.

**API Key:** Use `ANTHROPIC_API_KEY` from ListFlow's `.env` on list.robug.com (already configured for AI features).

**Files to modify:**
- `extension/content-sold.js` — Fetch selectors from server, report failures
- `extension/content.js` — Same for Terapeak selectors
- `src/routes/selectors.js` — New route for selector management
- `src/services/selectorRepair.js` — Claude API integration for selector analysis
- `prisma/schema.prisma` — Add `SelectorConfig` model

---

## Medium Priority

### Chrome Extension Enhancements
- [ ] Overlay comp data when browsing individual eBay listings
- [ ] "List Similar" button to push item to ListFlow
- [ ] Multi-page auto-scraping (paginate through all Terapeak results)
- [ ] Context menu: right-click listing → "Save to CompTool"
- [ ] Badge showing unsaved result count

### Integration
- [ ] ListFlow → CompTool: When a listing sells, auto-create sold comp record
- [ ] CompTool → ListFlow: Price advisor using comp stats during listing workflow
- [ ] Yakcat → ListFlow: Push catalog items to listing workflow
- [ ] Webhook notifications for status changes

### Image Pipeline
- [ ] Sharp processing (resize/thumbnail/webp) instead of storing full-size
- [ ] Storage adapter pattern (local → S3/R2)
- [ ] Public image URLs for eBay listing embeds (replace pics.yakimafinds.com)

## Low Priority

### SaaS / Billing
- [ ] Stripe integration
- [ ] Usage-based billing
- [ ] Tier enforcement (rate limits, storage caps)
- [ ] Public marketing pages

### Platform Consolidation
- [ ] Monorepo scaffold (see PLATFORM-SPEC.md)
- [ ] Unified auth (Better Auth)
- [ ] Domain-based architecture migration
