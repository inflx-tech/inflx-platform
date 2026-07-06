# Expected outputs — Phase 4a+4b

- NEW `backend/tests/allocation-live.test.js` — 4/4 GREEN: live store scope
  (auto-flow + un-push pull), live category scope, frozen hand-picked list,
  resolve-coupon 200 regression (was 500 on the phantom cs.products_json).
- `tests/world-rules.test.js` — 9/9 GREEN incl. the new 4a override test
  (override bounds ONE shelf; sibling keeps world default).
- Regression sweep: section-banner-gateway 3/3, brandOffers.adapter 27/27,
  section-engine = the same 3 ledgered pre-existing failures only.
- `pnpm qa` GREEN, gate 0.
- No migration. UI-governed (admin sections page) — mockup + diff notes in
  this contract.
