# Workflow — billing-subscription-mandate (Phase A6)

## Actor
Brand on the brand-web /dashboard/subscription page (Phase A7 UI).

## Workflows
### Upgrade happy path
1. Brand visits /dashboard/subscription → GET /v1/brands/me/subscription → shows current Free + 3 upgrade CTAs.
2. Brand clicks "Upgrade to Growth ₹2,499/mo".
3. Front-end POST /v1/brands/me/subscription/upgrade { tier_key: 'growth' }.
4. (Mock mode) backend cancels prior sub + inserts new active + writes paid invoice (₹2,499 + ₹449.82 GST = ₹2,948.82 total).
5. Response 201 { status: 'activated', tier_key: 'growth', ... }.
6. Front-end refreshes; brand now sees Growth limits + first invoice in /dashboard/billing.

### Renewal happy path (cron)
1. Cron fires at 02:00 IST.
2. Finds sub with next_charge_at <= today.
3. Writes new invoice (paid in mock, pending in live).
4. Advances cycle anchor +30 days.
5. Influencer-invite-per-cycle quota counter resets (because cycle_start moves).

### Failed renewal
1. Cron fails on a sub (DB or future Razorpay error).
2. Subscription flipped to 'past_due'.
3. Brand UI surfaces "Payment failed — please retry".

## Success
- pnpm qa main 67/67 GREEN.
- subscription.test.js 6/6 assertions pass.
