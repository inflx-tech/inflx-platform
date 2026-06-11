# Workflow — offer tap-through, all three channels

1. **Store-direct** (brand published to store, no creator): follower taps the
   deal card → ProductDetail receives `{ brand_offer_id, source:'store' }` +
   display payload → `GET /follower/store-offer/:id` → offer (normalized
   discount + sanitized config) + brand + products → OfferBlock renders the
   mechanic (tiers / BOGO pair / bundle) → CTA "Pay at Venue" → PayAtStore
   with `storeOffer:{brand_id, brand_offer_id}` → existing
   `POST /follower/store-offer/pay` (no attribution — platform-owned path).
2. **Creator assignment** (conversion): tap → `{ ci_id }` →
   `GET /store/:handle/products?ci_id=…` (proven path) → products + per-CI
   offer snapshot → CTA → transact with LONG-FORM tracking
   {campaign_id, set_id, offer_id:null, campaign_influencer_id} → commission
   attributes exactly like a share-link purchase.
3. **Showcase** (engagement multi-promote): tap → `{ brand_offer_id,
   source:'showcase' }` → same detail endpoint as store; promotional —
   no tracking by design.
4. Legacy entry points (BrandStore product taps with real campaign_offers
   ids / long-form tracking) keep their exact current behaviour.

Expected end state: NO follower tap on any rendered offer can 404; every
purchase from a conversion tap lands in follower_transactions with the 4 IDs;
store-direct purchases land via the store-offer pay path.
