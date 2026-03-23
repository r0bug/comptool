# Universal Item Schema — Cross-Platform Spec
**Date:** 2026-03-23
**Systems:** CompTool, ListFlow, Yakcat/WebCat, Chrome Extension

## Overview

A single item schema that can flow between all platforms:
- **Yakcat** → local consignment catalog (web storefront)
- **ListFlow** → eBay listing workflow (photo → AI → price → publish)
- **CompTool** → sold comps research (what did it sell for?)
- **Chrome Extension** → scrapes Terapeak data into CompTool

An item might originate in any system and flow to any other:
```
Yakcat (intake) ──→ ListFlow (list on eBay) ──→ CompTool (track sale)
                                                      ↑
Chrome Extension (scrape comps) ──────────────────────┘
CompTool (pricing data) ──→ ListFlow (inform pricing)
ListFlow (sell similar) ──→ Yakcat (catalog it)
```

## Universal Item Interface

```typescript
interface UniversalItem {
  // ─── Identity ────────────────────────────────────────
  id: string;                    // UUID, system-generated
  sku?: string;                  // Human-readable (e.g. "LF-abc123")
  slug?: string;                 // URL-safe (e.g. "vintage-bell-helmet-abc123")
  sourceSystem: string;          // "comptool" | "listflow" | "yakcat" | "extension"
  sourceId?: string;             // Original ID in source system
  clientId?: string;             // Tenant/owner ID (SaaS)

  // ─── Core ────────────────────────────────────────────
  title: string;
  description?: string;          // Plain text or HTML
  brand?: string;
  model?: string;
  category?: string;             // Human-readable category path
  categoryId?: string;           // eBay category ID (numeric string)
  condition?: string;            // "New", "Used", "Pre-Owned", etc.
  conditionId?: number;          // eBay condition ID (1000, 3000, 7000, etc.)
  features?: string[];           // Bullet-point features
  keywords?: string[];           // Search keywords / tags
  itemSpecifics?: ItemSpecific[];// eBay-style name/value pairs

  // ─── Product Identifiers ─────────────────────────────
  upc?: string;
  isbn?: string;
  ean?: string;
  mpn?: string;                  // Manufacturer Part Number
  epid?: string;                 // eBay Product ID

  // ─── Pricing ─────────────────────────────────────────
  price?: number;                // Current/asking price
  startingPrice?: number;        // Auction start price
  buyNowPrice?: number;          // Buy It Now price
  soldPrice?: number;            // Final sale price
  shippingPrice?: number;        // Shipping cost to buyer
  totalPrice?: number;           // soldPrice + shippingPrice
  currency?: string;             // Default "USD"

  // ─── Pricing Research ────────────────────────────────
  compStats?: {
    avg: number;
    median: number;
    min: number;
    max: number;
    p25?: number;
    p75?: number;
    count: number;
    searchKeyword: string;
  };

  // ─── Listing Config ──────────────────────────────────
  listingFormat?: string;        // "FixedPrice" | "Auction" | "AuctionWithBIN"
  listingDuration?: string;      // "GTC", "Days_7", "Days_30"
  quantity?: number;             // Default 1
  bidCount?: number;             // For auction results
  watchCount?: number;

  // ─── Shipping ────────────────────────────────────────
  shippingService?: string;      // "USPSPriority", "FedExGround", etc.
  shippingType?: string;         // "Flat", "Calculated", "Free"
  weight?: number;               // Ounces
  packageDimensions?: {
    length: number;              // Inches
    width: number;
    height: number;
  };
  handlingTime?: number;         // Business days
  shippingProfileId?: string;    // eBay business policy ID
  postalCode?: string;

  // ─── Return Policy ───────────────────────────────────
  returnPolicy?: {
    returnsAccepted: boolean;
    returnPeriod?: string;       // "Days_30", "Days_60"
    refundType?: string;         // "MoneyBack", "Exchange"
    shippingCostPaidBy?: string; // "Buyer", "Seller"
  };
  returnProfileId?: string;      // eBay business policy ID

  // ─── Images ──────────────────────────────────────────
  images?: ItemImage[];
  primaryImageUrl?: string;      // Convenience: first image URL
  localImagePath?: string;       // Cached local copy

  // ─── Seller / Source ─────────────────────────────────
  seller?: string;               // eBay seller username
  sellerFeedback?: number;
  vendorId?: string;             // Yakcat vendor ID
  vendorName?: string;

  // ─── eBay Integration ────────────────────────────────
  ebayItemId?: string;           // eBay item number
  ebayListingUrl?: string;       // Full eBay URL
  ebayAccountId?: string;        // Which eBay account
  ebaySiteId?: string;           // "0" = US, "100" = Motors

  // ─── Yakcat/WebCat ───────────────────────────────────
  location?: string;             // Physical location in store
  contactInfo?: string;
  viewCount?: number;
  videoUrl?: string;
  links?: ItemLink[];            // External resources (manuals, specs)

  // ─── Workflow ────────────────────────────────────────
  status: string;                // See StatusMap below
  stage?: string;                // ListFlow workflow stage
  publishedAt?: Date;
  soldDate?: Date;
  listedAt?: Date;
  endedAt?: Date;

  // ─── Timestamps ──────────────────────────────────────
  createdAt: Date;
  updatedAt: Date;
}

interface ItemImage {
  url: string;                   // Remote URL
  localPath?: string;            // Cached local path
  key?: string;                  // Storage key (Uploadthing, S3)
  order: number;                 // Display order (0 = primary)
  altText?: string;
  thumbnailUrl?: string;
  variants?: Record<string, string>; // { thumb, medium, large }
}

interface ItemSpecific {
  name: string;                  // e.g. "Brand", "Color", "Size"
  value: string;
  required?: boolean;            // Required by eBay category
}

interface ItemLink {
  label: string;
  url: string;
  order?: number;
}
```

