# Feature Spec — backend-test-debt Phase 3

> Step 2. Implementation GATED on `lock.json.approved = true`.
> Ledger: `features/backend-test-debt*`. Baseline: **151/231/382**.

## Problem / goal
Phases 1–2 paid down fixture/setup debt (281→244→231). Phase 3
targets the **business-rule / status-drift cluster** the secondary
failures exposed — as a *business-contract alignment* exercise,
NOT force-green cleanup (founder directive 2026-05-18).

## Evidence (from `qa/artifacts/db-jest.log`, post-P2)
Status-pair signatures:
- **`Expected 201 → Received 422` (dominant):** create endpoints
  returning VALIDATION_ERROR — stale create-payloads in the next
  set of factories/inline-creates (offers, contracts, deliverables,
  negotiations, prebook, …). Same class as P1/P2, next surface.
- **`Expected 200 → Received 500` (distinct):** server throwing on
  an otherwise-valid request — **potential GENUINE backend/state
  defects**. These must be ISOLATED, not test-edited away.
- minor: `404→403`, `401→500` (authz/contract drift) — secondary.

## Scope (Phase 3)
1. From `db-jest.log`, sub-classify the status-drift cluster into:
   (i) stale-create-payload (test fixture drift),
   (ii) genuine backend defect (200→500 / wrong-status from
        correct input),
   (iii) authz/contract drift.
2. Fix the **highest-leverage (i) batch** by aligning the stale
   create-payloads to the *current* controller contracts (read the
   controllers — no guessing).
3. For every (ii) candidate: do NOT touch the test to make it pass
   — record it as its own backend-defect finding/contract.
4. Re-measure vs 151/231/382.

## Out of scope
- Not laneState=PASS. One more measured, evidence-driven batch.
- No `.skip`/deletion/fabricated data/assertion weakening. No
  test edited to mask a real backend bug.

## Surfaces touched
- `backend/tests/**` create-payload sites identified at Step 7
  (test-infra). Possibly new backend-defect finding stubs under
  `features/`. **Deploy-inert** (tests/qa not in server import
  graph). No migration/mobile/OTA/web/runtime code.
