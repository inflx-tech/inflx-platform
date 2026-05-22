# Preview (Step 4) — qa:db env-resilience hardening

Tooling/test-infra contract; **no UI**. The "preview" is the
behaviour change of the qa:db lane under load + the new
diagnostic log format on `'error'` events.

## Reviewer note (Step-5 lock)

- **DEPLOY-INERT**: only `qa/scripts/db-up.mjs` (qa orchestrator)
  + `backend/tests/helpers/db.js` (test pool — under
  `backend/tests/`, not in the server import graph) +
  `backend/tests/jest.afterEnv.js` (test setup). NO governed
  source touched.
- Approved under standing autonomy + founder explicit GO
  "go with your recommendation" 2026-05-20 (Option 1 of the 2
  surfaced after Phase 2 closeout).
- The diagnostic listener is INFORMATIONAL — it does NOT swallow
  errors or change control flow. Existing app-pool listener in
  `backend/src/config/db.js` continues to log alongside; this
  contract's listener layers on additional pool-state context
  for tests only.

## Approval (Step-5)

Self-locked: deploy-inert, founder go on Option 1 explicit. Same
posture as `qa-db-truncate-flake` (d93eb7d) — substrate
improvement to make the qa:db lane more deterministic + better
diagnosable.

## Step 7 — RESULT — SHIPPED-PARTIAL 2026-05-22 (committed, NOT released)

```
fix       : db-up.mjs +max_connections=200; tests/helpers/db.js
            pool max 5→10 + connectionTimeoutMillis:10000 +
            'error' diagnostic; jest.afterEnv.js attaches
            app-pool 'error' diagnostic
qa:db r#1 : 382/382 GREEN 368.9s (fresh boot, WITH fix) ✓
qa:db r#2 : 377/382 RED 937.9s (immediately after r#1) ✗
            — 4 suites timed out (earnings/pay-at-store/
            online-order/auth); host saturation, 0 diagnostic
            events (NOT pool exhaustion)
verdict   : 1/2 deterministic — did NOT meet the 2/2 bar.
            Bottleneck is Windows/Docker/WSL2 socket layer,
            unreachable from app/test code. Fix retains value
            (loud failures, diagnostics, CI headroom) but does
            NOT make a saturated box pass.
released  : FALSE (no-fake-green: can't claim determinism not
            achieved). Committed for diagnostic value only.
deploy    : DEPLOY-INERT (no governed paths). Real mitigation =
            operational discipline: run qa:db once per fresh
            boot (documented in LOCAL.md + GOVERNANCE.md §10).
```
