# 01 — Spec · Food World Slice 3C-1 · Food home + discovery

**Slug:** `food-world-slice3c1-discovery`
**Surface:** Follower mobile (RN) + backend (Type-B rule, ETA, MRP).
UI-governed + Mobile-governed + backend-governed.
**Parent:** Food World Slice 3C. First of three sub-slices
(3C-1 home/discovery → 3C-2 popups + storefront → 3C-3 cart + order).
Founder confirmed requirements + the two section types 2026-06-22.

## Goal

Build the food-world **home** as the Toing-style discovery surface, food-only.
Four elements + the tap-through result screen:

1. **Dish-group rail** — admin-built `dish_groups` tiles (image + name),
   "What are you craving?". Tap → result screen.
2. **Type A — cross-restaurant dish section** ("Meals under ₹99"): one admin
   `section_library` rule → matching dishes from *all* restaurants, in a
   **horizontal** carousel. Card = image · Popular badge · pink ＋ · veg dot ·
   dish name · "by <restaurant>" · ★rating · ETA · price (+ struck MRP).
3. **Type B — restaurant-list section** (Swagruha tiffins, Kalyani Chickens):
   one card **per restaurant** = header (name · ★rating · ETA · cuisine ·
   Free Delivery · → storefront) + **nested horizontal carousel** of that
   restaurant's **featured dishes** (`is_featured`/`featured_sort`, mig 113;
   fallback first N in-stock).
4. **Filter chips** — "₹99 & under", "delivery under 30 mins", "Veg" — wired to
   filter the home list (display-only today).

**Result screen** (`DishGroupResultScreen`): tap a rail tile → nearby
restaurants serving any member dish/keyword (rating · distance · ETA ·
free-delivery · from-price · variety chips).

3C-1 is **render + navigate**. ＋ and image taps route to the existing product
screen for now; the customisation/dish-detail popups + storefront reskin are
3C-2; cart/offer/order is 3C-3.

## Where it lives (verified)

- Home = **`CategoryListScreen`** (`superCategory` eat/food). Rail + Type A +
  Type B + chips render in the dining branch (the screen owns them; not
  section-engine shelves for the rail/result). `DiningHomeScreen` is legacy
  (`SectionRenderer.js:27`).
- Result = new screen `DishGroupResultScreen` in `FollowerNavigator`.

## Backend (this slice carries 3 changes — production-impacting)

1. **Migration 118** — `brand_products.mrp numeric(10,2) NULL`. Per-dish MRP
   for the struck price. Reverses the earlier scope cut (founder decision
   2026-06-22). Struck shows when `mrp > price`; offers still overlay extra
   discount. Surface migration for explicit go before applying to Supabase.
2. **ETA = distance-based** (founder: not restaurant-set). New helper
   `etaFromDistanceKm(km)` → `{min,max}` ≈ `round5(10 + km*2)` with a +5 window;
   applied wherever `distance_km` is known (dish-group result, Type A cards,
   Type B header, storefront). Stored `listing_data.delivery_eta_*` is no
   longer the ETA source.
3. **New section rule `restaurants_with_featured`** in `sectionRules.service`
   (Type B): returns matched restaurants each with `featured[]` (their
   `is_featured` dishes by `featured_sort`, fallback first N in-stock) + header
   fields (rating via `restaurant_reviews`, cuisine + `free_delivery` from
   `listing_data`, distance). No migration. Plus `mrp` added to
   `mapListedProductItem` + `getProductDetail` payloads.

Already live (no change): `GET /follower/dish-groups` + `/:id/restaurants`
(mig 115); Type A `products_in_category`/`library_products` (rating, badge,
has_addons, veg_flag, by-restaurant).

## Design (toing white + #F8CB46; mockup `04-preview/mockups/discovery.html`)

Pink ＋ circle + pink savings (matches Toing); green veg dot + green rating
pill; yellow fills for Go/badges with ink text. **Dropped** "other apps /
lowest-price-guaranteed" competitor marketing (founder 2026-06-22).

## Edge states

- `/dish-groups` empty → rail + header hidden; sections still render.
- Type B with no featured + no in-stock → restaurant omitted from the shelf.
- Result zero matches → empty state. No location → distance/ETA hidden, ranked
  by popularity.
- `mrp` null or ≤ price → no struck price (plain price).

## Acceptance

Home renders rail + Type A + Type B + chips from real data; chips filter; tile
→ result → storefront; ETA distance-derived; MRP struck where set. Jest +
`pnpm qa` green; Maestro flow green; OTA + (migration 118 applied on go).
