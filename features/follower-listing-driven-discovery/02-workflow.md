# Workflow — Listing-driven discovery

## Flow
1. Follower opens Home → taps a category tile (e.g. **Eat** = key `dining`).
2. `GET /v1/follower/section/category/dining` → `sectionEngine.buildSections({screen:'category', categoryKey:'dining', city})`.
3. Each Category shelf runs its rule:
   - `top_creators` → `creators_in_category_listing` → creators with picks on `dining`
     products (e.g. **Sagar**, who picked 5 Chaitanya dishes).
   - `popular_businesses` / `all_businesses` → `businesses_in_category` → approved brands
     with `category IN (restaurant,bakery)` + a live menu (e.g. **Chaitanya Food Court**).
   - `trending_items` → `products_in_category` → active products from those brands (the menu).
   - `best_deals` → unchanged (offer overlay; empty until an offer exists — correct).
4. Each shelf returns items with the existing brand/product/creator shape → mobile renders
   BrandRail / ProductRail / InfluencerStoryRow. No offer required.

## Apply
- Code deploys via push (Render). Migration 088 (`run-088.js` against prod) re-points the
  config rows. Either order is safe: if config points at a rule before the code deploys,
  `runRule` returns [] (smart-fallback shows old view) until the code is live.

## Verify
- `pnpm qa` GREEN. Founder: open Eat → see Chaitanya in Popular/All Businesses, its dishes
  in Trending Items, and Sagar in Top Eat Creators — **with no offer**.
