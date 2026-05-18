# Workflow Definition — DB substrate (B2b)

> Step 3. The DB lane is SEPARATE from `pnpm qa`. Its outcome is
> reported explicitly and never merged into the main GREEN.

## Actor
The QA operator running `pnpm qa:db` on a host with Docker running.

## Precondition
Docker daemon reachable (`docker ps` succeeds). If not → the lane
**FAILS LOUD** with "Docker daemon not running" (NOT skip, NOT
green) — DB coverage absence must be visible.

## Workflow
1. **db-up:** `qa/scripts/db-up.mjs` starts an ephemeral Postgres
   container on a non-default host port; waits until it accepts
   connections; exports `TEST_DATABASE_URL`.
2. **migrate-all:** the fixed `backend/tests/setup.js` (invoked by
   backend jest globalSetup) DROP/CREATEs schema then applies
   `001…054` in sorted order. Any SQL error in any migration →
   the lane FAILS, naming the offending file.
3. **backend jest:** `cd backend && npm test` runs against the
   fully-migrated DB.
4. **db-down:** container stopped/removed regardless of outcome
   (always cleaned up).
5. **report:** `qa:db` emits a DB-lane result; `qa-report.mjs`
   renders a distinct "DB lane" section (status + counts +
   migration-applied count). Main `pnpm qa` verdict is unchanged
   and unaffected.

## Success definition (B2b substrate)
SUCCESSFUL iff: Docker up → container ready → **all 53 migrations
apply with zero SQL error** (the first-ever end-to-end migration
coherence proof) → backend jest **executes to completion** → its
real pass/fail is reported on the DB lane → container cleaned up.
The substrate is "green" when the harness works and reports truth;
legacy jest failures are surfaced as tracked findings, not hidden
and not a substrate failure.

## Explicit non-green states (no false green)
- Docker down → DB-lane FAIL ("daemon not running").
- A migration errors → DB-lane FAIL (names the file) — a real,
  valuable finding (migration incoherence).
- jest cannot start (DB unreachable / setup throws) → DB-lane FAIL.
- Lane not run at all → report shows "DB lane: NOT EXERCISED"
  (explicit), never implied-green.

## Failure / edge
- Port clash → db-up picks/pins a fixed non-default port; clash =
  loud fail with guidance, not a silent reuse of an unknown DB.
- Partial migration → schema is per-run disposable (DROP/CREATE);
  no persistence between runs.
