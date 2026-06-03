# Workflow Definition — offer-engine-campaign-attach (Sub-contract C, backend)

> Step 3. API-level assertions for the per-influencer library-offer attach.

## Actor
Logged-in approved **brand** with a draft campaign + a set, plus ≥1 `brand_offers`
row and ≥1 influencer.

## Preconditions
- Migration 084 applied (brand_offer_id + allocation columns).
- Seeded: brand A (campaign + conversion set + engagement set), a library offer
  O1 (brand A, active), influencers I1/I2; brand B with library offer O2.

## Workflow steps (API-observable)
1. A invites I1 to the **conversion** set with `{ influencer_id, brand_offer_id: O1 }`
   → 201. The CI row has `brand_offer_id=O1`, `allocation='commissioned'`,
   `offer_type` + `offer_config_json` **snapshotted from O1** (not the request).
2. A invites I2 to the **engagement** set with `{ influencer_id, brand_offer_id: O1 }`
   → 201 (previously this would 422). CI has `allocation='promotional'`,
   snapshotted offer, `coupon_code` NULL, `commission_pct` NULL.
3. A invites to the engagement set with `brand_offer_id` **+ `commission_pct`**
   → 422 (promotional offers carry no commission).
4. A invites with `brand_offer_id: O2` (brand B's offer) → 404 (not in A's library).
5. A archives O1, then invites with `brand_offer_id: O1` → 422 (archived offer).
6. **Regression — inline conversion:** invite with inline `offer_type` +
   `offer_config_json` (no `brand_offer_id`) → 201, behaves as today; CI
   `offer_type/config` = the request's, `brand_offer_id` NULL, `allocation`
   ='commissioned'.
7. **Regression — engagement no offer:** invite to engagement with no offer →
   201 as today; `brand_offer_id` NULL, `allocation` NULL.
8. `updateInfluencer` on a draft CI with `brand_offer_id: O1` → snapshots O1 +
   sets `allocation` from the set goal.

## Success definition
A library offer can be attached per influencer via invite/update; the config is
snapshotted server-side (library wins); `allocation` is derived from the goal;
engagement may carry a promotional offer (no commission/coupon) while
conversion/hybrid keep requiring an offer — and **every existing inline invite
path returns identical results** (plus dormant `allocation` metadata).

## Failure / edge workflows
- Cross-brand offer → 404; archived offer → 422; engagement + commission/coupon
  → 422; conversion/hybrid with neither offer nor brand_offer_id → 422.
