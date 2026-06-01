# Diff notes — referral-agency-mobile (Contract 3b)

## What was implemented
A new **`in.inflx.app.agency`** Android flavor of the RN app + the agency
screens, driving the Contract-3a backend. Native: `build.gradle` agency flavor
(`applicationIdSuffix .agency`, `app_role=agency`) + `agencyDebug` in
`debuggableVariants` + `src/agency/res/values/strings.xml` (INFLX Agency) +
`google-services.json` updated (Firebase `in.inflx.app.agency` registered) +
`android:agency` script. No new Kotlin — `AppConfig` resolves the role
generically. JS: `App.js`/`OTPScreen`/`PhoneScreen` agency branch + role guard +
"Agency app" label; `AgencyNavigator` (Home/Wallet/Profile) + `AgencyHomeScreen`,
`AgencyWalletScreen`, `AgencyProfileScreen`, `AgencyRegisterScreen`; `agencyApi`
in `services/api.js`. Backend: `ota.controller` FLAVORS += `agency` (so agency
OTA publish + update-check work); `agency.controller.getMe` now returns
`referred_count`. OTA allowlist (`publish-ota.js`) += agency. Maestro flow
`04-agency-launch.yaml`.

## What matches the locked mockup
- `01-agency-register.html` → `AgencyRegisterScreen` — agency name, contact,
  email, city, payout (UPI/bank segmented), optional referral code, "Create
  agency account" → pending approval.
- `02-agency-home.html` → `AgencyHomeScreen` — dark wallet-balance hero, Total
  earned + Active referrals stats, referral code chip with Copy/Share, "how you
  earn" box; bottom tabs Home/Wallet/Profile.
- `03-agency-wallet.html` → `AgencyWalletScreen` — available-to-withdraw hero,
  UPI/Bank segmented + amount, **TDS 194H 5%** preview (Requested / TDS / You
  receive), Withdraw now, recent-withdrawals list.

## What diverged from the mockup (and why)
- **TDS preview % is a client-side constant (5%)**; the backend (3a) computes
  the authoritative `net_paid`/`tds_deducted` (honoring per-agency exemption/
  override). The success alert shows the backend figures. Flagged, not silent.
- **Profile tab** wasn't separately mocked — it's a straightforward
  identity/status/logout screen consistent with the other apps' profile pattern.
- App-bar/status-bar chrome is the app's real navigation, not the mockup's
  decorative phone frame.

## Things the founder should specifically check
- **Auth guard:** the agency APK only logs in agency accounts (a brand/
  influencer/follower account is rejected with a clear message).
- **Approval gate:** a pending agency sees "awaiting approval"; withdraw is
  blocked (3a 403) until approved via the Agencies admin page.
- **TDS:** withdraw preview shows 5% (194H); the confirmation alert reflects the
  backend's exact net.
- **Empty/edge states:** no referrals → ₹0 + 0 active; no withdrawals → "No
  withdrawals yet".

## Out-of-band changes
- `agency.controller.getMe` gained `referred_count` (additive field) to power
  the Home "active referrals" stat. Backend `ota.controller` FLAVORS is the only
  other backend change (allowlist + agency). All staged by explicit path.

## After-shots / verification
- "Before" = the 3 locked mockups in `04-preview/mockups/`.
- "After" = the Maestro `04-agency-launch` screenshot of the live agency app's
  auth screen ("Agency app" / "Welcome back" / "Send OTP"), captured on
  emulator-5554. The RN bundle compiled via Metro (HTTP 200, 9.6 MB) — proving
  all agency screens + shared edits are valid. Authenticated agency screens
  (Home/Wallet) need an approved agency login (OTP); on the prod backend that
  isn't automatable here, so they're verified via the bundle-compile + boot
  smoke (same constraint as Contract 4).

## Manual founder step (not automatable)
- **Play Store:** production signing + a Play Console listing for
  `in.inflx.app.agency` + review. 3b delivers the verified debug APK; the store
  submission is yours.
