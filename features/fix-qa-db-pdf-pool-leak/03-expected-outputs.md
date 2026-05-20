# Expected Outputs — fix qa:db PDF pool leak

| Step | Observable | Verified by |
|---|---|---|
| Fix | `contract.controller.js:1153-1156` adds `pdfRegen` var + `if (env.NODE_ENV === 'test') await pdfRegen;` | `git diff` |
| qa:db run #1 | 382/382 passed, 28/28 suites, migrations 54/54, DB-LANE=PASS | `qa/artifacts/_fixpdf_qadb_run1.log` |
| qa:db run #2 | Identical 382/382 (deterministic) | `qa/artifacts/_fixpdf_qadb_run2.log` |
| Main qa | 66 GREEN / C1 STATE=GREEN / gate 0 (pwExit=0 reportExit=0) | `qa/artifacts/_fixpdf_qa.log` |
| Diff trace | Zero "timeout exceeded when trying to connect" originating at controller.js:1157 in the run logs | `grep` on run logs |
| gov-check | exit 0 on the changeset (rule 1+2 satisfied; 3/4/5 don't fire) | `pnpm qa:gov` |
| Release | PRODUCTION-IMPACTING push surfaced + classified; runtime prod effect = ZERO | commit message + lock.json release block |

## Hard expectations

- **No-fake-green**: the 5 previously RED suites flip GREEN via
  the backend serialisation only. ZERO test edits. ZERO
  `.skip`. ZERO weakened assertions.
- **Determinism**: run #1 and run #2 are 382/382 with the same
  PASS/FAIL suite shape. A flake in either run = NOT done.
- **Zero prod runtime delta**: under `NODE_ENV !== 'test'`, the
  PDF gen continues to fire-and-forget exactly as today (verify
  by inspecting the diff hunk). Brand-approve latency in prod is
  unchanged byte-for-byte.
- **Verify-twice on root cause**: if either qa:db run shows a
  different failure signature (not the controller.js:1157 stack),
  that is new evidence — surface honestly, do not patch on top.
