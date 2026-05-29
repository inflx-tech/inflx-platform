# Impact

**One-line verdict:** unblocks mid-cycle paid-tier upgrades (revenue path);
zero risk to any working flow — the fix only makes an already-written function
reachable.

## Mechanics
- Change is a single addition to `module.exports` in `razorpay.service.js`.
- No existing export is altered; `createSubscription`, `fetchSubscription`,
  `cancelSubscription` keep working exactly as before.
- The proration controller code, money math, webhook handling, and DB writes
  are unchanged — they were already correct; they just couldn't reach
  `createOrder`.
- Mock-mode flows (tests, dev) are unaffected (they never reach `createOrder`).

## Deploy posture
PRODUCTION-IMPACTING (Render backend redeploy). No migration. No OTA.
No money-math change. Fixes a 502 on the live proration upgrade path.

## Blast radius
Only the live mid-cycle proration upgrade path (currently 100% broken) is
affected — it goes from always-502 to working. Nothing else calls `createOrder`.
