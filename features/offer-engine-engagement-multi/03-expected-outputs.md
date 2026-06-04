# Expected Outputs — offer-engine-engagement-multi

## Files created
- `backend/migrations/086_ci_promoted_offers.sql` + `backend/scripts/run-086.js`
  — `campaign_influencers.promoted_brand_offer_ids uuid[]` (additive).

## Files changed
- `backend/src/controllers/campaign.controller.js`: `validatePromotedOffers()`
  helper; `invite` + `updateInfluencer` accept `promoted_brand_offer_ids`, store
  the array, force `allocation='promotional'` when present.
- `Packages/brand-web/app/dashboard/campaigns/new/page.js`: engagement offer step
  → multi-select checklist (`promoted_offer_ids`); conversion/hybrid unchanged;
  `mkInf` + draft hydration + submit payload updated.

## Behaviour (verifiable)
- Engagement invite/update with `promoted_brand_offer_ids[]` → list stored,
  `allocation='promotional'`, commission/coupon null.
- Foreign/archived id in the list → 422 (`field=promoted_brand_offer_ids`).
- Conversion single-offer path unchanged.

## QA / proof of done
- `offer-attach.test.js` **11/11 GREEN** (incl. M1 multi-select stored as
  promotional, M2 foreign id → 422); brand-web `next build` GREEN
  (`/dashboard/campaigns/new`).
- campaigns.test.js remains at the pre-existing tier-seed baseline (additive
  change; offer-attach directly covers invite/update).

## Diff gate
- `06-diff/notes.md` — Screen 03 engagement attach → wizard multi-select.

## Release classification
PRODUCTION-IMPACTING (migration 086 + backend → Render + brand-web → Vercel) but
additive. No OTA. Explicit go before push.
