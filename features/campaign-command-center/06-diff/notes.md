# 06 — Implementation / diff notes (Campaign Command Center — Phase 1)

Phase 1 of the locked Command Center. The screen already existed (contract
redesign-campaign-command-center, 2026-06-11) and was well-built — so this is a TARGETED
enhancement, not a rebuild, to close the specific gaps the founder raised.

## What was implemented (Phase 1, frontend-only, no new backend)
- **Inline content review** — in `app/dashboard/campaigns/[id]/page.js`, deliverable rows in
  the hierarchy now have inline **Approve / Request revision / View content (lazy media
  preview) / Confirm live · release T2**, calling `deliverableApi.review` /
  `confirmLive` / `getMediaUrl` and refreshing via `loadAll()`. Logic mirrors the working
  `[id]/reviews/page.js`. The full review page remains as a secondary link. This fixes the
  "content approval was removed / buried" complaint (F-2).
- **Sales/conversions at every level** — per-creator SALES/REVENUE/COMMISSION on each
  influencer row; Analytics tab now shows conversions at Level 1 (campaign), Level 2 (per
  set, summed client-side), Level 3 (per creator incl. ROI). Wired to the existing
  `/conversions` endpoint (`commission.service.getBrandConversions`: totals.total_sales/
  total_revenue/total_commission_paid/blended_roi; by_influencer[].influencer_id/sales_count/
  revenue/commission_paid/roi). No `by_set` exists → set rollup computed client-side.
- **Per-creator stage tracker** (Allocated → Approval → Contract → Content → Live) derived
  from `campaign_influencers.status` + deliverable statuses.
- **Adjacent fix** — the "confirm live" success toast read a non-existent field
  (`tranche_released.amount`); corrected to `t2_amount` in BOTH `[id]/page.js` and
  `[id]/reviews/page.js` (verified against deliverable.controller.js:447-448). Also fixed a
  pre-existing bug where the campaign Conversions header tile read `total_transactions`
  (absent) — now falls back to `totals.total_sales`/`total_revenue`.

## What matches the locked mockup
Master-detail hierarchy, per-creator lifecycle, inline content review, 3-level analytics with
per-creator sales, stage tracker — all per the v2 mockup. Reach/impressions excluded (phantom).

## What diverged / deferred to later phases
- Needs-action remains the existing banner (not yet a standalone inbox tab) — fine for P1.
- The mockup's standalone "Needs action" tab, store-clicks rollup, structured products, and
  per-creator date-window/date-change are **Phase 2/3** (see lock.json notes) — not in this push.

## What to check after deploy
- Open a campaign with a submitted deliverable → Approve / Request revision / View content
  work inline; Confirm-live shows the released T2 amount.
- Analytics tab → sales/revenue appear per set and per creator; campaign totals populate.
- Existing hierarchy, Products tab, refresh-analytics, brief all still work.

## Phase 2 + 3 (added 2026-06-20)
- P2 store-clicks rollup: new GET /brands/me/campaigns/:id/clicks (aggregates link_clicks by
  influencer + set); displayed per creator/set + Analytics L2/L3. Products already wired via /products.
- P3 per-creator dates + date-change flow: migration 106 (campaign_influencers.window_start/end
  nullable + date_change_requests table + enum) — APPLIED TO PROD 2026-06-20 via run-106.js.
  New endpoints: POST /campaign-influencers/:id/date-change (influencer creates),
  GET /brands/me/campaigns/:id/date-change-requests, POST /campaign-influencers/:id/date-change/:requestId/decision
  (brand approve→writes per-creator window / reject). Brand approve/reject card added to the
  creator detail; effective window shown (per-creator else set). Both reviewers clean; pnpm qa GREEN.
- Follow-ups: influencer-app screen to CREATE a date-change request (backend endpoint ready,
  testable via API); wrap the approve two-write in a transaction (low-risk, noted).
