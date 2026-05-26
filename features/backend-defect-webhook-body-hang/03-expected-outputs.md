# Expected Outputs — backend-defect-webhook-body-hang

## Database
No schema change. The fix is body-parsing middleware ordering.

## API JSON shapes
Unchanged for all endpoints. Webhook responses already returned
200/401/500 by spec; the fix just makes the handler actually run.

## Render log signal post-fix

**Before (pre-fix):**
```
POST /v1/webhooks/razorpay - - ms - -
```
(dashes — no response sent)

**After (post-fix):**
```
[WEBHOOK] Received: subscription.authenticated
POST /v1/webhooks/razorpay 200 53.412 ms - 16
```
(status 200, duration logged, response size 16 bytes for the
`{"success":true}` envelope)

## Test results
- pnpm qa main lane GREEN unchanged.
- Backend boot smoke clean.

## Deploy posture
PRODUCTION-IMPACTING (Render redeploys backend with corrected
middleware ordering). NO migration. NO schema change. After
Render's auto-redeploy (~2-3 min), any new webhook delivery is
processed correctly.
