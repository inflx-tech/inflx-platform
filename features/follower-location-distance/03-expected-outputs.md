# Expected Outputs — follower-location-distance (Contract 1, backend)

## Files
- `backend/src/services/geocoding.service.js` — NEW shared resolver (`resolveMapsUrl`
  / `reverseGeocode` / `forwardGeocode`).
- `backend/src/controllers/geocoding.controller.js` — slimmed to use the service.
- `backend/src/controllers/brand.controller.js` — `updateMe` writes canonical
  `lat/lng` + `locality`/`formatted_address`; syncs `latitude/longitude`.
- `backend/migrations/092_follower_location.sql` + `backend/scripts/run-092.js`.
- `backend/src/controllers/follower.controller.js` — `updateLocation` +
  `resolveFollowerContext` threads `lat/lng`; section endpoints pass coords.
- `backend/src/routes/follower.routes.js` — `POST /follower/location`.
- `backend/src/services/sectionEngine.service.js` — `lat/lng` in ctx + cache key.
- `backend/src/services/sectionRules.service.js` — Haversine in
  `businesses_in_category` + `products_in_category`; `distance_km` on items.
- `backend/scripts/backfill-brand-coords.js` — two-step backfill + report.

## Acceptance checks
1. `updateMe` with a Google Maps URL writes `lat/lng` (canonical) + address; manual
   `latitude/longitude` sync to `lat/lng`.
2. `POST /follower/location {lat,lng}` (auth) stores coords + returns `area_name`
   (throttled — no geocode when unmoved + fresh).
3. Category/Home listing shelves return `distance_km` and rank nearest-first when
   coords are present; degrade to city-boost when absent (no regression).
4. Backfill dry-run reports: *Aveen food paradise* → copy; Chaitanya → forward-geocode
   (low-confidence, for verify); URL-less brands → "needs manual".
5. `node --check` passes on all touched files; `pnpm qa` GREEN (no web regression).
6. Reversible per piece; geocode/permission failures never block the feed.

## Release classification
- **production-impacting** (Render backend + migration 092 + brand backfill).
  Surfaced for founder go; `released` true only after prod migration + backfill +
  `pnpm qa` GREEN. No OTA in Contract 1 (mobile render = Contract 2).
