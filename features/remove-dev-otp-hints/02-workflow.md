# Workflow Definition — Remove dev-mode OTP hints

## Actor
Unauthenticated user (any role) on any sign-in surface, against production.

## Preconditions
Production backend running `OTP_MOCK=false` with live MSG91 delivery
(shipped in `features/msg91-otp-live/`).

## Workflow steps (user-observable)
1. User opens the phone-entry screen (mobile) or /login (web)
   → sees "We'll send a 6-digit code." and NO dev pill anywhere on screen.
2. User enters a number and taps Send OTP
   → advances to code entry; the screen shows the auto-verify hint and
     the Resend control, and NO "dev · 000000" pill.
3. User types the real 6-digit code received by SMS
   → signs in exactly as before.

## Success definition
Successful only if: no sign-in surface renders any reference to a fixed
development code, AND sign-in with a real SMS code still completes on mobile,
brand-web and admin-web.

## Failure / edge workflows
- Wrong code entered → the existing "Invalid or expired OTP" error, unchanged.
- Resend → unchanged behaviour; only the adjacent pill is gone.
- Layout: the rows that held the pill (`autoVerifyRow`, `hintRow`, the
  brand-web resend row) must still center correctly with one child instead
  of two.
