# Feature Spec — Remove dev-mode OTP hints from all sign-in surfaces

## Problem / goal
Every sign-in surface advertised a hardcoded development OTP on screen:
mobile showed a yellow "dev · 000000" / "dev · OTP 000000" pill, brand-web
showed the same pill next to Resend, admin-web showed "(dev: use 000000)".

These were true only while the backend ran `OTP_MOCK=true`. Since
`features/msg91-otp-live/` shipped (commit ff4b832), production sends a real
6-digit code via MSG91 and `000000` is invalid. The hints are now actively
wrong: they tell a real user to type a code that will always fail, and they
advertise to anyone on the login screen that a fixed backdoor code once
existed.

Goal: remove them everywhere, so every app asks for the real code and nothing
else.

## Scope
- In scope: delete the on-screen dev hint and its now-unused style from
  mobile PhoneScreen + OTPScreen, brand-web /login, admin-web /login.
- Explicitly out of scope:
  - Backend `OTP_MOCK`. It stays. `backend/tests/auth.test.js` and local dev
    depend on it, and production already runs `OTP_MOCK=false`, so prod is
    already "real". Deleting the flag would break the test suite and force
    every local sign-in to spend an SMS credit. See lock.json.
  - Any change to OTP length, TTL, auto-verify, resend, or layout beyond
    removing the pill.
  - `FollowerLoginScreen` — inspected, carries no dev hint; its copy
    ("Enter the 6-digit code sent to your phone") is already correct.

## Surfaces touched
- App(s): mobile (brand + influencer + follower — one codebase), brand-web,
  admin-web. Backend untouched.
- Roles involved: all — these are the shared sign-in screens.

## Data / contracts
- Tables / migrations: none.
- API endpoints: none.
- Money/attribution/status machines: none.

## Non-functional
- Auth gates: unchanged.
- Failure modes: none introduced — this is a pure deletion of presentational
  nodes. Both removed styles (`devPill`) were referenced only by the deleted
  elements; verified no other reference exists in the codebase.
