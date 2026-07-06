# Expected outputs — Phase 3 World Rules

- NEW suite `backend/tests/world-rules.test.js` — 8/8 GREEN:
  absent-row inertness · boundary via radius · boundary via city ·
  show_nearest / show_empty / widen(×2 geometry: 95 km follower, 80 km radius,
  160 km widened reaches VJA not HYD) · curation immunity (brandId guard,
  direct runRule) · mode off (no dist_km, both cities present).
- Combined serial run (world-rules + banner-gateway + section-engine +
  adapter): 46/49 — the 3 = untouched pre-existing section-engine baseline.
- `pnpm qa` GREEN, gate 0.
- Module-load check on routes/index.js passes (env-gate reached).
- Manual: /admin/world-rules lists the live worlds with mode/radius/fallback/
  trending-default; Save + Reset round-trip; nav "World Settings" under Content.
- Prod migration: `node backend/scripts/run-126.js` (additive, ships empty).
