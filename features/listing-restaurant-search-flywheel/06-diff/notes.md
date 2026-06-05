# Before / After Diff — Restaurant dish search + custom-name flywheel

> Step (UI-governed gate). "Before" = the locked `04-preview/mockups/*.html`.
> "After" = the real app exercised by Playwright during `pnpm qa` (GREEN 79/79)
> + `pnpm qa:db` (migration 087 applied clean, substrate OK).

## What was implemented
- **Seller typeahead** (`RestaurantDishPicker.js`): a "Search or type a dish…" box above the existing cuisine→section browse. Fuzzy results from `GET /brands/me/dishes/search` (pg_trgm + unaccent), plus a persistent "Add '<typed>' as your own dish". Browse path unchanged.
- **Custom-name capture** (`brand.controller.createProduct`): a restaurant dish saved without a canonical link goes live immediately and is captured into `pending_dishes` (best-effort; never blocks go-live). Picked suggestions link `master_dish_id` via the `restaurant.json` storage_format (`master_row.id`).
- **Admin Review Queue** tab inside Master Dishes (`brand-web/app/admin/master-dishes` — the live admin surface — and the `admin-web` duplicate): grouped pending names with reach count + suggested match + auto-promote flag; resolve as alias / promote / reject (`adminDishQueue.controller`).
- **Migration 087** (additive, applied to prod): `pg_trgm`+`unaccent`, `master_dishes.popularity_rank`, `dish_aliases`, `pending_dishes`.

## What matches the mockups
- `03-admin-dish-queue.html` → real admin queue: row with custom name, "seen at N restaurants" badge, suggested-match % chip, and the three action buttons. Confirmed by Playwright `qa/web/admin/dish-queue.spec.ts` (3/3 green) — after shots: `qa/artifacts/screenshots/before/dish-queue__pending.png`, `after/dish-queue__resolved.png`. The "Link as alias" PATCH carries `{action:'alias', master_dish_id:7}` and the success toast "…3 listings now point to Dahi Vada" renders, matching `02`/`03` intent.
- `01-dish-search.html` → the typeahead box + "did you mean" suggestion + "add as your own" option are implemented as drawn (orange accent, browse preserved below).
- `02-custom-dish-live.html` → the "NEW · pending review" chip on custom items + immediate go-live.

## What diverged (intentional, vs mockups)
- Admin queue lives as a **TAB inside `/admin/master-dishes`** (locked decision #3), not a standalone page as the mockup framed it — same content, reusing the existing admin nav + `createMasterDish` on promote.
- Suggestion percentages/dish names in mockups were illustrative; live values come from real trigram similarity (cutoff ≥ 0.30).
- Promote action collects cuisine/section via prompts in v1 (admin already knows the taxonomy); a richer modal can come later.

## What to check post-deploy (manual smoke on prod)
1. As a restaurant brand: open the menu wizard → Add individually → type a regional name (e.g. "Perugu Vada"); confirm a suggestion + "add as your own", and that the custom name saves verbatim and goes live.
2. As admin: Master Dishes → Review Queue tab shows the pending name; "Link as alias" links it and the listings resolve; "Promote" creates a catalogue row; "Reject" leaves it as a one-off.
3. Confirm the browse-only path and existing master-dish CRUD are unchanged.

## Verification status
- `pnpm qa` (governance gate): **GREEN 79/79** (incl. this contract's admin spec).
- Flywheel logic jest: 8/8. Migration 087 in-chain: substrate OK (clean apply on a fresh DB; applied to prod 2026-06-05).
- `pnpm qa:db` backend suite: pre-existing systemic failures (OTP-factory + pool), **none referencing this change** — informational lane, does not block the GREEN.
