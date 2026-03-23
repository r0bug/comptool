# CompTool Database Schema

## Tenant / Auth

### Client
Multi-tenant client accounts for SaaS.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK, auto-generated |
| name | String | Required |
| email | String | Unique |
| company | String? | Optional |
| planTier | String | "free", "pro", "enterprise" (default: "free") |
| billingStatus | String | "active", "suspended", "cancelled" (default: "active") |
| stripeCustomerId | String? | Future billing |
| usageLimitMonthly | Int | Default 1000 |
| isActive | Boolean | Default true |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

### ApiKey
API keys for extension/external access, linked to clients.

| Column | Type | Notes |
|--------|------|-------|
| id | Int | PK, auto-increment |
| clientId | String | FK → Client |
| key | String | Unique, prefixed `ct_` |
| label | String | Human name (default: "Default") |
| isActive | Boolean | Soft-revoke (default: true) |
| lastUsedAt | DateTime? | Updated on each use |
| usageCount | Int | Incremented on each use |
| createdAt | DateTime | Auto |

### Machine
Tracks individual browser/extension installations.

| Column | Type | Notes |
|--------|------|-------|
| id | Int | PK |
| apiKeyId | Int | FK → ApiKey |
| machineId | String | UUID from chrome.storage.local |
| browserInfo | String? | User-Agent |
| firstSeen | DateTime | Auto |
| lastSeen | DateTime | Auto-updated |
| requestCount | Int | Incremented per request |

Unique: (apiKeyId, machineId)

## Core Data

### SoldComp
Individual sold eBay items (comps).

| Column | Type | Notes |
|--------|------|-------|
| id | Int | PK |
| clientId | String | Tenant ID (default: "default") |
| ebayItemId | String | eBay item number |
| itemUrl | String? | eBay listing URL |
| title | String | Listing title |
| soldPrice | Float | Sale price |
| shippingPrice | Float? | Shipping cost |
| totalPrice | Float? | soldPrice + shippingPrice |
| condition | String? | "New", "Pre-Owned", etc. |
| category | String? | eBay category |
| listingType | String? | "Fixed price", "Auction" |
| bidCount | Int? | Auction bid count |
| quantitySold | Int? | Units sold (Terapeak) |
| totalSales | Float? | Total sales volume (Terapeak) |
| watchers | Int? | Watcher count |
| seller | String? | Seller username |
| sellerFeedback | Int? | Feedback score |
| imageUrl | String? | Original eBay image URL |
| localImage | String? | Cached local filename |
| soldDate | DateTime? | When sold |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

Unique: (clientId, ebayItemId)

### Search
Search/scrape history with computed stats.

| Column | Type | Notes |
|--------|------|-------|
| id | Int | PK |
| clientId | String | Tenant ID |
| keyword | String | Search query |
| filters | Json? | Additional filters |
| resultCount | Int | Number of comps found |
| avgPrice | Float? | Computed average |
| medianPrice | Float? | Computed median |
| minPrice | Float? | Computed min |
| maxPrice | Float? | Computed max |
| source | String | "seller_hub", "extension", "public_sold" |
| status | String | "pending", "running", "done", "error" |
| errorMessage | String? | Error details |
| pagesScraped | Int | Pages processed |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

### SearchComp
Many-to-many join: searches ↔ comps.

| Column | Type | Notes |
|--------|------|-------|
| searchId | Int | FK → Search |
| compId | Int | FK → SoldComp |

PK: (searchId, compId)
