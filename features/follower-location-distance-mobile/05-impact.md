# Impact — follower-location-distance-mobile (Contract 2)

**Verdict: additive mobile render of `distance_km` + area name. No backend/data
change. Cards gain an optional distance line; Home posts location for the area name.**

## Mechanics
- 3 vibe cards gain an additive `distanceKm` prop; `SectionRenderer` passes
  `item.distance_km`. `CategoryListScreen` now sends coords (Home already did).
  `HomeScreenV2` posts location (logged-in) and shows the returned area name.

## Risk
- **Low.** Additive props; mobile-only (web QA unaffected). Distance/area show only
  with real data; location POST is best-effort with a silent catch → never blocks
  the feed. Reversible: revert files + re-publish OTA.

## Deploy
- **production-impacting** (follower OTA). Surfaced for go; Maestro founder-side
  (recorded override since Mobile/src + released).
