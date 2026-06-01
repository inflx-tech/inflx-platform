# referral-agency-mobile — Contract 3b: agency mobile app (new flavor)

> **Contract 3b** of the Referral / Strategic-Partner-Agency feature — the agency
> **mobile app**. Builds on Contract 3a (agency backend: role, profile, wallet,
> withdrawal w/ TDS 194H, code redeem). Adds a NEW native APK flavor
> `in.inflx.app.agency` + the agency app screens. Mobile-governed (Maestro gate).
> Firebase registration of `in.inflx.app.agency` (project `aveen-inflx`) is DONE
> (google-services.json updated). Play Store submission is a manual founder step.

## Problem / goal
Agencies exist in the backend (3a) but have no app to sign up, get their referral
code, see earnings, or withdraw. 3b ships the agency-facing app: a 4th flavor of
the existing RN codebase (`in.inflx.app.agency`, `APP_ROLE='agency'`) routing
authenticated agencies to a new `AgencyNavigator`.

## Scope
- **In scope:**
  - **Native flavor (additive gradle + resource; no new Kotlin — `AppConfig`
    resolves the role generically):**
    - `android/app/build.gradle`: `agency` productFlavor (`applicationIdSuffix
      ".agency"`, `resValue "string","app_role","agency"`) + `"agencyDebug"` in
      `debuggableVariants`.
    - `android/app/src/agency/res/values/strings.xml`: `app_name = "INFLX Agency"`.
    - `google-services.json`: already updated to include `in.inflx.app.agency`.
    - `package.json`: `android:agency` script; `LOCAL.md` doc line.
  - **Role routing (JS):**
    - `App.js`: import `AgencyNavigator`; add `role === 'agency' ? <AgencyNavigator/>`;
      add `'agency'` to the APP_ROLE login guard.
    - `OTPScreen.js`: add `'agency'` to the login guard + a post-OTP `agency`
      branch (no profile → `AgencyRegister`; else status routing).
    - `PhoneScreen.js`: `APP_ROLE === 'agency'` → workspace label `"Agency app"`.
  - **Agency screens (new):**
    - `AgencyRegisterScreen` (post-OTP profile setup: agency_name, contact,
      payout UPI/bank) → `agencyApi.register`; optional "Have a referral code?"
      → `agencyApi.redeemReferral` (`POST /referrals/redeem`).
    - `AgencyNavigator` (bottom tabs): **Home** (referral code + Copy/Share +
      earned/pending + active-referral count), **Wallet** (balance + withdraw
      form w/ **TDS 194H 5%** client preview + withdrawal history), **Profile**
      (status, logout).
    - `agencyApi` in `src/services/api.js`: register, getMe, withdraw,
      getWithdrawals, getReferral (reuses 3a + a small agency referral read),
      redeemReferral.
  - **OTA allowlists:** add `'agency'` to `scripts/publish-ota.js` (FLAVORS +
    arg allowlist) and **`backend/src/controllers/ota.controller.js` FLAVORS**
    (prod-impacting — so agency OTA publish + the app's update check work).
  - **Maestro:** new `qa/maestro/flows/04-agency-launch.yaml` (`appId:
    in.inflx.app.agency`, asserts the auth screen "Agency app" + "Welcome back" +
    "Send OTP"); built+installed agency APK; `pnpm qa:maestro` GREEN →
    `release.maestro_green`.
  - QA: `pnpm qa` GREEN; backend jest for the ota.controller FLAVORS change
    (agency manifest/publish accepted); reuse 3a agency suites.
- **Explicitly out of scope:**
  - **Play Store listing / production APK signing / store review** — manual
    founder step (needs Play Console + release keystore). 3b produces the debug
    APK + verifies it on the emulator; store distribution is documented, not done.
  - A distinct agency app **icon** (shares the existing launcher icon; a custom
    icon is a later polish).
  - Agency analytics/dashboards beyond Home/Wallet; managed-tier.
  - iOS agency app (the platform's mobile is Android-first here).

## Surfaces touched
- **App(s):** RN mobile — new `agency` flavor + screens; small JS edits to the
  shared auth flow (App.js/OTPScreen/PhoneScreen). Backend — `ota.controller`
  FLAVORS allowlist (the only backend change; prod-impacting).
- **Roles:** agency (signup → register → home/wallet/withdraw). The auth guard
  ensures the agency APK only logs in agency accounts.

## Data / contracts
- No migration, no schema change. Consumes 3a endpoints: `/agencies/register`,
  `/agencies/me`, `/agencies/me/withdraw`, `/agencies/me/withdrawals`,
  `/referrals/redeem`. `ota.controller` FLAVORS gains `'agency'`.
- TDS preview on the withdraw screen uses **5% (194H)** to match the 3a backend
  (`payment_config.agency_tds_pct`); verified against 3a before shipping.

## Non-functional
- **Auth:** agency APK login-required (not a follower-style public app); guard
  rejects non-agency roles on this flavor.
- **Failure modes:**
  - Build fails without the agency entry in google-services.json → resolved
    (file updated).
  - Agency not approved → withdraw blocked (3a returns 403) → surfaced inline.
  - Redeem invalid/owned code → 404/409 → inline message.
  - OTA to agency before `ota.controller` FLAVORS includes 'agency' → publish +
    update-check 422 → so that backend change ships first.
  - Maestro cold-emulator ANR → re-run warm (known; see 2026-06-01 env note).
- **Deploy:** backend `git push` (ota.controller FLAVORS → Render); agency JS
  reaches devices via OTA once an agency APK is installed; the APK itself is a
  native build → **Play Store submission is the manual founder step**.
