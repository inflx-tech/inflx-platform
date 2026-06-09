# Drill-down taxonomy engine — workflow

## Actors
Brand (seller) lists products; admin authors the tree/facets; follower/app reads the tree for filtering.

## Golden path (Ship 1 — backend foundation)
1. **Seed** the vertical's tree + facets (CSV → `category_nodes` + `facet_definitions`).
   Fashion seeded via `scripts/seed-fashion-taxonomy.js` (185 leaves, 95 facets).
2. App/seller fetches the tree: **`GET /listing/tree?vertical=fashion`** → nested
   segment → category → leaf.
3. Seller drills to a leaf and fetches its schema:
   **`GET /listing/nodes/:id/facets`** → the resolved facet list
   (`scope ∈ {ALL, leaf.category, leaf.name}`), each typed + role + required.
4. Seller batch-adds under that leaf:
   **`POST /brands/me/products/batch`** `{ category_node_id, items:[{name, price, images[], facets{}}] }`.
   - Each item validated against the leaf schema (required facets, locked dropdowns).
   - Whole batch rejected if any item invalid (no partial writes).
   - Stored on `brand_products` (`category_node_id` + `facets` jsonb + `_images`).
5. Products are now **filterable** by any facet via the `facets` GIN index
   (string `facets->>'fit'='Slim'`, array `facets->'color_tone' @> '["Blue"]'`).

## Expected end state (proven on local dev DB)
- Tree returns 3 segments / 29 categories / 185 leaves.
- A leaf (e.g. Women › Western › Jeans) resolves 14 facets, 3 required, size_required=true.
- Valid item passes; invalid item returns precise errors incl. locked-dropdown rejection.
- Insert + GIN facet filtering (string + array-contains) verified, then cleaned up.

## Out of scope (later ships)
- brand-web drill-down browse + batch-add wizard UI + facet renderer (Ship 2).
- admin tree/facet authoring + CSV import UI (Ship 3).
- furniture seed on the same engine (contract #3); per-vertical data (#5/#6).
