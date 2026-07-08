# offer-cart-preview — show WHY the total dropped in the cart (Phase 2)

## Problem (from the end-to-end trace)
Checkout already applies all 5 offer types server-side (priceOrderForGroup →
resolveOfferDiscount) — the follower PAYS the right total. But the CART had no
preview for complex offers: the client `estimateOfferDiscount` only understood
plain % / ₹ discount and returned 0 for volume / BOGO / bundle / free-gift, so
the bill didn't show the discount or the free items before checkout.

## Fix (no drift — reuse the exact engine)
### Backend — new preview endpoint
`POST /follower/cart/price` (previewCartOffer): resolves the offer config
(store-direct brand_offer OR creator CI), builds the SAME price maps as
placeOrder (fetchPriceMap / fetchVariantPriceMap / fetchProductMetaMap), runs
the SAME pure `offerService.resolveOfferDiscount`, and returns
`{ items_total, discount_amount, reason, offer_type, adjustments:[{product_id,
name, free_qty, reason}] }`. Creates NOTHING — no order, no Razorpay, no write.
Checkout code path is untouched (zero risk to money).

### Mobile — CartScreen
Debounced call to previewCartOffer on (applied offer, items) change. The bill
now uses the server discount instead of the client estimate, and renders free
items ("🎁 Free · <name>") for BOGO/free-gift + a reason line for tier offers.

## Exactness
- Non-customised carts (fashion/furniture): previewed discount == charged.
- Free-item adjustments (BOGO/free-gift): always exact.
- Food carts with add-ons: preview uses the base item subtotal (add-ons excluded
  from the % base), so a food % discount preview may be marginally conservative
  vs the final charge — never over-promises. Full add-on-aware preview is a
  follow-up if needed.

## Non-goals
- No new offer shapes (quantity-volume, BOGO redefinition → Phase 3).
- No change to checkout / redemption / settlement.

## Acceptance
Cart with a live store BOGO/free-gift offer shows the free item(s); with a
volume/discount offer shows the exact discount + reason. `pnpm qa` GREEN;
backend boots; mobile parses + CartScreen jest passes.
