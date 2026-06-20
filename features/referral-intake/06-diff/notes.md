# 06 — Implementation / diff notes (Referral Intake, D-1/D-2/D-3)

Intake layer on the existing referral engine. UI-governed touches: brand-web login referral
field + admin referrals panels (standard patterns, no new mockup). Approved in-session.

## What was implemented
- referral.service.redeemCodeForEntity({code, referredType, referredId}) — wraps the existing
  redeem path (lookupCode → default_pct → createEdge source:'signup'); best-effort (bad/empty/dup
  code returns a soft note, never throws).
- Signup capture: brand.controller (after brand INSERT) + influencer.controller (after influencer
  INSERT) accept optional referral_code and call the helper on a separate pooled connection AFTER
  the registration commits — a bad code can never abort signup.
- D-2 apply: POST /referrals/apply (influencer) → requested application; duplicate pending → 409.
- Admin: GET /admin/referrals/applications; POST .../:id/decision (approve allocates code via
  getOrCreateCode + stamps allocated_code; reject); POST /admin/referrals/codes (generate). Writes
  superadmin, reads any admin.
- Migration 108: referral_applications + partial-unique index (one open application per applicant).
- brand-web: login brand-register optional referral-code field; admin referrals page Applications +
  Generate-code panels; lib/api.js referral methods.

## Reviewer findings + resolution
- Review CLEAN. Confirmed: registration safety (post-commit, separate connection, swallowed errors —
  signup never breaks on a bad code); no duplicate referral math (reuses createEdge/getOrCreateCode);
  apply 409 handling; admin guards correct; migration additive/idempotent. pnpm qa GREEN.

## What diverged / deferred (mobile, next OTA — backend ready)
- Influencer register screen: optional referral-code field → pass referral_code to influencer register.
- Influencer in-app "Apply to become a referrer" button → referralApi.applyReferral().

## What to check after deploy (migration 108 applied first)
- Register a brand on web with a valid code → referrer linked (no signup break on a bad code).
- Influencer apply (via API) → appears in admin Applications → Approve shows the allocated code.
- Admin Generate code returns/ensures a code for a chosen influencer/agency.
