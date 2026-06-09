# Impact — Influencer stocking + store-context stamp

## Terse verdict
**New influencer screen + an additive store-context stamp on pay-at-store.** No existing
behaviour changes when `via_store_influencer_id` is absent (every current client).

## What changes mechanically
- New `StockStoreScreen` + a "+ Stock" entry on MyStore + nav registration + 4 api methods.
- Follower InfluencerStore pick tap + PayAtStore forward `via_store_influencer_id`.
- `transaction.controller` pay-at-store: passes storeInfluencerId/productId to
  `computeL3OnFollowerTxn` and records `via_store_influencer_id` on the txn.

## Blast radius
- Mobile OTA (influencer + follower) + backend (pay-at-store). NATIVE_RUNTIME '3' (no APK).
- Money path: additive — store-context only fires when the app sends the param AND the
  product is genuinely stocked + the creator contracted. Commission still flows via the
  existing campaign-link path. Rollback = revert + re-publish.

## Verification state (honest)
- Compiles (Babel 5/5) + backend app loads; classifyPath store-branch unit-tested 6/6.
- The money behaviour (stamp + correct creator/fee) must be confirmed on a LIVE test txn
  — see TEST-PLAN.md. Maestro not runnable in sandbox → release waives via GOVERNANCE_OVERRIDE.

## Remaining gaps for the FULL stocked-product commission loop (in TEST-PLAN.md)
1. Surface `influencer_store_inventory` inside the follower Creator Store (today it shows
   campaign offers, not stocked-only products).
2. A no-live-link store purchase path + crediting the store creator from their CONTRACT
   rate (pay-at-store currently requires a campaign-link). Designed after the first test.
3. Order/prebook store-context (only pay-at-store wired here).
