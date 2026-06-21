# Workflow Definition — Fix login phone autofill

## Actor
A user on brand-web /login.

## Preconditions
Browser has saved phone numbers from prior logins.

## Workflow steps (observable)
1. User focuses the Mobile number field and types digits.
2. The browser does NOT auto-fill a saved number / no saved-number dropdown
   hijacks the input.
3. User types their own number freely; OTP send works as before.

## Success definition
- The phone input accepts typed digits without a saved-number autofill replacing
  them; OTP flow unchanged.

## Failure / edge workflows
- A browser that ignores autoComplete="off" may still show a hint, but the
  non-tel name + ignore attributes minimize it; typing is never blocked.
