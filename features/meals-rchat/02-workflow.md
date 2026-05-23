# meals-rchat — workflow

## Build
1. `ai/mock.js` + `ai/client.js` + `ai/index.js` — `extractRestaurantOffer`.
2. `meals.service.restaurantChatCreateOffer` — joins menu prices, inserts `status='suggested'`.
3. Controller + route `POST /v1/meals/restaurant-chat`.
4. brand-web `mealsApi.restaurantChat` + Setup tab create-by-chat box.
5. Test `meals-rchat.test.js`.

## Test
- `cd backend && npx jest tests/meals-rchat.test.js --runInBand` → green.
- All meals backend suites green; `pnpm qa` green.

## Expected end state
Owner types *"family pack with 2 chicken biryani + 2 veg biryani, ₹90
off, free raita"* → AI parses → suggested rule appears in the AI
section above with base ₹1,040, flat ₹90 discount, free Raita →
owner Accepts → goes live.
