# 02 — Workflow: listing-category-browser

## Follower journey
1. Follower opens **Find** → taps "Browse fashion by category" (beta launcher).
2. App fetches the fashion tree, opens **CategoryBrowser** at the first category node.
3. Screen loads the **rail** (`GET /listing/nodes/:id/children`) and the **grid**
   for the first leaf (`GET /listing/nodes/:leafId/products`).
4. Follower taps a sub-category in the rail → grid reloads for that leaf (filters reset).
   Tapping a branch drills in (rail becomes its children, first leaf auto-selected).
5. Follower taps **Filters** / a facet chip / **Sort** → bottom sheet → toggles values →
   **Apply** → grid re-queries with `f_<key>=…&sort=…`.
6. Follower taps a product → **ProductDetail** (existing).

## Backend resolution
- `children`: `getNode(id)` + `SELECT … WHERE parent_id=id ORDER BY sort_order`.
- `products`: recursive subtree CTE → filtered/sorted/paginated page (window COUNT
  for total) + a second pass over the live set aggregating facet values + price range.
  Filter keys validated against the node's `facet_definitions` (+ `brand`); each filter
  matches a jsonb array (`?|`) OR a scalar string (`= ANY`).

## Failure modes
- Unknown node id → 404. Empty leaf → empty grid + "No products here yet."
- No facets present → sheet shows "No filters for this selection."
- Network error → caught, empty state, no crash (defensive like SectionRenderer).
