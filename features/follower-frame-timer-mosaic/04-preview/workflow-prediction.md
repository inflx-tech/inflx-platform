# Workflow prediction — follower-frame-timer-mosaic

## Mockup 1 — `admin-mosaic-timer.html`
Predicts the Frame config editor after adding mosaic + timer. Demonstrates:
- Layout dropdown with the new **Mosaic (mixed-size tiles)** option selected.
- A per-tile **Size (Small/Large)** toggle appearing on each banner row (mosaic only).
- The **⏳ Countdown timer (optional)** block (datetime + label + clear).
Prediction: publishing writes `config_json.style='mosaic'`, `config_json.timer`,
and each `tiles[i].size`.

## Mockup 2 — `follower-mosaic-timer.html`
Predicts the follower render. Demonstrates:
- A countdown bar ("⏳ Sale ends in 01:59:42") pinned above the frame.
- A mosaic grid: one full-width large tile + two small tiles, each with image +
  label overlay.
Prediction: `TileSection` renders this from `config.style/timer/tiles`; tap → the
tile's rule grid; timer zero → frame hidden. Follower visuals reuse the shipped
tile/image components (toing palette) — verified by founder walk, not Playwright.
