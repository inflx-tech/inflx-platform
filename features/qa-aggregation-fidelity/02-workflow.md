# Workflow Definition — QA aggregation fidelity (C1)

> Step 3. Verified by META-TESTS that invoke the reporter with
> crafted run states and assert it can never falsely show green.
> Deterministic, no DB/network.

## Actor
The QA aggregator (`qa-report.mjs`) + orchestrator (`run-qa.mjs`).

## Invariant scenarios (each = a meta-test case)
For each crafted state, run the reporter and assert: **verdict is
NOT green AND reporter exit ≠ 0** (escalated):

- **S1 nonzero-exit:** results.json is a *valid all-passed* report,
  but the Playwright exit passed in = 1 → must NOT be green
  (proves green is gated on exit, not just parsed specs).
- **S2 worker/load failure:** results.json has non-empty
  `errors[]` → not green; the errors are surfaced in the report.
- **S3 incomplete:** `stats.unexpected > 0` (or specs count <
  `stats.expected`) → not green.
- **S4a missing results:** results.json absent → not green,
  exit ≠ 0 (NOT exit 0).
- **S4b malformed results:** results.json is invalid JSON →
  not green, exit ≠ 0 (no crash/stacktrace-as-success).
- **S5 stale results:** results.json older than the current run
  marker → treated as missing (not green) — freshness enforced.
- **S6 zero tests:** valid json, zero specs → not green
  (`UNKNOWN — TREAT AS FAILED`).

## Control (must still work)
- **G1 genuine green:** fresh results.json, all passed, exit 0,
  empty errors[], stats consistent → verdict GREEN, exit 0.
- **G2 genuine failure:** fresh results.json with a failed spec,
  exit 1 → verdict ❌ FAILURE (existing behaviour preserved),
  exit ≠ 0.

## Success definition
Every S-scenario yields a non-green, escalated (exit≠0) verdict;
G1 still cleanly green; G2 still a clear failure. It must be
**structurally impossible** for the reporter to print a green
verdict unless: exit==0 AND results fresh+parseable AND errors[]
empty AND stats consistent AND ≥1 spec AND zero failed.

## Failure / edge
- If reconciliation itself is impossible (e.g. exit unknown) →
  default to UNKNOWN→failed (never green). Bias is always toward
  pessimism: uncertainty is failure.
