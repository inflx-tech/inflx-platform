# Impact Analysis — qa:db env-resilience hardening

## Deploy posture — DEPLOY-INERT

- Only `qa/scripts/db-up.mjs` + `backend/tests/helpers/db.js` +
  `backend/tests/jest.afterEnv.js` modified. None of these are
  loaded by the running backend server (Render's entrypoint is
  `backend/src/server.js` which does NOT import `backend/tests/`).
- `git push origin main` triggers Render/Vercel rebuilds with
  zero behaviour delta — no source change reaches production
  containers. OTA bundles unaffected (no Mobile touch).
- Forward-only. Rollback = revert the 3-file change.

## Affected

- **qa:db lane only.** The contract raises:
  - The pg server-side connection ceiling (100 → 200), so jest
    workers + helper pool + app pool collectively have more
    headroom before pool exhaustion.
  - The test-helper pool size (5 → 10), so queries to the test
    DB queue less under sustained load.
  - The test-helper pool's `connectionTimeoutMillis` (undefined
    → 10000), so wait-for-connection failures surface loudly
    instead of hanging until the Jest hook timeout.
  - Diagnostic visibility: any `'error'` event on either pool
    now logs `{ totalCount, idleCount, waitingCount }`.
- The application runtime (`backend/src/**`) is unchanged.
  Production behaviour is byte-identical.

## Regression surface

- **Test wall time**: with pool max 10 vs 5, suites that
  previously queued could run slightly faster. Expected impact
  marginal (<10% on the typical 240s baseline).
- **Diagnostic noise**: the new `'error'` listener logs more
  context. Under normal conditions, no `'error'` events fire,
  so log volume is unchanged. Under failure conditions, the
  diagnostic is precisely the help we want.
- **`-c max_connections=200`**: pg server-side adjustment. Cost
  is a slightly higher idle memory footprint in the container
  (~1MB additional per 100 slots, immaterial on a 7.5GB Docker
  RAM limit).

## Risk notes

- **Very low.** Each change is isolated, deploy-inert, and
  reversible by a one-line revert.
- Worst-case failure mode: a flaky diagnostic listener leaks
  memory (cycle-attaching). Guarded by the `_inflxDiagAttached`
  flag idempotency check.
- pg server-side flag risk: `max_connections=200` is a standard
  recommendation; no known compatibility issue with
  postgres:16-alpine or any test-side library.
- The contract does NOT mask the root cause (host saturation
  after 12-hour sessions) — fresh-box discipline still required.
  This raises the saturation THRESHOLD + improves observability,
  it doesn't claim to make the box infinite.
