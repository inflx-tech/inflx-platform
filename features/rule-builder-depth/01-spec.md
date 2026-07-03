# Feature Spec — Rule builder depth (Cleanup P4)

> Program: Section System Cleanup (SECTION_SYSTEM_SPEC §8). Predecessors P1–P3 live.

## Problem / goal
The Kind-2 rule builder can't express three common merchandising intents:
"only <brand> products", "exactly these products, in this order", and
"everything except <tag>". Adjacent bug found (verify-twice): the tile
builder's existing **Brand field is a silent no-op** — `libraryProducts` SQL
supports `def.brand` (facets.brand) but `validateRule` STRIPS it, so saving a
brand rule to the library silently drops the condition.

## Scope
1. **validateRule** (`sectionLibrary.service.js`): accept `brand` (string —
   fixes the silent strip), `exclude_tags` (array, normalized like tags),
   `product_ids` (array of id strings, deduped order-preserving, cap 50).
2. **libraryProducts** (`sectionRules.service.js`): `exclude_tags` →
   `AND NOT (bp.tags && $x)`; `product_ids` → `AND bp.id = ANY($x::uuid[])`
   with **admin's order winning** (`array_position` leads ORDER BY).
3. **Product search endpoint** for hand-picking: `GET /admin/section-library/
   product-search?business_type=&q=` → gated products (approved brand +
   pushed_to_store) name-ILIKE, id/name/price/image/brand, limit 20.
   Same `libraries` capability gate as the rest of the library routes.
4. **Admin UI** — BOTH rule-builder surfaces get the three fields (skipping
   one would let an edit there silently strip the new keys):
   - Wizard "My rule" inline builder (`admin/sections/page.js`): Brand input,
     exclude-tags chips (second row, ⊘), hand-pick search + ordered pick list.
   - Section Library page (`admin/section-library/page.js`): same three.
- Out of scope: mobile (zero renderer impact — rules resolve server-side),
  per-slide/tile rule depth beyond what rides automatically, analytics (P5).

## Data / contracts
- No tables/migrations. rule_json gains optional keys `brand`, `exclude_tags`,
  `product_ids` (validated server-side; preview endpoint exercises them).
- One NEW endpoint (product-search, admin+libraries). Existing endpoints
  shape-unchanged.

## Non-functional
- Hand-picked rules stack with page context like any rule (creator store =
  intersection with allocation; brand page = that brand only).
- Release class: **production-impacting** (Render + Vercel). NO mobile, NO OTA,
  NO Maestro gate. Founder pre-authorized completion+deploy of P4+P5
  ('pls proceed and complete remaining two phases', 2026-07-03) — deploy
  surfaced loudly, not silently.
