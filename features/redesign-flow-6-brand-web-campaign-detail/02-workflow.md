# Workflow — Flow 6 · Brand web campaign detail (hub + drill-downs)

## Workflow steps (preserved end-to-end)

### Hub view
1. Click a campaign card from `/dashboard/campaigns` → route to `/dashboard/campaigns/[id]`
2. Hub fetches `campaignApi.get(id)` + auto-fetches engagement + (conversions/products for conversion campaigns) — same parallel-load pattern as today
3. Render hub: header (breadcrumb + title + status + meta) + summary card + 6 drill-down tiles + inline analytics + collapsible brief + right rail (action queue + web-only-tools card)

### Drill-downs (sub-routes)
- Click Sets tile → `/dashboard/campaigns/[id]/sets`
- Click Influencers tile → `/dashboard/campaigns/[id]/influencers`
- Click Content tile → `/dashboard/campaigns/[id]/reviews`
- Click Escrow tile → `/dashboard/campaigns/[id]/escrow` (existing sub-route, restyled)
- Click Conversions tile → `/dashboard/conversions?campaign=X` (existing top-level page)
- Click Publishing tile → can stay on hub OR route to `/[id]/products` (deferred — minor)

### Action queue (right rail on hub)
- "N applications waiting" row → `/[id]/influencers?statusFilter=applied`
- "N deliverables to review" row → `/[id]/reviews?tab=reviews`
- "N live URLs to confirm" row → `/[id]/reviews?tab=live`

### Sub-route /influencers behaviour
- Re-fetches `campaignApi.get(id)` on mount
- Filter: search (by name/handle) + Set chips + Status chips with mono counts
- Cards: status-aware action buttons (Approve/Reject for applied · Open chat for negotiating · Open contract for accepted/contracted/active · Cancel for invited/accepted/negotiating)
- Inline modals: ContractModal · NegotiationModal · (ProductionPanel inside ContractModal)
- Toast feedback on action success/failure

### Sub-route /sets behaviour
- Re-fetches `campaignApi.get(id)` on mount
- Set cards with mini-roster (top 5) + funnel for open_group + "View all in set" CTA → `/[id]/influencers?setId=X`

### Sub-route /reviews behaviour
- Re-fetches `campaignApi.get(id)` + `campaignApi.getLive(id)` on mount
- Two tabs: "To Review" (default; deliverables status in submitted/under_review) + "Confirm Live" (status='approved' && live_url)
- Per row: deliverable card with MediaPreview (R2 signed URL) + DeliverableStatsCard (with refresh)
- Actions: Approve (deliverableApi.review approve) · Revise (deliverableApi.review request_revision with feedback prompt) · Confirm Live (deliverableApi.confirmLive)

## Success definition

Every action that worked on the old 2435-LOC page continues to work. `pnpm qa` 67/67 green (no spec re-baseline expected — no spec asserts on campaign detail copy/layout).

## Failure / edge workflows (unchanged)

- API failures → toast notifications + empty/loading states
- Auth/role mismatch → redirect to login per existing layout.js logic
- Empty data (no sets / no influencers / no reviews) → empty-state cards per sub-route
