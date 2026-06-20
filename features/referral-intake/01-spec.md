# Feature Spec — Referral Intake (D-1 / D-2 / D-3)

> The referral ENGINE (codes, edges, ledger, wallet accrual) already exists. This adds the
> INTAKE: signup code capture, apply-to-become-referrer + admin accept, admin generate/allocate.
> Approved in-session ("lets complete … referral system").

## Problem / goal
Today no signup flow asks for a referral code (only the agency screen does), there's no
"apply to become a referrer" handshake, and no admin "generate & allocate code" action. Goal:
wire intake so brands/influencers can enter a code at signup, influencers can apply to be
referrers, and admins accept + allocate codes.

## Scope
- In scope (web + backend + admin): signup referral_code capture (brand + influencer, server-side,
  best-effort); brand-web brand register field; influencer apply endpoint; admin
  list/approve/reject applications (approve allocates code); admin generate code.
- Out of scope / FOLLOW-UP (mobile, next OTA): influencer register code field + the in-app
  "apply to become referrer" button — backend is ready for both.
- Out of scope: D-4 network-pool model.

## Surfaces touched
- backend: referral.service (redeem helper), brand.controller + influencer.controller (capture),
  referral.controller (apply), referralAdmin.controller/routes (list/decide/generate), migration 108.
- brand-web: app/login (brand referral field), app/admin/referrals (applications + generate panels), lib/api.js.
- mobile: none now (follow-up).

## Data / contracts
- Migration 108: referral_applications (id, applicant_type, applicant_id, status
  requested/approved/rejected, note, allocated_code, timestamps, decided_by) + partial-unique
  index (one open application per applicant).
- Capture reuses existing lookupCode → default_pct → createEdge(source:'signup') — no new math.
- New: POST /referrals/apply (influencer); GET /admin/referrals/applications (any admin);
  POST /admin/referrals/applications/:id/decision (superadmin); POST /admin/referrals/codes (superadmin).

## Non-functional
- Signup safety: capture is BEST-EFFORT — a bad/missing/duplicate code never aborts registration
  (runs after the entity is committed, on a separate pooled connection).
- Admin write guards = superadmin; reads = any admin (matches existing referralAdmin pattern).
