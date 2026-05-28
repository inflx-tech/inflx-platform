# 05-impact — wave3-commerce-settlement-foundation

**Verdict: additive + DORMANT. New nullable columns, a new service, a new
onboarding endpoint + screen. Zero change to any existing money flow — no
purchase, commission, escrow, subscription, or payout behaviour changes. The
live Route path stays inert until RAZORPAY_MOCK=false + Route enabled.**

## Mechanics
- **M077** adds only nullable columns + defaulted flags — no backfill, no row
  rewrite, additive. Safe to apply ahead of code (migrate-first under shared-main).
- **razorpayRoute.service** is new and only called by the new onboarding
  endpoint; in mock it's synthetic. Nothing in the purchase/settlement path
  calls `createTransfer` yet.
- **Onboarding** reads the brand's saved bank details + writes the linked-account
  id/status. No money moves.
- **Adjacent fix** (`getSubscription`→`getMySubscription`, 3 sites): previously a
  no-op call (masked by server-side enforcement + try/catch); now functional.
  Low risk — restores intended behaviour (entitlement UI hints load; the
  upgrade poll can detect activation/tier-swap instead of always timing out).

## Risk
Very low. Dormant + additive. The only behaviour change is the getSubscription
fix, which makes previously-dead calls work as originally intended.

## Regression
`pnpm qa` GREEN. Backend boot smoke clean. `payout-account.test.js` 5/5
(mock onboarding: not_created → connect → activated, 409, 422). brand-web build
compiles.

## Deploy posture
PRODUCTION-IMPACTING + MIGRATION (M077, additive/dormant). Migrate-first; Render
+ Vercel redeploy. No live money movement until Wave 3 commit 2 + Razorpay Route
is enabled on the account.
