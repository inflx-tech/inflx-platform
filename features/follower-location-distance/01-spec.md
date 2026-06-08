# Feature Spec — Follower location + distance-ranked discovery

> Status: DRAFT (founder requested 2026-06-08; Google Geocoding key now set in
> Render). Build-ready: every root cause verified in code/prod below. Backend +
> migration + mobile (OTA). Cost note: only Google **Geocoding API** (address
> text) is used; follower coords = device GPS (free); distance = our Haversine (free).

## Goal
Follower opens the app → device GPS → feed (offers/brands/products) **ranked by
nearest**, each card shows **"X km away"**, and the **area name** (reverse-geocoded)
shows at top. Influencers ranked by **city** (text — confirmed sufficient, no
influencer coords).

## VERIFIED ROOT CAUSES (the build must fix these)
1. **Brand coords never stored.** `brand.controller.updateMe` uses
   `location.service.extractLatLng(google_maps_url)` which **returns null for short
   links** (`location.service.js:12-13`) — and the founder's saved links are
   `maps.app.goo.gl` share links → no coords. Confirmed: Chaitanya
   (`55a4e7ea-…`) has `latitude/longitude/lat/lng` ALL null; 0 of 4 restaurants have lat.
2. **Duplicate geo columns.** `brands` has BOTH `latitude/longitude` AND `lat/lng`.
   `updateMe` writes `latitude/longitude`; the distance index + discovery rules use
   **`lat/lng`** (mig 051: index on `(category, lat, lng)`). Canonical = **`lat/lng`**.
3. **No follower location storage.** `followers` has only `city` (no lat/lng/area).
4. **No distance math.** Section rules use a rough `city` soft-boost, not distance.
   No PostGIS (fine — use inline Haversine, no extension).
5. **No mobile GPS capture / distance render.**

## Scope — 4 layers
- **Layer 1 — Brand coords persistence (backend).** Refactor the geocoding logic
  (short-link expand + coord regex + reverse-geocode) from `geocoding.controller.js`
  into a reusable `geocoding.service.js` (`resolveMapsUrl(url) → {lat,lng,locality,
  city,formatted_address}` using `GOOGLE_GEOCODING_API_KEY`). In `updateMe`, when a
  `google_maps_url` is present, call it and write **`lat`/`lng`/`locality`/
  `formatted_address`** (canonical columns; keep latitude/longitude in sync for
  back-compat). Backfill existing restaurants by re-resolving their stored
  `google_maps_url` (script, founder go). Re-save/re-verify Chaitanya.
- **Layer 2 — Follower location capture (mobile + backend).**
  - Migration **090**: `followers` += `last_lat numeric(10,6)`, `last_lng
    numeric(10,6)`, `area_name text`, `location_updated_at timestamptz`.
  - Endpoint `POST /v1/follower/location { lat, lng }` (authenticated follower) →
    reverse-geocode via `geocoding.service` → store last_lat/last_lng/area_name →
    return `{ area_name }`.
  - Mobile: request location permission (RN geolocation/expo-location), get device
    lat/lng on app open, POST it, show `area_name` at top of Home, and pass
    `lat`/`lng` to the feed calls (home/category/offers).
- **Layer 3 — Distance ranking (backend).** Thread follower `lat`/`lng` through
  `sectionEngine.buildSections(opts)` → `ctx`. In `businesses_in_category` +
  `products_in_category` (and offer rules later), when ctx has coords, add a
  **Haversine** distance to `brands.lat/lng`, `ORDER BY distance NULLS LAST`, and
  return `distance_km` on each item. Haversine SQL (no extension):
  `6371*acos(LEAST(1, cos(radians($lat))*cos(radians(b.lat))*cos(radians(b.lng)-
  radians($lng))+sin(radians($lat))*sin(radians(b.lat))))`. Degrade to the existing
  city soft-boost when no follower coords / no brand coords.
- **Layer 4 — Mobile render.** Show **"X km away"** on brand/product/offer cards
  (when `distance_km` present); show the area name in the Home header. OTA publish.

## Out of scope
- Google **Distance Matrix** (road distance/ETA) — paid; not needed for "X km away".
- Influencer precise coordinates (city is sufficient — founder confirmed).

## Non-functional
- Location permission denied → fall back to city soft-boost + manual area; never block the feed.
- Geocode failures degrade gracefully (coords still work without the address name).
- Gate: `pnpm qa` green; Mobile parts UI-governed (mockup-lock + 06-diff) + maestro on
  release; migration 090 + brand backfill are production-impacting (founder go).

## Prereqs already done
- `GOOGLE_GEOCODING_API_KEY` set in Render; `GEOCODING_MOCK` opt-in/off (real path live).

## CORRECTIONS (verified 2026-06-08 against code + prod — supersede the body above)
1. **Migration number is 092, NOT 090.** 090 (home stories) + 091 (greeting) were
   consumed earlier this session. Followers location columns ship as **migration 092**.
2. **GPS = native APK, not OTA.** No geolocation dep in `package.json`;
   `LocationContext.js` states real device GPS needs a native lib (APK rebuild).
   → **Sequencing (founder-approved): OTA-first.** Build backend (L1) + mobile render
   (L2: "X km away" + area name) now, working off the existing area-switcher /
   selected location (ships OTA). Real **auto-GPS = Layer 3, deferred to the next APK**
   (`@react-native-community/geolocation`). The distance feature is fully usable via
   a selected/saved area without the APK.
3. **Backfill is two-step + a third geocode case.** (a) Copy legacy
   `latitude/longitude → lat/lng` (free, no API) — instantly fixes *Aveen food
   paradise* (has latitude 16.49/lng 80.66, lat/lng null). (b) Re-resolve
   `listing_data.google_maps_url`. **Chaitanya's saved URL is a *place* URL with NO
   coordinates and is NOT a short link** → needs **forward-geocode by name** (the 3rd
   case `geocoding.service` adds). Prod state: 4 restaurants, 0 with `lat`, only 2 have
   a maps URL → some need manual coords (founder verify, per the chosen approach).
4. **Two divergent location mechanisms** (`useLocation` hook = hardcoded Vijayawada;
   `useAppLocation`/LocationContext = switcher) — L2 consolidates the feed onto one
   source and actually threads `lat/lng` to the endpoints (today `getHomeSections`
   IGNORES the loc it's sent — now fixed: `resolveFollowerContext` reads `?lat&lng`
   or the follower's stored `last_lat/last_lng`).
5. **Missing-coords policy (founder-chosen):** forward-geocode by name automatically;
   the backfill reports each (low-confidence flagged) for the founder to verify/
   correct in admin.
