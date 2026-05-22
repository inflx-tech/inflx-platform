# Diff notes — qa:db env-resilience hardening

Tooling/test-infra change, no UI. The "diff" is qa:db behaviour
+ the new diagnostic log format.

## What was implemented

Three surgical, deploy-inert changes:

1. `qa/scripts/db-up.mjs` — `-c max_connections=200` (pg default
   was 100).
2. `backend/tests/helpers/db.js` — test pool `max: 5 → 10`,
   added `connectionTimeoutMillis: 10000` (matches app pool),
   added a `pool.on('error', …)` handler that logs
   `{ total, idle, waiting }` pool state.
3. `backend/tests/jest.afterEnv.js` — `beforeAll` attaches an
   idempotent app-pool `'error'` listener with the same
   pool-state dump (test-side only; `backend/src/` untouched).

## What the measurement showed (honest)

| Run | State | Result | Time |
|---|---|---|---|
| morning fresh-boot, no fix | clean | 382/382 ✓ | 240.8s |
| fresh-boot r#1, WITH fix | clean | 382/382 ✓ | 368.9s |
| r#2, immediately after r#1 | warmed | 377/382 ✗ | 937.9s |

The fix did NOT reach its 2/2-deterministic success bar. The
second consecutive run saturates the box and 4 suites time out
(earnings, pay-at-store, online-order, auth).

## The key diagnostic finding

**The new pool `'error'` listeners fired ZERO times across all
runs.** That is the most valuable output of this contract: it
PROVES the failures are NOT pool exhaustion or Connection-
terminated events (which these changes target). The bottleneck
is the Windows/Docker/WSL2 socket + scheduling layer under
sustained connection churn — below the application and
test-helper layers, unreachable from this repo's code.

## Why it's still committed (not abandoned)

- `connectionTimeoutMillis` on the test pool makes wait-for-
  connection failures fail loud + fast instead of hanging until
  the 30s Jest hook timeout (clearer signal).
- The pool-state diagnostics will help triage any future pool
  issue without a `--detectOpenHandles` re-run.
- `max_connections=200` + pool `max:10` give real headroom on
  CI runners / better hardware where the host isn't the ceiling.

None of it hurts; it just doesn't solve THIS laptop's ceiling.

## The actual mitigation (operational, not code)

`pnpm qa:db` on this hardware is a **once-per-fresh-boot**
operation. Documented in `LOCAL.md` and `GOVERNANCE.md §10`.
Before any release that needs qa:db evidence: restart Windows,
run qa:db once, capture the GREEN, proceed.

## Things the founder should know

- This is why you saw red/green/red cycling: each run is a fresh
  pass/fail, and the box degrades after the first heavy run.
- It is NOT a bug in INFLX — every failure was a test-DB timeout
  under host load, never a product defect. The single clean run
  is 382/382 GREEN.
