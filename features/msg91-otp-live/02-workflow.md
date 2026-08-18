# Workflow Definition — MSG91 live OTP delivery

> Step 3. The executable contract.

## Actor
Unauthenticated user (any role) at the sign-in screen, on a production build
with `OTP_MOCK=false`.

## Preconditions
- `MSG91_AUTH_KEY` and `OTP_TEMPLATE_ID` set in the Render environment.
- MSG91 wallet funded; template `Inflx_OTP_Login` Active + Verified by DLT.

## Workflow steps (user-observable)
1. User enters an Indian mobile number and taps "Send OTP"
   → `POST /v1/auth/send-otp` returns success; screen advances to code entry.
2. User receives an SMS from sender INFLX within seconds, reading
   "OMNARA INDIA PVT LTD (INFLX): Your OTP for login is <6 digits>…"
   → the digits match the newest unused `otp_codes` row for that phone.
3. User enters those digits and submits
   → `POST /v1/auth/verify-otp` returns tokens; the user lands signed in.

## Success definition
The workflow is SUCCESSFUL only if the code the user reads in the SMS is the
code that satisfies `verifyOtp()` and yields a session — i.e. sign-in completes
end to end using a code that arrived over the air, not from a log line.

## Failure / edge workflows
- MSG91 rejects or is unreachable → step 1 returns 502 with "Could not send
  OTP. Please try again."; the user is NOT advanced to code entry and is not
  told a message was sent.
- `OTP_MOCK=false` and credentials missing → 500; server log names the missing
  variables; no silent no-op.
- `OTP_MOCK=true` (dev/test) → no network call at all; code is `000000`.
- Re-requesting a code invalidates the previous unused one (pre-existing
  behaviour, must not regress).
