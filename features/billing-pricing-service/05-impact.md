# Impact — billing-pricing-service (Phase A3)

## Changes
- `backend/src/services/pricing.service.js` extended (+3 functions, +1 cache, +1 alias map, +2 test-exposed).
- `backend/tests/pricing-service.test.js` new (+18 assertions).
- `backend/tests/helpers/db.js` TRUNCATE list extended (+3 runtime tables).

## Blast radius
- No controller / route / middleware changes.
- New service functions have ZERO callers in this phase — runtime
  behavior unchanged. Render redeploys the file; nothing executes the
  new code paths until Phase A5/A6.
- Existing pricing.service L2 exports unchanged → no regression risk
  for the escrow path that M037 ships.
- TRUNCATE addition is test-helper-only → main qa lane unaffected.

## Rollback
Revert the commit. No DB rollback needed (no migration).

## Risks
- **Alias map gaps** — if a brand registers with a category value not
  in `CATEGORY_ALIASES`, the fallback to `brands.platform_fee_pct` (8%
  default) kicks in. Behaviour identical to today (which uses 8% for
  every brand). Acceptable; admin can add the alias in a code change
  or wait for the Phase A7+ DB-driven mapping.
- **Cache TTL drift** — 60s cache means an admin edit to `categories`
  takes up to 60s to propagate in already-warm processes. Same pattern
  as M037's tier cache. Acceptable.

## Pre-push checklist
1. `pnpm qa` main GREEN unchanged.
2. `pnpm qa:db` informational lane: new `pricing-service.test.js`
   passes; ledger residual delta tracked (expect +0 new failures, +18
   new GREEN assertions).
3. `gov-check` exit 0.
