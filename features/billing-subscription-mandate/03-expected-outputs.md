# Expected Outputs — billing-subscription-mandate (Phase A6)

## API responses

### GET /v1/subscription-tiers
```json
{ "success": true, "data": { "tiers": [ { "tier_key": "free", "name": "Free", "monthly_price_inr": "0.00", "max_campaigns": 1, ... }, ... ] } }
```

### POST /v1/brands/me/subscription/upgrade
```json
{ "success": true, "data": {
  "status": "activated",
  "mode": "mock",
  "subscription_id": "<uuid>",
  "invoice_id": "<uuid>",
  "tier_key": "growth",
  "amount_inr": 2499,
  "gst_amount_inr": 449.82,
  "total_inr": 2948.82,
  "message": "Subscribed to Growth (mock mode — no real Razorpay charge)."
} }
```

### GET /v1/brands/me/subscription
```json
{ "success": true, "data": {
  "subscription": { "tier_key": "growth", "status": "active", "current_cycle_start": "...", ... },
  "usage": { "campaigns": 0, "products": 12, "influencer_invites_this_cycle": 3 }
} }
```

## Cron output
```
[CRON subscription-renewal] Running...
[CRON subscription-renewal] Done — 7 renewed, 0 failed.
```

## Test invariants
- 6/6 subscription.test.js assertions pass.
- pnpm qa main 67/67 GREEN.
- backend jest delta: +6 new GREEN assertions.

## Deploy posture
PRODUCTION-IMPACTING — endpoints + cron land on Render. RAZORPAY_MOCK
env on prod is currently `true` (per .env audit at start of session)
so prod runs mock-mode safely until founder flips it.
