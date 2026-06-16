# 06 — Before/After Diff Notes: Phase 6 Presentation Types

Locked reference: `../04-preview/mockups/phase6-presentation.html`.
Capture mode: web (admin App Sections) via Playwright + device/OTA (follower), at the
founder verify.

## Implemented
**Backend (additive, no migration):**
- `collectionLibrary.getForRender` — now also returns member `image_url` (for tiles).
- `sectionEngine.buildSections`:
  - Collection placement with `config_json.presentation_type='hero_tiles'` → emits a
    single `hero_tiles` shelf (hero meta + a tile per member section), instead of the
    inline header + member rows. Default/unset collection → unchanged header+rows.
  - `library_products` placement with `presentation_type='banner'` → emits a
    `banner_gateway` shelf (no rule pre-run; gateway shows always). Default → row.

**Admin (`app/admin/sections/page.js`):**
- Presentation picker in the ⚙ editor: library_products → Row/Banner;
  collection → Row/Hero+Tiles. Banner fields (eyebrow/headline/CTA/image URL) +
  hero fields (eyebrow/title/image URL). Publish-guard: banner needs a headline.

**Mobile (`components/SectionRenderer.js`):**
- `banner_gateway` renderer (reuses the 5b cream banner styling + optional image) →
  tap = the existing `seeAll` → `SectionResults` with the section rule + context.
- `hero_tiles` renderer (gold hero band + tile rail) → each tile → `SectionResults`
  for that member section's rule + context.
- `hasEngineContent` now counts the presentational types so a banner/hero-only
  screen renders the engine path (not the hardcoded fallback).

## Verification
- `node --check` + require-cycle: clean. brand-web `npm run build`: exit 0.
- `pnpm qa`: 79/79 GREEN gate 0. No migration; default-inert (existing placements
  render as rows unchanged).

## Deploy (pending explicit founder go — production-impacting)
migrate n/a → commit (by path) → push origin main (Render + Vercel) → OTA follower.
released=false until founder verify.
