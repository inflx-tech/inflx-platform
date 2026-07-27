# Before / After — brand mobile Campaign Command Center (A6)

**Before:** the mobile campaign screen was a hub of **6 conditional drill-down tiles**
(Sets/Influencers/Analytics/Escrow/Content/Conversions) that appeared and disappeared as the
campaign progressed, plus a floating action queue. A campaign needing money showed a
**"Needs funding" badge with no action** — the brand had to open the web dashboard. And
`BrandActionRequiredScreen:327` navigated to `'BrandCampaignDetail'`, a route registered as
`'CampaignDetail'` — a **dead tap**.

**After:**
- A **stage rail** (Fund → Roster → Contracts → Production → Review → Payout) with the
  current stage highlighted, and **one primary action** below it — the same model as the web
  command center, so a campaign reads identically on both surfaces.
- **Fund & Publish now works on mobile**: `brandApi.publishCampaign(id)` (new client method
  for the existing `POST /campaigns/:id/publish`); on `WALLET_INSUFFICIENT` it offers to open
  the Wallet tab, where mobile top-up already exists. This closes the founder-flagged gap —
  campaign *creation* stays web-only by design, but funding/publishing a created campaign is
  post-creation and now lives on the phone.
- **Dead tap fixed** → `CampaignDetail`.

## Changed
- New `utils/campaignStages.js` (pure, 10 unit tests) + `components/brand/CampaignStageRail.js`.
- `services/api.js` — added `brandApi.publishCampaign`.
- `BrandCampaignDetailScreen` — rail + prime bar + publish/dispatch handlers.
- `BrandActionRequiredScreen` — route name fix.

## Verification
- **Mobile jest 91/91 green** (20 suites): 10 stage-logic specs + 3 smoke + 78 prior.
- Verified in the founder's single E2E pass (per feedback_e2e_verification_at_end).

## Known delta / deferred
- The 6 drill-down tiles **remain below the rail** (additive/strangler step).
- **ActionRequired is not yet a pure router** — it still duplicates per-campaign actions.
- Other brand screens keep the old palette; tab icons are still emoji.
- **Production stage is visibility-only** (inline scheduling needs the parked backend, same
  carve-out as web A5·1).
