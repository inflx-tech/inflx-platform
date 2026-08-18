# Workflow Prediction — Remove dev-mode OTP hints

Predicted user-visible outcome, authored against the mockups in
`04-preview/mockups/`.

1. **Phone screen (mobile).** Below the Send OTP button, a single centered
   line: "We'll send a 6-digit code." The yellow monospace "dev · OTP 000000"
   chip that sat to its right is gone. The row has one child and stays
   horizontally centered.

2. **OTP screen (mobile).** Below the code boxes: "Auto-verifying when you
   fill the last digit", centered, with no "dev · 000000" chip beside it.

3. **brand-web /login, OTP step.** The row reads "Didn't get it? Resend OTP"
   with nothing after the Resend button. The yellow chip is gone.

4. **admin-web /login, OTP step.** "OTP sent to +91XXXXXXXXXX" is followed
   directly by the code inputs; the "(dev: use 000000)" caption line is gone,
   which also closes a small vertical gap.

Nothing else moves. No colour, spacing, font or copy changes beyond the
removal itself.
