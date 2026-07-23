# Workflow — concept-p0-foundation

## W1 — Brand allocates a leaf category
1. Brand opens campaign wizard → offer config → "Applies to" → **Category**.
2. Picker now lists the brand's listing tree as full-path rows
   ("Men › Bottomwear › Jeans (12)") from `GET /brands/me/listing-tree`;
   food/legacy brands without a tree fall back to the old flat section list.
3. Picking writes `d_category_node`/`v_category_node` (node id) + the node
   name into `d_category`/`v_category` (display + legacy fallback).
4. `buildOfferConfig` serializes `category_node_id` into
   `campaign_influencers.offer_config_json` (validator accepts node-id-only).

## W2 — Allocation resolves live by subtree
`resolveAllocatedProductIds` (follower.service): scope='category' with
`category_node_id` → recursive `category_nodes` subtree over the brand's
live pushed products; legacy configs (string only) keep `section = $2`.
Consumers inheriting the fix: `GET /store/:handle` (creator storefront),
`GET /follower/store-offer/:id` (explicit same branch), creator-surface
`library_products` intersection (`creatorAllocatedProductIds` delegates), and
`GET /influencers/me/campaigns/:ci_id/products` (NEW: store/category scope now
resolves via the same resolver instead of falling to "all brand products" —
creator sees the SAME universe followers do).

## W3 — Admin composes concept-shaped rules
`section_library.rule_json` accepts `offer_type` ('discount'|'volume'|'bogo'|
'bundle'|'free_gift') and `eff_price_min`/`eff_price_max` (≥0, min ≤ max) —
validated in sectionLibrary.validateRule, executed in libraryProducts as:
- offer_type → EXISTS live `brand_offers` of that type that APPLIES (reuses
  OFFER_LIVE_GATE + OFFER_APPLIES).
- eff band → `bp.price * (1 - COALESCE(OFFER_BEST_PCT,0)/100)` between bounds
  (products with no live discount = plain price).

## W4 — System B gone, app boots clean
/admin/design-system|themes|design-library|experience-templates return 404
(pages + routes deleted); App Builder/world-rules/custom-pages/category-images
unchanged; `experience_template` config rows (none in prod) fall through
runRule's unknown-rule guard → hidden. Influencer app: no Create Experience
tile, no ExperienceStudio/MyStore/StockStore routes; follower Profile has no
dev preview entry. Food admin pages hidden from nav (routes still mounted);
Tax Summary now reachable.

## Expected end state
`node --check` green on all edited backend files; mobile jest green except the
pre-existing FollowerWalletScreen transform failure (documented, untouched);
backend boots with routes/index.js mounting no deleted file; gov-check passes.
