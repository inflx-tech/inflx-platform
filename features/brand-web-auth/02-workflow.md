# Workflow Definition — Brand-web auth (phone → OTP)

## Actor
Unauthenticated visitor on brand-web `/login`.

## Preconditions
None (login page renders client-side; backend stubbed for the
deterministic L2 test).

## Workflow steps (user-observable)
1. Visitor opens `/login` → the "Brand Dashboard" card + phone input render.
2. Visitor types a 10-digit phone number → "Send OTP" becomes enabled.
3. Visitor clicks "Send OTP" → `POST /auth/send-otp` fires.
4. On success → UI advances to the OTP step ("OTP sent to +91…", six OTP boxes).

## Success definition
The workflow is SUCCESSFUL only if, after step 3, the OTP step is
visible (text `OTP sent to +91` and input `#otp-0` present). A page
that merely renders without advancing is a FAILURE.

## Failure / edge workflows
- API failure → stays on phone step, error message shown, no advance.
- < 10 digits → Send OTP stays disabled, no request.
