# Flow 28 — 06-diff/notes.md

## Before

**HomeScreen (216 LOC)** on wave-1 palette:
- Dark navy topbar with white "INFLX" wordmark (orange X accent)
- Wallet hero card (navy bg) — Available + Pending + Total Earned + gold Withdraw CTA
- 2-card stats row (Pending Commissions + TDS This FY)
- 2 quick-link cards (MyStore 🏪 + MyTransactions 📊) with emoji icons
- Active Campaigns list with `StatusBadge` (legacy)
- Recent Withdrawals list with `StatusBadge` (legacy)
- Uses `colors.*` palette throughout
- Bell icon = emoji 🔔 with red badge

**NotificationsScreen (307 LOC)**:
- Dark navy topbar with white title + orange "Mark all as read" CTA
- 20-emoji `NOTIFICATION_ICONS` map (📩 ⏰ ✅ ❌ 🤝 📝 ✍️ 📤 🎉 🔄 📺 💸 💰 ✅ 🏦 ⚠️ 📢 🎊 🚫 🔔)
- Unread cards: `colors.navyPale` bg + orange unread dot
- Empty state: 🔔 emoji + text
- Legacy `colors.*` + `radius` + `spacing` token imports

**InfluencerNavigator (135 LOC)**:
- 5 tabs with emoji icons (🏠 📩 📋 💰 👤)
- Orange active tint + t3 inactive
- White tab bar + border-top
- Uses `colors.orange / t3 / border / white`

## After

**HomeScreen** redesigned as action launchpad:
- Compact ink topbar (~62px) with dashed `[LOGO]` placeholder + `bell-outline` MCI icon + yellow badge + 30×3 yellow rule.
- Greeting line "Good morning, Riya · You have **N** things that need your attention today" (N derived client-side from notifications array — `offer_received + contract_ready + content_revision + negotiation_update` unread types).
- **3 attention tiles**: Pending Offers / Contracts to sign / Content revisions. Each yellow-pale gradient with ink icon-on-yellow when count > 0, bg2-on-bg2 when count = 0. Icons: `tag-outline` / `signature-text` / `image-outline`. Counts derived from notifications array (no new endpoint).
- **Active Campaigns preserved** — same data binding, visually upgraded with brand-initials thumb + canonical StatusPill.
- **Recent Activity NEW** — top 3 unread notifications inline preview (reuses notifications already loaded for badge).
- **Wallet glance strip** (bottom) — single ink card with `wallet-outline` + balance + "WITHDRAW ›" → Earnings tab. Compact, NOT a hero.
- All `colors.*` → `P.*` brandPalette + `fonts.*` throughout. Wave-1 `INFLX` wordmark + orange X dropped (replaced by dashed `[LOGO]`). MyStore + MyTransactions quick-link cards removed (reachable elsewhere).

**NotificationsScreen** restyled:
- Ink topbar with `chevron-left` back icon + title + yellow "Mark all as read (N)" CTA with `check-all` icon.
- 20-emoji icon map collapsed to **10-category MCI icon map** with semantic color tones:
  - `tag-outline` (offer_received/accepted/declined — neutral; offer_expired → danger tone)
  - `handshake-outline` conv-tone (negotiation_update)
  - `file-document-outline` neutral (contract_ready, contract_signed)
  - `image-outline` info-tone (content_submitted/approved/revision/live)
  - `currency-inr` success-tone (tranche_released, commission_earned, commission_confirmed)
  - `bank-outline` (withdrawal_processed → success; withdrawal_failed → danger)
  - `bullhorn-outline` (campaign_update)
  - `account-check-outline` (account_approved; account_rejected → danger)
  - `bell-outline` (general + empty state)
- Unread card style: yellow-pale bg + 6px yellow dot + bold title + yellow-pale icon tile.
- Empty state migrated to canonical EmptyState pattern (dashed-yellow tile, `bell-outline` icon).
- `radius` + `spacing` token imports dropped — replaced with literal values.

**InfluencerNavigator** restyled:
- 5 MCI icons: `home-outline` / `email-outline` / `briefcase-outline` / `currency-inr` / `account-outline`.
- Active tint = `P.yellow` (icon + label). Inactive = `rgba(255,255,255,0.5)`.
- Tab bar bg = `P.ink` (was white).
- 72px height (was default ~60px) to accommodate icon + label.
- Stack structure preserved verbatim (5 tabs × 4 stacks, all `Stack.Screen` declarations unchanged).

**StatusPill canonical map +2**: `processing` (infoPale/info/'PROCESSING') and `failed` (dangerPale/dangerText/'FAILED') for withdrawal lifecycle. 37 → 39 entries.

**Native rebuild**:
- `Packages/Mobile/android/app/build.gradle` → added `apply from: "../../node_modules/react-native-vector-icons/fonts.gradle"` line.
- `Packages/Mobile/android/app/src/main/assets/fonts/MaterialCommunityIcons.ttf` → bundled (~600KB).
- `Packages/Mobile/src/services/otaUpdater.js` → `NATIVE_RUNTIME = '1'` → `'2'`.

## What matches the mockup
- All 3 phone frames + tab variants in side panel.
- 10-category notification icon map with semantic color tones.
- Action tile yellow-pale gradient state.
- Wallet glance compact ink strip.
- Tab bar 5-variant set.

## What honestly diverged
- Action tile counts: in the mockup they show 2/1/1; runtime values depend on user state. The mockup demonstrates the rendered shape when counts > 0.
- "Good morning, Riya" — the actual greeting will derive from user name (from auth context); mockup shows the literal example.

## Preserved verbatim
- All 5 `influencerApi.*` endpoint calls + payload shapes.
- All 18 `getNavTarget` notification-type → screen routing branches.
- `unreadCount > 99 ? '99+' : unreadCount` badge cap.
- `useFocusEffect` unread refresh-on-focus.
- 5-tab stack structure (Home / Offers / Campaigns / Earnings / Profile).
- All `navigation.navigate(...)` cross-tab nested routing payloads.
- `timeAgo()` formatter (7-tier).
