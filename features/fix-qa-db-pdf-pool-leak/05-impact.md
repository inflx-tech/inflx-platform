# Impact Analysis — fix qa:db PDF pool leak

## Deploy posture — PRODUCTION-IMPACTING (path), ZERO (runtime)

- Changes `backend/src/controllers/contract.controller.js`
  (GOVERNED path under `backend/src/**`). `git push origin main`
  → Render auto-deploys the backend.
- **Runtime effect in production: ZERO**. The fix is gated by
  `env.NODE_ENV === 'test'`. Production (`NODE_ENV === 'production'`
  on Render) continues to fire-and-forget exactly as today.
  Render deployment will rebuild + restart the backend but
  brand-approve responses behave byte-identically.
- Surfaced explicitly to the founder 2026-05-20; GO given.
- Forward-only. Rollback = revert the 3-line change (no schema /
  data / migration involved).

## Affected

- `contract.controller.js` brand-approve handler — the final
  `_generateAndStorePdf(...)` invocation (line 1153).
- Under tests (`NODE_ENV === 'test'`), the approve handler now
  waits for PDF generation to complete before returning. This
  serialises pool usage per test request and stops the app-pool
  exhaustion that 14 instances of "timeout exceeded when trying
  to connect" were originating from.
- 5 qa:db suites previously failing under the pool-leak
  cascade are expected to flip GREEN by this serialisation:
  - `tests/pay-at-store.test.js`
  - `tests/earnings.test.js`
  - `tests/follower-feed.test.js`
  - `tests/commissions.test.js` (TypeError cascade from upstream
    timeout — should also resolve)
  - `tests/prebook-daterange.test.js`

## Regression surface

- **Main pnpm qa**: web/L1-L2 + C1 — backend brand-approve path
  is NOT exercised by the 66 web specs; re-run to confirm zero
  regression.
- **Other backend test suites**: serialised PDF gen means
  brand-approve tests now wait ~100ms-1s longer per assertion.
  Suite wall-time may go up marginally; jest hook timeout
  (30000ms) and test timeout (30000ms) are well-clear.
- **Production behaviour**: zero delta. Brand-approve response
  time in prod unchanged; PDF generation continues to happen in
  background as today.
- **Render deploy**: standard backend restart; no DB migration
  attached; no rollback prerequisites.

## Risk notes

- **Very low risk.** Three-line change, NODE_ENV-gated, prod
  byte-identical.
- The only failure mode for the test path is if PDF gen itself
  errors — but the existing `.catch(err => console.error(...))`
  handler preserves error visibility AND the `await pdfRegen`
  resolves to the same fulfilled chain (catch swallows so await
  always succeeds). Tests cannot fail from PDF gen errors.
- If the diagnosis is wrong (the 14/14 stack-trace pinning is
  incorrect) the qa:db runs will still show timeout failures —
  the runs serve as honest verification, not assumption.
