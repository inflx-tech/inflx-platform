# 03 — Expected Outputs: Phase 6 Presentation Types

## Admin
- App Sections ⚙ editor shows a **Presentation** picker on Library/Collection
  placements; Banner reveals eyebrow/headline/CTA/image-URL with a live preview;
  Hero+Tiles shows hero fields + the collection's tile list.
- Publish-guard blocks an incomplete banner (no headline) / hero_tiles (no collection).

## Follower
- `presentation_type='banner'` → a cream/gold banner card (5b styling) with the
  admin's copy + image → tap opens `SectionResults` for the section rule.
- `presentation_type='hero_tiles'` → hero header + ordered tiles (collection
  members) → tap a tile opens `SectionResults` for that member rule.
- `presentation_type` unset/`'row'` → identical to today (regression-safe default).

## Gate
- `pnpm qa` 79/79 GREEN gate 0; existing row placements unchanged.
- Backend: no migration (rides `config_json`); no new endpoint (`SectionResults`
  reused).
