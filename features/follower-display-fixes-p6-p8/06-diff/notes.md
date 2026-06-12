# Before / after — P6/P8 display fixes

**Before:** filter chips rendered blank whenever the backend sent chip objects
(`{label,value}`) instead of strings (P6). The category header read "0 places"
in section-engine mode because it counted `stores` (empty in that mode) while
the businesses rendered from `sections` (P8).

**After:** chips show their text label regardless of string/object shape
(`chipLabel()` normaliser, empties dropped). The header counts distinct brands
across the rendered sections when the engine is active, falling back to
`stores.length` otherwise — so "N places" matches what's on screen.

**Verification:** both files parse clean; `pnpm qa` GREEN; founder walk
(chips legible; place count matches the visible businesses).

**Capture note:** before = blank chips / "0 places"; after = founder walk on a
section-engine category (release gate). Render-only fix.
