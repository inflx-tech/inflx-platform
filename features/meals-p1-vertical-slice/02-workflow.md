# meals-p1-vertical-slice — workflow

## Build
1. `backend/src/services/meals.service.js` — config/slot/offer-rule
   setup, `createIntent`, `computeOffers` (deterministic), `lockAndPay`
   (mock Razorpay, cutoff guard, transactional), `getOrder`,
   `markDelivered`.
2. `backend/src/controllers/meals.controller.js` — thin HTTP wrappers.
3. `backend/src/routes/meals.routes.js` — `authenticate` + per-route
   `requireRole`. Wired at `/meals` in `routes/index.js`.
4. `backend/tests/meals-p1.test.js` — Jest + supertest E2E.

## Test (the proof)
- Bring up the test DB: `pnpm qa:db:up`.
- Run just this file: `cd backend && npx jest tests/meals-p1.test.js
  --runInBand` (globalSetup applies all migrations incl. 056).
- Cases: full happy chain (setup → intent → offers → pay → track →
  deliver); no-match → empty shortlist; pay after cutoff → rejected;
  role gates (follower can't hit brand routes, vice-versa).
- `pnpm qa` → stays GREEN (web lane unaffected — new namespace).

## Expected end state
- New `/v1/meals/*` endpoints live; the chain produces a `delivered`
  `meal_order` with the deterministically-computed amount in rupees.
- Zero regression. Deploy-inert until the final single prod push.
