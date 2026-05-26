# Flow 28 — Workflow

## Actor
Influencer on mobile (RN, influencer-flavor APK rebuilt with MCI font + OTA bundle v66+ matching new NATIVE_RUNTIME=2).

## Preconditions
- Influencer has authenticated (JWT in AsyncStorage).
- APK on device has NATIVE_RUNTIME=2 (built after gradle apply-from line landed) — old APKs (runtime=1) WILL REFUSE the Flow 28 OTA bundle and continue running their baked-in JS until reinstalled. This is the intended safety net (prevents crash on missing native font reference).

## Steps

### A. Tab bar (always visible after auth)
- 5 tabs render: Home / Offers / Campaigns / Earnings / Profile.
- Active tab: MCI icon in P.yellow + small label in P.yellow.
- Inactive tabs: icon + label in muted-white (rgba(255,255,255,0.5)).
- Tap any tab → switch active stack root.

### B. Home screen (Home tab landing)
1. Mount → `Promise.all([getEarnings(), getMyCampaigns('active')])` + side-load `getNotifications()` for badge.
2. Loading state during fetch (full-screen "Loading...").
3. Post-load render branches:
   - **Sticky header**: dashed `[LOGO]` left + `bell-outline` icon right with yellow badge when `unreadCount > 0` (capped at "99+"). Bell tap → `navigation.navigate('Notifications')`.
   - **Greeting line**: "Good morning, [Name]" + dynamic sub: "You have **N** things that need your attention today" where N = count of unread notifications with action-required types (`offer_received` + `contract_ready` + `content_revision` + `negotiation_update`).
   - **3 attention tiles** (always rendered):
     - Pending Offers: count of `notifications.filter(n => !n.is_read && n.type === 'offer_received').length` → tap routes to Offers tab.
     - Contracts to sign: count of `notifications.filter(n => !n.is_read && n.type === 'contract_ready').length` → tap routes to MyContracts (or first contract).
     - Content revisions: count of `notifications.filter(n => !n.is_read && n.type === 'content_revision').length` → tap routes to DeliverableList.
     - Each tile: yellow-pale gradient + ink icon-on-yellow when count > 0; bg2 + muted icon-on-bg2 when count = 0.
   - **Active Campaigns** (conditional `activeCampaigns.length > 0`): up to 3 rows with brand-initials thumb + name + brand + date range + canonical StatusPill.
   - **Recent Activity** (conditional unread notifications exist): top 3 unread notifications inline (same render as Notifications card but as preview). Each card → routes via existing `getNavTarget` switch.
   - **Wallet glance strip** (always rendered post-load): ink card with `wallet-outline` icon + "Available to withdraw" label + mono balance + "WITHDRAW ›" CTA → routes to Earnings tab.
4. Pull-to-refresh on the ScrollView → reload all 3 endpoints.
5. `useFocusEffect` re-fetches unread count when screen gains focus (returning from Notifications).

### C. Notifications screen
1. Mount → `getNotifications()` → loading state → list render OR empty state OR error.
2. Header: ink topbar with back chevron + "Notifications" title + (if unreadCount > 0) yellow "Mark all as read (N)" CTA with `check-all` icon.
3. List: FlatList of NotificationCard:
   - Unread cards: yellow-pale bg + ink-darker border + 6×6 yellow dot at top-left + bold title + yellow-pale icon tile.
   - Read cards: white bg + neutral border + regular title + bg2 icon tile.
   - Icon tile color tone per notification type semantic group:
     - success-tone (successPale/successText): money in — tranche_released, commission_earned, commission_confirmed, withdrawal_processed.
     - info-tone (infoPale/info): content lifecycle — content_submitted, content_approved, content_revision, content_live.
     - conv-tone (convPale/conv): negotiation_update.
     - danger-tone (dangerPale/dangerText): offer_expired, withdrawal_failed, account_rejected.
     - default (bg2/muted): contract_ready, contract_signed, offer_received (read), offer_accepted, offer_declined, campaign_update, account_approved, general.
   - Card tap → `getNavTarget(type, data_json)` deep-link via cross-tab nested navigation (all 18 cases preserved).
4. Mark-all-read tap → `markAllNotificationsRead()` → local state update.
5. Empty state: `bell-outline` in dashed-yellow tile + canonical EmptyState pattern.
6. Pull-to-refresh.
7. Error banner with Retry CTA.

## Success
- Home opens to action items first, not wallet hero.
- Tab bar reads as designed icons (MCI outline), not bracket-text.
- Every backend tile binds to a real `influencer.controller.js` field or notifications-array client-side derivation.
- Visual = locked mockup.
- After APK reinstall + OTA publish, founder smoke-test on physical device confirms tab navigation + Home action tiles + Notifications screen all render correctly.

## Edge cases (preserved verbatim)
- `unreadCount > 99` badge cap.
- `useFocusEffect` re-fetch.
- 18 notification type values + `data_json` deep-link payload shapes.
- Cross-tab nested routing (e.g. `{ screen: 'Offers', params: { screen: 'OfferDetail', params: {...} } }`).
- `radius` + `spacing` token imports from `theme/tokens.js` — replace with literal values where used (cleaner).
- OTA-vs-APK runtime guard: phones with NATIVE_RUNTIME=1 (old APK) skip the Flow 28 bundle (sees runtime mismatch) and continue on baked-in JS until reinstall. NO crash, NO data loss — safe degradation per OTA workflow.

## What does NOT change
- Any backend route, controller, migration, or DB row.
- Any `influencerApi.*` signature or payload field name.
- Any `getNavTarget` switch branch payload shape.
- 18 notification types + their data_json contracts.
- Tab structure (5 tabs, 4 stacks, shared screens).
- Wallet UX itself — moves OUT of Home hero but remains identical on Earnings tab.
