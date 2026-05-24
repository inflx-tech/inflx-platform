# Impact — fix-otp-fast-typing

## Changes
- 1 file modified (`Packages/brand-web/app/login/page.js`).
- 1 onChange handler rewritten — same input/output contract, fixed internal logic.

## Blast radius
- Only `/login` STEP-2 OTP entry. Phone step + register step unchanged.
- No API, no backend, no migration, no mobile.
- Visual layout / palette / styling identical.

## Rollback
Revert the commit — restores the prior closure-captured onChange. The
old (buggy) behaviour returns.

## Risk
- Functional-update form `setOtp(prev => …)` is React's recommended
  pattern for any handler called rapidly. No new risk.
- `autoComplete="one-time-code"` on first input + `off` on others may
  alter how some browsers handle SMS autofill. Most modern browsers
  (Chrome 84+, Safari 15+) read `one-time-code` from SMS and fill the
  one targeted input. Distribution then happens via the paste branch.
  Worst case: autofill doesn't fire, user types manually — same as today.
- Paste branch handles `e.target.value.length > 1`. Edge case: a
  user typing rapidly such that two characters arrive in one
  composition event would hit the paste branch — distributes both
  starting at `i`, advances focus. Strictly better than today (which
  would have lost one digit).

## Pre-push checklist
1. pnpm qa green (no spec touched).
2. Manual smoke (deferred to founder once api.inflx.in is restored): type 000000 fast, expect all 6 boxes fill.
3. gov-check exit 0.
