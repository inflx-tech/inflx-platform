# 06 — Before/After Diff Notes: Cart (functional)

Locked reference: `../04-preview/mockups/cart.html` (Creators Vibe Yellow screen 04).

## Audit finding that shaped this
The order→payment→commission backend is REAL and works (live Razorpay,
`follower_transactions` 4-ID, commission→pending_balance→30-day cron). The gaps were:
no multi-item cart for non-restaurant verticals, and **`CartProvider` was never
mounted** (so `useCart()` was a no-op — the cart never worked).

## Implemented (functional, not UI-only)
- Mounted `CartProvider` at App root (fixes the latent no-op cart).
- `CartContext`: variant `line_key`, dual-shape price/image normalize, `offer` +
  `creatorHandle`, back-compat `updateQty/removeItem` (line_key OR product_id).
- New `CartScreen` (mockup 04): item rows + qty steppers + remove + "via @creator" +
  Cart Summary (Subtotal/Shipping/Creator discount/Total) + CHECKOUT.
- `FollowerNavigator`: `Cart` registered in SHARED_SCREENS.
- PDP: `online_order` CTA → "Add to Cart" → CartContext → Cart (cross-brand confirm).
- CHECKOUT → existing `OnlineOrderScreen` → real createOrder/Razorpay/verify →
  `follower_transactions` + influencer commission (the cart's tracking rides through).

## Real-finance / attribution
- No new money path; reuses the audited backend. Cart discount = labelled estimate;
  server re-prices authoritatively at createOrder.
- "via @creator" = the campaign_influencer_id in the cart's tracking → carried into the
  order → commission credited to the influencer's pending_balance.

## Verification
- `pnpm qa`: GREEN gate 0 (mobile-only, inert to web/backend). OTA bundle (metro)
  compiles = mobile syntax gate. Founder real-purchase verify (check influencer
  pending_balance rises) before released=true.
