# Feature Spec — MSG91 live OTP delivery

> Step 2 of the contract-driven workflow. Written and agreed BEFORE any code.

## Problem / goal
Phone+OTP is the only way any role signs in. `otp.service.js` generated and
stored a real code but `_sendViaMSG91()` was a stub that only `console.log`ged
it. That was harmless while `OTP_MOCK=true` (code always `000000`). The founder
completed DLT registration, MSG91 panel setup and wallet funding, then set
`OTP_MOCK=false` on Render — which flipped the stub onto the live path and
broke sign-in for every role: a real code is minted and stored, no SMS is sent,
and the user waits for a message that never arrives.

Goal: actually deliver the stored code over SMS via MSG91, and fail loudly
rather than reporting success when delivery does not happen.

## Scope
- In scope:
  - Implement `_sendViaMSG91()` against MSG91 v5 OTP endpoint.
  - Normalise E.164 phone (`+919876543210`) to MSG91's bare-digit form.
  - Treat MSG91's `200 + {"type":"error"}` as a failure, not a success.
  - Stop logging the plaintext OTP; mask the subscriber number in logs.
  - Fail with a clear error when `OTP_MOCK=false` but credentials are absent.
- Explicitly out of scope:
  - `notification.service.js::_sendSms` (the ~60 `sendSms: true` call sites).
    Founder decision 2026-08-18: defer. Those paths remain push + in-app only
    until per-message DLT templates are registered. Tracked separately.
  - Switching OTP verification to MSG91's `/otp/verify` — `otp_codes` stays
    the source of truth.
  - Any change to OTP length, TTL, rate limits, or the auth flow itself.

## Surfaces touched
- App(s): backend only. No web, no mobile, no migration.
- Roles involved: all (brand / influencer / follower / admin) — shared sign-in.

## Data / contracts
- New or changed tables / columns / migrations: none.
- New or changed API endpoints: none. `POST /v1/auth/send-otp` keeps its
  request and success shape; it gains a real failure mode (502) that
  previously could not occur.
- Money/units, attribution IDs, status machines affected: none.

## Non-functional
- Auth/role gates: unchanged — `/send-otp` is public, behind `otpLimiter`.
- Config: `MSG91_AUTH_KEY`, `OTP_TEMPLATE_ID` (`6a840c9f172fc38ddf0d67c2`,
  DLT-approved template `Inflx_OTP_Login`, `##OTP##` variable), `OTP_MOCK`.
- Failure modes the feature must handle:
  - MSG91 unreachable / times out → 502, no false "sent".
  - MSG91 200 with `type: error` (bad template, DLT block, zero balance) → 502.
  - `OTP_MOCK=false` with missing credentials → 500 + explicit server log.
  - Secrets and OTP codes must never reach the log stream.
