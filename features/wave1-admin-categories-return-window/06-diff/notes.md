# 06-diff — wave1-admin-categories-return-window

**Before:** the L3 commerce-commission rate admin page
(`/admin/pricing/categories`) had 6 columns: Key/Label, Path A %,
Path B %, Path C %, Active, Actions. Each row could be edited but
no return-window control existed (the global value lived in
payment_config.return_window_days, applied uniformly to every
purchase regardless of category).

**After:** 7 columns. New "Return win (d)" column between Path C and
Active, narrower (col-span-1). Reads from M073's
`categories.return_window_days` (default 30). Editable when row is
in edit mode (number input, validated 0–365 client-side).

The "Add Category" inline form gains a "Ret(d)" input (defaults to
'30'). Backend `categories.controller`:
- list SELECT includes the new column.
- update allowed list accepts `return_window_days`.

**Why this matters now:** Wave 1 commit 1 added
`pricing.service.getReturnWindowForCategory()` which reads per-category.
Wave 3's commerce settlement cron will use it to set
`follower_transactions.commission_releasable_at` per follower
purchase. Without this admin UI, the per-category window could only
be changed via direct SQL.

**Defensive behaviour:** existing rows show `30d` (matches the prior
global default). Admin can edit per-category without affecting
others. Save validates 0–365 — extreme values blocked.

**Verified locally:** pnpm qa 76/76 GREEN (47.3s); backend boot
smoke clean.
