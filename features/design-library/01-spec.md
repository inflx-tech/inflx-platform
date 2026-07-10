# Feature Spec — Design Library + Section Styles + Layout Contracts (Creator Experience Engine · Phase 3)

> Contract-driven Step 2. Agreed BEFORE code. Parent: `Docs/CREATOR_EXPERIENCE_ENGINE/02_LAYOUT_CONTRACTS.md` (the locked rulebook).

## Problem / goal
The visual *grammar* the renderer will obey: a library of **layouts** (Hero, Split, Magazine, Story, Bento, Tile, Card, Shelf header…) — each declaring a **Layout Contract** (what it *requires*, *may show if there's room*, and *never renders*) — plus the **Section Style** vocabulary (how a row of cards behaves: carousel/grid/masonry/collage/story-rail). This is the data the Adaptive Renderer (Phase 4) reads to draw one Asset Pack into any size. These are the 10 layout types in the founder's "Creator Vibe" reference, formalized.

## Scope
- **In scope:** `design_layouts` table (migration ≥131, additive) holding each layout's `contract_json` (required/optional/hidden slots) + aspect + kind; seed of the 10 layouts from `02_LAYOUT_CONTRACTS.md` (migration ≥132); the **Section Style** enum vocabulary (documented + surfaced read-only, no table per Phase-0 decision D4); a brand-web **Design Library** browse screen; a read-only admin API.
- **Out of scope:** the Adaptive Renderer itself (Phase 4), editing contracts from the UI (read-only v1 — contracts are delicate; renderer depends on them), Experience Templates that bind layout+theme+style (Phase 5), Asset Packs (Phase 7).

## Surfaces touched
- Apps: backend, brand-web (admin). No mobile, no follower.
- Roles: admin only, `requireCapability('sections')`.

## Data / contracts
- **New table:** `design_layouts` — per `01_DATA_MODEL.md §A` (key, label, kind[banner|card|frame|structure], aspect_hint, `contract_json`{required[],optional[],hidden[]}, world_key, status).
- **Slot vocabulary (contract_json):** `background · featured_image · avatar · creator_name · title · subtitle · cta · offer_badge · products · price` (from `02_LAYOUT_CONTRACTS.md`).
- **Seed (10 layouts):** hero_banner (16:9), split_banner, medium_card (4:5), small_tile (1:1), story_card (9:16), magazine_card (4:5), product_shelf_header (flex), category_mosaic_tile (1:1), horizontal_carousel_card (3:4), bento_tile (flex) — Required/Optional/Hidden exactly per the rulebook.
- **Section Style vocabulary (enum, no table):** `carousel · grid · masonry · collage · story_rail · tabs · bento · split · hero · magazine` — used on templates in Phase 5; shown as reference here.
- **New endpoints (admin, `requireCapability('sections')`, read-only):**
  - `GET /v1/admin/design-layouts?world_key=` → layouts with contracts.
  - `GET /v1/admin/section-styles` → the section-style vocabulary (static reference).
- Money/attribution/status machines affected: none.

## Non-functional
- Auth/role gate: `requireCapability('sections')`. Default deny.
- Failure modes: empty catalog → empty-state, 200. Read-only — no writes in v1.
- Deploy-inert until migrated + seeded; additive — zero impact on existing screens or the current live section engine.

## Functional outcome
As admin: open **Fashion World → Design Library** → see the 10 layouts as cards, each showing its **aspect**, **kind**, and its **Layout Contract** (green = required, grey = optional-if-room, struck = never), plus the **Section Style** reference. The visual grammar the renderer (Phase 4) will obey now exists as data — "the 10 tiles from the Creator Vibe reference, formalized."
