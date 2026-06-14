# Feature Spec — Follower Category admin (top-level tiles → DB)

> Order: Phase **1b** of `_MERCH_ENGINE_ROADMAP.md` · Depends on: — · Status: **STUB (draft, not locked)**.
> Second half of Phase 1. Independent of 1a; can ship separately.

## Problem / goal
The follower app's top-level **category tiles** (Eat / Shop / Groom / Stay Fit /
Travel / Home / Events) are **hardcoded** in `listing.service.js:169–177`
(`SUPER_CATEGORIES`) and served by `GET /follower/categories` +
`GET /category/:super_category/stores` (`follower.controller.js:738,771`). Admin
cannot add/rename/reorder/re-icon a tile or change which businesses fall under
it without a code deploy. A *second*, **inconsistent** hardcoded map
(`CATEGORY_MAP`, `sectionRules.service.js:48–55`) drives section-engine category
scoping. Goal: move the **follower tiles** into an admin-managed DB table, seeded
to mirror today (zero behaviour change on deploy), and give admin CRUD over
name / icon / order / status / member business-categories.

Roles: **admin** (manages tiles), **follower** (sees them — unchanged output).

## Scope
- **In scope:**
  - `follower_categories` table: `key, label, icon, sort_order, status, member_categories text[]`.
  - **Seed** it from the current `SUPER_CATEGORIES` (identical keys/labels/icons/sub-lists) → deploy is behaviour-preserving.
  - `listing.service.getSuperCategories()` reads the table instead of the constant (falls back to the constant if the table is empty/unreachable — no follower breakage).
  - Admin CRUD: list / create / update (label, icon, sort_order, status, member_categories) / hide.
  - Admin screen in brand-web (navy theme) + nav entry.
- **Explicitly out of scope (follow-up slices):**
  - Subcategory-tree (`category_nodes`, mig 095) admin editing — **1b-2**.
  - Creator-category / brand-category curation (`influencers.niche[]`, `brands.category`) — **1b-3**.
  - Reconciling the section-engine `CATEGORY_MAP` onto this table — deferred to the **Section-Library phase (3/4)** (it's tied to `section_config` rows + rules).
  - Changing the actual taxonomy content (seed = current; admin may edit after).
  - The L3 pricing `categories` table (`/admin/categories`) — unrelated (per-business marketplace fee).

## Surfaces touched
- **App(s):** backend (migration + `listing.service` + new admin controller/routes); brand-web (new admin screen + nav).
- **Roles involved:** admin (`requireAnyAdminRole`); follower (read path, output unchanged).

## Data / contracts
- **Table:** `follower_categories(id uuid pk, key text UNIQUE NOT NULL, label text NOT NULL, icon text, sort_order int NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','hidden')), member_categories text[] NOT NULL DEFAULT '{}', created_at, updated_at)`. Seeded with the 7 current tiles.
- **Endpoints:** `GET /admin/follower-categories` · `POST` · `PATCH /:id` · `DELETE /:id` (soft-hide). `requireAnyAdminRole`.
- **Read-path change:** `getSuperCategories()` returns active rows (ordered by `sort_order`) shaped `{ key, label, icon, sub_categories }` (sub_categories = `member_categories`), **falling back to `SUPER_CATEGORIES`** if the query returns nothing.
- **Money/units/attribution:** none.

## Non-functional
- **Auth/role gates:** admin CRUD = `requireAnyAdminRole`; follower read unchanged (public/auth as today).
- **Failure modes:**
  - Table empty / query error → `getSuperCategories()` **falls back to the hardcoded constant** (follower app never shows zero categories).
  - Hiding a tile removes it from the follower list but never deletes data; existing brands keep their `brand.category`.
  - `member_categories` values are free business-category keys (validated as non-empty strings, deduped); unknown keys just match no brands (no error).
  - Additive migration + seed; idempotent; behaviour-identical on deploy.
