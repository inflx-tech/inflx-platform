# Before / after — Sprint 3 cart rebuild

**Before:** every online order failed. The cart (`OnlineOrderScreen`) sent a
payload the backend rejected on six keys (`campaign_set_id` vs `set_id`, no
`campaign_influencer_id`, `delivery_address_id` vs `address_id`, `qty` vs
`quantity`, no `variant_id`, library `offer_id`) → 422. Even when create
"succeeded" the screen stopped there and never ran pay → verify, so no order
row was ever written (diagnostic D2). Adding a delivery address did nothing —
the `onSave` callback was a no-op and the list only loaded once. Fashion/
furniture products showed no colour picker, and the size block read a shape
(`variants_json.sizes`) real products never use (they use
`variants_json.colors[].sizes`), so the picker stayed invisible. Organic
followers couldn't order for delivery at all — the backend had no path
without a creator.

**After (per 04-preview/mockups/cart-rebuild.html, founder-locked):**
- Correct payload + full 3-step order (create → Razorpay → verify); the order
  now reaches the Orders tab.
- `+ Add` address returns with the new address selected and Place Order
  enabled.
- Product page reads the real `colors[]` matrix → **Select Colour** +
  **Select Size** chips; size is required before checkout; the chosen
  **colour · size + SKU** rides into the cart line and the order's
  `items_json` for fulfillment (price stays base — overrides are null).
- New **organic** brand-direct order: a follower with no creator can order
  for delivery — zero discount, zero commission, platform fee only, with
  campaign/set/CI/offer all NULL on the row. Mirrors the shipped
  `store-offer/pay` organic path.

**Verification:** `pnpm qa` 79/79 GREEN; journey driver **32/32** PASS
including the new **S6.4b** (organic online order E2E — NULL attribution,
zero commission, variant label recorded, order confirmed). Both screens
parse clean (@babel/parser, JSX). Backend `node -c` clean.

**Capture note:** before = the locked mockup; after = founder on-device walk
of the cart on a fashion/furniture product (the release gate). No Playwright
URL capture — this is a mobile-only screen pair.
