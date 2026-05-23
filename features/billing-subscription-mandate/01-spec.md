# billing-subscription-mandate — L1 subscription endpoints + renewal cron (Phase A6)

> **Phase A6 of the INFLX 3-Layer Revenue Model.** Ships the L1 SaaS
> subscription API + the renewal cron, mock-Razorpay mode complete.
> Live Razorpay UPI Autopay mandate flow is a follow-up phase (A6.5).

## What ships
- `backend/src/controllers/subscription.controller.js` (new):
  - `GET  /v1/subscription-tiers` — public catalog read.
  - `GET  /v1/brands/me/subscription` — current sub + usage counters.
  - `POST /v1/brands/me/subscription/upgrade` — switch tier; mock-mode
    activates immediately + writes a paid invoice. Live-mode returns
    501 until A6.5 wires real Razorpay subscriptions.
  - `GET  /v1/brands/me/billing/invoices` — invoice history.
- `backend/src/jobs/subscription-renewal.job.js` (new) — daily cron at
  02:00 IST. Finds active subs with `next_charge_at <= today`, charges
  (mock invoice for now), advances cycle. Failures flip the sub to
  `past_due`.
- Routes wired in `brand.routes.js` (brand-scoped) and `routes/index.js`
  (public tier list).
- `backend/tests/subscription.test.js` (new) — 6 assertions covering
  tier list, upgrade happy path, unknown-tier rejection, GET sub +
  usage, cron renew + cron no-op.

## Functional outcomes live
- Brand can see their plan + usage in real time.
- Brand can upgrade to a paid tier (mock charge today; the API shape
  is stable for the front-end so Phase A7 UI doesn't need to change
  when Razorpay live mode lands).
- The renewal cron advances cycle anchors and produces invoice rows
  every month.

## RAZORPAY_MOCK posture
- `RAZORPAY_MOCK=true` (dev/test/local prod): all the math runs;
  invoices marked `paid`; payment_id starts `pay_mock_*`.
- `RAZORPAY_MOCK=false`: upgrade returns 501 "live not yet wired";
  cron writes invoices as `pending` with no payment_id. The DB stays
  consistent for when the Razorpay integration lands.

## Backward compat
- Brands already have subscription rows from Phase A4 (lazy-created
  Free or factory-upserted enterprise). Upgrade cancels the old +
  inserts the new. Cycle anchor resets.
- Invoice rows are net-new and don't interfere with existing financial
  data (escrow_entries / wallet_transactions / follower_transactions
  untouched).

## Files
- `backend/src/controllers/subscription.controller.js`
- `backend/src/jobs/subscription-renewal.job.js`
- `backend/src/jobs/index.js` (register the new job; export for tests)
- `backend/src/routes/brand.routes.js` (3 new routes)
- `backend/src/routes/index.js` (1 new public route)
- `backend/tests/subscription.test.js`
- This contract.

## Non-functional
- Auth: brand JWT for /me/* endpoints; public for /subscription-tiers.
- ENABLE_CRONS=false in test env → job not scheduled but invocable via
  `require('../jobs').subscriptionRenewalJob.run()`.
- No new migration. Reuses M058 tables.

## Future / out of scope (A6.5)
- Real Razorpay Subscriptions API integration.
- Webhook handler for subscription.activated / charged / failed events.
- Mandate consent short_url surfaced to the front-end.
- Razorpay-side proration on tier changes mid-cycle.
- Cancellation / pause endpoints.
- GST per-state CGST/SGST split.
