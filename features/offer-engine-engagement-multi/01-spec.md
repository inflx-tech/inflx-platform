# offer-engine-engagement-multi — engagement multi-select promoted offers

> Enhancement found in functional testing: in an **engagement** campaign the
> per-influencer offer picker was single-select, but a creator should be able to
> **feature several** of the brand's saved offers (promotional). Adds a
> multi-select for engagement + the data model + backend wiring. Conversion/hybrid
> stay single (one offer = one coupon/commission). Migration + backend + brand-web.

## Problem / goal
Engagement is promotional (no commission/coupon): a creator showcases the brand's
deals and followers buy them store-direct. One offer per influencer is too
limiting — they should promote a **list**. The single `brand_offer_id` (084) fits
conversion (one coupon) but not engagement.

## Scope
- **In scope:**
  - Migration `086`: `campaign_influencers.promoted_brand_offer_ids uuid[]` (additive, nullable) + `run-086.js`.
  - `campaign.controller` `invite` + `updateInfluencer`: accept
    `promoted_brand_offer_ids`; validate each id belongs to the brand + not
    archived (`validatePromotedOffers`); store the array; force
    `allocation='promotional'` when present.
  - Campaign wizard (engagement goal): the offer step becomes a **multi-select**
    checklist of active saved offers (toggle chips, selected count); sends
    `promoted_brand_offer_ids`. Draft hydration maps `ci.promoted_brand_offer_ids`.
  - Conversion/hybrid unchanged (single `brand_offer_id` snapshot, commissioned).
- **Out of scope:** follower-side rendering of "creator promotes these offers"
  (the offers become buyable via store-publish/store-direct already shipped);
  open-group group offers.

## Surfaces touched
- backend (`campaign.controller`, migration 086) + brand-web (`campaigns/new`).
- Roles: brand.

## Data / contracts
- New column `campaign_influencers.promoted_brand_offer_ids uuid[]`.
- `invite` / `updateInfluencer` accept `promoted_brand_offer_ids` (array). When
  present → `allocation='promotional'`, no commission/coupon. Cross-brand/archived
  id → 422 (`field=promoted_brand_offer_ids`).

## Non-functional
- **Auth/role gates:** existing campaign auth; promoted ids must be the brand's.
- **Failure modes:** a foreign/archived promoted id → 422, nothing written.
  Conversion/hybrid ignore the array (single-offer path unchanged).
- **Deploy posture:** PRODUCTION-IMPACTING (migration 086 + backend → Render +
  brand-web → Vercel) but additive — new nullable column, new optional field,
  engagement-only UI branch; conversion path byte-unchanged. No OTA.
  UI-governed → mockup-lock (Screen 03) + before/after-diff.
