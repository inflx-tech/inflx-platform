# Feature Spec — Campaign-wide production endpoint (backend batch, item 3)

## Problem / goal
Production state (store visit / shipment / remote) was only readable **one contract at a
time** via `GET /contracts/:id/production`. That is why the brand Production stage (web A5
step 1) could only show a per-creator logistics *chip* derived from `physical_delivery`,
with a deep-link out — no real status, no inline action. This endpoint unblocks that.

## Scope
**In scope**
- `GET /v1/campaigns/:id/production` (brand only, ownership-scoped): one row per active
  creator with contract + production-event state (mode, status, visit fields, shipment
  fields incl. courier/AWB/dates).
- LEFT JOINs from `campaign_influencers` so creators **without** a contract or event yet
  still appear (`production_event_id: null`) instead of silently vanishing.
- Restricted to `contracted / active / live / completed` — pre-contract creators have no
  production state.

**Out of scope (frontend follow-up)** — wiring the web Production tab and the mobile
Production stage to this endpoint, and the inline schedule/dispatch actions it enables.
Shipped separately so this backend change lands and bakes on its own.

## Surfaces touched
- backend only (`production.controller.js` + `production.routes.js`). **Render deploy on push.**

## Data / contracts
- **No migration.** Reads existing `production_events` / `contracts` / `campaign_influencers`.
- Route mounted via the same proven fall-through pattern already used by
  `/contracts/:id/production` (productionRoutes mounted at `/`).

## Non-functional
- Brand ownership enforced in the WHERE clause (`c.brand_id = $2`), not just by role.
