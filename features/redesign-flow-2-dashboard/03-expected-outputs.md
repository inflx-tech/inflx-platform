# Expected Outputs — Redesign Flow 2 · Dashboard chrome + home

## Post-implementation, every assertion below must be true.

### Layout chrome
- Topbar bg `#0A0A0A` (ink), height 64px, sticky top
- Logo renders via `<Logo tone="light" size="sm" />` → dashed placeholder until founder uploads asset
- 12 nav items in the original NAV array order; active item bg `#FFC107` with ink text
- Notification bell shows badge `#FFC107` with ink text when `unreadCount > 0`; max display "9+"
- Avatar: 36×36 yellow circle with ink last-2-of-phone initials
- Sign-out ghost button — `text-[#71717A]` muted, hover white
- Persistent pending banner (when `brand.status === 'pending'`): yellow-pale `#FFF7CC` with ink `!` icon-circle + ETA chip
- Persistent rejected banner (when `brand.status === 'rejected'`): danger-pale `#FDEEE9` with danger `!` icon + link to `/dashboard/profile`

### Welcome header
- Greeting line in mono small uppercase (date)
- H1 "Welcome back, {brand.business_name}" Outfit 700
- Yellow rule underneath
- Sub-headline in muted body

### Status banners (Flow 1 — preserved, untouched)
- Account-pending / Account-rejected / Verified-account states unchanged from Flow 1's render

### Action Required panel
- Renders only when `inbox && (pending_negotiations + pending_reviews + pending_signatures + contracts_failed + pdf_failed) > 0`
- White card with `#FFC107` left-stripe
- Title row: "Action Required" + mono pill showing total pending count
- 5 tiles: Negotiations / Content reviews / Contract signs / Contract failed / PDF failed (failures use danger-pale bg)
- Each tile links to `/dashboard/inbox?tab=*` (unchanged hrefs)

### 4 KPI tiles
- Each tile: yellow icon-in-circle (40×40), label uppercase mono small, mono digit value (large), muted sub-text
- Active campaigns · value = `campaigns.filter(c=>['active','live'].includes(c.status)).length`
- Wallet balance · value = `fmtRupees(wallet.wallet_balance)` · sub shows escrow_locked when > 0
- **Total revenue · value = `fmtRupees(summary?.total_revenue || 0)`** · sub "All completed follower transactions"
- Listed products · value = `products.length` · sub "In your catalogue"
- All 4 tiles link to their respective sub-routes (unchanged hrefs)

### Quick Actions row
- 4 tiles in a grid
- 1 yellow primary (`#FFC107`, ink text) — "Create campaign" — links to `/dashboard/campaigns/new`
- 3 ink tiles (`#0A0A0A` bg, white text, yellow corner-bleed accent) — Browse influencers / Manage listings / View wallet

### Recent Activity column
- Header "Recent activity" + "View all →" link to `/dashboard/conversions`
- Up to 5 rows from `tx.data.transactions`
- Each row: type pill (WALK-IN / BOOKING / ORDER / CLICK) + customer name + meta + mono amount in success-deep
- Empty-state: muted card with link to track first transaction

### Recent Campaigns column
- Header "Recent campaigns" + "View all →" link to `/dashboard/campaigns`
- Up to 3 rows from `campaigns.slice(0,3)`
- Each row: campaign name + meta (date range + budget in mono) + status badge (Live / Pending sign / Draft etc.)
- Empty-state: muted card with link to create first campaign

### QA gate
- `pnpm qa` = **67/67 PASSED · gate 0 · STATE=GREEN · pwExit=0 reportExit=0**
- No spec asserts on changed dashboard copy; all current dashboard-touching specs continue to pass

### Visual diff
- Before/after PNGs captured in `qa/artifacts/diff/redesign-flow-2-dashboard/{before,after}/` (if pipeline wired)
- `06-diff/notes.md` summarises what shipped vs the mockup

### Governance gates (gov-check)
- Rule 1 (approved contract) ✓
- Rule 2 (release evidence at flip) — populated `release.deploy` with Vercel commit hash
- Rule 3 (mockup_locked) ✓
- Rule 4 (06-diff/notes.md non-empty) ✓
- Rule 5 (Maestro green) — does NOT fire (Flow 2 = web only, no `Packages/Mobile/src/**` touched)

### Functional preservation
- Every API call from §02 preserved exactly (same endpoints, same params, same response shape consumed)
- `brand.controller.js:722-735` summary block already returned by `GET /brands/me/transactions` — Total Revenue rewire reads an existing field
- All href targets unchanged
- 12-item NAV array preserved exactly (Window A's later appends additive)
- localStorage / cookie semantics unchanged
- Sign-out + redirect tree unchanged
- Loading state preserved
- Empty-state copy preserved (with minor softening if needed)
