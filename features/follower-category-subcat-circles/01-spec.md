# Feature Spec — follower-category-subcat-circles

> Founder design revision (2026-06-08) on top of Phase 2
> (`follower-category-rebuild`). Changes the Category sub-category selector from
> pill chips → **round-circle carousel**.

## Problem / goal
The Category sub-category bar shipped as pill chips (matching
`category-comprehensive.html`). The founder prefers **round circles** (consistent
with Home's Browse-by-Category + the Stories carousel). This is a deliberate,
founder-approved deviation from the locked mockup.

Role: **follower**.

## Scope
- **In scope**
  - `CategoryListScreen.js` — render the sticky sub-cat bar as a horizontal
    **round-circle carousel** (icon tile + label), with the active sub-type
    highlighted. Each circle = a real sub-type present in the payload (icon from
    the category accent; "All" uses the super-category icon). Filtering unchanged.
  - `components/vibe/CategoryCircle.js` — additive `active` prop (brown tile +
    brown label when selected).
- **Explicitly out of scope** — backend/data; filtering logic (unchanged);
  other screens; the drill-down taxonomy (frozen).

## Surfaces touched
- Mobile (follower): `CategoryListScreen.js`, `components/vibe/CategoryCircle.js`.
  `CategoryCircle` change is additive (`active` prop) → Home/other uses unaffected.

## Data / contracts
- None. Sub-types still client-derived from the real `brand.category` in the
  payload (no fabrication). 4-ID unchanged.

## Non-functional
- OTA-only (pure JS). Backend-first: circles reflect real sub-types only.
- Defensive: no sub-types → bar hidden (only "All" would show → still hidden by the
  `subcats.length > 1` guard).
