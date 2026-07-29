# 03 — Expected outputs

## `GET /influencers/search`

New `meta.tier_counts`. Counts apply every active filter **except**
tier, so the chip row stays a usable switcher.

```json
{
  "success": true,
  "data": { "creators": [ … ] },
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 69,
    "tier_counts": { "all": 69, "nano": 13, "micro": 30, "mid": 13, "macro": 11 }
  }
}
```

With `?city=vijayawada` (verified against production):

```json
"meta": { "total": 6, "tier_counts": { "all": 6, "micro": 2, "mid": 3, "macro": 1 } }
```

`nano` is absent — the frontend renders it as `0`, disabled.

With `?city=vijayawada&tier=mid`: `total` becomes 3 while
`tier_counts` stays identical to the line above. That invariance is
the whole point — it is what keeps the other chips alive.

`tier_counts.all` counts creators with a NULL tier too, so it always
equals `total` when no tier filter is applied. The individual tier
keys will not necessarily sum to `all` (2 creators have no tier).

## UI

| State | Chip row |
|---|---|
| No tier filter | All (active) · Nano · Micro · Mid · Macro, all with counts |
| Micro selected | same five chips, Micro active, **others still visible and clickable** |
| Tier with 0 matches | rendered, dimmed, `disabled`, tooltip explains why |
| Search failed | row hidden (`tierCounts` null) |

All chip count === header "N searchable".

## Race behaviour

Responses whose sequence id is not the newest are discarded before any
`setState`. Rapid typing converges on the last query's results.

## Regression bar

`pnpm qa` green. No migration.
