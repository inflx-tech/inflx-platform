# Expected Outputs — backend-defect-webhook-signature-diagnostic

## Database
No schema change.

## API JSON shapes
Unchanged. The diagnostic is server-side WARN logs only — Razorpay
still gets the existing 401 response.

## Render log signal post-fix

On signature mismatch:

```
[WEBHOOK] Signature mismatch debug: { secret_set: true, secret_len: 15,
  secret_first_3: 'vTt', body_len: 1742,
  body_first_60: '{"entity":"event","account_id":"acc_…','
  expected_first_16: 'a3f2b8c1d5e94f60',
  received_first_16: 'c1d5e9f067a3f2b8' }
[WEBHOOK] Invalid signature — rejected
POST /v1/webhooks/razorpay 401 0.6 ms - 87
```

On signature match (no change to existing behaviour):

```
[WEBHOOK] Received: subscription.authenticated
[WEBHOOK] subscription.authenticated — sub_id: sub_xxx
POST /v1/webhooks/razorpay 200 47 ms - 16
```

## Test results
- pnpm qa main lane GREEN unchanged.
- Backend boot smoke clean.

## Deploy posture
PRODUCTION-IMPACTING (Render redeploys backend with one additional
warn-log call on signature failure). NO migration. NO schema change.
