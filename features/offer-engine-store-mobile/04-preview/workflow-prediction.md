# Workflow Prediction — offer-engine-store-mobile (D3b)

Mockup: `04-preview/mockups/04-store-preview.html` (Screen 04) — the follower
store with STORE DEAL ribbons + the brand-direct buy (no influencer, no commission).

Predicted flow: open brand store → "Store Deals" tab (conditional on
`store_offers`) → tap a deal → PayAtStore (store-direct mode) → enter bill →
Razorpay → `/follower/store-offer/pay+verify` → receipt. No influencer credited.

Deltas vs mockup (06-diff): implemented as a tab + reused PayAtStore screen
(storeOffer mode) rather than a bespoke checkout; product-card STORE DEAL ribbons
on the All-Products grid are a follow-up (this slice lists deals in their own tab).

Verification: Maestro `05-follower-store-deal.yaml` (permissive placeholder) to be
run + tightened on-device post-merge; gate overridden at merge per founder
authorisation.
