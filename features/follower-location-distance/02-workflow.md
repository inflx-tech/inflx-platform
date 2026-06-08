# Workflow — Follower location + distance

> SEQUENCING (corrected 2026-06-08, founder-approved OTA-first): **Contract 1 =
> backend** (Layer 1 brand coords + Layer 3 distance + the location endpoint +
> migration **092** + backfill) — built now. **Layer 4 mobile render = Contract 2
> (OTA).** **Auto device-GPS = Layer 3-mobile/APK, deferred to the next native
> build** (no geolocation dep today). Until the APK, coords come from the existing
> area-switcher / stored follower location, so distance still works via OTA.

## Brand side (Layer 1)
1. Brand saves listing with a Google Maps link (often a short `maps.app.goo.gl`).
2. `updateMe` → `geocoding.service.resolveMapsUrl(url)` (expand short link → coords →
   reverse-geocode address) → store `brands.lat/lng/locality/formatted_address`.
3. Backfill: re-resolve every existing restaurant's stored `google_maps_url`.

## Follower side (Layers 2–4)
1. App open → permission prompt → device GPS → `{lat,lng}`.
2. `POST /follower/location {lat,lng}` → reverse-geocode → store + return `area_name`.
3. Home header shows `area_name`. Feed calls pass `lat,lng`.
4. `sectionEngine.buildSections` → ctx.lat/lng → `businesses_in_category` /
   `products_in_category` compute Haversine distance to `brands.lat/lng`, sort nearest,
   return `distance_km`.
5. Cards render **"X km away"**.

## End state
A follower in Vijayawada opens the app → sees "Vijayawada" at top → Chaitanya (after
its coords are backfilled) ranked by nearest with "~2 km away". Permission denied →
city soft-boost fallback, feed still works.

## Verify
`pnpm qa` green; prod read-only checks that `brands.lat/lng` populate after re-save;
distance returned on the live category endpoint when lat/lng passed; mobile shows km +
area name. Migration **092** (run-092.js) + brand backfill (backfill-brand-coords.js,
dry-run → --apply) — both founder go.

## Diagnostic (2026-06-08)
GET /v1/internal/geocode-health — secret-safe (no key value) check of the Render
Google Geocoding key: returns google_status + error_message so we can tell
"key not set" vs "key rejected" remotely. Added because prod area_name came back null.
