# Workflow Definition — offer-engine-store-direct (Sub-contract D2)

## Actor
Registered **follower**; a **brand** with a published+active store offer.

## Preconditions
- D1 live (publish + migration 085). Brand has a `brand_offers` row with
  `status='active'`, `published_to_store=true`.

## Workflow steps (API-observable)
1. Follower `POST /follower/store-offer/pay { brand_id, brand_offer_id, bill_amount:1000 }`
   → 201; `discount_amount=150` (15% store discount), `amount_to_charge=850`,
   `breakdown.influencer_commission=0`, returns `razorpay_order_id`.
2. Follower `POST /follower/store-offer/verify { razorpay_order_id, razorpay_payment_id }`
   → 200; returns `transaction_id` + `reference_code`.
3. The `follower_transactions` row has: `campaign_id/set_id/campaign_influencer_id/
   offer_id = NULL`, `brand_offer_id` set, `offer_source='store'`,
   `influencer_commission=0`, `net_amount=850`, `status='completed'`.
4. Pay against an **unpublished** (or draft/out-of-window) offer → `409
   OFFER_UNAVAILABLE`.
5. Pay with a `brand_offer_id` belonging to **another brand** → `409`.
6. Missing `brand_offer_id`/`bill_amount` → `422`.

## Success definition
A follower completes a store-direct purchase with the correct discount and ZERO
commission; the transaction is attributed to the brand offer with no influencer/
tracking; the brand's net is settled via the existing path; and the existing
influencer purchase flows are unchanged.

## Failure / edge workflows
- Unavailable/cross-brand offer → 409; invalid input → 422; discount exceeds bill
  → 422. No partial transaction on any failure (order only created after checks).
