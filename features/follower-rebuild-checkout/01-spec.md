# 01 — Spec: Follower rebuild — Checkout flow (functional)

**Contract:** `follower-rebuild-checkout` · shopping-journey 05–08.
**Locked reference:** Creators Vibe Yellow screens 05–08 → `04-preview/mockups/checkout.html`.
**Founder:** 'proceed to implementation, actual functionality must work' 2026-06-16.

## Build (functional, reuses the real order/commission backend)
- **`OnlineOrderScreen` → 3-step stepper** (Shipping · Payment · Review):
  - Step 1 Shipping: pick/add a saved address.
  - Step 2 Payment: **Razorpay** method confirm (UPI/cards/netbanking/wallets) — NO
    raw card form (PCI; Razorpay's secure sheet handles entry).
  - Step 3 Review: order summary (items + via-@creator + Subtotal/Shipping/Creator
    discount/Total) + shipping address + PLACE ORDER.
  - PLACE ORDER = the EXISTING real pipeline: `createOrder` (4-ID payload) → Razorpay
    sheet (`processPayment`) → `verifyOrder` → writes order + `follower_transactions`
    + influencer commission. On success → OrderConfirmation.
- **New `OrderConfirmationScreen`** (screen 08): ✓ Thank You + real Order # + Paid ₹X +
  VIEW ORDER (→ OrderDetail) + "#INFLX" share band. Replaces the old success alert.
- **Restaurant mock→live payment cutover:** `RestaurantCartScreen` `mockPayment` →
  `processPayment` (real keyId from backend; signature forwarded to verify). Whole
  purchase path is now real money.

## Real-finance / attribution
- Money: server (`createOrder.net_amount`) re-prices authoritatively; cart/review
  discount is a labelled estimate. Razorpay = real payment.
- Attribution: the 4-ID `tracking` from Cart → createOrder → `follower_transactions`
  + `creditInfluencerCommission` (audited working). "via @creator" shown on review.

## Out of scope / noted
- Order Tracking (09) = existing `OrderDetail` (reskin later). Wishlist (10) / Account
  (12) reskins later. Server-side signature re-verify + commission test = hardening.

## Acceptance
- 3 steps advance; address required to leave step 1; PLACE ORDER places a REAL order
  via Razorpay → Confirmation with the real order #; restaurant order uses live
  Razorpay. `pnpm qa` GREEN gate 0; OTA bundle compiles. released=false until founder
  real-purchase verify.
