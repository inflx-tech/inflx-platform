# Workflow Definition — Store offer at food checkout

## Actor
Follower placing an organic food delivery order; brand has a published store offer.

## Preconditions
A restaurant with ≥2 products and a published, active `brand_offers` row (e.g.
BOGO: buy Chicken Biryani, get Veg Biryani free).

## Workflow steps (observable)
1. Follower builds a cart (the offer's products) and places an organic order
   (`POST /follower/orders` with `brand_id` + `brand_offer_id`, no campaign).
2. The order applies the store offer's discount (the free item is discounted).
3. On verify, the transaction row records `brand_offer_id` + `offer_source='store'`.

## Success definition
- Place response `breakdown.discount_amount` = the offer's computed discount
  (e.g. the GET item price for BOGO).
- `follower_transactions` row has `brand_offer_id` set + `offer_source='store'`
  + the discount.

## Failure / edge workflows
- No `brand_offer_id` → organic order, zero discount (unchanged behaviour).
- Unpublished / inactive / out-of-window / wrong-brand offer → 409 OFFER_UNAVAILABLE.
- Creator-mediated orders are unaffected (still use the campaign offer chain).
