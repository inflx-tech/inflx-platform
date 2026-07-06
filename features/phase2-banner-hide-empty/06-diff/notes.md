# Before / after — Phase 2 banner hide-when-empty

## Engine behaviour
- **Before:** banner gateways emitted unconditionally BEFORE the rule ctx was
  even built (`items: [] + continue`); unresolved ones leaked through the
  generic path as empty ghost tiles; rule-driven hero_tiles with 0 items
  still reached the renderer (which draws presentation types regardless).
- **After:** the gateway branch moved below the ctx/cache-key build; a
  `limit:1` probe under `key:exists` decides keep-vs-drop; unresolved
  gateways drop; empty rule-driven hero_tiles drop; kept banners emit the
  byte-identical shell. Static frames provably never dropped (test 2).

## Verification
- New `tests/section-banner-gateway.test.js` 3/3 GREEN first run — includes
  the founder's exact scenario (same banner: present on the brand page with
  matching kurtis, absent on the brand page without).
- `tests/section-engine.test.js`: failure set unchanged (3 pre-existing).
- `pnpm qa`: see lock note. No Packages/** touched — no OTA needed.
