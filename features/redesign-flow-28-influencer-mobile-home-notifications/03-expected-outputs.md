# Flow 28 — Expected outputs

## Visual evidence (matches locked v2 mockup)

### Frame 1 — Home (Home tab active)
- Ink topbar (compact, ~62px) with 30×3 yellow rule + dashed `[LOGO]` tile left + 40×40 round bell button right with `bell-outline` icon + yellow badge "7".
- Greeting line: "Good morning, Riya" (Outfit-Bold 18) + sub "You have **4** things that need your attention today" (PJS-Medium 12, with `4` in mono in a yellow-pale chip).
- 3 attention tiles (horizontal, equal flex): each with yellow-pale gradient + ink 34×34 icon tile + large mono count + small label + chevron. Icons: `tag-outline` (Pending offers), `signature-text` (Contracts), `image-outline` (Content revisions).
- Active Campaigns section: section title + "View All" dashed-link + 3 rows. Each row: 34×34 ink-on-yellow brand-initials thumb + name (Outfit-Bold) + sub (mono muted) + canonical StatusPill.
- Recent Activity section: section title + "View All" + 3 inline notification cards (top 3 unread). Each card: 38×38 tone-colored icon tile + title + msg + mono timestamp.
- Wallet glance strip (bottom): ink card with `wallet-outline` icon in yellow + "Available to withdraw" label + mono ₹ amount in yellow + "WITHDRAW ›" CTA.
- Tab bar (bottom 72px): ink bg + 5 MCI icons + small labels. Home tab active = yellow icon + yellow label.

### Frame 2 — Notifications (mixed read/unread)
- Ink topbar with back chevron + "Notifications" title + yellow "Mark all as read (4)" CTA with `check-all` icon.
- 8 cards: 4 unread (yellow-pale bg + dot + bold title + yellow-pale icon tile) + 4 read (white bg + neutral title + bg2 icon tile).
- 8 distinct MCI icons demonstrated: `tag-outline` (offer), `currency-inr` success (tranche), `image-outline` info (content), `handshake-outline` conv (negotiation), `file-document-outline` (contract), `bank-outline` success (withdrawal), `tag-outline` danger (expired offer), `account-check-outline` (account approved).
- Tab bar (same as Frame 1).

### Frame 3 — Empty state
- Ink topbar (no mark-all CTA).
- Centered EmptyState: `bell-outline` in 66×66 dashed-yellow tile + "No notifications yet" title + descriptive copy.

## Data assertions (no change)

- `influencerApi.getEarnings()` returns the existing 9-field shape (`wallet_balance`, `pending_balance`, `total_earned`, `available_to_withdraw`, `pending_amount`, `locked_entries`, `commission_summary`, `recent_withdrawals`, `tds_this_financial_year`). Flow 28 reads `wallet_balance OR available_to_withdraw` only.
- `influencerApi.getMyCampaigns('active')` returns existing `{ campaigns: [...] }` shape.
- `influencerApi.getNotifications()` returns existing `[{ id, type, title, body, is_read, created_at, data_json }, ...]` shape.
- `markAllNotificationsRead()` returns `{ success: true }`.
- All 18 `data_json.{offer_id, contract_id, deliverable_id, negotiation_id}` payload fields preserved.

## Behavioural assertions (preserved)

- `pnpm qa` 76 passed gate 0 STATE=GREEN on first run after dual-probe pre-warm.
- Tap bell on Home → routes to Notifications screen, returning to Home re-fetches unread count via `useFocusEffect`.
- Tap any of 3 attention tiles → routes per tile target (Offers tab / MyContracts / DeliverableList).
- Tap notification card → `getNavTarget` switch routes to appropriate screen via cross-tab nesting.
- Tap "Mark all as read" → local state updates immediately + API call fires.
- Pull-to-refresh on either screen → reloads endpoints.
- Tab bar tap → switches active stack root.
- Wallet glance "WITHDRAW ›" → routes to Earnings tab.

## Regression watch

- All 5 attention-tile derivations function (count from notifications array client-side).
- All 18 notification-type switch branches still route correctly.
- StatusPill canonical map extension is additive (existing 37 entries unchanged).
- APK with NATIVE_RUNTIME=1 (old) sees runtime mismatch + falls back to baked-in JS — no crash.
- APK with NATIVE_RUNTIME=2 (new) loads OTA bundle + renders MCI icons correctly.
- MCI font file present in `android/app/src/main/assets/fonts/MaterialCommunityIcons.ttf` after rebuild.
