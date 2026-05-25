# Workflow Prediction — Flow 18 · brand-mobile notifications

> Maps each visible section of the mockup (`mockups/web.html`) to the backend field, API call, or behavioral pattern that sources it. Per `feedback_backend_first_tiles`: every tile must trace to a real backend field that exists TODAY.

## Section → backend source

| Mockup section | Source | Verified? |
|---|---|---|
| Topbar "Notifications" title | Hardcoded UI | n/a (static) |
| Topbar unread count chip ("3 unread") | `notifications.filter(n => !n.is_read).length` (client-side derive) | ✓ existing pattern |
| "Mark all read" pill | `POST /v1/notifications/mark-all-read` via `brandApi.markAllNotificationsRead` | ✓ existing endpoint |
| ActivityIndicator (loading) | `useState(loading=true)` → flips after `await brandApi.getNotifications()` | ✓ existing pattern |
| Card avatar tile (color) | Derived from `notification.type` enum (account_*/offer_*/negotiation_turn/contract_signed/content_*/tranche_released/commission_earned/low_wallet/withdrawal_processed) | ✓ all 14 types already in `TYPE_ICONS` const |
| Card avatar tile (icon text) | Lookup from `TYPE_ICONS[n.type]` (ASCII placeholders: [OK], [X], [CHAT], [DOC], [UP], [LIVE], [RS], [!], [$]) | ✓ existing const, 14 entries |
| Card name | `notification.title` (string field on notifications table) | ✓ |
| Card body | `notification.body` (string field) | ✓ |
| Card timestamp (relative: "2h ago") | New inline `fmtRelative(iso)` helper applied to `notification.created_at` (timestamptz) | ✓ pattern lifted from web Flow 10/11/12/13/15 |
| Card "Tap to open ›" hint | `!!(data && data.screen)` truthy check on `notification.data_json` (jsonb) | ✓ existing pattern |
| Unread dot (yellow, 8px) | `!notification.is_read` (boolean field) | ✓ existing field |
| Empty state ("No notifications yet") | Render when `notifications.length === 0` post-load | ✓ existing |
| Pull-to-refresh control | `RefreshControl` re-triggers `load()` which re-calls `getNotifications` | ✓ existing |

## Behavioral preservation

| Behavior | Implementation | Preserved? |
|---|---|---|
| Optimistic per-row mark-read on tap | `setNotifications(prev => prev.map(...))` before navigation | ✓ verbatim |
| `routeNotification()` data-driven nav (5 cases) | Switch on `data.screen` → `navigation.navigate('Campaigns', { screen: '...', params: {...} })` | ✓ verbatim |
| markAllRead optimistic flip | `setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))` after POST resolves | ✓ verbatim |
| Disabled state on non-routable card | `disabled={!hasLink}` on TouchableOpacity | ✓ verbatim |

## Notification type → avatar color mapping (NEW design)

| Type | Avatar bg | Avatar fg | Icon |
|---|---|---|---|
| account_approved | yellow_pale `#FFF7CC` | yellow_text `#6B5A00` | [OK] |
| account_rejected | danger_pale `#FDEEE9` | danger_text `#B91C1C` | [X] |
| offer_accepted | success_pale `#D1FAE5` | success_text `#047857` | [+] |
| offer_declined | danger_pale `#FDEEE9` | danger_text `#B91C1C` | [X] |
| negotiation_turn | conv_pale `#F3E8FF` | conv `#7E22CE` | [CHAT] |
| contract_signed | eng_pale `#CFFAFE` | eng `#0E7490` | [DOC] |
| content_submitted | info_pale `#DBEAFE` | info `#1D4ED8` | [UP] |
| content_approved | success_pale `#D1FAE5` | success_text `#047857` | [OK] |
| content_live | success_pale `#D1FAE5` | success_text `#047857` | [LIVE] |
| tranche_released | yellow_pale `#FFF7CC` | yellow_text `#6B5A00` | [RS] |
| commission_earned | yellow_pale `#FFF7CC` | yellow_text `#6B5A00` | [RS] |
| low_wallet | danger_pale `#FDEEE9` | danger_text `#B91C1C` | [!] |
| withdrawal_processed | yellow_pale `#FFF7CC` | yellow_text `#6B5A00` | [$] |
| (fallback for unknown type) | bg2 `#F4F4F5` | muted_2 `#71717A` | [*] |

## What is NOT in this mockup

- Per-row mark-read API call (backend doesn't have a per-row endpoint; preserved as local-only optimistic flip)
- Filter chips / type tabs (not in current screen scope, would be a Flow 18b expansion if requested)
- Bulk-select multi-tap (not in scope)
- Read/unread toggle (current behaviour: mark all OR mark single on tap; no toggle-back affordance preserved)
