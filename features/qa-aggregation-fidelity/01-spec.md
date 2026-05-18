# Feature Spec — QA aggregation fidelity (C1)

> Contract C1. Step 2. GOVERNANCE-INTEGRITY priority — sequenced
> BEFORE B2b per founder decision 2026-05-18. Implementation GATED
> on `lock.json.approved = true`. Deliberately NARROW: truthful
> aggregation only — NO dashboards/analytics/grouping/tagging.

## Problem / goal
During B2a, `qa-report.mjs` printed **"ALL GREEN" while the run
exited 1** (B2a's import crashed). The release *gate* (run-qa exit
code) held, but the **human-facing report lied**. In a
contract-driven model where humans approve releases off this report,
a report that can show green on a failed/incomplete/errored run is a
**governance-integrity risk**, not reporting polish.

## Root mechanism (verified in source)
- `qa-report.mjs` reads `qa/artifacts/results.json` with **no
  freshness check** → a crashed Playwright run leaves the PRIOR
  run's results.json → stale GREEN.
- It never consults the Playwright **exit code** (run-qa never
  passes it), nor Playwright's top-level `json.errors`
  (worker/suite-load failures).
- Missing results → `process.exit(0)` (success).
- `JSON.parse` is unguarded → malformed/partial json crashes the
  reporter silently (run-qa ignores its status).

## Scope — the 6 truthful-aggregation invariants ONLY
1. **Green-impossible-on-nonzero-exit:** if the Playwright run exit
   ≠ 0, the verdict can NEVER be green.
2. **Worker/suite-load-failure detectable:** non-empty
   Playwright `errors[]` ⇒ not green, surfaced.
3. **Incomplete-run detection:** parsed specs inconsistent with
   `stats` (e.g. `unexpected>0`, or specs < expected, or zero
   specs) ⇒ not green.
4. **Parser-failure handling:** missing / unreadable / malformed
   results ⇒ not green, escalated (never silent exit 0).
5. **Exit-code/report reconciliation:** report verdict and run
   outcome must agree; run-qa passes the real exit to the reporter;
   the reporter's own exit reflects its verdict.
6. **Unknown-state escalation:** ANY ambiguity (stale/missing/
   partial/unparseable/mismatch) ⇒ a loud
   `UNKNOWN — TREAT AS FAILED`, non-zero exit.

## Out of scope (explicit — do NOT build yet)
Grouped failures, per-area/contract rollup, regression tagging,
screenshot/trace indexing, SKIP analytics, any dashboard. Those are
later Area-C contracts. C1 restores **trust** only.

## Surfaces touched
- `qa/scripts/qa-report.mjs`, `qa/scripts/run-qa.mjs` (QA harness
  only). No app code. No migration, mobile, OTA. Deploy-inert.
