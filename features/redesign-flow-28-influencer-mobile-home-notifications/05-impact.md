# Flow 28 — Impact

## Chat impact verdict
Zero backend / API / migration / DB / business-logic touch — visual redesign + canonical-component swap + one-time native font bundle for MaterialCommunityIcons.

## Files touched (6)

| File | LOC delta | Nature |
|---|---|---|
| `Packages/Mobile/src/screens/influencer/HomeScreen.js` | 216 → ~270 | Layout redesign (wallet hero removed → action tiles + recent activity + wallet glance added) + brandPalette + fonts + MCI icons + StatusPill. |
| `Packages/Mobile/src/screens/influencer/NotificationsScreen.js` | 307 → ~290 | brandPalette + fonts + MCI icons (20-emoji map → 10-icon map with semantic tones) + EmptyState consolidation. All 18 `getNavTarget` branches preserved. |
| `Packages/Mobile/src/navigation/InfluencerNavigator.js` | 135 → ~155 | Tab styling brandPalette + 5 MCI icons. Stack structure unchanged. |
| `Packages/Mobile/src/components/brand/StatusPill.js` | 110 → ~115 | Append 2 canonical map entries: `processing`, `failed`. |
| `Packages/Mobile/android/app/build.gradle` | +1 line | `apply from: vector-icons/fonts.gradle` line. |
| `Packages/Mobile/android/app/src/main/assets/fonts/MaterialCommunityIcons.ttf` | new (~600KB) | Bundled font asset (auto-copied by fonts.gradle apply). |
| `Packages/Mobile/src/services/otaUpdater.js` | 1 const | `NATIVE_RUNTIME = '1'` → `'2'`. |

## APIs touched
**None.** Every `influencerApi.*` call signature and payload preserved verbatim (5 endpoints: getEarnings, getMyCampaigns, getNotifications, markAllNotificationsRead, plus all navigation.navigate routing payloads).

## Regression surface
- Home: layout redesign means JSX structure substantially changes. Risk: missing one of the existing render branches. Mitigation: explicit checklist of original 9 sections — confirm each is either preserved (campaigns) or intentionally moved (wallet to Earnings) or replaced (stats row → action tiles).
- Notifications: visual swap only, no logic touch. 18 `getNavTarget` cases preserved verbatim.
- Navigator: visual swap only, stack structure preserved.
- StatusPill canonical map: append-only — existing 37 entries unchanged. All current consumers unaffected.

## Native rebuild risks
1. **OTA bundle vs APK runtime mismatch** — phones with old APK (NATIVE_RUNTIME=1) will refuse new bundle and fall back to baked-in JS. This is the SAFETY MECHANISM, not a bug. Founder must reinstall on test devices to see Flow 28.
2. **Font asset shipped via APK** — adds ~600KB to install size (one-time). Compared to typical RN APK (40-60MB), this is < 2% overhead.
3. **Gradle apply-from line** is the canonical RNVI pattern — well-documented + low-risk.
4. **No code under `Packages/Mobile/android/app/src/main/java/**`** touched — Kotlin native code unchanged.
5. **`pnpm android:brand|influencer|follower release` rebuild** — requires Android SDK on dev machine. Already part of the bucket workflow.

## Window A coordination
Window A's active backend work (entitlements/quota/migration 063) is orthogonal — Flow 28 is mobile-only. No coordination risk.

## QA prediction
- Baseline = 76 passed gate 0 STATE=GREEN (anchor: 2026-05-26T02-21-12-553Z).
- After Flow 28: expect 76 passed gate 0 STATE=GREEN — no test surface in `qa/` touches influencer-mobile screens or navigator.
- Dual-probe pre-warm mandatory before QA.

## Deploy posture
**Production-impacting**:
1. **Native** (one-time): rebuild 3 APKs + founder reinstalls on test devices. NOT a pure git push.
2. **OTA** (post-reinstall): `pnpm publish-ota:all` ships the JS bundle to phones running NATIVE_RUNTIME=2.
3. **Web/backend**: no-op (Vercel/Render auto-deploy on push triggers but nothing changed for them).

## Maestro gate (gov-check Rule 5)
Will use `GOVERNANCE_OVERRIDE="Maestro not yet wired for solo dev — Flow 28 first mobile-influencer flow ships with manual founder smoke-test after APK reinstall"` on the close-out commit.

## Time
- Mockup: complete.
- Contract artifacts: complete (this set).
- Native rebuild prep (gradle line + font copy + NATIVE_RUNTIME bump): ~10 min.
- Screen implementation (3 screens + StatusPill +2): ~120-150 min.
- APK rebuild + founder reinstall: ~20-30 min (founder time).
- QA + OTA ship + close-out: ~20 min.
- Total: ~3.5-4 hours.

## What ships after
Mobile-influencer bucket 1/23 done. Next = Flow 29 (Offer list + Offer detail). All 22 remaining influencer screens + 44 follower screens can now use MCI icons via pure OTA.
