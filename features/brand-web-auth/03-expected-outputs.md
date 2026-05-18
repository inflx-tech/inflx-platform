# Expected Outputs — Brand-web auth (phone → OTP)

## Per-step expected outputs
| Step | Observable output | How QA verifies it |
|---|---|---|
| 1 | "Brand Dashboard" + `input[type=tel]` visible | Playwright `toBeVisible` |
| 2 | "Send OTP" button enabled after 10 digits | implicit (click succeeds) |
| 3 | `POST /auth/send-otp` issued | Playwright route interception |
| 4 | Text `OTP sent to +91…` and `#otp-0` visible | Playwright `toBeVisible` |

## Data assertions (post-workflow)
- Network: `/auth/send-otp` called exactly once (stubbed `{success:true}`).
- No DB assertions (auth send-otp is stateless from the UI's view).

## Visual evidence required
- before: `qa/artifacts/screenshots/before/brand-auth__phone-step.png`
- after:  `qa/artifacts/screenshots/after/brand-auth__otp-step.png`

## Implemented by
`qa/web/brand/auth.spec.ts` — green in `qa/reports/latest.md`.
