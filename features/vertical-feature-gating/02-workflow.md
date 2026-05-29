# Workflow — Vertical feature-gating

## Actors
- Restaurant brand (category=`restaurant`, schema features.meals=true, booking=true)
- Car-rental brand (category=`car_rental`, no meals flag, booking=true)
- Fashion brand (category=`fashion`, no meals flag, booking=false)

## Flow A — nav visibility (brand-web dashboard)
1. Brand logs in, lands on `/dashboard`.
2. Layout fetches `GET /brands/me/schema` → `schema.features`.
3. Nav renders: universal items always; `Meals` only if
   `features.meals===true`; `Bookings` only if `features.booking===true`.
4. Until the schema resolves, gated items stay hidden (no leak flash).

Expected per actor:
- Restaurant → sees Meals ✓ and Bookings ✓.
- Car-rental → no Meals; sees Bookings ✓ (it prebooks vehicles).
- Fashion → no Meals; no Bookings.

## Flow B — API guard (defense in depth)
1. A car-rental brand calls `GET /meals/config` directly (saved URL / curl).
2. `authenticate` ✓ → `requireRole('brand')` ✓ →
   `requireBrandFeature('meals')` resolves category=car_rental → schema has
   no `features.meals` → **403 FORBIDDEN**.
3. Same for `/me/bookings` on a fashion brand via `requireBrandFeature('booking')`.
4. A restaurant brand calls `/meals/config` → features.meals=true → passes
   through to the controller unchanged.

## Non-goals in this flow
- Follower-side meals endpoints are untouched.
- No data migration; existing restaurant Meals data is unaffected.
