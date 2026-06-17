# 06 — Before/After Diff Notes: Checkout flow

Locked reference: `../04-preview/mockups/checkout.html` (Creators Vibe Yellow 05–08).

## Implemented (functional, not UI-only)
- `OnlineOrderScreen` rewritten into a 3-step stepper (Shipping → Payment → Review).
  The REAL pipeline is preserved verbatim: `createOrder` (4-ID organic/creator payload)
  → `processPayment` (Razorpay) → `verifyOrder`. Success → OrderConfirmation (was Alert).
- New `OrderConfirmationScreen` (screen 08): ✓ Thank You + real Order # + Paid ₹X +
  VIEW ORDER → OrderDetail + #INFLX share band.
- `FollowerNavigator`: `OrderConfirmation` registered.
- `RestaurantCartScreen`: mock payment → live `processPayment` (real keyId + signature).

## Adaptation flagged + agreed
- Payment step = **Razorpay**, NOT the source's raw card form (PCI; Razorpay's secure
  sheet handles UPI/cards/netbanking/wallets). PLACE ORDER opens that sheet.
- Shipping = pick/add saved address (we store addresses) vs re-typing name/email.

## Real-finance / attribution
- No new money path. createOrder.net_amount authoritative; review discount = estimate.
- 4-ID tracking → follower_transactions + influencer commission (audited).

## Verification
- `pnpm qa`: GREEN gate 0 (mobile-only, inert to web/backend). OTA bundle (metro)
  compiles = syntax gate. Founder real-purchase verify (creator link → influencer
  pending_balance rises) before released=true.
