# Workflow prediction — referral-agency-mobile (Contract 3b)

## Trigger
A partner agency installs/opens the `in.inflx.app.agency` app.

## Steps
1. Auth screen ("Agency app") → phone → OTP (role='agency' from APP_ROLE).
2. First time → **AgencyRegisterScreen** (agency_name, contact, payout, optional
   referral code) → `agencyApi.register` (+ `redeemReferral` if code) → pending.
3. After admin approval → **AgencyNavigator** (Home / Wallet / Profile).
4. **Home:** referral code (Copy/Share), wallet balance, total earned, active
   referrals, "how you earn".
5. **Wallet:** withdraw form with TDS 194H 5% preview → `agencyApi.withdraw` →
   balance updates + history.
6. **Profile:** status + logout.

## End state
- An agency can self-onboard, get approved, share its code, and withdraw — from
  its own app.

## Edge cases
- Non-agency account on this flavor → blocked at the guard.
- Not approved → withdraw 403 → "awaiting approval" inline.
- Over-balance/min → 422 inline. Invalid/owned code → 404/409 (register still ok).
- Cold-emulator Maestro ANR → re-run warm.

## What changes vs current behaviour
- Today: agencies have backend support (3a) but no app.
- After: a 4th native flavor `in.inflx.app.agency` + agency screens.
- Files: build.gradle agency flavor + strings.xml + google-services (done);
  App.js/OTPScreen/PhoneScreen agency branch+guard+label; AgencyNavigator + Home/
  Wallet/Profile + AgencyRegisterScreen; agencyApi; ota.controller + publish-ota
  FLAVORS += agency; 04-agency-launch.yaml.

## Blast radius
- Production-impacting: backend ota.controller FLAVORS (Render); OTA agency
  bundle. The agency APK is native → **Play Store submission is a manual founder
  step**. No migration, no money-path change.
- Mobile-verify gate ENFORCED (release.maestro_green).
- Rollback: remove flavor/nav/allowlist; nothing persisted.

## Open questions
- None blocking. Firebase registration done. Mockups are the review artifact for
  mockup-lock. Play Store distribution acknowledged as manual.
