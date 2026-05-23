# 06 · Diff notes — Flow 6 (brand-web campaign detail)

## Verdict

Visual + UX restructure only. Same data, same APIs, same handlers. The
single 2435-LOC tab-based page becomes a hub (~440 LOC) + 3 dedicated
sub-routes (sets ~250 LOC, reviews ~340 LOC, influencers ~830 LOC) plus
the existing `/escrow` sub-route preserved as-is.

## Files touched

| File | Type | LOC (new) | LOC (old) |
|---|---|---:|---:|
| `Packages/brand-web/app/dashboard/campaigns/[id]/page.js` | rewrite | ~430 | 2435 |
| `Packages/brand-web/app/dashboard/campaigns/[id]/sets/page.js` | NEW | ~250 | — |
| `Packages/brand-web/app/dashboard/campaigns/[id]/reviews/page.js` | NEW | ~340 | — |
| `Packages/brand-web/app/dashboard/campaigns/[id]/influencers/page.js` | NEW | ~830 | — |

Total: hub + 3 drill-downs ≈ 1850 LOC across 4 files (vs 2435 monolith
before), but split is functional — each page loads only what its drill-
down needs.

## What moved

- **Hub (`[id]/page.js`)** — yellow-pale summary card (48px progress %),
  6 drill-down tiles, inline 4-tile analytics, collapsible brief,
  sticky right-rail action queue. Status badges, breadcrumb, Outfit H1
  with yellow rule.
- **`/sets/page.js`** — per-set card with goal badge + window + budget,
  funnel row for `open_group`, mini-roster (top 5) + remainder link,
  "View all influencers in this set" CTA.
- **`/reviews/page.js`** — 2-tab queue (To review / Confirm live).
  `MediaPreview` component (signed R2 URL → img/video) + `DeliverableStatsCard`
  (likes / comments / impressions + ER + refresh) are inlined exactly as
  they lived in the monolith. Approve / Request revision / Confirm-live
  buttons preserved verbatim — calls `deliverableApi.review` and
  `deliverableApi.confirmLive`.
- **`/influencers/page.js`** — filter bar (search with yellow focus +
  Set chips + Status chips with mono counts), 2-col card grid, per-card
  status-aware action buttons. `NegotiationModal`, `ContractModal`, and
  `ProductionPanel` (nested inside ContractModal for active contracts)
  are inlined exactly as they lived in the monolith, restyled to the
  locked palette only. CSV export of the currently-filtered list.

## NO-TOUCH preserved

All API call shapes preserved — every endpoint path & request body is
identical to the OLD page. `campaignApi.get(id)`, `getEngagement`,
`getConversions`, `get(${id}/escrow)`, `get(${id}/products)` (deep
join). `deliverableApi.{getMediaUrl,get,refreshStats,review,confirmLive}`.
`negotiationApi.{get,getByCampaignInfluencer,respond}`.
`contractApi.{get,brandSign,approve,regeneratePdf,getPdfUrl}`.
`productionApi.{get,getDateRange,setVisitDetails,accept,counterPropose,
dispatch,complete,flipToRemote,initialise}`. `applicationApi.{approve,
reject}`. `brandApi.getMe()` for wallet balance + platform fee.

Auth/role gating from `layout.js` inherited unchanged. Toast pattern
preserved. All hrefs / navigation preserved. No backend, no migration,
no API, no DB change.

## QA gate

```
pnpm qa  (2026-05-23T16:13:25Z)
67/67 passed · 1.2m
STATE=GREEN · gate 0
Report: qa/reports/2026-05-23T16-13-25-414Z/QA-REPORT.md
```

No Playwright spec asserts on campaign detail layout/copy, so no spec
re-baseline needed. First run clean — no environmental flake.

## Governance gates

- Rule 1 (approved contract) ✓
- Rule 2 (release evidence at flip) — fired at close-out
- Rule 3 (mockup_locked) ✓
- Rule 4 (06-diff/notes.md present) ✓ (this file)
- Rule 5 (Maestro) does NOT fire — no `Packages/Mobile/src/**` touched

## Functional preservation

All 5 parallel API calls preserved (hub fetches all 5 in parallel for
its rollups). All 6 action handlers preserved (review, confirmLive,
openNeg, negRespond, openContract, brandSign, approveContract,
cancelInfluencer, applicationApprove, applicationReject). All 3 inline
modals (NegotiationModal, ContractModal, ProductionPanel) preserved
verbatim in `/influencers/page.js`. MediaPreview signed-URL fetch
preserved. DeliverableStatsCard refresh preserved. CSV export added
(net-new but isolated, no backend dependency — purely client-side
serialization of already-loaded data).

## Deploy classification

PRODUCTION-IMPACTING (web only). `git push origin main` → Vercel
auto-deploys brand-web. No mobile, no OTA, no backend rebuild.
