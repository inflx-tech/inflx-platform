# Workflow Prediction — offer-engine-engagement-ui (D3a)

Mockup: `04-preview/mockups/03-distribute.html` (Screen 03) — the engagement
column of the goal toggle: an offer attached to engagement influencers is
**promotional** (no commission, no tracking); followers buy it as a store deal.

Predicted flow: engagement campaign → handpick → Offer step appears (optional) →
"Use a saved offer" picker → pick → "Using saved offer" summary (no commission/
coupon) → save → invite carries `brand_offer_id` → backend `allocation=
'promotional'`. Skipping the offer = pure-engagement campaign (unchanged).

Delta vs mockup (documented in 06-diff): implemented inside the real wizard's
per-influencer Offer step (native styling) rather than the standalone mockup
panel; the goal toggle in the mockup maps to the real campaign-set goal.
