# Expected outputs — offer-cart-preview

1. `POST /follower/cart/price` (previewCartOffer) exists, followerAuth-guarded;
   returns `{ items_total, discount_amount, reason, offer_type, adjustments[] }`;
   creates nothing.
2. Reuses fetchPriceMap/fetchVariantPriceMap/fetchProductMetaMap +
   offerService.resolveOfferDiscount (same as placeOrder).
3. Mobile followerApi.previewCartOffer helper; CartScreen debounced preview →
   server discount + free-item rows + reason line.
4. Checkout unchanged; previewed total == charged total (non-customised carts).
5. `pnpm qa` GREEN; backend boots; mobile parses + CartScreen jest 2/2.
