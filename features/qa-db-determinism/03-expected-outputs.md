# Expected Outputs — qa:db determinism

> Step 3. Defined before fixing. "Jest passes" is not the
> output — a *deterministic, mask-free* instrument is.

## Per-step expected outputs
| Step | Observable output | Verified by |
|---|---|---|
| 1 Evidence | `--detectOpenHandles` stack(s) naming the leaked handles (the 2 pg Pools ± others) | jest output captured to an artifact |
| 2 Teardown | New per-worker afterAll closing both pools (+ any evidenced handle) | `git diff` of test-infra |
| 3 Clean exit | Jest exits on its own, `--forceExit` REMOVED from `package.json`; `--detectOpenHandles` clean | jest run sans forceExit; exit code 0/1 without hang |
| 4 Determinism | `pnpm qa:db` ×≥3 → identical failed count each run | the 3 run logs / db-lane.json |
| 5 Regression | main `pnpm qa` 66 GREEN / C1 / gate 0 | `qa/reports/latest.md` |
| 6 Re-baseline | the stable honest qa:db number recorded in lock.json | this contract |

## Hard expectations (founder requirements)
- `--forceExit` is **removed**, not relied on. Its removal is
  honest (handles truly closed), proven by a clean self-exit +
  `--detectOpenHandles`.
- `testTimeout` is **NOT inflated** to hide slow/flaky hooks.
  (If anything, the suite should run *faster* once handles close
  and GC pressure drops.)
- No `.skip`, no test deletion, no fabricated data, no
  force-green. The genuine residual failures remain RED and
  their count is unchanged by this work except for the removal
  of the *timeout-flake noise* (which was never real failures).
- Determinism proven empirically: ≥3 consecutive `pnpm qa:db`
  runs with the **same** failed count. A single run is not proof.
- Any genuine runtime leak found is **carved** (own
  production-impacting contract), not patched here.

## Data assertions
- `--detectOpenHandles` post-fix: no `pg`/timer/socket handle
  attributed to test teardown.
- qa:db migrations remain 53/53 0-error.
- The stable failed count ≈ the genuine residual (expected near
  the ~146 true level, minus the timeout-flake noise that was
  inflating it to 149). Whatever it honestly is, it is recorded.
- main `pnpm qa`: 66 GREEN / STATE=GREEN / gate 0 unchanged.

## Evidence
- `qa/artifacts/` open-handle capture (pre), clean-exit run
  (post), the ≥3 determinism-run summaries, `db-lane.json`
  deltas, `qa/reports/latest.md` (main lane), recorded in
  `lock.json` + `04-preview/README.md`.
