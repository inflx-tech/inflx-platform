# Expected Outputs — referral-agency-mobile (Contract 3b)

> Defined BEFORE coding. Maestro + jest + manual-on-emulator assert against these.

## Per-step expected outputs
| Step | Observable output | How QA verifies it |
|---|---|---|
| Gate | `in.inflx.app.agency` boots to auth screen: "Agency app" + "Welcome back" + "Send OTP" with the current bundle | `pnpm qa:maestro` → `04-agency-launch.yaml` GREEN on emulator |
| Build | agency flavor builds + installs (google-services has `in.inflx.app.agency`) | `pnpm android:agency` succeeds; `adb shell pm list packages` shows it |
| Reg | post-OTP agency w/ no profile → AgencyRegister → `agencyApi.register` → 201 agency row, status pending | manual on emulator / 3a jest already covers the endpoint |
| Home | getMe → referral code (Copy/Share) + wallet + earned + active-referral count render | manual on emulator (behind auth) |
| Withdraw | withdraw form: TDS preview = 5% (194H); submit → net = amount−5%; balance debits; history row | 3a jest asserts the math; UI preview must equal it |
| OTA | `ota.controller` accepts flavor `agency` on manifest-fetch + publish (was 422) | backend jest: agency flavor accepted, unknown flavor still 422 |
| Guard | a non-agency account cannot proceed past auth on the agency flavor | code review of the guard + manual |

## Data assertions
- No migration, no schema change; agency money math unchanged (3a owns it).
- `ota.controller` FLAVORS now includes exactly the 4 app flavors + agency;
  an unknown flavor still rejects (`VALIDATION_ERROR`).
- The other 3 flavors (brand/influencer/follower) still build + their Maestro
  flows still pass (no regression from the shared auth-flow edits).

## Visual evidence required (UI- + Mobile-governed)
- `04-preview/` phone mockups: **Agency Register**, **Home**, **Wallet**
  (withdraw + history), mockup-locked before any `Packages/Mobile/src/**` code.
- `06-diff/notes.md`: before (mockups) / after (emulator or Maestro screenshot
  of the agency auth screen + any reachable screen) signed off before deploy.
- `release.maestro_green: true` (gov-check Rule 5) after `pnpm qa:maestro` GREEN.
- `pnpm qa` GREEN.

## Out of scope (documented, not delivered)
- Play Store listing + production signing + review — manual founder step;
  3b delivers the verified debug APK + the store-submission checklist in
  `06-diff/notes.md` / release notes.
