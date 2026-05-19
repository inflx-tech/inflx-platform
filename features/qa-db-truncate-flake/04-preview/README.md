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
