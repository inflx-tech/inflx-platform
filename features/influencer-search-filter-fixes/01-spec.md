# 01 — Spec: influencer-search-filter-fixes

Founder-reported, `/dashboard/influencers` → Discover:

1. "city filter is not working"
2. selecting a tier chip makes the other chips disappear

## What was verified first

**The city filter is not broken.** The whole chain checks out:

- input → `setCity` → debounced effect (`page.js:579-584`, `city` is a
  dep) → `params.city` (`page.js:591`) → `URLSearchParams`
  (`lib/api.js:352`) → `parseList` (which trims,
  `influencer.controller.js:399-405`) → `LOWER(city) = ANY($n::text[])`
  with both sides lowercased (`:444-450`).

Run against the **production** database, that SQL returns
`vijayawada → 6`, `nellore → 16`, `hyderabad → 3`. The filter works.

## D1 — stale responses overwrite filtered results (the real cause)

`doSearch` had **no sequence guard**. Every filter keystroke fires a
400ms-debounced request, and the backend cold-starts (measured 8.2s,
and a 30s timeout, earlier the same day). So typing "Vijayawada" issues
several overlapping requests, and a slow early one ("V…", unfiltered-ish,
many rows) can land **after** the final one and overwrite the correct
6-row result.

Net effect from the user's seat: type a city, results briefly narrow,
then snap back to everything — "the filter does nothing". Same defect
class as the Places autocomplete race fixed in
`features/brand-status-surface-fixes/`.

## D2 — tier chips hidden at zero

`page.js:805` — `if (!count) return null;`

Counts were derived client-side from `results` only. Selecting a tier
means the server returns **only** that tier, so every other tier counts
0 and its chip is removed. The user is left with "All" plus the one
chip and no way to switch tiers — they must go back to the dropdown.

## D3 — the counts were wrong anyway

Counts came from the ~50 loaded rows (`limit: 50`) while the header
reports the true total. In the founder's screenshot the header read
**69 searchable** while the All chip read **50**, and Nano read **10**
when the real Nano count is **13**. The four tier chips summed to 49,
not 50, because two creators have a NULL tier.

## Fix

- **Backend:** move the tier condition to last, snapshot the other
  conditions, and run a `GROUP BY tier` facet query with the tier
  filter **excluded**. Return as `meta.tier_counts`
  (`{ all, nano, micro, mid, macro }`). Counts are whole-result-set,
  not page-scoped.
- **Frontend:** render every tier chip always; a tier with no matches
  under the current filters is **disabled**, not removed. Add a
  monotonic `searchSeqRef` and drop any response that is not from the
  newest search.

## Data reality worth knowing (not a bug)

**37 of 73 creators in `v_searchable_creators` have a NULL or blank
city.** Any city filter therefore excludes roughly half the roster by
construction — not a defect, but it makes city filtering feel far more
aggressive than expected. Also `Hyderabad` and `hyderabad` both exist
as stored values; the `LOWER()` comparison already handles that.

## Out of scope

Backfilling creator cities, and a "no city on record" inclusion toggle.
Both are product decisions, flagged not taken.
