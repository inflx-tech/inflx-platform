# Flow 28 — Workflow prediction (tile → backend source mapping)

Per `feedback_backend_first_tiles` — every metric and data point traces to a real backend field or honest client-side derivation.

## Home — Header

| Mockup element | Backend source | Notes |
|---|---|---|
| `[LOGO]` placeholder | static | per locked logo policy |
| Bell icon | static | `bell-outline` MCI |
| Bell badge count | `notifications.filter(n => !n.is_read).length` | client-side from already-loaded notifications array; `> 99` capped to "99+" |

## Home — Greeting strip

| Mockup element | Backend source |
|---|---|
| "Good morning, [Name]" | `users.name` from auth context (existing) |
| "N things that need your attention" | computed client-side: `notifications.filter(n => !n.is_read && ['offer_received','contract_ready','content_revision','negotiation_update'].includes(n.type)).length` |

## Home — 3 attention tiles

| Tile | Count source | Tap target |
|---|---|---|
| Pending offers | `notifications.filter(n => !n.is_read && n.type === 'offer_received').length` | `navigation.navigate('Offers')` |
| Contracts to sign | `notifications.filter(n => !n.is_read && n.type === 'contract_ready').length` | `navigation.navigate('Profile', { screen: 'MyContracts' })` |
| Content revisions | `notifications.filter(n => !n.is_read && n.type === 'content_revision').length` | `navigation.navigate('Campaigns', { screen: 'DeliverableList' })` |

All counts derived from the SAME `getNotifications()` response. **No new endpoint needed.**

## Home — Active Campaigns

| Element | Source |
|---|---|
| Brand thumb (initials) | derived from `campaign.brand_name` (first 2 chars uppercase) |
| Campaign name | `campaigns[].campaign_name` |
| Brand · date range | `campaigns[].brand_name` + formatted `start_date` + `end_date` |
| Status pill | `campaigns[].influencer_status` → canonical StatusPill |

## Home — Recent Activity

Reuses notification array already loaded. Filters: `notifications.filter(n => !n.is_read).slice(0, 3)`. Each card identical to Notifications screen card render (same icon mapping, same tap behavior via `getNavTarget`).

## Home — Wallet glance strip

| Element | Source |
|---|---|
| `wallet-outline` icon | static MCI |
| "Available to withdraw" label | static |
| Balance amount | `earnings.available_to_withdraw` OR fallback `earnings.wallet_balance` (per `backend/src/controllers/influencer.controller.js:715`) |
| "WITHDRAW ›" CTA | tap → `navigation.navigate('Earnings')` |

## Notifications screen — header

| Element | Source |
|---|---|
| Back chevron | `navigation.goBack()` |
| Title "Notifications" | static |
| "Mark all as read (N)" CTA | `notifications.filter(n => !n.is_read).length`, button calls `markAllNotificationsRead()` |

## Notifications screen — list cards

| Element | Source |
|---|---|
| Icon tile | mapped from `notifications[].type` → 10 MCI icon categories (collapsed from 20 emoji types) |
| Icon tile color tone | mapped from type → semantic group (success / info / conv / danger / neutral) |
| Title | `notifications[].title` |
| Message | `notifications[].body` |
| Timestamp | `notifications[].created_at` → `timeAgo()` formatter (preserved verbatim) |
| Unread state | `notifications[].is_read === false` |
| Tap | `getNavTarget(type, data_json)` switch (all 18 cases preserved) |

## Notifications screen — empty state

| Element | Source |
|---|---|
| `bell-outline` icon | static MCI |
| Title + body copy | static |
| Trigger | `notifications.length === 0 && !error` |

## InfluencerNavigator — 5 tabs

| Tab | MCI icon name | Active tint | Routes |
|---|---|---|---|
| Home | `home-outline` | `P.yellow` | HomeStack (14 screens via stack nav) |
| Offers | `email-outline` | `P.yellow` | OffersStack (11 screens) |
| Campaigns | `briefcase-outline` | `P.yellow` | CampaignsStack (10 screens) |
| Earnings | `currency-inr` | `P.yellow` | EarningsStack (2 screens) |
| Profile | `account-outline` | `P.yellow` | ProfileStack (5 screens) |

## Zero phantom fields

All 23 distinct data points in the mockup trace to existing backend fields or client-side derivations from the already-loaded notifications array. No new column, no new endpoint, no new business rule.
