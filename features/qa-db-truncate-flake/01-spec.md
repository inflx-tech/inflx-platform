# Carved Finding — qa:db residual ±1: `truncateAll()` beforeEach intermittently exceeds 30s

> Status: **CARVED FINDING** (from `features/qa-db-determinism`,
> 2026-05-19). Genuine test-infra robustness defect. NOT masked,
> NOT timeout-inflated. A proper fix is its own future contract.

## Symptom
After the pool-leak fix (qa-db-determinism) eliminated the
leaked-handle nondeterminism (variance ±3–8 → ±1, `--forceExit`
removed, clean self-exit), a **residual ±1 nondeterminism**
remains: 3 consecutive `pnpm qa:db` runs gave failed = **147,
146, 147** (not identical → contract's determinism bar not met).

## Verify-twice evidence (real logs)
- Diff of failing-test sets across the 3 runs: a **different
  single test** flips each run —
  run1: `PATCH /v1/influencers/me › returns 404 …`,
  run3: `POST /v1/offers/:id/accept › returns 401 …`,
  run2: clean.
- BOTH flipped tests failed with the **identical signature**:
  `thrown: "Exceeded timeout of 30000 ms for a hook."` at
  `beforeEach → await truncateAll()`
  (`tests/influencer.test.js:8`, `tests/negotiations.test.js:20`).
- Therefore NOT a logic/ordering/date bug in those tests — it
  is the **`truncateAll()` teardown hook intermittently
  blocking >30s**. `truncateAll` issues one
  `TRUNCATE <28 tables> RESTART IDENTITY CASCADE`, which needs
  `ACCESS EXCLUSIVE` on every listed table; it blocks (until the
  30s hook timeout) whenever any connection still holds a
  conflicting lock / an open (idle-in-transaction) client at the
  moment the next test's `beforeEach` runs.

## Classification
Genuine **test-infra robustness defect** (not production
runtime; not a stale fixture; not assertion drift). It is the
*deeper, smaller* second nondeterminism source beneath the
leaked-pool one already fixed.

## Disposition (no masking — founder requirement)
- **Forbidden** as the fix: raising `testTimeout`, `--forceExit`,
  `.skip`, retry-until-green, or any masking — explicitly barred.
- This carve records the finding with evidence; the qa:db lane
  is left honestly reported as **±1 nondeterministic** (not
  faked to look stable).

## Future fix scope (its own contract — not done here)
Make inter-test DB reset contention-free, e.g.: ensure no
in-flight/un-awaited supertest request or unreleased client
holds a lock at `beforeEach` (per-test request hygiene), and/or
replace blanket `TRUNCATE … CASCADE` with a
transaction-rollback or `DELETE`/`session_replication_role`
reset that does not take table-wide `ACCESS EXCLUSIVE`, and/or a
bounded `lock_timeout` that fails LOUD (never silently skips).
Must be proven by ≥3 identical consecutive `pnpm qa:db` runs.

## Surfaces
Test-infra only (`tests/helpers/db.js` truncate strategy + test
request hygiene). **Deploy-inert** finding; the future fix is
also deploy-inert (no `src/**` runtime change).
