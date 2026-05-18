# Impact Analysis — DB substrate (B2b)

> Step 6. Generated BEFORE implementation. Reviewed at the lock.

## HARD PRECONDITION
Docker daemon must be running for Step 7+ (`docker ps` succeeds).
Verified currently DOWN. No B2b implementation/verification can be
truthfully completed until the operator starts Docker Desktop.
The Step-5 lock acknowledges this; Step 7 re-verifies Docker before
proceeding (no implementation against an unverifiable substrate).

## Affected files
- **New:** `qa/scripts/db-up.mjs`, `qa/scripts/db-down.mjs`,
  `qa/scripts/qa-db.mjs` (DB-lane orchestrator).
- **Changed (test-infra):** `backend/tests/setup.js` — apply ALL
  sorted migrations (currently only `001`). This file is jest
  globalSetup; it is NOT required by the server entrypoint
  (`node src/index.js`) → **deploy-inert** (Render runs the server,
  not the tests).
- **Changed (additive):** `qa/scripts/qa-report.mjs` — add a
  separate "DB lane" section. The C1 main-verdict state machine is
  UNTOUCHED (DB status must not influence it).
- **New:** root `qa:db` script.
- No app/runtime code. No migration *content* change (only the
  applier). No mobile, no OTA.

## Affected workflows (regression surface)
- C1 governance: the DB lane must extend, not weaken, C1 — a
  down/unrun lane reports FAIL/NOT-EXERCISED, never implied green;
  main GREEN stays computed from the no-DB suite only. The C1
  meta-tests must still pass unchanged after the qa-report DB-lane
  addition (re-run them).
- `pnpm qa` (66-suite) must remain green & unchanged — the DB-lane
  code path is only reached via `pnpm qa:db`.

## Migration/deploy/OTA
- None. `backend/tests/setup.js` is test-only; `qa/*` is harness.
  `chore(qa)`/`test`-class, deploy-inert. Confirmed: server import
  graph does not touch `tests/`.

## Risk notes
- **Migration coherence unknown:** 002→054 have NEVER been applied
  in sequence from a clean schema in this harness. They may error
  (ordering, IF-NOT-EXISTS gaps, data-seed assumptions). That is a
  REAL, valuable finding — the lane FAILS loudly naming the file;
  a B2b-fix follow-up contract is opened. Not suppressed.
- **Legacy jest debt:** the ~311 tests have run only against the
  001 schema for a long time; some may fail against the correct
  full schema. Reported with counts as tracked findings; NOT a
  substrate failure and NOT force-greened.
- **Container hygiene:** db-down always runs (even on failure) so
  no orphan containers; fixed container name + non-default port,
  loud fail on clash (never silently reuse an unknown DB).
- **Determinism:** schema is DROP/CREATE per run → no cross-run
  state; postgres image tag pinned for reproducibility.
- Exact docker run flags / port / migration-apply transaction
  strategy pinned at Step 7 against the live daemon (accepted
  pin-at-Step-7 policy), once Docker is verified up.
