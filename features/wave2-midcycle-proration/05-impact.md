# 05-impact — wave2-midcycle-proration

**Verdict: additive branch on the upgrade path + a new webhook event + an
Order-mode Checkout. No migration. The EXISTING upgrade flow (full subscribe /
mandate) is untouched for every non-qualifying case, so live subscriptions
cannot be broken by this commit.**

## Mechanics
- **No schema change** — proration state rides on the Razorpay Order's `notes`;
  the proration invoice reuses `subscription_invoices`. Nothing to migrate.
- **Additive trigger guard** — pro-ration only fires for a true mid-cycle
  upgrade between paid tiers, same period. All other paths fall through to
  today's code unchanged.
- **Money safety (live):** no DB write until the delta Order is paid; the
  `order.paid` handler is idempotent (invoice payment_id check) and refunds are
  not needed (a single forward charge). If the new-subscription creation fails
  after payment, entitlements still flip (brand paid) and the renewal sub can be
  retried — the upgrade is never lost.
- **Cycle alignment:** the new active row carries the ORIGINAL cycle end; the
  `subscription.authenticated` guard prevents the later mandate-auth webhook
  from overwriting it.
- **Renewal mandate:** the new full-price subscription needs a fresh UPI Autopay
  mandate (Razorpay can't change a plan in place) — surfaced to the brand via a
  banner + push notification.

## Risk + validation
- Touches LIVE subscription billing and auto-deploys via shared `main`. Mitigated
  by the additive-branch design (existing flow byte-for-byte preserved) + full
  mock-path test coverage + boot smoke + qa.
- The **live** Order→webhook→re-mandate path can't be auto-tested; founder will
  validate it in Razorpay test mode (Aveen Growth→Pro). The Razorpay dashboard
  must have the **`order.paid`** webhook event enabled.

## Regression
`pnpm qa` GREEN (no Playwright workflow exercises the upgrade math). Backend boot
smoke clean. `subscription.test.js` 9/9 incl. 3 new proration tests (delta math,
downgrade fall-through, Free→paid fall-through).

## Deploy posture
PRODUCTION-IMPACTING, NO migration. Render + Vercel redeploy on push.
