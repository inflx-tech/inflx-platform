# Workflow Definition — backend-test-debt Phase 4

> Step 2. Executable contract. Verifier: the B2b DB lane
> (`pnpm qa:db`) — real Postgres + all 53 migrations. Each step
> is an assertion in the Phase-4 evidence.

## Actor
The QA/triage operator running `pnpm qa:db` and reading the
real `db-jest.log` + the actual backend controllers/routes/
migrations.

## Preconditions
- Docker up; qa:db substrate green (53/53 migrations 0-error).
- Baseline: backend jest **190 passed / 192 failed / 382**
  (post city-fix). Main `pnpm qa` 66 GREEN / C1 STATE=GREEN /
  gate 0.
- P1–P3 done; "X is required" / stale-create-payload class
  exhausted.

## Workflow steps (operator-observable)
1. **Fresh run** → `pnpm qa:db`; capture `db-jest.log` +
   `db-lane.json`. Confirm 190/192/382 (or record the true
   current numbers — no assumption).
2. **Failure inventory** → enumerate every failing test
   (suite › test) with its status-pair / error signature from
   the log. No failure omitted.
3. **4-class classification** → each failure labelled exactly
   one of: (1) stale fixture/setup · (2) business-rule drift ·
   (3) genuine backend defect · (4) assertion drift —
   **justified by the actual controller/route/migration read**,
   not the test's own assumption (verify-twice).
4. **Align (1)+(2)+(4)** → fix those tests to the *current
   verified* contract. Each fix cites the controller:line that
   defines the truth. No assertion weakened to pass; a test is
   only changed when the CODE proves the test was stale/wrong.
5. **Carve (3)** → for every genuine backend defect, create
   `features/backend-defect-<slug>/` (spec + lock stub) citing
   the exact failing statement/stack; leave the catching test
   **RED**; do not patch backend, do not edit the test.
6. **Re-measure** → `pnpm qa:db` again; record honest delta vs
   190/192/382 and the full classified inventory.
7. **Regression gate** → re-run main `pnpm qa`; confirm 66
   GREEN / C1 STATE=GREEN / gate 0 unchanged; gov-check clean.

## Success definition
SUCCESSFUL iff:
- every one of the 192 (or true current) failures is in the
  inventory with a 4-class label justified by real code
  evidence; AND
- the (1)+(2)+(4) subset fixed is a genuine contract alignment
  (each change traceable to a controller/migration line); AND
- every class-3 defect is carved (own contract, test left RED,
  backend untouched, not masked); AND
- honest measured delta recorded (improvement OR a truthful
  "no safe reduction, N defects carved" — both are valid); AND
- main `pnpm qa` 66 GREEN / C1 / gate 0 unchanged; gov-check OK.

A larger green delta obtained by `.skip`/deletion/assertion
weakening/fabricated data/force-pass, or by editing a test that
catches a real backend bug, is an explicit FAILURE.

## Failure / edge
- Ambiguous failure (can't prove class from code) → label
  **uncertain → treat as class-3 candidate / carve**, never
  silently "fix" (uncertainty fails, GOVERNANCE.md §8).
- A fix would change runtime behaviour → out of scope; that is
  a backend-defect carve, not a test edit.
- qa:db unavailable (Docker down) → BLOCKED, report; do not
  substitute static-only guesses for the real lane.
