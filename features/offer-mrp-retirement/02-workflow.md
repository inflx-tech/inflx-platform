# Workflow — offer-mrp-retirement

## Brand
1. Lists a product → enters ONE price (no MRP field).
2. To discount it, creates an offer in the Offers tab (published to store).

## Follower — with a live store discount offer on the product
3. Browse card shows: price + "X% OFF" badge + discounted price — computed from
   the offer (offerApplies/discPct), not MRP.
4. PDP shows the offer (OfferBlock) + discounted price (unchanged).
5. Cart/checkout charge the discounted total (unchanged — server applies).

## Follower — no offer on the product
6. Browse card shows a single price, no strike, no badge.
7. PDP shows the single price.

## Regression guards
- Food dish with an old mrp value: no strike any more (mrp dropped from payload).
- min_discount_pct shelves: fill from offers only.
- Checkout math: identical (offer engine already authoritative).
