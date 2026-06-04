# Before / After — offer-engine-publish-ui

**Before** = live `/dashboard/offers` (rows had only Edit/Archive; no publish
control; no distribution badges; subtitle said "(soon) publish to your store").
**After** = the implemented page. Verified by `next build` GREEN.

## Closed gaps (vs locked mockups)
| Mockup element | Before | After |
|---|---|---|
| Screen 03 ① "Publish to Store" toggle | ❌ absent | ✅ row toggle (active offers) + dialog section w/ optional dates |
| Screen 01 "◧ In store" badge | ❌ absent | ✅ shows when `published_to_store` |
| Screen 01 "★ N influencers" badge | ❌ absent | ✅ shows `attached_count` (new backend field) |
| Subtitle "(soon) publish to your store" | stale | ✅ updated to active wording |

## Notes
- Row publish toggle is shown only for **active** offers (store surfacing needs
  `status='active'`); the dialog allows toggling on a draft with an inline note
  that it goes live once Active.
- Backend change is a read-only `attached_count` subquery on the offers list.
- Mobile per-product STORE DEAL ribbons (Screen 04) remain a separate mobile item
  (the mobile "Store Deals" tab shipped in D3b/OTA v66).
- Live Playwright pixel-capture not run here; structural before/after vs the
  locked Screen 01 + Screen 03 mockups; build green; backend suites 15/15.

## Follow-up (2026-06-04): "where it's used" drill-down
Founder asked: clicking an offer should list the influencers it's attached to +
which campaign. Added: click the offer row → a detail modal listing each
attachment (influencer name/handle · campaign + set · type · status). New
read-only endpoint `GET /brands/me/offers/:id/attachments` (brand-scoped, covers
BOTH conversion `brand_offer_id` and engagement `promoted_brand_offer_ids`); the
`attached_count` badge now also counts promoted attachments. offer-attach.test.js
A1/A2 GREEN (24/24); next build GREEN. No migration.
