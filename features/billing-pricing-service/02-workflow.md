# Workflow — billing-pricing-service (Phase A3)

## Actor
Backend developer / Code-builder running `pnpm qa:db` (backend jest)
to validate the new pricing-service exports against the substrate.

## Preconditions
- M058 (Phase A1) + M059 (Phase A2) applied to the DB the tests target.
- `pnpm qa` main GREEN.

## Steps
1. Tests boot: `backend/tests/setup.js` drops + recreates `public`
   schema, applies migrations 001..059 → DB has subscription_tiers
   (4 seeded), categories (16 seeded), brand_subscriptions / attribution_clicks /
   subscription_invoices empty, follower_transactions with
   `marketplace_fee_amount` column.
2. `pricing-service.test.js beforeEach` truncates runtime tables,
   re-seeds the 4 categories used in tests + the 4 subscription_tiers
   (admin-config preservation pattern).
3. Each test calls the service function directly and asserts on
   returned values.

## Success
- All pricing-service tests pass.
- Full backend jest suite delta vs P12-final-state is exactly
  `pricing-service.test.js` added GREEN; zero pre-existing tests
  regressed.
- `pnpm qa` main lane 67/67 GREEN unchanged.

## Failure modes
- Category seed missing in test DB → tests fall back to brand legacy
  fee unexpectedly. Mitigation: explicit re-seed in beforeEach.
- attribution_clicks index missing → classifyPath query slow but
  correct. Index `idx_attribution_active` from M058 covers the
  (follower_id, influencer_id, expires_at DESC) lookup.
