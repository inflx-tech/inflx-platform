# Before / After — Collabs list

**Before:** two separate tabs — **Offers** (`OfferListScreen`, status sub-tabs
Active/Accepted/Declined/Expired/All) and **Campaigns** (`MyCampaignsScreen`,
Active/Completed/All) — both backed by `campaign_influencers`. A signed deal in the
`accepted/contracted/active` window appeared in **both** tabs and routed to two
different detail screens. Ink (#0A0A0A) header + yellow-accent, mono/Outfit type.

**After:** one **Collabs** tab (`CollabsListScreen`) — a single deduped, stage-filtered
pipeline. Instagram-clean: white surface, black text, hairline dividers, feed-style
rows; colour only where meaningful (yellow = your turn · blue = waiting · purple =
negotiating · green = done/live · red = closed). Bottom bar is now white with a
black-active style.

## Mockup → build fidelity
Mockups: `04-preview/mockups/collabs-lifecycle.html` + `collabs-ia.html`.
- Stage-filter tabs (All + populated stages) — **matches** the lifecycle spine.
- Row anatomy (brand · campaign · stage badge with dot · fee/second-stat · one-line
  hint + affordance) — **matches** the "row in every state" panel.
- Whose-turn signalling (yellow left rail + dot for actionable rows) — **matches**.
- IG-clean white header + bell — **matches** the IA mockup.

## Known mockup-vs-build deltas (expected per workflow-prediction, NOT defects)
1. **Bar shows 4 tabs** (Home · Collabs · Earnings · Profile), not the mockup's 5 —
   the **Create** tab is a later contract.
2. **Row taps land on the OLD detail screens** (OfferDetail pre-sign / CampaignDetail
   post-sign), not the not-yet-built `CollabDetail` — deliberate strangler step.
3. **Row shows a one-line hint + tap-through**, not inline Accept/Sign/Upload buttons —
   those actions live on the detail screen this contract routes to (avoids duplicating
   actions on the list). The mockup's per-state CTAs are realised as the row's hint +
   the destination screen's buttons.
4. **Tracking** appears as a filter/stage; the Tracking *detail* screen is a later
   contract (a tracking-stage row routes to CampaignDetail for now).

## Verification status
- Logic (stage/merge/dedupe/turn): `utils/__tests__/collabStages.test.js` — 21 green.
- Module-load + badge mapping: `screens/influencer/__tests__/collabsList.smoke.test.js`
  — 3 green.
- Full mobile jest: **52/52 green**.
- Data model verified in backend: `/offers/inbox` (getMyOffers) selects `ci.*` so
  `offer.id === campaign_influencer_id` = the dedupe key.
- **Pending (device/founder gate):** Maestro on-device flow (open app → Collabs tab →
  filter → open a row → correct detail) — Rule-5 mobile-verify gate, run on a connected
  device before `released = true`.
