# 3C-3 — Food cart + checkout (last food slice)

## Goal
Make the unified food cart **check out**. Everything upstream is built: the
storefront ＋ writes dish customisation (variation + add-ons + note) into the
global `CartContext`; the backend `placeOrder` resolves that customisation
server-side and applies a `brand_offer_id`. 3C-3 is the cart UI + the wiring
that carries it all into the order body, plus enabling organic ordering.

## Scope (mobile-only, OTA — NO backend / NO migration)
1. **Cart screen (Toing reskin).** `CartScreen.js` (route `Cart`) rebuilt on the
   `toing` palette. Each line renders: thumb, name, **customisation summary**
   (variation label + add-on names + cooking note), qty stepper (mutates
   `updateQty`), line price, remove. "Add more items" → `goBack`. Bill summary
   (item total, savings −pink, delivery fee, grand total). Green **Place Order**
   button.
2. **Offer-picker.** Surface the brand's published `store_offers` (already
   returned by `resolveBusinessStore`; carried into `CartContext` on add). A
   coupon-style row lists available offers; tapping applies one and shows the
   estimated saving (server re-prices authoritatively). The chosen offer's
   `brand_offer_id` flows to `placeOrder`.
3. **Enable organic ordering.** Relax the `canOrder = online_order_supported`
   gate in `RestaurantDetailScreen` so **any restaurant dish** is orderable
   organically (gate on `brand.category === 'restaurant'`). Non-restaurant
   verticals unchanged.
4. **Carry customisation into the order.** Both `CartScreen.checkout` and
   `OnlineOrderScreen.placeOrder` currently DROP `variation`/`selected_addons`/
   `note`. Thread them through the `items[]` body, mapping `selected_addons` →
   `addons` and `qty` → `quantity` (the shape `placeOrder` resolves) plus
   `brand_offer_id` at the top level.
5. **Replace-cart cross-brand dialog** (img5). Guard already lives in
   `CartContext.addItem` (`requiresConfirmation`); the storefront already shows
   the Alert. Verify the cart screen reflects a replaced cart correctly.

## Backend reality (verified — no change needed)
- `POST /follower/orders` → `transaction.controller.js placeOrder:1112`.
  Organic branch (`!campaign_influencer_id`) needs `brand_id`; accepts
  `brand_offer_id`; per-item reads `product_id, quantity, variant_*,
  variation:{item_id}, addons:[{item_id}], note`; resolves names+PRICES from DB
  (never trusts client price); validates ownership.
- `resolveBusinessStore` returns `store_offers:[{brand_offer_id, name,
  offer_type, offer_config_json, availing_modes, offer_source:'store'}]`
  (follower.service.js:510).

## Out of scope
- Storefront header/Overview/Offers/Reviews/Photos toing reskin (3C-2 note).
- Maestro gate (no device this window).
- Creator-mediated offer changes (unchanged).
