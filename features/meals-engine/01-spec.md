# meals-engine — deterministic offer engine (P3)

> **Phase P3.** The deterministic brain of INFLX Meals, as PURE
> functions (`backend/src/services/mealsEngine.service.js`) wired into
> `meals.service`. No AI, no I/O — every rupee, route and timing
> decision is computed here and is identical every run.

## Scope
- **E1 routing** — `haversineKm`, `withinRadius`, `rankCandidates`
  (favourites → cheapest → nearest). `computeOffers` now routes across
  restaurants within delivery radius when the intent names no brand.
- **E2 pricing** — `clockDiscountPct` (early-bird decay: earlier order
  = bigger discount), `computeEngineOffer` (rule discount + clock,
  capped at `max_discount_pct`, floored at cost when
  `never_below_cost`). Offers are now priced by the engine.
- **E3 slot clock** — `slotServeAt`/`slotCutoffAt`/`isSlotOpen`
  (open / frozen-at-cutoff / full-at-capacity). `lockAndPay` now
  rejects `SLOT_FULL` as well as cutoff-passed; the dashboard reports
  `order_book` status.
- **E4 demand aggregation** — `aggregateDemand` (prep counts, meals,
  revenue, party mix) powering the dashboard.

## Success
`backend/tests/meals-engine.test.js` (pure unit) + `meals-p3.test.js`
(integration: clock decay changes price, capacity → SLOT_FULL,
cross-restaurant nearer-first) green; P1/P2 stay green; `pnpm qa` GREEN
(zero regression).
