# Impact — Redesign Flow 1 · Brand onboarding

## Verdict

**Zero functional disturbance — visual + UX only.**

## Files touched (13)

### Web (5)
- `Packages/brand-web/app/login/page.js` — restyle (3 step states)
- `Packages/brand-web/app/rejected/page.js` — restyle + copy softening
- `Packages/brand-web/app/dashboard/page.js` — restyle 2 status-banner blocks only (lines 156-184), rest untouched
- `Packages/shared/components/Logo.js` — **new** (web Logo placeholder)
- `Packages/brand-web/tailwind.config.js` — *not touched*; arbitrary Tailwind values used inline

### Mobile (7)
- `Packages/Mobile/src/screens/auth/PhoneScreen.js` — restyle
- `Packages/Mobile/src/screens/auth/OTPScreen.js` — restyle
- `Packages/Mobile/src/screens/auth/InfluencerRegisterScreen.js` — restyle
- `Packages/Mobile/src/screens/auth/WaitingScreen.js` — restyle, dev hint box removed
- `Packages/Mobile/src/screens/auth/RejectedScreen.js` — restyle + copy softening
- `Packages/Mobile/src/components/Logo.js` — **new** (RN Logo placeholder)
- `Packages/Mobile/src/theme/tokens.js` — additive only (extend `lightColors` if any locked key missing)

### QA (1)
- `qa/web/brand/auth.spec.ts` — honest copy-assertion realignment

## NO-TOUCH (preserved exactly)

- `backend/**` (Window A territory)
- API call shapes (sendOtp, verifyOtp, register, resubmit, getMe)
- Form field names + validation + when it fires
- localStorage + AsyncStorage keys
- Role-routing logic
- Navigation route names
- OTP `id="otp-N"` pattern
- Dashboard contents beyond the 2 banner blocks
- Other screens, other flows

## Window A coordination

LOW. Window A is in backend phases A1-A6; they don't touch auth UI,
auth screens, the auth tokens namespace, or shared/components/Logo.
The dashboard banner edit is small and isolated from their planned
NAV-append work.

## Regression risk

LOW (visual only). `pnpm qa` 67/67 must hold; the only spec assertion
change is the honest copy realignment in `auth.spec.ts`. No backend,
no API, no schema, no migration.

## Deploy classification — PRODUCTION-IMPACTING

Surfaced for explicit go on each push:
1. `git push origin main` → Vercel auto-deploys `brand-web` (no Render backend change)
2. `pnpm publish-ota:brand` + `:influencer` + `:follower` (shared auth screens → all 3 OTA flavors)

Rollback: `git revert` the web commit; OTA manifest repoint to prior bundle hash.

## Time estimate

~6-7h focused work.
