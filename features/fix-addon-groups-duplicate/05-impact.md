# Impact Analysis — Fix duplicate addon groups

## Affected files
- backend/migrations/116_addon_groups_dedupe.sql (NEW) + scripts/run-116.js (NEW)
- backend/src/controllers/productAddons.controller.js — replaceAddonGroups
  dedupes incoming groups by normalized name.
- backend/tests/food-addon-write.test.js — dedupe test (NEW case).
- Packages/brand-web/app/dashboard/products/components/ListingTemplateLayout.js
  + restaurant/RestaurantDishPicker.js — `key` on CustomiseDishModal.

## Affected routes / APIs
| Method | Path | Change |
|---|---|---|
| POST | /brands/me/products/:id/addon-groups | collapses same-named groups |

## Affected workflows (regression surface)
- Customise save (wizard + published-edit) — now duplicate-safe; distinct-name
  multi-group saves unchanged (food-addon-write 8/8).
- Follower read of addon_groups — unaffected (fewer/clean rows).

## Migration / deploy / OTA impact
- Migration 116 (dedupe DELETE + unique index) — applied to prod (24→2, 0 dups).
- Backend → Render; brand-web → Vercel. No mobile/OTA.

## Risk notes
- Migration DELETE keeps min(id) per (product_id,name); duplicates were
  identical, so no real data lost. Unique index is additive. Controller dedupe
  is defensive. Modal `key` forces fresh remount (no behavioural change beyond
  preventing stale-state carry-over).
