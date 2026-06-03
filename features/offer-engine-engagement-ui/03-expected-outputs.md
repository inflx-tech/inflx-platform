# Expected Outputs — offer-engine-engagement-ui (D3a)

## Files changed
- `Packages/brand-web/app/dashboard/campaigns/new/page.js`:
  - offer section gate widened to `needsOffer(goal) || goal === 'engagement'`;
    goal-aware heading/copy (engagement = promotional, optional).
  - submit payload sends `offer_type` / `brand_offer_id` / `offer_config_json`
    for engagement as well.

## Files created
- contract docs + `04-preview/mockups/03-distribute.html` (Screen 03) + `06-diff/notes.md`.

## UI behaviour (verifiable)
- Engagement set → per-influencer Offer step appears with promotional copy +
  saved-offer picker; commission/coupon not shown.
- Engagement invite carries `brand_offer_id` → backend `allocation='promotional'`.
- Conversion/hybrid unchanged.

## QA / proof of done
- brand-web `next build` GREEN (`/dashboard/campaigns/new` 28.3 kB).
- Server side proven by C-backend `offer-attach.test.js` (engagement attach →
  promotional, no commission/coupon).
- `06-diff/notes.md` authored (Screen 03 engagement column → wizard).

## Release classification
**PRODUCTION-IMPACTING (Vercel) but additive** — offer section now shows for
engagement; conversion/hybrid unchanged; no backend/OTA. Explicit go before push.
