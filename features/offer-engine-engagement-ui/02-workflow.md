# Workflow Definition — offer-engine-engagement-ui (D3a)

## Actor
Brand creating an **engagement** campaign, with ≥1 active library offer.

## Preconditions
- C-backend (engagement allocation) + D1/D2 live. Brand has an active saved offer.

## Workflow steps (user-observable)
1. Brand creates a campaign → **engagement** set → handpick → picks an influencer
   → Offer step now appears (previously hidden for engagement).
2. Copy reads "Offer for X to promote (optional) — no commission, no coupon;
   followers buy it as a store deal."
3. Brand picks a saved offer → "✓ Using saved offer" summary; no commission/coupon
   fields are shown.
4. Save → influencer invited with `brand_offer_id`, backend sets
   `allocation='promotional'`, commission/coupon null.
5. Brand may skip the offer entirely → pure-engagement campaign, unchanged.
6. Conversion/hybrid flows are unchanged (commission + coupon + tracked).

## Success definition
A brand can attach an optional promotional offer to engagement-campaign
influencers via the wizard; it persists with `allocation='promotional'` and no
commission/coupon; conversion/hybrid behaviour is unchanged; matches the locked
Screen 03 (engagement column).

## Failure / edge workflows
- No active offers → picker hidden; engagement offer omitted.
- Backend defensively rejects commission/coupon on engagement (the UI never sends
  them).
