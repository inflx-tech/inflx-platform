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

## Founder-verify bugfixes 2026-06-16 (live-test, founder-reported)
Three defects surfaced when the founder placed fashion sections + tapped through:
1. **Results leaked all industries** (e.g. "Under ₹1999" showed restaurant food).
   Root cause: `getSectionResults` built the category filter only from the surface
   `category_key` (null on Home) and discarded the section's own `business_type`.
   Fix: fall back to the library section's `business_type` for `categoryCats` when
   the surface passes no category — mirrors `sectionEngine.buildSections`. Fashion
   sections now stay fashion-only on banner / hero-tile / View-all.
2. **Banner "see all" rendered deal cards, not a product grid.** The banner passed
   `item_type='banner_gateway'`; `SectionResultsScreen` only grids `item_type==='products'`.
   Fix: banner_gateway `seeAll` now passes `item_type:'products'`.
3. **"Missing creator handle" on a plain product tap.** `ProductDetailScreen` had no
   path for a product tapped from a library/platform shelf (no creator, no offer).
   Fix: added a path that renders the handed product directly.
Verify: backend `node --check` + require graph clean; `pnpm qa` 79/79 GREEN gate 0.
Backend (Render) + follower OTA; no migration, no admin/web change.
