# Impact Analysis — Section scheduling + config validation

> Step 6. Generated BEFORE implementation code. One-line verdict:
> **zero behavior change for existing data — additive columns + write-time
> validation; nothing visible until admin sets dates via P2 UI.**

## Affected files (read or change)
- backend/migrations/124_section_scheduling.sql — NEW (additive ALTER TABLE).
- backend/scripts/run-124.js — NEW (prod runner, 122 precedent: idempotent,
  .env.prod-backup, verify-after).
- backend/src/services/sectionEngine.service.js — loadConfig(): schedule
  window predicate on both query legs; buildSections(): expose
  starts_at/ends_at on section payload + honest-timer fill.
- backend/src/controllers/adminSections.controller.js — validateShelf():
  timestamp validation; NEW validateConfigJson(); SELECT/UPDATE/INSERT
  include the two columns.
- web: none. mobile: none. shared: none.

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| GET | /v1/admin/sections/:screen | +starts_at/ends_at in rows | App Builder (ignores unknown fields today) |
| PUT | /v1/admin/sections/:screen | accepts + validates new fields; config_json shape-validated | App Builder |
| GET | /v1/follower/home, /section/*, /business/*/sections, /page/*/sections | scheduled-out sections omitted; +starts_at/ends_at per section; timer fill | Follower app (additive; renderer ignores unknown keys) |

## Risk notes
- Validation tolerance verified against every config shape the live App
  Builder emits (tiles/nodes/banner/hero/kind/timer + raw JSON editor):
  unknown keys pass; only broken enums/dates/dangling destinations reject.
- Legacy rows are never re-validated on read; migration touches no rows.
- Cache: loadConfig() output now time-dependent; existing shelf-level rule
  cache keys unaffected (schedule filters happen before caching, per-request).
  Engine in-process TTL (~60s) bounds the boundary lag.
- Rollback: columns are additive + nullable; reverting code restores exact
  prior behavior without a down-migration.

## Release classification
**production-impacting** (backend/src + migration). Sequence per deploy
cadence: local implement → `pnpm qa` green → founder go → run-124 on prod →
commit → push (Render auto-deploy). NOT silent.
