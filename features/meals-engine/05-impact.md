# meals-engine — impact

## Blast radius
- New pure module `mealsEngine.service.js` (no I/O).
- `meals.service` internals upgraded: `computeOffers` now engine-priced
  + routes cross-restaurant; `lockAndPay` adds a `SLOT_FULL` guard;
  `getDashboard` adds `order_book` + uses `aggregateDemand`. Endpoint
  shapes are additive (new fields only).

## Behaviour change (intentional)
- Offer prices now include the restaurant's **discount-clock** decay
  (capped at `max_discount_pct`). Restaurants with an empty clock are
  unchanged — which is why P1 (base-pricing isolation) sets
  `discount_clock: []` and stays green.
- Orders are rejected once a slot is **full** (new `SLOT_FULL` code) in
  addition to the existing cutoff rejection.

## Regression risk
- **Low.** P1/P2 tests pin the existing numeric behaviour (empty clock).
  New behaviour is covered by `meals-engine` + `meals-p3`. `pnpm qa`
  (web lane) is unaffected — backend-only.

## Production posture
PRODUCTION-IMPACTING (`backend/src/**`) but **not pushed** — bundled
into the single end-of-program prod push. Backend-only changeset →
gov-check Rule 1 only.
