# meals-customer-mobile — customer experience (P4)

> **Phase P4.** The customer side of INFLX Meals, in the follower app
> (React Native), realising the locked mockups `03` (in-store Offers
> tab) and `02` (chat → offers → pay). Plus the public store endpoint
> the Offers tab reads. Customer journey C0–C5.

## Backend
- `GET /meals/store/:brandId` (public) — the restaurant's active Meals
  offers grouped by party size + slot cutoffs + delivery radius, for
  the in-store Offers tab.
- (chat / pay / track endpoints already exist from X1 + P1.)

## Mobile (Packages/Mobile/src)
- **Offers tab inside the existing store** (`RestaurantDetailScreen.js`,
  mockup 03): added to the sticky sub-tabs (Overview / Menu / **Offers**
  / Reviews / Photos). Party-size sub-tabs, offer cards (items, price,
  freebies), a "plan-ahead / pay-before-cutoff" note, and a chat CTA.
- **`MealsChatScreen.js`** (mockup 02): chat → the AI extracts intent
  and clarifies → engine offers with the AI's starred recommendation →
  pay-before-cutoff → order-locked confirmation. Wired to
  `mealsApi.chat` / `pay` / `getStore`.
- Registered `MealsChat` in `FollowerNavigator`; `mealsApi` added to
  `services/api.js`.

## Verification
- Backend journey is runtime-verified by `backend/tests/meals-p4.test.js`
  (C0 public store + C1–C5 chat→pay→track→deliver) — green.
- Mobile JS compiles + integrates: Metro builds the full Android bundle
  (HTTP 200) with `MealsChat` / `mealsApi` resolved.
- Maestro flow `qa/maestro/local-flows/meals-customer-journey.yaml`
  authored (uses screen testIDs). **Full interactive Maestro run is
  deferred to a seeded device** — `release.maestro_green` stays false
  until then (gov-check Rule 5 blocks the mobile RELEASE flip, by design).
- `pnpm qa` GREEN (web lane unaffected — mobile + backend only).
