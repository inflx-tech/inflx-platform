# Impact — Store-context attribution + touch (decision logic)

## Terse verdict
**Zero live-money change — additive + DORMANT.** The classifyPath store branch only
fires when a caller passes `storeInfluencerId` (nothing does yet); the touch endpoint is
new and uncalled. Existing fee/attribution behaviour is byte-identical.

## What changes mechanically
- `pricing.service.classifyPath` gains a top-priority store branch + 2 optional args;
  `computeL3OnFollowerTxn` passes them through. With them absent → unchanged.
- New `POST /follower/touch` opens/refreshes the attribution window for a logged-in
  follower (reuses the proven `attribution_clicks` pattern).

## Blast radius
- Production-impacting (backend/src) but additive/dormant. Money path untouched until the
  next slice threads store-context through purchases. Rollback = revert the commit.

## Verification state (honest)
- Decision logic: unit-tested (store>link>window>direct + hijack-proof), 6/6 via stubbed
  client — no DB needed. Full app loads clean (no circular import with influencerStore).
- Touch endpoint: mirrors the existing attribution_clicks insert pattern; not live-tested
  (needs a follower token) — dormant until the app calls it.
- pnpm qa not runnable in sandbox (test DB unreachable); additive/dormant → no regression
  surface in the live path.

## Next slice (money-path, gated on a live test)
Thread `via_store_influencer_id` through the 4 purchase paths (initiate→verify): record it
on `follower_transactions`, and credit the STORE creator's commission by resolving their
contract rate for the brand. Built + proven on a real test transaction before relying on it
(it moves money) — not blind-deployed.
