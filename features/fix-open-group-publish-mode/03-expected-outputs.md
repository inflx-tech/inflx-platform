# Expected Outputs — fix open-group publish mode mismatch

| Step | Observable | Verified by |
|---|---|---|
| Fix | `offer.controller.js:835,838` reads `set.influencer_mode` | `git diff` |
| qa:db | `negotiations.test.js 'publishes the open-group set and returns 200'` RED→GREEN; `'returns 422 when set is not open_group'` GREEN | fresh `pnpm qa:db` |
| Regression | main `pnpm qa` 66 GREEN / C1 / gate 0 | `pnpm qa` |
| Release | production-impacting deploy surfaced; carve closed | commit + push log; carve lock updated |

## Hard expectations
- The catching test flips by the BACKEND fix, NOT a test edit
  (no-fake-green; the carve discipline).
- `influencer_mode` is canonical (verified) — change is
  behaviour-consistent with all other open-group readers.
- No new genuine 500s; deterministic instrument → exact delta.
- PRODUCTION-IMPACTING: classified, surfaced, founder-authorized.
