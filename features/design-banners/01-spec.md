# Feature Spec — Banner pack designs (Cleanup P3b)

> Program: Section System Cleanup (Docs/SECTION_SYSTEM_SPEC.md §3, LOCKED).
> Predecessors: P1 scheduling (live), P2 wizard (live), P3a hero_slider
> (web+backend live; mobile OTA held for Maestro). P3b's mobile renderers
> ride the SAME held OTA — one Maestro run ships P3a + P3b together.

## Problem / goal
After P3a, three catalog designs are still greyed (announcement_strip,
split_banner) or single-fill (full_width_banner = rule only), and collage is
free-form only. This contract makes every non-parked catalog design buildable.

## Scope — four additions
1. **Announcement strip** (`announcement_strip`) — renderer `tiles` style
   `strip`: one full-width thin image (1080×240, ratio 0.222), one tap.
   Wizard card un-greyed; fills `['images']`.
2. **Split banner** (`split_banner`) — renderer `tiles` style `split`: two
   half-width tiles in a row (~1:1 each), independent per-tile actions.
   Card un-greyed; fills `['images']`.
3. **Full-width banner image fill** (`full_width_banner`) — today fills
   `['rule']` (the banner_gateway). Add `'images'` fill → renderer `tiles`
   style `fullbleed`: one edge-to-edge image (1080×720, ratio 0.667), one
   tap. Wizard Content offers image OR rule; picking a fill reconfigures the
   draft (images → tiles/fullbleed; rule → products/library_products/banner).
4. **Collage slot templates** (`collage`) — `mosaic` renderer gains
   `config.slot_template`: `'1big+2small'` | `'2x2'` | `'1+3'` | `'free'`
   (default `'free'` = today's per-tile size behavior — zero change to
   existing collage rows). Wizard adds a slot-template picker.

## Surfaces / data
- mobile: `Packages/Mobile/src/components/sections/TileSection.js` — three new
  style branches (strip/split/fullbleed) + slot_template handling in MosaicStyle.
- backend: `adminSections.controller.js` — TILE_STYLES += 'strip','split',
  'fullbleed' (validation allow-list; one line).
- web: `admin/sections/page.js` — un-grey 2 cards + full_width_banner fill
  switch + collage slot picker + PreviewSection cases for the new styles.
- No new endpoints/tables/migrations. config_json keys (`style`,
  `slot_template`) validated/tolerated by P1.

## Non-functional
- Pre-OTA devices render unknown styles via CarouselStyle default (graceful);
  existing mosaic rows unaffected (slot_template absent → 'free').
- Release class: **production-impacting** — backend (Render) + wizard (Vercel)
  + mobile (**OTA ×3**). Mobile-governed → Maestro green (or founder override)
  before released=true; batched with P3a's held OTA.
