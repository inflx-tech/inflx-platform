# 06-diff — backend-defect-webhook-signature-diagnostic

**Before:** `verifyWebhookSignature` returned a simple boolean on
mismatch:

```js
function verifyWebhookSignature(rawBody, signature) {
  if (!env.RAZORPAY_WEBHOOK_SECRET) return true;
  const expected = crypto.createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return expected === signature;
}
```

The caller logged a bland `[WEBHOOK] Invalid signature — rejected`
on mismatch. No way to tell from logs whether the secret on Render
was correct, whether the body Razorpay signed matched the bytes we
received, or whether some other encoding issue was at play.

**After:** the failure path now emits a structured WARN with the
diagnostic fields needed to pinpoint root cause without leaking
the full secret:

```js
function verifyWebhookSignature(rawBody, signature) {
  if (!env.RAZORPAY_WEBHOOK_SECRET) return true;
  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  const expected = crypto.createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  const match = expected === signature;
  if (!match) {
    const bodyStr = Buffer.isBuffer(rawBody)
      ? rawBody.toString('utf8')
      : String(rawBody || '');
    console.warn('[WEBHOOK] Signature mismatch debug:', {
      secret_set:        !!secret,
      secret_len:        secret.length,
      secret_first_3:    secret.slice(0, 3),
      body_len:          Buffer.isBuffer(rawBody) ? rawBody.length : (rawBody?.length || 0),
      body_first_60:     bodyStr.slice(0, 60),
      expected_first_16: expected.slice(0, 16),
      received_first_16: (signature || '').slice(0, 16),
    });
  }
  return match;
}
```

**Why each field:**

| Field | Tells us |
|-------|----------|
| `secret_set` | env var was loaded (not undefined/null) |
| `secret_len` | should be 15 for `vTtYfTujaT9tJg6` — different length means Render env is wrong value |
| `secret_first_3` | should be `vTt` — different prefix means Render env is wrong value |
| `body_len` | order-of-magnitude — Razorpay payloads are 1-3kb |
| `body_first_60` | should look like `{"entity":"event","account_id":"acc_…` — confirms valid JSON, no encoding artefacts |
| `expected_first_16` | the first 16 hex chars of our HMAC-SHA256(body, secret) |
| `received_first_16` | the first 16 hex chars of Razorpay's signature header |

If `expected_first_16 !== received_first_16` AND `secret_first_3
=== 'vTt'`, then Razorpay is using a different secret than Render.
→ founder regenerates with deliberate fresh value in both places.

If `secret_first_3 !== 'vTt'`, then Render's env is stale.
→ founder updates Render env to match `vTtYfTujaT9tJg6` exactly.

**Defensive behaviour preserved:**
- Successful webhooks remain silent (no extra noise).
- 401 response shape unchanged.
- No secret value (full string) is ever logged — only length + 3
  chars + an unrelated HMAC prefix.

**Verified locally:** boot smoke clean, pnpm qa 76/76 GREEN. The
diagnostic doesn't fire during pnpm qa because the suite doesn't
hit /v1/webhooks/*.
