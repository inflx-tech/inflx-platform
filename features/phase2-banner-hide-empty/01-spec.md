# Phase 2 — Banner-Gateway hide-when-empty

**Program:** Section-rules admin-control program, Phase 2 (locked 2026-07-05).
**Founder go:** "push and continue" — 2026-07-06 (lock delegated under standing autonomy).

## Problem

A rule-driven banner (`library_products` + `presentation_type='banner'`) was a
dumb shell: the engine emitted it WITHOUT running its rule (`items: []`,
`continue`), and the mobile renderer draws `banner_gateway` before the
empty-items guard. Result: the banner rendered on every page it was placed on
— including contexts where its rule matches nothing — and the tap opened an
empty results screen. This blocked the founder's intended model: author ~10
offer banners ONCE, attach to Home + Creator Store + Business page templates,
and let each context self-filter.

## Scope (backend only — no mobile change, no OTA)

In `sectionEngine.buildSections`:

1. **Probe before emit.** For a resolved banner gateway, run its rule at
   `limit: 1` under the section's cache key + `:exists` suffix (the key
   already carries brand/creator/city/rounded-coords). Zero matches → the
   section is OMITTED from the response; the renderer never sees it.
   Emitted shape when kept is byte-identical to before (`type:
   'banner_gateway'`, `items: []`).
2. **Unresolved gateways drop.** A banner whose library rule was deleted or
   hidden previously fell through to the generic path as an empty tiles
   section; now it is dropped (permanent dead-end).
3. **Rule-driven hero_tiles share the semantics.** `library_products` +
   `presentation_type='hero_tiles'` with 0 items → dropped. Static frames
   (`rule='static'`, content in `config.tiles`) are NEVER dropped — their
   `items` is empty by design.
4. **Probe failure = hide.** A throwing probe hides the banner (never a
   dead-end tap, never a 500).

## Out of scope

Rendering matched stores/offers inline in the banner (Phase 4 / D3);
per-world World Rules (Phase 3); admin-preview affordance showing where a
banner is currently hidden (candidate for a later phase).
