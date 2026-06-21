# Impact Analysis — Fixes: redundant address + search ranking

## Affected files
- backend/src/controllers/brand.controller.js — getListingConfig (+lat/lng/
  locality/formatted_address in the response).
- backend/src/services/dishFlywheel.service.js — searchMasterDishes merge sort
  (exact-first + deterministic tiebreakers).
- backend/tests/food-flywheel-surface.test.js — exact-match ranking test (NEW).
- Packages/brand-web/app/dashboard/products/components/ListingTemplateLayout.js
  — drop the "Location" step when brand already has location (not in edit mode).

## Affected routes / APIs
| Method | Path | Change |
|---|---|---|
| GET | /brands/me/listing-config | +4 location fields in response |
| GET | /brands/me/dishes/search | ordering hardened (exact-first) |

## Affected workflows (regression surface)
- Listing wizard step flow — one step conditionally hidden; all other behaviour
  unchanged. `canSkipBrandSteps` logic untouched.
- Dish typeahead — same results, better ordering. Verified by test (4/4).

## Migration / deploy / OTA impact
- No migration. Backend → Render; brand-web → Vercel. No mobile/OTA.

## Risk notes
- Location step still reachable via Edit-setup mode (no data loss path). Search
  change is ordering-only. Both low-risk, additive.
