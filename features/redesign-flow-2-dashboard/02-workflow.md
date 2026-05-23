# Workflow — Redesign Flow 2 · Dashboard chrome + home

> No new workflows. This contract restyles existing flows. The
> workflow assertions below are the *current* assertions that must
> still pass post-restyle — proving zero functional disturbance.

## Actor
Authenticated brand on `brand-web` lands on `/dashboard`.

## Preconditions
- Brand JWT in localStorage (`inflx_token`)
- Brand profile in localStorage (`inflx_brand`)
- Backend reachable

## Workflow steps (user-observable, unchanged)

### Layout chrome
1. Page loads → topbar visible with Logo placeholder + 12-item nav + bell + avatar + Sign out
2. Active page nav item highlighted (yellow with ink text)
3. Nav links navigate to their `href` targets — every link's destination preserved
4. Notification bell shows badge when `unreadCount > 0` (max "9+")
5. Avatar shows last-2-of-phone initials
6. Sign out → `authApi.logout()` best-effort → `localStorage.clear()` → cookie clear → `router.push('/login')`
7. If `brand.status === 'pending'` → persistent yellow-pale banner with clock icon + ETA chip
8. If `brand.status === 'rejected'` → persistent danger-pale banner with link to profile
9. Admin landing on `/dashboard` by accident → bounced to `/admin`
10. Non-brand non-admin → bounced to `/login`

### Dashboard home body
1. Loading state shows briefly ("Loading dashboard...")
2. Data loads in parallel: brand, wallet, campaigns, transactions (+summary), products, inbox
3. Welcome header: "Welcome back, {brand.business_name}" + date
4. Status banners (Flow 1): pending / rejected / approved tag per `brand.status`
5. Action Required panel: shows only when `inbox && (sum of inbox.* > 0)`. Tiles link to `/dashboard/inbox?tab=*` — every href preserved.
6. 4 KPI tiles: Active campaigns / Wallet balance / **Total revenue (rewired)** / Listed products
7. Quick Actions: 4 tiles — Create campaign / Browse influencers / Manage listings / View wallet — every href preserved
8. Recent Activity: shows `tx.data.transactions.slice(0,5)` rows, or empty-state link to start
9. Recent Campaigns: shows `campaigns.slice(0,3)`, or empty-state link to create

## Success definition

Every step above produces the same end state as today. `pnpm qa` =
67/67 GREEN. `total_revenue` displays the SUM(net_amount) where
status='completed' from `summary.total_revenue` (not the sum of last
5 transactions).

## Failure / edge workflows (unchanged from current)

- Any of the 6 parallel API calls fails → that section shows empty / 0 / null state but page does not crash
- Inbox call fails → Action Required hidden (cleanly degrades; current behaviour via `.catch(() => ({success: false}))`)
- Brand profile not yet loaded → "Welcome back" without business_name suffix (current behaviour)
- Auth missing → router pushes /login before any data fetch (current behaviour)
