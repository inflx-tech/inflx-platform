# Expected Outputs — search verification tag

| Step | Observable | Verified by |
|---|---|---|
| Migration 055 | onboarded `is_inflx_verified = (u.status='approved')`, `internal_verification_status = u.status` | `git diff` |
| Controller | each search result has additive `is_verified` boolean | `git diff` |
| Test | realigned: both appear; is_verified true(approved)/false(pending); renamed | `git diff` |
| qa:db | realigned influencer-search test GREEN; all other influencer-search GREEN; 55/55 0-error | fresh `pnpm qa:db` |
| Regression | main `pnpm qa` 66 GREEN / C1 / gate 0 | `pnpm qa` |
| Carve | `backend-defect-search-includes-pending-influencers` closed working-as-intended | carve lock updated |

## Hard expectations
- The test encodes the founder's product-confirmed contract
  (include both; explicit verified tag); passes via the backend
  (migration + additive field), NOT a weakening to mask a bug —
  there is no bug; the prior carve was an uncertain-intent hold,
  now decided.
- `is_verified` additive only (no field removed); pending stays
  VISIBLE in search (WHERE retains 'pending').
- Scraped branch verification semantics unchanged.
- Deterministic instrument → exact; no new 500s.
- PRODUCTION-IMPACTING: classified, surfaced, founder-authorized.
- Deeper 4-state taxonomy = recorded out-of-scope follow-up.
