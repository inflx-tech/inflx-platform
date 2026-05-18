# Expected Outputs — QA aggregation fidelity (C1)

> Step 3 (cont.). Asserted by the QA report (meta). Defined BEFORE code.

## Per-scenario expected verdict + exit
| Scn | Crafted state | Verdict | Reporter exit |
|---|---|---|---|
| S1 | passed json + Playwright exit=1 | not green (FAILED) | ≠ 0 |
| S2 | json.errors[] non-empty | not green; errors listed | ≠ 0 |
| S3 | stats.unexpected>0 / specs<expected | not green (INCOMPLETE) | ≠ 0 |
| S4a | results.json missing | UNKNOWN→FAILED | ≠ 0 |
| S4b | results.json malformed | UNKNOWN→FAILED | ≠ 0 |
| S5 | results.json stale (pre-run) | treated missing → FAILED | ≠ 0 |
| S6 | valid json, 0 specs | UNKNOWN — TREAT AS FAILED | ≠ 0 |
| G1 | fresh, all passed, exit 0, errors[] empty, stats consistent | ✅ ALL WORKFLOWS PASSED | 0 |
| G2 | fresh, 1 failed, exit 1 | ❌ WORKFLOW FAILURES | ≠ 0 |

## Hard invariant (the governance guarantee)
`verdict === GREEN` is reachable **iff** ALL of:
`pwExit===0 ∧ resultsFresh ∧ resultsParsed ∧ errors.length===0 ∧
specs.length>0 ∧ stats.unexpected===0 ∧ failedSpecs===0 ∧
specs reconcile with stats`. Otherwise verdict ∈ {FAILED,
INCOMPLETE, UNKNOWN→FAILED} and reporter exit ≠ 0.

## Reconciliation contract
- `run-qa.mjs` passes the real Playwright exit to the reporter
  (env/arg) and **freshens** results (removes/relocates stale
  results.json before the run, or stamps a run id the reporter
  verifies).
- `run-qa.mjs` final exit = nonzero if EITHER Playwright OR the
  reporter escalates (report anomaly also fails the gate).

## Evidence
The QA report's own verdict line + reporter exit per scenario,
asserted by the meta-spec. No screenshots (harness logic).

## Implemented by (after lock)
- `qa/scripts/qa-report.mjs` + `qa/scripts/run-qa.mjs` (fidelity
  guards + freshness + exit reconciliation).
- `qa/unit/qa-report-fidelity.spec.ts` — runs the reporter against
  crafted fixtures (S1–S6, G1–G2) in a temp dir. Green in
  `qa/reports/latest.md` (the report now trustworthy enough to
  report its own fix).
