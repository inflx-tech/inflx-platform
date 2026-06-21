# Impact Analysis — Food World Phase 2: owner editor

## Affected files (read or change)
- backend (Slice A):
  - NEW `src/controllers/productAddons.controller.js` — getAddonGroups +
    replaceAddonGroups (mirrors productVariants.controller pattern).
  - NEW `src/routes/productAddons.routes.js` — GET/POST under /brands/me.
  - `src/routes/index.js` — mount the new router next to productVariants.
  - `src/controllers/brand.controller.js` — add `badge`,`is_featured`,
    `featured_sort` to updateProduct ALLOWED.
  - NEW `tests/food-addon-write.test.js`.
- web (Slice B):
  - `Packages/brand-web/app/dashboard/products/components/restaurant/RestaurantDishPicker.js`
    — per-dish Customise modal + button.
  - `Packages/brand-web/app/dashboard/products/components/publishDriver.js`
    — `_addon_groups` branch (POST after product create), mirror `_variants`.
  - `backend/public/schemas/restaurant.json` — badge/featured item_fields +
    delivery brand_config fields (free_delivery, delivery_eta_min/max).
  - delivery-settings control (restaurant config step).

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| GET | /brands/me/products/:productId/addon-groups | NEW | brand-web modal |
| POST | /brands/me/products/:productId/addon-groups | NEW (bulk-replace) | brand-web modal |
| PATCH | /brands/me/products/:pid | +badge/is_featured/featured_sort | brand-web modal |
| PATCH | /brands/me | reuse listing_data for delivery | brand-web settings |

## Affected workflows (regression surface)
- Existing product create/update (all verticals) — unchanged; only the
  updateProduct allow-list grows (additive). Covered by existing brand/product
  tests + `pnpm qa`.
- Phase-1 follower read (`GET /follower/products/:id`) — now returns real
  groups once authored; shape unchanged. Covered by food-customisation.test.js.
- Order pricing (Phase 1) — unchanged; this contract only authors the data the
  pricer already consumes.

## Migration / deploy / OTA impact
- New migration? NO — Phase-1 migration 113 already created the tables/columns
  (applied to prod).
- Backend (Slice A) → push → Render redeploy. Production-impacting; additive,
  surfaced for explicit go.
- brand-web (Slice B) → push → Vercel redeploy. UI-governed (mockup-lock +
  06-diff gates apply).
- Mobile/OTA? NO.

## Risk notes
- Bulk-replace hard-deletes addon rows; SAFE because `follower_orders.items_json`
  is a value snapshot (no FK). Verified in Phase-1 audit.
- Ownership guard on every addon write prevents cross-brand edits.
- No money-path change; pricing logic untouched (Phase-1 owns it).
