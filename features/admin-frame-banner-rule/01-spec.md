# 01 — Spec: admin-frame-banner-rule (per-banner generic rule + brand condition)

## Problem
The follower VISION: a frame holds a carousel of banners; **each banner carries its
own rule**, and the rule is ANY mix of optional conditions (under ₹X · min % off ·
brand · category · tags · has-offer) — none mandatory. Today an image tile can only
be wired to a pre-saved Section Library group, and the engine has **no brand-label
condition**. This contract builds the ENGINE of the Frame tool (Program A): the
generic per-banner rule + the one missing condition (brand). Frame *styling* (the
5 named looks, countdown, mosaic) is look-and-feel → the later design pass.

## Scope
- **Backend rule** (`sectionRules.service.js` `libraryProducts`): add a **brand**
  condition filtering `brand_products.facets.brand` (catalogue brand label, NOT the
  seller). Case-insensitive scalar match OR jsonb-array membership.
- **Backend tap endpoint** (`follower.controller.js` `getSectionResults`): accept an
  inline `rule_json` query param → `ctx.ruleDef`; `rule_json.business_type` (the world
  the banner was placed in) scopes the results.
- **Admin** (`brand-web/app/admin/sections/page.js`): per image-tile, a generic inline
  rule form — under ₹ · min % off · brand · tags · has-offer (all optional). Stored as
  `config_json.tiles[i].rule_json` (+ `business_type` = the world). `patchTileRule`.
- **Mobile**: `SectionRenderer` tiles tap passes the banner's `rule_json` (else the
  wired group); `SectionResultsScreen` + `api.getSectionResults` thread `rule_json`.

## Out of scope (deferred)
- Frame STYLES: the 5 named looks, countdown timer, mosaic mixed-sizing, pinned-title
  framed carousel — design pass (founder: engine first, look later).
- AI image generation (Phase 6). Banner image = upload today.
- Browser / whole-page tap destinations (Phase B chooser). Tap → product grid today.
- Category-node condition in the inline form (engine supports `subcategory_node_id`;
  the per-tile node picker is a fast-follow).

## Grounding (file:line)
- Rule engine: `sectionRules.service.js` `libraryProducts` (reads def.price_min/max,
  min_discount_pct, has_offer, subcategory_node_id, tags; +brand now).
- Tap path: `follower.controller.js:1415-1463` `getSectionResults` (ruleDef from
  library_section_id; +inline rule_json now).
- Render/tap: `SectionRenderer.js:252-263` tiles onTile; tile data rides
  `config_json.tiles[]` through the engine.

## Acceptance
- A banner with `rule_json:{brand:'Nike', min_discount_pct:40}` → tap shows Nike
  products with ≥40% off, scoped to its world. `{price_max:99}` → products under ₹99.
  Empty rule_json → falls back to the wired group.
- Brand condition matches case-insensitively. Existing tile wiring unchanged.
- pnpm qa green; brand-web build exit 0; mobile jest unchanged-green.
