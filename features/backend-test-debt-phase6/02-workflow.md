# Workflow Definition — backend-test-debt Phase 6

> Step 2. Executable contract. Verifier: the now-DETERMINISTIC
> B2b DB lane (`pnpm qa:db`). Continuation of the Phase-5 method
> on the next cascade layer.

## Actor
QA/triage operator running `pnpm qa:db` + reading the real
backend controllers/routes.

## Preconditions
Docker up; substrate green (53/53); instrument deterministic
(qa-db-determinism + qa-db-truncate-flake). Baseline **259
passed / 123 failed / 382** (post-P5 f5416b8). Main `pnpm qa`
66 GREEN / C1 / gate 0.

## Workflow steps
1. Inventory the 123 from `_p5_remeasure_qadb.log` (authoritative
   post-P5 state) + a fresh `pnpm qa:db` for the re-measure.
2. 4-class classify each, justified by the actual
   controller/route (verify-twice).
3. Align the (1)+(2)+(4) subset — create-order payload drift,
   accept/contract step, wallet-funding setup — to the verified
   contract; each change cites the controller line.
4. Carve every class-3 genuine defect (`features/backend-defect-
   <slug>/`, test RED, backend untouched, not masked).
5. Re-measure `pnpm qa:db`; record honest delta vs 259/123 +
   the classified inventory.
6. Re-run main `pnpm qa`; confirm 66 GREEN / C1 / gate 0;
   gov-check clean on the deploy-inert changeset.

## Success definition
SUCCESSFUL iff: complete 4-class inventory grounded in real
evidence; (1)(2)(4) fixes each traceable to a contract line;
every class-3 carved RED (not masked); honest measured delta
recorded (improvement OR truthful "no safe reduction, N
carved"); main `pnpm qa` unchanged. Any larger green delta via
skip/delete/weaken/fabricate/force-pass, or editing a test that
catches a real bug, is an explicit FAILURE.

## Failure / edge
- Can't prove a failure's class from code → uncertain ⇒ class-3
  carve, never silently "fixed".
- A fix would change runtime behaviour → that's a defect carve,
  not a test edit.
- qa:db unavailable → BLOCKED, report; no static-only guessing.
