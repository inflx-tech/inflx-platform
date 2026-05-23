# Workflow — billing-revenue-reconciliation (Phase A8)

## Actor
Test substrate (`pnpm qa:db` informational lane).

## Preconditions
- M058 + M059 applied; subscription_tiers + categories + escrow_fee_tiers seeded.
- pricing.service + transaction.controller + subscription.controller all wired (A1-A6 shipped).

## Workflow steps
1. `beforeEach` truncates runtime tables + reseeds the 3 admin-config tables to canonical values.
2. Test creates the cast (brand, influencer, 2 followers, campaign, set, CI).
3. Simulates Day-12 upgrade to Growth (DB INSERT + `computeL1Renewal` assertion).
4. Simulates Day-15 engagement publish (`lockEscrowFeeAtPublish` for ₹50k assertion).
5. Simulates Day-25 hybrid publish (`lockEscrowFeeAtPublish` for ₹5k assertion).
6. Simulates Day-8 Anita Path B (`computeL3OnFollowerTxn` assertion = ₹100).
7. Inserts the Path-B attribution row that the controller would have written.
8. Simulates Day-28 ₹50k Path B (`computeL3OnFollowerTxn` assertion = ₹2,500).
9. Simulates Day-30 Anita Path C (`computeL3OnFollowerTxn` returns `influencer_attributed`, fee = ₹210).
10. Simulates Day-32 Rahul Path A (`computeL3OnFollowerTxn` returns `direct`, fee = ₹135).
11. Sums the values from each layer; asserts total = ₹7,094.

## Success
- pnpm qa main 67/67 GREEN.
- revenue-reconciliation.test.js 1/1 PASS.
- Glow Studio total = 7094 (single source-of-truth across all 3 layers).

## Failure modes
- Any service-level math drift → assertion fail → caught before push.
- Seed drift in escrow_fee_tiers / categories / subscription_tiers → reseed in beforeEach insulates.
