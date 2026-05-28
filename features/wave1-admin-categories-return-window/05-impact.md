# Impact — wave1-admin-categories-return-window

## Changes
- `backend/src/controllers/categories.controller.js` — list SELECT
  + update allowed list extended (2 small touches).
- `Packages/brand-web/app/admin/pricing/categories/page.js` — new
  column + form fields + validation (~30 LOC added).
- 1 contract folder.

## Blast radius
- `/admin/pricing/categories` page only. No other UI affected.
- API contract: one additional field in the categories list response
  + the PATCH endpoint accepts one more optional field.

## Rollback
Revert this commit. Page reverts to 6-column layout. Backend stops
surfacing return_window_days in the list response (but the column
remains in the DB; Wave 1 commit 1's pricing.service.getReturnWindowForCategory
still reads it).

## Risks
- **None functional.** Categories editor remains the same with one
  extra column.
- **No regression for pnpm qa** — none of the existing 76 specs hit
  `/admin/pricing/categories`.

## Pre-push checklist
1. pnpm qa main lane GREEN.
2. Backend boot smoke clean.
3. gov-check exit 0.
