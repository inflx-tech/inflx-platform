# Workflow — backend-defect-pending-mandate-enum

## Actor
Founder retesting the A6.5 upgrade flow after M071 lands.

## Preconditions
- A6.5 / A13 shipped (commit 03f0401).
- M070 applied (`subscription_prices.razorpay_plan_id` column).
- Razorpay test-mode plan_ids pasted in admin UI.
- Razorpay webhook configured at /v1/webhooks/razorpay.
- M071 applied (this contract's fix).

## Workflow — Free brand upgrades to Growth Monthly (happy path post-fix)

1. Brand on Free opens /dashboard/settings/subscription.
2. Monthly toggle selected → clicks **Upgrade to Growth**.
3. Frontend POSTs to /v1/brands/me/subscription/upgrade.
4. `subscription.controller.upgrade`:
   - Resolves tier_id + subscription_price_id + razorpay_plan_id ✓
   - Calls razorpay.service.createSubscription → returns sub_id ✓
   - Opens transaction:
     - UPDATE existing brand_subscriptions → status='cancelled' ✓
     - **INSERT new row with status='pending_mandate' (now in enum)** ✓
   - Transaction commits.
   - Returns `{ status: 'mandate_pending', razorpay_subscription_id,
     razorpay_key_id }`.
5. Frontend opens Razorpay Checkout modal.
6. Brand enters VPA `success@razorpay` + OTP `000000`.
7. Mandate authorized → Razorpay fires `subscription.authenticated`
   webhook.
8. Backend's webhook handler flips status → 'active', mandate_status
   → 'active', sets cycle dates + mandate_id.
9. Razorpay charges first cycle → fires `subscription.charged`.
10. Backend writes paid invoice.
11. Subscription page refreshes → shows **Growth · Monthly · active**.

## Success

- Brand's brand_subscriptions row exists with status='active' (post
  webhook).
- One paid subscription_invoices row exists with status='paid'.
- pnpm qa stays 76/76 GREEN.

## Failure modes

- M071 not applied → upgrade still 22P02s with "Invalid ID format".
  (Pre-fix state.)
- Webhook URL still wrong / secret mismatched → mandate auth
  succeeds on Razorpay's side but our DB never flips status to
  'active'. Brand stuck in 'pending_mandate' visible state.
  Mitigation: separate concern — verify webhook config.
- Razorpay test mode VPA mistyped → Razorpay rejects mandate.
  `subscription.halted` fires → status flips to 'past_due'. Brand
  retries upgrade.

## Non-success carve-out

Aveen food paradise's earlier attempt today created an orphan
Razorpay subscription (sub_id known only to Razorpay's logs). That
orphan auto-cancels in Razorpay's test environment within ~24h or
on Razorpay-side TTL. Not a blocker for retest — the retry creates
a fresh subscription that will authenticate cleanly.
