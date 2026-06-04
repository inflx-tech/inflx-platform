# Impact Analysis — offer-engine-engagement-multi

## Verdict (terse)
**Additive — conversion path byte-unchanged.** A new nullable `uuid[]` column, a
new optional request field, and an engagement-only UI branch. Conversion/hybrid
(the commissioned single-offer path) is untouched.

## Mechanics
- **Migration 086** adds one nullable `uuid[]` column — no drops/backfills; existing
  rows get NULL.
- **Backend**: `invite`/`updateInfluencer` gain a `promoted_brand_offer_ids`
  branch. When absent (all current callers + conversion) → behaviour identical;
  `validatePromotedOffers` returns null and the existing single-offer/allocation
  logic runs unchanged. When present → validated against the brand's library and
  stored; `allocation` forced to `'promotional'`.
- **Wizard**: the engagement goal renders a multi-select; conversion/hybrid keep
  the exact single-select + inline builder. `mkInf`/hydration/submit extended
  additively.

## Blast radius if it failed
Confined to engagement invites that send the new array (nothing sends it until
this ships) and the engagement wizard branch. Conversion purchases/commission and
the single-offer attach are on untouched code paths.

## Regression guard
`offer-attach.test.js` 11/11 GREEN (M1/M2 cover the new path; existing conversion
attach, inline, no-offer, engagement-single still pass — same suite). brand-web
`next build` GREEN. campaigns.test.js at the known pre-existing tier-seed baseline
(additive change, twice-baselined for prior campaign.controller edits).

## Deploy posture
PRODUCTION-IMPACTING (migration 086 + backend → Render + brand-web → Vercel) but
additive. No OTA. Surfaced for explicit go.
