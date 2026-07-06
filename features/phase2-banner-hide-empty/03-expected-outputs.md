# Expected outputs — Phase 2 banner hide-when-empty

- NEW suite `backend/tests/section-banner-gateway.test.js` — 3/3 GREEN:
  (1) matching banner kept with the unchanged banner_gateway shell shape;
      dry + unresolved banners omitted;
  (2) static frame with empty items never dropped;
  (3) context-sensitivity: same banner present on the brand page WITH
      matching products, absent on the brand page WITHOUT (direct-SQL
      fixtures — no campaign API, immune to the tier-CASCADE harness defect).
- `tests/section-engine.test.js` — unchanged failure set (3 pre-existing),
  8 passing.
- `pnpm qa` GREEN, gate 0.
- No Packages/** file touched — no OTA, no Maestro gate, no mockup gate.
