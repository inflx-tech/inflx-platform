# offer-category-hierarchy — scope an offer to any level of the category tree

## Founder (2026-07-08)
The offer Category picker must show the ENTIRE hierarchy — "Men › Bottomwear ›
Jeans", "Men › Topwear › T-shirt" — not just the mid-level category. Scoping an
offer to any node should discount products in that node's subtree.

## Root cause
Offers matched category scope on `bp.section` = the leaf's `category` (mid-level
only, e.g. "Topwear"). So an offer couldn't distinguish Men's vs Women's, nor
reach a subcategory like "Jeans". The picker also only listed sections of
existing products.

## Fix — node-based subtree matching (hierarchy-aware)
Offer category scope now stores `category_node_id` (+ `category` = full-path
label for display). A product matches if the offer's node is anywhere in the
product's category ancestor path (segment / category / subcategory — any level).

### Backend (money engine — the correctness-critical path)
- `fetchProductMetaMap` (transaction.controller): adds each product's `node_path`
  (leaf category node → root) via a recursive CTE. Powers previewCartOffer AND
  placeOrder (both already use it).
- `offer.service.filterItemsByScope`: category branch matches by `node_path`
  when `category_node_id` is present; legacy string-section match kept for old
  offers.
- `sectionRules.OFFER_APPLIES` (browse-card badge): category branch matches the
  product's node against the offer node's recursive SUBTREE when
  `category_node_id` is present; legacy string match otherwise.

### brand-web
- OffersLibrary fetches the brand's listing tree (`/brands/me/listing-tree`) and
  passes it to the builder.
- CategoryPicker becomes a searchable FULL-PATH hierarchy (all levels), storing
  the node id + label. Falls back to flat sections for food/salon (no tree).

## Back-compat
Old offers (category string, no node id) resolve and badge via the legacy
string branch — unchanged. Store/product scopes unchanged.

## Acceptance
Fashion offer scoped to "Men › Bottomwear › Jeans" discounts only men's jeans;
scoped to "Men" discounts everything under Men. Old category offers still work.
`pnpm qa` GREEN; backend engine + card SQL validated on dev DB; brand-web builds.
