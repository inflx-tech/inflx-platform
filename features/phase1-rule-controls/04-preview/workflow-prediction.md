# Workflow prediction — Phase 1

- Editing a Deals shelf shows a "Rule options" box with a "Minimum discount %"
  number input (wizard Step 3 + inline editor). Setting 40 and publishing
  narrows that shelf to offers ≥ 40% within ~60s; blank restores everything.
- Editing a Shops row/list shows "Only shops with a live offer" — ticking it
  drops shops with no live campaign offer AND no store-direct published offer.
- Editing a trending/top shelf shows "Trending window (days)" — the score
  lookback follows it; placeholder documents the default (7).
- Sections that support no knob show no box at all; existing sections are
  untouched until a knob is set (deploy-inert).
