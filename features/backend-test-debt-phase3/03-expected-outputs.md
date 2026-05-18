# Expected Outputs — backend-test-debt Phase 3

> Step 3 (cont.). Measured vs the post-P2 baseline 151/231/382.

| Metric | Post-P2 | Phase 3 expected |
|---|---|---|
| status-drift sub-classification | none | documented in lock: (i) stale-payload / (ii) genuine-defect / (iii) authz, with counts + evidence cites |
| backend jest passed | 151/382 | **materially higher** (measured; exact recorded) |
| genuine-defect findings | 0 | each (ii) candidate → its own `features/` finding stub; test LEFT failing |
| migrations | 53/53 0-error | unchanged |
| DB laneState | FAIL | FAIL or PASS — honest (PASS only if 0 failed) |

## Hard expectations
- Sub-classification cites the log (no guessing from counts).
- (i) fixes = real controller-contract alignment ONLY (controllers
  read to confirm required fields).
- (ii) genuine backend defects are CARVED OUT as findings and the
  catching test is left red — never `.skip`/edited to green.
- No deletion / fabricated data / assertion weakening anywhere.
- Ledger updated: new baseline + residual + list of (ii) findings.

## Evidence
- `qa/artifacts/db-jest.log` (triage source)
- `qa/artifacts/db-lane.json` post-fix
- this lock: sub-class breakdown, baseline→result delta, defect
  finding IDs

## Implemented by (after lock)
- the triage-identified stale-create-payload sites under
  `backend/tests/**`
- new `features/<backend-defect-*>/` stub(s) for genuine defects
- re-run `pnpm qa:db`; record measured delta + carved findings
