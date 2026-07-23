# concept-p0-foundation — Phase 0 of the Post/Concept program

**Program:** Docs/FASHION_REBUILD/POST_CONCEPT_BUILD_PLAN.md (founder-approved 2026-07-23, "start implementation of phase 0")
**Architecture:** Docs/FASHION_REBUILD/POST_CONCEPT_MODEL.md

## Goal (functional)

Ground repair before the concept engine lands:

1. **Leaf-level category allocation.** A brand can allocate exactly "Jeans" (a
   `category_nodes` leaf, or any tree level) to a creator — not just the
   free-text mid-level `brand_products.section` string. End to end: campaign
   wizard picker → `offer_config_json.category_node_id` → live resolution via
   recursive subtree in every consumer (follower store, store-offer detail,
   creator campaign-products, creator-surface rule intersection).
2. **Rule-engine predicates for concepts.** `library_products` rule_json gains
   `offer_type` (live offer of a SPECIFIC type applies: discount/volume/bogo/
   bundle/free_gift) and `eff_price_min`/`eff_price_max` (price band on the
   EFFECTIVE price = price after best live discount offer). These are the two
   missing predicates for concept families ③ Offer and ② Price.
3. **Retire System B (Creator Experience Engine).** Delete the never-follower-
   visible design machinery: 4 admin pages, 6 backend route files + 6
   controllers + 4 services, the `experience_template` rule, creator
   ExperienceStudio + orphan MyStore/StockStore screens, AdaptiveRenderer
   components, stale QA specs/Maestro flows. Tables stay (all ship empty —
   dropped in a later phase). `creatorImagery.service` KEPT (brand-side
   approval; seeds Phase-2 media pipeline).
4. **Nav hygiene.** Hide food admin pages (Master Dishes, Meals) — vertical
   parked; add orphaned Tax Summary to nav; delete dead admin pages
   (follower-categories stub, home-builder, standalone section-library).

## Verified prod baseline (read-only, 2026-07-23, phase0-verify.js)

- fashion `category_nodes`: 234 rows = 4 segments + 35 categories + **195
  leaves**; ZERO diff vs `fashion_listing_tree.draft.csv`.
- brand_products: 91 total, 79 linked; the 12 with `category_node_id NULL` are
  ALL restaurant (parked vertical). **Zero fashion orphans — no backfill.**
- fashion `facet_definitions`: 125 across 46 scopes.

## Non-goals

Concept tables/UI (Phase 1), posts (Phase 2), follower app changes beyond
deleting the dev-flag ExperiencePreview screen, dropping System B tables.
