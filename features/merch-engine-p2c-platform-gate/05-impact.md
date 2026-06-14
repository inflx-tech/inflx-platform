# Impact Analysis — Platform-page product gate

> Step 6. Backend-only.

## Affected files
- **backend:** `services/sectionRules.service.js` — **CHANGED** (2 lines):
  - `productsInCategory()` WHERE += `AND bp.pushed_to_store = true`.
  - `businessesInCategory()` `EXISTS(brand_products …)` += `AND bp.pushed_to_store = true`.
- No migration, no controller/route, no web/mobile change.

## Affected routes
| Path | Change |
|---|---|
| /follower/home, /follower/section/category/:key (product + business shelves) | filter `pushed_to_store=true` |

## Regression surface
- Home/Category product + business shelves (`sectionRules`). **Parity** on deploy (all products pushed). Offer/creator/brand shelves unchanged.
- DB-lane section tests partly pre-broken by tier-cascade; covered by node-syntax + web gate + parity reasoning.

## Migration / deploy / OTA impact
- None new. Backend `src` only → `git push` (Render). No migration/OTA.

## Risk notes
- Very low: two additive WHERE predicates, no new params/joins, parity at default-true. Reversible (revert one file).
- **Deferred (2c-2):** the "∪ allocated" union for platform products — needs a platform-allocation index; allocated products already show via creator stores (2b).
