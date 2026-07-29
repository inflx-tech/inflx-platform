# 06 — Before / after notes

## D1 — stale-response race

`Packages/brand-web/app/dashboard/influencers/page.js`

- Added `searchSeqRef`; `doSearch` increments it before awaiting and
  returns early if a newer search has started.
- No visual change. The observable is that a slow earlier request can
  no longer repaint the list over a newer filtered result.

This is the actual cause of the reported "city filter is not working".
The city SQL was verified correct against production first
(`vijayawada → 6`, `nellore → 16`, `hyderabad → 3`).

## D2/D3 — tier chips

`backend/src/controllers/influencer.controller.js`

- The tier condition moved to **last**, after every other filter, so a
  facet snapshot of the other conditions can reuse the params
  positionally. Comment added at the old site warning against moving
  it back.
- New `GROUP BY tier` facet query over `v_searchable_creators` using
  the tier-free conditions; returned as `meta.tier_counts`.

`Packages/brand-web/app/dashboard/influencers/page.js`

- Removed the client-side `tierCounts` `useMemo` derived from the ~50
  loaded rows; now reads `meta.tier_counts` into state.
- Removed `if (!count) return null;` — every tier renders. Zero-match
  tiers are `disabled` with a tooltip instead of being removed.
- Row gate changed from `results.length > 0` to
  `searched && tierCounts`.
- Added `.tier-chip:disabled` styling.

Before: header 69 / All 50 / Nano 10, and three chips vanished on
selection. After: header 69 / All 69 / Nano 13, all chips persist.

## Verified against production data

Facet SQL run directly against the prod database:

- no filters → `{all:69, micro:30, nano:13, mid:13, macro:11}`
  (All matches the header's 69)
- `city=vijayawada` → `{all:6, micro:2, mid:3, macro:1}` — no nano,
  which is the disabled-chip case
- `city=nellore` → `{all:16, micro:5, mid:5, nano:5, macro:1}`

## Not captured as screenshots

The interesting states are a filtered chip row and a lost race, neither
of which a Playwright shot of the live URL reaches without staging the
data and the latency. The mockup at
`04-preview/mockups/tier-chip-row.html` renders all five states
before/after with the real production counts. Recorded deliberately.

## QA

`pnpm qa` GREEN — 79 passed, gate 0.
