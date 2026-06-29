# Expected outputs — follower-page-builder

## Backend (verified by pnpm qa + DB checks)
- Migration NNN applies cleanly: `follower_pages` table exists; `section_config.screen`
  CHECK accepts `'page'` and still rejects garbage.
- `POST /v1/admin/pages {label}` → 201, row with derived unique `key`, `enabled=true`.
- `GET /v1/admin/pages` → list of pages (admin capability `sections`).
- `PATCH /v1/admin/pages/:id {label?,title?,enabled?}` → updates; `DELETE` → removes
  the registry row (its section_config rows are orphaned-safe, resolve to empty).
- `PUT /v1/admin/sections/page` with `scope_value='<key>'` upserts that page's stack.
- `GET /v1/follower/page/:key/sections` → `{ sections:[…] }` in the same shape as
  `/follower/home`; unknown/disabled key → `{ sections: [] }` (200, not 500).
- `tap_destination` round-trips: saved via `PUT /admin/sections/:screen`, returned
  on `GET`, and present as `section.config.tap_destination` in every follower read
  endpoint.
- **pnpm qa GREEN 79 holds** (no regression); new endpoints covered by qa/features
  contract tests where the harness supports them.

## Admin (brand-web)
- `/admin/custom-pages`: create a page (label→key), see it listed, rename, toggle
  enabled, delete. Create modal validates non-empty label + unique key.
- `/admin/sections`: a 4th scope tab **"Custom page"** with a page dropdown; selecting
  a page loads/saves its section stack via the existing composer.
- Section config editor shows **"On tap, go to…"** with Default / Product grid /
  Category browser / A page; conditional sub-picker appears for Category (node) and
  A page (page dropdown). Publish persists the choice.

## Mobile (OTA, no APK)
- Tapping a section's See-all / Frame banner honors `tap_destination`:
  grid → SectionResults, category → CategoryBrowser, page → FollowerPage, default → today's route.
- `FollowerPageScreen` renders any enabled page's stack via `<SectionRenderer>`,
  with a header (title/subtitle) and back nav; empty/disabled page → friendly empty state.
- Individual cards' detail navigation unchanged.
- babel-check passes on changed files; `npx jest` 25/25 (FollowerWallet baseline fail ignored).

## Acceptance (founder walk)
- Admin creates "Summer Sale", composes 2–3 sections, points a Home section's tap at it.
- Follower taps that Home section → lands on the Summer Sale page rendering the composed
  stack. Taps a product card there → PDP. Back → Home.
- A section pointed at "Category browser" opens the left-rail browser; one pointed at
  "Product grid" opens the full grid. A section left "Default" behaves as before.
