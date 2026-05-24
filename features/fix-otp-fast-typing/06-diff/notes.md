# 06-diff — fix-otp-fast-typing

**Before:** typing the 6-digit OTP at normal speed worked once or
twice but then stopped — the next keystroke would either disappear
or overwrite an already-filled box. Founder reported needing to
click each box manually to enter the code. Mock OTP `000000` was
producing visible state like "0 0 _ _ _ _" after rapid typing.

**After:** all 6 keystrokes register no matter how fast the user
types. SMS / clipboard paste of the full 6-digit code fills every
box in one action and focuses the last cell. Submit button activates
on the 6th digit.

**What changed in code:**
1. `setOtp(a.join(''))` → `setOtp(prev => { ... })`. Each handler
   call now reads the LATEST committed state instead of a stale
   closure from a prior render. This is the canonical React fix for
   "handler called faster than re-render" races.
2. Added `autoComplete="one-time-code"` to the first input only;
   `autoComplete="off"` on the other five. Stops the browser's WebOTP
   /SMS-autofill from firing per-box and racing keyboard input.
3. Added a paste/multi-char branch — when more than one digit arrives
   in a single onChange (paste, SMS autofill into first box), the
   digits distribute starting at box `i` instead of being truncated
   to 1 char.

**No visual change.** Border, palette, hover, focus ring — all
identical to the redesigned login page (`cca6cf2`).

**Verification path:** pnpm qa stays green (the existing brand auth
spec exercises Send OTP, doesn't actually type into OTP boxes — so
that lane has nothing to break). Real verification is a manual smoke
test post-deploy: type `000000` fast on `/login` after entering
phone, expect "Verify & continue" to activate within ~1 second.

**Surfaced honestly:** the manual smoke test is BLOCKED right now
because `api.inflx.in` is returning Vercel `DEPLOYMENT_NOT_FOUND` —
unrelated to this fix; flagged separately for founder infra check.
The brand-web Vercel deploy proceeds independently.
