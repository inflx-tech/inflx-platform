# Workflow — backend-defect-webhook-body-hang

## Actor
Razorpay's webhook delivery system + the founder's retest after the
fix deploys on Render.

## Preconditions
- A6.5 / A13 shipped.
- M070 + M071 applied.
- Cycle-dates fix shipped.
- This commit shipped + Render auto-redeployed.

## Workflow A — webhook delivery post-fix (Razorpay → INFLX backend)

1. Razorpay's subscription system fires
   `subscription.authenticated` after the brand authorizes the UPI
   mandate.
2. Razorpay POSTs to https://inflx-platform.onrender.com/v1/webhooks/razorpay
   with raw JSON body + X-Razorpay-Signature header.
3. Express receives the request:
   - The new conditional middleware in app.js sees
     `req.originalUrl.startsWith('/v1/webhooks/')` → skips
     `express.json()` (body stays unread).
   - The request matches the `/v1/webhooks/*` route mount.
4. `express.raw({type: '*/*'})` middleware on the `/razorpay` route
   reads the raw body bytes into `req.body` (Buffer).
5. `handleWebhook` runs:
   - Reads `req.body` as a Buffer.
   - Computes `crypto.createHmac('sha256', SECRET).update(buf).digest('hex')`
     and compares with the X-Razorpay-Signature header → matches.
   - Parses the body via `JSON.parse(buf.toString())` → gets the
     event object.
   - Logs `[WEBHOOK] Received: subscription.authenticated`.
   - Switch dispatches to `handleSubscriptionAuthenticated`.
6. `handleSubscriptionAuthenticated`:
   - Looks up brand_subscriptions by `razorpay_subscription_id`.
   - UPDATEs status='active', mandate_status='active',
     razorpay_mandate_id, current_cycle_start, current_cycle_end.
   - Sends brand notification.
7. Response 200 sent.
8. Render log: `POST /v1/webhooks/razorpay 200 NNN ms - X`.

## Workflow B — founder retests upgrade after fix

1. Founder signs in as Aveen food paradise.
2. /dashboard/settings/subscription → Upgrade to Growth Monthly.
3. Frontend POSTs to /upgrade.
4. Backend:
   - UPDATEs Aveen's existing `pending_mandate` row to `cancelled`.
   - Creates a fresh Razorpay subscription.
   - INSERTs new `pending_mandate` row with the new
     razorpay_subscription_id.
5. Razorpay Checkout opens. UPI VPA `success@razorpay` → OTP
   `000000` → mandate authorized.
6. Razorpay fires `subscription.authenticated` → backend processes
   correctly → brand flips to active.
7. Razorpay fires `subscription.charged` → backend writes the paid
   invoice.
8. Subscription page refreshes to show Growth · Monthly · active.

## Workflow C — non-webhook routes (regression check)

1. Any `POST /v1/auth/*`, `PATCH /v1/brands/me`, `POST /v1/campaigns`,
   etc. arrives at the backend with JSON body.
2. Conditional middleware sees the path does NOT start with
   `/v1/webhooks/` → falls through to `express.json()`.
3. `express.json()` parses the body → `req.body` is the object.
4. Route handler runs normally.

No change in behaviour for any non-webhook route.

## Success

- pnpm qa main lane GREEN unchanged (76/76 passing).
- `POST /v1/webhooks/razorpay` returns 200 within seconds.
- `[WEBHOOK] Received:` log line appears for each event.
- Brand subscription state flips to `active` post-mandate auth.
- subscription_invoices row written on first charge.

## Failure modes

- Render hasn't redeployed yet → webhook still hangs. Wait ~2-3 min.
- Razorpay signature still mismatches → 401 returned (logged
  cleanly now that the handler isn't hanging). Founder re-pastes
  webhook secret if needed.
- Razorpay handler errors (e.g. DB lookup fails) → 500 returned,
  but at least we see the log line and stack trace.
