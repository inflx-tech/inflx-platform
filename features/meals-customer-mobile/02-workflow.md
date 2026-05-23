# meals-customer-mobile — workflow

## Build
1. Backend `GET /meals/store/:brandId` (authenticateOptional) +
   `meals.service.getStore`.
2. Mobile: `mealsApi` in `services/api.js`; `MealsChatScreen.js`;
   Offers tab + `MealsOffersTab` in `RestaurantDetailScreen.js`;
   `MealsChat` route in `FollowerNavigator.js`.
3. Maestro flow `qa/maestro/local-flows/meals-customer-journey.yaml`.

## Test
- `cd backend && npx jest tests/meals-p4.test.js --runInBand` → green.
- Metro bundle build (`curl .../index.bundle?platform=android`) → HTTP
  200 (RN graph compiles with the new screens).
- `pnpm qa` → GREEN (web lane unaffected).
- Maestro: run on a seeded local device (prereqs in the flow header);
  on green set `release.maestro_green=true`.

## Expected end state
A customer opens a restaurant's store, browses planned-meal offers in
the Offers tab, plans by chat, and pays before the cutoff. Deploy-inert
until the single end-of-program prod push.
