# Expected Outputs — qa:db env-resilience hardening

| Step | Observable | Verified by |
|---|---|---|
| Fix | `db-up.mjs` includes `-c max_connections=200` | `git diff qa/scripts/db-up.mjs` |
| Fix | `tests/helpers/db.js` Pool config `max:10, connectionTimeoutMillis:10000` + `pool.on('error', …)` with pool-state dump | `git diff backend/tests/helpers/db.js` |
| Fix | `tests/jest.afterEnv.js` `beforeAll` attaches app-pool `'error'` listener (idempotent) | `git diff backend/tests/jest.afterEnv.js` |
| qa:db run #1 | 382/382 passed, 28/28 suites, migrations 54/54, DB-LANE=PASS | `qa/artifacts/_envres_qadb_run1.log` |
| qa:db run #2 | Identical 382/382 (deterministic) | `qa/artifacts/_envres_qadb_run2.log` |
| Main qa | GREEN 66/C1/gate 0 (pwExit=0 reportExit=0) | `qa/artifacts/_envres_qa.log` |
| gov-check | exit 0 (deploy-inert; Rule 1 no governed paths; Rule 2 satisfied via lock.json) | `git push` output |

## Hard expectations

- **No-fake-green**: 2 consecutive GREEN runs measured against
  the SAME instrument. A flake in either = NOT done.
- **Zero touches to `backend/src/**`**: this is the deploy-inert
  contract; `git diff --stat backend/src/` MUST be empty.
- **Listener attach idempotent**: jest.afterEnv.js must guard
  against double-attachment (so re-runs in the same process
  don't accumulate listeners).
- **Diagnostic format**: the new logs MUST include pool state
  `{ totalCount, idleCount, waitingCount }` — not just the error
  message. The point is observability for future env-blocks.
- **Verify-twice on the database-side flag**: pg supports `-c
  KEY=VALUE` as a CLI override that beats `postgresql.conf`. The
  postgres:16-alpine entrypoint passes additional CLI args
  through. Confirm by `docker exec ... psql -c "SHOW
  max_connections"` after db-up — must read `200`, not `100`.
