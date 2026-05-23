# Workflow — Redesign Flow 5 · Brand mobile · Campaign detail (hub + drill-downs)

## Workflow steps (user-observable, preserved end-to-end)

### Hub view
1. Tap a campaign card from BrandCampaignListScreen → navigate to `CampaignDetail` with `{ campaignId }`
2. Hub fetches `brandApi.getCampaign(id)` + 4 siblings in parallel (same as today)
3. Render hub: summary card + action queue + drill-down tiles + brief + web link
4. Hub fits in ~3 phone-screens regardless of campaign size

### Drill-downs (3 new screens)
- **Tap "Sets" tile** → navigate to `BrandCampaignSetsList` with `{ campaignId }` → sets list with mini-rosters
- **Tap "Influencers" tile** → navigate to `BrandCampaignInfluencersList` with `{ campaignId }` → filtered list
- **Tap "Content" tile** OR "deliverables to review" action row → navigate to `BrandCampaignReviewQueue` with `{ campaignId, initialTab: 'reviews' }`
- **Tap "live URL to confirm" action row** → `BrandCampaignReviewQueue` with `{ campaignId, initialTab: 'live' }`
- **Tap "applications waiting" action row** → `BrandCampaignInfluencersList` with `{ campaignId, statusFilter: 'applied' }`
- **Tap "Conversions" tile** → existing `BrandConversions` screen with `{ campaignId, campaignName }`
- **Tap "Escrow" tile** → existing `BrandWallet` screen (TBD: dedicated escrow screen as future flow)
- **Tap "Analytics" tile** → for now navigate to `BrandConversions` OR keep readonly tile (TBD)

### Drill-down screen behaviour
- Each fetches its own `getCampaign(id)` on mount (clean independent state)
- Pull-to-refresh re-fetches
- Back button returns to hub
- Per-row actions trigger the existing API handlers + reload campaign data

## Success definition

Every action that worked on the old flat-scroll detail screen continues to work — just on its dedicated drill-down screen. `pnpm qa` 67/67 green. No spec re-baseline (no spec touches mobile brand screens).

## Failure / edge workflows

- API failures → empty / loading-stuck states preserved per screen
- Zero data states (no sets, no influencers, no reviews) → empty-card with appropriate copy
