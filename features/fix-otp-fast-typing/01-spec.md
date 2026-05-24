# fix-otp-fast-typing — eliminate the stale-closure race in the /login OTP input

> Tiny single-file fix. Founder reported (2026-05-24): "while filling
> OTP earlier i used to enter fastly, now it is not taking from
> keyboard fastly, it is coming zero i need to select manually."

## Root cause
`Packages/brand-web/app/login/page.js` lines ~270-294 — the 6-box OTP
input uses a closure-captured `otp` string in `onChange`:
```js
const a = otp.split(''); a[i] = v;
setOtp(a.join('').slice(0, 6));
```
When the user types faster than React re-renders, `otp` in closure is
the value from the previous render, NOT the latest committed state. So
each rapid keystroke rebuilds the OTP array starting from a stale
snapshot, losing earlier digits.

The mock-mode OTP is `000000` (CLAUDE.md). Typing six zeros rapidly,
only the first two or three land — matching the founder's symptom.

A second contributing factor: every input has `autoComplete` defaulting
to whatever the browser picks. With 6 sibling inputs, the WebOTP /
SMS-autofill API also fires per box, racing the keystroke handlers.

## Fix
1. **Functional state update** — `setOtp(prev => { ... })` so each call
   reads the latest committed state regardless of render timing. This
   is the canonical React fix for stale-closure-in-handler bugs.
2. **`autoComplete="one-time-code"`** ONLY on the first input;
   `autoComplete="off"` on the other 5. Browser will fill the first
   box with the full code on SMS autofill; the new multi-char branch
   distributes it across all 6 boxes via the paste path.
3. **Paste / multi-char support** — when `e.target.value` is more than
   1 digit (paste / SMS fill), distribute starting at box `i` instead
   of truncating to 1 char. Also moves focus to the last filled box.

## Files
- `Packages/brand-web/app/login/page.js` — onChange handler in the
  STEP-2 OTP block (~lines 270-300).
- This contract.

## Out of scope
- Visual styling (Window B's wave2 palette unchanged).
- Phone / register steps (unchanged).
- Backend OTP service (`backend/src/services/otp.service.js` unchanged).

## Test
- pnpm qa stays green (login auth test exercises the OTP path).
- Manual: type `000000` fast → all 6 boxes fill, focus lands on submit.
- Manual: paste `123456` into box 0 → all 6 boxes fill.

## Deploy posture
PRODUCTION-IMPACTING for Vercel (brand-web redeploy). Backend
untouched. Mobile untouched.

## Note re: prod state
Separately surfaced: `api.inflx.in` is currently returning Vercel
`DEPLOYMENT_NOT_FOUND` (infra-level outage, NOT caused by this fix).
This fix is independent — it lands in brand-web on Vercel. Once the
API domain is restored, the fixed OTP flow runs against a live
backend.
