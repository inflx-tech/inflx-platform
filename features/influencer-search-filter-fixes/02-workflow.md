# 02 — Workflow

## W1 — Filter by city

1. Discover tab, type "Vijayawada" in the City field.
2. Debounced search fires; several overlapping requests may be in
   flight while typing.
3. **Predicted:** the final rendered result set is always the one for
   the complete query — 6 creators — regardless of which response
   arrives last.
4. **Today:** a slow earlier response can land last and repaint the
   unfiltered list, so the filter looks inert.

## W2 — Tier chips as a switcher

1. Search with no tier filter → chips read
   All 69 · Nano 13 · Micro 30 · Mid 13 · Macro 11.
2. Click **Micro** → results narrow to 30.
3. **Predicted:** all five chips remain visible with unchanged counts;
   Micro is the active one. Clicking **Mid** switches directly.
4. **Today:** Nano/Mid/Macro vanish, leaving All + Micro, with no way
   back except the dropdown or Clear.

## W3 — Tier with no matches under a filter

1. Set City = Vijayawada. Facets are
   all 6 · Micro 2 · Mid 3 · Macro 1 · **Nano 0**.
2. **Predicted:** the Nano chip still renders, dimmed and disabled,
   with a tooltip. It is not removed — the absence is information.

## W4 — Counts agree with the header

The All chip must equal the "N searchable" count in the header. They
disagreed before (50 vs 69) because chips counted the loaded page.

## Verification

- Facet SQL run directly against the production database:
  no filters → `{all:69, micro:30, nano:13, mid:13, macro:11}`,
  which matches the header's 69 exactly.
- `pnpm qa` green.
- Manual: founder's end-to-end pass.
