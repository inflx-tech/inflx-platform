# 02 — Workflow

## Actors
Brand owner (Fulfillment page), Admin (orders desk), Follower
(activity feed).

## Steps

1. Brand opens `/dashboard/fulfillment`.
2. Page calls `GET /brands/me/orders?status=`.
3. Backend composes `delivery_address` from the joined
   `follower_addresses` row.
4. **Today:** Postgres raises `column a.state does not exist`;
   `asyncHandler` converts it to a 500; the page renders its error /
   empty state.
5. **After the fix:** the query parses, rows return, the order list
   renders with a `line1, line2, city, pincode` delivery address.

Identical shape for `GET /admin/orders` and `GET /follower/activity`.

## Verification

- Read-only `information_schema` probe against prod confirms the
  column set (already run — see `01-spec.md`).
- `pnpm qa` full suite must stay green.
- Post-deploy: authenticated `GET /brands/me/orders` returns 200.
