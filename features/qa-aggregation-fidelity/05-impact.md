# Impact Analysis — QA aggregation fidelity (C1)

> Step 6. Generated BEFORE implementation. Reviewed at the lock.

## Affected files
- `qa/scripts/qa-report.mjs` — add: pwExit input; guarded
  read/parse; freshness check; `errors[]` inspection; stats
  reconciliation; verdict state machine
  (GREEN|FAILED|INCOMPLETE|UNKNOWN→FAILED); reporter exit reflects
  verdict.
- `qa/scripts/run-qa.mjs` — freshen results.json before the run
  (remove stale); pass real Playwright exit to the reporter; final
  exit = nonzero if Playwright OR reporter escalates.
- **New:** `qa/unit/qa-report-fidelity.spec.ts` (meta-tests
  S1–S6 + G1–G2; runs the reporter on crafted fixtures in a temp
  dir; deterministic).
- No application code. No migration, mobile, OTA. **Deploy-inert.**

## Affected workflows (regression surface)
- Changes the harness that scores EVERY contract. Mitigation: G1
  (genuine green) + G2 (genuine failure) controls ensure existing
  true outcomes are unchanged; the full 56-workflow suite is
  re-run after the change to confirm a real green still reports
  green and exit 0.
- All prior contract `lock.json` `qa_run` notes remain valid (those
  runs were genuinely green with exit 0 — re-confirmed by G1).

## Migration / deploy / OTA impact
- None. QA-harness only. `chore(qa)`/`fix(qa)`-class, deploy-inert.

## Risk notes
- Over-pessimism risk: a too-strict reconciliation could flag a
  genuine green as UNKNOWN (false alarm). Mitigated by G1/G2
  controls + re-running the real 56-suite; tune the
  specs-vs-stats reconciliation to Playwright's actual json shape
  (stats.expected counts tests; specs counts spec entries — the
  reconciliation must compare like-for-like, pinned at Step 7
  against a real results.json).
- Freshness mechanism: prefer run-qa removing stale results.json
  pre-run (simplest, race-free) over mtime heuristics.
- The meta-spec must not depend on the live suite — it crafts
  fixture json files and invokes the reporter as a subprocess with
  a controlled cwd/env. No DB, no network, no browser.
- Bias is intentionally toward FAILED on any doubt — a false alarm
  costs a re-run; a false GREEN costs a bad release. Asymmetric by
  design.
