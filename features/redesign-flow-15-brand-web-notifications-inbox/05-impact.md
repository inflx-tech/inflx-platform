# Flow 15 · impact

**Terse verdict:** zero functional / backend / logic / DB impact — visual + UX only.

---

## Files touched

| File | Action | LOC delta |
|---|---|---:|
| `Packages/brand-web/app/dashboard/notifications/page.js` | full rewrite | 73 → ~220 |
| `Packages/brand-web/app/dashboard/inbox/page.js` | full rewrite | 269 → ~520 |
| `design/wave2/flow-15-brand-web-notifications-inbox/web.html` | new | +626 |
| `features/redesign-flow-15.../01-05` + lock.json + 06-diff | new | +600 |

## NO-TOUCH preserved

- `backend/**` — zero changes
- `Packages/brand-web/lib/api.js` — zero changes
- All API call shapes frozen
- alert/confirm dialogs preserved (out of scope to replace)
- URL `?tab=` schema preserved
- Suspense wrapper for useSearchParams preserved

## What changes (UX + visual)

### Notifications
- Underlined section list → row cards with type-colored avatars + relative dates
- `bg-navy-pale/30` unread bg → `yellow-50` with yellow border + yellow dot
- Hard-coded gray "Mark all read" → yellow CTA
- Count display: "N unread" inline → yellow/ink mono count chip in header

### Inbox
- Underline tabs with orange → INK sub-tab pills with per-tab mono counts (from summary endpoint)
- Application cards: dual approve/reject buttons preserved · color-mapped to palette (reject=danger-pale, approve=ink+yellow)
- Negotiations/Reviews rows: navy-to-orange chevron → yellow chevron · palette focus
- Signatures placeholder: white card with text → success-bordered info card with count chip
- Failures: 2 white cards with bold counts → 2 palette-bordered info cards (warn + danger) with mono count badges
- Loading: gray "Loading..." → palette spinner pattern
- Empty: gray "Nothing waiting" → mono caption

## NEW intel surfaced (already-loaded)
- Notifications header: unread + total split (was just unread inline)
- Inbox header: total items-waiting count chip (from summary endpoint sum)
- Per-tab counts in sub-tab pills (from summary endpoint)
- Notification type → palette-colored avatar

## Adjacent-fixes
- Undefined Tailwind tokens (`text-t1/t2/t3`, `text-orange`, `bg-surface2`, `bg-navy-pale`, `text-navy`) → palette CSS vars
- Loading + empty state pattern aligned with Flows 11-14
- Hover/focus styles consistent palette

## Deploy class
**production-impacting** — `git push origin main` → Vercel auto-deploys brand-web. Web-only · `release.maestro_green = "n/a"`. Surface for explicit go after `pnpm qa` 75/75 GREEN.
