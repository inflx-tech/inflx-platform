# 03 — Expected outputs

## `GET /influencers/locations` (new)

```json
{
  "success": true,
  "data": {
    "states": [
      { "state": "Andhra Pradesh", "creators": 28,
        "cities": [
          { "city": "Nellore", "creators": 16 },
          { "city": "Vijayawada", "creators": 10 },
          { "city": "Guntur", "creators": 1 },
          { "city": "Visakhapatnam", "creators": 1 }
        ] },
      { "state": "Telangana", "creators": 7,
        "cities": [
          { "city": "Hyderabad", "creators": 6 },
          { "city": "Godavarikhani", "creators": 1 }
        ] }
    ]
  }
}
```

- Ordered by creator count descending, so the states actually being
  tagged surface first without hard-coding a Telugu-states whitelist.
- Grouped on `LOWER(btrim(...))`; the label is the most common spelling
  (`MODE() WITHIN GROUP`), so `hyderabad` and `Hyderabad` collapse to
  one entry.
- States with creators but no city contribute to `creators` and add no
  city row.
- Rows with no state are excluded entirely.

## `GET /influencers/search?state=Telangana`

Adds a `state` predicate alongside the existing `city` one, both
`LOWER(btrim(...)) = ANY(...)`. `state` is now also returned on each
creator row.

`meta.tier_counts` (from the sibling contract
`influencer-search-filter-fixes`) reflects the state/city selection,
since facets reuse every condition except tier.

## `POST /admin/marketing/leads/intake/bulk`

Request rows accept `state`. Response gains an `updated` count:

```json
{ "total": 120, "created": 74, "updated": 41,
  "duplicates_skipped": 3, "revived": 0, "invalid": 2, ... }
```

Per-item: `{ row, handle, action: "updated", existing_id, fields: ["city","state"] }`.

`action: "updated"` is new. It fires only when the handle exists **and**
the row supplied a city or state; the row's other columns and every
scraped metric are left alone.

## Database (migration 146)

- `creator_profiles.state text`, `idx_creator_profiles_state_lower`.
- `v_searchable_creators` gains `state` as the **last** column on both
  branches (`CREATE OR REPLACE VIEW` forbids reordering existing ones).
- Onboarded branch: `city` → `COALESCE(u.city, i.city)`,
  `state` → `COALESCE(u.state, i.state)`.

Measured on production in a rolled-back transaction: onboarded rows
carrying a city **8 → 28**.

## Write normalisation

`normaliseGeo()` trims, collapses inner whitespace and Title-Cases, so
`"  telangana "` stores as `Telangana`. Blank stays `NULL`, never `''`.

## Regression bar

`pnpm qa` green. Migration is additive and idempotent
(`ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE VIEW`).
