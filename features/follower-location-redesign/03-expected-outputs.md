# Expected outputs — Follower v2 location flow

## L0 — tokens
- `theme/tokens.js` exports `toing` with the locked hexes; other palettes
  byte-unchanged. Metro bundles clean; no visual change to any current screen.

## L1 — Location entry
- A follower with no location set sees the entry screen. "Use current location"
  → permission prompt → on grant, GPS resolved + reverse-geocoded area name set.
- "Enter location manually" → Select-your-location (L2).

## L2 / L3 — Select + search
- Saved addresses render from `GET /followers/addresses` with label + truncated
  address (+ distance once wired).
- Typing ≥2 chars → debounced predictions from the Places proxy; tapping a
  prediction resolves exact coords and sets the app-wide location (feed re-ranks).
- "Recently searched" persists across launches (AsyncStorage).

## L4 — Add address
- Verify shows "Located: <area>" (green) once the typed address geocodes.
- Save with no resolvable coords is rejected (no null-coord persist).
- On save, the address appears under SAVED ADDRESSES and is selectable.

## Visual fidelity
- White canvas (`#F4F5F7` page / `#FFFFFF` cards); yellow only on primary
  actions; ink text on yellow; deep-gold for on-white icons/outlines.
- Side-by-side before/after captured in `06-diff/notes.md`.
