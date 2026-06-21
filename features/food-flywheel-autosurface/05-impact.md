# Impact Analysis — Flywheel auto-surface

## Affected files
- backend: `src/services/dishFlywheel.service.js` (searchMasterDishes union).
- brand-web: `app/dashboard/products/components/restaurant/RestaurantDishPicker.js`
  (custom suggestion label + pick-as-custom branch).
- tests: `backend/tests/food-flywheel-surface.test.js` (NEW).

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| GET | /brands/me/dishes/search | matches[] may include is_custom items | brand-web typeahead |

## Affected workflows (regression surface)
- Restaurant dish typeahead — canonical results unchanged (covered by the new
  test's canonical assertion); customs are additive suggestions.
- Capture/promotion flows untouched (pending_dishes write + admin promote
  unchanged).

## Migration / deploy / OTA impact
- No migration. Backend → Render; brand-web → Vercel. Production-impacting.
- No mobile/OTA.

## Risk notes
- Read-only addition; best-effort try/catch so the canonical typeahead never
  breaks. No write-path change, no canonical-dictionary pollution (admin
  promotion still gates master_dishes writes).
