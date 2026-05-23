# 06-diff · Redesign Flow 2 · Dashboard chrome + home

> Honest comparison of what actually shipped vs the mockup in
> `04-preview/mockups/web.html`.

## What shipped — web

### `layout.js` (topbar + nav + persistent banners)
**Matches the mockup:**
- Ink black `#0A0A0A` topbar, 64px height, sticky
- Logo placeholder via `<Logo tone="light" size="sm" />` (light variant for dark chrome)
- 12-item nav with active state = yellow `#FFC107` filled with ink text (instant page-pin)
- Non-active nav: muted grey, hover white + `#2A2A2D` bg
- Emoji nav icons (🏠📣📝⭐🏪🍽️📅🖼️📨💰🏦👤) → minimal symbol glyphs (⌂⊟≡★▤◉▦▢✉₹◫◉) — same 12 labels, less playful
- Notification bell + yellow-on-ink mono badge (max "9+")
- Yellow circle avatar with ink mono initials (last-2-of-phone, current convention)
- Ghost "Sign out" link — muted hover white
- Pending banner: yellow-pale `#FFF7CC` + ink `!` icon-circle + ETA chip on ink ("ETA &lt; 24h")
- Rejected banner: danger-pale `#FDEEE9` + danger `!` icon + dotted-underline link to Profile

**Differences from mockup:**
- Logo placeholder behaviour: dashed `[LOGO]` box renders until founder uploads asset (intentional, encapsulated in `<Logo />`)

### `page.js` (home body)
**Matches the mockup:**
- Welcome header: date crumb + larger Outfit H1 + yellow rule underneath
- Account status banners (Flow 1) UNTOUCHED — re-used verbatim
- Action Required: white card with yellow left-stripe, "N pending" mono pill, ink/grey tiles + danger-pale tiles for the two `*_failed` states
- 4 KPI tiles: yellow icon-in-circle + mono digit value + muted sub
- Quick Actions: 1 yellow primary "Create campaign" + 3 ink tiles, each with corner-bleed circle accent and `→` glyph
- Recent Activity rows: type pill (WALK-IN / BOOKING / ORDER / CLICK) with semantic-pale bgs + mono amount in success-green for money-in (or `—` for clicks)
- Recent Campaigns rows: status badge with dot (Live / Pending sign / Draft / etc.)
- Empty-states: soft muted card with link to next action

**The honest Total Revenue rewire:**
- Before: `totalRevenue = recentTx.reduce((sum, tx) => sum + (tx.amount || 0), 0)` over only the 5 loaded transactions — label said "Total Revenue" but math was "sum of last 5".
- After: `totalRevenue = summary?.total_revenue || 0` — reads the existing `summary` block from `tx.data.summary.total_revenue` that the backend already returns from the same `GET /brands/me/transactions` call. Backend SQL `brand.controller.js:722-735` = `SUM(ft.net_amount) WHERE status='completed'`.
- Zero backend / API / schema change. Frontend was already ignoring `.summary` — now it reads it. New state var `summary` added (parallel to existing `transactions`).
- Sub-copy changed from "From follower transactions" → "All completed follower transactions" — matches the true semantic.

**Differences from mockup:** None functional. Pixel-perfect Outfit/Mono rendering varies by browser font availability.

## Functional preservation — verified file-by-file post-edit

- All 6 parallel API calls preserved: `brandApi.getMe`, `walletApi.getBalance`, `campaignApi.list`, `brandApi.get('/brands/me/transactions?limit=5')`, `brandApi.getProducts`, `brandInboxApi.summary().catch(...)`
- 12-item NAV array preserved verbatim (label + href; icon character changed glyph-only)
- localStorage keys preserved (`inflx_token`, `inflx_user`, `inflx_brand`)
- Cookie set-and-clear semantics preserved
- Logout flow preserved (`authApi.logout` best-effort → `localStorage.clear()` → cookie clear → `/login`)
- Role-routing preserved (admin → `/admin`, non-brand → `/login`)
- All `href` targets unchanged
- Loading state preserved (just restyled copy "Loading dashboard…")
- Status-banner rendering (lines 156-184 in old file) preserved as Flow 1 ship — visual unchanged from cca6cf2
- `fmtMoney` / `fmtRupees` imports preserved
- `tryRefreshToken` retry-on-cold-start preserved
- All `useEffect` deps preserved

## QA gate evidence

`pnpm qa` (2026-05-23, post-Flow-2 implementation):

```
67 passed (1.5m)
[qa-report] STATE=GREEN — all reconciliation checks passed
[run-qa] Done. pwExit=0 reportExit=0 → gate 0 (0 = all workflows truly passed).
```

- All 67 specs GREEN · gate 0 · STATE=GREEN
- C1 verdict machine clean (pwExit=0, reportExit=0, no escalations)
- `qa/web/brand/auth.spec.ts:66` PASSED (Flow 1 copy assertions intact)
- `qa/web/brand/meals-setup.spec.ts:67` PASSED — zero Meals regression
- No spec asserts on changed dashboard copy → no re-baseline needed
- No spec skipped, no assertion weakened, no test deleted
- Report → `qa/reports/2026-05-23T12-35-27-635Z/QA-REPORT.md`

## Honest limitations

- **Total Revenue uses bigint cast.** Backend SQL: `COALESCE(SUM(ft.net_amount), 0)::bigint`. If individual transactions have fractional rupees, the integer-cast sum truncates the decimal portion. This is the same behaviour as today's misleading reduce — not a Flow 2 regression. Worth a future fix in a separate contract if precision matters.
- **No animation.** Hover lift on KPI tiles is a 2px translate; no spring animations, no skeleton loaders. Loading state is the legacy "Loading dashboard…" text.
- **Logo is placeholder.** Real artwork ships when the founder uploads to `Packages/shared/assets/logo/`. `<Logo />` component handles the swap behind the scenes — no call-site changes.
- **Tailwind tokens not consolidated.** Locked palette inlined as arbitrary values (`bg-[#FFC107]`, etc.). A future token-consolidation contract hoists into `tailwind.config.js` once more flows have shipped.
- **No new Maestro flow.** Flow 2 is web-only — no mobile changes — so Rule 5 doesn't fire. The Maestro auth-flow gap from Flow 1 is still open (deferred).
