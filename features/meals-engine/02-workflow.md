# meals-engine — workflow

## Build
1. `backend/src/services/mealsEngine.service.js` — pure E1–E4 functions.
2. Wire into `meals.service`: `computeOffers` (engine pricing +
   cross-restaurant routing + ranking), `lockAndPay` (capacity + freeze
   via `isSlotOpen`), `getDashboard` (`order_book` status +
   `aggregateDemand`).
3. Tests: `meals-engine.test.js` (pure) + `meals-p3.test.js`
   (integration).

## Test
- `cd backend && npx jest tests/meals-engine.test.js tests/meals-p1.test.js tests/meals-p2.test.js tests/meals-p3.test.js --runInBand` → all green.
- `pnpm qa` → GREEN (web lane unaffected).

## Expected end state
Offers reflect time-decay pricing; slots freeze at cutoff and fill to
capacity; cross-restaurant routing works by distance/favourites.
Deploy-inert until the single end-of-program prod push.
