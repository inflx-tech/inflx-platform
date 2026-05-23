# meals-admin-radius — admin-set platform radius + ADDRESS-FIRST chat

> **Founder lock (2026-05-23):** routing is governed by a single
> admin-set platform radius (with a ±tolerance), and the customer
> chat **always asks for the delivery address before suggesting any
> offers**. The restaurant's location is fixed at registration; the
> customer's drop is GPS-by-default with saved/new overrides.

## Backend
- **Migration 057** — `platform_meals_settings` (single row:
  `radius_km`, `radius_tolerance_m`, `min_order_lead_minutes`,
  seeded `(5, 500, 120)`); `follower_addresses` gains optional
  `lat / lng`.
- `GET / PUT /v1/admin/meals/settings` — any admin role.
- `meals.service.chat()` upgraded:
  - Extract intent → if blocking field missing → `clarify` (as before).
  - Else if **no usable `drop_location`** → **stage `address_required`**
    with the follower's saved addresses + a hint to use device GPS.
    **No offers are computed yet.**
  - Second call with `drop_location` (and `partial_intent`) →
    in-store `out_of_range` check vs the platform radius, else
    persist intent + compute offers.
- `matchAcrossRestaurants` now uses **`effectiveRadiusKm = radius_km
  + radius_tolerance_m/1000`** from `platform_meals_settings` —
  per-brand `delivery_radius_km` is no longer the primary control.

## Admin web — `/admin/meals`
A simple settings form (radius / tolerance / lead minutes) with a
live "Effective routing radius" preview. Wired via `mealsAdminApi`
in `lib/api.js`; nav entry added to the admin layout.

## Mobile
`MealsChatScreen` renders an inline address picker bubble on
`stage='address_required'`: saved-address chips, "📍 Use my current
location" (default coords until a geolocation lib lands), and "+ Add
new address" (navigates to the existing Address screen). On
selection it POSTs back with `drop_location + partial_intent`.

## Tests
- `backend/tests/meals-admin-radius.test.js` (5/5 green):
  - admin GET/PUT round-trip.
  - chat without drop → `address_required` + saved-addresses.
  - chat with drop in range → offers.
  - in-store + far drop → `out_of_range`.
  - cross-restaurant routing honours platform radius (the per-brand
    radius is ignored).
- Existing `meals-x1` + `meals-p4` chat calls updated to include
  `drop_location` (legit business-rule drift, not assertion weakening).

## Success criteria
All meals backend suites + `pnpm qa` GREEN; mobile bundle compiles;
Maestro customer journey updated with the address-pick step + run
green on the seeded device.
