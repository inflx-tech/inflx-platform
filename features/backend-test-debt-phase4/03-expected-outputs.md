# Expected Outputs — backend-test-debt Phase 4

> Step 3. Defined BEFORE Step-7. Measured vs **190 passed / 192
> failed / 382** (post city-fix). "It runs" is not an output —
> the classified inventory + honest delta is.

## Per-step expected outputs
| Step | Observable output | Verified by |
|---|---|---|
| 1 Fresh run | `db-jest.log` + `db-lane.json`; true current pass/fail recorded | `pnpm qa:db`; read `db-lane.json` |
| 2 Inventory | Every failing test listed (suite › test + signature); count == failed count, none omitted | Cross-check vs jest summary |
| 3 Classify | Each failure labelled 1/2/3/4 with a controller/route/migration `file:line` justification | The classified inventory table |
| 4 Align | (1)(2)(4) fixes, each traceable to the contract line proving the test was stale/wrong | `git diff` of `backend/tests/**` |
| 5 Carve | One `features/backend-defect-<slug>/` per class-3; catching test RED; backend untouched | New contract folders; test still fails |
| 6 Re-measure | Honest delta vs 190/192/382 + full inventory recorded in `lock.json` | `pnpm qa:db` re-run |
| 7 Regression | main `pnpm qa` 66 GREEN / C1 STATE=GREEN / gate 0; gov-check OK | `pnpm qa`; `qa/reports/latest.md`; pre-push |

## Data assertions
- Failure inventory is **complete**: every failing test in the
  fresh log appears with exactly one of {1,2,3,4} and a real
  code citation. No "misc/unknown" bucket — uncertain ⇒ class-3
  carve (uncertainty fails, never silently "fixed").
- Every test changed in (4) has a one-line rationale + the
  contract `file:line` that makes the old assertion wrong. No
  assertion is loosened merely to pass.
- Each class-3 defect: a `features/backend-defect-*/` stub with
  the exact failing statement/stack; the test stays RED; zero
  backend/runtime edits in this contract.
- qa:db migrations remain **53/53 0-error**. laneState may stay
  FAIL (residual + carved RED by design).
- main `pnpm qa`: **66 GREEN, STATE=GREEN, gate 0** — identical
  before/after (Phase 4 is test-infra + carves only).

## Hard expectations (no-fake-green, GOVERNANCE.md §8)
- No `.skip`, no test deletion, no assertion weakening, no
  fabricated fixture data, no force-pass, anywhere.
- No test that catches a genuine backend bug is edited to pass —
  it is carved and left RED.
- The delta is reported truthfully even if small. "N classified,
  M honestly fixed, K carved, failed 192→X" — X is whatever it
  honestly is. A masked improvement is a contract failure.

## Evidence
- `qa/artifacts/db-jest.log` (fresh, pre + post), `db-lane.json`
  delta, the full classified inventory + delta in `lock.json`
  and `04-preview/README.md`, `qa/reports/latest.md` (main lane
  unchanged), gov-check pass on the deploy-inert changeset.

## Implemented by (after lock)
- `backend/tests/**` alignment for classes (1)(2)(4);
  `features/backend-defect-*/` carves for class (3); honest
  re-measure; main `pnpm qa` regression re-run; results recorded.
