# CompTool — eBay Sold Comps Research Tool

Research what items sell for on eBay by scraping Terapeak/Seller Hub data via a Chrome extension, storing everything in PostgreSQL, and providing a searchable dashboard with price analytics.

## How It Works

1. **Install the Chrome extension** — it injects into eBay's Terapeak Research page
2. **Search on Terapeak** — the extension auto-imports results (or click "Save Comps")
3. **Browse your data** at the web dashboard — search, filter, tile/table views, price stats
4. **Build a pricing database** — every comp is stored with images cached locally

## Features

- **Chrome Extension (v1.2)** — Manifest V3 content script on Terapeak pages. Auto-imports comps when results load. Configurable API URL/key. Machine ID tracking per installation.
- **Browse Page** — Search all comps with keyword, price range, condition, and listing type filters. Table and tile views with server-side sorting and pagination.
- **Tile View** — Image grid with price badges. Hover for full details (title, price, shipping, type, date). Copy URL / item number for sell-similar.
- **Image Lightbox** — Click any comp image to view full-size. Scroll to zoom (up to 5x), drag to pan.
- **Image Caching** — eBay image URLs expire; CompTool downloads and caches them locally so you never lose product photos.
- **Price Statistics** — Avg, median, min, max, percentiles per search keyword.
- **Search History** — Every scrape is logged with result count and computed stats.
- **Client Management (SaaS-ready)** — Multi-tenant with Client, ApiKey, Machine models. Admin panel for managing clients, generating/revoking API keys, viewing usage.
- **Registration Portal** — Public signup form issues API keys for new users.
- **API Key Auth** — Database-backed key validation with usage tracking. Backward-compatible env fallback.

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
