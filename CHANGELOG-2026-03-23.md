# CompTool — Changes 2026-03-23

## Data Model
- **Client** — UUID id, name, email, company, planTier, billingStatus, stripeCustomerId (placeholder), usageLimitMonthly
- **ApiKey** — prefixed keys (`ct_...`), linked to client, usage tracking (count + lastUsedAt), soft-revoke
- **Machine** — tracks individual browser installs via UUID, linked to API key, request counting

## Admin Panel (`/comp/admin`)
- Password-gated (stored in sessionStorage)
- **Dashboard** — stat cards (clients, keys, machines, comps, searches), recent activity table
- **Client List** — searchable, shows plan/status/key count, click to detail
- **Client Detail** — edit plan tier, activate/deactivate, generate/revoke API keys, view machines, usage stats

## Registration Portal (`/comp/register`)
- Clean public form — name, email, optional company
- Creates client + first API key
- Success page shows the key once with copy button + setup instructions

## Extension Updates (v1.1.0)
- Generates and persists a machineId per installation
- Sends X-Machine-Id header with every ingest request
- Options page shows machineId with reset option
- Updated hints to point to registration URL

## API Key Middleware
- Now looks up keys from the database first (ApiKey table)
- Falls back to env var for backward compatibility
- Tracks usage count, last used, and machine on every authenticated request

## Access
- Admin: https://listflow.robug.com/comp/admin (password in .env)
- Register: https://listflow.robug.com/comp/register
