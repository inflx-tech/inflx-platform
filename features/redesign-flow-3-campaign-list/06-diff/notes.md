# 06-diff · Redesign Flow 3 · Campaign list

> Honest comparison of what shipped vs the mockup in
> `04-preview/mockups/web.html`.

## What shipped — `Packages/brand-web/app/dashboard/campaigns/page.js`

### Page header
- Breadcrumb `/dashboard / campaigns` (mono, uppercase)
- "Campaigns" H1 (Outfit 700) + yellow rule
- Meta line: `total · live · drafts` with mono digit counts
- Yellow "+ New campaign" CTA (Outfit 700, ink text)

### 5 summary tiles
- Total / Draft / Active / Completed / Total budget
- Mono digit values, semantic per-tile color (Active = success-green, Draft = muted, Completed = ink-2)
- Sub-line description per tile

### Filter bar (single white card)
- Search input with yellow focus halo + mono character
- **Status dropdown → 8 chip-toggles** (All + 7 statuses) with mono per-chip counts
- Active chip = ink black with white text; inactive = muted pill with hover-to-ink
- Sort dropdown right-aligned, custom chevron

### Bulk action bar (when selection > 0)
- Ink black bg with white text + yellow Cancel + danger-red Delete + white-ghost Export
- "N selected" + ghost Clear link

### Select-all row
- Ink-accent checkbox + body-font copy ("Select all N" / "Deselect all")

### Campaign cards (simplified — phantom fields dropped)
- Checkbox · title (Outfit 700, truncated) · dates (mono, "→" arrow) · status badge (locked palette)
- "Budget" row (border-top) with mono amount (right-aligned); "—" if no budget set
- Footer CTA (border-top): "View details" (muted) or "Continue draft" (yellow-hover, bold)
- Mono `→` arrow at far right
- Hover: lift 1px + soft shadow + darker border
- Selected: ink border + soft outer ring
- **Removed:** budget-used progress bar (was always 0%)
- **Removed:** "N influencer(s)" footer (was always 0)

### Confirm modals
- Locked palette restyle: rounded 18px, blurred backdrop, yellow Cancel button, danger-red Delete button, ghost Cancel-action button
- Same trigger conditions, same `campaignApi.cancel`/`.delete` bulk loops, same partial-success alerts

### Empty states
- Soft muted icon-circle with `·` glyph + clearer "No campaigns yet" message + yellow CTA

## Functional preservation — verified post-edit

- `campaignApi.list()` → `GET /campaigns` — unchanged
- `campaignApi.cancel(id)` — unchanged
- `campaignApi.delete(id)` — unchanged
- Selection state machine (`selectedIds` Set + 3 toggle handlers) — unchanged
- Filter + sort algorithms — unchanged
- Bulk handler logic + partial-success messaging — unchanged
- CSV export logic (`generateCSV` + `downloadCSV`) — unchanged (CSV header still includes `Spent Budget` + `Influencers` columns for back-compat with external workflows; they emit 0 today but pick up real values automatically if a future backend-enrichment contract ships)
- Draft → `/dashboard/campaigns/new?id=${id}` redirect preserved
- Non-draft → `/dashboard/campaigns/${id}` preserved
- All other hrefs preserved

## Honest backend-source audit (every visible element traced)

| Visible element | Source | Status |
|---|---|---|
| Page count meta (total/live/draft) | `campaigns.filter(...).length` | ✓ derived |
| Summary tile · Total | `campaigns.length` | ✓ |
| Summary tile · Draft | `.filter(s='draft')` | ✓ |
| Summary tile · Active | `.filter(s∈['active','live'])` | ✓ |
| Summary tile · Completed | `.filter(s='completed')` | ✓ |
| Summary tile · Total budget | `.reduce(sum total_budget)` | ✓ |
| Status chip count badges | `.filter(s=chip)` | ✓ |
| Card · name | `campaigns.name` col | ✓ |
| Card · dates | `campaigns.{start,end}_date` cols | ✓ |
| Card · status badge | `campaigns.status` col | ✓ |
| Card · budget amount | `campaigns.total_budget` col | ✓ |
| Card · view-CTA label | derived from `c.status === 'draft'` | ✓ |
| ~~Card · spent_budget progress~~ | ~~`c.spent_budget`~~ | **DROPPED** — column doesn't exist, no backend populates |
| ~~Card · influencer_count footer~~ | ~~`c.influencer_count`~~ | **DROPPED** — column doesn't exist, no backend populates |

## QA gate evidence

`pnpm qa` (2026-05-23, post-Flow-3 implementation):

```
67 passed (1.1m)
[qa-report] STATE=GREEN — all reconciliation checks passed
[run-qa] Done. pwExit=0 reportExit=0 → gate 0
```

- All 67 specs GREEN · gate 0 · STATE=GREEN
- C1 verdict machine clean (pwExit=0, reportExit=0)
- No spec asserts on campaigns list copy → zero re-baseline
- Report → `qa/reports/2026-05-23T12-52-46-384Z/QA-REPORT.md`

## Honest limitations

- Cards no longer show "budget used %" — current backend has no spend tracking on campaigns. If you want this back, carve a separate `backend-defect-or-enrichment` contract that adds `SUM(escrow_entries.amount)` subquery to the list endpoint.
- Cards no longer show influencer count — same root cause. Future enrichment contract can add `COUNT(campaign_influencers WHERE campaign_id IN current campaign's sets)`.
- CSV export still emits `Spent Budget` + `Influencers` columns (with value 0) — kept for downstream-compat. They light up automatically if/when backend enrichment ships.
- Status chips can overflow on narrow screens (wraps to second row). Acceptable on mobile/tablet.
- Modal backdrop blur is `backdrop-blur-sm` — minimal effect; acceptable.
- No skeleton loader during initial fetch — keeps the current "Loading campaigns…" text. Future contract can add a skeleton if perceived perf matters.
