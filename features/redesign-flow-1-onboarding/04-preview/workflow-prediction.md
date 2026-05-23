# Workflow prediction — Redesign Flow 1 · Brand onboarding

## What the mockups predict (before implementation)

The HTML mockups in `mockups/web.html` and `mockups/mobile.html` show
the visual + UX target. Below is what we predict will be visibly
true once the implementation lands.

### Web
- `/login` phone step: yellow "Send OTP" button, mono phone digits, focus halo, 1-line lede
- `/login` OTP step: 6 cells with 3 distinct states, "Sent to +91 XXXXX" header, resend-countdown
- `/login` register: 8 fields in 2 numbered groups, "Complete registration" yellow CTA
- `/rejected`: warning SVG (no emoji), softer copy, yellow CTA
- `/dashboard` banners: yellow-pale (pending) / danger-pale (rejected) / success-pale (approved)

### Mobile
- Soft `#FAFAFA` bg (no navyDeep)
- Yellow CTAs with ink text
- Mono digit treatment on phones, OTPs, +91 prefixes
- Sticky bottom CTA bar with safe-area padding
- Yellow-pale `[LOGO]` placeholder
- OTPScreen retains its magic (clipboard paste, auto-verify on 6th digit) — surfaced visually

### What is NOT being predicted

- Pixel-perfect match to the mockups (those use Google-fonts via CDN; native fonts on devices may render slightly different)
- The real brand logo (placeholder stays in until founder uploads asset)
- Any responsive breakpoint changes outside the cards shown
- Any animation beyond the dashed-placeholder static look

### How implementation maps to mockup

| Mockup section | Real source file | Implementation note |
|---|---|---|
| web · State 01 phone | `Packages/brand-web/app/login/page.js` (step === 'phone') | Same field names, same submit handler |
| web · State 02 OTP   | `Packages/brand-web/app/login/page.js` (step === 'otp')   | OTP cell IDs `#otp-0..5` preserved for spec |
| web · State 03 register | `Packages/brand-web/app/login/page.js` (step === 'register') | Same backend payload, regrouped UI only |
| web · State 04 waiting (display) | `Packages/brand-web/app/dashboard/page.js` lines 156-164 | Banner only, dashboard body untouched |
| web · State 05 rejected | `Packages/brand-web/app/rejected/page.js` | `brandApi.resubmit` call preserved |
| mobile · 01 phone | `Packages/Mobile/src/screens/auth/PhoneScreen.js` | AsyncStorage `inflx_last_phone` retained |
| mobile · 02 OTP   | `Packages/Mobile/src/screens/auth/OTPScreen.js` | Clipboard + auto-verify retained |
| mobile · 03 register | `Packages/Mobile/src/screens/auth/InfluencerRegisterScreen.js` | influencerApi.register payload preserved |
| mobile · 04 waiting | `Packages/Mobile/src/screens/auth/WaitingScreen.js` | 3 route-params variants preserved |
| mobile · 05 rejected | `Packages/Mobile/src/screens/auth/RejectedScreen.js` | brandApi.resubmit preserved |

### Verifiable predictions for the diff stage

`pnpm diff:open redesign-flow-1-onboarding` (when wired) should show
each mockup beside the captured live-app screenshot. The "after"
screenshots must reach the assertions in `03-expected-outputs.md`.
