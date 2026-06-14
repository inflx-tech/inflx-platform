# Workflow Definition — Follower Category admin

> Step 3. Each numbered step becomes an assertion in the QA workflow test.

## Actor
(A) logged-in **admin** (`requireAnyAdminRole`); (B) **follower** hitting `GET /follower/categories` (output must stay identical to pre-deploy until an admin edits).

## Preconditions
- Migration applied + seeded: `follower_categories` holds the 7 current tiles (eat/shop/groom/fitness/travel/home/events) with their labels, icons, and member lists.

## Workflow steps (user-observable)
1. **Follower** opens the Find screen → `GET /follower/categories` returns the same 7 tiles, same order, same icons as before the deploy (seed parity). → behaviour-preserving.
2. **Admin** opens **Follower Categories**, sees the 7 tiles in order, each with label / icon / status / member businesses.
3. **Admin** adds a tile **"Pets"** (icon 🐾, members `['pet_shop','pet_grooming']`, sort_order after Home) → saved, Active.
4. **Admin** reorders **"Events"** above **"Home"** (edit sort_order) → list re-orders.
5. **Admin** **hides** "Stay Fit" → it leaves the follower list; re-fetch `GET /follower/categories` no longer includes it; brands in those businesses are untouched.
6. **Admin** renames "Eat" → "Food & Drink" + swaps icon → follower list reflects the new label/icon on next fetch.

## Success definition
- Pre-edit `GET /follower/categories` output is **identical** to the pre-deploy hardcoded output (seed parity), AND
- admin add/edit/reorder/hide changes are reflected in the follower endpoint, AND
- with the table emptied/unreachable, `getSuperCategories()` falls back to the constant (no empty category screen).

## Failure / edge workflows
- Empty/failed table query → follower endpoint still returns the hardcoded 7 (fallback), no error surfaced to followers.
- Non-admin hits `/admin/follower-categories` → `FORBIDDEN`, no write.
- Duplicate `key` on create → `VALIDATION_ERROR` (field `key`).
- Hidden tile excluded from follower list but retained in admin (Show restores it).
