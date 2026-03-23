# Yakima Finds Reseller Platform — Full System Specification
**Date:** 2026-03-23
**Author:** r0bug + Claude
**Status:** Draft — Architecture & Recommendations

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current System Inventory](#2-current-system-inventory)
3. [What Works, What Doesn't](#3-what-works-what-doesnt)
4. [Domain Architecture](#4-domain-architecture)
5. [Recommended Monorepo Structure](#5-recommended-monorepo-structure)
6. [Recommended Tech Stack](#6-recommended-tech-stack)
7. [Authentication & Authorization](#7-authentication--authorization)
7. [Universal Item Schema](#7-universal-item-schema)
8. [Platform Services](#8-platform-services)
9. [Chrome Extension](#9-chrome-extension)
10. [Image Pipeline](#10-image-pipeline)
11. [SaaS & Multi-Tenancy](#11-saas--multi-tenancy)
12. [Billing & Usage](#12-billing--usage)
13. [Deployment & Infrastructure](#13-deployment--infrastructure)
14. [Migration Strategy](#14-migration-strategy)
15. [Phase Roadmap](#15-phase-roadmap)

---

## 1. Executive Summary

We have four tools built over time to support an eBay reselling operation. They were built independently, on different stacks, deployed across multiple servers, with no shared authentication or data model. They work — but they don't work together.

This spec proposes a unified platform that consolidates all four tools under a single codebase, a single auth system, and a single item schema. The goal is not to throw away what works, but to give it a shared skeleton so data flows naturally between intake, research, listing, selling, and tracking.

The platform serves multiple user types: the store owner running the operation, staff handling intake and photography, vendors consigning items, and eventually external clients who want to use the comp research tools as a SaaS product.

---

## 2. Current System Inventory

### 2.1 ListFlow (`r0bug/listflow`)

**What it does:** Full eBay listing workflow — photograph items, run them through AI for title/description generation, price them using sold comp data, and push live listings to eBay via the Trading API. Supports multiple eBay accounts, sell-similar from existing listings, and item specifics management.

**Stack:** TypeScript, Express 5, Prisma 6, PostgreSQL, React 19 + Vite, Zustand, TanStack Query, TailwindCSS, Sharp for images, Bull/Redis for job queues, `@hendt/ebay-api` for eBay integration, OpenAI for AI analysis.

**Deployed:** `list.robug.com` — Express API on port 3001, Vite preview on port 5173, nginx reverse proxy with SSL, PM2 process management.

**Database:** PostgreSQL on localhost:5432, database `listflow`, schema `public`.

**Git:** `r0bug/listflow`, active `customizations` branch 9 commits ahead of `main`. Clean, well-maintained history.

**Strengths:**
- Most mature codebase, TypeScript, good architecture
- Full eBay API integration (list, revise, verify, sell-similar)
- AI-powered photo analysis and listing generation
- Multi-stage workflow with completeness tracking
- Item specifics fetched from eBay Taxonomy API per category
- Docker configuration exists (though not used in production)

**Weaknesses:**
- TypeScript strict mode is OFF (`"strict": false, "noImplicitAny": false`) — this undermines half the value of using TypeScript
- Auth is bare-bones JWT with no refresh tokens, no session management
- No multi-tenant support — single-user assumed
- Frontend is functional but not production-polished
- Redis/Bull queue is configured but underutilized
- Sold comp research is a bolt-on (Playwright scraping) rather than a first-class feature

### 2.2 CompTool (`r0bug/comptool`)

**What it does:** eBay sold comps research tool. Originally used Playwright to scrape eBay's Terapeak/Seller Hub Research page, now primarily uses a Chrome extension that injects into Terapeak and posts scraped data back to the API. Stores all comps in PostgreSQL with search history, price statistics, and image caching. Has a React dashboard for browsing/filtering comps and an admin panel for managing API clients.

**Stack:** JavaScript (plain, not TypeScript), Express 5, Prisma 6, PostgreSQL, React + Vite, Playwright (legacy, being phased out).

**Deployed:** `listflow.robug.com/comp` — Express on port 3002 behind same nginx, PM2 managed. Shares the same PostgreSQL server as ListFlow but uses a separate `comptool` schema.

**Database:** PostgreSQL on localhost:5432, database `listflow`, schema `comptool`.

**Git:** `r0bug/comptool`, single commit on `main` as of today.

**Strengths:**
- Chrome extension approach is brilliant — no bot detection, no cookie importing, uses the real browser session
- SaaS-ready client management (Client, ApiKey, Machine models)
- Image caching prevents eBay URL expiration
- Clean ingest API that anything can post to
- Browse page with full-text search, price filters, pagination

**Weaknesses:**
- Plain JavaScript — no type safety, no IDE completion, easy to introduce bugs
- Frontend is functional but minimal (inline styles, no component library)
- The Playwright scraper code is complex and fragile, kept as legacy
- No shared auth with ListFlow — completely separate user/client systems
- Image caching is naive (downloads full-size images, no resize/optimize)

### 2.3 Yakcat / WebCat (`r0bug/Yakcat`)

**What it does:** Web-based consignment catalog. Vendors list items with photos, buyers browse and contact sellers. Think Craigslist meets a consignment mall directory. Supports vendor accounts, item management, tags, messaging, forums, and event listings.

**Stack:** Next.js 15 (App Router, Turbopack), React 19, TypeScript, Prisma 6, PostgreSQL (Neon cloud), TailwindCSS, Uploadthing for images, JWT auth, deployed on Vercel.

**Deployed:** `webcat.yakimafinds.com` on Vercel.

**Database:** Neon cloud PostgreSQL.

**Git:** `r0bug/Yakcat`. This is "Webcat Rebuild on a better stack" — third iteration. Previous versions (v1 with Sequelize/MySQL, v2 with Express/Prisma) exist on the backoffice server but are effectively deprecated.

**Strengths:**
- Cleanest, most modern codebase (Next.js 15 with App Router)
- TypeScript with strict mode ON
- Vercel deployment is zero-ops
- Clean user role system (ADMIN, STAFF, VENDOR)
- Uploadthing integration is simple and reliable
- Slug-based item URLs are SEO-friendly

**Weaknesses:**
- Extremely simple item model — no condition, no category hierarchy, no SKU, no weight/dimensions
- No eBay integration whatsoever
- No pricing intelligence
- Auth is a custom JWT implementation alongside next-auth (confusing dual system)
- Limited to a local consignment use case — can't scale to multi-store or SaaS
- Image handling has no optimization, no thumbnails, no variants
- Two previous versions were abandoned — pattern suggests this one might be too

### 2.4 Pics / Image Tool (`pics.yakimafinds.com`)

**What it does:** Simple file upload and browsing tool for eBay listing photos. Drag-and-drop upload, folder organization, public image URLs for embedding in eBay listings.

**Stack:** PHP, running on a separate DigitalOcean droplet (147.182.253.255).

**Deployed:** `pics.yakimafinds.com`, standalone server.

**Strengths:**
- It works. Photos go up, URLs come out.
- Public URLs are embeddable in eBay listings.

**Weaknesses:**
- PHP on a separate server with no connection to anything else
- No image processing (no resize, no thumbnails, no optimization)
- No metadata — images aren't linked to items, just organized in folders
- No auth integration — separate login
- Maintenance liability — whole separate server for what should be a feature

### 2.5 Chrome Extension (inside CompTool)

**What it does:** Manifest V3 content script that injects a "Save Comps" button on eBay's Terapeak Research page. Scrapes the results table and posts structured data to the CompTool API. Also has a popup showing connection status and recent searches, and an options page for API configuration.

**Stack:** Vanilla JS, Chrome Extension APIs, Manifest V3.

**Strengths:**
- Solves the hardest problem (scraping eBay) by being part of the real browser
- Machine ID tracking for per-installation identification
- Self-update version checking from the server
- Clean, lightweight, no build step needed

**Weaknesses:**
- Only scrapes Terapeak — could also scrape listing pages, search results, seller dashboards
- No way to push data TO the browser (e.g., overlay comp data while browsing eBay)
- Settings must be configured manually per installation

---

## 3. What Works, What Doesn't

### What to Keep
- **ListFlow's eBay integration** — the Trading API, sell-similar, item specifics, category lookup. This is hard-won code.
- **ListFlow's AI pipeline** — photo analysis and listing generation with OpenAI/Segmind.
- **CompTool's Chrome extension** — the right architecture for eBay scraping.
- **CompTool's client/API key system** — SaaS-ready tenant isolation.
- **CompTool's ingest API pattern** — clean, validated, trackable.
- **Yakcat's Next.js/Vercel deployment model** — zero-ops, edge-ready.
- **Yakcat's user role system** — ADMIN, STAFF, VENDOR is the right model.

### What to Rethink
- **Two separate auth systems** (JWT in ListFlow, JWT+next-auth in Yakcat, API keys in CompTool) → one federated auth system.
- **Two separate databases with no connection** → one database or at minimum one shared auth database.
- **Three separate frontends** (ListFlow React, CompTool React, Yakcat Next.js) → one frontend with role-based views.
- **Plain JavaScript in CompTool** → TypeScript everywhere.
- **Inline styles in CompTool** → shared design system.
- **PHP image hosting on a separate server** → integrated image pipeline.
- **Playwright scraping** → Chrome extension only, Playwright retired.

### What to Drop
- **Playwright browser automation** for eBay scraping — the Chrome extension does this better
- **The PHP pics tool** — replace with an integrated image service
- **WebCat v1 and v2** — already deprecated, Yakcat replaces them
- **Redis/Bull** in ListFlow — unless you actually need background job processing at scale, it's unused complexity

---

## 4. Domain Architecture

### Design Principle: Independent Domains, Shared Contracts

Every feature area is a **domain** — a self-contained module with its own models, services, routes, and UI pages. Domains communicate through **typed contracts** (TypeScript interfaces), never by reaching into each other's internals. You can develop, test, and deploy a domain without touching any other domain.

If the catalog domain changes how it stores images, the eBay domain doesn't break — because it only knows about the `ItemImage` contract, not the storage implementation. If the research domain adds a new field to comps, the listing workflow doesn't notice unless you explicitly update the contract.

### The Domains

```
┌─────────────────────────────────────────────────────────────────┐
│                        SHARED KERNEL                            │
│  Types, Validation, Auth Context, Event Bus, Universal Item     │
└──────────┬──────────────────────────────────────────────────────┘
           │
    ┌──────┴──────────────────────────────────────────────┐
    │                                                      │
┌───┴───┐  ┌─────────┐  ┌──────────┐  ┌────────┐  ┌─────┴────┐
│ AUTH  │  │ CATALOG  │  │ RESEARCH │  │ LISTING│  │  BILLING │
│       │  │          │  │          │  │        │  │          │
│Users  │  │Items     │  │Comps     │  │eBay API│  │Stripe    │
│Orgs   │  │Images    │  │Searches  │  │AI Svc  │  │Usage     │
│Roles  │  │Tags      │  │Extension │  │Workflow│  │Plans     │
│Keys   │  │Vendors   │  │Stats     │  │Templates│ │Invoices  │
│Sessions│ │Storefront│  │Ingest    │  │Publish │  │Metering  │
└───────┘  └─────────┘  └──────────┘  └────────┘  └──────────┘
    │           │             │             │            │
    └───────────┴─────────────┴─────────────┴────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   IMAGE SERVICE   │
                    │  Upload, Process, │
                    │  Store, Serve     │
                    └───────────────────┘
```

### Domain Definitions

**AUTH** — Who are you? What can you do?
- User accounts, organizations (tenants), roles, permissions
- Session management, JWT issuance, API key lifecycle
- Machine tracking (Chrome extension installations)
- Exposes: `getCurrentUser()`, `requireRole()`, `resolveApiKey()`
- Depends on: nothing (root domain)

**CATALOG** — What do we have for sale?
- Item CRUD, image management, tag/category taxonomy
- Vendor management (consignment)
- Public storefront (browsable catalog, SEO)
- Exposes: `createItem()`, `getItem()`, `listItems()`, `updateItemStatus()`
- Depends on: AUTH (who owns it), IMAGE SERVICE (photos)

**RESEARCH** — What is it worth?
- Sold comp ingestion (from Chrome extension, APIs, manual entry)
- Search history with price statistics (avg, median, percentiles)
- Comp browsing with full-text search and filters
- Chrome extension API (ingest endpoint, version check)
- Exposes: `ingestComps()`, `getCompStats()`, `searchComps()`
- Depends on: AUTH (API key validation), IMAGE SERVICE (cache eBay thumbnails)

**LISTING** — Get it listed and sold.
- eBay Trading API integration (create, revise, verify, end)
- AI service (photo analysis, listing generation, price suggestion)
- Listing workflow (stage management, completeness checks)
- Sell-similar, templates, item specifics
- Multi-eBay-account management
- Exposes: `createListing()`, `pushToEbay()`, `getItemSpecifics()`, `analyzePricing()`
- Depends on: AUTH (eBay credentials), CATALOG (item data), RESEARCH (comp stats for pricing), IMAGE SERVICE (listing photos)

**BILLING** — How do we get paid?
- Usage event tracking and rollup
- Plan/tier management
- Stripe integration (subscriptions, metered billing, invoices)
- Limit enforcement (API rate limits per plan)
- Exposes: `trackUsage()`, `checkLimit()`, `getUsageSummary()`
- Depends on: AUTH (organization, plan tier)

**IMAGE SERVICE** — Cross-cutting utility, not a business domain.
- Upload, process (Sharp), store, serve
- Storage adapter pattern (local → S3 → R2)
- Exposes: `uploadImage()`, `processImage()`, `getImageUrl()`, `cacheExternalImage()`
- Depends on: nothing (utility service)

### Domain Communication

Domains NEVER import each other's internal code. They communicate through:

**1. Shared Contracts (compile-time)**

```typescript
// packages/core/src/contracts/research.ts
export interface CompStatsRequest {
  keyword: string;
  organizationId: string;
}

export interface CompStats {
  avg: number;
  median: number;
  min: number;
  max: number;
  count: number;
}

// The LISTING domain calls RESEARCH through this contract
// LISTING doesn't know or care how RESEARCH computes stats
```

**2. Domain Events (runtime, optional)**

When one domain does something that other domains might care about:

```typescript
// LISTING domain publishes:
events.emit("listing.sold", {
  itemId: "abc",
  ebayItemId: "123456",
  soldPrice: 29.99,
  soldDate: new Date(),
});

// RESEARCH domain subscribes:
events.on("listing.sold", async (data) => {
  await ingestComps([{
    ebayItemId: data.ebayItemId,
    soldPrice: data.soldPrice,
    soldDate: data.soldDate,
    source: "listflow",
  }]);
});

// CATALOG domain subscribes:
events.on("listing.sold", async (data) => {
  await updateItemStatus(data.itemId, "sold");
});
```

Start with a simple in-process event emitter (Node's `EventEmitter`). If you ever need cross-service events, swap in Redis pub/sub or a message queue without changing domain code.

**3. Service Interfaces (dependency injection)**

Each domain exports a service interface. The application wires them together at startup:

```typescript
// domains/listing/service.ts
export interface ResearchProvider {
  getCompStats(keyword: string, orgId: string): Promise<CompStats>;
}

export function createListingService(deps: {
  research: ResearchProvider;
  images: ImageProvider;
  auth: AuthProvider;
}) {
  return {
    async suggestPrice(itemId: string) {
      const item = await getItem(itemId);
      const stats = await deps.research.getCompStats(item.title, item.organizationId);
      // Use stats to suggest pricing...
    },
  };
}
```

This means you can test the LISTING domain with mock research data. You can develop RESEARCH without running the LISTING service. You can swap the AI provider without touching any other domain.

### File Structure Per Domain

Each domain follows the same internal structure:

```
domains/research/
├── models/          # Prisma model definitions (or references to shared schema)
├── services/        # Business logic
│   ├── ingest.ts
│   ├── search.ts
│   └── stats.ts
├── routes/          # Express routes or Next.js API routes
│   ├── ingest.routes.ts
│   ├── search.routes.ts
│   └── comps.routes.ts
├── ui/              # React pages and components for this domain
│   ├── pages/
│   │   ├── BrowsePage.tsx
│   │   └── SearchDetailPage.tsx
│   └── components/
│       ├── CompTable.tsx
│       └── StatsBar.tsx
├── contracts.ts     # What this domain exposes to others
├── events.ts        # Events this domain publishes/subscribes
└── index.ts         # Public API of the domain
```

**Rule: Nothing outside `domains/research/` imports from inside `domains/research/` except through `domains/research/index.ts` and `domains/research/contracts.ts`.**

This means you can refactor the entire internals of a domain — rename files, restructure services, change the database queries — and nothing else breaks, because the public interface hasn't changed.

---

## 5. Recommended Monorepo Structure

```
yakimafinds/
├── packages/
│   ├── core/                    # Shared types, schemas, utilities
│   │   ├── src/
│   │   │   ├── types/           # Universal item schema, user types
│   │   │   ├── validation/      # Zod schemas shared across apps
│   │   │   ├── constants/       # Condition maps, status enums, categories
│   │   │   └── utils/           # Price math, slug generation, date helpers
│   │   └── package.json
│   │
│   ├── db/                      # Prisma schema + client + migrations
│   │   ├── prisma/
│   │   │   └── schema.prisma    # ONE schema for everything
│   │   ├── src/
│   │   │   ├── client.ts        # Singleton Prisma client
│   │   │   └── seed.ts          # Seed data
│   │   └── package.json
│   │
│   └── ui/                      # Shared React components
│       ├── src/
│       │   ├── components/      # Buttons, tables, forms, stat cards
│       │   ├── hooks/           # useAuth, useApi, useDebounce
│       │   └── theme/           # Design tokens, Tailwind config
│       └── package.json
│
├── apps/
│   ├── web/                     # Next.js — storefront + admin + dashboard
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (storefront)/    # Public catalog (Yakcat replacement)
│   │   │   │   ├── (dashboard)/     # Comp research, browse, search
│   │   │   │   ├── (workflow)/      # ListFlow: photo → AI → price → list
│   │   │   │   ├── (admin)/         # Client management, system admin
│   │   │   │   └── api/             # API routes (Next.js Route Handlers)
│   │   │   ├── lib/
│   │   │   └── middleware.ts        # Auth, tenant resolution
│   │   └── package.json
│   │
│   ├── api/                     # Express API — eBay integration, ingest, heavy lifting
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   │   ├── ebay.service.ts
│   │   │   │   ├── ai.service.ts
│   │   │   │   ├── image.service.ts
│   │   │   │   └── ingest.service.ts
│   │   │   └── middleware/
│   │   └── package.json
│   │
│   └── extension/               # Chrome extension
│       ├── manifest.json
│       ├── content.js
│       ├── popup/
│       └── options/
│
├── turbo.json                   # Turborepo config
├── package.json                 # Root workspace
└── tsconfig.base.json           # Shared TypeScript config
```

### Why This Structure

**Monorepo with Turborepo** because:
- One `git push` deploys everything
- Shared types mean breaking changes are caught at build time, not runtime
- One Prisma schema means one migration history, one source of truth
- Shared UI components mean consistent look across all features
- But each app deploys independently — the web app on Vercel, the API on your VPS

**Next.js for the web app** because:
- Server-side rendering for the public storefront (SEO for catalog pages)
- API routes for lightweight endpoints (auth, CRUD)
- App Router with route groups for clean separation of concerns
- Yakcat is already Next.js — this is an evolution, not a rewrite
- Middleware for auth/tenant resolution at the edge

**Express for the API** because:
- eBay Trading API integration needs long-running HTTP calls, XML parsing, retry logic
- Image processing with Sharp is CPU-intensive — don't put it in a serverless function
- The ingest endpoint handles bulk data from the Chrome extension
- AI service calls (OpenAI, Segmind) need careful rate limiting and error handling
- This is the "backend for backends" — the extension talks to it, the web app talks to it

**Chrome extension stays standalone** because:
- It has no build step and doesn't need one
- It runs in the browser, not on a server
- Its release cycle is independent (Chrome Web Store, or manual .zip updates)

---

## 5. Recommended Tech Stack

### Language & Runtime
| Component | Choice | Why |
|-----------|--------|-----|
| Language | **TypeScript 5.x** (strict mode ON) | Every project already uses it except CompTool. Strict mode catches real bugs. No more `any`. |
| Runtime | **Node.js 22 LTS** | You're on Node 18 locally (Ubuntu system package). Node 22 is current LTS, supports native fetch, better ESM, faster startup. Install via nvm. |
| Package Manager | **pnpm** | Monorepo-native, faster than npm, strict dependency resolution, disk-efficient. |
| Monorepo Tool | **Turborepo** | Vercel-native, incremental builds, dependency-aware task running. Simple config. |

### Backend
| Component | Choice | Why |
|-----------|--------|-----|
| Web Framework | **Next.js 15** (web app) + **Express 5** (API) | Next.js for pages/light API, Express for heavy integration work. Both already in use. |
| ORM | **Prisma 6** | Already used everywhere. One schema, one migration history, generated types. |
| Database | **PostgreSQL 16** | Already in use. Mature, reliable, excellent JSON support for flexible fields. |
| Auth | **Better Auth** | See section 6. Modern, self-hosted, supports multiple providers, organizations, roles. |
| Validation | **Zod 3** | Already used in ListFlow. Shared schemas between frontend and backend. Runtime + compile-time safety. |
| Image Processing | **Sharp** | Already used in ListFlow. Fast, handles resize/thumbnail/format conversion. |
| File Storage | **Local disk + S3-compatible** | Start with local (like now), add S3/R2/Uploadthing as a storage adapter. Don't lock into one provider. |
| Job Queue | **BullMQ** (only if needed) | Redis-backed. Use for AI processing, bulk image downloads, eBay API retries. Don't add until you need it. |
| eBay API | **@hendt/ebay-api** | Already integrated in ListFlow. Mature library, handles OAuth and Trading API. |
| AI | **OpenAI SDK** | Already in ListFlow. Use for photo analysis, listing generation, price suggestions. |

### Frontend
| Component | Choice | Why |
|-----------|--------|-----|
| Framework | **Next.js 15 App Router** | SSR for public pages, RSC for data fetching, API routes for lightweight backend. |
| UI Library | **Tailwind CSS 4** + **shadcn/ui** | Tailwind already used in ListFlow and Yakcat. shadcn/ui gives you polished, accessible components without a runtime dependency — it's copy-paste components, not a library. |
| State | **Zustand** (client) + **TanStack Query** (server) | Already used in ListFlow. Zustand for UI state, TanStack Query for API cache. |
| Forms | **React Hook Form** + **Zod** | Performant forms with shared validation schemas. |
| Icons | **Lucide React** | Already used in both ListFlow and Yakcat. |
| Drag & Drop | **@dnd-kit** | Already used in ListFlow for photo ordering. |

### Chrome Extension
| Component | Choice | Why |
|-----------|--------|-----|
| Manifest | **V3** | Already using it. V2 is deprecated. |
| Language | **Vanilla JS** (no build) or **TypeScript + esbuild** | Start vanilla, add a build step only if the extension grows complex. |
| Storage | **chrome.storage.sync** + **chrome.storage.local** | Already using both. Sync for settings, local for machine ID. |

---

## 6. Authentication & Authorization

### The Problem

Right now you have:
- **ListFlow:** JWT with bcrypt, single-user, no roles
- **Yakcat:** JWT + next-auth hybrid, ADMIN/STAFF/VENDOR roles, no connection to ListFlow
- **CompTool:** API keys mapped to Client records, no user login at all
- **Pics tool:** Separate PHP login

Four separate auth systems, zero shared identity.

### The Solution: Better Auth

**Better Auth** (`better-auth.com`) is a modern, self-hosted auth library for TypeScript/Next.js that gives you:

- Email/password, OAuth (Google, GitHub, etc.), magic links
- Organizations (tenants) with member roles
- API key management (for the Chrome extension and external integrations)
- Session management with refresh tokens
- Built-in Prisma adapter
- Works with both Next.js (middleware) and Express (middleware)
- Self-hosted — your data stays on your server

If Better Auth doesn't fit, **Lucia Auth v3** or **Auth.js v5** (next-auth successor) are solid alternatives. The key requirement: one auth system, shared across all apps in the monorepo.

### User Roles

| Role | Can Do | Exists In |
|------|--------|-----------|
| **owner** | Everything. System config, billing, all tenants. | New |
| **admin** | Manage users, clients, API keys, view all data. Manage eBay accounts. | Yakcat (ADMIN), CompTool (admin password) |
| **staff** | Run the listing workflow, manage inventory, process photos. | Yakcat (STAFF), ListFlow (implied single user) |
| **vendor** | Consign items, view their own items/sales, manage their catalog. | Yakcat (VENDOR) |
| **client** | Use comp research tools via API/extension. View their own data. | CompTool (Client model) |
| **buyer** | Browse catalog, message vendors, view public listings. | Yakcat (implicit) |

### How It Flows

```
                    ┌─────────────────────────┐
                    │     Better Auth          │
                    │  (Prisma + PostgreSQL)   │
                    └────────┬────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         Next.js App    Express API    Chrome Extension
         (session)      (Bearer JWT)    (API Key)
              │              │              │
     ┌────────┴─────┐       │              │
     │              │        │              │
  Storefront    Dashboard    │              │
  (public +     (staff +   eBay API     Terapeak
   vendor)      admin)    Integration    Scraping
```

- **Web app:** Session-based auth via Better Auth middleware. Role checked per route group.
- **Express API:** Bearer JWT validated against the same auth database. Used by the web app's server components and by external callers.
- **Chrome extension:** API key (the `ct_` prefixed keys) validated against the ApiKey table. The ApiKey belongs to a User/Organization, not a separate Client model.

### Organizations (Multi-Tenancy)

Better Auth supports organizations natively. Each organization is a tenant:

```
Organization: "Yakima Finds"
├── Owner: robug@robug.com (owner role)
├── Staff: staffer@yakimafinds.com (staff role)
├── Vendor: bob@vendor.com (vendor role)
├── eBay Accounts: [yakimafinds_store, bobs_vintage]
├── API Keys: [ct_abc..., ct_def...]
└── Items: [everything in the catalog]

Organization: "External Client A"  (SaaS customer)
├── Owner: client@example.com (client role)
├── API Keys: [ct_xyz...]
└── Items: [only their comp research data]
```

This replaces CompTool's Client model with a proper auth-backed organization. The `clientId` on SoldComp and Search becomes the organization ID.

---

## 7. Universal Item Schema

See `UNIVERSAL-ITEM-SCHEMA.md` for the full TypeScript interface. Summary of the key design decisions:

### One Table or Many?

**One `Item` table** with nullable fields for each stage. Not three tables (CatalogItem, Listing, SoldComp). Why:

- The same physical object might be in the Yakcat catalog, get listed on eBay through ListFlow, sell, and then CompTool tracks the sale. It's one item going through stages.
- Nullable fields are fine — a comp scraped from Terapeak doesn't have weight or package dimensions, and that's OK.
- The universal status field tracks where it is in its lifecycle.
- You can always create views or Prisma `select` subsets for each use case.

### Key Fields (Grouped)

**Identity:** id (UUID), sku, slug, externalIds (JSON: `{ebayItemId, yakimafindsId, ...}`)

**Content:** title, description, brand, model, category, categoryId, condition, conditionId, features[], keywords[], itemSpecifics[]

**Product IDs:** upc, isbn, ean, mpn, epid

**Pricing:** price (current), startingPrice, buyNowPrice, soldPrice, shippingCost, totalPrice

**Research:** compStats (JSON: avg, median, min, max, count, keyword)

**Shipping:** weight, dimensions (JSON), shippingService, shippingType, handlingTime, postalCode, shippingProfileId

**Listing:** listingFormat, listingDuration, quantity, returnPolicy (JSON), returnProfileId

**Images:** relation to ItemImage[] (url, localPath, key, order, variants JSON)

**Marketplace:** ebayItemId, ebayListingUrl, ebayAccountId, ebaySiteId, publishedAt, listedAt, soldDate, endedAt

**Catalog:** location, vendorId, contactInfo, viewCount, videoUrl

**Workflow:** status (enum), stage, source (where it came from), organizationId (tenant)

**Audit:** createdAt, updatedAt, createdById

---

## 8. Platform Services

### 8.1 Ingest Service (CompTool's best feature, evolved)

Accepts structured item data from any source:

```
POST /api/ingest
Headers: X-API-Key (required), X-Machine-Id (optional)
Body: { source: "extension"|"listflow"|"manual", items: UniversalItem[] }
```

- Validates and deduplicates by (organizationId, ebayItemId)
- Computes price statistics
- Triggers background image caching
- Tracks API key usage and machine
- Returns stats summary

### 8.2 eBay Service (ListFlow's best feature, evolved)

Handles all eBay API communication:
- **Listing:** Create, revise, verify, end listings
- **Categories:** Suggest categories, fetch item specifics per category
- **Sell Similar:** Import existing listings as templates
- **Research:** Sold items via Browse API (complement to extension scraping)
- **Account Management:** Multiple eBay accounts per organization, OAuth refresh

### 8.3 AI Service (ListFlow's AI, improved)

- **Photo Analysis:** Upload photos, get item identification, condition assessment, feature extraction
- **Listing Generation:** Given photos + item data, generate optimized title, description, tags
- **Price Suggestion:** Given comp data + item condition, suggest pricing
- **Cost Tracking:** Log API costs per item, per organization

### 8.4 Image Service (replaces Pics tool, CompTool image cache, Uploadthing)

Single image pipeline:
- Accept uploads (multipart, URL, base64)
- Process with Sharp: generate thumbnail (200px), medium (600px), large (1200px), WebP conversion
- Store locally in `data/images/{orgId}/{itemId}/` with organized naming
- Serve via Express static or CDN
- Support HEIC conversion (already in ListFlow)
- Background download from external URLs (eBay image caching)
- Generate public URLs for eBay listing embedding (replaces pics.yakimafinds.com)

### 8.5 Search Service

Full-text search across all items:
- PostgreSQL `tsvector` full-text search on title + description + keywords
- Faceted filtering: price range, condition, category, status, date range, source
- Sorting: price, date, relevance
- Pagination with cursor-based or offset
- Per-organization scoping

---

## 9. Chrome Extension

### Current State (Good)
- Scrapes Terapeak results
- Posts to ingest API
- Machine ID tracking
- Version checking

### Improvements for v2
- **Overlay mode:** When browsing an eBay listing page, show comp data from your database in a sidebar. "You have 47 comps for similar items, avg sold price $23.50."
- **Quick-list button:** On any eBay listing, click "List Similar" to create a ListFlow item pre-populated from the listing data.
- **Multi-page scraping:** "Save All Pages" button that auto-paginates through Terapeak results.
- **Context menu:** Right-click an eBay listing → "Save to CompTool" / "List Similar in ListFlow"
- **Badge:** Show count of unsaved results on the extension icon.
- **Auth integration:** Instead of manually entering an API key, open a popup to the platform login, get an API key issued automatically.

---

## 10. Image Pipeline

### The Problem Today

Images are scattered:
- **ListFlow:** Sharp processing, stored locally in `uploads/`, served at `/uploads/`
- **CompTool:** eBay image URLs cached to `data/images/`, served at `/comp/images/`
- **Yakcat:** Uploadthing cloud storage, served from utfs.io
- **Pics tool:** PHP upload to a separate server, served from pics.yakimafinds.com

Four image systems. No shared access. No consistent processing.

### The Solution

One image service with a storage abstraction:

```typescript
interface StorageAdapter {
  upload(buffer: Buffer, path: string): Promise<string>;  // returns URL
  delete(path: string): Promise<void>;
  getUrl(path: string): string;
}

class LocalStorageAdapter implements StorageAdapter { ... }
class S3StorageAdapter implements StorageAdapter { ... }
class UploadthingAdapter implements StorageAdapter { ... }
```

Start with `LocalStorageAdapter`. Swap in S3/R2/Uploadthing later without touching any business logic.

**Processing pipeline:**
```
Upload/URL → Sharp → {
  original.jpg   (max 2000px, quality 85)
  large.webp     (1200px)
  medium.webp    (600px)
  thumb.webp     (200px)
} → Store → Link to Item → Serve
```

**Directory structure:**
```
data/images/
├── {orgId}/
│   ├── {itemId}/
│   │   ├── 001-original.jpg
│   │   ├── 001-large.webp
│   │   ├── 001-medium.webp
│   │   └── 001-thumb.webp
│   └── cache/              # External URL cache (eBay images)
│       ├── {ebayItemId}.jpg
│       └── ...
└── public/                  # Public-facing (for eBay listing embeds)
    └── {slug}.jpg           # Replaces pics.yakimafinds.com
```

---

## 11. SaaS & Multi-Tenancy

### Tenant Model

Every piece of data belongs to an organization. The organization ID is set by the auth middleware and propagated to every database query.

```typescript
// Middleware sets this on every request
req.auth = {
  userId: "user_abc",
  organizationId: "org_xyz",
  role: "staff",
};

// Every Prisma query is scoped
const items = await prisma.item.findMany({
  where: { organizationId: req.auth.organizationId, ...filters },
});
```

### Data Isolation

- **Row-level:** All tables have `organizationId`. All queries filter by it.
- **No schema-per-tenant:** Adds migration complexity for minimal benefit at this scale.
- **API keys are scoped to organizations.** A key created for Org A cannot access Org B's data.
- **The Chrome extension sends the API key** → the server resolves the organization from the key.

### Tiers

| Tier | Comp Searches/mo | Items | eBay Accounts | Image Storage | Price |
|------|------------------|-------|---------------|---------------|-------|
| Free | 50 | 100 | 0 | 500MB | $0 |
| Pro | 500 | 1,000 | 2 | 5GB | $19/mo |
| Business | 5,000 | 10,000 | 10 | 50GB | $49/mo |
| Enterprise | Unlimited | Unlimited | Unlimited | Unlimited | Custom |

---

## 12. Billing & Usage

### Usage Tracking (Build Now)

Track everything from day one, even before billing is live:

```prisma
model UsageEvent {
  id              String   @id @default(uuid())
  organizationId  String
  type            String   // "ingest", "search", "listing_push", "ai_call", "image_upload"
  count           Int      @default(1)
  metadata        Json?    // { keyword, itemCount, model, cost }
  createdAt       DateTime @default(now())

  @@index([organizationId, type, createdAt])
}
```

Roll up daily/monthly:
```prisma
model UsageSummary {
  id              String   @id @default(uuid())
  organizationId  String
  period          String   // "2026-03" (monthly)
  ingestCount     Int      @default(0)
  searchCount     Int      @default(0)
  listingCount    Int      @default(0)
  aiCallCount     Int      @default(0)
  aiCostUsd       Float    @default(0)
  imageStorageMb  Float    @default(0)

  @@unique([organizationId, period])
}
```

### Billing Integration (Build Later)

When ready:
- **Stripe** for payment processing
- `stripeCustomerId` and `stripeSubscriptionId` on the Organization model
- Webhook handler for subscription events (created, updated, cancelled, payment failed)
- Usage-based billing: report usage to Stripe Metered Billing, or enforce hard limits
- Invoice generation via Stripe

Don't build this until you have paying customers. The usage tracking gives you the data to know when you're ready.

---

## 13. Deployment & Infrastructure

### Current Infrastructure

| Server | IP | Hosts | Cost |
|--------|------|-------|------|
| list.robug.com | DigitalOcean | ListFlow, CompTool, PostgreSQL | ~$12/mo |
| backoffice.yakimafinds.com | DigitalOcean | TeamTime, WebCat (old) | ~$6/mo |
| pics.yakimafinds.com | DigitalOcean | PHP image tool | ~$6/mo |
| Vercel | Cloud | Yakcat (webcat.yakimafinds.com) | Free tier |
| Neon | Cloud | Yakcat database | Free tier |

### Recommended Infrastructure

**Phase 1 (now):** Keep what you have, just consolidate.

| Component | Where | Why |
|-----------|-------|-----|
| Next.js web app | **Vercel** | Free tier for the storefront, auto-deploy from GitHub, edge middleware for auth. Already using it for Yakcat. |
| Express API | **list.robug.com** | eBay API calls, image processing, AI calls — need a real server for these. Already deployed here. |
| PostgreSQL | **list.robug.com** | Already running here. One database with multiple schemas or one schema. |
| Images | **list.robug.com** `/data/images/` | Local for now. Migrate to R2/S3 when storage exceeds the server. |
| Chrome Extension | **GitHub Releases** or served from the API | Manual install for now, no Chrome Web Store needed. |

**Phase 2 (when you have paying customers):**

| Component | Where | Why |
|-----------|-------|-----|
| Database | **Neon** or **Supabase** | Managed PostgreSQL with connection pooling, backups, branching. |
| Images | **Cloudflare R2** | S3-compatible, no egress fees, global CDN. |
| API | **Railway** or **Fly.io** | Container deployment with autoscaling, cheaper than DigitalOcean for variable load. |
| Monitoring | **Sentry** + **Axiom** | Error tracking + structured logging. |

**Phase 3 (scale):**
- CDN for images (Cloudflare)
- Redis for caching and rate limiting
- Background job queue (BullMQ) for AI processing and bulk operations
- Horizontal scaling of the Express API

### Domain Strategy

| Domain | Points To |
|--------|-----------|
| `yakimafinds.com` | Main marketing site / storefront (Vercel) |
| `app.yakimafinds.com` | Dashboard / workflow / admin (Vercel, same Next.js app) |
| `api.yakimafinds.com` | Express API (list.robug.com or container host) |
| `pics.yakimafinds.com` | Redirect to `api.yakimafinds.com/images/` |

Or simpler: everything under `yakimafinds.com` with path-based routing:
- `/` — storefront
- `/dashboard` — comp research, browse
- `/workflow` — listing workflow
- `/admin` — system admin
- `/api` — Express API (proxied from Vercel rewrites)
- `/register` — client registration

---

## 14. Migration Strategy

### Principle: Migrate Features, Not Code

Don't copy-paste ListFlow's Express routes into the new codebase. Instead:

1. Build the new platform skeleton (monorepo, shared types, auth, database)
2. Rebuild each feature using the existing code as reference, but on the new shared foundation
3. Migrate data from the old databases to the new schema
4. Redirect traffic from old URLs to new ones
5. Decommission old deployments one at a time

### Data Migration Order

1. **Users** — Create organization, import the owner account, set up roles
2. **Items from Yakcat** — Map Yakcat items to universal schema (simple, few fields)
3. **Items from ListFlow** — Map ListFlow items + listings (complex, many fields)
4. **Comps from CompTool** — Map SoldComp records to universal items with `status: "sold"`
5. **API Keys** — Migrate CompTool API keys to the new auth system
6. **Images** — Download from Uploadthing, eBay cache, and local storage into the new image pipeline

### Backward Compatibility

During migration, keep the old systems running. The new API can proxy requests to old endpoints if needed. The Chrome extension just needs its API URL updated in settings — no code change required, the ingest endpoint interface stays the same.

---

## 15. Phase Roadmap

### Phase 0: Foundation (1–2 weeks)
- [ ] Set up monorepo with Turborepo + pnpm
- [ ] Create `packages/core` with universal item types and Zod schemas
- [ ] Create `packages/db` with the unified Prisma schema
- [ ] Set up Better Auth (or Auth.js) with organization support
- [ ] Basic Next.js app with auth pages (login, register, org setup)
- [ ] Basic Express API with auth middleware and health check
- [ ] CI/CD: GitHub Actions → Vercel (web) + SSH deploy (API)

### Phase 1: Comp Research (1–2 weeks)
- [ ] Rebuild CompTool's ingest endpoint on the new API
- [ ] Rebuild browse/search page in Next.js with shared UI components
- [ ] Rebuild admin dashboard (clients, API keys, machines)
- [ ] Rebuild registration portal
- [ ] Update Chrome extension to point at new API (no code changes needed if endpoint shape is the same)
- [ ] Migrate CompTool data to new database
- [ ] Deploy, redirect `listflow.robug.com/comp` → new URL

### Phase 2: Catalog & Storefront (1–2 weeks)
- [ ] Rebuild Yakcat item catalog in Next.js (public pages with SSR)
- [ ] Vendor dashboard (my items, my sales)
- [ ] Image upload with Sharp processing pipeline
- [ ] Item CRUD with universal schema
- [ ] Tags/categories
- [ ] Migrate Yakcat data
- [ ] Deploy, redirect `webcat.yakimafinds.com` → new URL

### Phase 3: eBay Listing Workflow (2–3 weeks)
- [ ] Port ListFlow's eBay service to the new API
- [ ] Rebuild the listing workflow UI (photo → AI → review → price → publish)
- [ ] Item specifics management (fetch from eBay Taxonomy, save to universal schema)
- [ ] Multi-eBay-account support
- [ ] Sell-similar import
- [ ] AI photo analysis and listing generation
- [ ] Migrate ListFlow data and eBay account credentials
- [ ] Deploy, decommission ListFlow

### Phase 4: Integration & Intelligence (2–3 weeks)
- [ ] Auto-comp: when creating a listing, auto-search CompTool for similar sold items
- [ ] Price advisor: given comp data + condition, suggest pricing with confidence
- [ ] Sold tracking: when an eBay listing sells, auto-create a sold comp record
- [ ] Chrome extension overlay: show comp data when browsing eBay listings
- [ ] Bulk operations: import CSV, bulk re-price, bulk relist
- [ ] Webhook notifications (item sold, listing ended, etc.)

### Phase 5: SaaS & Billing (when ready)
- [ ] Stripe integration (subscriptions + usage billing)
- [ ] Tier enforcement (rate limiting, storage caps)
- [ ] Onboarding flow for new organizations
- [ ] Public marketing pages
- [ ] Documentation site
- [ ] Decommission pics.yakimafinds.com, old servers

---

## Appendix: Decision Log

| Decision | Chosen | Alternatives Considered | Why |
|----------|--------|------------------------|-----|
| Monorepo vs polyrepo | Monorepo | Keep separate repos | Shared types, one deploy pipeline, catch integration bugs at build time |
| Next.js vs separate React+Express | Next.js + Express API | Pure Express, Remix, SvelteKit | Next.js for pages/SSR/Vercel, Express for heavy backend. Best of both. |
| Prisma vs Drizzle vs TypeORM | Prisma | Drizzle (lighter), TypeORM (mature) | Already used everywhere, great DX, auto-generated types. Drizzle is worth watching. |
| Better Auth vs Auth.js vs Clerk | Better Auth | Auth.js (next-auth successor), Clerk ($$$), Lucia (deprecated) | Self-hosted, org support, API keys, Prisma adapter. Clerk is too expensive for a bootstrapped SaaS. |
| shadcn/ui vs Mantine vs Radix | shadcn/ui | Mantine (batteries-included), Radix (unstyled) | Copy-paste components, Tailwind-native, no runtime dependency, easy to customize |
| Vercel vs self-hosted Next.js | Vercel | Self-hosted with `next start` | Zero-ops, free tier generous, edge middleware, auto-deploy. Self-host the API separately. |
| One DB vs DB per service | One DB | Separate databases per service | At this scale, one DB is simpler. Schema isolation if needed. Revisit when you have 10,000+ users. |
| TypeScript strict | Yes | No (current ListFlow state) | The whole point of TypeScript. Turn it on, fix the errors, move on. |
| Redis | Not yet | Add from day one | Only needed for job queues and caching. PostgreSQL handles current load. Add when you actually need background processing. |
