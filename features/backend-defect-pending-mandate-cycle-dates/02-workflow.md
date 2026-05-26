# Workflow — backend-defect-pending-mandate-cycle-dates

## Actor
Founder retesting the A6.5 upgrade flow after the cycle-dates fix
deploys on Render.

## Preconditions
- A6.5 / A13 shipped (commit 03f0401).
- M070 applied (razorpay_plan_id column + idempotency index).
- M071 applied (pending_mandate added to subscription_status enum).
- Razorpay test-mode plan_ids pasted in admin UI.
- Razorpay webhook configured at /v1/webhooks/razorpay.
- This commit shipped via Render redeploy.

## Workflow — Free brand upgrades to Growth Monthly (happy path post-fix #2)

1. Brand on Free opens /dashboard/settings/subscription.
2. Monthly toggle selected → clicks **Upgrade to Growth**.
3. Frontend POSTs to /v1/brands/me/subscription/upgrade.
4. `subscription.controller.upgrade`:
   - Resolves tier_id + subscription_price_id + razorpay_plan_id ✓
   - Calls razorpay.service.createSubscription → returns sub_id ✓
   - Opens transaction:
     - UPDATE existing brand_subscriptions → status='cancelled' ✓
     - **INSERT new row now sets current_cycle_start + current_cycle_end** ✓
   - Transaction commits.
   - Returns `{ status: 'mandate_pending', ... }`.
5. Frontend opens Razorpay Checkout modal.
6. Brand enters VPA `success@razorpay` + OTP `000000`.
7. Mandate authorized → Razorpay fires `subscription.authenticated`
   webhook.
8. Backend's webhook handler flips status → 'active', mandate_status
   → 'active', **overwrites cycle dates with Razorpay's actual values**.
9. Razorpay charges first cycle → fires `subscription.charged`.
10. Backend writes paid invoice.
11. Subscription page refreshes → shows **Growth · Monthly · active**.

## Success

- Brand's brand_subscriptions row exists with status='active' post-
  webhook, current_cycle_start = today, current_cycle_end ≈
  today + 30 days.
- One paid subscription_invoices row exists with status='paid'.
- pnpm qa stays 76/76 GREEN.

## Failure modes

- Render hasn't redeployed yet → same INTERNAL_ERROR. Wait ~2–3 min
  after push for Render's auto-deploy.
- Webhook URL still wrong / secret mismatched → mandate auth
  succeeds on Razorpay's side but our DB never flips status to
  'active'. Brand stuck in 'pending_mandate' visible state.
  Mitigation: separate concern — verify webhook config.
- Yet another schema mismatch we haven't caught → carve another
  defect contract.

## Non-success carve-out

Aveen has 1-2 orphan Razorpay subscriptions from earlier failed
attempts. They'll auto-cancel on Razorpay's TTL (~24h test mode).
Not a blocker for retest.
