# 01 — Spec: Phase 6 — Presentation Types B (Banner-Gateway) + C (Hero-Tiles)

**Contract:** `merch-engine-p6-presentation`
**Status:** SCOPED FOR REVIEW — founder approves spec+mockups before implementation;
implementation then surfaced for explicit go before deploy (production-impacting).
**Founder decisions 2026-06-16:** build BOTH B and C; banner image via URL field
(no uploader); review-before-deploy.

## Goal
A placed section's RULE can be displayed three ways (Layer 4). Today only
**A = Product Row** ships. Phase 6 adds **B = Banner-Gateway** and **C = Hero+Tiles**,
both of which tap into the **already-built `SectionResults` screen**. No new data,
no new results pipeline, no new gating — only "how a placement is presented".

## Presentation types
- **A — Row** (exists): horizontal carousel of the rule's items.
- **B — Banner-Gateway:** one tappable banner (image URL + eyebrow + headline +
  CTA). Tap → `SectionResults` runs THIS placement's section rule with full context.
- **C — Hero + Tiles:** a hero header + N tiles, one per member section of a bound
  **Collection**; each tile carries its own rule. Tap a tile → `SectionResults` for
  that member section.

## Data model (NO migration — rides `config_json`)
`section_config.config_json` already persists free-form and surfaces to mobile as
`section.config`. Add:
- `config_json.presentation_type`: `'row' | 'banner' | 'hero_tiles'` (default
  `'row'` → every existing placement unchanged).
- `config_json.banner`: `{ image_url, eyebrow, headline, cta_label }` (B only).
- C reuses the bound collection's member sections as tiles (id, name, image_url
  from `section_library`); optional `config_json.hero = { image_url, title }`.

## Backend
- `sectionEngine.buildSections`: (a) for a `library_products` placement with
  `presentation_type='banner'`, emit a `banner_gateway` shelf carrying the rule +
  banner config (does NOT need to pre-run the rule — it's a gateway; show always);
  (b) for a `collection` placement with `presentation_type='hero_tiles'`, emit one
  `hero_tiles` shelf carrying the hero meta + an ordered tile list (each = member
  section id/name/image/rule ref) instead of the header+rows expansion. Row/default
  path unchanged. No new endpoint (SectionResults already serves the tap).

## Admin UI (extend App Sections placement editor)
In the per-placement ⚙ editor add a **Presentation** picker (Row/Banner/Hero+Tiles).
- Banner → show eyebrow/headline/CTA/image-URL inputs + a live preview card.
- Hero+Tiles → only valid on a Collection placement; show hero title/image-URL +
  a read-only list of the tiles (the collection's member sections).
- Publish-guard: hero_tiles requires a collection; banner requires a headline.

## Mobile (`SectionRenderer`)
Two renderers wired to `SectionResults` (reuse the 5b banner styling for B):
- `case 'banner_gateway'` → BannerGateway card → onPress = seeAll(rule, context).
- `case 'hero_tiles'` → Hero header + tile grid; each tile → seeAll(member rule).

## Out of scope
- R2 image upload (URL field for now). Per-tile bespoke rules outside a collection.
  Ranking/recommendation (Phase 7). Brand-Store→engine migration (separate build).

## Acceptance
- Existing placements (presentation defaults to row) render identically — proven by
  `pnpm qa` GREEN gate 0 + the engine's row path being untouched.
- A banner placement renders a tappable banner → Results; a hero_tiles placement
  renders hero + tiles → each tile Results, context-aware.
- `released:false` until founder verify.
