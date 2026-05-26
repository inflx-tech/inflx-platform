# backend-defect-webhook-signature-diagnostic

> Fourth carved defect from the A6.5 end-to-end smoke test
> (2026-05-26). After the body-hang fix landed
> (`backend-defect-webhook-body-hang`), webhook delivery now reaches
> the handler but rejects with **401 Invalid signature** on every
> attempt, even after the founder re-pasted
> `RAZORPAY_WEBHOOK_SECRET=vTtYfTujaT9tJg6` into both Razorpay's
> dashboard and Render's env. The current log line
> `[WEBHOOK] Invalid signature — rejected` doesn't tell us **why** —
> we can't see if it's a length mismatch, a body-encoding issue, or
> an actual key mismatch.

## Symptom

```
[WEBHOOK] Invalid signature — rejected
POST /v1/webhooks/razorpay 401 0.544 ms - 87
```

Repeats on every Razorpay retry (~12 retries per event before
Razorpay gives up). Brand-side: stays on Free tier; no invoice
written.

## Root cause (suspected)

Either:
- Razorpay's webhook config is still using its **original** secret
  (set on 2026-03-31, value unknown), not the
  `vTtYfTujaT9tJg6` that was re-pasted. This happens when
  Razorpay's Edit UI shows the Secret field empty and the user
  clicks Save without actually typing — Razorpay keeps the old
  secret instead of clearing it.
- Render's env value differs from `vTtYfTujaT9tJg6` due to a
  trailing newline, leading space, or accidental edit.
- A genuine encoding mismatch (unlikely given the canonical
  express.raw() + crypto.createHmac(sha256) implementation, but
  possible).

We can't tell which without diagnostic info.

## Fix

Add **temporary diagnostic logging** to
`webhook.controller.verifyWebhookSignature` that fires only on
mismatch and logs:

| Field | Why useful |
|-------|-----------|
| `secret_set` (bool) | confirms env var actually populated |
| `secret_len` | should be 15 for `vTtYfTujaT9tJg6` |
| `secret_first_3` | first 3 chars only — "vTt" if correct (low risk; 3 chars of a 15-char alphanumeric secret) |
| `body_len` | Razorpay payloads are usually 1-3kb |
| `body_first_60` | confirms it's valid JSON, no encoding artefacts |
| `expected_first_16` | the SHA256 hex our backend computed (first 16 chars) |
| `received_first_16` | the SHA256 hex Razorpay sent (first 16 chars) |

Comparing `expected_first_16` vs `received_first_16` is the
ground-truth diagnostic:
- If they look completely different (e.g. `a3f2b8…` vs `c1d5e9…`)
  → either secret or body bytes differ.
- If they share the first few chars and diverge later → unlikely
  with HMAC; probably both bytes and secret are subtly off.
- If `secret_len` is not 15 or `secret_first_3` is not "vTt"
  → Render env is stale.

This logging is intentionally **temporary** — once the mismatch is
resolved, the diagnostic can stay (it only fires on mismatch and
is low-noise) OR be removed in a follow-up. Decision deferred.

## Why this is a backend defect (carved)

The signature mismatch is itself a config issue, but **the absence
of useful debug info** is a backend defect. Without it we can't
distinguish a secret mismatch from a body-encoding issue. Carved
per the no-fake-green rule — improve diagnostics first, then
resolve the config.

## Out of scope

- The actual signature-mismatch resolution — depends on what the
  diagnostic reveals. Likely path: founder regenerates secret with
  a deliberate fresh value, updates both Razorpay + Render to that
  exact value. Documented in 02-workflow.md.

## Files

- `backend/src/controllers/webhook.controller.js` — enhance the
  `verifyWebhookSignature` failure path with one structured
  `console.warn` call.
- This contract.

## Non-functional

- Deploy posture: PRODUCTION-IMPACTING (Render redeploys backend
  with one additional warn-log line on signature failure). NO
  migration. NO schema change.
- The log only fires on mismatch, so successful webhook deliveries
  remain quiet.
- `secret_first_3` exposure: 3 chars of a 15-char alphanumeric
  secret in WARN logs is low-risk (Render logs are gated by
  founder's Render access). Once signature matches, this can be
  removed if desired.
- pnpm qa unaffected.
