# Workflow — Admin Section Manager (Phase B)

## Build sequence
1. Backend `adminSections.controller.js` — `listSections`, `saveSections` (PUT,
   transactional upsert + cache bust), `deleteSection`.
2. `adminSections.routes.js` — `requireAnyAdminRole`; mount `/admin/sections` in
   `routes/index.js`.
3. API tests `backend/tests/admin-sections.test.js` — auth gate (401/403),
   GET shelves, PUT upsert (toggle/count/reorder/type), DELETE, validation.
4. admin-web `lib/api.js` `sectionApi` (getSections/saveSections/deleteSection).
5. admin-web `/dashboard/sections/page.js` — screen tabs + scope + per-shelf
   controls + Publish.

## Verification
- `pnpm qa` GREEN (web Playwright; backend additive — zero regression).
- Admin API tests green (direct-SQL fixtures where the seed is needed, per the
  known truncateAll/tier-CASCADE harness caveat).
- admin-web: `next build` (or lint) on the new page compiles.
- Manual: GET → edit → PUT → re-GET reflects; follower `/home` reflects within TTL.

## Release classification
- Contract docs/mockups: **deploy-inert**.
- Backend endpoints + admin-web page: **production-impacting** — `git push` →
  Render (backend) + Vercel (admin-web) auto-deploy. Admin-only surface, additive,
  no migration. Surfaced for **explicit founder go** before push. No OTA, no
  mobile, no Window-B coupling.
