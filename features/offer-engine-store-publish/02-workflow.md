# Workflow Definition — offer-engine-store-publish (D Phase 1, backend)

## Actor
Brand (authenticated) publishing an offer; follower (public) reading the store.

## Preconditions
- Migration 085 applied. Brand has an active library offer (B).

## Workflow steps (API-observable)
1. Brand `PATCH /brands/me/offers/:id { status:'active', published_to_store:true }`
   → 200; row has `published_to_store=true`.
2. `GET /business/:brandId/store` (public) → `data.store_offers` contains that
   offer: `{ brand_offer_id, offer_type, offer_source:'store', ... }`.
3. An active-but-unpublished offer → NOT in `store_offers`.
4. Migration: `follower_transactions` has `brand_offer_id` + `offer_source`
   (default 'influencer').
5. Regression: the existing `influencers[].offers` (campaign-driven) section of
   the store response is unchanged.

## Success definition
A brand can publish/unpublish an offer to its store; published+active offers
surface in a distinct `store_offers` array (brand-direct, no influencer); the
schema is ready for the store-direct purchase path (D2); the existing
influencer-offer store feed is unchanged.

## Failure / edge workflows
- Out-of-window (`store_starts_at` future / `store_ends_at` past) → excluded.
- Archived/draft offer → excluded.
- No published offers → `store_offers: []` (never errors).
