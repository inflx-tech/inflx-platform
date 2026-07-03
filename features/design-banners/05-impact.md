# Impact Analysis — Banner pack designs (P3b)

> One-line verdict: **additive — three new tiles styles + a collage layout knob
> + three enum words + two un-greyed wizard cards; existing sections and the
> follower payload shape are untouched.**

## Affected files
- mobile: `Packages/Mobile/src/components/sections/TileSection.js` — new
  `strip` / `split` / `fullbleed` style branches; `slot_template` layout in
  MosaicStyle (default 'free' = current behavior).
- backend: `adminSections.controller.js` — TILE_STYLES += 'strip','split','fullbleed'.
- web: `admin/sections/page.js` — un-grey announcement_strip + split_banner;
  full_width_banner fills ['images','rule'] with fill-switch draft reconfig;
  collage slot-layout picker; PreviewSection cases; resolveDesignId (fullbleed→
  full_width_banner, strip→announcement_strip, split→split_banner).

## Risk notes
- Pre-OTA devices: unknown styles → CarouselStyle default (verified graceful in
  P3a). Existing mosaic rows: slot_template absent → 'free' branch = today's
  render, byte-for-byte.
- full_width_banner dual-fill: the only non-trivial wizard change — switching
  the Content fill tab must reset shelf_type/style/rule cleanly so a
  half-configured draft can't ship a mixed shape. Covered by e2e assertions
  4a/4b.
- Rollback: revert commit; existing rows unaffected.

## Release classification
**production-impacting** — Render (enum) + Vercel (wizard) + **OTA ×3** (renderer),
Mobile-governed. Batched with P3a's held OTA: one Maestro run (or founder
override) verifies P3a+P3b renderers, one OTA ships both. Web+backend can ship
on push immediately (as P3a did); mobile OTA held for device verification.
