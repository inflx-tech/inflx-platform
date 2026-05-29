# Feature Spec — Vertical feature-gating (nav + API)

> Step 2 of the contract-driven workflow. Written and agreed BEFORE code.
> Triggered by founder report (2026-05-29): a car-rental brand sees the
> restaurant-only **Meals** tab; non-booking verticals see **Bookings**.

## Problem / goal
Features built for one vertical leak into others. The brand dashboard nav
(`Packages/brand-web/app/dashboard/layout.js`) renders a static 12-item
`NAV` to **every** brand regardless of `brands.category`, and the
brand-side **Meals** + **Bookings** API routes are gated only by
`requireRole('brand')` — no category check. Result: a car_rental /
fashion / beauty brand sees and can call restaurant-only Meals, and
non-booking verticals see Bookings.

Goal: a brand only sees + can reach the features its category schema
declares. Source of truth = `public/schemas/<category>.json` `features`
block (already consumed by the Listings wizard via `/brands/me/schema`).

## Scope
- In scope:
  - Backend guard `requireBrandFeature(featureKey)` (resolves the brand's
    category → schema → `features[featureKey]===true`, else 403).
  - Apply `requireBrandFeature('meals')` to the 11 brand-side Meals routes.
  - Apply `requireBrandFeature('booking')` to the 3 brand Bookings routes.
  - Add `features.meals: true` to `restaurant.json` (only vertical with it).
  - Extract `loadSchema` into `services/schema.service.js` (one source of
    truth for controller + middleware); brand.controller imports it.
  - brand-web dashboard nav filters Meals (feature `meals`) and Bookings
    (feature `booking`) by `/brands/me/schema`.
- Explicitly out of scope:
  - Follower-side Meals routes (`/meals/store/:brandId`, `/chat`,
    `/intents`, `/orders`) — target a specific brand and return empty for
    non-restaurant brands; no brand-side leak. Separate contract if needed.
  - Direct-URL navigation to `/dashboard/meals` on a non-restaurant brand:
    the link is hidden and the data calls 403, so no leak — the page just
    renders its empty/error state. A page-level redirect is a follow-up.
  - Declaring `features.meals: false` across the other 36 schemas — absent
    is treated as false; not declared to avoid 36 churny edits. Follow-up
    if convention-consistency is wanted.

## Surfaces touched (verified)
- App(s): backend + brand-web
- `backend/src/services/schema.service.js` (NEW — extracted loadSchema)
- `backend/src/middleware/auth.js` (NEW `requireBrandFeature`)
- `backend/src/routes/meals.routes.js` (11 brand routes gated)
- `backend/src/routes/brand.routes.js` (3 bookings routes gated)
- `backend/src/controllers/brand.controller.js` (import from service; drop
  dead `fs`/`path` imports)
- `backend/public/schemas/restaurant.json` (features.meals: true)
- `Packages/brand-web/app/dashboard/layout.js` (nav filter)
- Roles involved: brand

## Data / contracts
- No new tables / columns / migrations. No money/attribution/status change.
- No new API endpoints. Behaviour change: brand-side Meals + Bookings
  routes now return `403 FORBIDDEN` ("This feature is not available for
  your business type.") for brands whose category schema does not declare
  the gating feature.
- `GET /brands/me/schema` response unchanged; now consumed by the nav.

## Non-functional
- Auth/role gates: guard runs AFTER `authenticate` + `requireRole('brand')`.
  Resolves category by `brands.user_id = req.user.sub` (UNIQUE).
- Failure modes: brand row missing → 404; schema file missing → generic
  schema (features default false) → 403, fail-closed (correct).
