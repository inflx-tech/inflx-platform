# Impact — Redesign Flow 3 · Campaign list

## Verdict

**Zero functional / backend / logic / DB impact — visual + UX only + honest drop of 2 phantom always-0 fields.**

## Files touched (1)

- `Packages/brand-web/app/dashboard/campaigns/page.js` — full visual restyle of the page + helper components (StatusBadge, CampaignCard, SummaryStats, BulkActionBar, FilterBar, ConfirmModal) using the locked palette. CampaignCard simplified: drops `spent_budget` progress bar and `influencer_count` footer (both fields are NEVER populated by any backend controller per verify-twice; today's UI shows 0 on every card).

## Files NOT touched
- `backend/**`
- All API call shapes
- `lib/api.js`
- All other dashboard files
- Mobile
- Migrations / DB schema

## NO-TOUCH (preserved exactly)
- `campaignApi.list()`, `.cancel(id)`, `.delete(id)`
- `localStorage` / cookie semantics
- `fmtRupees` import
- Selection state machine (`selectedIds` Set, `toggleSelect`, `toggleSelectAll`, `clearSelection`)
- Bulk handlers (`handleBulkCancel`, `handleBulkDelete`, `handleExportSelected`)
- Filter + sort algorithms
- ConfirmModal behaviour
- CSV export
- Draft → `/dashboard/campaigns/new?id=${id}` redirect
- Non-draft → `/dashboard/campaigns/${id}` route
- All hrefs

## Window A coordination
NONE. Window A doesn't touch campaign list. The dropped phantom-field discovery does NOT affect their revenue/billing work.

## Regression risk
LOW. `pnpm qa` 67/67 must hold; no specs assert on campaign list copy or DOM structure beyond nav reachability.

## Deploy classification — PRODUCTION-IMPACTING (web only)
- `git push origin main` → Vercel auto-deploys `brand-web`
- NO mobile, NO OTA (web-only)
- Rule 5 doesn't fire

## Time estimate
~1-2h focused work (smaller than Flow 1/2 — single file, reusing all logic).
