# Workflow — follower-frame-themed-rail

## Admin: build a themed rail frame
1. App Builder → scope + world → ＋ Add Section → **Image / banner frame**.
2. Expand → **Layout → Themed rail (scrollable)**.
3. **Frame** panel:
   - Background: pick a **color** OR **upload an image** (image overrides color).
     Leave both blank → white shell (deals-style).
   - **Title align**: left or center.
   - **Tile size**: Medium (small tiles) or Large (big tiles).
4. Optional **⏳ Countdown timer** (datetime + label) — shows as boxed digits.
5. **＋ Add banner** per tile → image + label + rule (create/saved). Publish.

## Follower: render (runtime)
1. Section arrives with `config.style='themed_rail'`.
2. `ThemedRailStyle` draws the shell (color / image + scrim / white), the header
   (title aligned; boxed countdown if `timer` set and future), and a horizontal
   scroll of tiles at `tile.size`.
3. Tap a tile → its rule's product grid (`SectionResults`), unchanged.
4. Timer reaches zero → whole frame hidden.

## System / data
- Everything rides `config_json` through the existing `sectionEngine` passthrough
  (`config: cfg`). No new endpoint, no migration.

## Edge handling
- No bg color + no bg image → white shell, ink text.
- bg image present → white text + dark scrim for legibility.
- 0 tiles → frame renders nothing (existing guard).
- Blank/expired timer → no bar / frame hidden (existing logic).
