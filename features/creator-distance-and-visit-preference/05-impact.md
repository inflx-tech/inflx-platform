# creator-distance-and-visit-preference — impact

**Production-impacting. No money.** Migration 190 is additive (two nullable columns, 146 rows filled).

- Discover, the set picker and add-to-group change their DEFAULT order from reach to nearest
  first for every brand with a main-branch city. The old sorts remain as choices.
- A creator who never saved invitation settings used to be city-locked for Store Visit (her own
  city); she is now pickable anywhere. A creator who saved an empty list likewise. Creators who
  picked cities are unchanged.
- Rows gain `distance_km` / `distanceKm`; nothing existing changes shape.
- Brand and creator OTA (JS only).
