# Impact Analysis — MSG91 live OTP delivery

> Step 6. Written BEFORE implementation.

## Affected files (read or change)
- backend: `src/services/otp.service.js` — the only file changed.
  - `_sendViaMSG91()` stub → real axios POST.
  - added `_maskPhone()` helper; removed plaintext-OTP `console.log`.
  - `axios` (already a backend dependency) newly required in this module.
- Read but unchanged: `src/config/env.js`, `src/controllers/auth.controller.js`,
  `src/routes/auth.routes.js`, `src/app.js` (otpLimiter).
- web / mobile / migrations / shared: none.

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| POST | /v1/auth/send-otp | success shape unchanged; new 502 failure path that previously could not fire | mobile (all 3 apps), brand-web, admin-web |
| POST | /v1/auth/verify-otp | unchanged | same |

## Affected workflows (regression surface)
- Sign-in for every role — covered by `backend/tests/auth.test.js`, which runs
  under `OTP_MOCK=true` and therefore never reaches the changed branch.
- Everything else is untouched: the changed function had exactly one caller
  (`sendOtp`, same module) and one behaviour (send or throw).

## Migration / deploy / OTA impact
- New migration? No. No `run-NNN.js`.
- Mobile JS changed? No → no OTA. No native change → no APK rebuild.
- Backend only → `git push` triggers a Render redeploy. **PRODUCTION-IMPACTING.**
- Vercel: brand-web / admin-web untouched, but both redeploy on any push to
  main; that is a no-op rebuild of identical source.

## Risk notes
- **This push is a fix to a live outage, not a new feature.** Production
  currently has `OTP_MOCK=false` against the stub, so sign-in is broken for
  all roles until this lands.
- Irreversible/destructive aspects: none. No data backfill. No auth-logic,
  token, or session change.
- Rollback: set `OTP_MOCK=true` in Render to restore `000000` sign-in without
  a code revert.
- Residual risk: the live MSG91 request shape is verified against mocked axios
  in tests, so a genuine credential/template mismatch surfaces only on the
  first real send. Mitigated by the founder's post-deploy handset check, and by
  the fact that failures now return 502 loudly instead of failing silent.
- Deferred, tracked separately: `notification.service.js::_sendSms` remains a
  stub; ~60 `sendSms: true` call sites stay push + in-app only pending
  per-message DLT templates. Founder decision, 2026-08-18.
