# 05 — Impact

**Verdict: strictly restorative — three dead endpoints start
returning 200. No behaviour regression is possible.**

## Mechanics

- **Schema:** none. No migration.
- **API contract:** unchanged. `delivery_address` keeps its key,
  type and nullability; it simply no longer references a
  non-existent column.
- **Data:** none written. All three sites are `SELECT`.
- **Frontend:** no change required. `fulfillment/page.js:199`
  renders `delivery_address` as an opaque string.

## Risk

Near-zero. The only observable difference is that a state name
never appeared in the composed address anyway — the query could
never execute to produce one.

## Classification

**Production-impacting** (`backend/src/**`). Requires explicit
founder go before `git push`, per the CLAUDE.md carve-out.

## Deploy surface

Render (backend). No OTA, no Vercel, no migration runner.
