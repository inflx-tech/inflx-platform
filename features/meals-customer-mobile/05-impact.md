# meals-customer-mobile — impact

## Blast radius
- Backend: one public endpoint (`GET /meals/store/:brandId`) +
  `getStore` service fn — additive, no existing route/table touched.
- Mobile: new `MealsChatScreen`; an **Offers tab added** to the
  existing `RestaurantDetailScreen` (additive tab + component + a
  `mealsApi.getStore` fetch on mount); new nav route; `mealsApi`
  export. No existing screen behaviour changed.

## Regression risk
- **Low.** The store screen gains a tab + a guarded fetch (fails soft);
  other tabs unchanged. Metro bundle builds clean. `pnpm qa` (web lane)
  is unaffected (mobile + backend only). Backend covered by meals-p4.

## Production posture
- PRODUCTION-IMPACTING (`backend/src/**` + `Packages/Mobile/src/**`).
  UI-governed + Mobile-governed. **Not pushed** — bundled into the
  single end-of-program prod push (mobile ships via OTA bundle).
- gov-check: Rule 1 (approved contract) + Rule 3 (mockup_locked) +
  Rule 4 (06-diff/notes.md) satisfied now. **Rule 5 (maestro_green)**
  applies only when `release.released` flips true — held until the
  Maestro journey is run green on a seeded device.

## Forward dependencies
P5 adds the commission/revenue surfacing; one-tap "order this standing
offer" (vs chat) is a later refinement (recorded in 06-diff).
