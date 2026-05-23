# Spec — Redesign Flow 3 · Campaign list (web)

## Why this flow

Most-visited dashboard sub-page after home. Locks the "list of things"
pattern that contracts / influencers / products / wallet / proposals
etc. all inherit later — search + status chips + sort + bulk actions
+ card grid is a 1-pattern-fits-many surface in INFLX.

## Scope — in

**Web (1 file restyled)**
- `Packages/brand-web/app/dashboard/campaigns/page.js` — full visual restyle to the locked wave2 palette + UX refinements:
  - status filter dropdown → interactive status chips with mono per-chip counts
  - bulk action bar → black ink panel with yellow/red/white action buttons
  - campaign cards → simplified: name + dates + status badge + total budget + view-CTA
  - search input gets yellow focus halo + mono character
  - 5 summary tiles → locked-palette treatment with mono digit values
  - sort dropdown → consistent dropdown style across the app

**Honest data correction — drop 2 phantom fields:**
- Current cards display `c.spent_budget` (progress bar) + `c.influencer_count` (footer).
- Backend reality (verified-twice via `migrations/001_initial_schema.sql:199-212` + `backend/src/controllers/campaign.controller.js:221`): **neither field exists on the `campaigns` table; `SELECT *` returns nothing for them; defaults to 0**.
- Today's UI shows `0 / ₹budget` and "0 influencers" on every card — phantom data.
- Flow 3 drops both elements from the card visual. Cleaner cards + honest data discipline.
- Founder-approved direction: option (a) drop now → carve a future backend-enrichment contract IF richer cards are desired later.

## Scope — out (no-touch)

- `backend/**` (Window A territory; no enrichment endpoint here — separate contract if/when needed)
- All API calls (`campaignApi.list`, `campaignApi.cancel`, `campaignApi.delete`)
- localStorage / cookie semantics
- ConfirmModal logic (cancel + delete confirmation dialogs)
- CSV export logic (`generateCSV` + `downloadCSV` helpers preserved)
- Selection state machine (`selectedIds` Set, `toggleSelect`, `toggleSelectAll`, `clearSelection`)
- Filter / sort logic (search regex, status filter, sort algorithm)
- Bulk handlers (`handleBulkCancel`, `handleBulkDelete`, `handleExportSelected`)
- All hrefs (`/dashboard/campaigns/new`, `/dashboard/campaigns/${id}`, draft edit redirect)
- Sub-routes (`/dashboard/campaigns/[id]/*`, `/dashboard/campaigns/new`) — they slot into the new chrome but get their own flows
- Mobile (BrandCampaignListScreen is a separate flow)

## Tile audit — every visible element traces to a real backend field

| Visible element | Source |
|---|---|
| Page title + count meta | `campaigns.length` + `.filter(...).length` |
| Summary tile · Total | `campaigns.length` |
| Summary tile · Draft | `campaigns.filter(s='draft').length` |
| Summary tile · Active | `campaigns.filter(s in ['active','live']).length` |
| Summary tile · Completed | `campaigns.filter(s='completed').length` |
| Summary tile · Total budget | `campaigns.reduce(sum total_budget)` |
| Search input | Client-side regex over `c.name` |
| Status chips (with counts) | Client-side `c.status` filter; per-chip count = `.filter(s=chip).length` |
| Sort dropdown | Client-side sort by `c.created_at` / `c.total_budget` / `c.name` |
| Bulk action bar | Selection state |
| Card · name | `c.name` (campaigns.name col) |
| Card · dates | `c.start_date`, `c.end_date` (campaigns cols) |
| Card · status badge | `c.status` (campaigns.status col, enum) |
| Card · budget amount | `c.total_budget` (campaigns.total_budget col) |
| Card · view-CTA label | `c.status === 'draft' ? 'Continue draft' : 'View details'` |

No phantom metrics. Every visible value traces to a real `campaigns` table column or a client-side aggregation of the loaded array. `c.spent_budget` and `c.influencer_count` references **removed** from rendering.

## Design system this flow exercises

- Inherits Flow 1 + Flow 2 locked palette + Logo placeholder
- New patterns introduced for the rest of the redesign to reuse:
  - **Status chip row** (toggle pills with mono counts) — replaces dropdown filters
  - **Ink bulk-action bar** — black chrome with yellow/danger action buttons + clear link
  - **Compact card grid** — name + dates + status + amount + CTA (no busy footer)
  - **Search with focus halo** — yellow ring on focus, instead of border-color swap

## User-perceptible changes

1. Status filter: dropdown → 8 ink chips with per-status mono counts. One click filters; instant visual feedback.
2. Cards: progress bar gone (was always 0%); influencer count gone (was always 0). Cards read cleaner.
3. Bulk action bar: dark navy → ink black with yellow Cancel button + red Delete button + ghost Export.
4. Summary tiles: ungrouped 5-up grid with mono digits, semantic colour per status (Active = success-green).
5. Status badges: harmonise to the locked palette (live/active = success-pale, draft = muted, pending_wallet/published = yellow-pale, cancelled = danger-pale).
6. Search: yellow focus halo (matches Flow 1 OTP + Flow 2 KPI focus pattern).
7. Empty state: emoji 📣 → soft muted icon-circle + clearer next-step copy.
