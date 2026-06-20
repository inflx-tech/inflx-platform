# Impact Analysis — Referral Intake (D-1/D-2/D-3)

> Terse verdict: additive intake on top of the existing referral engine; signup capture is
> best-effort and cannot break registration. One new table.

## Affected files
- backend: referral.service.js (redeemCodeForEntity helper); brand.controller.js +
  influencer.controller.js (capture after INSERT); referral.controller.js (applyAsReferrer);
  referral.routes.js; referralAdmin.controller.js + referralAdmin.routes.js; migration 108.
- web: app/login/page.js (brand referral field); app/admin/referrals/agencies/page.js
  (applications + generate panels); lib/api.js.
- mobile: none (follow-up).

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| POST | /referrals/apply | NEW (influencer) | apply-to-referrer (mobile follow-up) |
| GET | /admin/referrals/applications | NEW (any admin) | admin referrals page |
| POST | /admin/referrals/applications/:id/decision | NEW (superadmin) | admin referrals page |
| POST | /admin/referrals/codes | NEW (superadmin) | admin generate code |
| POST | /brands/register, /influencers/register | accept optional referral_code | signup |

## Affected workflows (regression surface)
- Brand + influencer registration — must NOT regress. Capture runs post-commit, best-effort.
- Existing referral redeem/accrual — reused, not modified.

## Migration / deploy / OTA impact
- Migration 108 (referral_applications) APPLIED TO PROD before/with code. Backend + web → push. No OTA.

## Risk notes
- Signup safety verified by review (separate connection, swallowed errors, no tx poisoning).
- No duplicate referral math (reuses createEdge/getOrCreateCode).
