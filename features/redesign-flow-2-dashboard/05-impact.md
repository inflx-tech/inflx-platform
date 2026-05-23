# Impact — Redesign Flow 2 · Dashboard chrome + home

## Verdict

**Zero functional / backend / logic / DB impact — visual + UX only.**

The one frontend rewire (Total Revenue from `summary.total_revenue`)
reads a field the backend already returns from the same endpoint
already called. No new API, no schema change, no DB query change, no
behavioural change for non-Total-Revenue tiles. Documented honest
correction of a pre-existing label/calc mismatch.

## Files touched (2)

### Web (2)
- `Packages/brand-web/app/dashboard/layout.js` — restyle (topbar / nav / persistent banners). Preserve all logic, hrefs, NAV array.
- `Packages/brand-web/app/dashboard/page.js` — restyle KPIs / Action Required / Quick Actions / Recent Activity / Recent Campaigns. Status banners (lines 156-184) UNTOUCHED — Flow 1 work. Add `summary` state + rewire `totalRevenue` to `summary?.total_revenue || 0`.

### Logo component
- `Packages/shared/components/Logo.js` — REUSED unchanged from Flow 1 (uses `tone="light" size="sm"` for the dark topbar).

### Backend / DB / mobile / shared API / contracts
- **NOTHING touched.** No backend file, no migration, no schema, no SQL, no API contract, no mobile, no shared API client.

## NO-TOUCH (preserved exactly)

- `backend/**` (Window A territory)
- All API call shapes (`brandApi.getMe`, `walletApi.getBalance`, `campaignApi.list`, `brandApi.get('/brands/me/transactions?limit=5')`, `brandApi.getProducts`, `brandInboxApi.summary`, `notificationApi.list`, `authApi.logout`, `tryRefreshToken`)
- 12-item NAV array (Window A's later "Subscription" + "Billing" appends slot in additively, same shape)
- All href targets
- localStorage keys (`inflx_token`, `inflx_user`, `inflx_brand`)
- Role-routing logic in layout
- Logout flow
- `fmtMoney` / `fmtRupees` helpers
- Sub-route content beyond layout chrome inheritance
- Mobile (entirely out of scope)
- Status banners on dashboard home (Flow 1 work)

## Window A coordination

LOW. Window A is in revenue/billing backend phases (A6+A8 already shipped). They don't touch dashboard layout/page UI. The NAV array's future "Subscription" + "Billing" appends are append-only and orthogonal to the restyle.

## Regression risk

LOW (visual + 1 honest read-more-from-existing-response).
- `pnpm qa` 67/67 must hold; verified no Playwright spec asserts on dashboard copy (`Welcome back`, `Action Required`, KPI labels) so no test re-baseline expected.
- Total Revenue rewire reads `tx.data.summary.total_revenue` — backend already returns it (`brand.controller.js:722-735`); no edge case where it's absent for an authenticated brand (defensive `|| 0` covers null response).

## Deploy classification — PRODUCTION-IMPACTING (web only)

- `git push origin main` → Vercel auto-deploys `brand-web`. Live for all authenticated brands.
- **No mobile / no OTA** — Flow 2 is web only. `Packages/Mobile/src/**` untouched, so Rule 5 doesn't fire.

Rollback: `git revert` the Flow-2 commits.

## Time estimate

~2-3h focused work (smaller than Flow 1 — only 2 files + Logo reuse).
