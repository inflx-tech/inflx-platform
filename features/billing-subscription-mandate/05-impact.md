# Impact — billing-subscription-mandate (Phase A6)

## Changes
- 1 new controller (subscription.controller.js).
- 1 new cron job (subscription-renewal.job.js).
- jobs/index.js: register the new job; export it for tests.
- brand.routes.js: 3 new routes.
- routes/index.js: 1 new public route.
- 1 new test file (subscription.test.js, 6 assertions).

## Blast radius
- New endpoints — no existing endpoint touched.
- New cron — no existing cron touched.
- New tests — no existing tests changed.

## Risk
- **RAZORPAY_MOCK off on prod accidentally** → upgrade returns 501;
  no money charged; no harm. Recoverable.
- **Cron writes invoice for a deleted brand** — impossible because the
  job SELECTs FROM brand_subscriptions JOIN subscription_tiers; the
  partial unique index guarantees no orphan.
- **Cron retries on past_due** — current cron skips past_due (filter
  by status='active'). To retry, founder manually un-flips the sub via
  admin SQL or future admin UI. Acceptable for now.

## Rollback
Revert the commit. Cron deregisters on next backend restart; controller
endpoints 404. No DB state change required (existing rows stay valid).

## Pre-push checklist
1. pnpm qa main 67/67 GREEN.
2. backend jest subscription.test.js 6/6 GREEN.
3. gov-check exit 0.
