# 03 — Expected Outputs: Checkout flow

- Stepper (Shipping/Payment/Review); cannot leave step 1 without a selected address.
- Payment step = Razorpay (UPI/cards/netbanking/wallets), no raw card fields.
- Review shows items + via-@creator + Subtotal/Shipping/Creator discount/Total + address.
- PLACE ORDER → real createOrder → Razorpay → verify → OrderConfirmation with the real
  order # + Paid amount; VIEW ORDER opens OrderDetail.
- With a creator link, the order writes follower_transactions (4 IDs) + credits the
  influencer's pending_balance.
- Restaurant order uses live Razorpay (no more mock).
- `pnpm qa` 79/79 GREEN gate 0 (mobile-only, inert); OTA bundle compiles.
