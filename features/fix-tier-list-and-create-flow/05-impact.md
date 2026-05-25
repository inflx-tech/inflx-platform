# Impact — A10.5

## Changes
- 1 page rewrite (`/admin/pricing/tiers`).
- 1 controller function added (`adminCreateTier`).
- 5 route mounts added in `admin.routes.js`.
- 1 api client method added (`adminApi.createSubscriptionTier`).
- 1 contract folder.

## Blast radius
- The 5 admin endpoints are NEW from the router's POV (the controller handlers existed since A7-admin but were unreachable). No existing path changes behaviour.
- Page rewrite: same path, same component name. Surface-compat — anyone bookmarking `/admin/pricing/tiers` continues to load it; the new error surfacing improves diagnostics; create modal is additive.
- Backend tx for create: transactionally inserts into 3 tables. ROLLBACK on any failure.
- No migration.

## Risks
- **Page error banner now visible** for any non-success response. If admins were previously seeing "No tiers yet" silently for other reasons, they may now see error codes. Acceptable — error visibility is the point.
- **Race condition on `sort_order = max + 1`** — if 2 admins create tiers simultaneously they could end up with duplicate sort_order. Acceptable (sort_order is for display only; nothing depends on it being unique).

## Rollback
Revert the commit. Tier list goes back to silent-empty; "+ New tier" disappears. Backend re-deploys without the new route + controller function. No data damage.

## Pre-push checklist
1. pnpm qa GREEN (no spec touches the new endpoint behaviour directly; nav-sweep covers route reachability).
2. Backend boot test (`node -e require('./src/app')`) clean.
3. gov-check exit 0 with Rule 1 + Rule 3 + Rule 4 satisfied.
