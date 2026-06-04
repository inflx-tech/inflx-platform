# Workflow Definition — offer-engine-engagement-multi

## Actor
Brand creating an **engagement** campaign (handpick) with ≥2 active saved offers.

## Workflow steps (user-observable)
1. Engagement campaign → pick influencer → Offer step shows **"Offers to promote
   (select any)"** — a checklist of active saved offers.
2. Tap multiple offers → each toggles a ✓; a "N selected" line updates.
3. Finish & save → each selected offer is stored on that influencer
   (`promoted_brand_offer_ids`), `allocation='promotional'`, no commission/coupon.
4. Re-open the draft → the same offers stay selected (hydrated).
5. **Conversion** campaign offer step is unchanged — single "Use a saved offer"
   picker (one offer, commissioned).

## Success definition
In engagement, a brand can select **any number** of saved offers per influencer;
they persist as a list with promotional allocation; conversion/hybrid keep the
single-offer behaviour; a foreign/archived offer id is rejected (422).

## Failure / edge workflows
- No active offers → a hint to create some in the Offers library (no picker).
- A promoted id not in the brand's library / archived → backend 422.
