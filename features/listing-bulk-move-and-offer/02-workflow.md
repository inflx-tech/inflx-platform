# Workflow — Bulk Move category + Attach offer

## W1 — Move mis-filed products

1. Inventory → tick 3 products → bulk bar appears.
2. **Move category** → modal opens with the brand's category tree, leaves
   selectable only.
3. Brand picks `Men › Ethnic › Kurtas` → **Move 3 products**.
4. `POST /brands/me/listing-products/move { product_ids, target_node_id }`.
5. Server, per product: confirm brand ownership → validate against the target
   leaf's facets → check size-system compatibility → rewrite
   `category_node_id`, `category_key`, `super_category`, `section`.
6. Response lists what moved and what did not, each with a reason.
7. UI reports `2 moved, 1 skipped — "Silk Kurta": Sleeve length is required`,
   refetches, and the tree counts change.

**End state:** the products sit under the right leaf, keeping their SKU, photos
and variants; anything that could not move honestly said so.

## W2 — Put products on an existing offer

1. Inventory → tick products → **Attach offer**.
2. Modal lists the brand's eligible offers (`discount` / `volume`, scope
   `products` or legacy-empty). Ineligible offers are listed greyed with the
   reason ("Bundle offers need a fixed set", "This offer applies store-wide").
3. Brand picks one → **Attach 5 products**.
4. `POST /brands/me/offers/:id/products { product_ids }` merges them into
   `offer_config_json.products`, deduped.
5. UI reports `5 attached (2 already on this offer)`.

**End state:** the offer's product scope contains the selection; re-running the
same attach changes nothing.

## W3 — Refusals are visible, not silent

- Move to a leaf whose required facets the product lacks → refused, named.
- Move across different size systems → refused, named.
- Attach to a `store`-scoped offer → not offered; the modal explains why.

## Success test

`pnpm qa` GREEN, including new unit tests over the pure eligibility rules, plus
W1–W3 reaching their end states in the real app.
