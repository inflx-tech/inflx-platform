# meals-admin-radius — workflow

## Build
1. Migration 057 — `platform_meals_settings` + `follower_addresses` lat/lng.
2. Backend: `getPlatformSettings`/`updatePlatformSettings`/
   `effectiveRadiusKm`/`brandInRange`/`listFollowerAddresses` +
   chat address-first branch + matchAcrossRestaurants uses platform
   radius. Admin GET/PUT endpoints.
3. brand-web: `mealsAdminApi`, `/admin/meals` page, nav entry.
4. Mobile: `MealsChatScreen` address picker bubble + `submitWithAddress`.
5. Tests: `meals-admin-radius.test.js`; updated `meals-x1` + `meals-p4`.
6. Maestro: extend the customer journey flow with the address-pick step.

## Test
- `cd backend && npx jest tests/meals-*.test.js --runInBand` → all green.
- `pnpm qa` → GREEN (web lane unaffected).
- Metro bundle build (HTTP 200) → RN graph compiles with the picker.
- Maestro `qa/artifacts/meals-e2e/run-journey.yaml` rerun → GREEN with
  the new address-required step.

## Expected end state
- Admin can set radius + tolerance + lead time at `/admin/meals`.
- Customer chat always confirms delivery before suggesting offers.
- In-store chat refuses out-of-range deliveries.
- Cross-restaurant routing uses platform radius only.
