# Expected Outputs — Redesign Flow 1 · Brand onboarding

## Post-implementation, every assertion below must be true.

### Web · `/login`
- Wordmark renders as a dashed `[LOGO]` placeholder (clearly distinct from any styled text). Aria-label = "inflx logo placeholder".
- "Welcome back" H1 + lede line visible
- Phone input renders with mono digits, `🇮🇳 +91` prefix, focus = yellow halo (`box-shadow: 0 0 0 4px rgba(255,193,7,0.18)`)
- "Send OTP" button = yellow filled (`#FFC107`) with ink text — never red/orange
- OTP cells: 3 distinct visual states (empty grey border / filled yellow-50 bg / focus yellow halo)
- "Sent to +91 XXXXX" line with mono number
- Resend label appears with a 30s countdown timer
- Dev hint as a yellow-pale pill ("dev · 000000")
- Register state: 8 fields split into 2 numbered sections — "1 Business" (name, business_name, industry, category) + "2 Location" (address_line, city, pincode, state)
- Required asterisks in danger red (`#E8401A`)

### Web · `/rejected`
- Danger-pale circle with warning SVG icon (no ❌ emoji)
- "Your application needs a fix" H1
- "Reason from admin" danger banner with the rejection text
- "Update & resubmit" yellow primary button
- "Sign out" demoted to ghost button

### Web · `/dashboard` (status banners only)
- Pending banner: yellow-pale bg (`#FFF7CC`), ink border-left, clock SVG icon, "Account under review" title
- Rejected banner: danger-pale bg (`#FDEEE9`), danger border-left, warning SVG icon, link to `/dashboard/profile`
- Approved badge: success-pale (`#D1FAE5`) pill with success dot
- All other dashboard content unchanged

### Mobile · all 5 auth screens
- `lightColors.bg` (`#FAFAFA`) page bg; no more `navyDeep` solid
- Wordmark = `[LOGO]` placeholder via `<Logo />` RN component
- Primary CTAs = yellow filled with ink text
- Sticky bottom CTA bar pattern on PhoneScreen + OTPScreen + InfluencerRegisterScreen
- OTPScreen retains clipboard-auto-paste feature (visible toast "OTP pasted from clipboard")
- OTPScreen retains auto-verify-on-6th-digit (microcopy surfaces it)
- WaitingScreen: 3 variants (standard / matched / conflict) reachable by current `route.params` logic, same end-state behaviour
- WaitingScreen: dev `Approve at localhost:3003` box REMOVED
- RejectedScreen: "Your application needs a fix" + yellow "Update & resubmit"

### QA gate
- `pnpm qa` = **67/67 PASSED · gate 0 · STATE=GREEN · pwExit=0 · reportExit=0**
- C1 verdict machine unchanged
- 10 fidelity meta-tests unchanged
- `qa/web/brand/auth.spec.ts` PASSES with new copy assertions
- DB lane `pnpm qa:db` — not run for this flow (no backend change)
- Maestro `qa/maestro/flows/*.yaml` — at least the current public-browse flow stays green; mobile RELEASE flip requires fresh Maestro run

### Visual diff
- Before/after PNGs captured in `qa/artifacts/diff/redesign-flow-1-onboarding/{before,after}/`
- `06-diff/notes.md` summarises what shipped and what's still placeholder

### Governance gates (gov-check)
- Rule 1 (approved contract) ✓
- Rule 2 (release evidence at flip) ✓
- Rule 3 (mockup_locked) ✓
- Rule 4 (06-diff/notes.md non-empty) ✓
- Rule 5 (Maestro green) — fires only on mobile RELEASE flip

### Functional preservation (must hold)
- Every API call from §02-workflow still works
- Every form field name unchanged
- Every navigation route name unchanged
- Every storage key unchanged
- Role-routing branches in OTPScreen unchanged
- localStorage / AsyncStorage write semantics unchanged
