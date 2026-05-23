# meals-customer-mobile — expected outputs

## Backend (runtime-verified — meals-p4.test.js)
- `GET /meals/store/:brandId` (no auth) → `{ brand, slots[], offers[],
  offers_by_party{}, delivery_radius_km }`; active offers priced by the
  engine; grouped by party size.
- Chat → offers → pay (₹950 on the seeded family pack) → track →
  deliver, all green.

## Mobile (compile + integration verified)
- Metro Android bundle builds (HTTP 200) with `MealsChat` + `mealsApi`
  resolved — the new screens, navigator route, and API client integrate
  into the RN graph without resolution/syntax errors.
- Screens authored to the mockups: Offers tab in the store (mockup 03);
  chat→offers→pay→locked in `MealsChatScreen` (mockup 02), with testIDs
  for Maestro (`meals-plan-chat`, `meal-chat-input`, `meal-chat-send`,
  `meal-offer-1`, `meal-pay-1`, `meal-order-confirmed`).

## Deferred (honest)
- Full interactive **Maestro run** needs a seeded local device (a
  restaurant with Meals offers + a logged-in follower). The flow is
  authored; `release.maestro_green` stays **false** until it's run
  green — gov-check Rule 5 will block the mobile RELEASE flip until then.
