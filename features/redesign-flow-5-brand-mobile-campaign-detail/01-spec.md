# Spec — Redesign Flow 5 · Brand mobile · Campaign detail (hub + 3 drill-downs)

## Why this flow

The current `BrandCampaignDetailScreen.js` (1281 LOC) renders every section inline in one flat scroll. At 10 sets / 30 influencers / 50 deliverables this becomes ~6000-8000px of unbroken scroll — unusable. The founder explicitly flagged: "if we have 10 sets...30 influencers... user wants list of sets in another page". This contract restructures the screen as a hub + drill-downs.

## Scope — in

**Restructured (1 file)**
- `Packages/Mobile/src/screens/brand/BrandCampaignDetailScreen.js` — from 1281-LOC flat scroll → ~400-LOC hub view: header + summary card + urgent action queue + 6 drill-down tiles + collapsible brief + web link. Drops inline rendering of sets / influencers / reviews / live-confirms — those move to dedicated screens.

**3 new screens**
- `Packages/Mobile/src/screens/brand/BrandCampaignInfluencersListScreen.js` — filtered influencer list (set filter chips + status filter chips + search). When status='applied' filter is active, shows inline Approve/Reject actions per row.
- `Packages/Mobile/src/screens/brand/BrandCampaignSetsListScreen.js` — set cards with embedded influencer mini-roster (top 3-5) + funnel counts for open_group sets.
- `Packages/Mobile/src/screens/brand/BrandCampaignReviewQueueScreen.js` — 2 tabs: Content reviews + Confirm Live. Per-row actions preserved.

**Navigator (1 file)**
- `Packages/Mobile/src/navigation/BrandNavigator.js` — register the 3 new screens in both `HomeStack` and `CampaignsStack` (mirroring the existing `CampaignDetail` placement).

## Scope — out (no-touch)

- `backend/**` — zero backend change. All data flows through the existing `brandApi.getCampaign(id)` + 4 sibling endpoints.
- API call shapes (`getCampaign`, `getCampaignEscrow`, `getCampaignEngagement`, `getCampaignConversions`, `getCampaignAllProducts`, `approveApplication`, `rejectApplication`, `cancelInfluencer`, `reviewDeliverable`, `confirmLive`)
- Other brand mobile screens (BrandContract, BrandNegotiation, BrandInfluencerProfile, BrandConversions — all reused as drill-targets)
- Web (Vercel/Render no-op push)

## Backend audit — every visible element traces to a real backend field

| Visible element | Source endpoint / field | Verified |
|---|---|---|
| **HUB · Summary card** | | |
| Progress % | `Σ(ci.deliverable_counts.live + .approved) / Σ(ci.deliverable_counts.total)` | ✓ campaign.controller.js:273-293 |
| Budget allocated | `Σ(ci.agreed_fee)` from `campaign.sets[].influencers[]` | ✓ |
| Active influencers | `flatMap(sets, s=>s.influencers).filter(s.status in active/live).length` | ✓ ci.status |
| Reach (likes) | `engagement.totals.total_likes` | ✓ engagement.service.js |
| Avg ER | `engagement.totals.avg_er` | ✓ |
| **HUB · Action queue** | | |
| Applications waiting | `sets.filter(open_group).influencers.filter(status='applied').length` | ✓ |
| Reviews queue count | `Σ ci.deliverables.filter(status in submitted/under_review).length` | ✓ ci.deliverables (action-only rows) |
| Live confirms count | `Σ ci.deliverables.filter(status='approved' && live_url).length` | ✓ |
| T2 release amount | `escrow.entries.filter(tranche_number=2, status='locked').reduce(amount)` | ✓ |
| **HUB · 6 drill-down tiles** | | |
| Sets tile | `sets.length` + `sets.filter(open_group).length` | ✓ |
| Influencers tile | `Σ influencers` + active/negotiating breakdown | ✓ |
| Analytics tile | `engagement.totals.total_likes` + `.avg_er` | ✓ |
| Escrow tile | `escrow.entries.filter(status).reduce(amount)` | ✓ |
| Content tile | `Σ(dc.live)` / `Σ(dc.total)` | ✓ |
| Conversions tile | `conversions.summary.total_transactions` + `.total_revenue` | ✓ |
| **InfluencersList drill-down** | | |
| Card: name, handle, set, status, fee/comm, deliverable progress, tranches | ci.* from `getCampaign(id)` deep join | ✓ |
| Set filter chips | `sets.map(s => ({label: s.name, count: s.influencers.length}))` | ✓ |
| Status filter chips | derived from ci.status group counts | ✓ |
| **SetsList drill-down** | | |
| Set card: name, goal, mode, window, budget, mini-roster, funnel | sets[] + nested influencers | ✓ |
| **ReviewQueue drill-down** | | |
| Reviews tab rows | `flatMap(sets, s=>s.influencers).flatMap(ci=>ci.deliverables).filter(submitted/under_review)` | ✓ |
| Confirm-live tab rows | same flatMap, filtered status='approved' && live_url | ✓ |

**No phantom data. Zero new backend endpoints required. Single source of truth = `getCampaign(id)` + 4 siblings.**

## Functional preservation

- All 5 parallel API calls preserved
- 6 action handlers preserved and relocated to their dedicated screens:
  - `handleApproveApplication` / `handleRejectApplication` → InfluencersList (when status='applied' filter)
  - `handleCancelInfluencer` → InfluencersList per row
  - `handleReviewDeliverable` → ReviewQueue (Reviews tab)
  - `handleConfirmLive` → ReviewQueue (Confirm Live tab)
  - `promptRevisionFeedback` → ReviewQueue (Reviews tab)
- Navigation routes preserved (`BrandContract`, `BrandNegotiation`, `BrandInfluencerProfile`, `BrandConversions`)
- `useFocusEffect` + `RefreshControl` + pull-to-refresh on all screens
- `openWebDashboard` deeplink preserved

## Deploy classification

PRODUCTION-IMPACTING (mobile-only). OTA × 3 (brand/influencer/follower — shared bundle). Vercel/Render no-op.
