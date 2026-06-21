# Impact Analysis — Food dictionary expansion

## Affected files
- backend/migrations/114_food_dictionary_expand.sql (NEW, generated)
- backend/scripts/run-114.js (NEW, prod runner)
- backend/scripts/gen-food-dictionary-migration.js (NEW, generator; deploy-inert)
- backend/seeds/food_dictionary.draft.csv (NEW, locked source sheet)

## Affected routes / APIs
None changed. Existing reads that now return more rows:
- `GET /brands/me/master-catalogue` (wizard dish picker)
- `GET /brands/me/dishes/search` (typeahead)

## Affected workflows (regression surface)
- Restaurant listing wizard (RestaurantDishPicker) — more cuisines/sections/
  dishes to browse; no behavioural change. No code touched.
- No follower discovery change (that's a later slice).

## Migration / deploy / OTA impact
- New migration 114 → run on prod via run-114.js. Production-impacting (data),
  additive + idempotent. Applied to prod 2026-06-21 (129 → 360, 0 dupes).
- No web/mobile/OTA change.

## Risk notes
- Additive only (no deletes). Italian split + section reconcile use UPDATE
  matched on cuisine+section / cuisine+name — validated to produce 0 dupes on a
  clean 129 baseline. Re-runnable.
