# concept-stagec3-checkout — Review Order · COD · Success

Founder reviewed the board (04-preview/mockups/c3-checkout.html) in the
browser pane, 2026-07-25: "ok got it, pls start implementation." Two board
calls confirmed: payment method lives ON the Review screen (no separate
page), and login stays at the final tap (guest-first law).

## Scope

1. **Review Order (new screen)** — Bag → Proceed → address card (Change →
   picker/book) · condensed items with "via @creator" · Pay with (online /
   COD) · engine bill (figures handed from the Bag's preview; backend
   re-prices at createOrder). One yellow CTA: "Pay ₹X" or "Place Order".
2. **COD** — admin toggle + fee knob in follower_app_config
   (cod_enabled/cod_fee, zero migration for knobs). Server enforces the
   toggle at placeOrder (422 when off) — never just hidden UI. Fee ≥ 0
   from config; ₹0 = no fee line anywhere. Bill shows the fee + "To Pay
   on delivery"; success shows a COD badge with the amount due.
3. **Order placement machinery moved** from CartScreen to ReviewOrder:
   guest gate at the final tap (FollowerLogin onDone resume), guest
   address sync → server address_id, createOrder → Razorpay → verify
   (online) or createOrder{payment_method:'cod'} → done.
4. **Success screen** — white-law variant of OrderConfirmation for
   kind:'shop' (black tick, order #, COD badge, address recap, black
   Track in My Orders, Continue shopping). Food keeps Creator Vibe.
5. **Admin** — Checkout section on the existing App Settings page
   (P3G page found; C3 adds COD toggle + fee input; adjacent-fix: the
   show_product_ratings knob mobile already reads gets its switch).

## Backend

- Migration 144 (applied to prod pre-push): follower_orders.payment_method
  ('prepaid' default = historical truth) + cod_fee (once per checkout, on
  the primary order row).
- placeOrder COD branch: prices groups identically to prepaid, then
  settles through the SAME write path verify uses — settleOrders() is the
  shared extract (writes in one transaction + notifications + response).
  COD orders are therefore identical to prepaid in attribution,
  commission crediting, return-window and G-3 deferred brand settlement
  (cash is collected at delivery, well inside the return window; the
  existing claw-back rails cover COD refusal).
- COD fee is platform revenue: recorded on the order row, excluded from
  brand_net/commission math.

## Out of scope

Platform-fee line (founder: not required) · cancel-until-dispatched +
tracking timeline (C4) · Razorpay Route settlement (Wave 3) · online
payment-method preselect row (Razorpay owns method choice now).
