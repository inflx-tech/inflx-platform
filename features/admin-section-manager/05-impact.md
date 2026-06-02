# Impact — Admin Section Manager (Phase B)

## One-line verdict
**Additive admin-only control surface.** New admin endpoints + a new admin-web
page over the existing `section_config`. No migration, no mobile, no change to any
existing endpoint or page. The only runtime effect is that admins can now edit
shelves that previously required SQL.

## Release classification
- Contract docs/mockups: **deploy-inert**.
- Backend (`backend/src`) + admin-web (`Packages/admin-web`): **production-
  impacting** — `git push` → Render + Vercel auto-deploy. Surfaced for explicit
  founder go. **No OTA, no mobile, no Window-B coupling** (Window B works mobile
  + agency; this is backend admin + admin-web).

## What changes
- New: `adminSections.controller.js`, `adminSections.routes.js`, one mount line,
  `admin-web/app/dashboard/sections/page.js`; `sectionApi` added to
  `admin-web/lib/api.js`.
- Edited: `routes/index.js` (one `router.use` line), `admin-web/lib/api.js`
  (additive export). No existing handler/page altered.

## What is NOT disturbed
- The follower feed endpoints (read the same table; unaffected), all other admin
  endpoints/pages, brand/mobile apps, migrations.
- Phase A/C work — independent.

## Risks + mitigations
- **Bad edit blanks a screen** → the follower engine already degrades gracefully
  (empty/omitted shelves never 500); PUT is transactional (all-or-nothing);
  global defaults remain as the seeded baseline; DELETE is explicit.
- **Cache staleness across instances** → ≤ TTL (≤60s) convergence; handling
  instance busts immediately. Documented, acceptable.
- **Auth** → `requireAnyAdminRole` on every route; GET/PUT/DELETE all gated.

## Parallel-window git hygiene
Touches ONLY: `features/admin-section-manager/**`,
`backend/src/controllers/adminSections.controller.js`,
`backend/src/routes/adminSections.routes.js`, `backend/src/routes/index.js`
(one line), `backend/tests/admin-sections.test.js`,
`Packages/admin-web/app/dashboard/sections/page.js`,
`Packages/admin-web/lib/api.js`. Stage by path; never `git add -A`; do not branch.
