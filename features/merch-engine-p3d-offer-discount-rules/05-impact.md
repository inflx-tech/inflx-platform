# Impact — Offer/discount section rules (Phase 3d)

**Terse verdict:** Adds two optional filters (has-offer, min-discount-%) to the section
rule — backend evaluator gains a correlated EXISTS over `brand_offers` (live, published-to-
store), builder UI gains two controls. No migration, no mobile. Additive: sections without
these filters behave identically.

## Blast radius
- `sectionRules.libraryProducts` (+ EXISTS clauses, only when the filter is set) ·
  `sectionLibrary.validateRule` (+2 fields) → Render. `section-library` builder page (+2
  controls + preview) → Vercel.
- Existing sections/rules untouched (new fields absent → no offer join runs).

## What could break + mitigation
- *jsonb scope/discount parsing*: guarded — flat on price 0 skipped; malformed config simply
  doesn't match (no 500); effective-scope COALESCE handles missing scope.
- *Perf*: the EXISTS only runs when has_offer/min_discount_pct is set; brand_offers is small.
- *Store-wide semantics*: by decision, store/category/product scopes all count (a store-wide
  20%-off qualifies all the brand's products).
- *Preview*: reuses the evaluator → preview == rendered result.

## Reversibility
- Additive; revert files. Sections that used the filters fall back to no offer filtering.

## Deploy classification
**Production-impacting** (backend evaluator + brand-web builder) → explicit founder go.
UI-governed → mockup-lock + 06-diff. No mobile/OTA/migration. released=false until verified.
