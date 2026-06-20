# 06 — Implementation / diff notes (Wave-1 Quick Wins)

These are bug-fixes, not a redesign — there are **no new mockups**. The UI-governed
touches are: (A-2) removal of a legacy element, and (E-5) a single CSS property. Both
visual changes were approved by the founder in-session. This note stands in for the
diff/notes gate.

## What was implemented
- **A-1** `app/login/page.js:138` — `max-age=900` → `max-age=2592000`. Verified all three
  cookie writers (login, app/page.js, dashboard/layout.js) now agree on 30 days.
- **A-2** `app/page.js` — removed the embedded brand phone/OTP/register widget and the
  `#auth-section`; the 5 auth CTAs (2 navbar, 2 hero, 1 replacement) now `router.push('/login')`.
  Removed now-unused state/handlers/imports (verified zero dangling references). Marketing
  hero / how-it-works / for-brands / for-influencers / categories / stats / footer unchanged.
  Influencer "Download the App" CTA retained.
- **B-3 / G-1** `paymentConfig.service.js` + `admin.controller.js` — 12 fields
  (GST/TCS/identity/invoice-prefixes/T3-day+time) added to the SELECT, the mapped object,
  the env fallback, the updateConfig allow-list, and the controller destructure/pass-through.
  camelCase names verified against `tax.service.js`; snake_case verified against migrations
  072 + 074.
- **C-1** `admin.routes.js` — mounted GET (any admin) + POST/PATCH/DELETE (superadmin)
  `/categories` on the existing `categories.controller`; param `:categoryKey` and the
  frontend `lib/api.js` paths verified to match.
- **E-5** `gallery/page.js:166` — `object-fit:cover` → `contain`; container already provides
  centered, gradient-backed letterboxing so the grid stays tidy.

## What matches the spec
All 5 fixes match `01-spec.md` / `02-workflow.md`. Reviewer pass (independent agent) found
no build-breaking or behavioral defects across all 6 files. `pnpm qa` = 79 passed, STATE=GREEN.

## What diverged
Nothing material. Note for awareness: the gallery `reviews` page referenced as the
`object-fit:contain` precedent does not literally contain that rule today, but `contain`
is independently correct for the crop fix.

## What to check after deploy
- Log into the web app, wait >15 min, navigate → confirm no logout (A-1).
- Homepage Sign-in/Get-started → `/login` (A-2).
- Admin → Payment Config: edit GST + T3 days, Save, reload → values persist (B-3/G-1).
- Admin → Pricing → Marketplace Categories (L3): screen loads, edit a row (C-1).
- Gallery: images fully visible (E-5).
