# Workflow — Add-menu cuisines + location mock-off

## A. Location (backend)
1. `GEOCODING_MOCK` default flips to opt-in (`=== 'true'`). Prod (no env var) → mock OFF.
2. Paste a Maps share link → short-link expansion (shipped) → coords from the real URL.
   Locality is typed/confirmed by the owner. (Paid reverse-geocode address still deferred.)
3. End state: location reflects the actual restaurant, not Vijayawada. If a short link
   can't be expanded, the honest "paste the full URL" message shows.

## B/C. Add-menu cuisines (brand-web)
1. Returning brand opens Manage Menu → "Add Menu Item" → individual path.
2. `RestaurantDishPicker` derives cuisines: in-session value, else `brand.listing_data.cuisines`,
   union with cuisines added this session → dishes show (no more "none").
3. If the brand has no cuisines yet, the empty state shows a **cuisine picker** (not a
   dead-end). Picking one adds it.
4. Cuisine nav shows the brand's cuisines + an inline **"➕ Add cuisine"** (catalogue
   cuisines not yet added). Adding one:
   - reflects locally (its dishes are already in masterItems),
   - sets it active,
   - persists to `listing_data.cuisines` (PATCH /brands/me) — non-blocking.
5. Flow: **Cuisine → Section → Dish** (pick cuisine → pick section → add dish w/ price+photo).
   Business setup (hours/cost/location/photos) stays behind its own door.

## Verification
- `pnpm qa` GREEN (web/api/unit). Founder manual verify: re-open add-menu shows saved
  cuisines + dishes; "Add cuisine" appends and loads dishes; Location resolves the pasted
  link to the real area (not Vijayawada).
