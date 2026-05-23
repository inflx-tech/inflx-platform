# meals-restaurant-web — workflow

## Build
1. Backend: add `getConfig`/`listSlots`/`listOfferRules`/
   `updateOfferRule`/`getDashboard` to `meals.service` + controller +
   routes.
2. brand-web: `mealsApi` in `lib/api.js`; `Meals` nav item in
   `app/dashboard/layout.js`; `app/dashboard/meals/page.js` (Setup +
   Today tabs).
3. Backend test `backend/tests/meals-p2.test.js` for the new endpoints.
4. Playwright `qa/web/brand/meals-setup.spec.ts` — seed a brand
   session, stub the meals APIs, render both tabs, screenshot.

## Test
- `cd backend && npx jest tests/meals-p2.test.js --runInBand` → green.
- `pnpm qa` → GREEN incl. the new brand spec; screenshots written to
  `qa/artifacts/screenshots/`.

## Expected end state
The restaurant can manage offers by party size, edit the discount
clock, create custom offers, and watch the live order book — all on
`/dashboard/meals`. Zero regression. Deploy-inert until the single
end-of-program prod push.
