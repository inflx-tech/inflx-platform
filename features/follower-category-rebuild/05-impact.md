# Impact — follower-category-rebuild

**Verdict: visual + UX rebuild of the Category screen + one new functional sub-cat
filter (client-side, real data). No backend/data/contract change. 4-ID preserved.**

## Mechanics
- `CategoryListScreen` chrome rebuilt (compact header + sticky sub-cat bar). Data
  fetch (`getCategorySections` + legacy fallback) unchanged.
- Sub-cat chips derived client-side from the real `brand.category` values in the
  payload; tapping filters the brand/all-list items in-memory before they reach
  `SectionRenderer`. No new query/endpoint.
- `SectionRenderer` gains an additive `main_list` branch (brands → list). All other
  shelves and nav targets unchanged.
- `StoryCircle` gains an additive follower-count line (shown when present and no
  live badge) — Home stories still show ● LIVE.

## Risk
- **Regression risk: low.** Web QA cannot be affected (mobile-only). Component
  changes are additive (new branch / new file / optional line) → Home + the other
  4 engine screens render unchanged. Mitigation: babel transform + founder
  Maestro/APK smoke + the legacy-layout fallback on engine error/empty.
- Reversible: revert the touched files + re-publish OTA.

## Deploy
- **production-impacting** (follower OTA). Surfaced for explicit go; never silent.
  `released` stays false until go + Maestro attest (or recorded override).
