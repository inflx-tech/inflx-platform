# Before / After — campaign-wide production endpoint

**Before:** production state was readable only per contract (`GET /contracts/:id/production`).
With no campaign-level view, the brand Production stage shipped as the **visibility half only**
— a chip derived from `physical_delivery` plus a deep-link into the old ContractModal. Answering
"who am I shipping to / which visits are booked?" meant opening each creator one at a time.

**After:** `GET /v1/campaigns/:id/production` returns the whole roster in one call — per creator:
contract id, production mode/status, visit address/schedule/contact, and shipment
address/courier/AWB/dispatch-delivery dates.

Two deliberate design calls:
- **LEFT JOIN from campaign_influencers**, so a contracted creator with no production event yet
  appears with nulls rather than disappearing — the brand sees the gap instead of a short list.
- **Ownership in the WHERE clause** (`c.brand_id = $2`), so the role gate is not the only guard.

## Changed
- `backend/src/controllers/production.controller.js` — listCampaignProduction + local brand helper.
- `backend/src/routes/production.routes.js` — route registration.

## Verification
- **pnpm qa GREEN — 79/79, gate 0** after the change; `node --check` clean on both files.
- Schema verified against migration 024 before writing the SELECT (no guessed columns).

## Known delta
- Ships **unconsumed by design** — no UI reads it yet, so it cannot regress anything. The web
  Production tab + mobile stage wiring, and the inline actions, are a separate frontend contract.
