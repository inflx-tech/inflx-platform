# Impact — wave1-admin-ui-tax-controls

## Changes
- `backend/src/controllers/admin.controller.js` — 2 new handlers
  + exports.
- `backend/src/routes/admin.routes.js` — 2 new routes.
- `Packages/brand-web/lib/api.js` — 2 new API helpers.
- `Packages/brand-web/app/admin/settings/payments/page.js` — FIELDS
  extended + "Tax & Identity" section (~140 LOC added).
- `Packages/brand-web/app/admin/brands/[id]/page.js` — L3 commerce
  override card (~70 LOC added).
- `Packages/brand-web/app/admin/influencers/[id]/page.js` — TDS
  controls section (~80 LOC added).
- 1 contract folder.

## Blast radius
- `/admin/settings/payments` page reorganized; renders the existing
  FIELDS + Negotiation policy + Tranche-sum + new Tax & Identity
  section. Same submit endpoint (payment_config singleton).
- `/admin/brands/[id]` adds one card. The new endpoint is finance+;
  same auth tier as the existing escrow override endpoint.
- `/admin/influencers/[id]` adds two surfaces (Field + Controls
  card). The new endpoint is finance+.
- No existing endpoint shape changed. All new endpoints + UI surfaces
  are additive.

## Rollback
Revert this commit. The 3 admin pages revert to their prior shape;
the 2 new endpoints return 404. No data loss; columns and values
written via the new endpoints persist (they just can't be edited
via UI until the commit re-lands).

## Risks
- **None functional.** Backend wiring already reads the columns
  (Wave 1 commit 1); this commit only exposes the write surfaces.
- **No regression for pnpm qa** — none of the 76 specs hit any of
  the 3 updated pages or the 2 new endpoints directly. Verified
  76/76 GREEN locally.

## Pre-push checklist
1. pnpm qa main lane GREEN. ✓
2. Backend boot smoke clean. ✓
3. gov-check exit 0.
