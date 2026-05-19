# Expected Outputs — qa-db-truncate-flake (carved finding)

> Step 3. This is a CARVED FINDING. Only Phase output = the
> documented defect + honest ±1 reporting. Table = future fix.

## This carve (now)
- The residual ±1 is recorded with verify-twice evidence
  (identical `Exceeded timeout … for a hook` on `truncateAll()`
  beforeEach, different test each run).
- qa:db is reported **honestly as ±1 nondeterministic** — NOT
  faked stable. No test edited; no timeout raised; no mask.

## Future fix — expected outputs
| Item | Before (defect) | After fix |
|---|---|---|
| `truncateAll()` beforeEach | intermittently >30s → hook timeout | always ≪30s, contention-free |
| `pnpm qa:db` failed count | 146/147/146 (±1) | identical ×≥3 consecutive runs |
| mechanism | `TRUNCATE … CASCADE` blocks on a held lock | rollback/scoped reset OR loud bounded lock_timeout |
| masking | n/a | NONE (no timeout-inflation/skip/forceExit/retry) |

## Hard expectations
- Determinism proven empirically (≥3 identical runs), never
  asserted.
- No `.skip`/delete/timeout-inflation/force-green/retry-to-green.
- If a real production connection-leak is implicated → separate
  production-impacting carve.
