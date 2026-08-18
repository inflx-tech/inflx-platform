# Before / After — Remove dev-mode OTP hints

## What changed, per surface

| Surface | Before | After |
|---|---|---|
| Mobile · phone entry | "We'll send a 6-digit code."  +  yellow mono chip `dev · OTP 000000` | hint line only, centered |
| Mobile · OTP entry | "Auto-verifying when you fill the last digit"  +  chip `dev · 000000` | hint line only, centered |
| brand-web · /login | "Didn't get it? **Resend OTP**"  +  yellow chip `dev · 000000` | resend row only |
| admin-web · /login | "OTP sent to +91…" then caption `(dev: use 000000)` | caption line gone; inputs sit directly under the "OTP sent to" line |

## Diff shape
8 deletions, 0 insertions, 4 files. Deletions only — 4 JSX nodes and the 2
now-orphaned `devPill` style entries that backed two of them.

## Verification performed
- `grep` for `dev · `, `dev: use`, `use 000000`, `otp 000000` across
  `Packages/**` (excluding `node_modules` and `.next`) → zero matches.
- `devPill` → zero remaining references repo-wide.
- All four files re-parsed with `@babel/parser` (`sourceType: module`,
  `jsx` plugin) → PARSE OK on each.
- `MONO` (OTPScreen) and `Platform` (PhoneScreen) confirmed still used by
  other style entries, so the style deletions created no dead references.

## Layout note
Three flex rows (`autoVerifyRow`, `hintRow`, brand-web's resend row) drop from
two children to one. All three are `justifyContent: 'center'` /
`text-center`, so the surviving child stays centered rather than shifting
left. The admin-web change also removes a `mb-4` caption, closing a small
vertical gap above the code inputs — the only spacing change in the set.

## Honest limitation
These notes are authored from the source diff and the mockup, not from
rendered screenshots of the running apps. The change is a pure deletion of
static presentational nodes with no conditional logic, so the rendered result
is fully determined by the diff. If you want captured PNGs before release,
say so and I'll run the Playwright/Maestro capture.
