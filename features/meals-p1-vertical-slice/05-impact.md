# meals-p1-vertical-slice — impact

## Blast radius
- **New namespace only.** Adds `/v1/meals/*`; one new line in
  `routes/index.js`; new service/controller/routes files. No existing
  route, controller, service, query, or table is modified.
- Reads/writes only the `meal_*` / `restaurant_meal_config` tables from
  P0 (plus lazy `followers` row creation on first customer action,
  which is idempotent via the `user_id` unique constraint).

## Regression risk
- **Near zero.** Nothing existing is touched. `pnpm qa` (web lane)
  cannot be affected by a new backend namespace; running it green
  confirms it. The new backend E2E proves the slice itself.

## Production posture
- PRODUCTION-IMPACTING (`backend/src/**`) but **not pushed** until the
  single end-of-program push (founder's instruction). Local + tests
  only for now.
- Payment is mocked (RAZORPAY_MOCK); real payment wiring is a later
  phase. No real money moves.

## Forward dependencies
P3 replaces the v0 offer compute with the full engine (routing,
capacity, discount-clock, freeze). X1 adds AI intent/ranking. P-REV
sets `commission_pct`/`commission_amount` (left null in P1).
