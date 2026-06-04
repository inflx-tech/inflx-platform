# Expected Outputs — offer-engine-publish-ui

## Files changed
- `Packages/brand-web/app/dashboard/offers/page.js`:
  - row: "◧ Publish to store / In store ✓" toggle (active offers) + "◧ In store"
    and "★ N influencers" badges.
  - dialog: "Publish to store" section (toggle + optional start/end dates);
    modal state carries publish fields; save() sends them.
  - `togglePublish()` handler; subtitle "(soon)" removed; CSS for badges/switch/section.
- `backend/src/controllers/brandOffer.controller.js`: `listOffers` returns
  `attached_count` (subquery count of `campaign_influencers` per offer).

## Behaviour (verifiable)
- Publish toggle persists via `PATCH /brands/me/offers/:id { published_to_store }`.
- Badges render from `published_to_store` + `attached_count`.
- Published+active offer appears in `GET /business/:id/store` `store_offers` (D1).

## QA / proof of done
- brand-web `next build` GREEN (`/dashboard/offers` compiles).
- Backend `brand-offer.test.js` + `offer-store-publish.test.js` = **15/15 GREEN**
  (listOffers `attached_count` addition is non-breaking).

## Diff gate
- `06-diff/notes.md` — Screen 01 (badges) + Screen 03 ① (publish toggle) vs the
  implemented page.

## Release classification
PRODUCTION-IMPACTING (brand-web → Vercel + additive backend read → Render) but
additive. No migration/OTA. Explicit go before push.
