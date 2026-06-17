# 01 — Spec: Follower rebuild — Cart (functional)

**Contract:** `follower-rebuild-cart` · shopping-journey sequence.
**Locked reference:** Creators Vibe Yellow screen 04 → `04-preview/mockups/cart.html`.
**Founder:** 'ok lock it ... make sure all will work in real, not just UI' 2026-06-16.

## Finding (verify-first audit)
- The order → payment → commission pipeline is REAL and works (live Razorpay,
  `follower_transactions` with 4 IDs, commission → `pending_balance` → 30-day cron).
- BUT there was **no multi-item cart for fashion/furniture/salon/car** (only restaurant),
  and critically **`CartProvider` was never mounted** — so `useCart()` returned the
  no-op default and the cart never actually worked.

## Scope (functional build, not UI-only)
1. **Mount `CartProvider`** at the app root (App.js) — makes the cart real.
2. **Extend `CartContext`** (backward-compatible): per-line variant (size/colour) via
   `line_key = product::variant_sku`; normalise price/image from either item shape;
   carry `offer` (discount line) + `creatorHandle` (the "via @creator" attribution);
   `updateQty/removeItem` match `line_key` OR `product_id` (restaurant unaffected).
3. **New `CartScreen`** (styled to mockup 04): item rows + qty steppers + remove,
   "via @creator", Cart Summary (Subtotal / Shipping / Creator discount / Total),
   CHECKOUT. Registered in `FollowerNavigator` SHARED_SCREENS.
4. **PDP `online_order` CTA → "Add to Cart"** → `addItem(...)` (with cross-brand
   confirm) → Cart.
5. **CHECKOUT → existing `OnlineOrderScreen`** (address → live Razorpay →
   `createOrder`/`verifyOrder`). The cart's `tracking` rides through → real order +
   influencer commission (audited working). No backend change needed.

## Real-finance / attribution guarantees
- Money: server re-prices authoritatively (createOrder `net_amount`); cart discount is
  a labelled estimate. Paise only at Razorpay (unchanged).
- Who-made-the-sale: the 4-ID `tracking` (campaign/set/offer/campaign_influencer) is
  stored on the cart and passed into `createOrder` → `follower_transactions` row +
  `creditInfluencerCommission` → influencer `pending_balance`.

## Out of scope / noted
- Separate Checkout (shipping/payment/review) + Confirmation/Tracking screens reuse
  the existing `OnlineOrderScreen` + `OrderDetail` for now (next sequence steps).
- No cart bottom-nav tab added (our tabs are Home/Offers/Reels/Orders/Profile); Cart
  is reached via Add-to-Cart.
- Server-side Razorpay signature re-verify + online-order commission test = flagged
  hardening follow-ups (not this contract).

## Acceptance
- `CartProvider` mounted; add 2 items (incl. 2 sizes) → both persist; qty/remove work;
  CHECKOUT places a REAL order; with a creator link the influencer's `pending_balance`
  increases. `pnpm qa` GREEN gate 0; OTA bundle compiles. released=false until founder
  real-purchase verify.
