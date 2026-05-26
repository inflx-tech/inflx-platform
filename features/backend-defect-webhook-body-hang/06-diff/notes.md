# 06-diff — backend-defect-webhook-body-hang

**Before:** `webhook.routes.js` used a hand-rolled `captureRawBody`
middleware that tried to read the raw request body via
`req.on('data')` / `req.on('end')`:

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

But `app.js:53` already mounted `express.json({limit:'5mb'})`
**globally** — meaning by the time the request reached
`captureRawBody`, the body stream had already been consumed and
drained. `req.on('data')` never fired and `req.on('end')` either
fired silently (with `data=''`) or didn't fire at all. Either way,
`next()` never got called → middleware chain stalled → no response
sent → Razorpay's HTTP delivery timed out → `POST /v1/webhooks/
razorpay - - ms - -` in Render logs.

Net effect: zero webhook events ever reached `handleWebhook`.
brand_subscriptions stayed in `pending_mandate` forever.
subscription_invoices never got written. Brand-facing subscription
page showed `Free` even after Razorpay successfully charged.

**After:** three coordinated changes.

**1. `app.js` — conditional `express.json()` skip for webhook
paths.** Replace the unconditional line with a wrapper that
bypasses JSON parsing for `/v1/webhooks/*`:

```js
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/v1/webhooks/')) return next();
  return express.json({ limit: '5mb' })(req, res, next);
});
```

For every non-webhook path, the wrapper invokes `express.json()`
exactly as before. For webhook paths, the wrapper passes through —
the body stream stays unread, ready for `express.raw()` in the
route handler.

**2. `webhook.routes.js` — replace `captureRawBody` with
`express.raw()`.** The canonical Express pattern. `express.raw({type:
'*/*'})` reads the entire body into `req.body` as a `Buffer`:

```js
const express = require('express');
router.post('/razorpay', express.raw({ type: '*/*' }), ctrl.handleWebhook);
```

The custom `captureRawBody` function is deleted.

**3. `webhook.controller.js` — read body as Buffer.** Update
`handleWebhook` to read the raw bytes for signature verification
and JSON.parse for the event payload:

```js
async function handleWebhook(req, res) {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody   = req.body;  // now a Buffer (or empty Buffer)

  if (!verifyWebhookSignature(rawBody, signature)) {
    return res.status(401).json({ ... });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ ... });
  }

  // ... existing switch on event.event
}
```

`verifyWebhookSignature` keeps the same shape — `crypto.createHmac(...)
.update(buf).digest('hex')` works equally with a Buffer or a string,
matching Razorpay's signature computation.

**Why we conditionally bypass json instead of mounting webhooks
before json:**

- The route in `routes/index.js` is mounted as `app.use('/v1', routes)`
  which is a single mount point covering all sub-routes.
- Mounting webhooks separately before json would require either
  duplicating the webhook mount (`app.use('/v1/webhooks',
  express.raw(), webhookRoutes)` early + skip-mount in routes/index)
  or restructuring routes/index.js.
- The conditional middleware is a smaller change with the same
  effect.

**Defensive behaviour preserved:**
- Non-webhook routes still get `express.json({limit:'5mb'})`
  exactly as before.
- Webhook 5MB cap is enforced via `express.raw()` (default 100kb;
  set explicit limit if needed — Razorpay payloads are small, no
  config needed yet).
- Signature mismatch still returns 401.
- Invalid JSON still returns 400 (handler now catches buffer-parse
  errors).
- Handler errors still return 200 to prevent Razorpay retry storms,
  per the existing pattern.

**Render log signal post-fix:**

```
[WEBHOOK] Received: subscription.authenticated
POST /v1/webhooks/razorpay 200 53.412 ms - 16
```

(Status code, duration, and response size all populated — vs the
pre-fix `- - ms - -` indicating no response.)

**Verified locally:** pnpm qa stays 76/76 GREEN (no test hits
/v1/webhooks/*); backend boots clean; the conditional middleware
adds <1 microsecond per non-webhook request (a single
`startsWith()` check).
