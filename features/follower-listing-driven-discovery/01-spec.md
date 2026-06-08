# Feature Spec — Listing-driven discovery (offer-independent)

> Status: LOCKED (founder 2026-06-07 "pls start and build"). Backend + section_config data.
> Mobile already renders brands/products/creators shelves — no app change.

## Problem / goal
Founder dogfood: a listed, **approved** restaurant (Chaitanya Food Court, Vijayawada, 10
dishes) with a contracted influencer (Sagar, 5 product picks) showed **nothing** in the
follower app. Root cause: **every Category-screen shelf ranks the live-offer chain**
(`campaign_offers` via `OFFER_FROM`/`liveOfferExists`), so discovery is gated behind a deal.
That contradicts "what you list is what you see." Goal: make **businesses + products +
creators discoverable BY CATEGORY without any campaign/offer**; offers become an overlay
(the "Best deals" shelf), not the price of admission.

## Scope
- **In scope (backend + data):**
  - **3 new listing-driven rules** in `sectionRules.service.js` (offer-independent):
    - `businesses_in_category` — approved brands in the category that have a live menu
      (city = soft boost, not a hard filter).
    - `products_in_category` — active products from approved brands in the category.
    - `creators_in_category_listing` — creators who have **picks** (`influencer_product_notes`)
      on active products in the category (no live offer needed).
  - **Migration 088** re-points the seeded Category shelves: `top_creators` →
    `creators_in_category_listing`; `popular_businesses`/`all_businesses` →
    `businesses_in_category`; `trending_items` → `products_in_category` (+ enable). The
    "Best {category} Deals" shelf stays offer-based (the overlay).
- **Explicitly out of scope:** Home-screen listing shelves (next), Business Page / Creator
  Store changes (already listing-based via resolveBusinessStore — verify separately), the
  offer-source mismatch (campaign_offers empty — separate fix), product-ranking by sales.

## Surfaces touched
- backend: `sectionRules.service.js` (+ RULES registry), `migrations/088_*.sql`, `scripts/run-088.js`.
- No web, no mobile. `SECTION_ENGINE_CATEGORY` is already ON (v68); smart-fallback keeps it safe.

## Data / contracts
- No schema change — 088 is an UPDATE on `section_config` data. Rules read `brands`
  (category + users.status='approved'), `brand_products` (is_active), `influencer_product_notes`.
- City: soft boost (`cityBoost`), so a Vijayawada restaurant shows to any follower, ranked higher in-city.

## Non-functional
- Unknown-rule safety: `runRule` returns [] for any stray key (no 500).
- Smart-fallback (`hasEngineContent`) shows the old view if a shelf is empty.
- Gate: `pnpm qa` green; backend-only → Rule 1 + Rule 2. Render deploy + prod 088 surfaced for go.
