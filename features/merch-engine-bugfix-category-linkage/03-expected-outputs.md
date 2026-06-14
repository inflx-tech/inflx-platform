# 03-expected-outputs

| Input | Before | After |
|---|---|---|
| Open "Shop" (key `shop`) section screen | all businesses incl. restaurants leak | only `member_categories` of `shop` (fashion/electronics/…); restaurants excluded |
| Open "Eat" (key `eat`) | leaked (key absent from CATEGORY_MAP) | only `eat` members (restaurant/bakery/…) |
| Open "Groom"/"Travel"/"Events" | worked (keys matched old map) | unchanged (now via member_categories) |
| Admin edits "Member businesses" of a tile | no effect on section screen | section screen updates (cache cleared) |
| Global shelf with `category_key='dining'` | CATEGORY_MAP['dining'] | unchanged via fallback |
| follower_categories DB read fails | n/a | graceful fallback to CATEGORY_MAP |

## Proof captured
- `pnpm qa` 79/79 GREEN, gate 0 (zero regression).
- `categoryFilter` inline harness: `{categoryKey:'shop'}`→null (fallback safety);
  `{categoryKey:'shop',categoryCats:[...]}`→[...]; `{categoryKey:'dining'}`→
  `['restaurant','bakery']`; `{categoryKey:'groom'}`→`['salon']`.
