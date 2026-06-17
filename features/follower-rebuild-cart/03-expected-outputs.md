# 03 — Expected Outputs: Cart (functional)

- `CartProvider` mounted → `useCart()` returns the live cart (no longer the no-op).
- PDP "Add to Cart" adds the product+variant; two different sizes = two lines.
- Cart screen: qty ± and remove mutate the persisted cart; summary shows Subtotal +
  Creator discount (when an offer is carried) + Total; CHECKOUT enabled.
- CHECKOUT → OnlineOrderScreen → real createOrder/verify (live Razorpay).
- With a creator link, the order writes `follower_transactions` (4 IDs) and credits
  the influencer's `pending_balance` (existing, audited backend).
- Restaurant cart flow unchanged.
- `pnpm qa` 79/79 GREEN gate 0 (mobile-only, inert to web/backend); OTA bundle compiles.
