# Feature Spec — Product Tags + admin tag-vocabulary

> Order: Phase **1a** of `_MERCH_ENGINE_ROADMAP.md` · Depends on: — · Status: **STUB (draft, not locked)**.
> First contract of the merchandising engine. Independent of 1b (category-admin) — can run in parallel.

## Problem / goal
The merchandising engine routes products into admin-built **Sections** and
**Collections** by **tag** (e.g. "Summer Collection" = `tag = Summer`). Today
products carry **no tags** — only `category_key` / `super_category` / `section`
(singular strings) + drill-down `facets` (jsonb). There is nothing a tag-based
rule can target. Goal: give every product an optional **tags** list, fed by an
**admin-owned fixed vocabulary per business** (so platform Collections stay
clean and consistent) **plus optional free tags** a brand may add for its own
use. Tags **organize**; they do not make a product visible (the push/allocation
gate, Phase 2, decides visibility).

Roles: **admin** (owns the fixed vocabulary), **brand** (applies tags while listing).

## Scope
- **In scope:**
  - `brand_products.tags text[]` (GIN-indexed), default empty.
  - New `tag_vocabulary` table — admin-managed fixed tags keyed by business scope.
  - Admin CRUD for the vocabulary (admin-web).
  - Brand listing: a **tag-picker** (select from fixed vocab for the brand's
    business + add free tags), wired into create/update product.
  - Validation: fixed tags must match an active vocab entry for the brand's scope;
    free tags accepted + normalized + flagged as free.
- **Explicitly out of scope:**
  - Sections/Collections consuming tags (Phase 3/4).
  - The visibility gate / push-to-store (Phase 2).
  - Follower-facing tag chips / tag filtering on screens (later).
  - Category-tree admin management (contract 1b).
  - Auto-tagging / AI tag suggestions.

## Surfaces touched
- **App(s):** backend; brand-web (`ListingWizard` → add a tag step); admin-web (new Tag Vocabulary screen).
- **Roles involved:** brand (approved); admin (`requireAnyAdminRole`).

## Data / contracts
- **Tables:**
  - `ALTER TABLE brand_products ADD COLUMN tags text[] NOT NULL DEFAULT '{}'` + `CREATE INDEX ... USING gin (tags)`.
  - `tag_vocabulary(id uuid pk, scope text NOT NULL, label text NOT NULL, slug text NOT NULL, sort_order int DEFAULT 0, status text DEFAULT 'active' CHECK (status IN ('active','hidden')), created_at timestamptz)` — `scope` = a `brand_products.category_key` value (the business type) **or** `'ALL'` for cross-business tags. `UNIQUE (scope, slug)`.
  - *(Decision to confirm at lock: key vocab by raw business `category_key` (today's data) now; re-group under the formalized follower display-categories once 1b lands. No rework — `scope` stays a string.)*
- **Endpoints:**
  - `GET /admin/tag-vocabulary?scope=` · `POST /admin/tag-vocabulary` · `PATCH /admin/tag-vocabulary/:id` · `DELETE /admin/tag-vocabulary/:id` (soft → status hidden).
  - `GET /brands/me/tag-options` → fixed tags for the brand's `category_key` (+ `ALL`).
  - `POST /brands/me/products` and `PATCH /brands/me/products/:pid` accept `tags: string[]`.
- **Money / units / attribution:** none changed.

## Non-functional
- **Auth/role gates:** vocab CRUD = `requireAnyAdminRole`; tag-options + apply = `requireRole('brand')` approved.
- **Failure modes the feature must handle:**
  - Fixed tag not in active vocab for the brand's scope → reject that tag (`VALIDATION_ERROR`, field `tags`), keep the rest.
  - Free tags allowed but normalized (trim, lowercase-slug, cap length, de-dupe) and stored verbatim-label + slug; marked free (not in vocab).
  - Admin hides/deletes a vocab tag → **existing product tags are untouched** (tags are a snapshot on the product, not an FK).
  - Empty `tags` is valid (optional).
  - Additive migration, **zero backfill** (default `'{}'`), idempotent.
