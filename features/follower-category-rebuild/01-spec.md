# Feature Spec — follower-category-rebuild (Phase 2 of the follower-app rebuild)

> Step 2. Phase 2 of the screen-by-screen rebuild
> (`design/wave4-creator-vibe/NEXT-WINDOW-PROMPT.md`). Builds on Phase 0
> (`components/vibe`) + Phase 1 (Home + shared `SectionRenderer`).

## Problem / goal
The Category screen (Eat/Shop/Groom…) does not match
`design/wave4-creator-vibe/category-comprehensive.html`:
- Header is a big search bar + 4 duplicate top sort-pills; the mockup is a compact
  **back · title (icon + label) · "📍 city · N places" · search icon**.
- The agreed **sticky sub-category chips** (Restaurants/Cafes/…) have **no data**
  (the `subcat_chips` shelf carries no labels).
- **"All Businesses"** renders as a horizontal brand **rail**; the mockup is a
  full-width **list** (thumb + details).
- The shelves themselves already render via the Phase-1 vibe kit (creators,
  brands, products, deals).

Make Category render AS its mockup, with the sub-cat chips wired to **real**
sub-types, driven by the live listing-driven engine, 4-ID intact.

Role: **follower**.

## Scope
- **In scope**
  - `CategoryListScreen.js` — compact mockup header; **sticky sub-category bar**
    populated from the real distinct sub-types in the category payload; client-side
    sub-cat **filtering** of the brand shelves + all-list; suppress the empty
    `subcat_chips` shelf (the screen renders the real bar); keep `filter_bar` as
    display chips.
  - `SectionRenderer.js` — render a `brands` shelf with `config.main_list` as a
    full-width **list** (not a rail).
  - `components/vibe/ShelfBrandListRow.js` (+ index export) — the full-width brand
    list-row.
  - `components/vibe/StoryCircle.js` — optional **follower-count** line (additive;
    Category creator circles show it; Home stories still show ● LIVE).
- **Explicitly out of scope**
  - Backend / migration / endpoint / `section_config` changes (none — all
    client-side + components).
  - The **drill-down taxonomy** (roadmap #2, frozen): sub-cat chips are the
    interim real-sub-type wiring, not the full tree.
  - Functional **sort** wiring of the filter bar (display-only this phase; disclosed).
  - Offer-source fix (Phase 3 — Best Deals stays empty); detail screens; other screens.

## Surfaces touched
- App(s): **mobile (follower)** — `CategoryListScreen.js`, `SectionRenderer.js`,
  `components/vibe/` (new list-row + StoryCircle tweak).
- `SectionRenderer` + `StoryCircle` are shared; changes are additive (a new
  `main_list` branch + an optional follower line) → Home and the other engine
  screens are unaffected except the additive story follower-count.
- Roles: follower (render + navigation only).

## Data / contracts
- New/changed tables, columns, endpoints, migrations: **none**. Consumes the live
  `GET /v1/follower/section/category/:key → { sections }` (shelves seeded in
  083/088). Sub-cat chips are derived **client-side** from the real `brand.category`
  values present in the returned brand shelves (no fabrication).
- 4-ID attribution: cards pass `item.tracking` through untouched (unchanged from
  Phase 1).
- Money: rupees.

## Non-functional
- **OTA-only** (pure JS; no native rebuild; no migration).
- **Backend-first:** sub-cat chips = real sub-types actually present (not a
  hardcoded list); brand list-rows omit rating/distance (no backing field);
  Best-Deals shelf stays empty (offer gap). Filter bar is display-only (sort not
  wired) — disclosed in `06-diff/notes.md`, not faked.
- Defensive: empty/unknown shelves render nothing; if no sub-types resolve, only
  "All" shows (no empty bar). Screen falls back to the legacy stores layout on
  engine error/empty (unchanged).
- Auth/role gates: none.
