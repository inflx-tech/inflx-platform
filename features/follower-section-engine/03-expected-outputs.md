# Expected Outputs — Follower Section Engine (Phase A)

> Step 4. Concrete, checkable outputs the implementation + QA must produce.

## 1. Migration 083 applied
- `section_config` table present with the columns + CHECKs in `01-spec.md`.
- `uniq_section_instance` unique index + `idx_section_screen_scope` partial index.
- Re-running `run-083.js` is a no-op (idempotent: `IF NOT EXISTS` + `ON CONFLICT
  DO NOTHING`). Sanity output: table exists, seed row count ≥ expected.

## 2. Seeded global defaults (transcribed from SECTION-CATALOG.md)
- **home** (9 shelves, positions 1–9, default counts/enabled per the catalog):
  `stories`(12,on) · `browse_category`(7,on) · `whats_hot`(5,on) ·
  `top_picks`(8,on) · `top_in` rails (admin-config; seed Eat×Brands/Products/Offers
  + Shop×Brands as the catalog's worked example) · `new_this_week`(8,**off**) ·
  `because_you_follow`(8,optional) · `biggest_discounts`(8,optional) ·
  `deals_ending_soon`(8,on).
- **category** default template (per-vertical seeded global): `subcat_chips` ·
  `top_creators` · `popular_businesses`(brands) · `trending_items`(products,
  on Eat/Shop / off services) · `best_deals`(offers) · `filter_bar` ·
  `all_businesses`.
- **offers**: `supercat_chips` · `sort_bar` · `todays_best_deal`(hero, AUTO) ·
  `category_offer_rails` · `all_offers`.
- **creator_store**: `profile_header` · `bio` · `store_collabs`(brands) ·
  `category_tabs` · `what_promotes`(products/offers) · `top_picks`.
- **creator_category**: `header` · `subcat_chips` · `partner_businesses`(brands) ·
  `picks_in_category` · `top_in_category`.
- Reels shelves intentionally **absent** (deferred to 52.8).

## 3. Endpoint responses
`GET /v1/follower/home?city=Vijayawada` →
```json
{ "success": true, "data": { "sections": [
  { "key": "stories", "title": "Stories", "type": "creators", "items": [ … ] },
  { "key": "browse_category", "title": "Browse by Category", "type": "nav_tiles", "items": [ {7 verticals} ] },
  { "key": "whats_hot", "title": "What's Hot in Vijayawada", "type": "offers", "items": [ … 4-ID tracked … ] },
  … shelves in position order, disabled shelves omitted …
] } }
```
- Every offer/product/brand item carries `tracking:{cid,sid,oid,iid,url}`.
- `new_this_week` absent from the response (seeded `enabled=false`).
- The four other endpoints return their seeded shelves analogously.

## 4. Test evidence (recorded into lock.json release block on release)
- Per-rule API test green: each rule ranks in the asserted order over a fixture.
- 4-ID tracking present on every actionable item (assertion).
- Envelope + graceful-empty (empty shelf → `items:[]`, HTTP 200, never 500).
- `pnpm qa` GREEN — zero regression vs existing follower feeds.
- `pnpm qa:db` (informational) — 083 applies + idempotent re-run.

## 5. Honest non-outputs (so QA isn't faked-green)
- No admin endpoint/UI (Phase B).
- No mobile rendering change (Phase C) — production screens unchanged.
- `top_by_sales` product attribution: if the lock defers the product→offer
  resolution, the `trending_items` (products) rails ship **disabled** rather than
  with fabricated data — flagged, not faked.
