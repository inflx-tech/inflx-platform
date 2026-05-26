# Impact — backend-defect-webhook-body-hang

## Changes
- `backend/src/app.js` — wrap `express.json()` with a conditional
  bypass for `/v1/webhooks/*` paths.
- `backend/src/routes/webhook.routes.js` — drop the custom
  `captureRawBody` middleware. Use `express.raw({type: '*/*'})` on
  the `/razorpay` route.
- `backend/src/controllers/webhook.controller.js` — read raw bytes
  from `req.body` (Buffer) for signature verification, JSON.parse
  the buffer to get the event payload.
- 1 contract folder.
- **Zero migration.** **Zero schema change.**

## Blast radius

**Webhook routes** — fixed (now actually processes events).

**All other routes** — unaffected. The conditional middleware
falls through to the same `express.json({limit:'5mb'})` it always
used for any path not starting with `/v1/webhooks/`. No behaviour
change for auth, brands, campaigns, products, admin, follower, or
any other endpoint.

**Razorpay test mode** — once the fix deploys, Razorpay will retry
recent failed deliveries (per their retry policy) — Aveen's
existing pending_mandate subscription may auto-flip to active
without requiring a retry from the brand. If retries have already
expired, the founder retests via a fresh upgrade attempt.

## Rollback
Revert this commit. The middleware ordering reverts; the
captureRawBody returns; webhooks resume hanging. No data
corruption.

## Risks
- **Conditional middleware adds ~1 line of overhead per request** —
  a `startsWith()` check. Negligible.
- **All webhook routes now require raw body** — currently only
  /razorpay is mounted under /v1/webhooks/, so no other route is
  affected. Future webhook routes added under the same prefix would
  also need to opt into `express.raw()` or parse the body
  themselves.
- **Existing pending_mandate rows** (Aveen's row) don't auto-
  reconcile from the fix alone. If Razorpay's retry policy doesn't
  re-fire the original `subscription.authenticated` event (it
  typically retries 5x over ~12 hours), the row stays pending.
  Founder can clear by retrying the upgrade flow (cancels the old
  row, creates a fresh subscription whose webhook fires cleanly).

## Pre-push checklist
1. pnpm qa main lane GREEN.
2. Backend boot smoke clean (no `[WEBHOOK]` lines yet — no real
   webhook fires during boot).
3. gov-check exit 0.
