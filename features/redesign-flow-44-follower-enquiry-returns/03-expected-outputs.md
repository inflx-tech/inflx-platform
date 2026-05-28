# Flow 44 — Expected outputs

## Visual end state
- **EnquiryScreen** renders on light brandPalette: ink hero ("Enquire at {brand}"
  + mono via @handle), yellowPale offer strip with ink/yellow %OFF badge, white
  form card with mono uppercase labels (required = red *), pre-filled name/phone in
  mono, ink/yellow "Submit Enquiry" + mono privacy note. Success = yellow
  check-tile + Outfit-Black "Enquiry Submitted!" + ink/yellow Done.
- **MyReturnsScreen** renders on light brandPalette: ink hero ("My Returns" + mono
  count), white return cards (bg2 thumb + Outfit product name + muted brand + mono
  date), brandPalette status pills (pale bg + dark text), mono refund in
  successText, yellowPale "From INFLX" admin-notes box. Empty state = muted glyph +
  Outfit "No returns yet". Pull-to-refresh uses ink tint.

## Functional end state (UNCHANGED — proof = preserved markers + QA)
- Enquiry: validate → `submitEnquiry({brand_id, campaign_id, set_id,
  campaign_influencer_id, form_data{... offer_id}})` → success state. Name/phone
  pre-filled from `inflx_user`.
- Returns: `listMyReturns()` → list render with status/refund/notes; pull-to-refresh
  + focus reload; empty branch when none.

## QA gate
`pnpm qa` → **76 passed, gate 0, STATE=GREEN** (zero regression). JS-only; ships via
OTA (NATIVE_RUNTIME=2), no native rebuild.

## Deploy
`pnpm publish-ota:all` → brand v94 / influencer v83 / follower v57 (shared bundle).
production-impacting (follower OTA serves restyled screens).
