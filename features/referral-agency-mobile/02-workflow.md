# Workflow Definition — referral-agency-mobile (Contract 3b)

> New agency app flavor + screens. Steps are agency actions → API/DB + screen
> assertions. Mobile-governed (Maestro launch flow is the gate).

## Actor
A **partner agency** using the `in.inflx.app.agency` app (APP_ROLE='agency').

## Preconditions
- Contract 3a deployed (agency role + endpoints live).
- `in.inflx.app.agency` registered in Firebase (`aveen-inflx`); google-services
  updated. `ota.controller` FLAVORS includes `'agency'` (deployed first).

## Workflow steps (observable)
1. Agency opens the app → auth screen shows **"Agency app"** label →
   enters phone → OTP (role='agency' from APP_ROLE) → verify.
2. First-time → no agency profile → **AgencyRegisterScreen**: agency_name,
   contact, payout (UPI/bank), optional referral code →
   `agencyApi.register` (+ `redeemReferral` if a code was entered) → status
   `pending` → "waiting for approval" state.
3. After admin approval (Agencies admin page / 3a) → next open routes to
   **AgencyNavigator**.
4. **Home tab:** `agencyApi.getMe` → shows referral **code** (Copy / Share),
   wallet balance + total earned + active-referral count.
5. **Wallet tab:** withdraw form → TDS 194H **5%** client preview →
   `agencyApi.withdraw({amount, method})` → success → balance updates +
   withdrawal appears in history (`agencyApi.getWithdrawals`).
6. **Profile tab:** account status + logout.

## Success definition
- The agency APK boots to its auth screen ("Agency app" / "Welcome back" /
  "Send OTP") with the current JS bundle → `04-agency-launch.yaml` GREEN (the
  mobile-verify gate).
- An agency can register, (after approval) see code + earnings, and withdraw
  with correct TDS 194H 5% math (matches 3a backend net_paid).
- The auth guard rejects non-agency accounts on this flavor.
- `pnpm qa` GREEN; `ota.controller` accepts `agency` manifest/publish; no
  regression to the other 3 flavors.

## Failure / edge workflows
- Not approved → withdraw 403 → inline "awaiting approval".
- Over-balance / below-min → 422 inline.
- Invalid/owned referral code at register → 404/409 inline; registration still
  succeeds (code is optional).
- Cold-emulator Maestro ANR → re-run warm.
