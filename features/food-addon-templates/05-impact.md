# Impact Analysis — Reusable customisation templates

## Affected files
- backend/migrations/117_addon_templates.sql (NEW) + scripts/run-117.js (NEW)
- backend/src/controllers/brandAddonTemplates.controller.js (NEW)
- backend/src/routes/brand.routes.js (3 routes)
- backend/tests/food-addon-templates.test.js (NEW)
- Packages/brand-web/app/dashboard/products/components/restaurant/CustomiseDishModal.js
  (library: fetch, "Add from saved", "Save as reusable")
- Packages/brand-web/lib/api.js (getAddonTemplates / saveAddonTemplate / deleteAddonTemplate)

## Affected routes / APIs
| Method | Path | Change |
|---|---|---|
| GET | /brands/me/addon-templates | NEW |
| POST | /brands/me/addon-templates | NEW (upsert by name) |
| DELETE | /brands/me/addon-templates/:id | NEW |

## Affected workflows (regression surface)
- Customise modal — additive (two buttons + a fetch). The saved/applied groups
  become normal product addon groups (existing save path unchanged).
- No follower/order change.

## Migration / deploy / OTA impact
- Migration 117 (new table) — applied to prod. Backend → Render; brand-web →
  Vercel. No mobile/OTA.

## Risk notes
- Copy-on-apply → no cross-dish coupling, order snapshots untouched. New table is
  brand-scoped + ownership-guarded. Additive throughout.
