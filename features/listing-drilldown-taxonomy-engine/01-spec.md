# Feature Spec — Drill-down taxonomy + per-leaf facet engine

> Order: 2 of 6 · Depends on: — · Status: STUB (draft, not locked). Core net-new engine; #3/#5/#6 build on it.

## Problem / goal
The drill-down verticals (fashion, furniture, jewellery, footwear) have **no taxonomy tree and no per-leaf facet schema** in prod. Today categorization is a flat one-level `section` enum inside `backend/public/schemas/*.json`, and chosen attribute values are dumped into `brand_products.variants_json` (opaque JSONB, not queryable). Goal: build the **variable-depth category tree + per-leaf facet schema + queryable facet storage + "drill-once, batch-add" wizard** that the locked fashion/furniture models require. Role: **brand** (seller) + **admin** (authoring).

## Scope
- In scope: DB taxonomy tree (variable depth, leaf nodes); per-leaf facet definitions (typed: single_select / multi_select / dimension / price / bool / text; role = variant | descriptive; required flag; allowed values); queryable facet-value storage; APIs to fetch tree + leaf facets + batch-create items under a node; **drill-once-batch-add** wizard step (extends `DynamicFieldRenderer` / `ListingWizard`); admin tree+facet authoring + CSV seed import; variant axis reuse (existing `product_variants`).
- Explicitly out of scope: per-vertical data/trees (separate contracts #3/#5/#6), the dictionary mode + GTIN (#4), mobile UI (#7).

## Surfaces touched
- App(s): backend (migrations + taxonomy/facet service + API); brand-web (drill-down browse + batch-add step, facet renderer); admin-web (tree/facet authoring + CSV import).
- Roles involved: brand (approved), admin:reviewer/superadmin.

## Data / contracts
- New tables: `category_nodes(id, vertical/category_key, parent_id, name, depth, is_leaf, sort_order, room_tags?)`; `facet_definitions(id, node_id|category_key, facet_key, label, input_type, role, required, allowed_values jsonb, sort_order)`; facet values either `product_facet_values(product_id, facet_key, value)` (EAV, indexed) **or** `brand_products.facets jsonb` + GIN index (decide at lock). `brand_products` gains `category_node_id` FK.
- Endpoints: `GET /listing/tree?vertical=` ; `GET /listing/nodes/:id/facets` ; `POST /brands/me/products/batch` (N items under one node). 
- Money/units/attribution: none changed; price stays rupees `numeric`.

## Non-functional
- Auth/role gates: seller create = `requireRole('brand')`; authoring = admin.
- Failure modes: required-facet validation (locked dropdowns, no free text); variable-depth integrity (leaf-only listing); back-compat — existing flat-schema verticals keep working until migrated; large trees paginated/cached (CDN per existing category-schema pattern).
