# Expected Outputs — billing-revenue-reconciliation (Phase A8)

## Test result
- backend/tests/revenue-reconciliation.test.js — 1 test, all assertions GREEN.
- Asserted total = ₹7,094 (literal + live-summed both match).

## pnpm qa
67/67 GREEN, gate=0.

## Functional output if you trace the system end-to-end (from a brand operator's POV)
After Phases A1-A6 are live on prod, here's what a brand like Glow
Studio actually does + sees:

1. **Day 0** Register → on first quota check the middleware lazy-creates a Free `brand_subscriptions` row.
2. **Day 1-3** Lists 8 salon services via /v1/brands/me/products. All succeed (used < 10).
3. **Day 4** Tries to list product #11 → 422 QUOTA_EXCEEDED with payload `{action:'createProduct', used:10, limit:10, current_tier:'free', upgrade_to:['growth','pro','enterprise']}`. Brand-web (Phase A7 UI when it ships) shows the upgrade modal.
4. **Day 5** Creates a Conversion campaign + invites an influencer. Quota OK (1/1 campaign on Free).
5. **Day 7** Follower clicks the share-link `inflx.in/s/<handle>?cid&iid` → `tracking.controller` writes `link_clicks` (no change since A5).
6. **Day 8** Follower books ₹2,000 via the influencer → `transaction.controller.payAtStore` calls `pricingService.computeL3OnFollowerTxn` → Path B salon 5% → marketplace_fee_amount = ₹100. INFLX revenue ₹100. Attribution row written on verify.
7. **Day 12** Brand POST /v1/brands/me/subscription/upgrade `{tier_key:'growth'}` → mock-mode invoice paid ₹2,499 + ₹449.82 GST. Quota walls relax to 3/3/25/100.
8. **Day 15** Brand publishes engagement campaign ₹50,000 → `pricingService.lockEscrowFeeAtPublish` → 3% → escrow lock ₹1,500. T1+T2+T3 tranche releases later.
9. **Day 25** Brand publishes hybrid ₹5,000 → 3% → ₹150 lock.
10. **Day 28** Big bride booking ₹50k via influencer → Path B → ₹2,500 INFLX.
11. **Day 30** Same follower (Anita) books ₹3k direct (no link click this time) → Path C (attribution_clicks active) → 7% → ₹210 INFLX, influencer gets attribution-commission downstream.
12. **Day 32** New follower (Rahul) books ₹1.5k direct, no click history → Path A → 9% → ₹135 INFLX.
13. **Day 38** Anita's attribution expires; her next direct buy from Glow falls back to Path A.
14. **Day 42** `subscription-renewal.job` auto-charges ₹2,499 (mock today, real once A6.5 ships).

Month-1 INFLX revenue total: **₹7,094**.

## Test invariants (what makes this test the "gold spec")
- L1 + L2 + L3 each computed via their own service; no test-internal duplicating of math.
- Three-layer composition is the actual sum of three independent calls.
- All percentages are admin-editable post-launch — when founder edits a tier price or a category Path B%, the test's literal expectations would need updating, which is the desired discipline (changing prices is a contract event).
