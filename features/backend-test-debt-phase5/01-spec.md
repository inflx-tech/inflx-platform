# Feature Spec — backend-test-debt Phase 5

> Step 1. Implementation GATED on `lock.json.approved = true`.
> Ledger: `features/backend-test-debt*`. Continuation of the
> Phase-4 ladder (founder directive 2026-05-18: continue debt
> paydown, not P3, until the mechanical cascade is exhausted and
> only genuine defects remain).
> Baseline (post-P4, fresh qa:db): **236 passed / 146 failed /
> 382**, migrations 53/53 0-error, DB laneState FAIL by design.

## Problem / goal
P4 cleared the campaign+set creation layers (−46). The 146
residual is dominated by the **same class-2 fixture-drift
cascade one step deeper**: the invite / offer / accept step
(`reading 'campaign_influencer'` / `'id'` ≈200 occ), plus a
`WALLET_INSUFFICIENT ×7` cluster (setups don't fund the brand
wallet before publish) and assorted authz/assertion drift.
Phase 5 = the next measured rung: align the invite/offer/wallet
setup recipes to the **current verified controller contracts**,
carve every genuine backend defect RED, measure the honest
delta. Explicitly NOT force-green; NOT expected to reach zero.

## Scope (Phase 5 — one measured, evidence-driven batch)
1. Fresh `pnpm qa:db`; build the complete 146 failure inventory
   with signatures.
2. Classify EVERY failure into the 4 governance classes
   (GOVERNANCE.md §6), each justified by the **actual
   controller/route/migration** (verify-twice; real stack >
   hypothesis).
3. Fix the highest-leverage **(1)+(2)+(4)** subset — primarily
   the invite/offer payload + wallet-funding setup drift —
   aligned to the current contract. Each fix traceable to a
   controller `file:line`. No assertion weakened to pass.
4. **Carve every class-3 genuine defect** as its own
   `features/backend-defect-<slug>/`; leave the catching test
   **RED**; do NOT patch backend or edit the test here.
5. Re-measure honestly vs 236/146. Re-run main `pnpm qa` →
   confirm 66 GREEN / C1 STATE=GREEN / gate 0 unchanged.

## Out of scope
- NOT laneState=PASS / NOT zero failures (residual + carved RED
  by design). One measured batch.
- No `.skip`/deletion/fabricated-data/assertion-weakening/
  force-pass. No test edited to mask a real backend bug.
- Backend runtime fixes for carved defects (each its own
  future production-impacting gated contract).
- P3 (QA reporting usability) — deferred until the mechanical
  cascade is exhausted (founder directive).

## Surfaces touched
- `backend/tests/**` at sites identified at Step 7. New
  `features/backend-defect-*/` carves for class-3.
- **Deploy-inert** (tests/qa not in the server import graph; no
  migration/mobile/OTA/web/runtime change).

## Non-functional
- Success = complete 4-class inventory grounded in real
  db-jest.log evidence + honest measured delta + every genuine
  defect carved RED + zero main-lane regression. Modest delta
  with rigor = success; a large delta via masking = FAILURE.
- Expected honest end-state of the ladder: the cascade shrinks
  toward a small irreducible count of genuine carved defects —
  surfacing that true "real bugs vs test drift" split is the
  primary deliverable, not a green number.
