# Expected Outputs — fix-otp-fast-typing

## Code change
- 1 file modified: `Packages/brand-web/app/login/page.js`.
- 1 handler rewritten (the OTP `onChange`).
- 1 attribute added per input: `autoComplete` (one-time-code on first, off on rest).
- Visual styling identical to pre-fix.

## User-observable behaviour
- Fast keyboard typing in OTP boxes — all digits register, none lost.
- Paste of 6-digit string into first box — auto-distributes across all 6 boxes.
- SMS autofill / WebOTP — fills the first box with the full code; paste branch then distributes.
- Backspace in empty box — focus moves backward (unchanged).

## Test result
- pnpm qa stays GREEN at 75/75 (no test removed, no new test added — the existing brand auth spec only exercises Send OTP, not OTP entry).

## Deploy posture
PRODUCTION-IMPACTING via Vercel (brand-web). Backend / mobile untouched.

## Independent of the api.inflx.in outage
This fix lands in brand-web on Vercel. The api.inflx.in `DEPLOYMENT_NOT_FOUND` issue is a separate infra-level problem that does not block this push — the fix takes effect on user devices the moment Vercel redeploys; verification awaits API restoration.
