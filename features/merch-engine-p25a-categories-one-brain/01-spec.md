# Feature Spec — Categories: one brain (Phase 2.5a)

> Foundation step 1 of the follower-app re-architecture. Backend + data only.
> Written and agreed BEFORE any code.

## Problem / goal
The follower app has **five different definitions of "which businesses belong to a
category"**, keyed inconsistently, plus a leftover `fashion_walkin` / `fashion_online`
split. When the founder edits a category tile in admin, *some* screens update and
*others don't* — so "Fashion" can still show furniture/restaurants depending on which
screen and which source that screen happens to read. This is the recurring class of bug.

**Goal:** make ONE source of truth for the category→business mapping —
the admin-managed `follower_categories` table — and route **every backend
discovery/store/deal/search code path through it**. After this, editing a tile in admin
changes every screen identically. The bug class becomes structurally impossible on the
backend (which is what drives the category screen the founder is hitting).

This is **Phase 2.5a**. Two clean follow-ups (separate contracts) finish the floor:
- **2.5b** — remove the hardcoded category lists baked into the mobile app + flip the
  brand-registration dropdown value to `fashion` (UI-governed; mockups + OTA).
- **2.5c** — retire the legacy hardcoded follower screens once the section engine fully
  covers them (delegated; careful, screen-by-screen coverage check).

## Scope
- **In scope (2.5a):**
  - New backend `taxonomy.service.js` = the single read API over `follower_categories`
    (tiles, members-for-tile, business-type→tile, business-type alias normalisation).
  - Migration `102` — (a) data: `UPDATE brands SET category='fashion'` for the two old
    fashion values; (b) reset `follower_categories` to the **5 launch tiles** with
    single-business-type members; hide the other tiles; (c) reconcile `section_config`
    `category_key` values (`dining`→`food`, `shopping`→`fashion`) so home shelves point
    at real tiles.
  - Repoint every backend category-filter to `taxonomy.service`:
    `sectionRules.service` (categoryFilter / CATEGORY_MAP), `follower.service`
    (getDealsByCategory's duplicate CATEGORY_MAP, resolveCategoryStore),
    `sectionEngine.service` (CATEGORY_LABELS → table label).
  - Keep a **minimal hardcoded fallback** only for DB-unreachable (never a second
    source of truth).
  - Update affected backend tests honestly (no fake-green).
- **Explicitly out of scope (this contract):**
  - Mobile hardcoded lists (`CategoryGrid` DEFAULT, `FindScreen` SUPER_CATEGORIES,
    `CategoryListScreen` dispatch) → **2.5b**.
  - Brand-registration dropdown value change (`fashion_walkin`→`fashion`) in
    `BrandRegisterScreen.js` + `login/page.js` → **2.5b** (UI-governed). Safe to defer
    because the alias layer maps any straggler `fashion_walkin` to `fashion`.
  - Deleting legacy follower screens / old schema stub files → **2.5c**.
  - Sub-category (dictionary) discovery, tags powering sections, creator/brand category
    by sales → later phases (3+). This step is *only* the category→business floor.

## The 5 launch tiles (locked 2026-06-15)
Each tile = exactly ONE business type; all variety lives in sub-categories (later).

| Tile key (new) | Label        | member_categories |
|----------------|--------------|-------------------|
| `fashion`      | Fashion      | `['fashion']`     |
| `furniture`    | Furniture    | `['furniture']`   |
| `food`         | Food         | `['restaurant']`  |
| `beauty`       | Beauty       | `['salon']`       |
| `car_rental`   | Car Rentals  | `['car_rental']`  |

Old tiles (`eat`, `shop`, `groom`, `fitness`, `travel`, `home`, `events`) → `status='hidden'`
(reversible; data kept). `bakery` is NOT a tile — it is a sub-category under Food's
dictionary. `florist`/`grocery`/etc. fall outside the 5 tiles for now (won't appear in
category browse), which is intended.

## Surfaces touched
- **App(s):** backend only (`backend/src/**`, `backend/migrations/**`). No mobile, no web,
  no OTA in 2.5a.
- **Roles involved:** follower (discovery), admin (already edits the table — unchanged UI).

## Data / contracts
- **New migration `102_categories_one_brain.sql`:**
  - `UPDATE brands SET category='fashion' WHERE category IN ('fashion_walkin','fashion_online');`
  - Upsert the 5 launch tiles into `follower_categories` (label/icon/sort/members);
    set all other rows `status='hidden'`.
  - `UPDATE section_config SET category_key='food' WHERE category_key='dining';`
    `UPDATE section_config SET category_key='fashion' WHERE category_key='shopping';`
  - `backend/scripts/run-102.js` (mirrors run-101.js) for the prod apply.
- **New service:** `backend/src/services/taxonomy.service.js`
  - `getTiles()` → `[{key,label,icon,members}]` active rows (ttlCache, bust on admin write).
  - `membersFor(key)` → `string[]` business types for a tile (alias-expanded), `[]` if none.
  - `normalizeBusinessType(bt)` → applies `{fashion_walkin:'fashion', fashion_online:'fashion'}`.
  - `tileForBusinessType(bt)` → reverse lookup (which tile a brand belongs to).
  - Minimal hardcoded fallback ONLY when the table read throws.
- **No API endpoint shape changes.** Same routes, same response shapes; only the
  filtering source changes. (`/follower/categories`, `/follower/section/category/:key`,
  `/follower/deals`, `/follower/search`, `/category/:key/stores` all keep their contracts.)
- **Money/attribution/status machines:** untouched.

## Non-functional
- **Auth/role gates:** unchanged. Admin taxonomy edits stay `requireAnyAdminRole`.
- **Failure modes the feature must handle:**
  - DB/table unreachable → fall back to the minimal hardcoded tile list (never empty,
    never a divergent second source).
  - A brand whose `category` is still an old value (e.g. straggler `fashion_walkin`) →
    `normalizeBusinessType` maps it to `fashion` so it still lands in the Fashion tile.
  - A tile with empty/blank members → matches no brands (honest empty), never "all".
  - `category=all` / no category → no category filter (unchanged behaviour).
- **Parity:** default-safe. After migration, the 5 tiles + alias mean existing fashion
  brands (e.g. Charvitha Fashions, today `fashion_walkin`) show under Fashion exactly as
  expected, and nothing else leaks in.
