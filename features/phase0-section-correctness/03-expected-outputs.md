# Expected outputs — Phase 0 section correctness

- `backend/tests/brandOffers.adapter.test.js` — new case:
  `brandId scope (business page) keeps only that brand's offers` — GREEN;
  no-brandId call stays unscoped (home unchanged). Suite: 26/26 GREEN.
- Full backend jest suite — zero regression vs pre-change baseline.
- `pnpm qa` — GREEN (79 workflows, 2026-07-05 baseline), gate 0.
- Manual (admin UI): wizard step 4 Category browser shows node picker;
  inline editor + tile picker likewise; past-end-time shows red warning and
  blocks wizard finish; Publish pre-check message names the offending section.
- SQL spot-check (business page): every offers-rule query carries
  `AND b.id = $brandIdx` when ctx.brandId is set; V2 path filters
  `n.brand.id === ctx.brandId`. Engine cache key already contains brandId
  (verified — no cross-page cache bleed).
