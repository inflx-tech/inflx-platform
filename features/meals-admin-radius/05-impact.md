# meals-admin-radius — impact

## Blast radius
- Backend: additive — one new table, two admin endpoints, chat
  branch + helpers. `matchAcrossRestaurants` swaps per-brand radius
  for platform radius (intentional behaviour change, recorded here).
- Mobile: additive picker UI on `stage='address_required'`; no
  existing screen behaviour changed.
- Admin web: one new page + one new nav entry.

## Behaviour change (intentional)
- **Customer chat now requires a delivery address before offers** —
  this is the founder's locked product rule. Tests for the old
  no-address path are updated to pass `drop_location` (legit
  business-rule drift, not assertion weakening).
- **Routing radius is now admin-controlled** — per-brand
  `delivery_radius_km` exists in schema but the engine no longer
  reads it; the admin's platform value is the single source of truth.

## Regression risk
- Low. All meals backend suites + `pnpm qa` green; bundle compiles;
  Maestro flow updated and runs end-to-end.

## Production posture
- PRODUCTION-IMPACTING (`backend/migrations`, `backend/src`,
  `Packages/brand-web/app`, `Packages/Mobile/src`). UI + mobile
  governed; mockup-lock satisfied by the existing customer mockup
  copied in. **Not pushed** — bundled into the single end-of-program
  prod push.
