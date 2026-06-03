# Expected Outputs — offer-engine-campaign-attach-ui (Sub-contract C, UI)

## Files changed
- `Packages/brand-web/app/dashboard/campaigns/new/page.js`:
  - `OFFER_KEY_TO_LABEL` map (offer_type key → wizard label).
  - `mkInf` gains `brand_offer_id: null`; draft hydration maps
    `ci.brand_offer_id`.
  - `libOffers` state + load (`brandApi.getOffers({status:'active'})`).
  - Handpick offer step: "Use a saved offer" `<select>` + "Using saved offer"
    summary; inline builder rendered only when no saved offer is picked.
  - Invite/update payload sends `brand_offer_id`; omits `offer_config_json` when
    a saved offer is attached.

## Files created
- contract docs + `04-preview/mockups/03-distribute.html` (the locked Screen 03)
  + `06-diff/notes.md`.

## UI behaviour (verifiable)
- With active offers: picker appears; selecting one shows the summary and
  satisfies the offer requirement; saving invites with `brand_offer_id`.
- Without active offers / "Author inline": existing inline flow unchanged.
- Draft re-open preserves the saved-offer selection.

## QA / proof of done
- brand-web `next build` GREEN (`/dashboard/campaigns/new` compiles, 28.2 kB).
- C-backend `offer-attach.test.js` already proves the server side (invite/update
  with `brand_offer_id` → snapshot + allocation).
- `06-diff/notes.md` (Screen 03 → wizard) authored.

## Release classification
**PRODUCTION-IMPACTING (Vercel) but additive** — picker only appears with active
offers; inline path byte-unchanged. No backend/OTA. Explicit go before push.
