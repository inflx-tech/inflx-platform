# Drill-down taxonomy engine — impact

## Verdict (terse)
Additive + net-new. Zero change to existing verticals (restaurant/car/salon keep
their flat schema); fashion/furniture have 0 live products. New tables + two
nullable `brand_products` columns + new API routes only.

## Mechanics
- **Migration 095 (additive, idempotent):** `category_nodes` (variable-depth tree),
  `facet_definitions` (typed per-leaf facets), `brand_products.category_node_id`
  (nullable FK) + `brand_products.facets` jsonb (default `{}`) + GIN index. Nothing
  existing references the new column until a vertical is migrated to the tree.
- **Seed:** `scripts/seed-fashion-taxonomy.js` (deploy-inert script + CSVs) loads the
  reviewed fashion taxonomy. Idempotent (wipes vertical='fashion' first — safe, 0 live
  fashion products).
- **Backend:** `taxonomy.service.js` (tree/facets/validation, pure validation incl.
  locked-dropdown) + `listing.controller.js` + `listing.routes.js`. New routes:
  `GET /listing/tree`, `GET /listing/nodes/:id/facets` (public read), and
  `POST /brands/me/products/batch` (brand auth). No existing route touched.
- **Money/units:** unchanged — price stays rupees numeric. No pricing/commission code touched.

## Schema decision (locked)
Facet **values** live in `brand_products.facets` jsonb + GIN (mirrors `variants_json`),
NOT an EAV table — simpler, filterable, one row per product.

## Risk / blast radius
Low. New tables + new routes + 2 nullable columns. Rollback: drop the new routes
(revert) + the additive migration objects are inert if unused. Verified end-to-end on
the local dev DB before any prod step.

## Validation (sandbox)
`pnpm qa` not runnable here → `qa_all_green: null`. Substituted with: migration applied
to local `inflx_dev`; seed loaded (3/29/185/95); backend `src/app` loads; tree/facets/
validate exercised; insert + GIN filter (string + array) proven, then cleaned up.
