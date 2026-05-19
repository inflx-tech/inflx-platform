# Impact Analysis — search verification tag

## Deploy posture — PRODUCTION-IMPACTING
- `backend/migrations/055_*.sql` (shared w/
  fix-onboarded-creator-city-search) + `backend/src/controllers/
  influencer.controller.js` (GOVERNED). `git push origin main`
  → Render runs the migration + deploys the backend. Surfaced
  explicitly; founder GO on record. NOT silent.
- Additive controller field + view-only migration → low risk.
  Rollback = revert the `is_verified` map + a follow-up view
  migration restoring the prior onboarded verified expressions.

## Affected
- `v_searchable_creators` onboarded branch: `is_inflx_verified`
  → `(u.status='approved')`; `internal_verification_status` →
  `u.status` (migration 055, shared atomic CREATE OR REPLACE).
- `influencer.controller.js` search: `creators` rows gain an
  additive `is_verified` boolean.
- Catching test realigned: `tests/influencer-search.test.js`
  (the ex-`'does NOT include pending'` test).
- Resolves `features/backend-defect-search-includes-pending-
  influencers` (working-as-intended).

## Regression surface
- Scraped branch (`creator_profiles`) verification semantics
  UNCHANGED. Pending onboarded stays VISIBLE in search
  (WHERE retains 'pending') — only its verified flag flips
  TRUE→FALSE (the correct, intended behaviour).
- Other readers of `v_searchable_creators.is_inflx_verified` /
  `internal_verification_status` for ONBOARDED rows: previously
  always TRUE/'verified'; now approval-aware. APPROVED onboarded
  = unchanged (still TRUE). Only PENDING onboarded changes
  (TRUE→FALSE) — the intended correction. The deterministic
  qa:db + main `pnpm qa` are the safety net for any reader.
- `is_verified` is additive (new field) — no existing consumer
  breaks from an added key.
- Main `pnpm qa` (web/L1-L2 + C1): no web spec asserts
  onboarded-pending verified semantics; re-run to confirm 66.

## Risk notes
- Low-medium: the verified-flag semantics change is the founder-
  intended correction; risk is an unaudited internal reader of
  is_inflx_verified for pending-onboarded. Mitigation: full
  deterministic qa:db (all 382) + main pnpm qa regression before
  the production push; CREATE OR REPLACE column-set guard.
- Scope held: deeper taxonomy/notify-on-offer = recorded
  out-of-scope future feature, not silently built.
