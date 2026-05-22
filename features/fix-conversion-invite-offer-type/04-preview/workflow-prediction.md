# Workflow prediction — D9 fix

## Before (the bug)
1. Brand adds a handpick influencer to a conversion set.
2. Fills post date + commission %, leaves Offer type unselected.
3. Clicks "Review →" — **wizard allows it** (offer_type not validated).
4. Clicks Publish — campaign goes `active`.
5. Backend invite 422s (offer_type required) — **swallowed**.
6. Brand sees an active campaign with **0 influencers**. No error. 😞

## After (the fix)
1. Brand adds a handpick influencer to a conversion set.
2. Fills post date + commission %, leaves Offer type unselected.
3. Clicks "Review →" — **blocked**; "Pick an offer type" shows in red
   under the Offer-type grid; the step-2 error summary counts it.
4. Brand picks an offer type (e.g. Discount 20%).
5. "Review →" now proceeds; Publish → invite **201**; influencer
   persists. ✅

## Unchanged
- Engagement sets: offer_type still forbidden (check gated behind
  `needsOffer` = conversion/hybrid only).
- The happy path (offer type selected) — identical to today; the
  conversion E2E spec stays green.
