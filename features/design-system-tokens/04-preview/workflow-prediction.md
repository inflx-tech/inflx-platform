# Workflow Prediction — Design System (Phase 1)

Predicted click-path the mockup demonstrates (to be confirmed against the real screen in the 06-diff step).

1. Admin lands on `/admin/design-system` with world = Fashion (default).
2. Sees a header ("Design System — Fashion World") + a world switcher.
3. Sees five sections in order: **Presets** (top, since that's the admin's starting point), then **Moods · Palettes · Typography · Backgrounds**.
4. **Presets:** cards, each naming the bundle + its mood/palette/typography/background chips.
5. **Palettes:** each row shows five swatches + hex + label.
6. **Typography:** each row shows "Street Style" rendered in that style.
7. **Backgrounds:** grid of tiles filled with the seeded avg-color + label; a small "asset pending" marker where `asset_r2_key` is null.
8. Read-only: no create/edit buttons (a muted note explains editing arrives in a later phase).

Expected empty-state: before seeding, each section shows "Nothing seeded yet."

This screen has **no writes** — it is the catalog the Phase-2 Theme wizard will consume.
