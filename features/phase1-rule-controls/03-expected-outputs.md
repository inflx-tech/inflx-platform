# Expected outputs — Phase 1 rule-control knobs

- `backend/tests/brandOffers.adapter.test.js` — new case
  `minDiscountPct knob hides offers below the floor` GREEN (27/27 suite).
- `tests/section-engine.test.js` — same 3 pre-existing failures as the
  Phase 0 baseline (order drift / 7→5 verticals / brand-shelf fixture),
  8 passing incl. `biggest_discounts` + `deals_ending_soon` which execute
  the edited SQL — zero new failures.
- `pnpm qa` GREEN, gate 0.
- Syntax: node --check on both services; esbuild JSX parse on page.js.
- Manual: wizard Step 3 shows "Rule options" only for offers/brands/windowed
  rules; inline editor shows the same group under the rule picker; blank
  values save as null and the backend treats them as no-filter.
