# 01 — Spec: backend-orders-state-column-fix

## Problem

Three SQL queries select `a.state` from `follower_addresses`. That
column **does not exist** — not in `001_initial_schema.sql:376-385`,
and not added by any later migration (verified by grep over
`backend/migrations/*.sql`).

Verified against the **production** database on 2026-07-29 (read-only
`information_schema` query via `.env.prod-backup`). Actual columns:

```
id, follower_id, label, line1, line2, city, pincode,
is_default, lat, lng, receiver_name, receiver_phone, landmark
```

Postgres rejects the statement at parse time, so the failure is
unconditional — it does not depend on row data. `follower_orders`
currently holds 5 rows in production.

## Blast radius (all currently 500)

| Endpoint | Site | Surface |
|---|---|---|
| `GET /brands/me/orders` | `backend/src/controllers/brand.controller.js:786` | Brand **Fulfillment** page — completely dead |
| `GET /admin/orders` | `backend/src/controllers/adminOrders.controller.js:61` | Admin orders desk |
| `GET /follower/activity` | `backend/src/controllers/transaction.controller.js:2009` | Follower order-activity feed |

This was found during triage of an unrelated brand-flow bug list; it
was not reported by the founder, which is consistent with the brand
Fulfillment page never having been exercised end-to-end since the
`delivery_address` composition was introduced.

## Fix

Drop `a.state` from the `CONCAT_WS` in all three queries. `CONCAT_WS`
already skips NULLs, so the composed address degrades gracefully to
`line1, line2, city, pincode`.

Deliberately **not** in scope for this contract:
- adding a `state` column to `follower_addresses` (no capture path
  exists in the follower address form — it would be a dead column)
- adding `a.landmark` to the composed address (real improvement, but
  a behaviour change; belongs with the Fulfillment redesign)

## Non-goals

No schema migration. No API contract change — the response key
`delivery_address` and its type are unchanged.

## Expected outcome

All three endpoints return 200. Brand Fulfillment renders its order
list for the first time.
