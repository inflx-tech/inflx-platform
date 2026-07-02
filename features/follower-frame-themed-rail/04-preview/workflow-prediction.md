# Workflow prediction — follower-frame-themed-rail

## Mockup — `themed-rail.html`
Shows both target renders (reviewed live in chat via the visualize tool, saved here):
- **Pattern A (deals):** white shell · title left · **boxed countdown** right ·
  horizontal rail of medium tiles (image + name + % off).
- **Pattern B (themed):** colored shell · centered title · horizontal rail of large
  tiles (image + label overlay).

Prediction: both come from one `themed_rail` layout; the difference is three config
knobs — `frame.bg_color`/`frame.bg_image_url`, `timer`, and `tile.size`.

## Admin prediction
Picking "Themed rail" reveals the Frame panel (bg color/image, title align, tile
size). Publishing writes `config.style='themed_rail'` + `config.frame` + `config.tile`
(+ existing timer/tiles). Verified by build/lint; founder composes both patterns.

## Follower prediction
`TileSection → ThemedRailStyle` renders the shell + header + scroll rail from config;
tile tap → `SectionResults` grid; expired timer hides the frame. Reuses shipped tile
components (toing palette) — verified by founder walk, not Playwright.
