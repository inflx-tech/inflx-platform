# Spec — Redesign Flow 2 · Dashboard chrome + home (web)

## Why this flow

Most-visited authenticated surface. Sets the topbar + nav pattern that
every other `/dashboard/*` sub-page inherits. Pure visual + UX
redesign + one honest Total-Revenue rewire that reads an existing
backend `summary.total_revenue` field already returned by the same
endpoint the dashboard already calls.

## Scope — in

**Web (2 files restyled)**
- `Packages/brand-web/app/dashboard/layout.js` — topbar chrome (black ink), Logo placeholder (light tone), 12-item NAV (yellow active state), notification bell + badge, avatar, sign out, persistent pending+rejected banners
- `Packages/brand-web/app/dashboard/page.js` — KPI tiles, Action Required panel, Quick Actions, Recent Activity + Recent Campaigns columns. Status banners (Flow 1 work) stay intact.

**Logic change — 1 honest rewire (not a behavioural disturbance)**
- `page.js` line 134 today: `totalRevenue = recentTx.reduce(...)` over only the last 5 transactions — misleading "Total Revenue" label.
- After: `totalRevenue = summary?.total_revenue || 0` where `summary` is `tx.data?.summary` from the same `GET /brands/me/transactions` call. The endpoint already returns `{ transactions, summary: { total_revenue, total_brand_net, ... } }` (backend `brand.controller.js:737-739`). Zero backend / schema / API change.

## Scope — out (no-touch)

- All sub-routes `/dashboard/{campaigns, contracts, products, …}` — they inherit the new chrome automatically but their bodies wait for their own flows
- `/admin/*` and `admin-web` — separate flows
- Mobile (BrandHomeScreen / influencer Home / follower Home are separate flows)
- The 3 status banners in `page.js` lines 156-184 — already shipped in Flow 1
- All API call shapes (`brandApi.getMe`, `walletApi.getBalance`, `campaignApi.list`, `brandApi.get('/brands/me/transactions?limit=5')`, `brandApi.getProducts`, `brandInboxApi.summary`, `notificationApi.list`, `authApi.logout`)
- All `href` targets in the 12-item NAV array (Window A's later Subscription + Billing nav appends slot in additively)
- All form field names (none on this page; mentioned for completeness)
- localStorage keys (`inflx_token`, `inflx_user`, `inflx_brand`)
- Role-routing logic in layout (admin → /admin redirect, non-brand → /login)
- Logout flow (server revoke best-effort, localStorage.clear, cookie clear, redirect to /login)
- Backend, migrations, DB — entirely out of scope (Window A territory)

## Tile audit — every metric traces to a real backend field

| Tile / row | Backend source | Controller |
|---|---|---|
| Action Required · 5 tiles | `inbox.*` from `GET /brands/me/inbox-summary` | `brandInbox.controller.js:142-170` |
| Active campaigns | `campaigns.filter(active\|live).length` derived from `campaignApi.list()` | `campaign.controller.js` |
| Wallet balance | `wallet.wallet_balance` + `escrow_locked` from `walletApi.getBalance()` | `wallet.controller.js:53-65` |
| **Total revenue** | `summary.total_revenue` from `GET /brands/me/transactions` | `brand.controller.js:722-735` (SUM net_amount WHERE status='completed') |
| Listed products | `products.length` from `brandApi.getProducts()` | — |
| Recent activity rows | `tx.data.transactions` (already loaded; same endpoint) | — |
| Recent campaigns rows | `campaigns.slice(0,3)` | — |
| Pending banner | `brand.status === 'pending'` | — |
| Rejected banner | `brand.status === 'rejected'` | — |

No phantom metrics. Every tile is verified-twice backed by a real controller line cited above.

## Design system this flow exercises (re-uses Flow 1 locked palette)

- White `#FFFFFF` · BG `#FAFAFA` · ink `#0A0A0A` · yellow `#FFC107` · success `#10B981` · danger `#E8401A`
- Outfit display · Plus Jakarta Sans body · JetBrains Mono digits
- Logo placeholder component (`Packages/shared/components/Logo.js`) used with `tone="light"` for the dark topbar
- Yellow icon-in-circle pattern for KPI tiles (poster cue)
- Yellow left-stripe accent on the Action Required card
- Black "Quick action" tile with yellow primary "Create campaign"
- Status-pill conventions (success / yellow-pale / danger / muted)

## User-perceptible changes (consciously approved)

1. Topbar background: navy-deep → ink black (matches the brand poster's chrome)
2. Nav active state: white/10 ghost → solid yellow with ink text (the active page reads instantly)
3. Emoji nav icons → minimal symbol glyphs (less playful, more professional). All 12 labels unchanged.
4. Persistent banner copy: "Account pending review" / "Account needs a fix" softening + ETA chip
5. Action Required panel: orange-tinted → white card with yellow left-stripe + "6 pending" mono pill
6. KPI tiles: gain a leading yellow icon-circle; mono digits for amounts
7. **Total Revenue tile now shows the TRUE total** (all-time completed follower transactions), not the sum of the last 5 — this is an honest correction of a pre-existing label/calculation mismatch
8. Quick Actions: gradient buttons → ink tiles + 1 yellow primary
9. Recent Activity row pills: pay_at_store→WALK-IN / prebook→BOOKING / online_order→ORDER / redirect_click→CLICK with semantic-pale backgrounds
10. Recent Campaigns: status badges Live / Pending sign / Draft with status-dot pills
