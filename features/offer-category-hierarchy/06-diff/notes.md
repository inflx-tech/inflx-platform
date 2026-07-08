# Before/after — offer-category-hierarchy

## Before
- Offer category scope matched `bp.section` (leaf's mid-level category, e.g.
  "Topwear") — couldn't distinguish Men's vs Women's, nor reach a subcategory
  like "Jeans". Picker listed only sections of existing products.

## After
- Offer category scope stores `category_node_id` (+ `category` = full-path
  label). A product matches if the offer's node is anywhere in its category
  ancestor path — any level (segment / category / subcategory).
- **Money engine**: `fetchProductMetaMap` adds `node_path` (recursive CTE);
  `filterItemsByScope` matches by node_path when a node id is present (legacy
  string kept). Powers checkout + cart preview.
- **Card badge**: `OFFER_APPLIES` gains a recursive-subtree branch for
  node-scoped offers (legacy string kept).
- **brand-web**: OffersLibrary fetches the listing tree; CategoryPicker shows
  the full hierarchy as searchable full-path rows (with per-node product
  counts), stores node id + label; food/salon fall back to flat sections.

## Verification
- Engine node-match end-to-end on dev DB: product "T-Shirt › Topwear › Men"
  matches an offer scoped to "Men" (₹99.9 on ₹999); rejects a fake node.
- Card SQL (OFFER_BEST_PCT with the recursive subtree branch) executes on dev DB.
- brand-web `next build` ✓; `pnpm qa` GREEN (79). Old offers + store/product
  scopes unchanged.
- After-capture owed on the founder walkthrough.

## Deploy
Render (backend) + Vercel (brand-web) on push. No mobile, no OTA.
