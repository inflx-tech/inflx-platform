# Impact Analysis — Section analytics + city scope (P5)

> One-line verdict: **additive third merge layer + brand-new event capture —
> no existing payload, rule, or section changes; analytics counts start from
> zero honestly.**

## Affected files
- backend: `migrations/125_section_events.sql` + `scripts/run-125.js`;
  `sectionEngine.service.js` (loadConfig city layer);
  `follower.controller.js` + `follower.routes.js` (POST section-event);
  `adminSections.controller.js` + `adminSections.routes.js` (GET analytics).
- web: `admin/sections/page.js` (city-override input + 📊 panel), `lib/api.js`.
- mobile: `SectionRenderer.js` (fire-and-forget emit on tap/see-all).

## Risk notes
- City layer: when no city rows exist (today: zero), merge output is
  byte-identical — verified by payload compare in e2e.
- Event write is optional-auth + always-204: no new failure surface for the
  app; junk simply isn't stored.
- Emit is wrapped in try/catch + .catch(() => {}) — a dead endpoint cannot
  affect rendering or navigation.
- Rollback: revert code; table remains (harmless, empty or historical).

## Release classification
**production-impacting**: Render (migration + endpoints + engine) + Vercel
(builder UI) + **OTA** (emit; Mobile-governed → founder's recorded override,
same as P3, no device available). Founder pre-authorized P4+P5 completion.
