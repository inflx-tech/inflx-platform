# Workflow Definition — qa-db-truncate-flake (carved finding)

> Step 2. Carved finding. Verifier for the FUTURE fix:
> ≥3 identical consecutive `pnpm qa:db` runs.

## Actor
The qa:db backend-jest lane under `--runInBand`.

## Observed (defect) behaviour
1. Between test files/tests, `beforeEach → truncateAll()`
   (one `TRUNCATE 28-tables CASCADE`) **intermittently** blocks
   until the 30s hook timeout → that test counts as failed.
2. Which test is hit varies run-to-run (timing-dependent) →
   failed count oscillates ±1 (146/147).

## Correct behaviour (future fix target)
1. Inter-test DB reset completes well under the hook timeout
   **every** run, regardless of lock/connection timing.
2. `pnpm qa:db` failed count is **identical across ≥3
   consecutive runs** (true determinism), with NO masking
   (no timeout inflation / skip / forceExit / retry-to-green).

## This carve's "success"
Finding documented with real evidence; the qa:db lane honestly
reported as ±1 nondeterministic; no test edited, no mask added.
