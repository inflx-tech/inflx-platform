# Listing Engine — Ordered Contract Roadmap

> Deploy-inert planning doc. Source of truth for the listing-engine build order.
> Authored 2026-06-05 after a full code + prod audit. Each item below is a
> **draft contract** (`features/listing-*/`, `lock.json.approved=false`) — no
> implementation until its Step-5 lock.

## Prod baseline (verified read-only, 2026-06-05)

- **Live verticals (only):** restaurant (34 products), car_rental (17), salon (1). Fashion/furniture/jewellery/footwear/electronics = **0 live listings**.
- **Live tables:** `brand_products` (52), `master_dishes` (129/8 cuisines), `master_vehicles` (44), `master_salon_services` (37), `categories` (16), `product_variants` (**exists, 0 rows — never used**), `section_config`, meals tables.
- **Absent in prod:** any taxonomy tree (`parent_id`), per-leaf facet table, `gtin/barcode/canonical/alias/popularity` columns, `master_products`/`master_electronics`, and the `pg_trgm/unaccent/fuzzystrmatch/vector` extensions.
- **Implication:** drill-down tree, GTIN dictionary, and the flywheel are all **net-new**; only **restaurant** has real data to protect.

## What already exists (reuse, do not rebuild)

Seller UX shell in **brand-web** is strong: `ListingWizard`, `DynamicFieldRenderer`, `RestaurantDishPicker`, `BulkUploadCard` (Excel template + validated import), `LivePreview` (phone-frame card), `QualityScore` (0–100 completeness). Variant table + CRUD exist. Per-vertical schema-driven rendering exists (JSON configs in `backend/public/schemas/*.json`). Dictionary "activation" pattern proven by restaurant/salon/car_rental.

## Ordered backlog

| # | Contract slug | Scope (one line) | Depends on | Net-new vs reuse |
|---|---|---|---|---|
| 1 | `listing-restaurant-search-flywheel` | Typeahead dish search + custom-name capture + pending queue + cross-restaurant auto-promote | — | builds the **flywheel** (reused by #4) |
| 2 | `listing-drilldown-taxonomy-engine` | Variable-depth category tree + per-leaf facet schema + queryable facet storage + drill-once-batch-add wizard | — | **core net-new engine** |
| 3 | `listing-furniture-vertical` | Register furniture template + seed tree/facets from `C:\WORK\furniture_*.draft.csv` | #2 | mostly **data** |
| 4 | `listing-electronics-dictionary` | `master_products` + Brand/Model/GTIN→variant + Icecat seed + model-search/barcode-scan | #1 (flywheel) | net-new vertical-type |
| 5 | `listing-fashion-drilldown-upgrade` | Move fashion from variant-matrix-only to tree+facets + size variant | #2 | reuse #2 (0 live products → low risk) |
| 6 | `listing-verticals-fanout` | Jewellery, footwear, flowers+gifting, pet-shop (dual-mode) as tree+facet data | #2 (+#1/#4 for pet food) | mostly **data**; may split per-vertical at lock |
| 7 | `listing-mobile-seller` *(deferred/optional)* | Greenfield RN seller listing screens mirroring brand-web wizard | #2 | greenfield |

**Parallelism:** #1 and #2 are independent and can run concurrently. Data curation for #3 and #6 can proceed while #2 is being coded.

## Governance

Each is a contract through the standard pipeline (spec → workflow → Step-5 lock → mockups → impact → implement → verify → release). Migrations are **production-impacting** (Render/Supabase) → surfaced for explicit go, never silent. `pg_trgm`/`unaccent` enablement (#1) and all new tables (#2, #4) are additive.
