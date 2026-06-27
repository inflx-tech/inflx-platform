# 01 — Spec: listing-category-browser (Type-1 result page)

## Problem
The follower app has no "category browse" result page. Tapping a category can only
open a flat product grid (`SectionResults`). The locked follower VISION needs a
**Type-1** result: a left rail of sub-categories + a right product grid + facet
filter chips, drilling the existing `category_nodes` tree (fashion / furniture).
This is Program A · Phase 1 of the locked build plan (`project_follower_build_plan`).

## Scope (this contract)
- **Backend (2 public reads on the already-mounted `/listing` router):**
  - `GET /listing/nodes/:id/children` — the sidebar rail (a node + its direct children).
  - `GET /listing/nodes/:id/products` — the grid: live products in the node's
    **subtree**, with facet filtering (`f_<facet_key>=v1,v2`), price range, sort
    (`new|price_asc|price_desc|discount`), pagination, **plus** the available filter
    values aggregated over the live set (drives the chips) + price min/max.
- **Mobile:** `CategoryBrowserScreen` (toing palette) — rail + grid + filter/sort
  sheet; registered route `CategoryBrowser`. API helpers `listingNodeChildren`,
  `listingNodeProducts`, `listingTree`.
- **Entry (beta, this phase):** a launcher on `FindScreen` ("Browse fashion / furniture
  by category") + forward-compatible `navigateCategory` honouring `category_node_id`.
  Full wiring onto category tiles is Phase 2 (destination chooser) + Phase 5 (category scope).

## Out of scope
- Food browse (master_dishes cuisine→section — a separate variant, later).
- The "On tap → destination" chooser (Phase 2), themed Collection pages (Phase 4).
- Any new migration. Reads existing `category_nodes`, `facet_definitions`, `brand_products`.

## Live gate (mirrors sectionRules.productsInCategory)
Approved brand (`users.status='approved'`) AND `brand_products.is_active=true` AND
`pushed_to_store=true`. Subtree match via recursive walk of `category_nodes`.

## Grounding (file:line)
- Tree + facets: `taxonomy.service.js:20-69`; node columns `migrations/095:15-36`.
- Product facet values on `brand_products.facets` jsonb (keyed by `facet_key`),
  written `listing.controller.js:106-122`, validated `taxonomy.service.js:80-106`.
- Live-gate + subtree + product shape mirrored from `sectionRules.service.js:651-694, 756-761, 577-608`.

## Acceptance
- `children` returns a node + ordered children.
- `products` returns mapped products (id/name/price/mrp/discount/brand/rating),
  honours filters/price/sort/pagination, and returns `filters[]` with only values
  present in the live set + `price{min,max}`.
- Mobile screen renders rail + grid + working filter/sort sheet; product tap →
  ProductDetail. Empty states are graceful. No regression to existing screens.
