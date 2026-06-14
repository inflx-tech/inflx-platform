# Feature Spec — Platform-page product gate (pushed)

> Order: Phase **2c** of `_MERCH_ENGINE_ROADMAP.md` · Depends on: 2a · Status: **STUB (draft, not locked)**.
> Third of 3 Phase-2 (visibility gate) sub-contracts. **Backend-only.**

## Problem / goal
The follower **platform pages** (Home / Category) currently show **all** active
products of approved brands — `sectionRules.productsInCategory()` and the brand
existence check in `businessesInCategory()` query `brand_products WHERE
is_active = true` with **no curation gate**. The founder's rule: platform pages
show **only pushed-to-store (∪ allocated)** products. Goal: gate these shelves to
`pushed_to_store = true`.

The **offer/deal shelves** already gate by nature — `campaign_offers` are
allocated via campaigns, and store-direct `brand_offers` carry
`published_to_store`. So only the **product** shelves leak; this contract gates them.

Roles: **follower** (Home/Category show pushed products).

## Scope
- **In scope:**
  - `productsInCategory()` — add `AND bp.pushed_to_store = true`.
  - `businessesInCategory()` — gate the `EXISTS(brand_products …)` with `AND pushed_to_store = true` (a brand surfaces only if it has a pushed product).
- **Explicitly out of scope (deferred → 2c-2):**
  - The **"∪ allocated"** half for platform products (an un-pushed but creator-allocated product appearing on Home/Category). Reason: efficient platform-wide allocation requires a materialized index; allocated products are **already visible via the creator store (2b)**; and with default `pushed=true` there is **no behaviour difference today**.
  - Offer/deal shelves (already gated by campaign-allocation / published_to_store).
  - Brand store (2a) / creator store (2b).

## Surfaces touched
- backend only (`sectionRules.service.js`).
- Roles: follower (read). No schema/migration, no web/mobile change.

## Data / contracts
- **Tables:** none new (reads `brand_products.pushed_to_store` from mig 101).
- **Endpoints:** the section feeds (`/follower/home`, `/category/:key`) — same shape; product shelves now filter pushed.
- **Money/attribution:** none.

## Non-functional
- **Auth/role gates:** unchanged.
- **Behaviour on deploy: parity** — every product is `pushed_to_store=true` today, so the gated shelves return the same products. The gate only bites when a brand un-pushes a product (it then leaves Home/Category too, matching the brand store).
- **Failure modes:** pure additional WHERE predicate; no new params, no query-shape risk.
