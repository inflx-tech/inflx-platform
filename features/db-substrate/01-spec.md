# Feature Spec — DB substrate + all-migrations applier (B2b)

> Contract B2b of Area B. Step 2. Implementation GATED on
> `lock.json.approved = true` AND a verified-running Docker daemon
> (hard precondition — see 05-impact). Reports on a SEPARATE
> gate/report lane (founder decision 2026-05-18) so DB coverage is
> always explicit and never folded into the main `pnpm qa` GREEN.

## Problem / goal
Deep status-transition / full-transaction-flow logic is DB-coupled
and currently has **zero runnable coverage** because
`backend/tests/setup.js` (jest globalSetup) applies **only
`migrations/001_initial_schema.sql`** — not 002→054 (verified). So
the ~existing backend jest suite (`backend/tests/**/*.test.js`,
~311 tests, the 53-migration schema) cannot run truthfully. B2b
stands up the substrate and fixes the applier.

## Verified facts (drive scope)
- `backend/jest.config.js`: globalSetup `./tests/setup.js`,
  globalTeardown `./tests/teardown.js`, testMatch
  `**/tests/**/*.test.js`, needs `TEST_DATABASE_URL`.
- `setup.js`: DROP/CREATE schema public, then applies ONLY 001.
- `backend/migrations/`: 53 files `001_…`→`054_…`.
- Docker CLI v29.3.0 present; **daemon currently down** — must be
  running for B2b Step 7+.

## Scope (B2b — substrate + applier + separate lane + proof)
1. **Docker Postgres** via `qa/scripts/db-up.mjs` / `db-down.mjs`
   (non-default host port to avoid local clashes; ephemeral
   container; `TEST_DATABASE_URL` pointed at it).
2. **Fix the applier:** `backend/tests/setup.js` applies **all**
   migrations in sorted `001→054` order (read dir, sort, run each
   in a transaction-safe sequence), not just 001.
3. **Separate lane:** `pnpm qa:db` orchestrator (db-up → migrate →
   `cd backend && npm test` → db-down) with its OWN result + exit;
   `qa-report.mjs` shows a distinct **DB-lane** section. NEVER
   merged into the main `pnpm qa` GREEN (C1 verdict unchanged).
4. **Proof:** all 53 migrations apply with **no SQL error**
   (first-ever end-to-end migration coherence check) AND backend
   jest executes to completion with its real result reported on
   the DB lane.

## Out of scope
- Making all ~311 legacy tests green. The suite is stale; genuine
  failures against the now-correct full schema are **tracked
  findings** (A5b-style), not a B2b substrate blocker. B2b's bar is
  in 02/03 (migrations apply clean + jest runs + DB-lane reports
  truthfully).
- Specific status-machine deep contracts (B2c+).

## Surfaces touched
- `backend/tests/setup.js` (test-infra only — NOT imported by the
  server `node src/index.js`; deploy-inert), new `qa/scripts/*`,
  `qa-report.mjs` DB-lane section, root `qa:db` script. No app
  code, no migration content change, no mobile, no OTA.
