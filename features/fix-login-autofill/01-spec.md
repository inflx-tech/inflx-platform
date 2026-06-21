# Feature Spec — Fix: login phone field browser-autofill hijack

## Problem / goal
Founder report (2026-06-21): on brand-web `/login`, typing "9" makes the browser
auto-fill a saved number and it's hard to enter the real login number. Root
cause: the mobile-number input is `type="tel"` with `name="phone"` and NO
`autoComplete` attribute → Chrome offers its saved-phone autofill (noisy now that
many test numbers were saved during this session's testing).

## Scope
- In scope: suppress browser/password-manager autofill on the login phone input
  (autoComplete="off", a non-tel-ish name, autoCorrect/spellCheck off,
  data-1p-ignore / data-lpignore).
- Out of scope: OTP boxes (already one-time-code), the registration fields.

## Surfaces touched
- brand-web: app/login/page.js (the phone `<input>` only).
- Roles: brand/influencer logging in.

## Data / contracts
- None. Pure input-attribute change. No API/schema.

## Non-functional
- No behaviour change to OTP send/verify; only stops the browser from
  auto-filling a saved number into the phone field.
