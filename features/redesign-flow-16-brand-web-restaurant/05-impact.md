# Flow 16 · impact

**Terse verdict:** zero functional / backend / logic / DB impact — visual + UX only.

---

## Files touched

| File | Action | LOC delta |
|---|---|---:|
| `Packages/brand-web/app/dashboard/meals/page.js` | full rewrite | 484 → ~700 |
| `Packages/brand-web/app/dashboard/orders/page.js` | full rewrite | 221 → ~340 |
| `Packages/brand-web/app/dashboard/bookings/page.js` | preserved | 14 (unchanged) |
| `Packages/brand-web/app/dashboard/bookings/components/BookingsInbox.js` | full rewrite | 317 → ~550 |
| `Packages/brand-web/app/dashboard/enquiries/page.js` | full rewrite | 87 → ~230 |
| `design/wave2/flow-16.../web.html` | new mockup | +935 |
| `features/redesign-flow-16.../01-05` + `06-diff` + `lock.json` | new artifacts | +700 |

## NO-TOUCH preserved

- `backend/**` — zero changes
- `Packages/brand-web/lib/api.js` — zero changes
- `Packages/brand-web/app/dashboard/layout.js` — zero changes
- `Packages/brand-web/app/dashboard/bookings/page.js` — preserved (14-LOC thin wrapper)
- All API call shapes, all mutation bodies, all AI restaurant-chat behavior — frozen
- alert/confirm/prompt dialogs — frozen

## What changes (UX + visual)

### Meals
- Underline tabs → INK 2-tab pills
- AI suggestions card: `bg-orange/5 border-orange/30` → yellow-pale gradient palette card
- Party-size chips: `bg-navy-deep text-white` active → ink+yellow palette
- Offer cards: green ring on accepted → success border palette + offer-status badge palette
- Sidebar DiscountClock + Limits: gray cards → palette side-cards
- Create-by-chat: pink-700 borders/text → yellow-dashed border + ink+yellow CTA + ink chat thread

### Orders
- Multi-color summary grid → INK 3-KPI hero
- Multi-color channel grid → 3 ch-cards with clickable filter pattern (Flow 11 pattern)
- Pill type filter → status filter chips (5-chip)
- Old type+status mixed in one row → row cards with palette badge + mono prices + status pills + inline expand

### Bookings
- Custom Tailwind tokens (paper-surface, yellow-pale, ink-1/2/3, font-display, font-mono) → locked palette CSS vars
- Yellow chip tabs → INK sub-tab pills
- Booking card: gray border + amber/teal/red pills → palette status pills + date-badge restyled
- Creator attribution: teal-pale pill → success-pale palette pill
- Confirm: bg-teal → ink+yellow · Reject: red outline → danger outline

### Enquiries
- Grid table layout → compact row cards (Flow 11 Conversions Enquiries pattern)
- Modal detail → inline expand
- Dead status colors (new/contacted) → canonical (submitted/responded/converted/closed)
- Send response NEW button (preserved as placeholder per Flow 11 pattern)

### Cross-cutting
- All numbers / amounts / dates / IDs in JetBrains Mono
- All hover/disabled CSS scoped per-route
- 4 wrapper scopes: `.ml`, `.ord`, `.bk`, `.enq`

## NEW intel (already-loaded)
- /meals Setup: party chip counts (was just labels)
- /meals Today: capacity % derived in progress card
- /bookings: tab counts where stats provides them
- /enquiries: status filter chips with counts (Flow 11 pattern brought here)

## Adjacent-fixes
- /enquiries: dead `new`/`contacted` status colors → canonical statuses (already fixed in Flow 11 for Conversions)
- /bookings: custom Tailwind tokens → palette vars
- All routes: loading skeletons → palette spinner

## Notes (informational, not actions)
- /orders duplicates Conversions Orders tab (Flow 11). Kept for backward compat.
- /enquiries duplicates Conversions Enquiries tab (Flow 11). Kept for backward compat.
- Recommend future cleanup flow to deprecate or pivot these to deep links.

## Deploy class
**production-impacting** — `git push origin main` → Vercel auto-deploys brand-web. Web-only · `release.maestro_green = "n/a"`.
