# follower-offer-mechanics — impact

## Verdict (terse)
Additive. Zero charging change for live data (discount/volume compose = the single
item, exactly as before); new product-page UI + dormant BOGO/bundle/gift paths.

## Mechanics
- **Backend** `brandOffers.adapter`: adds a sanitized `config` field to each offer
  feed item. Pure `extractConfig`, null on bad/empty input, tiers sorted. Gated by
  `SECTION_ENGINE_OFFERS` (on in prod). Consumers ignoring the field are
  unaffected; `resolveOfferDiscount` (pricing) is untouched. Kill-switch:
  `SECTION_ENGINE_OFFERS=false`. Verified live: feed now returns `config` on 25/25
  offers; backend `src/app` loads.
- **Client**: new `offerMechanics.js` + `OfferBlock.js`; `ProductDetailScreen`
  renders the block and composes the cart on dispatch. For the only live types
  (discount/volume) `composeCart` returns the single picked item → existing
  checkout behavior is byte-for-byte unchanged. BOGO/bundle/free_gift add items —
  but no such offers exist in prod, so that path is dormant until authored.
- **Money**: pricing stays 100% server-side (`resolveOfferDiscount`), already
  handling all 5 types in `placeOrder` + pay-at-store. The client only decides
  which product_ids land in the cart; the server prices them. No new crediting,
  no fee/commission math changed.

## Risk / blast radius
Low. Follower app only. Backend change is one additive, gated, pure-function
field. Rollback = revert + re-publish, or flip the env kill-switch.

## Not in this ship (Ship 2)
Checkout discount-line + free/gift/bundle line display; `orderLines` wired into
OrderDetail. These are display-only and do not affect charging.
