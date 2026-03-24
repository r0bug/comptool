# CompTool — eBay Sold Comps Research Tool
### Beta Release 1 (v1.6.0) — 2026-03-24

Research what items sell for on eBay by scraping Terapeak and eBay sold search data via a Chrome extension, storing everything in PostgreSQL, and providing a rich searchable dashboard with price analytics.

**Live:** [listflow.robug.com/comp](https://listflow.robug.com/comp)

## How It Works

1. **Install the Chrome extension** — it injects into eBay Terapeak Research and sold search pages
2. **Browse eBay normally** — the extension auto-imports sold comps as you search (Terapeak, sold items filter, seller stores)
3. **Browse your data** at the web dashboard — rich pivot search with exclude terms, scalable tile/table views, price stats
4. **Build a pricing database** — every comp is stored with images cached locally, progressively enriched across sources

## Features

### Chrome Extension (v1.6.0)
- Manifest V3 content scripts on **Terapeak Research** and **eBay sold search** pages
- **Auto-import** — comps save automatically when results load (toggle on/off)
- Works on: keyword search + sold filter, seller store pages, category pages, filtered views
- Captures: title, price, shipping, condition, seller, feedback, bids, quantity sold, total sales, watchers, images, sold date
- **Smart keyword detection** — extracts from URL params, seller name, page heading, breadcrumbs, or page title
- Machine ID tracking per installation, configurable API URL/key
- Self-update version checking from server

### Browse & Search
- **Boolean search builder** — multi-row query with AND/OR/NOT operators, "+ Add Term" to build complex queries
- **Sidebar facets** — drillable category hierarchy, condition counts, listing type counts — click to filter instantly
- **Exclude terms** — filter OUT unwanted keywords (comma or space separated)
- **Advanced filters** — price range, condition, category, listing type, seller, date range, has image, detailed only
- **Right-click context menu** — Sell Similar on eBay, Copy URL/Item ID/Title, Search Seller's sold items
- **Configurable table columns** — toggle any of 15 columns on/off (Qty Sold, Total Sales, Watchers, Seller, Feedback, Item ID, etc.)
- **Scalable tile view** — desktop: pixel-size slider (140–400px). Mobile: 1/2/3/4 column buttons
- **Active filter pills** — visual feedback with one-click removal per filter
- **Deduplication** — cross-client duplicates automatically merged in results
- **9 sort options** — newest, oldest, price high/low, total high/low, title A-Z, recently added
- **Full pagination** — page size selector (25/50/100/200), numbered pages with first/last

### Image System
- **Lightbox** — click any image to zoom (scroll 0.25x–5x), drag to pan, keyboard shortcuts
- **Image caching** — downloads eBay images locally before URLs expire
- **Backfill** — bulk cache all uncached images via API endpoint

### Smart Data Enrichment
- **Progressive upsert** — same item scraped from multiple sources gets enriched, never overwritten with nulls
- **Terapeak** captures: title, price, shipping, listing type, bids, quantity sold, total sales, image, date
- **Sold search** captures: all of above + condition, seller, feedback, watchers, full category path
- **eBay API enricher** — background worker uses ListFlow's eBay Browse API to backfill category, condition, seller for existing comps
- **HTML enricher** — fallback scraper fetches item pages directly for additional details
- **Category hierarchy** — full breadcrumb paths (e.g. "eBay Motors > Parts & Accessories > Motorcycle Parts")
- **Junk filtering** — rejects malformed categories ("More", "ebay.com(NNN)", etc.)

### SaaS-Ready Client Management
- Multi-tenant with Client, ApiKey, Machine models
- **Admin panel** — dashboard stats, client CRUD, generate/revoke API keys, view machines and usage
- **Registration portal** — public signup form issues `ct_` prefixed API keys
- Database-backed auth with usage tracking, backward-compatible env fallback
- Plan tiers (free/pro/enterprise) and billing placeholders (Stripe)

### Stats & Analytics
- Price statistics per search: avg, median, min, max, percentiles, count
- Global stats in footer: total comps, searches, cached images, storage used
- Search history with per-search stats

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Express 5, Node.js |
| Database | PostgreSQL + Prisma 6 |
| Frontend | React 19, Vite 5 |
| Extension | Chrome Manifest V3, vanilla JS |
| Scraping | Chrome extension content script (replaces Playwright) |
| Images | Local cache with backfill service |

## Project Structure

```
comptool/
├── src/
│   ├── index.js                 # Express server
│   ├── middleware/
│   │   ├── apiKey.js            # DB-backed API key auth
│   │   └── adminAuth.js         # Admin password auth
│   ├── routes/
│   │   ├── api.js               # Route mounting
│   │   ├── ingest.js            # POST /comp/api/ingest (extension → DB)
│   │   ├── search.js            # Search history + scrape triggers
│   │   ├── comps.js             # Comp listing, filtering, stats
│   │   ├── admin.js             # Client/key management
│   │   ├── clients.js           # Public registration
│   │   ├── images.js            # Image cache status + backfill
│   │   └── browser.js           # Legacy Playwright controls
│   └── services/
│       ├── compStore.js         # Prisma CRUD, dedup, stats
│       ├── clientStore.js       # Client/key/machine CRUD
│       ├── imageCache.js        # Download + cache eBay images
│       ├── scraper.js           # Legacy Terapeak scraper
│       └── browser.js           # Legacy Playwright browser
├── client/                      # React frontend (Vite)
│   └── src/
│       ├── pages/
│       │   ├── SearchPage.jsx       # Landing with extension install guide
│       │   ├── BrowsePage.jsx       # Search/filter all comps
│       │   ├── HistoryPage.jsx      # Past searches
│       │   ├── admin/               # Admin panel (dashboard, clients)
│       │   └── register/            # Public registration portal
│       └── components/
│           ├── CompTable.jsx        # Sortable table with image lightbox
│           ├── CompTiles.jsx        # Tile grid with hover details
│           ├── ImageLightbox.jsx    # Full-size zoom/pan viewer
│           ├── StatsBar.jsx         # Price statistics cards
│           └── Layout.jsx           # App shell with nav
├── extension/                   # Chrome extension
│   ├── manifest.json
│   ├── content.js               # Terapeak scraper + auto-import
│   ├── content.css
│   ├── popup.html/js            # Status + recent searches
│   └── options.html/js          # API URL, key, auto-import toggle
├── prisma/
│   └── schema.prisma            # Client, ApiKey, Machine, SoldComp, Search
└── data/images/                 # Cached eBay product images
```

## Setup

```bash
# Backend
cp .env.example .env             # Edit with your Postgres credentials
npm install
npx prisma db push
npx prisma generate
npm run dev                      # Starts on port 3002

# Frontend (dev)
cd client && npm install
npx vite --port 5173             # Proxies /comp/api to port 3002

# Chrome Extension
# 1. Open chrome://extensions/
# 2. Enable Developer mode
# 3. Load unpacked → select extension/ folder
# 4. Click extension → Settings → set API URL and key
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/comp/api/ingest` | API Key | Bulk ingest comps from extension |
| GET | `/comp/api/comps` | None | List/search comps with filters |
| GET | `/comp/api/comps/stats?keyword=` | None | Price statistics for keyword |
| GET | `/comp/api/search/history` | None | Past searches |
| GET | `/comp/api/search/:id` | None | Search detail with comps |
| POST | `/comp/api/clients/register` | None | Register new client, get API key |
| POST | `/comp/api/admin/auth` | Admin PW | Validate admin password |
| GET | `/comp/api/admin/dashboard` | Admin PW | System stats |
| GET | `/comp/api/admin/clients` | Admin PW | List clients |
| GET | `/comp/api/comps/facets` | None | Category, condition, type counts for sidebar |
| POST | `/comp/api/clients/recover` | None | Generate new key for email recovery |
| GET | `/comp/api/stats` | None | Global stats (comp count, storage) |
| GET | `/comp/api/enricher/status` | None | Background enricher progress |
| GET | `/comp/api/extension/version` | None | Current extension version for auto-update |
| POST | `/comp/api/images/backfill` | None | Cache uncached eBay images |

## Deployment

Deployed at `listflow.robug.com/comp` via nginx reverse proxy to port 3002, managed by PM2.

```bash
# On the server
git pull origin main
cd client && npm run build && cd ..
pm2 restart comptool
```

## Related Docs

- [PLATFORM-SPEC.md](PLATFORM-SPEC.md) — Full platform architecture for unified Yakima Finds reseller system
- [UNIVERSAL-ITEM-SCHEMA.md](UNIVERSAL-ITEM-SCHEMA.md) — Cross-platform item schema (CompTool + ListFlow + Yakcat)
- [CHANGELOG-2026-03-23.md](CHANGELOG-2026-03-23.md) — Changes from 2026-03-23
