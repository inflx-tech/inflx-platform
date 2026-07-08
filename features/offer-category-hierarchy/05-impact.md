# Impact — offer-category-hierarchy

**Verdict: offer category matching becomes hierarchy-aware; old offers + other
scopes unchanged.**

- Money engine: `filterItemsByScope` category branch adds a node_path match
  (shape-selected by `category_node_id`); string branch kept. Both checkout
  (placeOrder) and cart preview use the extended `fetchProductMetaMap`.
- Card badge SQL (`OFFER_APPLIES`): adds a recursive-subtree branch for
  node-scoped offers; string branch kept. Validated on dev DB (OFFER_BEST_PCT
  still executes).
- brand-web: hierarchical full-path CategoryPicker fed by the listing tree.
- Payload: `offer_config_json.category_node_id` added (additive); `category`
  now carries the full-path label. Old offers (no node id) unaffected.
- Perf: the card-badge recursive subtree runs per product on browse queries;
  catalogs are small — acceptable. Watch if very large.
- Production-impacting: Render (backend) + Vercel (brand-web) on push. No mobile,
  no OTA (offer-block already renders category label from config).
- Rollback: revert one commit; node-scoped offers would fall back to their
  string label (broader match) but not error.
