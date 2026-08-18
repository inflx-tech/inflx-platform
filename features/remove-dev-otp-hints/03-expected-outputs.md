# Expected Outputs — Remove dev-mode OTP hints

## Per-step expected outputs
| Step | Observable output | How QA verifies it |
|---|---|---|
| 1 | Phone screen / login page renders no dev pill | grep: zero matches for `dev · `, `dev: use`, `000000` in the four sign-in files |
| 2 | OTP screen renders no dev pill | same grep; visual check in 06-diff |
| 3 | Sign-in with a real SMS code still succeeds | manual production check per surface |

## Data assertions (post-workflow)
- No DB, API, money or attribution surface is touched. Nothing to assert.

## Negative assertions (the real contract here)
- `grep -rn "dev · \|dev: use\|use 000000\|otp 000000" Packages --include=*.js
  --include=*.jsx --include=*.ts --include=*.tsx` returns nothing (excluding
  node_modules and .next build output).
- Each edited file still parses as an ES module with JSX.
- `devPill` has zero remaining references anywhere in the repo.
- Exactly 8 lines deleted, 0 added, across exactly 4 files — no incidental
  edits rode along.

## Visual evidence required
- before/after: mobile phone-entry screen, mobile OTP screen, brand-web
  /login OTP step, admin-web /login OTP step.
- Recorded in `06-diff/notes.md`.
