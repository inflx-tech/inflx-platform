# Impact Analysis — Product push-to-store + brand-store gate

## Affected files
- **backend:**
  - `migrations/101_product_push_to_store.sql` — **NEW**. `brand_products.pushed_to_store boolean NOT NULL DEFAULT true` + partial index. Default true = behaviour-preserving.
  - `scripts/run-101.js` — **NEW**.
  - `services/follower.service.js` — **CHANGED**. `resolveBusinessStore()` product query gains `AND pushed_to_store = true`.
  - `controllers/brand.controller.js` — **CHANGED**. `listProducts` SELECT returns `pushed_to_store`; `updateProduct` ALLOWED includes `pushed_to_store`. (create relies on DB default true.)
- **web (brand-web):**
  - `app/dashboard/products/page.js` — **CHANGED**. "Show in store" toggle in `ProductFormModal` + `ProductRow` (standard flow).
  - `app/dashboard/products/components/ListingTemplateLayout.js` — **CHANGED**. "Show in store" toggle on `DefaultFleetRow` + a `handleTogglePush` wired through `FleetView` (drill-down / fashion flow — the one the founder uses).

## Affected routes
| Method | Path | Change |
|---|---|---|
| GET | /business/:brand_id (resolveBusinessStore) | now filters `pushed_to_store=true` |
| GET | /brands/me/products | returns `pushed_to_store` |
| PATCH | /brands/me/products/:id | accepts `pushed_to_store` |

## Regression surface
- Brand-store rendering (resolveBusinessStore). **Parity** via default true (every existing + new product pushed). The follower brand store payload is identical to today until a brand un-pushes.
- No change to platform pages (2c), creator store (2b), listing, allocation, links, money.

## Migration / deploy
- Migration **101** — production-impacting (additive column, default true = parity, partial index). Idempotent. Auto-applied to test/dev; prod via `run-101.js`. Backend + brand-web → push. No mobile/OTA.

## Risk notes
- Low: additive, default true → zero follower-visible change on deploy. Un-push is reversible; never deletes. Brand store gains one WHERE clause.
