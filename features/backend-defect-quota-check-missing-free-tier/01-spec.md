# Backend defect — POST /campaigns returns 500 (quotaCheck can't find 'free' tier row)

## Symptom

Founder reproduced on the live prod brand-web (2026-05-24):

1. Open `/dashboard/campaigns/new`
2. Fill Step 1: campaign name + dates + ₹1,000 total budget + allow_negotiation
3. Click **"Build deliverable sets →"**
4. UI shows red banner: `Internal server error. Please try again.`
5. Network: `POST /campaigns` → HTTP **500**

The wizard stays on Step 1; no campaign row is created.

## Root cause (verified by reading source)

`Packages/brand-web/lib/api.js:185` → `POST /campaigns`
→ `backend/src/routes/campaign.routes.js:13` →
   `brandApproved` middleware → `checkQuota('createCampaign')` → `ctrl.create`

`backend/src/middleware/quotaCheck.js` (lines 62-90) gates the create
behind a subscription-quota lookup:

```js
const { rows: existing } = await client.query(
  `SELECT bs.id AS sub_id, bs.tier_id, ...
     FROM brand_subscriptions bs
     JOIN subscription_tiers t ON t.id = bs.tier_id
    WHERE bs.brand_id = $1 AND bs.status = 'active'
    LIMIT 1`,
  [brandId]
);
if (existing[0]) return existing[0];

// Lazy-create on 'free' tier.
const { rows: freeTier } = await client.query(
  `SELECT id, tier_key, max_campaigns, ...
     FROM subscription_tiers
    WHERE tier_key = 'free'
    LIMIT 1`
);
if (!freeTier[0]) {
  throw new AppError(
    'INTERNAL_ERROR',
    "free tier missing from subscription_tiers — migration 058 not applied?",
    500
  );
}
```

If a brand has no row in `brand_subscriptions` (because they were created
**before** the quotaCheck middleware was added) AND `subscription_tiers`
doesn't have a `tier_key = 'free'` row, the lazy-create path throws
`INTERNAL_ERROR` → HTTP 500.

The most likely production state: migration 058
(`billing-subscriptions-schema`) created the `subscription_tiers` +
`brand_subscriptions` tables but the seed insert of `tier_key = 'free'`
either wasn't applied to prod, or the prod database doesn't have it.

## When did this start

Window A's commit **`ac01c5b feat(revenue): Phase A4 — quotaCheck
middleware + 4 brand-create route gates`** added the gate on
2026-05-18. From that moment, every brand without an active
subscription row (i.e. every pre-existing brand) hits this path on
POST /campaigns.

It went unnoticed for 6 days (2026-05-18 → 2026-05-24) until the
founder tested the live wizard.

## Why this is Window A territory

- `backend/src/middleware/quotaCheck.js` is Window A's code from Phase A4
- The fix is one of (Window A picks):
  - **(a)** Insert `'free'` row into `subscription_tiers` in prod via a one-shot SQL or `run-NNN.js` script (preferred — restores intended behaviour)
  - **(b)** Make `_ensureSubscription` soft-fall-back to "unlimited" when the free tier row is missing (defensive — keeps existing brands working even if seeds are stale)
  - **(c)** Re-run migration 058 if it didn't fully apply
- Window B's NO-TOUCH rule forbids touching `backend/**`

## Repro

```bash
# Pre-conditions: a brand user with NO row in brand_subscriptions
curl -X POST https://api.inflx.in/v1/campaigns \
  -H "Authorization: Bearer <brand-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name":"test","start_date":"2026-06-15","end_date":"2026-07-31","total_budget":1000,"allow_negotiation":true}'
# → 500 {"error":{"code":"INTERNAL_ERROR","message":"free tier missing from subscription_tiers — migration 058 not applied?"}}
```

OR via UI: `/dashboard/campaigns/new` → fill Step 1 → click "Build deliverable sets →" → see the error banner.

## Status

**RED — production-blocking for any brand without an active subscription row.** This blocks campaign creation entirely. Higher-priority than the auth-test failures already carved (`features/backend-defect-auth-verify-otp-role-validation/`) because this prevents core workflow, not just QA.

## Verification that Window B did not cause this

- Flow 7 (commit `8a0cad1`, 2026-05-24) **rewrote the wizard UI** but preserved the exact `campaignApi.create({ name, start_date, end_date, total_budget, allow_negotiation })` payload shape — verified by reading `saveDraft` at line 934 of the rewritten file.
- The OLD wizard (pre-Flow 7) made the IDENTICAL request and would have hit the same 500 since 2026-05-18.
- The bug existed for 6 days before Flow 7 went live; it surfaces now only because the founder tested the live UI for the first time post-deploy.

## What needs to happen for resolution

1. **Window A** runs a one-shot SQL on prod to insert the seed:
   ```sql
   INSERT INTO subscription_tiers (id, tier_key, ...) VALUES (..., 'free', ...);
   ```
   OR re-runs migration 058 if it's still pending.
2. OR Window A patches `_ensureSubscription` to soft-fall-back to "unlimited" when no `'free'` row is found (so pre-existing brands keep working forever even with bad seeds).
3. After fix → smoke-test POST /campaigns with a real brand JWT → contract closes.

This contract closes when the founder confirms a brand can create a new campaign without a 500.
