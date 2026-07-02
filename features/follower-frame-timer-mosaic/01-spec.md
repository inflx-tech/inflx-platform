# follower-frame-timer-mosaic — Timer + Mosaic Frame style

> Extends the existing App Builder **Frame** tool (`shelf_type:'tiles'`) with two
> deferred looks from the P3 design pass: a **mosaic** tile layout and an optional
> **countdown timer**. Founder request (2026-06-29): "timer frame with multiple
> mosaic tiles inside" (targeting the fashion world, but available on any Frame).

## Problem (verified 2026-06-29)
- Admin Frame Layout dropdown (`sections/page.js`) offers only
  `carousel / featured / grid / banner` — no mosaic, no timer.
- Mobile `TileSection.js` renders those four styles; **no mosaic layout, no
  countdown**. (A `useCountdown` exists only in the influencer OfferDetail screen.)
- The Frame *engine* (tiles, per-tile image + rule, section destination) already
  ships and `config_json` flows through `sectionEngine` untouched → this is
  admin + mobile only.

## Scope (additive; no backend, no migration)

### A — Mosaic layout
- New Layout value `mosaic`. Tiles render in a mixed-size grid: a tile marked
  `size:'large'` spans full width (hero), `size:'small'` renders 2-up.
- Each tile keeps its existing data (image + label + rule) and tap (its rule →
  `SectionResults` grid). Per-tile size stored as `config_json.tiles[i].size`
  (`'large'|'small'`, default `'small'`).

### B — Countdown timer (optional, any Frame style)
- `config_json.timer = { ends_at: <datetime>, label?: 'Ends in' }`.
- Mobile shows a countdown bar above the frame ("⏳ {label} HH:MM:SS", `Dd` prefix
  when >24h). **When it hits zero the whole frame disappears** from the app.
- Absent/blank `ends_at` → no bar (unchanged).

## Storage
```
config_json = {
  style: 'mosaic',                              // new layout value
  timer: { ends_at: '2026-07-10T18:30', label: 'Sale ends in' },  // optional, any style
  tiles: [ { image_url, label, size: 'large'|'small', rule_mode, rule_json|library_section_id }, … ]
}
```

## Out of scope (v1)
- Per-tile 3-way destination (page/category/grid) — tiles keep rule→grid; separate add-on.
- Server-driven timer/expiry enforcement (client-side hide only; the rule still
  returns items — the timer is a display/urgency device, not a gate).
- The other deferred Frame looks (plain strip, spotlight, deal-card variants).

## Non-regression
- `carousel/featured/grid/banner` untouched; a Frame with no `timer` and a non-mosaic
  style is byte-identical to today. `pnpm qa` GREEN 79 holds; TileSection jest test stays green.
