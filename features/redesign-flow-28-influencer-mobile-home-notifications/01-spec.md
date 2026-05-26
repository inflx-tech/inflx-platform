# Flow 28 — Influencer-mobile Home + Notifications + Navigator (spec)

## Problem

`Packages/Mobile/src/screens/influencer/HomeScreen.js`, `screens/influencer/NotificationsScreen.js`, and `navigation/InfluencerNavigator.js` are the first 3 surfaces of the mobile-influencer bucket. All consume the legacy `colors.*` palette + emoji tab icons + bespoke status pills + emoji notification icons. The wave-1 Home screen makes wallet balance the hero, which duplicates the Earnings tab and pushes daily-action items below the fold.

## Goal

1. Establish the mobile-influencer bucket visual baseline: brandPalette + fonts.* + canonical `<StatusPill>` + canonical `<EmptyState>`.
2. Replace mono-text icons (emoji or proposed brackets) with **real MaterialCommunityIcons** outline glyphs via `react-native-vector-icons` — one-time native rebuild that all subsequent 22 influencer + 44 follower screens inherit via OTA.
3. **Redesign Home** as an action launchpad: wallet OUT of hero (Earnings tab owns wallet UX) → greeting + 3 attention tiles + active campaigns + recent activity + compact wallet-glance bottom strip.
4. Notifications screen: same layout, but swap 20-emoji map for 10-category real-icon map with semantic tones.

## Scope (in)

- `Packages/Mobile/src/screens/influencer/HomeScreen.js` — full layout redesign (wallet hero removed, action tiles added, recent-activity inline preview added).
- `Packages/Mobile/src/screens/influencer/NotificationsScreen.js` — full restyle, icon-map collapse from 20 emoji types → 10 MCI icons with semantic color tones. All 18 `getNavTarget` deep-link branches preserved verbatim.
- `Packages/Mobile/src/navigation/InfluencerNavigator.js` — 5 real MCI tab icons + yellow active tint + ink bg.
- `Packages/Mobile/src/components/brand/StatusPill.js` — extend canonical map +2: `processing`, `failed` (withdrawal lifecycle).
- `Packages/Mobile/android/app/build.gradle` — add `apply from: "../../node_modules/react-native-vector-icons/fonts.gradle"` line.
- `Packages/Mobile/android/app/src/main/assets/fonts/MaterialCommunityIcons.ttf` — bundle the MCI font file (~600KB).
- `Packages/Mobile/src/services/otaUpdater.js` — bump `NATIVE_RUNTIME` from `'1'` → `'2'`.

## Scope (out)

- **No backend / API / migration / DB change.** Zero touch.
- **All 5 influencerApi calls preserved verbatim** (`getEarnings`, `getMyCampaigns`, `getNotifications`, `markAllNotificationsRead`, navigation targets).
- **All 18 notification type values + 18 `getNavTarget` deep-link branches preserved verbatim.** Cross-tab nested routing payload shapes are NO-TOUCH.
- `unreadCount > 99 ? '99+' : unreadCount` badge cap preserved.
- `useFocusEffect` unread-count refresh-on-focus preserved.
- `MyStore` + `TransactionFeed` screens — out of scope for Flow 28 (reachable via Profile + Earnings respectively).

## Data — preserved verbatim

5 endpoints:
- `influencerApi.getEarnings()` — returns `{ wallet_balance, pending_balance, total_earned, available_to_withdraw, commission_summary, recent_withdrawals, tds_this_financial_year }` per `backend/src/controllers/influencer.controller.js:717-731`. Flow 28 consumes only `wallet_balance`/`available_to_withdraw` for the bottom glance strip.
- `influencerApi.getMyCampaigns('active')` — Active Campaigns list (preserved as in wave-1).
- `influencerApi.getNotifications()` — badge count on Home AND full list on Notifications screen AND action-tile counts (NEW: client-side filter by `type` to derive Pending Offers / Contracts to sign / Content revisions counts).
- `influencerApi.markAllNotificationsRead()` — mark-all CTA on Notifications screen.
- All `navigation.navigate(...)` targets preserved (including cross-tab nested routing from notification deep-links).

## Visual decisions (locked 2026-05-26 chat)

1. **Tab tint**: yellow active (P.yellow), muted-white inactive. Cross-role consistency with brand-mobile bucket.
2. **Tab icons**: real MaterialCommunityIcons (`home-outline` / `email-outline` / `briefcase-outline` / `currency-inr` / `account-outline`) + small labels.
3. **Logo**: dashed `[LOGO]` placeholder per locked policy.
4. **Notification icons**: 10-category MCI map with semantic color tones (success-tone for money, info-tone for content, conv-tone for negotiation, danger-tone for failures/expirations, default for neutral).
5. **Action tiles**: yellow-pale gradient when count > 0 (attention state), bg2 when count = 0 (resting state).
6. **Wallet glance**: ink card at bottom, single-line balance + chevron, NOT a hero.
7. **Native rebuild**: one-time gradle change + APK rebuild + reinstall. Acceptable cost for the visual win across 67 future mobile screens.

## Acceptance

- All 9 Home render branches visually upgraded (greeting · 3 attention tiles · campaigns list · recent activity · wallet glance · plus loading / refresh-control / empty-active-campaigns / empty-recent-activity edge cases).
- All 6 Notifications render branches preserved (loading · header · error · empty · list · refresh-control).
- All 18 notification-type → deep-link branches function byte-equivalent.
- Tab bar renders 5 MCI icons with yellow active tint.
- StatusPill canonical map extended +2 to 39 entries.
- APK rebuild ships brand/influencer/follower variants with MCI font bundled.
- `pnpm qa` 76 passed gate 0 STATE=GREEN first run (after dual-probe pre-warm) post-native rebuild.
- After this flow: 22 remaining influencer screens + 44 follower screens can use MCI icons via pure OTA.
