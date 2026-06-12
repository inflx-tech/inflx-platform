# Follower display fixes — P6 blank chips + P8 "0 places"

> Contract slug: `follower-display-fixes-p6-p8`. Two diagnosed display bugs from
> the 2026-06-10 follower diagnostic / walkthrough ledger (P6, P8). Bug fixes to
> existing locked screens — no new design.

## P6 — blank filter chips
`SectionRenderer.ChipRow` rendered each chip value raw (`<Text>{l}</Text>`).
Chips arrive as strings OR objects (`{label,value}`/`{name}`/`{key}`), so object
chips blanked out. Fix: a `chipLabel()` normaliser (string → as-is; object →
label/name/value/key) applied to all chip sources, empties dropped.

## P8 — "0 places" count inconsistent with shown businesses
`CategoryListScreen` header showed `{stores.length} places`. With the section
engine active (`SECTION_ENGINE_CATEGORY`) businesses render from `sections`, not
`stores` (which is empty in that mode) → "0 places" while stores are visible.
Fix: a `placeCount` that counts distinct brands across the rendered
`filteredSections` when the engine is active, falling back to `stores.length`.

## Scope
Mobile only (`SectionRenderer.js`, `CategoryListScreen.js`). OTA. No backend, no
DB, no migration, no data shape change.

## Verification
Both files parse clean; founder walk (chips show labels; the count matches the
businesses shown). `pnpm qa` GREEN (deploy-inert for the web/backend suite).
