# Feature Spec — Restaurant dish search + custom-name flywheel

> Order: 1 of 6 · Depends on: — · Status: STUB (draft, not locked). Independent of #2 — can run in parallel.

## Problem / goal
Restaurant is the only listing vertical with real prod data (34 products + a 129-dish `master_dishes` dictionary), but its dictionary mode is **browse-only + exact-match** (`RestaurantDishPicker` walks cuisine→section grids; `excel.service.js findMasterMatch` is `LOWER(name)=LOWER()`). Sellers can't search by typing, custom dish names are stored unlinked (`master_dish_id=NULL`) and never improve the catalog. Goal: add **typeahead dish search**, **capture the seller's own display name linked to a canonical dish**, and a **self-growing flywheel** so the dictionary improves from real usage. Roles: **brand** (restaurant owner) + **admin** (queue resolution).

## Scope
- In scope: enable `pg_trgm` + `unaccent`; fuzzy dish-search endpoint; display-name-vs-canonical capture (keep seller's words, link `master_dish_id`); `pending_dishes` queue + `dish_aliases`; cross-restaurant auto-promotion job; admin resolve UI; `master_dishes.popularity_rank`.
- Explicitly out of scope: non-restaurant verticals, real-gold pricing, AI/LLM enrichment (rule + trigram only for v1), the drill-down engine (#2).

## Surfaces touched
- App(s): backend; brand-web (`RestaurantDishPicker` → add typeahead + custom-name field); admin-web (new dish-queue screen).
- Roles involved: brand (approved), admin:reviewer.

## Data / contracts
- New/changed tables: enable extensions `pg_trgm`,`unaccent`; `master_dishes` += `popularity_rank int`, optional `aliases`; new `dish_aliases(id, master_dish_id, alias_text, source)`; new `pending_dishes(id, brand_id, brand_product_id, raw_name, suggested_master_dish_id, status[pending|alias|promoted|rejected], resolver, created_at)`. `brand_products` already has `name` (display) + `master_dish_id` (canonical) — wire the picker to set both.
- Endpoints: `GET /brands/me/dishes/search?q=` (trigram+unaccent ranked, popularity tiebreak); `POST /brands/me/products` custom dish → live immediately + row into `pending_dishes`; `GET/PATCH /admin/dish-queue` (resolve as alias/new-canonical/reject).
- Money/units/attribution: none changed.

## Non-functional
- Auth/role gates: search/create = `requireRole('brand')` approved; queue = `requireAdminRole('reviewer')`.
- Failure modes: never block listing on no-match (custom dish always goes live); keep seller's exact display name verbatim; promotion job idempotent; search degrades to ILIKE if extension missing.
