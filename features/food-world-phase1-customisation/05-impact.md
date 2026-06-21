# Impact Analysis — Food World Phase 1 (customisation data model)

## Affected files (read or change)
- backend/migrations/113_food_customisation.sql — NEW (additive DDL).
- backend/scripts/run-113.js — NEW (prod applier, mirrors run-112.js).
- backend/src/services/sectionRules.service.js — `mapListedProductItem` +
  the two SELECTs (`productsInCategory`, `libraryProducts`) gain rating/
  review_count/badge/has_addons.
- backend/src/controllers/follower.controller.js — `getProductDetail` returns
  nested `addon_groups` (new helper query).
- backend/src/services/follower.service.js — `resolveBusinessStore` brand
  block gains free_delivery + delivery_eta (read from listing_data).
- backend/src/controllers/transaction.controller.js — `placeOrder`:
  resolve+price variation/add-ons from DB; carry variation/selected_addons/
  note into itemsJson; customisation-aware line price. `verifyOrder` is
  unchanged (snapshot already round-trips via meta.items_json).

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| GET | /follower/products/:product_id | + addon_groups | mobile PDP/popup (Phase 3) |
| GET | /follower/home, /section/*, /section-results | + rating/badge/has_addons on items | mobile food home (Phase 3) |
| GET | /follower/business/:id/store (resolveBusinessStore) | + free_delivery/eta on brand | mobile storefront (Phase 4) |
| POST | /follower/orders | accepts variation/addons/note per item | mobile cart (Phase 5) |

## Affected workflows (regression surface)
- Existing online_order place/verify — covered by qa order specs. Must stay
  green; customisation-absent path must price byte-identically.
- Section engine feeds — covered by section/listing specs. New fields are
  additive; existing assertions unaffected.
- getProductDetail — additive field; existing shape preserved.

## Migration / deploy / OTA impact
- New migration 113 → run-113.js needed (prod). LOCAL applied first.
- Backend/web only → `git push` (Render redeploys). No OTA (no mobile JS).
- No native change.

## Risk notes
- Additive DDL only; no existing table/column altered or dropped.
- The one behavioural change is placeOrder line pricing. Mitigated: pricing
  is server-side from DB; when an item carries no variation/addons the new
  line price equals the existing `lineItemPrice` exactly (regression guard
  in the test plan). Add-on item ownership validated → no price injection.
- items_json is untyped jsonb → carrying new keys needs no migration and is
  backward-compatible with existing readers (returns, analytics) that read
  product_id/variant_id/quantity/price.
