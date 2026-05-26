# Workflow — backend-defect-webhook-signature-diagnostic

## Actor
Founder + Code-builder debugging the persistent signature mismatch
after the body-hang fix.

## Preconditions
- Webhook body-hang fix shipped (commit 7a28438).
- This commit shipped + Render auto-redeployed.

## Workflow A — diagnostic log appears on next mismatch

1. Razorpay (or the founder triggers a retry) fires a webhook to
   /v1/webhooks/razorpay.
2. Backend receives the request, captures Buffer body via
   express.raw(), runs verifyWebhookSignature.
3. Signature doesn't match → instead of just the bland
   `[WEBHOOK] Invalid signature — rejected` log, we now also see:
   ```
   [WEBHOOK] Signature mismatch debug: {
     secret_set: true,
     secret_len: 15,
     secret_first_3: 'vTt',
     body_len: 1742,
     body_first_60: '{"entity":"event","account_id":"acc_...","event":"subscript',
     expected_first_16: 'a3f2b8c1d5e94f60',
     received_first_16: 'c1d5e9f067a3f2b8',
   }
   POST /v1/webhooks/razorpay 401 0.6 ms
   ```

## Workflow B — diagnostic identifies the root cause

The founder/me reads the diagnostic and decides:

**Case 1: `secret_len !== 15` or `secret_first_3 !== 'vTt'`**
→ Render's env value is wrong. Founder updates Render's
RAZORPAY_WEBHOOK_SECRET to match exactly. Render auto-redeploys.
Retry.

**Case 2: secret looks right but `expected_first_16 !==
received_first_16`**
→ Razorpay is using a different secret than what's on Render.
Founder regenerates secret in Razorpay dashboard with a deliberate
new value, updates Render to match exactly, retries.

**Case 3: body_first_60 looks weird (binary chars, truncated)**
→ Body capture issue (would be surprising given the canonical
express.raw() pattern). Carve another contract.

## Workflow C — founder regenerates secret cleanly

Per the explicit "deliberate fresh value" path that should resolve
this regardless of which case above we hit:

1. Pick a fresh known value: e.g. `inflx-rzp-wh-2026-05-26-fresh-Ku9Pq`.
2. Razorpay dashboard → Webhooks → Edit enabled webhook → Secret
   field → paste fresh value → Save.
3. Render dashboard → Environment → RAZORPAY_WEBHOOK_SECRET →
   replace with exact same fresh value → Save Changes.
4. Render auto-redeploys (~2-3 min).
5. As Aveen → /dashboard/settings/subscription → Upgrade to
   Growth → complete with success@razorpay / OTP 000000.
6. Watch Render logs:
   - If `[WEBHOOK] Received: subscription.authenticated` appears →
     fix worked.
   - If `[WEBHOOK] Invalid signature` reappears with diagnostic →
     either secret_len or secret_first_3 will reveal which side is
     wrong.

## Success

- Diagnostic log line appears on the next mismatch.
- Founder + Code-builder can pinpoint the root cause.
- Resolution applied → next webhook delivery succeeds → brand
  flips to active.

## Failure modes

- Render hasn't redeployed yet → diagnostic doesn't show up. Wait.
- Webhook handler errors before reaching verifyWebhookSignature →
  no diagnostic (but logs would show an earlier error).
