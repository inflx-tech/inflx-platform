# Feature Spec — Brand mobile Campaign Command Center (A6)

> Step 2. Brings the web command-center model to brand mobile and closes the
> "must switch to web" gap for funding/publishing a created campaign.

## Problem / goal
On mobile a brand can only *look* at a campaign: the hub shows 6 conditional drill-down
tiles that appear/disappear as the campaign progresses, there is **no Fund & Publish**
(a "Needs funding" badge with no action — you must open the web dashboard), and one tap
target is dead (`BrandActionRequiredScreen` navigates to `'BrandCampaignDetail'`, a route
registered as `'CampaignDetail'`). Give mobile the same **stage rail + one primary action**
as web, and make funding/publishing possible on the phone.

Scope rule (founder-locked): campaign **creation** and **listing** stay web-only;
everything else — including funding/publishing an already-created campaign — belongs on
mobile.

## Scope
**In scope**
- `utils/campaignStages.js` — pure `deriveCampaignStage(status, counts)` + `stageTrack`,
  mirroring the brand-web stages (Fund → Roster → Contracts → Production → Review → Payout).
  Unit-tested.
- `components/brand/CampaignStageRail.js` — `StageRail` (scrollable stage chips) +
  `PrimeBar` (one primary action; calm state when nothing is pending), IG-clean.
- `BrandCampaignDetailScreen`: renders the rail + prime bar above the summary; dispatches
  the prime action (publish / applications / negotiations / reviews / live-confirm / payout)
  to the screens that already handle them.
- **Fund & Publish on mobile**: new `brandApi.publishCampaign(id)` client method (the
  backend route `POST /campaigns/:id/publish` already exists) → on `WALLET_INSUFFICIENT`
  offers to open the Wallet tab (mobile already has top-up).
- **Fix the dead route** in `BrandActionRequiredScreen` (`BrandCampaignDetail` →
  `CampaignDetail`).

**Explicitly out of scope (A6 step 2 / later)**
- Folding the duplicate **ActionRequired** inbox into a pure router (it still duplicates
  per-campaign actions).
- Full IG-clean restyle of the other brand screens + replacing the emoji tab icons.
- The mobile **Production** stage stays visibility-only (inline scheduling needs the parked
  backend, same carve-out as web A5·1).

## Surfaces touched
- App: **mobile (brand) only** — OTA. No web, no backend.

## Data / contracts
- No new endpoint. `publishCampaign` is a client method for an existing route; all other
  actions reuse existing screens/derived counts.

## Non-functional
- Publish is a real state change → explicit result alerts, honest error surfacing, reload
  on success; no optimistic fake.

## Design reference
`04-preview/mockups/command-center.html` (the shared stage model; mobile column).
