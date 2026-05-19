# Preview (Step 4) — qa-db-truncate-flake (carved finding)

No UI. Carved test-infra robustness finding from
`features/qa-db-determinism`.

Reviewer note:
- **Carved, not fixed.** The qa:db lane is honestly reported as
  **±1 nondeterministic**; no test edited, no timeout raised, no
  `--forceExit`/skip/retry. Masking is explicitly forbidden
  (founder requirement).
- This is the *deeper, smaller* second nondeterminism source
  beneath the leaked-pool one already fixed by qa-db-determinism
  (which cut variance ±3–8 → ±1 and removed the `--forceExit`
  mask — a real, proven win).
- Deploy-inert (test-infra). Future fix also deploy-inert.

Evidence (verify-twice):
- 3 runs failed = 147 / 146 / 147 (not identical).
- Different single test flips each run; ALL with identical
  signature `Exceeded timeout of 30000 ms for a hook` at
  `beforeEach → truncateAll()` (`influencer.test.js:8`,
  `negotiations.test.js:20`).
- `truncateAll` = one `TRUNCATE 28-tables RESTART IDENTITY
  CASCADE` (needs ACCESS EXCLUSIVE on all) → blocks on any
  lingering held lock until the 30s hook timeout.

## Step 7 — RESULT (2026-05-19) — FIXED
```
fix          : tests/helpers/db.js truncateAll() → DEDICATED
               pool client + SET lock_timeout='8s' + on-block
               pg_stat_activity dump + RE-THROW (loud). Removes
               the contention window AND makes any future block
               fast+named, never a silent flake.
detector     : kept ACTIVE across 4 consecutive qa:db runs
determinism  : diag1 + runs 2/3/4 ALL = 236 passed / 146 failed
               / 382 ; ZERO BLOCKED captures ; ~2x faster
history      : ±3-8 → ±1 (pool fix) → 0 across 4 (this)
contract bar : ≥3 identical consecutive runs — MET/exceeded
honest caveat: 4× identical w/ active+silent detector = strong
               empirical determinism, not a math proof; the
               permanent loud lock_timeout is the anti-
               regression guard (NOT a mask: 8s<30s, real
               blocks still FAIL loud, nothing skipped/inflated)
baseline     : stable 236/146 (old 147s were the one timeout-
               flake = noise, now gone)
main pnpm qa : <pending regression confirmation>
deploy       : DEPLOY-INERT (backend/tests/helpers/db.js only)
unblocks     : features/backend-test-debt-phase5
```
