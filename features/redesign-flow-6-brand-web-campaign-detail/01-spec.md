# Spec — Flow 6 · Brand web · Campaign detail (hub + 3 drill-downs)

## Why this flow

Web counterpart of Flow 5 mobile. Current page (`/dashboard/campaigns/[id]/page.js`) is 2435 LOC with tab-based UI all in one file. Same 10-sets/30-influencers scale problem. Same solution: hub + dedicated drill-down sub-routes.

## Scope — in

**Restructured (1 file)**
- `Packages/brand-web/app/dashboard/campaigns/[id]/page.js` — 2435 LOC → ~800 LOC hub. Tab state machine + inline sections REPLACED by summary card + drill-down tile grid + inline analytics + sticky right-rail action queue + collapsible brief. Old palette classes (`bg-navy-deep`, `text-orange`, etc.) ELIMINATED from this file.

**3 NEW sub-routes**
- `Packages/brand-web/app/dashboard/campaigns/[id]/influencers/page.js` — full filtered influencer list. Hosts `ContractModal` + `NegotiationModal` + `ProductionPanel` inline (extracted from old page.js).
- `Packages/brand-web/app/dashboard/campaigns/[id]/sets/page.js` — set cards with goal badges + mini-rosters + open-group funnel + "View all in set" CTA.
- `Packages/brand-web/app/dashboard/campaigns/[id]/reviews/page.js` — 2-tab review queue (To Review + Confirm Live). Hosts `MediaPreview` + `DeliverableStatsCard` inline.

**Existing sub-route kept** — `/[id]/escrow/page.js` (155 LOC; restyled in-place, not moved).

## Scope — out (no-touch)

- `backend/**` — ZERO change. Same 5 endpoints as today (campaignApi.get/getLive/getEngagement/getConversions/products + sibling escrow).
- All API call shapes (`deliverableApi.*`, `negotiationApi.*`, `contractApi.*`, `productionApi.*`, `applicationApi.*`)
- All other web files
- Mobile (no OTA needed; Flow 5 already shipped mobile)
- Sub-route at `/escrow` (visual restyle in-place, not relocated)

## Tile audit — every visible element traces to a real backend field

Same audit table as Flow 5 mobile. `campaignApi.get(id)` returns deep join from `campaign.controller.js:228-347`. Sibling endpoints provide escrow/engagement/conversions/products data.

| Visible element | Source | Verified |
|---|---|---|
| Hub progress % | `Σ ci.deliverable_counts.{live+approved} / Σ .total` | ✓ |
| Budget % | `Σ ci.agreed_fee / campaign.total_budget` | ✓ |
| Active count | `flatMap(sets, s=>s.influencers).filter(s.status in active/live).length` | ✓ |
| Reach + ER | `engagement.totals.{total_likes, avg_er}` | ✓ |
| Apps waiting | `sets.filter(open_group).flatMap(infs).filter(status='applied').length` | ✓ |
| Reviews + Lives queue | `Σ ci.deliverables.filter(...).length` | ✓ ci.deliverables (action-only rows) |
| T2 release amount | `escrow.entries.filter(tranche=2 && locked).reduce(amount)` | ✓ |
| Tile values (Sets/Influencers/Content/Escrow/Conversions/Publishing) | derived from same campaign + sibling responses | ✓ |
| Drill-down cards (per-row in 3 sub-routes) | ci.* fields + deliverables[] + tranche_statuses + transaction_count | ✓ |

**No phantom fields. Zero new backend endpoints required.**

## Functional preservation

All 6 action handlers preserved (relocated to drill-down sub-routes):
- `applicationApi.approve` / `.reject` → influencers sub-route (for status='applied')
- `deliverableApi.review` (approve / request_revision) → reviews sub-route
- `deliverableApi.confirmLive` → reviews sub-route
- Negotiation flow (`negotiationApi.get` / `respond` / `getByCampaignInfluencer`) → influencers sub-route via NegotiationModal
- Contract flow (`contractApi.get` / `brandSign` / `approve` / `regeneratePdf` / `getPdfUrl` / `retryCreate`) → influencers sub-route via ContractModal
- Production flow (`productionApi.*` — 10 methods) → influencers sub-route via ProductionPanel (nested inside ContractModal)
- Deliverable preview (`deliverableApi.getMediaUrl` / `refreshStats` / `get`) → reviews sub-route via MediaPreview + DeliverableStatsCard

Navigation routes preserved. All `useEffect` data-loading patterns preserved. All toast notifications preserved.

## Design system this flow exercises

Inherits locked palette from Flow 1-5. Web-specific patterns:
- **Yellow-pale summary card with corner accent** (hero section)
- **3-column drill-down tile grid** (desktop space allows)
- **Sticky right-rail action queue** (desktop convention; mobile uses inline rows on hub)
- **Filter bar with mono per-chip counts** (matches Flow 3 web campaigns list)
- **Inline modals for ContractModal / NegotiationModal / ProductionPanel** (web-only — mobile pushes to dedicated screens)

## Deploy classification

PRODUCTION-IMPACTING (web only). `git push origin main` → Vercel auto-deploys brand-web. **No OTA, no mobile change.** gov-check Rule 5 does NOT fire (no Mobile/src/** touched).
