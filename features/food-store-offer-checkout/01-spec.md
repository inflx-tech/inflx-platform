# Feature Spec — Store offer at food checkout (Offer Engine D2 wire)

## Problem / goal
The offer engine + authoring (brand_offers, BOGO/bundle/free-gift/discount, the
brand-web Offer Library product-picker, publish-to-store) all exist, and the
discount resolver (offer.service) is complete. But the FOOD delivery cart
(`placeOrder`) never applied store-direct offers — organic orders were forced to
zero discount. This wires a published store offer into the organic food-cart
checkout so BOGO/bundle/free-gift/discount actually reduce a delivery bill.

## Scope
- In scope: `placeOrder` accepts `brand_offer_id`; in the organic branch it
  fetches the published store offer (reuse `fetchStoreOfferOrThrow`), resolves
  the discount via the existing `resolveOfferDiscount`, and persists
  `brand_offer_id` + `offer_source='store'` on the order (verifyOrder INSERT).
- Out of scope: the FOOD storefront/cart mobile UI to surface + pick a store
  offer and pass `brand_offer_id` (rides with the follower cart build, Slice 3C).
  No new offer mechanics (all 5 already implemented). Discount-direct-on-product
  authoring is the existing offer library.

## Surfaces touched
- backend: transaction.controller.js (placeOrder + verifyOrder). No schema
  change (brand_offers + follower_transactions.brand_offer_id/offer_source
  already exist, migrations 084/085).
- Roles: follower (organic food order); brand (publishes the offer — existing).

## Data / contracts
- `POST /follower/orders` now accepts optional `brand_offer_id`. When present on
  an organic order, the published offer is validated (active+published+window+
  ownership) and applied; `follower_transactions.brand_offer_id` +
  `offer_source='store'` recorded. No commission (store-direct has no influencer).

## Non-functional
- INERT until a client sends `brand_offer_id` — all existing orders behave
  byte-identically (regression-tested). Invalid/unpublished offer → 409.
