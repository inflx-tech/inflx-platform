# 05 — Impact: prod-verify fixes

**Verdict: one additive backend read endpoint (no migration) + mobile PDP/login fixes.
No order/money/commission logic touched.**

## Mechanics
- `backend/src/controllers/follower.controller.js` + `routes/follower.routes.js`: new
  `getProductDetail` → `GET /follower/products/:product_id` (authenticateOptional),
  SELECT full brand_products row. Additive.
- `Packages/Mobile/src/services/api.js`: `getProductDetail(id)`.
- `screens/follower/ProductDetailScreen.js`: plain-tap path fetches full product +
  merges over the card; hero → swipeable carousel (image_url + variants_json.cover_images
  + colour images) + dots; new Product Details block from `facets`; `CATEGORY_CTA_ORDER`
  fashion/furniture → online_order only (drops Pay-at-Store).
- `screens/follower/FollowerLoginScreen.js`: persist `inflx_refresh_token` on login
  (2 paths) → fixes the 15-min "session expired" on follower writes.

## Blast radius
- Backend: one new GET, no schema change, no effect on existing endpoints.
- Mobile: PDP render + follower login token storage. No change to order/payment/commission.
- The refresh-token fix repairs ALL follower writes after 15 min (address, orders,
  follows) — high value, low risk (mirrors the brand/influencer login that already does it).
- Deploy-class: production-impacting (Render backend + mobile OTA). released=false until
  founder device re-verify.
- Risk: low-medium; node --check + qa + metro bundle = syntax gates; founder device =
  behavior gate.
