# Workflow Definition — Flow 18 · brand-mobile notifications surface

## Actor

Logged-in brand on the mobile app (Android or iOS), role-routed past the Home screen, opens the Notifications surface either via:
- The "Notifications" tile on `BrandProfileScreen`
- A push notification deep-link
- Bottom-tab "Inbox" route (where wired)

## Preconditions

- Brand has at least one notification in `notifications` table (or zero, to exercise empty state)
- Backend `/v1/notifications` endpoint is reachable
- `brandApi.getNotifications` and `brandApi.markAllNotificationsRead` are wired in `services/api.js` (already are — verified by current screen consuming them)

## Workflow steps (user-observable)

1. Brand navigates to `BrandNotificationsScreen` → ink topbar appears with "Notifications" title (Outfit 22 white), and (if any unread) a yellow "Mark all read" pill in the right
2. While the GET fires → centered ActivityIndicator (yellow tint) renders against the BG surface
3. Response arrives → notification cards render in a single vertical scroll list, ordered newest-first
4. Each card shows: type-coloured avatar tile (38px, palette per type) + name + body + footer (relative timestamp + "Tap to open ›" hint if routable) + small yellow unread dot if `!is_read`
5. Brand pulls down → RefreshControl spinner appears, list re-fetches, spinner clears on resolve
6. Brand taps a routable card → optimistic local mark-read flips its visual state, `routeNotification()` resolves to the correct nested navigator (CampaignDetail / BrandContract / BrandNegotiation / Wallet / Home)
7. Brand taps the "Mark all read" pill → pill text flips to "..." for the duration of the POST, then all unread dots vanish + all card backgrounds normalize to read state
8. If list is empty → centered dashed-yellow card with [BELL] icon + "No notifications yet" body

## Success definition

The workflow is SUCCESSFUL only if the final state is:
- Brand sees the redesigned surface (ink topbar, yellow accents, type-coloured tiles, mono timestamps, relative dates like "2h ago")
- All 8 user-observable steps above complete without crash
- Tapping any of the 5 routable `data.screen` cases (campaign_detail / contract_review / negotiation / wallet / brand_dashboard) lands on the correct screen
- No regression in the 24 Wave-3 follower/restaurant screens consuming `lightColors` (additive `brandPalette` export does not modify existing exports)
- No regression in the 75 brand-web/admin-web tests in `pnpm qa` (no web files touched)

## Failure / edge workflows

- **Backend slow / cold start** → ActivityIndicator persists until response; user can swipe back and re-enter without crash (preserved)
- **Notification has missing `data_json.screen`** → card renders without "Tap to open" hint, tap is no-op (preserved via `hasLink` check)
- **Routable card lacks the expected ID (e.g. `data.screen = 'negotiation'` but no `negotiation_id` or `campaign_influencer_id`)** → tap is no-op, no crash, no navigation (preserved via inner if-guards in `routeNotification`)
- **markAllNotificationsRead fails** → optimistic flip stays; on next refresh, server truth re-loads and any false-read flips back to unread (preserved current behavior — no fix needed for Flow 18)
