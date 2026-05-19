# Workflow Definition — backend-test-debt Phase 7

> Step 2. Executable contract. Verifier: the now-DETERMINISTIC
> B2b DB lane (`pnpm qa:db`). Continuation of the Phase-6 method
> on the next cascade layer.

## Actor
QA/triage operator running `pnpm qa:db` + reading the real
backend controllers/routes + a reverted instrumented run for
the silent multi-step chain.

## Preconditions
Docker up; substrate green (53/53); instrument deterministic
(qa-db-determinism + qa-db-truncate-flake). Baseline **300
passed / 82 failed / 382** (post-P6 e7ad316). Main `pnpm qa`
66 GREEN / C1 / gate 0.

## Workflow steps
1. Inventory the 82 from `_p6b_remeasure_qadb.log` (authoritative
   post-P6 state) + a fresh `pnpm qa:db` for the re-measure.
2. 4-class classify each, justified by the actual
   controller/route (verify-twice). For the silent
   init/contract chain, add a diagnostic to ONE representative
   test, run it `--runInBand` against the qa:db PG, capture the
   real per-step status/body, then revert the diagnostic
   precisely (git-clean proven).
3. Align the THREE code-proven class-2 levers — formats_json on
   the cascade cohort's set-creates, the approve step in
   contracts.test.js `setupPendingBrand` + 3 pending_influencer
   tests, brand approval in influencer-search.test.js — each
   change traceable to a cited controller/route line.
4. Carve every NEW class-3 genuine defect (`features/backend-
   defect-<slug>/`, test RED, backend untouched, not masked).
   Confirm no new genuine 500s beyond the carved
   follower-feed-noauth-500.
5. Re-measure `pnpm qa:db`; record honest delta vs 300/82 +
   the classified inventory (incl. the deferred non-cascade
   clusters).
6. Re-run main `pnpm qa`; confirm 66 GREEN / C1 / gate 0;
   gov-check clean on the deploy-inert changeset.

## Success definition
SUCCESSFUL iff: complete 4-class inventory grounded in real
evidence; the 3 levers each traceable to a contract line; every
class-3 carved RED (not masked); honest measured delta recorded
(improvement OR truthful "no safe reduction, N carved"); main
`pnpm qa` unchanged. Any larger green delta via
skip/delete/weaken/fabricate/force-pass, or editing a test that
catches a real bug, is an explicit FAILURE.

## Failure / edge
- Can't prove a failure's class from code → uncertain ⇒ class-3
  carve, never silently "fixed".
- A fix would change runtime behaviour → that's a defect carve,
  not a test edit.
- A shared-helper edit (setupPendingBrand / setupAcceptedOffer)
  regresses a currently-green test → the deterministic
  re-measure makes it unambiguous; fix the alignment or carve;
  never net-negative masking.
- qa:db unavailable → BLOCKED, report; no static-only guessing.
