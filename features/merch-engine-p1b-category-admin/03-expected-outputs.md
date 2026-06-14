# Expected Outputs — Follower Category admin

> Step 3 (cont.). What the QA report asserts against.

## Per-step expected outputs
| Step | Observable output | How QA verifies it |
|---|---|---|
| 1 | `GET /follower/categories` returns the 7 seeded tiles, identical keys/labels/icons/order to the pre-deploy constant | API snapshot vs `SUPER_CATEGORIES`; deal-count shape unchanged |
| 2 | admin list shows 7 rows ordered by sort_order with member lists | API: `GET /admin/follower-categories` → 7 rows |
| 3 | new "Pets" row (active, members pet_shop/pet_grooming) | DB row + appears in `GET /follower/categories` |
| 4 | reordered list reflects new sort_order | API order assertion |
| 5 | hidden "fitness" absent from follower endpoint, present (hidden) in admin | follower list lacks it; admin list includes status=hidden |
| 6 | renamed/re-iconed "eat" reflected in follower endpoint | API field assertion |

## Data assertions (post-workflow)
- `follower_categories`: `key` unique; statuses correct; `member_categories` arrays as set.
- **Seed parity (critical):** before any admin edit, the follower category payload equals the legacy hardcoded payload (keys, labels, icons, sub_categories order).
- Fallback: with table truncated, `getSuperCategories()` returns the constant (covered by a unit/integration assertion).
- No money / attribution fields touched.

## Visual evidence required
- before/after screenshots: admin Follower-Categories screen (7 seeded → after add/hide/reorder).
- network: `GET/POST/PATCH/DELETE /admin/follower-categories` succeed; `GET /follower/categories` parity before edits.
