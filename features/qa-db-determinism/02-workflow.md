# Workflow Definition — qa:db determinism

> Step 2. Executable contract. Verifier: the B2b DB lane itself
> + `jest --detectOpenHandles`. The "workflow" here is the
> instrument behaving deterministically.

## Actor
QA/governance operator stabilizing the qa:db backend-jest lane.

## Preconditions
- Docker PG up (`pnpm qa:db:up`). 53 migrations apply 0-error.
- Known nondeterminism: failed count 146↔149, `--forceExit` in
  the test script, `Force exiting Jest … async operations still
  running`, ≥1 `Exceeded timeout` flake/run under load.

## Workflow steps (observable)
1. **Capture evidence** — `jest --detectOpenHandles --runInBand`
   on a representative test file → record the exact open-handle
   stacks (expect: the two `pg` Pools; note any others).
2. **Add honest teardown** — a Jest per-worker afterAll closing
   `tests/helpers/db.js` `closePool()` + `src/config/db.js`
   `pool.end()` (+ any other evidenced handle).
3. **Prove clean exit** — re-run jest **without `--forceExit`**:
   it must exit on its own, no hang, `--detectOpenHandles`
   clean. Remove `--forceExit` from `package.json`.
4. **Determinism check** — run `pnpm qa:db` **≥3 times**; the
   failed count must be identical each run (no timeout-flake
   swing). Record the stable number.
5. **Regression** — re-run main `pnpm qa`; 66 GREEN / C1
   STATE=GREEN / gate 0 unchanged.
6. **Re-baseline** — record the new honest, stable qa:db
   baseline; unblock Phase 5 against it.

## Success definition
SUCCESSFUL iff: open-handle leaks identified from real evidence
and closed by genuine teardown; Jest exits cleanly **with
`--forceExit` removed**; `--detectOpenHandles` reports no leak;
qa:db failed count is **identical across ≥3 consecutive runs**
(deterministic); main `pnpm qa` unchanged; and the new baseline
is recorded honestly. Any "stability" produced by skip/delete/
timeout-inflation/force-green is an explicit FAILURE.

## Failure / edge
- Clean exit needs `--forceExit` still → a handle remains;
  `--detectOpenHandles` to find it; close it; do NOT re-mask.
- A leak traced to `src/**` production code path → STOP, carve
  it as a production-impacting backend-defect; do not patch
  runtime here.
- Counts still swing after pools closed → there is a second
  nondeterminism source (ordering/shared-state/date) — inventory
  it from evidence; classify; fix the real cause or carve.
