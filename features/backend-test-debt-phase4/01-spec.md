# Feature Spec — backend-test-debt Phase 4

> Step 1. Implementation GATED on `lock.json.approved = true`.
> Ledger: `features/backend-test-debt*`. OS phase **P2**.
> Baseline (post city-fix, verified this session via fresh
> `pnpm qa:db`): **190 passed / 192 failed / 382**, migrations
> 53/53 0-error, DB laneState FAIL by design.

## Problem / goal
P1–P3 paid down the *cheap cascading* test-fixture debt
(281→244→231→194→192) and the "X is required" / stale-create-
payload class is **exhausted**. Phase 4 is the **hard residual**:
per-test business-rule analysis, not a factory one-liner that
clears 37 at once. This is a **business-contract alignment +
defect-discovery** exercise, explicitly NOT force-green cleanup
(standing founder directive).

## Evidence basis
Fresh `qa/artifacts/db-jest.log` from the Step-7 `pnpm qa:db`
run (in progress). The 192 residual is (per P3 hand-off):
- **deeper business-logic / assertion drift** (the bulk) — tests
  asserting outdated shapes, status machines, money/rupee
  values, or business rules that legitimately evolved;
- **~3 uncarved `Received: 500`** — genuine backend defect
  candidates (server throwing on otherwise-valid input).

## Scope (Phase 4 — one measured, evidence-driven batch)
1. From the fresh `db-jest.log`, build a **failure inventory**
   and classify EVERY failure into exactly one of the four
   governance classes (GOVERNANCE.md §6):
   1. stale fixture/setup
   2. business-rule drift
   3. **genuine backend defect**
   4. assertion drift
2. Fix the highest-leverage **(1)+(2)+(4)** subset by aligning
   tests to the *current, verified* controller/route/migration
   contract — **read the actual code; real stack trace beats
   hypothesis** (verify-twice). No guessing.
3. For EVERY class-3 (genuine backend defect, incl. each
   uncarved 500): **carve `features/backend-defect-<slug>/`**,
   leave the catching test **RED**, do NOT patch the backend
   here and do NOT edit the test to pass. Phase 4 = triage +
   align + carve, not backend-fix.
4. Re-measure honestly vs **190/192/382**. Record the delta and
   the full classified inventory. Re-run main `pnpm qa` →
   confirm **66 GREEN / C1 STATE=GREEN / gate 0** unchanged.

## Out of scope
- NOT laneState=PASS (residual + carved defects remain RED by
  design). One measured batch, not "zero failures".
- No `.skip` / deletion / fabricated data / assertion weakening
  / force-pass. No test edited to mask a real backend bug.
- Backend runtime fixes for carved defects — each is its own
  later contract (production-impacting, gated).

## Surfaces touched
- `backend/tests/**` (test-infra) at sites identified at Step 7.
- New `features/backend-defect-*/` finding stubs for class-3.
- **Deploy-inert** (tests/qa not in the server import graph; no
  migration/mobile/OTA/web/runtime change). Carved backend
  defects are tracked, not fixed here.

## Non-functional
- Success = complete 4-class inventory grounded in real
  db-jest.log evidence + honest measured delta + every genuine
  defect carved (RED, not masked) + zero main-lane regression.
  A modest delta with rigorous classification is success; a big
  delta achieved by masking is FAILURE.
