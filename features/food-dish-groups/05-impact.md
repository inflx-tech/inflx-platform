# Impact Analysis — Food dish groups

## Affected files
- backend/migrations/115_dish_groups.sql (NEW) + scripts/run-115.js (NEW)
- backend/src/controllers/adminDishGroups.controller.js (NEW)
- backend/src/controllers/follower.controller.js (getDishGroups, getDishGroupRestaurants)
- backend/src/routes/admin.routes.js (dish-groups routes, master_data gate)
- backend/src/routes/follower.routes.js (dish-groups public routes)
- backend/tests/food-dish-groups.test.js (NEW)
- Packages/brand-web/app/admin/dish-groups/page.js (NEW)
- Packages/brand-web/lib/api.js (adminApi dishGroups block)
- Packages/brand-web/app/admin/layout.js (nav entry)

## Affected routes / APIs
| Method | Path | Change |
|---|---|---|
| GET/POST/PATCH/DELETE | /admin/dish-groups[/:id] | NEW (master_data) |
| GET/PUT | /admin/dish-groups/:id/members | NEW |
| GET | /admin/dish-groups/suggest | NEW |
| GET | /follower/dish-groups | NEW (public) |
| GET | /follower/dish-groups/:id/restaurants | NEW (public) |

## Affected workflows (regression surface)
- None existing — all new endpoints + a new admin page + 2 new tables. Existing
  discovery/section endpoints untouched.

## Migration / deploy / OTA impact
- Migration 115 (2 new tables) — applied to prod 2026-06-21 (additive, idempotent).
- Backend → Render; brand-web → Vercel. Production-impacting.
- Mobile follower UI deferred to Slice 3C → no OTA in this changeset.

## Risk notes
- Additive; no change to existing tables or flows. Discovery query filters to
  approved restaurants + in-store products; ownership/gating via
  requireCapability('master_data'). Verified by food-dish-groups.test.js (3/3).
