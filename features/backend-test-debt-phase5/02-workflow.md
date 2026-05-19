# Workflow Definition — backend-test-debt Phase 5

> Step 2. Executable contract. Verifier: B2b DB lane
> (`pnpm qa:db`, real Postgres + 53 migrations). Continuation
> of the Phase-4 method on the next cascade layer.

## Actor
QA/triage operator running `pnpm qa:db` + reading the real
`db-jest.log` and the actual backend controllers/routes.

## Preconditions
Docker up; substrate green (53/53). Baseline **236 passed /
146 failed / 382**. Main `pnpm qa` 66 GREEN / C1 / gate 0.
P1–P4 done; campaign+set creation layers cleared.

## Workflow steps
1. Fresh `pnpm qa:db` → `db-jest.log` + `db-lane.json`; record
   true current pass/fail (no assumption).
2. Inventory every failing test with its signature; none omitted.
3. 4-class classify each, justified by the actual
   controller/route/migration (verify-twice).
4. Align the (1)+(2)+(4) subset — invite/offer payload + wallet-
   funding setup + assertion drift — to the current verified
   contract. Each change cites the controller line proving the
   test was stale/wrong.
5. Carve every class-3 genuine defect (`features/backend-defect-
   <slug>/`, test RED, backend untouched, not masked).
6. Re-measure `pnpm qa:db`; record honest delta vs 236/146 + the
   full classified inventory.
7. Re-run main `pnpm qa`; confirm 66 GREEN / C1 / gate 0; gov-
   check clean on the deploy-inert changeset.

## Success definition
SUCCESSFUL iff: complete 4-class inventory grounded in real
evidence; (1)(2)(4) fixes each traceable to a contract line;
every class-3 carved RED (not masked); honest measured delta
recorded (improvement OR a truthful "no safe reduction, N
carved" — both valid); main `pnpm qa` unchanged. A larger green
delta via skip/delete/weakening/fabrication/force-pass, or by
editing a test that catches a real bug, is an explicit FAILURE.

## Failure / edge
- Can't prove a failure's class from code → uncertain ⇒ class-3
  carve, never silently "fixed" (uncertainty fails).
- A fix would change runtime behaviour → that's a defect carve,
  not a test edit.
- qa:db unavailable → BLOCKED, report; no static-only guessing.
