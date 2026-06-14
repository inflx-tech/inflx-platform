# 02-workflow

## Change set (single file)
`Packages/Mobile/src/screens/influencer/CampaignProductsScreen.js`
- `handlePublish` → `handleSaveNote` (alert "Recommendation saved").
- `handleUnpublish` → `handleRemoveNote` (alert clarifies product stays live).
- `publishedCount` → `notedCount` (counts `influencer_note`).
- Stats labels: Live in store (= products.length) / With note (= notedCount).
- Info banner copy → auto-live framing.
- Card: LIVE badge always rendered; note-presence checks use `influencer_note`
  (not `is_published`); CTAs reworded; "REMOVE FROM STORE" → "REMOVE NOTE";
  quick action "+ ADD NOTE & PUBLISH" → "+ ADD RECOMMENDATION".

## Expected end state
- Allocated products always show LIVE; influencer can only add/edit/remove a note.
- Removing a note keeps the product live in the store.
- No backend/API change.

## Verify
- Grep confirms no leftover `is_published` / `handlePublish` / `handleUnpublish` /
  `publishedCount` / "PUBLISH TO MY STORE" references.
- Visual logic review (no RN build step in env).
- OTA publish:all → founder verifies on device.
