# 06-diff — follower-offer-mechanics (Ship 1)

## Before
Every offer rendered as a plain discount. The product page (`ProductDetailScreen`)
only computed a %/flat price and a static badge for bogo/bundle/volume/gift — no
tier ladder, no buy-get pair, no bundle list, no gift. The offer feed
(`brandOffers.adapter.toFeedItem`) carried only a `discount` headline, not the
mechanic shape, so the client could not render type-specific UI or know which
items a bundle/BOGO/gift involves.

## After
- **Backend (additive):** `brandOffers.adapter` now derives a sanitized `config`
  (`tiers` / `buy_product` / `get_product` / `products` + `bundle_price` /
  `offers`) on every normalized offer + emits it in `toFeedItem`. Pure
  `extractConfig` unit-checked for all 5 types; tiers sorted ascending; bad input
  → null. Gated by the existing `SECTION_ENGINE_OFFERS` (on in prod). Consumers
  that ignore the field are unaffected; pricing stays server-authoritative.
- **Client module** `src/utils/offerMechanics.js` — `offerKind` (normalizes both
  vocabularies), `OFFER_META`, `composeCart(offer, baseItem)` (BOGO → adds the
  free get @ qty-matched; bundle → adds all set products; free_gift → adds the
  gift; discount/volume → the picked item only), `orderLines`, `bundleSavings`.
- **Component** `src/components/OfferBlock.js` — the locked product-page block per
  type (discount banner · volume tier ladder · BOGO buy→get pair · bundle list +
  set price + savings · free-gift pair), with the honest "in-store or online" flag
  on the cart-required types. Renders nothing for a plain/absent offer.
- **`ProductDetailScreen`** renders `<OfferBlock offer={offer} />` under the price
  block, and `dispatchCta` now sends `composeCart(...).items` as `products` so the
  existing checkout (online OR pay-at-store, both already wired to
  `resolveOfferDiscount`) carries the composed cart. Dual CTA already derives from
  `offer.availing_modes`.

## Verification
- Babel transform OK: offerMechanics.js, OfferBlock.js, ProductDetailScreen.js.
- Backend `src/app` + adapter load OK.
- `extractConfig` unit-checked against discount/volume/bogo/bundle/free_gift/empty.
- Prod read-only: only discount + volume offers live → testable now; the other
  three are built + dormant until such offers are authored.
- `pnpm qa` not runnable in sandbox → `qa_all_green: null` (honest).

## Deferred to Ship 2
Checkout discount-line + free/gift/bundle line display in OnlineOrder/PayAtStore;
`orderLines` wiring into OrderDetail (helper built, not yet rendered). No
charging-behavior change for live (discount/volume) data in this ship.
