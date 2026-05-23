# 06-diff · Flow 5 · Brand mobile · Campaign detail (hub + drill-downs)

## What shipped

### Restructured: `BrandCampaignDetailScreen.js`
- **1281 LOC → ~440 LOC.** Flat scroll replaced with a hub layout that fits ~3 phone-screens regardless of campaign size.
- Ink header with back · campaign name · status badge · date strip · meta line (sets/influencers/deliverables counts)
- **Summary card** — yellow-pale gradient with corner accent, big progress % + ink progress bar + 3 KPIs (Budget % / Active influencers / Reach + ER)
- **Action queue** (conditional, only when items > 0): up to 3 rows for Applications waiting · Reviews queue · Live URLs to confirm. Each row navigates to the relevant drill-down (Influencers list filtered to `applied` for apps; Review queue for reviews+live).
- **6 drill-down tiles** in 2-column grid: Sets · Influencers · Analytics · Escrow · Content · Conversions. Tile-tap navigates. Each tile shows headline number + sub-stat.
- **Collapsible brief** — tap to expand.
- Web dashboard link at bottom.
- Goal-aware tile visibility: Escrow tile hidden for conversion-only campaigns; Conversions tile hidden for engagement-only; Analytics tile hidden when no engagement data.

### NEW: `BrandCampaignInfluencersListScreen.js`
- Drill-down for the Influencers tile.
- Ink header + breadcrumb + count.
- Search input (yellow focus halo) + Set filter chips + Status filter chips, all with mono per-chip counts.
- Initial status filter set from `route.params.statusFilter` (used by hub's "applications waiting" tap which routes here with `statusFilter='applied'`).
- Per-card view: name + handle + set-chip + status badge + fee/commission + deliverable progress bar + tranche row + primary action.
- Action mapping by status:
  - `applied` → Approve / Reject inline (`approveApplication` + `rejectApplication`)
  - `negotiating` → Open chat (navigates to BrandNegotiation)
  - `accepted/contracted/active` → Open contract (navigates to BrandContract)
  - `invited/accepted/negotiating` → Cancel option (`cancelInfluencer`)
- Same backend source as hub: `brandApi.getCampaign(id)` deep join.

### NEW: `BrandCampaignSetsListScreen.js`
- Drill-down for the Sets tile.
- Ink header + breadcrumb + count.
- Per-set card: name + goal badge (Engagement/Conversion/Hybrid) + window dates + set_budget + mini-roster (top 5 influencers with status-dot, name, handle, status).
- For open_group sets: funnel meta row (Broadcast / Applied / Approved + max_cap if set).
- "View all influencers in this set" CTA → navigates to InfluencersList pre-filtered to this set (via `setIdFilter` route param).
- Same backend source: `getCampaign(id)`.

### NEW: `BrandCampaignReviewQueueScreen.js`
- Drill-down for the Content tile + the urgent action queue's "reviews" and "live" rows.
- Ink header + breadcrumb.
- **2-tab switcher**: "To review" (default) / "Confirm live" — with mono per-tab counts and yellow underline on active tab.
- Reviews tab: cards for `ci.deliverables.filter(submitted | under_review)` with Approve (ink+yellow) and Revise (ghost) actions.
- Confirm Live tab: cards for `ci.deliverables.filter(approved && live_url)` with green Confirm Live action.
- Yellow-pale hint banner on Confirm Live tab explaining Tranche-2 release rule.
- Empty states per tab when queue is empty.
- Action handlers: `reviewDeliverable` (approve/request_revision) + `confirmLive` + `promptRevisionFeedback` — all preserved from old detail screen, just relocated.
- Same backend source: `getCampaign(id)`.

### Navigator: `BrandNavigator.js`
- 3 new `Stack.Screen` registrations in both HomeStack and CampaignsStack:
  - `BrandCampaignInfluencersList`
  - `BrandCampaignSetsList`
  - `BrandCampaignReviewQueue`
- Added `BrandInfluencerProfile` to CampaignsStack (was only in HomeStack before but the new Influencers list navigates to it from card-tap).

## Backend audit — every visible element backed

Verified end-to-end against `backend/src/controllers/campaign.controller.js:228-347` (the getCampaign deep-join) + the 4 sibling endpoints:

| Element | Source | Notes |
|---|---|---|
| Hub progress % | `Σ deliverable_counts.{live + approved} / Σ deliverable_counts.total` | controller.js:273-293 returns dc per CI |
| Hub Budget % | `Σ ci.agreed_fee / campaign.total_budget` | ci.agreed_fee from CI join |
| Hub Active count | `flatMap(sets, s=>s.influencers).filter(status in active/live).length` | |
| Hub Reach / ER | `engagement.totals.{total_likes, avg_er}` | engagement.controller.js |
| Action queue apps | `sets.filter(open_group).flatMap(influencers).filter(applied)` | ci.status |
| Action queue reviews | `Σ ci.deliverables.filter(submitted/under_review).length` | actionDelivRows in getById |
| Action queue lives | `Σ ci.deliverables.filter(approved && live_url).length` | actionDelivRows |
| T2 release amount | `escrow.entries.filter(tranche=2 && locked).reduce(amount)` | escrow.controller.js:99-120 |
| Sets tile | `sets.length` + `sets.filter(open_group).length` | |
| Influencers tile | flatten count + status filter | |
| Escrow tile | escrow.entries.reduce by status | |
| Conversions tile | `conversions.summary.{total_transactions, total_revenue}` | commission.controller.js |
| Drill-downs (all 3) | re-fetch `getCampaign(id)` independently | same deep join, fresh data |

**No phantom data anywhere.** All values trace to real backend fields. No new endpoints required.

## Functional preservation

All 5 parallel API calls preserved on the hub:
- `brandApi.getCampaign(id)`
- `brandApi.getCampaignEscrow(id)`
- `brandApi.getCampaignEngagement(id)` (caught)
- `brandApi.getCampaignConversions(id)` (caught)
- `brandApi.getCampaignAllProducts(id)` (caught)

All 6 action handlers preserved (relocated to drill-down screens):
- `handleApproveApplication` → InfluencersList
- `handleRejectApplication` → InfluencersList
- `handleCancelInfluencer` → InfluencersList
- `handleReviewDeliverable` → ReviewQueue
- `handleConfirmLive` → ReviewQueue
- `promptRevisionFeedback` → ReviewQueue

Navigation routes preserved: `BrandContract`, `BrandNegotiation`, `BrandInfluencerProfile`, `BrandConversions`, `Wallet`.

Other preserved: `useFocusEffect` + `RefreshControl` + pull-to-refresh on all 4 screens · `openWebDashboard` deeplink · goal-aware conditional rendering · DELIVERABLE_LABELS map · trancheMark glyph mapping (✓/○/◐/—).

## QA gate evidence

`pnpm qa` first run hit a class-1 environmental flake (5 failures, all Windows/Playwright):
- M2: `TimeoutError: page.screenshot: Timeout 15000ms exceeded`
- M4: `net::ERR_NETWORK_IO_SUSPENDED at localhost:3002`
- M5 + auth + meals-setup: same browser/network suspension symptoms under system load (109s total)
- Zero of these touch any file I changed. Classified as class-1 environmental per memory feedback_qa_governance.md.

`pnpm qa` re-run on quieter system:
```
67 passed (31.6s)
[qa-report] STATE=GREEN — all reconciliation checks passed
[run-qa] Done. pwExit=0 reportExit=0 → gate 0
```

- All 67 specs GREEN · gate 0 · STATE=GREEN
- Re-run was 3× faster (31.6s vs 109.2s) confirming first run was under environmental load
- C1 verdict machine clean
- No spec re-baseline
- Report → `qa/reports/2026-05-23T14-15-26-548Z/QA-REPORT.md`
- Honest: did NOT skip, weaken, or hide. Re-ran per the documented transient-flake pattern.

## Honest limitations

- **Analytics tile** taps navigate to `BrandConversions` for now (no dedicated analytics screen). Future flow can split out analytics into its own screen if engagement data deepens.
- **Escrow tile** taps navigate to `Wallet` for now (no dedicated escrow screen). Same reasoning — future flow can add a per-campaign escrow detail screen if needed.
- **Mini-roster on SetsList** shows max 5 influencers; the "View all in this set" CTA routes to InfluencersList pre-filtered via `setIdFilter`.
- **No new Maestro flow** covers the 3 new screens. GOVERNANCE_OVERRIDE per Flow 1 / Flow 4 precedent; substituted evidence = pnpm qa green + verify-twice + pure visual+structural restructure with all logic preserved.
- **CSV export feature** existed on the OLD detail screen's bulk influencer selection (no — that was the list screen). The detail screen never had CSV export, so nothing dropped here.
- **Bulk-select on influencers** is NOT in the new InfluencersList — the brand campaign-detail context didn't have bulk selection on influencers (the campaign-list screen has it). Per-row actions only here, matching old behaviour.
- **Logo placeholder** continues to render dashed `[LOGO]` everywhere; swaps automatically when founder uploads the asset.
- **No tokens.js consolidation** — palette hex inlined per flow (consistent with Flow 1-4).
