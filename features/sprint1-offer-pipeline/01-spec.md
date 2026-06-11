# sprint1-offer-pipeline

> Follower-app fix plan Sprint 1 (founder go 2026-06-11, walkthrough W8/P1).
> Offers render on shelves but the TAP path is broken end-to-end:
> "Offer not found" 404s, and even past that, attribution params would
> arrive in the wrong shape, breaking payment validation.

## Verified break chain

1. `DealsScreen.goToOffer` + `SectionRenderer.goToOffer/goToProduct` send
   `offer.id = item.tracking?.oid || item.id`. For creator assignments
   `tracking.oid` = the LIBRARY brand_offer_id (adapter buildTracking) —
   not a campaign_offers id.
2. `ProductDetailScreen` derives `offerId` from that and `ciId` from
   `trk?.campaign_influencer_id` — but feed tracking uses SHORT keys
   {cid,sid,oid,iid} → ciId is ALWAYS null from feed taps.
3. `getStoreProducts` legacy branch looks the library id up in
   `campaign_offers` → 0 rows → 404 'Offer not found' (founder's report).
4. Store-published offers (`source:'store'`) have NO creator handle —
   `/store/:handle/products` is unaddressable for them; no detail endpoint
   exists at all.
5. Even when products load, transact screens receive short-key tracking →
   `payAtStore` 422s on missing campaign_id/set_id/campaign_influencer_id.

## Fix

**Backend (additive):** new `GET /v1/follower/store-offer/:id`
(authenticateOptional) — brand_offers row → adapter-normalized offer
(discount + sanitized config for OfferBlock) + brand + resolved products
(config product refs → brand_products; scope store/category → brand's
active products, category filtered, LIMIT 12). Powers store-direct and
showcase taps; pairs with the existing `POST /follower/store-offer/pay`.

**Mobile:**
- Feed taps pass an explicit offer identity: `{ ci_id }` for assignments
  (item.id), `{ brand_offer_id, source }` for store/showcase + the full
  display payload (discount, config, availing_modes) so OfferBlock renders
  without waiting on fetch.
- ProductDetail resolves: ci_id → getStoreProducts(handle,{ciId}) (proven
  path); brand_offer_id → NEW getStoreOffer(id); legacy offer.id only when
  neither (old entry points unchanged).
- ProductDetail constructs LONG-FORM txTracking {campaign_id,set_id,
  offer_id:null-for-library-ids,campaign_influencer_id} for transact
  screens; store-source dispatch passes `storeOffer:{brand_id,
  brand_offer_id}` (PayAtStore already supports it — Offer Engine D3).

## Out of scope

Shelf coverage/zones (Sprint 4), card richness (Sprint 5), business page
(Sprint 2). campaign_offers legacy branch kept for old entry points.
