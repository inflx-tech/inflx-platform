# Impact Analysis — reuse auto-fill + skip-steps

## Affected files
- backend/src/controllers/productAddons.controller.js — replaceAddonGroups now
  upserts each saved group into brand_addon_templates.
- backend/tests/food-addon-write.test.js — auto-populate test (NEW case).
- Packages/brand-web/app/dashboard/products/components/publishDriver.js —
  canSkipBrandSteps location special-case.
- (one-off prod backfill of brand_addon_templates from existing groups; run via
  a script, no migration.)

## Affected routes / APIs
| Method | Path | Change |
|---|---|---|
| POST | /brands/me/products/:id/addon-groups | also upserts the brand library |

## Affected workflows (regression surface)
- Customise save — unchanged result for the product; additively fills the library.
- Listing wizard step flow — returning restaurants now skip brand steps (the
  intended behaviour); brands without products / missing required fields still
  see the full wizard.

## Migration / deploy / OTA impact
- No migration (brand_addon_templates from mig 117 exists). Backend → Render;
  brand-web → Vercel. Prod backfill already run. No mobile.

## Risk notes
- Library auto-fill is idempotent (upsert by name), best-effort within the same
  transaction as the group save. canSkipBrandSteps change only relaxes the
  location requirement using data getListingConfig already returns.
