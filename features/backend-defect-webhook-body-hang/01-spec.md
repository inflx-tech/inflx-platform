# backend-defect-webhook-body-hang

> Third carved defect from the A6.5 end-to-end smoke test
> (2026-05-26, founder testing as `Aveen food paradise`).
> POST /v1/webhooks/razorpay requests reach the backend but never
> complete — handler hangs, no response sent, no `[WEBHOOK]` log
> line written. Razorpay's webhook deliveries time out and the
> brand's subscription state never flips from `pending_mandate`
> to `active`.

## Symptom

In Render logs around the time of a Razorpay webhook delivery:

```
POST /v1/webhooks/razorpay - - ms - -
```

(no status code, no duration, no response size — meaning the
response was never sent). And there's no preceding
`[WEBHOOK] Received: …` log line that the webhook handler would
have produced if it had been invoked.

User-visible effect: Razorpay charges the brand's UPI mandate
successfully (verified in Razorpay dashboard — payment captured,
subscription authenticated on their side), but our backend's
brand_subscriptions stays at `status='pending_mandate'`,
`mandate_status='pending'`, and no subscription_invoices row is
ever written.

## Root cause

The Razorpay webhook handler depends on the **raw request body**
for HMAC-SHA256 signature verification (see
`webhook.controller.js:23-30`). The original implementation in
`webhook.routes.js` used a custom `captureRawBody` middleware that
attached its own `req.on('data')` / `req.on('end')` listeners:

```js
function captureRawBody(req, res, next) {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', chunk => { data += chunk; });
  req.on('end', () => {
    req.rawBody = data;
    try { req.body = JSON.parse(data); } catch { req.body = {}; }
    next();
  });
}
router.post('/razorpay', captureRawBody, ctrl.handleWebhook);
```

But `app.js:53` mounts `express.json({limit:'5mb'})` **globally,
before any route is matched**. By the time the request reaches
`/v1/webhooks/razorpay`, `express.json()` has already consumed and
drained the request body stream.

When `captureRawBody` then attaches its listeners:
- `req.on('data')` never fires (stream already exhausted).
- `req.on('end')` may not fire either (the stream's `end` event
  may have already happened before the listener was attached).

Net effect: `next()` is never called → the middleware chain hangs
→ no response is sent → Razorpay's webhook timer expires (typically
~10s on their side) → connection closes server-side.

This isn't a Razorpay-only issue; **any** webhook source posting to
`/v1/webhooks/*` hangs the same way today.

## Why this is a backend defect (not a test defect)

The webhook flow is correct in intent — read raw body, verify HMAC,
process event. Only the implementation is wrong: using a custom raw-
body capture that conflicts with the global `express.json()`.

The canonical pattern (documented in Stripe / Razorpay docs and used
across the Node ecosystem) is:

- Mount `express.raw({type: '*/*'})` on the webhook route, **and**
- Ensure the global `express.json()` doesn't run for that path
  (either by mounting webhooks BEFORE `express.json()`, or by
  conditionally bypassing `express.json()` for `/v1/webhooks/*`).

Per no-fake-green: backend is the bug, fix the backend.

## Fix

1. `app.js`: replace the unconditional `app.use(express.json({limit:'5mb'}))`
   with a wrapper that **skips JSON parsing for `/v1/webhooks/*`
   paths**:
   ```js
   app.use((req, res, next) => {
     if (req.originalUrl.startsWith('/v1/webhooks/')) return next();
     return express.json({ limit: '5mb' })(req, res, next);
   });
   ```
2. `webhook.routes.js`: drop `captureRawBody`. Use Express's
   built-in `express.raw({type: '*/*'})` on the webhook route. That
   middleware sets `req.body` to a `Buffer` containing the raw
   bytes.
3. `webhook.controller.js`: read the raw bytes from `req.body`
   (Buffer) for signature verification, then `JSON.parse(buffer.toString())`
   to get the event payload.

No schema change. No migration.

## Verify-twice notes for future similar work

- Any webhook needing raw body must run BEFORE
  `express.json()`, OR the JSON middleware must conditionally skip
  the webhook path.
- The custom `req.on('data')` + `req.on('end')` capture pattern is a
  red flag when `express.json()` is globally mounted — the body
  stream can only be consumed once.
- Render's HTTP access log shows `- - ms - -` for the status/duration
  fields when a request arrives but the response is never sent —
  a signal that the handler hung mid-chain.

## Out of scope

- The unrelated `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` warning in
  Render logs (express-rate-limit needs `app.set('trust proxy', 1)`
  for Render's reverse proxy). Pre-existing; not blocking webhook
  delivery. Future small fix.
- Reconciling Aveen's existing `pending_mandate` row to `active`
  after the fix lands (Razorpay subscription `sub_Su0vP5khY6nyc3`
  is already charged on their side). The cleanest path is for the
  founder to retry the upgrade after the fix deploys — that creates
  a fresh subscription whose webhook will fire correctly. The old
  pending row gets cancelled by the upgrade transaction. Aveen's
  current row can also be manually reconciled if needed.

## Files

- `backend/src/app.js` — wrap `express.json()` with webhook-path
  skip.
- `backend/src/routes/webhook.routes.js` — drop `captureRawBody`,
  use `express.raw()`.
- `backend/src/controllers/webhook.controller.js` — read `req.body`
  as Buffer for signature verification + JSON parse.
- This contract.

## Non-functional

- Deploy posture: PRODUCTION-IMPACTING (Render redeploys backend
  with corrected webhook body handling). NO migration. NO schema
  change.
- After Render's auto-redeploy (~2-3 min), any new Razorpay webhook
  delivery will be processed correctly.
- pnpm qa should remain 76/76 GREEN — the existing suite doesn't
  hit /v1/webhooks/* at all.
- Backward compatible: all non-webhook routes still get
  `express.json()` parsing exactly as before.
