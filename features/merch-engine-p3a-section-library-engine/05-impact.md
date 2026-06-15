# Impact — Section Library engine (Phase 3a)

**Terse verdict:** Additive backend foundation. New table + new evaluator + new rule key.
DORMANT on deploy — no existing section uses it, so zero follower-visible change. The
evaluator is the existing `productsInCategory` rule generalized with sub-category/tags/price/
sort, reusing the same visibility gate, taxonomy source, and item mapper. Low risk.

## Blast radius
- New `section_library` table (empty) + `sectionLibrary.service.js` + one new RULES entry
  (`library_products`) + a small ctx pass-through in the engine. Existing rules untouched.
- Backend + migration only. No web/mobile, no OTA, no API shape change.

## What could break + mitigation
- *Existing feeds* → unchanged: `library_products` is only invoked when a section_config row's
  rule = `library_products`, which no row sets until 3c. Verified by "outputs byte-identical" test.
- *Bad rule_json* → validation in the service; evaluator treats absent axes as no-filter and an
  unknown sub-category node as "matches nothing" (never "all") — honest empty.
- *Recursive sub-category CTE* → bounded (category_nodes is small per vertical); guarded against
  cycles by the tree's parent_id structure.
- *DB-lane count* → watch for a rise; classify vs the known tier-cascade baseline.

## Reversibility
- Additive: drop usage (none yet) + revert files; table can stay (empty, harmless) or be dropped.

## Deploy classification
**Production-impacting** (backend/src + migration 103) → explicit founder go; migrate-first
then push. Dormant, so safe — visible behaviour is unchanged until 3c.
