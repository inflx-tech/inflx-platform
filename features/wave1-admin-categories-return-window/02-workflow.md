# Workflow — wave1-admin-categories-return-window

## Actor
Admin via `/admin/pricing/categories`.

## Preconditions
- M073 applied on prod (`categories.return_window_days` exists).
- This commit shipped + Vercel/Render redeployed.

## Workflow A — admin views categories list

1. Admin opens `/admin/pricing/categories`.
2. Page calls `adminApi.listCategories()` → backend SELECTs all
   columns including `return_window_days`.
3. Table renders 7 columns: Key/Label, Path A %, Path B %,
   Path C %, **Return win (d)**, Active, Actions.
4. Return win column shows `30d` style read-only.

## Workflow B — admin edits a category's return window

1. Admin clicks **Edit** on a row.
2. Row enters edit mode — return window cell becomes a number input.
3. Admin types a value (e.g. `7` for food delivery).
4. Admin clicks **Save**.
5. Client validates 0–365.
6. PATCH `/admin/categories/:categoryKey` with body containing
   `return_window_days: 7` alongside other fields.
7. Backend `update()` includes `return_window_days` in the allowed
   whitelist; UPDATE persists.
8. Wave 3 commerce settlement cron will read this per-category
   when computing `commission_releasable_at`.

## Workflow C — admin creates a new category

1. Clicks **+ Add Category**.
2. Inline form opens with new Ret(d) input (default 30).
3. Fills key/name/label + path % values + return window.
4. Clicks Add.
5. POST `/admin/categories` creates the row with the specified
   return_window_days (or 30 default if blank).

## Success

- pnpm qa 76/76 GREEN.
- Admin can edit per-category return window without DB access.
- Per-category override flows through to pricing.service.getReturnWindowForCategory
  (already shipped in Wave 1 commit 1).

## Failure modes

- Validation: return_window_days outside 0–365 → row Save disabled
  with error label.
- Backend rejects malformed values (column is `int NOT NULL`,
  defaulted 30).
