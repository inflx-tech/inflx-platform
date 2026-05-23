# Workflow prediction — Redesign Flow 2 · Dashboard chrome + home

## What the mockup predicts (before implementation)

`mockups/web.html` shows the visual + UX target. Below is what we
predict will be visibly true once the implementation lands at
`/dashboard` for an authenticated brand.

### Topbar / nav
- Black ink chrome strip across the full width
- Logo placeholder dashed box visible on the left
- 12 nav items horizontal; active = yellow filled; inactive = muted grey hover white
- Notification bell + yellow-on-ink badge
- Yellow avatar circle with ink "SR" (or similar last-2 initials)
- Ghost "Sign out" link far right

### Pending banner (when brand status is pending)
- Yellow-pale strip beneath the topbar, full width
- Ink `!` icon-circle + softened body copy + ETA chip

### Body
- Welcome H1 with yellow underline
- Action Required white card with yellow stripe + "6 pending" mono pill
- 4 KPI tiles, each with a yellow icon-circle and mono digit value
- Quick Actions: 1 yellow + 3 ink tiles
- Two-column: Recent Activity (5 rows with type pills) + Recent Campaigns (3 rows with status badges)

### What is NOT being predicted

- Pixel-perfect Outfit/Jakarta/Mono rendering on every browser (varies with font availability)
- The real logo (placeholder until founder uploads asset)
- Window A's future Subscription + Billing nav additions (different flow, additive only)
- Any responsive breakpoint changes outside the standard mobile/tablet/desktop grids
- KPI animation / hover micro-interactions beyond a subtle lift

### How implementation maps to mockup

| Mockup section | Real source file | Implementation note |
|---|---|---|
| Topbar | `Packages/brand-web/app/dashboard/layout.js` lines 80-115 | replace navy classes with arbitrary `#0A0A0A` / `#FFC107` etc.; preserve NAV array verbatim |
| Pending strip | `layout.js` lines 117-133 | swap amber/red Tailwind classes for `#FFF7CC` / `#FDEEE9`; replace ⏳ ❌ emoji with SVG icons |
| Welcome header | `page.js` lines 144-153 | bigger H1, add yellow rule, keep date logic |
| Status banners | `page.js` lines 156-184 | UNTOUCHED — already shipped in Flow 1 |
| Action Required | `page.js` lines 188-222 | white card + yellow left-stripe + danger-pale failure tiles |
| KPI tiles | `page.js` lines 225-258 | yellow icon-in-circle + mono digits; rewire Total Revenue to `summary?.total_revenue` |
| Quick Actions | `page.js` lines 261-276 | 3 ink tiles + 1 yellow primary |
| Recent Activity | `page.js` lines 281-297 | restyled rows with type pills + mono amounts |
| Recent Campaigns | `page.js` lines 300-316 | restyled rows with status badges |

### Verifiable predictions for the diff stage

After implementation, every Backend Source column in the audit table
(see `01-spec.md` "Tile audit") must render with real data when
viewed against a seeded local dev DB. No phantom tiles, no
"loading…" stuck states.
