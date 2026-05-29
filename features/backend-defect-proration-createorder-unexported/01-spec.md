# backend-defect — proration upgrade fails: razorpay.service.createOrder not exported

## Symptom (production)
A brand on an active paid plan (Growth) tries to upgrade mid-cycle to a higher
tier (Pro) and gets:

> Upgrade failed: PAYMENT_PROVIDER_UNAVAILABLE — Payment provider is temporarily
> unavailable. Please try again in a moment.

Reproduced by founder 2026-05-29 on inflx.in/dashboard/settings/subscription:
Growth upgrade succeeded; ~10 min later the Growth → Pro upgrade failed every
time with the above error.

## Root cause (verified-twice)
`backend/src/services/razorpay.service.js` **defines** `createOrder()` (lines
95–105) but **omits it from `module.exports`** (only `createSubscription`,
`fetchSubscription`, `cancelSubscription` were exported).

The mid-cycle proration path in `subscription.controller.js` (line 379) calls
`razorpayService.createOrder(...)`. Because it is not exported, the reference is
`undefined`, so the call throws `TypeError: razorpayService.createOrder is not a
function`. The surrounding `try/catch` (lines 398–405) swallows that TypeError
and rethrows it as the generic `PAYMENT_PROVIDER_UNAVAILABLE` (HTTP 502),
masking the real cause.

This is why **Growth (Subscriptions API → createSubscription, exported) worked
but Pro mid-cycle (Orders API → createOrder, not exported) failed every time.**

## Why existing tests did not catch it
`subscription.test.js` "Growth → Pro mid-cycle …" runs with `RAZORPAY_MOCK=true`,
which takes the mock proration branch (a direct paid-invoice INSERT) and never
calls `createOrder`. The live-mode proration path — the only one that calls
`createOrder` — had no coverage.

## Fix
Add `createOrder` to `module.exports` in `razorpay.service.js` (one line).
No behavioural change beyond making the already-written function reachable.

## Severity
Production revenue-blocking: no brand can complete a mid-cycle paid-tier upgrade
(the proration flow) until this is shipped.
