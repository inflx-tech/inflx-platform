# Feature Spec — backend-test-debt Phase 6

> Step 1. Implementation GATED on `lock.json.approved = true`.
> Ledger: `features/backend-test-debt*`. Continuation of the
> Phase-5 ladder on the now-DETERMINISTIC qa:db instrument
> (qa-db-determinism + qa-db-truncate-flake) — deltas are
> noise-free. Baseline (post-P5, f5416b8): **259 passed / 123
> failed / 382**.

## Problem / goal
P5 cleared the conversion-invite layer (−23, 146→123). The 123
residual is dominated by the SAME class-2 fixture/contract drift
one step deeper:
- **`reading 'razorpay_order_id'` ×50** — the follower-payment
  create-order step (pay-at-store / prebook / prebook-daterange
  / online-order verify flows): `orderRes.body.data
  .razorpay_order_id` is undefined ⇒ the create-order endpoint
  returns an error body.
- **`reading 'id'` ×80** — the accept / contract / offer step
  after invite (engagement-set flows): a `.id` read on an
  undefined `.data`.
- **`WALLET_INSUFFICIENT` ×7** — setups don't fund the brand
  wallet before publish/escrow.
Phase 6 = the next measured rung: align these to the verified
controller contracts, carve genuine defects RED, honest delta.
NOT force-green; NOT expected to reach zero.

## Scope (Phase 6 — one measured, evidence-driven batch)
1. Inventory the 123 from the authoritative post-P5 evidence
   (`qa/artifacts/_p5_remeasure_qadb.log`) + a fresh
   deterministic `pnpm qa:db` for the re-measure.
2. 4-class classify each failure (GOVERNANCE.md §6), each
   justified by the ACTUAL controller/route/migration
   (verify-twice; real stack > hypothesis).
3. Fix the highest-leverage (1)+(2)+(4) subset — the
   create-order payload drift, the accept/contract step, and
   the wallet-funding setup gap — aligned to the verified
   contract. Each fix cites a controller `file:line`.
4. CARVE every class-3 genuine defect as its own
   `features/backend-defect-<slug>/`; test LEFT RED; backend
   NOT patched, test NOT edited.
5. Re-measure honestly vs 259/123 (deterministic instrument →
   noise-free). Re-run main `pnpm qa` → 66 GREEN / C1
   STATE=GREEN / gate 0 unchanged.

## Out of scope / forbidden
- NOT laneState=PASS / NOT zero. One measured batch; next layer
  re-baselines for Phase 7 (one batch/phase ledger discipline).
- No `.skip`/delete/fabricated-data/assertion-weakening/
  force-pass. No test edited to mask a real backend bug.
- Backend runtime fixes for carved defects (own future
  production-impacting gated contracts).

## Surfaces touched
- `backend/tests/**` at Step-7-identified sites; new
  `features/backend-defect-*/` carves for class-3.
- **Deploy-inert** (tests/qa not in the server import graph; no
  migration/web/mobile/OTA/runtime change).

## Non-functional
- Success = complete 4-class inventory grounded in real
  evidence + honest measured delta on the deterministic
  instrument + every genuine defect carved RED + zero main-lane
  regression. Modest delta with rigor = success; big delta via
  masking = FAILURE.
