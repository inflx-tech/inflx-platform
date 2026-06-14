# Feature Spec — Product push-to-store + brand-store gate

> Order: Phase **2a** of `_MERCH_ENGINE_ROADMAP.md` · Depends on: 1a (tags, shipped) · Status: **STUB (draft, not locked)**.
> First of 3 Phase-2 (visibility gate) sub-contracts. 2b = creator allocation + creator store. 2c = gate platform pages.

## Problem / goal
Today a brand's storefront shows **all** of the brand's active products —
`follower.service.resolveBusinessStore()` queries `brand_products WHERE is_active=true`
with **no curation gate**. The founder's locked model: a brand **pushes** the
products it wants into its store, and **only pushed products** appear there.
Goal: add a per-product **"show in store" (pushed_to_store)** flag, gate the
brand-store query on it, and give brands a toggle. (Offers already have
`published_to_store` from mig 084 — this is the **product** equivalent.)

**Behaviour-preserving on deploy:** the flag defaults to **pushed=true** and the
migration backfills existing products to pushed → nothing disappears; brands
then curate by **un-pushing** items they don't want in the store. (Decision to
confirm at lock — see Non-functional.)

Roles: **brand** (push/un-push), **follower** (sees only pushed in a brand store).

## Scope
- **In scope:**
  - `brand_products.pushed_to_store boolean NOT NULL DEFAULT true` + index; backfill existing → true.
  - `resolveBusinessStore()` filters `pushed_to_store = true` (brand store only).
  - `createProduct` / `updateProduct` accept `pushed_to_store`; `listProducts` returns it.
  - Brand UI: a **"Show in store"** toggle per product (standard product form; drill-down FleetView toggle noted as the harder surface — may split).
- **Explicitly out of scope:**
  - Gating **platform pages** (Home / Category / deal shelves) → **2c** (needs the allocation half too).
  - Creator store / allocation → **2b**.
  - Offer push-to-store (already exists).
  - Changing default visibility behaviour (seed/backfill keeps parity).

## Surfaces touched
- backend (migration + `follower.service` brand-store query + `brand.controller` create/update/list); brand-web (product form toggle).
- Roles: brand (approved); follower (read, output = pushed-only).

## Data / contracts
- **Table:** `ALTER TABLE brand_products ADD COLUMN pushed_to_store boolean NOT NULL DEFAULT true;` + `CREATE INDEX ... (brand_id, pushed_to_store) WHERE is_active`. Backfill is implicit (default true on existing rows).
- **Endpoints:** `POST/PATCH /brands/me/products` accept `pushed_to_store`; `GET /brands/me/products` returns it. `GET /business/:brand_id` (resolveBusinessStore) filters pushed.
- **Money/attribution:** none.

## Non-functional
- **Auth/role gates:** push toggle = `requireRole('brand')` approved; brand-store read unchanged.
- **DECISION TO CONFIRM AT LOCK — default visibility:**
  - **(A, recommended) default pushed=true** — listing = visible (parity with today); brand un-pushes to hide. Zero disruption on deploy.
  - **(B) default pushed=false** — explicit opt-in; a newly listed product is invisible until pushed. Stricter curation, but "I listed it but it's hidden" is confusing and would hide products on deploy unless backfilled.
- **Failure modes:** additive migration, behaviour-identical on deploy (default true); un-pushing never deletes; gate filters at query time; brand store falls to empty only if a brand un-pushes everything (expected).
