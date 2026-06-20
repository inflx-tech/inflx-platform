# Impact Analysis — Returns Visibility (G-4)

> Terse verdict: additive read-only visibility + an admin UI over EXISTING returns data.
> No schema change, no money-movement change.

## Affected files
- backend: returns.controller.js (new listBrandReturns), returns.routes.js (new brandRouter),
  routes/index.js (mount /brands/me brandRouter).
- web: lib/api.js (brandApi.getReturns + adminApi returns methods); app/dashboard/returns/page.js
  (NEW brand view); app/admin/returns/page.js (NEW admin page); dashboard/layout.js + admin/layout.js
  (nav entries).
- mobile: none. migration: none.

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| GET | /brands/me/returns | NEW (brand read-only) | brand returns page |
| GET | /admin/returns | reuse (existing) | admin returns page |
| POST | /admin/returns/:id/approve|reject|mark-refunded | reuse (existing) | admin returns page |

## Affected workflows (regression surface)
- Existing follower + admin returns flows (returns.controller follower/admin routers) — untouched,
  still mounted. New code is purely additive.

## Migration / deploy / OTA impact
- No migration. Backend + web only → push (Render + Vercel). No OTA.

## Risk notes
- No money movement, no claw-back (explicitly excluded — G-3). Read-only for brands.
- Brand isolation enforced by ft.brand_id filter + requireRole('brand'). PII masked in SQL.
