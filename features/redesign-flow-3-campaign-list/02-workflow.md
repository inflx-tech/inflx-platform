# Workflow — Redesign Flow 3 · Campaign list

> No new workflows. Visual + UX restyle + honest drop of 2 phantom
> fields. All assertions below describe behaviour that must remain
> unchanged post-restyle.

## Actor
Authenticated brand on `/dashboard/campaigns`.

## Preconditions
- Brand JWT in localStorage
- Dashboard layout chrome rendered (Flow 2)

## Workflow steps (user-observable, unchanged)

1. Page loads → "Loading campaigns…" briefly → grid populated
2. `campaignApi.list()` = `GET /campaigns` fetches all campaigns for the brand
3. If 0 campaigns → empty state with "Create your first campaign" CTA
4. If ≥1 campaign → summary tiles + filter bar + grid render
5. Search input filters by `c.name` (case-insensitive substring)
6. Status chip click sets `statusFilter` state; clicking chip again selects "all"
7. Sort dropdown changes ordering (newest / oldest / budget-desc / name-asc)
8. Click a card → if `status === 'draft'` route to `/dashboard/campaigns/new?id=${id}` (continue editing); else route to `/dashboard/campaigns/${id}` (view detail)
9. Card checkbox → adds id to `selectedIds`; bulk action bar appears
10. "Select all" → all currently-filtered cards selected
11. "Clear" → empties selection
12. "Export CSV" → client-side CSV of selected campaigns downloads
13. "Cancel" → confirm modal → bulk `campaignApi.cancel(id)` for each selected draft/published
14. "Delete" → confirm modal → bulk `campaignApi.delete(id)` for each selected draft (drafts only)
15. After bulk action → refetch, clear selection, show success/partial message

## Success definition

Every step above produces the same end state as today. `pnpm qa` 67/67 green. No phantom 0-data displayed.

## Failure / edge workflows (unchanged from current)

- `campaignApi.list()` fails → empty grid, no crash (current behaviour)
- Some bulk targets fail mid-batch → "N of M succeeded" alert (current behaviour)
- Filter + sort produce 0 matches → "No campaigns match your filters" message
- Modal cancel → no-op
- Search empty → returns all
