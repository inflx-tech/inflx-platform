# Impact Analysis — Hero slider design (P3a)

> One-line verdict: **additive renderer branch + one backend enum word + one
> wizard card — zero change to any existing section, screen, or payload.**

## Affected files
- mobile: `Packages/Mobile/src/components/sections/TileSection.js` — new
  `hero_slider` style branch (paged ScrollView + interval + dots); no other
  mobile file.
- backend: `backend/src/controllers/adminSections.controller.js` — TILE_STYLES
  += 'hero_slider' (validation allow-list only).
- web: `Packages/brand-web/app/admin/sections/page.js` — DESIGN_CATALOG card
  un-greyed + base config; images editor autoplay field + size hint;
  PreviewSection hero case.

## Risk notes
- Old app bundles (pre-OTA) fall through TileSection's default carousel branch
  for the unknown style — verified against the existing switch shape (line
  36-42): unknown style → CarouselStyle. Graceful by construction.
- Interval hygiene: auto-advance cleared on unmount + suspended during touch;
  single timer per mounted hero.
- Rollback: revert commit; existing rows unaffected (hero rows would render
  as carousel until removed via admin).

## Release classification
**production-impacting** on three surfaces: Render (enum), Vercel (wizard),
**OTA ×3** (renderer). Mobile-governed → Maestro green (or founder-authorized
GOVERNANCE_OVERRIDE) required before `released=true`. Sequence: implement →
local verify (wizard e2e + payload) → pnpm qa → founder go → push (Render +
Vercel) → OTA ×3 → device verification.
