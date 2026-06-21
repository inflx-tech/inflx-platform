# Impact Analysis — Store offer at food checkout

## Affected files
- backend/src/controllers/transaction.controller.js — placeOrder (accept
  brand_offer_id, organic-branch store-offer fetch + resolve), createOrder meta
  (brand_offer_id/offer_source), verifyOrder INSERT (+2 columns).
- backend/tests/food-store-offer-checkout.test.js (NEW).

## Affected routes / APIs
| Method | Path | Change |
|---|---|---|
| POST | /follower/orders | accepts optional brand_offer_id (organic store offer) |
| POST | /follower/orders/verify | persists brand_offer_id + offer_source |

## Affected workflows (regression surface)
- Existing food/online orders (organic with no offer, and creator-mediated) —
  byte-identical. Verified: food-customisation order tests 3/3 still green;
  new test confirms no-offer organic still = 0 discount.

## Migration / deploy / OTA impact
- No migration (brand_offers mig 084, follower_transactions.brand_offer_id/
  offer_source mig 085 already exist).
- Backend → Render. Production-impacting BUT inert until a client passes
  brand_offer_id (no current client does → the food cart offer-picker is a later
  mobile slice). No web/mobile/OTA in this changeset.

## Risk notes
- Money/order path change — guarded: store offer validated (active+published+
  window+ownership) via existing fetchStoreOfferOrThrow; reuses the existing
  resolveOfferDiscount. No commission on store-direct (no influencer). Inert for
  all existing orders until a client opts in with brand_offer_id.
