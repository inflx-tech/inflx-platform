# Expected Outputs — backend-defect-follower-feed-noauth-500

> Step 3. This is a CARVED FINDING. The only Phase-4 output is
> the documented defect + the RED test. The table below defines
> what the FUTURE fix contract must achieve.

## This carve (Phase 4) — expected state
- `tests/follower-feed.test.js:182` (`returns 401 without auth`)
  is **RED** and stays RED (real product bug, not masked).
- No backend change, no test edit, no runtime change. Deploy-inert.
- Finding recorded with verify-twice evidence (route + handler
  file:line).

## Future fix contract — expected outputs
| Item | Before (defect) | Expected after fix |
|---|---|---|
| `GET /v1/follower/feed` no auth | HTTP 500 (server throws) | **HTTP 401** `UNAUTHORIZED` envelope |
| Authenticated follower feed | works | unchanged |
| catching test (`:182`) | RED | GREEN — because backend returns 401 (NOT via test edit) |
| `pnpm qa:db` | this test RED | RED→GREEN, no net-new failures |
| main `pnpm qa` | 66 GREEN | unchanged 66 GREEN / C1 / gate 0 |

## Hard expectations
- The fix is closed by correcting the backend, never by editing
  / skipping / weakening the test.
- Minimal, behaviour-preserving for authenticated callers.
- Production-impacting → the fix contract gets an explicit
  release gate (not silent).
