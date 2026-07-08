# Expected outputs — offer-category-hierarchy

1. `fetchProductMetaMap` returns `{ section, node_path[] }` per product.
2. `offer.service.filterItemsByScope` matches category scope by node_path when
   `category_node_id` present; legacy string otherwise.
3. `sectionRules.OFFER_APPLIES` matches node subtree for node-scoped offers;
   `OFFER_BEST_PCT` still executes on dev DB.
4. brand-web: OffersLibrary fetches the listing tree; CategoryPicker shows full
   hierarchy paths, stores node id + label; buildOfferConfig emits
   `category_node_id`; draftFromOffer reads it.
5. `pnpm qa` GREEN; backend engine node-match unit-verified; brand-web builds.