## Status Mapping Across Systems

| Universal Status | CompTool | ListFlow | Yakcat |
|-----------------|----------|----------|--------|
| `draft` | — | PHOTO_UPLOAD, AI_PROCESSING | — |
| `review` | — | REVIEW_EDIT, PRICING, FINAL_REVIEW | — |
| `available` | — | — | AVAILABLE |
| `listed` | — | PUBLISHED | — |
| `pending` | `pending` | — | PENDING |
| `sold` | `done` | sold | SOLD |
| `ended` | — | ended/cancelled | REMOVED |
| `error` | `error` | ERROR | — |

## Condition ID Mapping (eBay)

| Condition | eBay ID | Short Code |
|-----------|---------|------------|
| New | 1000 | new |
| New Other | 1500 | new_other |
| New with Defects | 1750 | new_defects |
| Remanufactured | 2000 | remanufactured |
| Certified Refurbished | 2500 | refurbished |
| Like New | 3000 | like_new |
| Very Good | 4000 | very_good |
| Good | 5000 | good |
| Acceptable | 6000 | acceptable |
| For Parts | 7000 | for_parts |

## Integration Endpoints

### CompTool → ListFlow
```
POST /api/items/import
Body: { items: UniversalItem[], source: "comptool" }
Purpose: Push comp research data to inform pricing decisions
```

### ListFlow → CompTool
```
POST /comp/api/ingest
Body: { keyword, items: UniversalItem[], source: "listflow" }
Purpose: When a ListFlow item sells, record it as a sold comp
```

### Yakcat → ListFlow
```
POST /api/items/import
Body: { items: UniversalItem[], source: "yakcat" }
Purpose: Push catalog item to ListFlow for eBay listing workflow
```

### ListFlow → Yakcat
```
POST /api/items
Body: UniversalItem
Purpose: Create/update Yakcat catalog from ListFlow item data
```

### Chrome Extension → CompTool
```
POST /comp/api/ingest
Headers: X-API-Key, X-Machine-Id
Body: { keyword, items: UniversalItem[], source: "extension" }
Purpose: Scrape Terapeak results into comp database
```

## Field Mapping: System ↔ Universal

### CompTool `SoldComp` → Universal
| SoldComp | Universal |
|----------|-----------|
| ebayItemId | ebayItemId |
| title | title |
| soldPrice | soldPrice |
| shippingPrice | shippingPrice |
| totalPrice | totalPrice |
| condition | condition |
| category | category |
| listingType | listingFormat |
| bidCount | bidCount |
| seller | seller |
| sellerFeedback | sellerFeedback |
| imageUrl | primaryImageUrl |
| localImage | localImagePath |
| itemUrl | ebayListingUrl |
| soldDate | soldDate |
| clientId | clientId |

### ListFlow `Item` → Universal
| Item | Universal |
|------|-----------|
| id | sourceId |
| sku | sku |
| title | title |
| description | description |
| category | category |
| ebayCategoryId | categoryId |
| condition | condition |
| brand | brand |
| features | features |
| keywords | keywords |
| startingPrice | startingPrice |
| buyNowPrice | buyNowPrice |
| shippingCost | shippingPrice |
| ebayId | ebayItemId |
| upc | upc |
| isbn | isbn |
| weight | weight |
| packageDimensions | packageDimensions |
| listingFormat | listingFormat |
| listingDuration | listingDuration |
| handlingTime | handlingTime |
| shippingService | shippingService |
| shippingType | shippingType |
| shippingProfileId | shippingProfileId |
| returnProfileId | returnProfileId |
| postalCode | postalCode |
| stage | stage |
| status | status |
| publishedAt | publishedAt |
| ebayAccountId | ebayAccountId |
| aiAnalysis.specifics | itemSpecifics |

### Yakcat `Item` → Universal
| Yakcat Item | Universal |
|-------------|-----------|
| id | sourceId |
| title | title |
| description | description |
| price | price |
| slug | slug |
| status | status |
| location | location |
| contactInfo | contactInfo |
| viewCount | viewCount |
| vendorId | vendorId |
| images[].url | images[].url |
| images[].key | images[].key |
| images[].order | images[].order |
| tags[].name | keywords |

## Next Steps

1. Create a shared `@comptool/schema` npm package (or just a shared types file) with the TypeScript interfaces above
2. Add `/api/items/import` endpoint to ListFlow that accepts UniversalItem[]
3. Add `/api/items/export` endpoint to Yakcat that emits UniversalItem[]
4. Add webhook/callback support so systems can notify each other of status changes (sold, listed, etc.)
5. The Chrome extension already speaks a subset of this schema — no changes needed
