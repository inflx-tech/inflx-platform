# Expected Outputs — fix onboarded-creator city search

| Step | Observable | Verified by |
|---|---|---|
| Migration | `055_*.sql` present; onboarded branch `u.city AS city` | `git diff` |
| qa:db | migrations 55/55 0-error; `influencer-search 'filters by city (case-insensitive)'` RED→GREEN; other search tests GREEN | fresh `pnpm qa:db` |
| Regression | main `pnpm qa` 66 GREEN / C1 / gate 0 | `pnpm qa` |
| Release | production-impacting deploy surfaced; carve closed | commit + push log; carve lock updated |

## Hard expectations
- Catching test flips by the MIGRATION, NOT a test edit
  (carve discipline; no-fake-green).
- CREATE OR REPLACE VIEW: same output columns in the same
  order as 045 (only the onboarded `city` source value
  changes) — Postgres requires this.
- Scraped branch + `WHERE u.status IN ('approved','pending')`
  unchanged (Q3 product decision retains pending visibility).
- Deterministic instrument → exact delta; no new 500s.
- PRODUCTION-IMPACTING: classified, surfaced, founder-authorized.
